-- A card fee that fits the card sales.
--
-- The daily-journal specification, section 3: she declares the card machine's
-- fee as an expense; we do not compute it for her. The code checks that, in a
-- month with card sales, the fee she declared sits in a plausible range of
-- those sales. Outside the range, or no fee at all, nothing is corrected and
-- nobody is penalised: the month carries the finding as an inconsistency, the
-- range it was judged by, and the figures, so anyone can redo it.
--
--   no_card_sales  no debit or credit card sales: nothing to check
--   ok             fees within [min, max] of card sales
--   missing        card sales and no card fee declared
--   low / high     a fee below or above the range
--
-- The range is a setting, not a constant: journal_check_settings, 1% to 6%
-- to begin with (decided 20/10/2026), changed by staff with
-- journal_check_settings_set. Each finding records the range in force.
--
-- The category "Taxas (maquininha, app)" mixed two things: a card machine
-- takes 1-5% of a card sale, a delivery app 12-27% of an order. Checked
-- together, every woman selling on an app would read as inconsistent. So
-- 'fees' is now the card machine's fee only, and 'app_fees' is new, for apps
-- and marketplaces. Both stay operating costs. No one has used the category
-- yet: WhatsApp is not live.
--
-- Where the finding goes: into the month's snapshot (methodology
-- snapshot-v1.1.0), and from there, visible, into its Business Passport
-- credential. Not yet into the readiness score: the engine is frozen at
-- readiness-v0.1.0, and changing its formula changes the version of
-- attestations already on chain. Counting this in DATA_INCONSISTENT goes with
-- the engine's next version.

create or replace function private.journal_group(p_category text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_category
    when 'stock'          then 'cogs'        -- mercadoria ou matéria-prima
    when 'packaging'      then 'cogs'        -- embalagem
    when 'rent_utilities' then 'opex'        -- aluguel, água, luz, internet, telefone
    when 'transport'      then 'opex'        -- transporte e entrega
    when 'fees'           then 'opex'        -- taxa da maquininha ou do cartão
    when 'app_fees'       then 'opex'        -- taxa de aplicativo ou marketplace
    when 'marketing'      then 'opex'        -- divulgação
    when 'staff'          then 'staff'       -- ajudante ou funcionário
    when 'other'          then 'opex'        -- outro gasto do negócio
    when 'withdrawal'     then 'withdrawal'  -- retirada para casa (pró-labore)
    when 'equipment'      then 'investment'  -- equipamento
    when 'debt'           then 'financing'   -- parcela de empréstimo ou dívida
  end
$$;

create table public.journal_check_settings (
  id                boolean primary key default true check (id),
  card_fee_min_bps  integer not null check (card_fee_min_bps between 0 and 10000),
  card_fee_max_bps  integer not null check (card_fee_max_bps between 0 and 10000),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint a_range_has_its_ends_in_order check (card_fee_min_bps <= card_fee_max_bps)
);

alter table public.journal_check_settings enable row level security;
revoke all on public.journal_check_settings from anon, authenticated;

insert into public.journal_check_settings (card_fee_min_bps, card_fee_max_bps) values (100, 600);

create function public.journal_check_settings_get()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_settings' using errcode = '42501';
  end if;
  return (select jsonb_build_object('card_fee_min_bps', card_fee_min_bps, 'card_fee_max_bps', card_fee_max_bps,
                                    'updated_at', updated_at) from public.journal_check_settings);
end;
$$;

/** Staff change the range. Months already snapshotted keep the range they were judged by. */
create function public.journal_check_settings_set(p_card_fee_min_bps integer, p_card_fee_max_bps integer)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_change_settings' using errcode = '42501';
  end if;
  update public.journal_check_settings
     set card_fee_min_bps = p_card_fee_min_bps, card_fee_max_bps = p_card_fee_max_bps,
         updated_at = now(), updated_by = auth.uid()
   where id;
end;
$$;

/** The card-fee check over a range of days, with everything needed to redo it. */
create function private.card_fee_check(p_entrepreneur_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_dre jsonb := public.journal_dre(p_entrepreneur_id, p_from, p_to);
  v_sales bigint := (v_dre ->> 'card_sales_cents')::bigint;
  v_fees bigint := (v_dre ->> 'card_fees_cents')::bigint;
  v_set public.journal_check_settings%rowtype;
  v_ratio integer;
begin
  select * into v_set from public.journal_check_settings;
  v_ratio := case when v_sales > 0 then round(v_fees::numeric * 10000 / v_sales)::integer end;
  return jsonb_build_object(
    'status', case
                when v_sales = 0 then 'no_card_sales'
                when v_fees = 0 then 'missing'
                when v_ratio < v_set.card_fee_min_bps then 'low'
                when v_ratio > v_set.card_fee_max_bps then 'high'
                else 'ok' end,
    'card_sales_cents', v_sales,
    'card_fees_cents', v_fees,
    'ratio_bps', v_ratio,
    'min_bps', v_set.card_fee_min_bps,
    'max_bps', v_set.card_fee_max_bps);
end;
$$;

create or replace function private.snapshot_indicators(p_entrepreneur_id uuid, p_period text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_from date := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_to date := (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  v_dre jsonb := public.journal_dre(p_entrepreneur_id, v_from, v_to);
  v_status jsonb := public.journal_month_status(p_entrepreneur_id, p_period);
  v_expenses bigint;
  v_revenue bigint := (v_dre ->> 'revenue_cents')::bigint;
  v_prev bigint;
begin
  v_expenses := (v_dre ->> 'cogs_cents')::bigint + (v_dre ->> 'opex_cents')::bigint + (v_dre ->> 'staff_cents')::bigint;
  select (s.indicators ->> 'revenue_cents')::bigint into v_prev
    from public.metric_snapshots s
   where s.entrepreneur_id = p_entrepreneur_id
     and s.period = to_char(v_from - interval '1 month', 'YYYY-MM')
   order by s.version desc limit 1;

  return jsonb_build_object(
    'revenue_cents', v_revenue,
    'revenue_by_method', v_dre -> 'revenue_by_method',
    'business_expenses_cents', v_expenses,
    'cogs_cents', (v_dre ->> 'cogs_cents')::bigint,
    'opex_cents', (v_dre ->> 'opex_cents')::bigint,
    'staff_cents', (v_dre ->> 'staff_cents')::bigint,
    -- Sales minus business expenses as declared. Not a profit.
    'business_balance_cents', v_revenue - v_expenses,
    'withdrawals_cents', (v_dre ->> 'withdrawals_cents')::bigint,
    'investment_cents', (v_dre ->> 'investment_cents')::bigint,
    'financing_cents', (v_dre ->> 'financing_cents')::bigint,
    'receivable_cents', (v_dre ->> 'receivable_cents')::bigint,
    'payable_cents', (v_dre ->> 'payable_cents')::bigint,
    'days_in_period', (v_status ->> 'days')::integer,
    'days_kept', (v_status ->> 'filled')::integer,
    'days_closed', (v_dre ->> 'days_closed')::integer,
    'selling_days', (v_dre ->> 'selling_days')::integer,
    'coverage_bps', round((v_status ->> 'filled')::numeric * 10000 / (v_status ->> 'days')::numeric)::integer,
    'counts_for_credit', (v_status ->> 'counts')::boolean,
    'revenue_change_bps', case when v_prev is not null and v_prev > 0
                               then round((v_revenue - v_prev)::numeric * 10000 / v_prev)::integer end,
    -- Methodology snapshot-v1.1.0: whether the card fees she declared fit her card sales.
    'card_fee_check', private.card_fee_check(p_entrepreneur_id, v_from, v_to)
  );
end;
$$;

create or replace function private.snapshot_take(
  p_entrepreneur_id uuid,
  p_period text,
  p_reason text,
  p_note text,
  p_supersedes uuid
)
returns public.metric_snapshots
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.metric_snapshots;
  v_counts record;
  v_version integer;
begin
  select * into v_counts from private.snapshot_counts(p_entrepreneur_id, p_period);
  select coalesce(max(version), 0) + 1 into v_version
    from public.metric_snapshots where entrepreneur_id = p_entrepreneur_id and period = p_period;

  insert into public.metric_snapshots (
    entrepreneur_id, subject_ref, period, version, supersedes_id, reason, reason_note,
    methodology_version, evidence_level, data_origin, record_count, indicators, salt,
    generated_by, is_simulated
  )
  select p_entrepreneur_id, private.passport_subject(p_entrepreneur_id), p_period, v_version, p_supersedes,
         p_reason, p_note, 'snapshot-v1.1.0', 'SELF_DECLARED', 'whatsapp_journal',
         v_counts.records,
         private.snapshot_indicators(p_entrepreneur_id, p_period) || jsonb_build_object('voided_lines', v_counts.voided),
         encode(extensions.gen_random_bytes(32), 'hex'),
         auth.uid(), e.is_simulated
    from public.entrepreneurs e where e.id = p_entrepreneur_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.passport_credential_begin(p_snapshot_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_snap public.metric_snapshots%rowtype;
  v_cred public.passport_credentials%rowtype;
  v_index integer;
  v_bytes bytea;
begin
  select * into v_snap from public.metric_snapshots where id = p_snapshot_id;
  if not found then
    raise exception 'no_such_snapshot' using errcode = 'P0002';
  end if;

  select * into v_cred from public.passport_credentials where snapshot_id = p_snapshot_id;
  if not found then
    loop
      v_bytes := extensions.gen_random_bytes(3);
      v_index := ((get_byte(v_bytes, 0) << 16) | (get_byte(v_bytes, 1) << 8) | get_byte(v_bytes, 2)) % 131072;
      continue when exists (select 1 from public.passport_status_tombstones where status_index = v_index);
      begin
        insert into public.passport_credentials (snapshot_id, entrepreneur_id, status_index)
        values (p_snapshot_id, v_snap.entrepreneur_id, v_index)
        returning * into v_cred;
        exit;
      exception when unique_violation then
        -- The position is taken, or another call reserved this month first.
        select * into v_cred from public.passport_credentials where snapshot_id = p_snapshot_id;
        exit when found;
      end;
    end loop;
  end if;

  if v_cred.sd_jwt is not null then
    return jsonb_build_object('status', 'issued', 'id', v_cred.id, 'sd_jwt', v_cred.sd_jwt);
  end if;
  return jsonb_build_object(
    'status', 'to_sign',
    'id', v_cred.id,
    'status_index', v_cred.status_index,
    'subject_ref', v_snap.subject_ref,
    'period', v_snap.period,
    'version', v_snap.version,
    'methodology', v_snap.methodology_version,
    'evidence_level', v_snap.evidence_level,
    'data_origin', v_snap.data_origin,
    'days_in_period', (v_snap.indicators ->> 'days_in_period')::integer,
    'indicators', (select jsonb_object_agg(v.key, v_snap.indicators -> v.key)
                     from private.share_indicators() v where v_snap.indicators ? v.key),
    -- Visible in every credential: a coherence signal, not a figure. A month
    -- snapshotted before the check existed says so.
    'card_fees', coalesce(v_snap.indicators -> 'card_fee_check' ->> 'status', 'not_checked')
  );
end;
$$;

revoke execute on function private.card_fee_check(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.journal_check_settings_get() from public, anon;
revoke execute on function public.journal_check_settings_set(integer, integer) from public, anon;
grant execute on function public.journal_check_settings_get() to authenticated, service_role;
grant execute on function public.journal_check_settings_set(integer, integer) to authenticated, service_role;
