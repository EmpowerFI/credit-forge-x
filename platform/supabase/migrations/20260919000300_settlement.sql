-- Settlement: how capital reaches her business and comes back.
--
--   investor → vault          deposits (wallet USDC, or ZEC credited by the operator): real, devnet
--   vault → ramp partner      release, when the partner disburses: real, devnet, batched
--   ramp → reais → her Pix    off-ramp at the demo quote, Pix payout: simulated / mock
--   her Pix → ramp → vault    each instalment: mock Pix in, the real investors' shares back into the vault
--   vault → investors         pay-out of each real investor's share: real, devnet
--
-- On devnet the regulated ramp partner is played by EmpowerFI's operator: its
-- USDC account receives releases and sends repayments back. Every leg is
-- derived from a fact already recorded: a disbursement (loan_events) or an
-- instalment (payments). Simulated positions move no USDC; their legs show as
-- simulated, and Pix is always a mock.
--
-- The vault-settle function sends the real legs with the refunds' discipline:
-- a transfer is claimed, signed and recorded before it is sent, looked up
-- before it is ever signed again. Releases due at the same time leave in one
-- transfer, never loan by loan, so no transfer's amount is a loan's principal.
-- A payout transfer brings the instalment's real shares into the vault and
-- pays them out in the same transaction.

create type public.settlement_leg_kind as enum ('release', 'pix_payout', 'pix_in', 'payout');
create type public.settlement_leg_status as enum ('due', 'held', 'sending', 'done', 'failed', 'mock');
create type public.vault_transfer_kind as enum ('release', 'payout');
create type public.vault_transfer_status as enum ('pending', 'confirmed', 'failed');

-- The off-ramp's spread between USDC and reais: an assumption, as in packages/capital-route.
create function private.ramp_bps()
returns integer
language sql immutable set search_path = ''
as $$ select 50 $$;

-- One Solana transaction the operator signs for the vault.
create table public.vault_transfers (
  id bigint generated always as identity primary key,
  kind public.vault_transfer_kind not null,
  -- USDC the operator (as the ramp) sends into the vault in the same transaction.
  inflow_micro_usdc bigint not null default 0 check (inflow_micro_usdc >= 0),
  outflow_micro_usdc bigint not null check (outflow_micro_usdc > 0),
  signature text unique,
  valid_until bigint,
  status public.vault_transfer_status not null default 'pending',
  claimed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.settlement_legs (
  id uuid primary key default gen_random_uuid(),
  kind public.settlement_leg_kind not null,
  loan_id uuid not null references public.loans (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete cascade,
  investment_id uuid references public.investments (id) on delete cascade,
  amount_micro_usdc bigint check (amount_micro_usdc > 0),
  amount_cents bigint check (amount_cents > 0),
  -- A payout's wallet. A release goes to the ramp's account, the operator's on devnet.
  destination text,
  status public.settlement_leg_status not null,
  transfer_id bigint references public.vault_transfers (id) on delete set null,
  -- Pix's end-to-end id format, invented: these payments are mocks.
  pix_e2e text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  constraint pix_is_mock check ((kind in ('pix_payout', 'pix_in')) = (status = 'mock')),
  constraint usdc_legs_have_amounts check (kind in ('pix_payout', 'pix_in') or amount_micro_usdc is not null)
);

create unique index settlement_release_once on public.settlement_legs (loan_id) where kind = 'release';
create unique index settlement_pix_payout_once on public.settlement_legs (loan_id) where kind = 'pix_payout';
create unique index settlement_pix_in_once on public.settlement_legs (payment_id) where kind = 'pix_in';
create unique index settlement_payout_once on public.settlement_legs (payment_id, investment_id) where kind = 'payout';
create index settlement_legs_due_idx on public.settlement_legs (kind) where status = 'due';
create index settlement_legs_investment_idx on public.settlement_legs (investment_id);

alter table public.vault_transfers enable row level security;
alter table public.settlement_legs enable row level security;
revoke all on public.vault_transfers, public.settlement_legs from anon, authenticated;
grant select on public.vault_transfers, public.settlement_legs to authenticated;
create policy vault_transfers_read on public.vault_transfers for select to authenticated using ((select private.is_auditor_or_admin()));
create policy settlement_legs_read on public.settlement_legs for select to authenticated using ((select private.is_auditor_or_admin()));

-- 'E', an 8-digit institution code (99999999: no real one), the minute in UTC, 11 random characters.
create function private.mock_pix_e2e(p_at timestamptz)
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  v_bytes bytea := extensions.gen_random_bytes(11);
  v_tail text := '';
begin
  for i in 0..10 loop
    v_tail := v_tail || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 56, 1);
  end loop;
  return 'E99999999' || to_char(p_at at time zone 'UTC', 'YYYYMMDDHH24MI') || v_tail;
end;
$$;

-- The real USDC behind an opportunity: allocations by wallet or by ZEC, not simulated, not refunded.
create function private.real_deposits(p_opportunity_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(amount_micro_usdc), 0)::bigint from public.investments
  where opportunity_id = p_opportunity_id and status = 'allocated' and not is_simulated and mode in ('wallet', 'zcash');
$$;

-- Disbursed: the real deposits leave the vault for the ramp, and she is paid by (mock) Pix.
create function private.settle_on_disbursal() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_real bigint;
begin
  select * into v_loan from public.loans where id = new.loan_id;
  v_real := private.real_deposits(v_loan.opportunity_id);
  if v_real > 0 then
    insert into public.settlement_legs (kind, loan_id, amount_micro_usdc, status)
    values ('release', v_loan.id, v_real, 'due')
    on conflict (loan_id) where kind = 'release' do nothing;
  end if;
  insert into public.settlement_legs (kind, loan_id, amount_cents, status, pix_e2e, done_at)
  values ('pix_payout', v_loan.id, v_loan.principal_cents, 'mock', private.mock_pix_e2e(new.created_at), new.created_at)
  on conflict (loan_id) where kind = 'pix_payout' do nothing;
  return new;
end;
$$;
create trigger settle_on_disbursal after insert on public.loan_events
  for each row when (new.to_status = 'DISBURSED') execute function private.settle_on_disbursal();

-- An instalment: she pays by (mock) Pix, and each real investor's share is due back to them.
create function private.settle_on_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.settlement_legs (kind, loan_id, payment_id, amount_cents, status, pix_e2e, done_at)
  values ('pix_in', new.loan_id, new.id, new.amount_cents, 'mock', private.mock_pix_e2e(new.paid_at), new.paid_at)
  on conflict (payment_id) where kind = 'pix_in' do nothing;

  insert into public.settlement_legs (kind, loan_id, payment_id, investment_id, amount_micro_usdc, destination, status)
  select 'payout', new.loan_id, new.id, s.investment_id, s.share, s.wallet_address,
    (case when s.wallet_address is null then 'held' else 'due' end)::public.settlement_leg_status
  from (
    select i.id as investment_id, i.wallet_address,
      private.share_usdc(new.amount_cents, i.amount_micro_usdc::numeric / o.funding_target_micro_usdc, o.fx_brl_per_usdc_milli) as share
    from public.loans l
    join public.qualified_credit_opportunities o on o.id = l.opportunity_id
    join public.investments i on i.opportunity_id = o.id
    where l.id = new.loan_id and i.status = 'allocated' and not i.is_simulated and i.mode in ('wallet', 'zcash')
  ) s
  where s.share > 0
  on conflict (payment_id, investment_id) where kind = 'payout' do nothing;
  return new;
end;
$$;
create trigger settle_on_payment after insert on public.payments
  for each row execute function private.settle_on_payment();

-- -------------------------------------------------------------- the sender

-- Groups due legs into transfers (all releases in one; each instalment's
-- payouts in transfers of at most p_per_transfer, to fit a transaction), then
-- claims up to five pending transfers for two minutes. Serialised, so two runs
-- never group the same legs.
create function public.settle_claim(p_per_transfer integer default 4)
returns table (id bigint, kind public.vault_transfer_kind, inflow_micro_usdc bigint, outflow_micro_usdc bigint,
  signature text, valid_until bigint, legs jsonb)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
  v_payment uuid;
  v_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtext('settle_claim'));

  select array_agg(l.id) into v_ids from public.settlement_legs l where l.kind = 'release' and l.status = 'due';
  if v_ids is not null then
    insert into public.vault_transfers (kind, outflow_micro_usdc)
    select 'release', sum(l.amount_micro_usdc) from public.settlement_legs l where l.id = any(v_ids)
    returning vault_transfers.id into v_id;
    update public.settlement_legs l set status = 'sending', transfer_id = v_id where l.id = any(v_ids);
  end if;

  for v_payment in select distinct l.payment_id from public.settlement_legs l where l.kind = 'payout' and l.status = 'due' loop
    loop
      select array_agg(x.id) into v_ids from (
        select l.id from public.settlement_legs l
        where l.payment_id = v_payment and l.kind = 'payout' and l.status = 'due' order by l.id limit p_per_transfer
      ) x;
      exit when v_ids is null;
      insert into public.vault_transfers (kind, inflow_micro_usdc, outflow_micro_usdc)
      select 'payout', sum(l.amount_micro_usdc), sum(l.amount_micro_usdc) from public.settlement_legs l where l.id = any(v_ids)
      returning vault_transfers.id into v_id;
      update public.settlement_legs l set status = 'sending', transfer_id = v_id where l.id = any(v_ids);
    end loop;
  end loop;

  return query
  update public.vault_transfers t
  set claimed_at = now()
  where t.id in (
    select c.id from public.vault_transfers c
    where c.status = 'pending' and (c.claimed_at is null or c.claimed_at < now() - interval '2 minutes')
    order by c.id limit 5
  )
  returning t.id, t.kind, t.inflow_micro_usdc, t.outflow_micro_usdc, t.signature, t.valid_until,
    (select coalesce(jsonb_agg(jsonb_build_object('leg_id', l.id, 'amount_micro_usdc', l.amount_micro_usdc,
        'destination', l.destination) order by l.id), '[]')
     from public.settlement_legs l where l.transfer_id = t.id);
end;
$$;

create function public.settle_sending(p_id bigint, p_signature text, p_valid_until bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.vault_transfers set signature = p_signature, valid_until = p_valid_until
  where id = p_id and status = 'pending';
$$;

create function public.settle_done(p_id bigint, p_signature text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.vault_transfers set status = 'confirmed', confirmed_at = now(), claimed_at = null
  where id = p_id and status = 'pending' and signature = p_signature;
  if not found then
    raise exception 'transfer_not_pending' using errcode = 'P0001';
  end if;
  update public.settlement_legs set status = 'done', done_at = now() where transfer_id = p_id;
end;
$$;

-- A transaction that landed and failed is for a human to look at.
create function public.settle_failed(p_id bigint, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.vault_transfers set status = 'failed', error = left(p_error, 500), claimed_at = null
  where id = p_id and status = 'pending';
  update public.settlement_legs set status = 'failed' where transfer_id = p_id;
end;
$$;

create function private.dispatch_settlement()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.settlement_legs where status = 'due')
     and not exists (select 1 from public.vault_transfers
       where status = 'pending' and (claimed_at is null or claimed_at < now() - interval '2 minutes')) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_settlement: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/vault-settle'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('vault-settle', '15 seconds', 'select private.dispatch_settlement()');

-- ----------------------------------------------------------------- readers

-- The vault's own ledger: what should be in it, from every real movement.
create function private.vault_ledger()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'in_vault_micro_usdc', d.in_vault - r.released,
    'deposits_micro_usdc', d.in_vault,
    'released_micro_usdc', r.released,
    'repaid_in_micro_usdc', p.repaid_in,
    'paid_out_micro_usdc', p.paid_out
  )
  from (select coalesce(sum(amount_micro_usdc) filter (where status in ('allocated', 'refund_due')), 0)::bigint in_vault
        from public.investments where mode in ('wallet', 'zcash') and not is_simulated) d,
       (select coalesce(sum(outflow_micro_usdc), 0)::bigint released
        from public.vault_transfers where kind = 'release' and status = 'confirmed') r,
       (select coalesce(sum(inflow_micro_usdc), 0)::bigint repaid_in, coalesce(sum(outflow_micro_usdc), 0)::bigint paid_out
        from public.vault_transfers where kind = 'payout' and status = 'confirmed') p;
$$;

-- For the investor console's Settlement page: the route in aggregate, the
-- vault's recent transfers, and the viewer's own payouts.
create function public.settlement_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_investor_or_overseer() then
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'fx_brl_per_usdc_milli', private.demo_brl_per_usdc_milli(),
    'ramp_bps', private.ramp_bps(),
    'vault', private.vault_ledger(),
    'pix', (select jsonb_build_object(
        'payouts', count(*) filter (where kind = 'pix_payout'),
        'payout_cents', coalesce(sum(amount_cents) filter (where kind = 'pix_payout'), 0),
        'ins', count(*) filter (where kind = 'pix_in'),
        'in_cents', coalesce(sum(amount_cents) filter (where kind = 'pix_in'), 0))
      from public.settlement_legs),
    'legs', (select jsonb_object_agg(k, n) from (
        select kind::text || ':' || status::text k, count(*) n from public.settlement_legs
        where kind in ('release', 'payout') group by kind, status) s),
    'transfers', coalesce((
      select jsonb_agg(x order by x->>'id' desc) from (
        select jsonb_build_object('id', t.id, 'kind', t.kind, 'status', t.status, 'signature', t.signature,
          'inflow_micro_usdc', t.inflow_micro_usdc, 'outflow_micro_usdc', t.outflow_micro_usdc,
          'legs', (select count(*) from public.settlement_legs l where l.transfer_id = t.id),
          'at', private.iso(coalesce(t.confirmed_at, t.created_at))) x
        from public.vault_transfers t order by t.id desc limit 10
      ) y
    ), '[]'),
    'mine', (select jsonb_build_object(
        'paid_out_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status = 'done'), 0),
        'due_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status in ('due', 'sending')), 0),
        'held_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status = 'held'), 0),
        'payouts', count(*) filter (where l.status = 'done'))
      from public.settlement_legs l join public.investments i on i.id = l.investment_id
      where l.kind = 'payout' and i.investor_id = auth.uid())
  );
end;
$$;

-- A position's settlement: where its capital went, and what came back to it.
create or replace function public.investor_position(p_investment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv public.investments;
  v_opp public.qualified_credit_opportunities;
  v_loan public.loans;
  v_share numeric;
  v_active timestamptz;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or not (v_inv.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_inv.opportunity_id;
  select * into v_loan from public.loans where opportunity_id = v_opp.id;
  v_share := v_inv.amount_micro_usdc::numeric / v_opp.funding_target_micro_usdc;
  select min(created_at) into v_active from public.loan_events where loan_id = v_loan.id and to_status = 'ACTIVE';

  return jsonb_build_object(
    'investment', jsonb_build_object(
      'id', v_inv.id, 'amount_micro_usdc', v_inv.amount_micro_usdc, 'share_bps', round(v_share * 10000),
      'mode', v_inv.mode, 'status', v_inv.status, 'deposit_signature', v_inv.deposit_signature,
      'wallet_address', v_inv.wallet_address, 'invested_at', private.iso(v_inv.created_at), 'is_simulated', v_inv.is_simulated,
      'refund_signature', case when v_inv.status = 'refunded' then v_inv.refund_signature end, 'refunded_at', private.iso(v_inv.refunded_at)
    ),
    'zcash', (select jsonb_build_object(
        'ref', z.ref, 'txid', z.txid, 'pool', z.pool, 'amount_zat', z.amount_zat, 'received_zat', z.received_zat,
        'usd_per_zec_cents', z.usd_per_zec_cents, 'quote_source', z.quote_source, 'mined_height', z.mined_height,
        'confirmed_at', private.iso(z.confirmed_at), 'credit_signature', z.credit_signature)
      from public.zcash_payment_requests z where z.investment_id = v_inv.id),
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_inv.id),
    'opportunity', jsonb_build_object(
      'id', v_opp.id, 'code', private.opportunity_code(v_opp.id), 'purpose', v_opp.purpose,
      'business_sector', (select business_sector from public.entrepreneurs where id = v_opp.entrepreneur_id),
      'amount_cents', v_opp.amount_cents, 'term_months', v_opp.term_months, 'risk_band', v_opp.risk_band,
      'funding_status', v_opp.funding_status, 'funding_target_micro_usdc', v_opp.funding_target_micro_usdc,
      'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli
    ),
    'loan', case when v_loan.id is null then null else jsonb_build_object(
      'id', v_loan.id, 'status', v_loan.status, 'principal_cents', v_loan.principal_cents,
      'rate_bps', v_loan.rate_bps, 'term_months', v_loan.term_months, 'instalment_cents', v_loan.instalment_cents,
      'disbursed_at', private.iso(v_loan.disbursed_at), 'active_since', private.iso(v_active),
      'instalment_share_micro_usdc', private.share_usdc(v_loan.instalment_cents, v_share, v_opp.fx_brl_per_usdc_milli)
    ) end,
    'settlement', case when v_loan.id is null then null else jsonb_build_object(
      'ramp_bps', private.ramp_bps(),
      'release', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc,
          'signature', t.signature, 'transfer_micro_usdc', t.outflow_micro_usdc,
          'loans_in_transfer', (select count(*) from public.settlement_legs b where b.transfer_id = l.transfer_id),
          'at', private.iso(t.confirmed_at))
        from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
        where l.kind = 'release' and l.loan_id = v_loan.id),
      'pix', (select jsonb_build_object('e2e', l.pix_e2e, 'brl_cents', l.amount_cents,
          'at', private.iso((select min(e.created_at) from public.loan_events e where e.loan_id = v_loan.id and e.to_status = 'DISBURSED')))
        from public.settlement_legs l where l.kind = 'pix_payout' and l.loan_id = v_loan.id)
    ) end,
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instalment_no', n,
        'due_at', case when v_active is not null then private.iso(v_active + make_interval(months => n)) end,
        'paid_at', private.iso(p.paid_at),
        'payment_id', p.id,
        'share_micro_usdc', case when p.id is not null then private.share_usdc(p.amount_cents, v_share, v_opp.fx_brl_per_usdc_milli) end,
        'pix_e2e', (select l.pix_e2e from public.settlement_legs l where l.kind = 'pix_in' and l.payment_id = p.id),
        'payout', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc, 'signature', t.signature)
          from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
          where l.kind = 'payout' and l.payment_id = p.id and l.investment_id = v_inv.id)
      ) order by n)
      from generate_series(1, coalesce(v_loan.term_months, 0)) n
      left join public.payments p on p.loan_id = v_loan.id and p.instalment_no = n
    ), '[]'),
    'servicing', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'to_status', e.to_status, 'note', e.note, 'at', private.iso(e.created_at)) order by e.created_at)
      from public.loan_events e where e.loan_id = v_loan.id
    ), '[]'),
    'outcome', (
      select jsonb_build_object('id', po.id, 'avg_revenue_before_cents', po.avg_revenue_before_cents,
        'avg_revenue_after_cents', po.avg_revenue_after_cents, 'evc_cents', po.evc_cents, 'capital_use', po.capital_use,
        'confidence', po.confidence, 'measured_at', private.iso(po.measured_at))
      from public.productive_outcomes po where po.loan_id = v_loan.id order by po.outcome_no desc limit 1
    )
  );
end;
$$;

-- The audit console's system view: the vault's expected balance now nets out
-- releases; payouts net to zero, as each brings in what it pays out.
create or replace function public.audit_system()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_jobs jsonb;
  v_ledger jsonb := private.vault_ledger();
begin
  perform private.require_auditor();
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active)
      order by j.jobname), '[]')
    into v_jobs from cron.job j;
  exception when others then
    v_jobs := null;
  end;

  return jsonb_build_object(
    'anchors', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'submitted', count(*) filter (where status = 'submitted'),
        'failed', count(*) filter (where status = 'failed'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'oldest_queued_at', private.iso(min(created_at) filter (where status in ('pending', 'submitted'))),
        'last_confirmed_at', private.iso(max(confirmed_at)),
        'last_error', (select a.last_error from public.chain_anchors a
          where a.status = 'failed' order by a.id desc limit 1))
      from public.chain_anchors),
    'reconcile', (select jsonb_build_object(
        'verified', count(*) filter (where reconcile = 'verified'),
        'missing', count(*) filter (where reconcile = 'missing'),
        'mismatch', count(*) filter (where reconcile = 'mismatch'),
        'unchecked', count(*) filter (where reconcile = 'unchecked'),
        'last_at', private.iso(max(reconciled_at)),
        'oldest_at', private.iso(min(reconciled_at)))
      from public.chain_anchors where status = 'confirmed'),
    'refunds', (select jsonb_build_object(
        'due', count(*) filter (where status = 'refund_due' and refund_signature is null),
        'sending', count(*) filter (where status = 'refund_due' and refund_signature is not null),
        'refunded', count(*) filter (where status = 'refunded'),
        'last_at', private.iso(max(refunded_at)),
        'last_error', (select i.refund_error from public.investments i
          where i.refund_error is not null order by i.created_at desc limit 1))
      from public.investments where mode in ('wallet', 'zcash')),
    'vault', (select jsonb_build_object(
        'expected_micro_usdc', (v_ledger->>'in_vault_micro_usdc')::bigint,
        'deposited_micro_usdc', coalesce(sum(amount_micro_usdc), 0),
        'refunded_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where status = 'refunded'), 0),
        'deposits', count(*),
        'zcash_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where mode = 'zcash' and status in ('allocated', 'refund_due')), 0),
        'released_micro_usdc', (v_ledger->>'released_micro_usdc')::bigint,
        'repaid_in_micro_usdc', (v_ledger->>'repaid_in_micro_usdc')::bigint,
        'paid_out_micro_usdc', (v_ledger->>'paid_out_micro_usdc')::bigint)
      from public.investments where mode in ('wallet', 'zcash') and not is_simulated),
    'settlement', (select jsonb_build_object(
        'due', count(*) filter (where status = 'due'),
        'sending', count(*) filter (where status = 'sending'),
        'held', count(*) filter (where status = 'held'),
        'failed', count(*) filter (where status = 'failed'),
        'last_error', (select t.error from public.vault_transfers t where t.error is not null order by t.id desc limit 1))
      from public.settlement_legs where kind in ('release', 'payout')),
    'zcash', (select jsonb_build_object(
        'scanned_height', t.scanned_height, 'tip_height', t.tip_height, 'scanned_at', private.iso(t.scanned_at))
      from private.zcash_treasury t where t.id),
    'jobs', v_jobs
  );
end;
$$;

-- -------------------------------------------------------------- demo reset

create or replace function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;

  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  delete from public.settlement_legs where true;
  delete from public.vault_transfers where true;
  -- Receipts stay: they are the treasury's, read from Zcash. Only their link to a request goes.
  delete from public.zcash_payment_requests where true;
  delete from public.investments where true;
  delete from public.productive_outcomes where true;
  delete from public.payments where true;
  delete from public.loan_events where true;
  delete from public.loans where true;
  delete from public.partner_decisions where true;
  delete from public.qualified_credit_opportunities where true;
  delete from public.eligibility_assessments where true;
  delete from public.credit_intents where true;
  delete from public.readiness_assessments where true;
  delete from public.checkins where true;
  delete from public.consents where true;
  delete from public.education_progress where true;
  delete from public.education_programs where true;

  delete from public.communities where true;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32) where true;
  -- Deleting facts left their triggers' costs behind: clear them after too.
  delete from public.cost_events where true;

  return jsonb_build_object('anchors', v_anchors, 'communities', v_communities, 'entrepreneurs', v_entrepreneurs);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function private.ramp_bps(), private.mock_pix_e2e(timestamptz), private.real_deposits(uuid),
  private.settle_on_disbursal(), private.settle_on_payment(), private.dispatch_settlement(), private.vault_ledger() from public;
grant execute on function private.ramp_bps(), private.vault_ledger() to authenticated, service_role;

revoke all on function public.settle_claim(integer), public.settle_sending(bigint, text, bigint),
  public.settle_done(bigint, text), public.settle_failed(bigint, text) from public, anon, authenticated;
grant execute on function public.settle_claim(integer), public.settle_sending(bigint, text, bigint),
  public.settle_done(bigint, text), public.settle_failed(bigint, text) to service_role;

revoke all on function public.settlement_overview() from public, anon;
grant execute on function public.settlement_overview() to authenticated;
