-- Moving units on the local rail.
--
-- One writer. Every movement — an injection, a purchase, a payment between
-- merchants, a transfer, a repayment, a redemption — goes through
-- private.local_move(), which numbers it, records it and settles both balances
-- in the same statement. A ledger with six writers is a ledger with six places
-- for a balance to drift from the events that made it.
--
-- The balance column is a cache and the transactions are the truth. The check
-- constraint refuses an overdraft as the balance is written, so an account
-- cannot spend what it does not hold, and the treasury is exempt because it is
-- the issuer: what it is short by is exactly what is circulating.
--
-- Nothing here moves money. Units are a sandbox's unit of account, a redemption
-- sends no Pix, and every row is stamped 'simulated_assumption'.

-- Reais to units at an economy's parity, the inverse of local_units_brl_cents.
create function private.local_units_from_brl_cents(p_cents bigint, p_parity_bps integer)
returns bigint language sql immutable set search_path = ''
as $$ select floor(p_cents * 10000.0 / p_parity_bps)::bigint $$;

-- The account of an owner in an economy, created on first use. An entrepreneur
-- who has never received anything has no account, and asking for her balance
-- should not be the thing that invents one — so only a movement does.
create function private.local_account(p_economy_id uuid, p_owner_type public.local_owner_type, p_owner_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.local_accounts
   where economy_id = p_economy_id and owner_type = p_owner_type
     and owner_id is not distinct from p_owner_id;
  if v_id is null then
    insert into public.local_accounts (economy_id, owner_type, owner_id)
    values (p_economy_id, p_owner_type, p_owner_id)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- The one place a movement is written.
create function private.local_move(
  p_economy_id uuid,
  p_type public.local_transaction_type,
  p_from uuid,
  p_to uuid,
  p_units bigint,
  p_purpose public.credit_purpose default null,
  p_merchant_id uuid default null,
  p_opportunity_id uuid default null,
  p_loan_id uuid default null,
  p_note text default null,
  p_at timestamptz default now()
)
returns public.local_transactions
language plpgsql security definer set search_path = ''
as $$
declare
  v_no integer;
  v_row public.local_transactions;
begin
  if p_units is null or p_units <= 0 then
    raise exception 'local_amount_must_be_positive' using errcode = '22023';
  end if;
  if p_from = p_to then
    raise exception 'local_move_needs_two_sides' using errcode = '22023';
  end if;

  -- Serialise the economy's numbering: two movements racing would otherwise
  -- take the same transaction_no and one of them would be lost to the unique
  -- index rather than queued behind the other.
  perform 1 from public.local_economies where id = p_economy_id for update;
  select coalesce(max(transaction_no), 0) + 1 into v_no
    from public.local_transactions where economy_id = p_economy_id;

  insert into public.local_transactions (
    economy_id, transaction_no, tx_type, from_account_id, to_account_id, amount_units,
    purpose, merchant_id, opportunity_id, loan_id, note, occurred_at)
  values (
    p_economy_id, v_no, p_type, p_from, p_to, p_units,
    p_purpose, p_merchant_id, p_opportunity_id, p_loan_id, p_note, p_at)
  returning * into v_row;

  -- Debit before credit, so the overdraft check fires on the side that can fail.
  update public.local_accounts set balance_units = balance_units - p_units where id = p_from;
  update public.local_accounts set balance_units = balance_units + p_units where id = p_to;
  return v_row;
end;
$$;

-- --------------------------------------------------------------- the movements

-- Capital arrives. The reais a loan disbursed become units in her account, at
-- the economy's parity, issued by the treasury rather than appearing from
-- nowhere. Idempotent per loan: a second call on a loan already injected
-- returns the movement the first one made.
create function public.local_inject_capital(p_loan_id uuid, p_economy_id uuid default null)
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
  if not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;

  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan_not_found' using errcode = 'P0002'; end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_loan.opportunity_id;

  select * into v_tx from public.local_transactions
   where loan_id = p_loan_id and tx_type = 'capital_injection' limit 1;
  if found then
    return jsonb_build_object('transaction_id', v_tx.id, 'amount_units', v_tx.amount_units, 'recorded', false);
  end if;

  -- The economy of her community, unless the caller names one.
  if p_economy_id is not null then
    select * into v_economy from public.local_economies where id = p_economy_id;
  else
    select e.* into v_economy from public.local_economies e
     join public.community_memberships m on m.community_id = e.community_id
     where m.entrepreneur_id = v_opp.entrepreneur_id
     order by e.created_at limit 1;
  end if;
  if v_economy.id is null then
    raise exception 'no_local_economy_for_this_business' using errcode = 'P0002';
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

-- She buys from a merchant in the network. The merchant must be eligible: a
-- purchase the rail will not fund is a refusal, not an error, and it says which.
create function public.local_spend(
  p_merchant_id uuid,
  p_units bigint,
  p_purpose public.credit_purpose default null,
  p_entrepreneur_id uuid default null,
  p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_merchant public.local_merchants;
  v_who uuid := coalesce(p_entrepreneur_id, private.my_entrepreneur_id());
  v_tx public.local_transactions;
begin
  if v_who is null then
    raise exception 'no_business_to_spend_from' using errcode = '42501';
  end if;
  -- Hers to spend, or the desk spending on her behalf in a demonstration.
  if v_who <> coalesce(private.my_entrepreneur_id(), '00000000-0000-0000-0000-000000000000'::uuid)
     and not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;

  select * into v_merchant from public.local_merchants where id = p_merchant_id;
  if not found then raise exception 'merchant_not_found' using errcode = 'P0002'; end if;
  if not v_merchant.eligible then
    raise exception 'merchant_not_eligible_for_productive_capital' using errcode = '22023';
  end if;

  v_tx := private.local_move(
    v_merchant.economy_id, 'productive_purchase',
    private.local_account(v_merchant.economy_id, 'entrepreneur', v_who),
    private.local_account(v_merchant.economy_id, 'merchant', v_merchant.id),
    p_units, p_purpose, v_merchant.id, null, null, p_note);

  return jsonb_build_object('transaction_id', v_tx.id, 'transaction_no', v_tx.transaction_no);
end;
$$;

-- A merchant pays another merchant. This is the second hop the addendum asks
-- for (§12: spent across at least two local entities) and the reason a
-- multiplier can be more than one.
create function public.local_merchant_payment(
  p_from_merchant_id uuid, p_to_merchant_id uuid, p_units bigint, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_from public.local_merchants;
  v_to public.local_merchants;
  v_tx public.local_transactions;
begin
  if not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;
  select * into v_from from public.local_merchants where id = p_from_merchant_id;
  select * into v_to from public.local_merchants where id = p_to_merchant_id;
  if v_from.id is null or v_to.id is null then
    raise exception 'merchant_not_found' using errcode = 'P0002';
  end if;
  if v_from.economy_id <> v_to.economy_id then
    raise exception 'merchants_are_in_different_economies' using errcode = '22023';
  end if;

  v_tx := private.local_move(
    v_from.economy_id, 'merchant_payment',
    private.local_account(v_from.economy_id, 'merchant', v_from.id),
    private.local_account(v_to.economy_id, 'merchant', v_to.id),
    p_units, null, v_to.id, null, null, p_note);

  return jsonb_build_object('transaction_id', v_tx.id, 'transaction_no', v_tx.transaction_no);
end;
$$;

-- She repays, in the same units she received. The capital returns to the
-- treasury, which is where it was issued from: the loop closes inside the
-- ledger before anything is said about dollars.
create function public.local_repay(p_loan_id uuid, p_units bigint, p_entrepreneur_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_opp public.qualified_credit_opportunities;
  v_economy_id uuid;
  v_who uuid;
  v_tx public.local_transactions;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  if not found then raise exception 'loan_not_found' using errcode = 'P0002'; end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_loan.opportunity_id;
  v_who := coalesce(p_entrepreneur_id, v_opp.entrepreneur_id);

  if v_who <> coalesce(private.my_entrepreneur_id(), '00000000-0000-0000-0000-000000000000'::uuid)
     and not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;

  select economy_id into v_economy_id from public.local_transactions
   where loan_id = p_loan_id and tx_type = 'capital_injection' limit 1;
  if v_economy_id is null then
    raise exception 'this_loan_was_not_disbursed_on_a_local_rail' using errcode = 'P0002';
  end if;

  v_tx := private.local_move(
    v_economy_id, 'repayment',
    private.local_account(v_economy_id, 'entrepreneur', v_who),
    private.local_account(v_economy_id, 'treasury', null),
    p_units, null, null, v_opp.id, p_loan_id, 'instalment, in local units');

  return jsonb_build_object('transaction_id', v_tx.id, 'transaction_no', v_tx.transaction_no);
end;
$$;

-- A merchant takes units out of circulation and is paid in reais. Simulated:
-- no Pix is sent and no institution converts anything. The row exists so the
-- retention rate has a denominator that is not a guess.
create function public.local_redeem(p_merchant_id uuid, p_units bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_merchant public.local_merchants;
  v_economy public.local_economies;
  v_cents bigint;
  v_tx public.local_transactions;
  v_redemption public.local_redemptions;
begin
  if not (private.is_auditor_or_admin() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_move_local_capital' using errcode = '42501';
  end if;
  select * into v_merchant from public.local_merchants where id = p_merchant_id;
  if not found then raise exception 'merchant_not_found' using errcode = 'P0002'; end if;
  select * into v_economy from public.local_economies where id = v_merchant.economy_id;

  v_cents := private.local_units_brl_cents(p_units, v_economy.parity_bps);
  insert into public.local_redemptions (economy_id, merchant_id, amount_units, amount_brl_cents)
  values (v_economy.id, v_merchant.id, p_units, v_cents)
  returning * into v_redemption;

  v_tx := private.local_move(
    v_economy.id, 'redemption',
    private.local_account(v_economy.id, 'merchant', v_merchant.id),
    private.local_account(v_economy.id, 'treasury', null),
    p_units, null, v_merchant.id, null, null, 'redeemed to reais, simulated');

  update public.local_redemptions
     set status = 'settled', settled_at = now(), transaction_id = v_tx.id
   where id = v_redemption.id;

  return jsonb_build_object(
    'redemption_id', v_redemption.id, 'transaction_id', v_tx.id,
    'amount_units', p_units, 'amount_brl_cents', v_cents, 'status', 'settled');
end;
$$;

revoke all on function private.local_units_from_brl_cents(bigint, integer),
  private.local_account(uuid, public.local_owner_type, uuid),
  private.local_move(uuid, public.local_transaction_type, uuid, uuid, bigint,
                     public.credit_purpose, uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.local_units_from_brl_cents(bigint, integer),
  private.local_account(uuid, public.local_owner_type, uuid),
  private.local_move(uuid, public.local_transaction_type, uuid, uuid, bigint,
                     public.credit_purpose, uuid, uuid, uuid, text, timestamptz)
  to service_role;

revoke all on function public.local_inject_capital(uuid, uuid),
  public.local_spend(uuid, bigint, public.credit_purpose, uuid, text),
  public.local_merchant_payment(uuid, uuid, bigint, text),
  public.local_repay(uuid, bigint, uuid),
  public.local_redeem(uuid, bigint)
  from public, anon;
grant execute on function public.local_inject_capital(uuid, uuid),
  public.local_spend(uuid, bigint, public.credit_purpose, uuid, text),
  public.local_merchant_payment(uuid, uuid, bigint, text),
  public.local_repay(uuid, bigint, uuid),
  public.local_redeem(uuid, bigint)
  to authenticated, service_role;
