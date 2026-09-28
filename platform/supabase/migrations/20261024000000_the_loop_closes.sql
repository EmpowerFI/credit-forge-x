-- The loop closes: local units become stablecoin again.
--
-- Until now the rail was a mirror. Capital reached her as reais by Pix and, in
-- parallel, a trigger wrote the same principal as units in a ledger nobody's
-- money ever passed through. She spent units, earned units, repaid units — and
-- the units stopped at the treasury. The investor's return travelled a second,
-- unconnected pipe: reais in, settlement, USDC out. Two stories about one
-- loan, and the rail was the one that carried no money.
--
-- That is why the local economy read as a fourth disconnected screen. It was
-- disconnected. This migration makes the units a claim on reais that are
-- actually held, and makes the repayment the thing that releases them.
--
--   Disbursal   the capital that reaches the territory is held as reais by the
--               community's own bank, and the treasury issues her units against
--               it. She holds a claim on those reais; she does not hold reais.
--
--   Repayment   her instalment in units returns to the treasury and releases
--               exactly the reais behind them, which is what the investor is
--               paid out of.
--
-- Two crossings of one border, in opposite directions, and the ledger in
-- between is where the capital spends its life.
--
-- The invariant this buys. Units in circulation may never exceed the reais
-- backing them: issue puts reais in, a repayment takes them out, and a merchant
-- cashing out takes them out too. If that ever fails, the rail has printed
-- money — which is the accusation any local currency has to answer, and the
-- answer here is arithmetic rather than assurance. pgTAP holds it, and the
-- screen carries it beside the figures.
--
-- What this is still not. No bank holds these reais and no institution converts
-- anything: every row is a simulated assumption, as the whole rail is. The
-- claim is about the model being coherent, not about money having moved.

create type public.local_conversion_direction as enum ('issue', 'redeem');

create table public.local_conversions (
  id uuid primary key default gen_random_uuid(),
  economy_id uuid not null references public.local_economies (id) on delete restrict,
  direction public.local_conversion_direction not null,
  units bigint not null check (units > 0),
  brl_cents bigint not null check (brl_cents >= 0),
  -- The parity it crossed at, kept on the row: a parity that changed later must
  -- not silently restate what an older crossing was worth.
  parity_bps integer not null check (parity_bps between 1 and 1000000),
  loan_id uuid references public.loans (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  -- The movement on the rail this crossing paired with.
  transaction_id uuid references public.local_transactions (id) on delete restrict,
  note text check (char_length(note) <= 200),
  evidence_status public.evidence_label not null default 'simulated_assumption',
  occurred_at timestamptz not null default now(),
  -- One issue per loan, one redemption per instalment: a crossing recorded
  -- twice would show as backing that was never there.
  constraint local_conversions_shape check (
    (direction = 'issue' and loan_id is not null and payment_id is null)
    or (direction = 'redeem' and payment_id is not null))
);

create unique index local_conversions_issue on public.local_conversions (loan_id)
  where direction = 'issue';
create unique index local_conversions_redeem on public.local_conversions (payment_id)
  where direction = 'redeem';
create index local_conversions_economy on public.local_conversions (economy_id, occurred_at);

comment on table public.local_conversions is
  'The two crossings between reais and local units: issue at disbursal, redemption at repayment. The reais between them are what the units are a claim on.';

alter table public.local_conversions enable row level security;
revoke all on public.local_conversions from anon, authenticated;
grant select on public.local_conversions to authenticated;

create policy local_conversions_read on public.local_conversions for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or exists (select 1 from public.local_economies e
             where e.id = economy_id and e.community_id is not null
               and ((select private.leads_community(e.community_id))
                    or (select private.is_member(e.community_id)))));

-- ---------------------------------------------------------------- the backing

-- What stands behind the units in circulation. Issue puts reais in; a
-- repayment releases them to the investor; a merchant cashing out takes them
-- for itself. Each of the three is a row somebody wrote, so this total is a
-- sum and never a stored figure.
create function private.local_backing(p_economy_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with e as (select parity_bps from public.local_economies where id = p_economy_id),
  crossings as (
    select
      coalesce(sum(brl_cents) filter (where direction = 'issue'), 0)::bigint as issued,
      coalesce(sum(brl_cents) filter (where direction = 'redeem'), 0)::bigint as released
    from public.local_conversions where economy_id = p_economy_id
  ),
  -- A merchant taking value out of the network is the third way reais leave.
  cashed as (
    select coalesce(sum(amount_brl_cents), 0)::bigint as cents
    from public.local_redemptions
    where economy_id = p_economy_id and status = 'settled'
  ),
  supply as (
    select coalesce(sum(balance_units), 0)::bigint as units
    from public.local_accounts
    where economy_id = p_economy_id and owner_type <> 'treasury' and balance_units > 0
  )
  select jsonb_build_object(
    'issued_cents', c.issued,
    'released_to_investors_cents', c.released,
    'cashed_out_by_merchants_cents', x.cents,
    'backing_cents', c.issued - c.released - x.cents,
    'circulating_units', s.units,
    'circulating_cents', private.local_units_brl_cents(s.units, e.parity_bps),
    -- The accusation any local currency has to answer, answered by subtraction.
    'covered', (c.issued - c.released - x.cents) >= private.local_units_brl_cents(s.units, e.parity_bps))
  from crossings c, cashed x, supply s, e
$$;

-- --------------------------------------------------------------- the crossings

-- Disbursal. The capital that reached the territory is held as reais, and the
-- treasury issues her units against it.
create or replace function private.local_inject_for_loan(p_loan_id uuid, p_economy_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_opp public.qualified_credit_opportunities;
  v_economy public.local_economies;
  v_units bigint;
  v_tx public.local_transactions;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan_not_found' using errcode = 'P0002'; end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_loan.opportunity_id;

  select * into v_tx from public.local_transactions
   where loan_id = p_loan_id and tx_type = 'capital_injection' limit 1;
  if found then
    return jsonb_build_object('transaction_id', v_tx.id, 'amount_units', v_tx.amount_units, 'recorded', false);
  end if;

  if p_economy_id is not null then
    select * into v_economy from public.local_economies where id = p_economy_id;
  else
    select e.* into v_economy from public.local_economies e
     join public.community_memberships m on m.community_id = e.community_id
     where m.entrepreneur_id = v_opp.entrepreneur_id
     order by e.created_at limit 1;
  end if;
  if v_economy.id is null then
    return jsonb_build_object('recorded', false, 'reason', 'no_local_economy');
  end if;

  v_units := private.local_units_from_brl_cents(v_loan.principal_cents, v_economy.parity_bps);
  v_tx := private.local_move(
    v_economy.id, 'capital_injection',
    private.local_account(v_economy.id, 'treasury', null),
    private.local_account(v_economy.id, 'entrepreneur', v_opp.entrepreneur_id),
    v_units, v_opp.purpose, null, v_opp.id, p_loan_id,
    'disbursed principal, as local units at parity');

  -- The reais the units are a claim on. She holds the claim; the reais stay
  -- with the community's bank until something redeems them.
  insert into public.local_conversions (
    economy_id, direction, units, brl_cents, parity_bps, loan_id, transaction_id, note, occurred_at)
  values (
    v_economy.id, 'issue', v_units, v_loan.principal_cents, v_economy.parity_bps,
    p_loan_id, v_tx.id, 'capital held as reais, issued to her as local units', v_tx.occurred_at)
  on conflict do nothing;

  return jsonb_build_object(
    'transaction_id', v_tx.id, 'economy_id', v_economy.id,
    'amount_units', v_units, 'amount_brl_cents', v_loan.principal_cents, 'recorded', true);
end;
$$;

-- Repayment. Her units return to the treasury and release exactly the reais
-- behind them — which is what the investor is paid out of.
create or replace function private.local_repay_on_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_economy public.local_economies;
  v_account uuid;
  v_units bigint;
  v_balance bigint;
  v_tx public.local_transactions;
begin
  select * into v_loan from public.loans where id = new.loan_id;
  select e.* into v_economy from public.local_economies e
   join public.local_transactions t on t.economy_id = e.id
   where t.loan_id = new.loan_id and t.tx_type = 'capital_injection' limit 1;
  if v_economy.id is null then return new; end if;

  v_units := private.local_units_from_brl_cents(new.amount_cents, v_economy.parity_bps);
  select id, balance_units into v_account, v_balance from public.local_accounts
   where economy_id = v_economy.id and owner_type = 'entrepreneur' and owner_id = v_loan.entrepreneur_id;

  -- She repays in units only where she holds them. What she has already spent is
  -- in her suppliers' accounts; taking it from her here would be printing units
  -- at the moment of repayment, and the multiplier would be measuring the
  -- printing rather than the circulation.
  if v_account is null or coalesce(v_balance, 0) < v_units then return new; end if;

  v_tx := private.local_move(
    v_economy.id, 'repayment', v_account,
    private.local_account(v_economy.id, 'treasury', null),
    v_units, null, null, v_loan.opportunity_id, v_loan.id, 'instalment, in local units', new.paid_at);

  -- The crossing back. These reais leave the community's bank and become the
  -- investor's return: the same settlement legs that already existed carry them
  -- from here, so the loop closes into machinery that was already running.
  insert into public.local_conversions (
    economy_id, direction, units, brl_cents, parity_bps, loan_id, payment_id, transaction_id, note, occurred_at)
  values (
    v_economy.id, 'redeem', v_units,
    private.local_units_brl_cents(v_units, v_economy.parity_bps), v_economy.parity_bps,
    v_loan.id, new.id, v_tx.id, 'instalment redeemed to reais, on its way back to the investor', new.paid_at)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.local_backing(uuid) from public, anon, authenticated;
grant execute on function private.local_backing(uuid) to service_role;
