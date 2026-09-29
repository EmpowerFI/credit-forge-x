-- The borrower pays her own instalment.
--
-- record_payment() requires the desk: `v_loan.partner_id = private.my_partner_id()`.
-- So on every screen in this product the instalment is something that happens
-- *to* her, recorded by somebody else — and the loop the whole thesis rests on
-- closes in a back office she never sees. That is the wrong source of truth for
-- the one movement she is the author of.
--
-- Nothing else has to move. local_repay_on_payment already fires on the inserted
-- row and walks the local units back to the treasury, which releases exactly the
-- reais behind them; the settlement queue already carries those reais out to the
-- investor. What was missing was only her permission to start it.
--
-- She never names an instalment number and never types an amount. The loan says
-- what a month costs and which month is next; a screen that asked her to restate
-- either would be asking her to be the ledger.

create function public.pay_instalment(p_loan_id uuid, p_instalment_no integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_opp public.qualified_credit_opportunities;
  v_no integer;
  v_id uuid;
  v_previous bigint;
  v_local public.local_transactions;
  v_economy text;
  v_micro_usdc bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'loan_not_found' using errcode = 'P0002';
  end if;

  -- Hers, or the desk's on her behalf. The desk keeps the ability because a
  -- payment can arrive by Pix into an account this product does not watch, and
  -- somebody has to be able to record that.
  --
  -- Every disjunct is coalesced. `uuid = null` is null, `null or null or false`
  -- is null, and an IF that is null does not fire — so written the obvious way
  -- this guard would let through exactly the callers it exists to stop: anyone
  -- signed in who is neither this borrower, nor her desk, nor an admin. The
  -- same shape is fixed in transition_loan and record_payment by the migration
  -- beside this one.
  if not (coalesce(v_loan.entrepreneur_id = private.my_entrepreneur_id(), false)
          or coalesce(v_loan.partner_id = private.my_partner_id(), false)
          or coalesce(private.is_admin(), false)) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;

  if v_loan.status not in ('DISBURSED', 'ACTIVE') then
    raise exception 'loan_not_repaying' using errcode = 'P0001';
  end if;

  -- The next one she owes, unless a caller names one.
  v_no := coalesce(p_instalment_no,
    (select coalesce(max(instalment_no), 0) + 1 from public.payments where loan_id = p_loan_id));
  if v_no < 1 or v_no > v_loan.term_months then
    raise exception 'loan_is_fully_repaid' using errcode = 'P0001';
  end if;

  select * into v_opp from public.qualified_credit_opportunities where id = v_loan.opportunity_id;

  v_previous := private.latest_loan_anchor(p_loan_id);
  begin
    insert into public.payments (loan_id, instalment_no, amount_cents, paid_at, recorded_by)
    values (p_loan_id, v_no, v_loan.instalment_cents, now(), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'instalment_already_paid' using errcode = '23505';
  end;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('payment', v_id, v_previous);

  -- What the trigger did with it, if this loan landed on a rail. Read rather
  -- than assumed: she repays in units only where she still holds them, and a
  -- screen that drew the local hop regardless would be drawing a hop the ledger
  -- refused to make.
  select t.* into v_local from public.local_transactions t
   where t.loan_id = p_loan_id and t.tx_type = 'repayment'
   order by t.transaction_no desc limit 1;
  if v_local.id is not null then
    select e.name into v_economy from public.local_economies e where e.id = v_local.economy_id;
  end if;

  -- The same reais, at the rate this request struck rather than the book's
  -- average, so the figure she sees leaving matches the one her investor sees
  -- arriving.
  if coalesce(v_opp.fx_brl_per_usdc_milli, 0) > 0 then
    v_micro_usdc := (v_loan.instalment_cents::numeric * 10000000 / v_opp.fx_brl_per_usdc_milli)::bigint;
  end if;

  return jsonb_build_object(
    'payment_id', v_id,
    'instalment_no', v_no,
    'of_term', v_loan.term_months,
    'amount_cents', v_loan.instalment_cents,
    'paid_count', (select count(*)::integer from public.payments where loan_id = p_loan_id),
    'local_units', case when v_local.id is not null and v_local.occurred_at >= now() - interval '1 minute'
                        then v_local.amount_units end,
    'local_economy', case when v_local.id is not null and v_local.occurred_at >= now() - interval '1 minute'
                          then v_economy end,
    'micro_usdc', v_micro_usdc,
    'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli);
end;
$$;

revoke all on function public.pay_instalment(uuid, integer) from public, anon;
grant execute on function public.pay_instalment(uuid, integer) to authenticated;
