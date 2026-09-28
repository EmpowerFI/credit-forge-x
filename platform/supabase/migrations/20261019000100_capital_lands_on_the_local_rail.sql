-- Capital lands on the local rail, and comes back along it.
--
-- The ledger existed and nothing put anything into it. Two triggers close that,
-- beside the ones that already fire on the same events — settlement on
-- disbursal, cost to serve on disbursal, investor shares on a payment — so the
-- rail is wired where the rest of the product is wired rather than in a button
-- somebody has to remember to press.
--
-- Disbursal. The reais a loan disbursed become units in her account, at her
-- territory's parity, issued by the treasury. A territory with no local economy
-- is not an error and not a failure to disburse: her loan is paid in reais, as
-- it always was, and the ledger records nothing rather than inventing a rail.
--
-- Repayment. She repays in the units she holds — and only if she holds them.
-- Capital she has already spent with her suppliers is in their accounts, not
-- hers, and a ledger that let her repay units she does not have would be
-- printing them at the moment of repayment. So the rail takes the instalment
-- where her balance covers it and stands aside where it does not, and the
-- repayment is the ordinary one in reais. What circulates back to her before
-- an instalment falls due is the whole question the multiplier is asking, and
-- forcing it would be answering it in the schema.

-- The injection, without the role guard: a trigger is not a person, and the
-- public function keeps the guard and delegates here.
create function private.local_inject_for_loan(p_loan_id uuid, p_economy_id uuid default null)
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
  -- A territory without a rail. Nothing to record, and nothing has gone wrong.
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

  return jsonb_build_object(
    'transaction_id', v_tx.id, 'economy_id', v_economy.id,
    'amount_units', v_units, 'amount_brl_cents', v_loan.principal_cents, 'recorded', true);
end;
$$;

create or replace function public.local_inject_capital(p_loan_id uuid, p_economy_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;
  return private.local_inject_for_loan(p_loan_id, p_economy_id);
end;
$$;

-- ---------------------------------------------------------------- the triggers

create function private.local_inject_on_disbursal() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.local_inject_for_loan(new.loan_id);
  return new;
end;
$$;

create trigger local_inject_on_disbursal after insert on public.loan_events
  for each row when (new.to_status = 'DISBURSED') execute function private.local_inject_on_disbursal();

create function private.local_repay_on_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_economy public.local_economies;
  v_account uuid;
  v_units bigint;
  v_balance bigint;
begin
  select * into v_loan from public.loans where id = new.loan_id;
  select e.* into v_economy from public.local_economies e
   join public.local_transactions t on t.economy_id = e.id
   where t.loan_id = new.loan_id and t.tx_type = 'capital_injection' limit 1;
  -- This loan never landed on a rail, so its repayment does not travel on one.
  if v_economy.id is null then return new; end if;

  v_units := private.local_units_from_brl_cents(new.amount_cents, v_economy.parity_bps);
  select id, balance_units into v_account, v_balance from public.local_accounts
   where economy_id = v_economy.id and owner_type = 'entrepreneur' and owner_id = v_loan.entrepreneur_id;

  -- She repays in units only where she holds them. What she has already spent is
  -- in her suppliers' accounts; taking it from her here would be printing units
  -- at the moment of repayment, and the multiplier would be measuring the
  -- printing rather than the circulation.
  if v_account is null or coalesce(v_balance, 0) < v_units then return new; end if;

  perform private.local_move(
    v_economy.id, 'repayment', v_account,
    private.local_account(v_economy.id, 'treasury', null),
    v_units, null, null, v_loan.opportunity_id, v_loan.id, 'instalment, in local units', new.paid_at);
  return new;
end;
$$;

create trigger local_repay_on_payment after insert on public.payments
  for each row execute function private.local_repay_on_payment();

revoke all on function private.local_inject_for_loan(uuid, uuid),
  private.local_inject_on_disbursal(), private.local_repay_on_payment()
  from public, anon, authenticated;
grant execute on function private.local_inject_for_loan(uuid, uuid) to service_role;

-- ------------------------------------------------------------------ her sales

-- A merchant pays her for goods or services. This is the movement that makes a
-- repayment on the rail possible at all: capital she spent with her suppliers
-- is in their accounts, and what comes back to her before the instalment falls
-- due is the circulation the multiplier is trying to measure. Without it the
-- ledger would only ever run one way, and "she repays in local units" would be
-- a sentence no row could support.
create function public.local_sale(
  p_merchant_id uuid, p_entrepreneur_id uuid, p_units bigint, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_merchant public.local_merchants;
  v_tx public.local_transactions;
begin
  if not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;
  select * into v_merchant from public.local_merchants where id = p_merchant_id;
  if not found then raise exception 'merchant_not_found' using errcode = 'P0002'; end if;

  v_tx := private.local_move(
    v_merchant.economy_id, 'transfer',
    private.local_account(v_merchant.economy_id, 'merchant', v_merchant.id),
    private.local_account(v_merchant.economy_id, 'entrepreneur', p_entrepreneur_id),
    p_units, null, v_merchant.id, null, null, p_note);

  return jsonb_build_object('transaction_id', v_tx.id, 'transaction_no', v_tx.transaction_no);
end;
$$;

revoke all on function public.local_sale(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.local_sale(uuid, uuid, bigint, text) to authenticated, service_role;
