-- A month is a record, and a corrected month is a new version of it.
--
-- Step 2 of the Business Passport plan. When a month of the daily journal
-- becomes final, it is written down once as a snapshot: the indicators the
-- month yields, how many lines they came from, where those lines came from,
-- how well the month was kept, and the version of the method that computed
-- them. A snapshot is never edited. If a month turns out to be wrong -- a line
-- that should not have counted, struck through by staff after the month
-- closed -- the month gets a new version that names the one it supersedes,
-- and the old one stays exactly as it was issued.
--
-- This is what the Business Passport will sign (step 4) and what will be
-- anchored on Solana in batches (step 5). So two things are settled here:
--
--   * The subject is a pseudonym. passport_subjects gives each woman a
--     random reference, "B-" and ten characters, that says nothing about her
--     and is not derived from anything about her. Her id never leaves the
--     database in a snapshot.
--   * Each snapshot carries a random salt, fixed when it is written. When a
--     commitment to it is published, the salt is what stops anyone from
--     confirming a guess -- "did she sell R$ 3.000 in October?" -- by hashing
--     candidates. The commitment column is the one thing that may be set
--     after the row is written, and only once.
--
-- Every final month with at least one kept day gets a snapshot, whether or
-- not it counts for credit: the passport describes the business as it was
-- kept, and says how well. Only a month that counts is assembled into
-- checkins, as before; a correction to such a month updates that row too, so
-- the readiness engine reads the current version.
--
-- The indicators are not a profit. "Saldo do negócio" is sales minus business
-- expenses as she declared them; withdrawals, equipment and debt sit beside
-- it. Every snapshot is SELF_DECLARED: nothing here has been checked against
-- a source outside her own word, and the level says so.

-- ------------------------------------------------------------------ the subject

create table public.passport_subjects (
  entrepreneur_id  uuid primary key references public.entrepreneurs (id) on delete cascade,
  subject_ref      text not null unique check (subject_ref ~ '^B-[a-z2-7]{10}$'),
  created_at       timestamptz not null default now()
);

alter table public.passport_subjects enable row level security;
revoke all on public.passport_subjects from anon, authenticated;

/** Her pseudonymous reference, created the first time it is needed. */
create function private.passport_subject(p_entrepreneur_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_ref text;
  v_alphabet constant text := 'abcdefghijklmnopqrstuvwxyz234567';
  v_bytes bytea;
begin
  select subject_ref into v_ref from public.passport_subjects where entrepreneur_id = p_entrepreneur_id;
  if found then
    return v_ref;
  end if;
  loop
    v_bytes := extensions.gen_random_bytes(10);
    v_ref := 'B-' || (select string_agg(substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1), '' order by i)
                        from generate_series(0, 9) i);
    begin
      insert into public.passport_subjects (entrepreneur_id, subject_ref) values (p_entrepreneur_id, v_ref);
      return v_ref;
    exception when unique_violation then
      -- Either she got one concurrently, or the random reference collided.
      select subject_ref into v_ref from public.passport_subjects where entrepreneur_id = p_entrepreneur_id;
      if found then
        return v_ref;
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- the snapshots

create table public.metric_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  entrepreneur_id      uuid not null references public.entrepreneurs (id) on delete cascade,
  subject_ref          text not null,
  period               text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  version              integer not null check (version > 0),
  supersedes_id        uuid references public.metric_snapshots (id),
  reason               text not null check (reason in ('month_closed', 'correction')),
  reason_note          text check (reason_note is null or char_length(reason_note) <= 500),
  methodology_version  text not null,
  evidence_level       text not null check (evidence_level in ('SELF_DECLARED', 'COMMUNITY_ATTESTED', 'EXTERNALLY_VERIFIED')),
  data_origin          text not null check (data_origin in ('whatsapp_journal')),
  record_count         integer not null check (record_count >= 0),
  indicators           jsonb not null,
  salt                 text not null check (salt ~ '^[0-9a-f]{64}$'),
  commitment           text check (commitment is null or commitment ~ '^[0-9a-f]{64}$'),
  generated_at         timestamptz not null default now(),
  generated_by         uuid,
  is_simulated         boolean not null default false,
  unique (entrepreneur_id, period, version),
  -- Version 1 supersedes nothing; every later version supersedes something.
  constraint a_correction_names_what_it_corrects check ((version = 1) = (supersedes_id is null)),
  constraint a_first_version_is_the_close check ((version = 1) = (reason = 'month_closed'))
);

create index metric_snapshots_current on public.metric_snapshots (entrepreneur_id, period, version desc);

alter table public.metric_snapshots enable row level security;
revoke all on public.metric_snapshots from anon, authenticated;

/**
 * A snapshot is never edited. The one exception is its commitment, written
 * once when it is computed. Deleting is refused too, except as part of
 * erasing the woman herself: by the time a cascade from entrepreneurs reaches
 * this table, her row is gone, and that is the only case let through.
 */
create function private.metric_snapshots_are_issued_once()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.entrepreneurs where id = old.entrepreneur_id) then
      raise exception 'a snapshot is never deleted; issue a new version' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.commitment is null and new.commitment is not null
     and (to_jsonb(new) - 'commitment') = (to_jsonb(old) - 'commitment') then
    return new;
  end if;
  raise exception 'a snapshot is never edited; issue a new version' using errcode = '42501';
end;
$$;

create trigger metric_snapshots_are_issued_once
before update or delete on public.metric_snapshots
for each row execute function private.metric_snapshots_are_issued_once();

-- ------------------------------------------------------------------ indicators

/**
 * The indicators of one month, from the journal as it stands now.
 *
 * Methodology snapshot-v1.0.0. Every money figure in cents, every ratio in
 * basis points, all from journal_dre and journal_month_status. The revenue
 * change compares with the previous month's current snapshot, if there is one.
 */
create function private.snapshot_indicators(p_entrepreneur_id uuid, p_period text)
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
                               then round((v_revenue - v_prev)::numeric * 10000 / v_prev)::integer end
  );
end;
$$;

/** Lines that still count in a month, and lines struck through: how much the indicators rest on. */
create function private.snapshot_counts(p_entrepreneur_id uuid, p_period text)
returns table (records integer, voided integer)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where voided_at is null)::integer,
         count(*) filter (where voided_at is not null)::integer
    from public.journal_entries
   where entrepreneur_id = p_entrepreneur_id and to_char(occurred_on, 'YYYY-MM') = p_period
$$;

/** Writes a snapshot. The caller has decided that one is due. */
create function private.snapshot_take(
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
         p_reason, p_note, 'snapshot-v1.0.0', 'SELF_DECLARED', 'whatsapp_journal',
         v_counts.records,
         private.snapshot_indicators(p_entrepreneur_id, p_period) || jsonb_build_object('voided_lines', v_counts.voided),
         encode(extensions.gen_random_bytes(32), 'hex'),
         auth.uid(), e.is_simulated
    from public.entrepreneurs e where e.id = p_entrepreneur_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ------------------------------------------------------------ closing a month

/**
 * As before, plus the snapshot: every final month with a kept day is written
 * down once; a month that counts for credit is also assembled into checkins.
 */
create or replace function public.journal_close_month(p_entrepreneur_id uuid, p_period text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_status jsonb := public.journal_month_status(p_entrepreneur_id, p_period);
  v_from date := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_to date := (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  v_dre jsonb;
  v_id uuid;
  v_snapshot uuid;
begin
  if not (v_status ->> 'final')::boolean then
    return jsonb_build_object('status', 'not_final') || v_status;
  end if;

  if (v_status ->> 'filled')::integer > 0
     and not exists (select 1 from public.metric_snapshots where entrepreneur_id = p_entrepreneur_id and period = p_period) then
    v_snapshot := (private.snapshot_take(p_entrepreneur_id, p_period, 'month_closed', null, null)).id;
  end if;

  if not (v_status ->> 'counts')::boolean then
    return jsonb_build_object('status', 'does_not_count', 'snapshot_id', v_snapshot) || v_status;
  end if;
  if exists (select 1 from public.checkins where entrepreneur_id = p_entrepreneur_id and period = p_period) then
    return jsonb_build_object('status', 'exists', 'snapshot_id', v_snapshot) || v_status;
  end if;

  v_dre := public.journal_dre(p_entrepreneur_id, v_from, v_to);

  insert into public.checkins (
    entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents,
    keeps_records, active_days, is_simulated, source
  )
  select p_entrepreneur_id, p_period,
         (v_dre ->> 'revenue_cents')::bigint,
         (v_dre ->> 'cogs_cents')::bigint,
         -- The engine has one operating-cost figure; staff is one of them.
         (v_dre ->> 'opex_cents')::bigint + (v_dre ->> 'staff_cents')::bigint,
         (v_dre ->> 'withdrawals_cents')::bigint,
         -- A month kept day by day is a month of records.
         true,
         (v_dre ->> 'selling_days')::smallint,
         e.is_simulated,
         'journal'
    from public.entrepreneurs e where e.id = p_entrepreneur_id
  returning id into v_id;

  return jsonb_build_object('status', 'assembled', 'checkin_id', v_id, 'snapshot_id', v_snapshot) || v_status;
end;
$$;

-- --------------------------------------------------------------- correcting

/**
 * Who may correct a closed month: EmpowerFI staff -- the credit platform's
 * admins, or an owner of the dashboard's admin layer -- and the service role.
 */
create function private.is_empowerfi_staff()
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  return private.can_manage_rewards();
end;
$$;

alter table public.journal_entries
  add column void_reason text check (void_reason is null or char_length(void_reason) <= 500);

/**
 * Staff strike through a line of any day, with a reason, when she asks for a
 * correction she can no longer make herself. The line stays, as every voided
 * line does. A closed month is then corrected with snapshot_correct.
 */
create function public.journal_admin_void(p_entry_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_line public.journal_entries%rowtype;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_correct' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'a correction says why' using errcode = '22023';
  end if;
  select * into v_line from public.journal_entries where id = p_entry_id for update;
  if not found then
    raise exception 'no_such_line' using errcode = 'P0002';
  end if;
  if v_line.voided_at is not null then
    return jsonb_build_object('status', 'already_voided');
  end if;
  update public.journal_entries
     set voided_at = now(),
         voided_by_message = 'staff:' || coalesce(auth.uid()::text, 'service'),
         void_reason = btrim(p_reason)
   where id = p_entry_id;
  return jsonb_build_object('status', 'voided', 'period', to_char(v_line.occurred_on, 'YYYY-MM'),
                            'entrepreneur_id', v_line.entrepreneur_id);
end;
$$;

/**
 * Issues the next version of a closed month from the journal as it stands
 * now, superseding the current one, and brings the credit engine's month in
 * line with it. Refused when nothing changed: a version that says the same
 * thing is noise in the history.
 */
create function public.snapshot_correct(p_entrepreneur_id uuid, p_period text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_current public.metric_snapshots%rowtype;
  v_new public.metric_snapshots;
  v_counts record;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_correct' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'a correction says why' using errcode = '22023';
  end if;

  select * into v_current from public.metric_snapshots
   where entrepreneur_id = p_entrepreneur_id and period = p_period
   order by version desc limit 1
   for update;
  if not found then
    raise exception 'no_snapshot_for_this_month' using errcode = 'P0002';
  end if;

  select * into v_counts from private.snapshot_counts(p_entrepreneur_id, p_period);
  if (private.snapshot_indicators(p_entrepreneur_id, p_period) || jsonb_build_object('voided_lines', v_counts.voided))
     = v_current.indicators then
    raise exception 'nothing_changed' using errcode = 'P0001';
  end if;

  v_new := private.snapshot_take(p_entrepreneur_id, p_period, 'correction', btrim(p_reason), v_current.id);

  -- The credit engine reads checkins; it reads the current version.
  update public.checkins set
    revenue_cents = (v_new.indicators ->> 'revenue_cents')::bigint,
    cogs_cents = (v_new.indicators ->> 'cogs_cents')::bigint,
    opex_cents = (v_new.indicators ->> 'opex_cents')::bigint + (v_new.indicators ->> 'staff_cents')::bigint,
    household_cents = (v_new.indicators ->> 'withdrawals_cents')::bigint,
    active_days = (v_new.indicators ->> 'selling_days')::smallint
  where entrepreneur_id = p_entrepreneur_id and period = p_period and source = 'journal';

  return jsonb_build_object('version', v_new.version, 'snapshot_id', v_new.id, 'supersedes_id', v_current.id);
end;
$$;

/** Every version of every month of hers, newest first: the history staff and, later, she can read. */
create function public.snapshot_history(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_snapshots' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'subject_ref', s.subject_ref, 'period', s.period, 'version', s.version,
      'current', s.version = (select max(x.version) from public.metric_snapshots x
                               where x.entrepreneur_id = s.entrepreneur_id and x.period = s.period),
      'supersedes_id', s.supersedes_id, 'reason', s.reason, 'reason_note', s.reason_note,
      'methodology_version', s.methodology_version, 'evidence_level', s.evidence_level,
      'data_origin', s.data_origin, 'record_count', s.record_count, 'indicators', s.indicators,
      'generated_at', s.generated_at) order by s.period desc, s.version desc)
    from public.metric_snapshots s where s.entrepreneur_id = p_entrepreneur_id), '[]'::jsonb);
end;
$$;

revoke execute on function private.passport_subject(uuid) from public, anon, authenticated;
revoke execute on function private.snapshot_indicators(uuid, text) from public, anon, authenticated;
revoke execute on function private.snapshot_counts(uuid, text) from public, anon, authenticated;
revoke execute on function private.snapshot_take(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function private.is_empowerfi_staff() from public, anon;
revoke execute on function public.journal_admin_void(uuid, text) from public, anon;
revoke execute on function public.snapshot_correct(uuid, text, text) from public, anon;
revoke execute on function public.snapshot_history(uuid) from public, anon;
-- Signed-in callers reach the staff RPCs; the gate inside decides.
grant execute on function public.journal_admin_void(uuid, text) to authenticated, service_role;
grant execute on function public.snapshot_correct(uuid, text, text) to authenticated, service_role;
grant execute on function public.snapshot_history(uuid) to authenticated, service_role;
