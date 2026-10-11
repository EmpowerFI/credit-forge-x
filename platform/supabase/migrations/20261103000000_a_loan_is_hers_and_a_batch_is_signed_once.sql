-- Two authorisation holes found in review, both in functions that move value.
--
-- 1. local_repay trusted a caller-supplied entrepreneur id. The check compared
--    p_entrepreneur_id against the caller and never asked whether p_loan_id
--    belonged to her, so any signed-in entrepreneur could write a repayment
--    against another borrower's loan by passing her own id with someone else's
--    loan. The fix pins the mover to the loan's own entrepreneur; the partner
--    and admin paths are unchanged.
--
-- 2. zcash_batch_claim's resume path dropped the lease the per-request credit
--    used to take. pg_advisory_xact_lock is released at commit, so a second
--    zcash-watch run that arrived while the first was signing was handed the
--    same 'sending' batch and signed and broadcast the vault transfer again.
--    claimed_at already exists for this and the insert path already sets it --
--    only the resume path forgot to read it.

-- ------------------------------------------------------------ the loan is hers

create or replace function public.local_repay(p_loan_id uuid, p_units bigint, p_entrepreneur_id uuid default null)
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

  -- The argument may name her, never someone else: a repayment belongs to the
  -- borrower on the loan, and the caller does not get to choose whose loan it
  -- is settling.
  if v_who <> v_opp.entrepreneur_id then
    raise exception 'this_loan_belongs_to_another_entrepreneur' using errcode = '42501';
  end if;

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

-- ------------------------------------------------------- a batch is signed once

create or replace function public.zcash_batch_claim(
  p_unit_micro_usdc bigint default 1000000000,
  p_limit integer default 20
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.zcash_credit_batches;
  v_ids uuid[];
  v_sum bigint;
  v_carry bigint;
  v_credited bigint;
begin
  perform pg_advisory_xact_lock(hashtext('zcash_credit_batch'));

  select * into v_batch from public.zcash_credit_batches
  where status in ('open', 'sending')
  order by created_at
  limit 1
  for update;
  if found then
    -- A lease, because the advisory lock ends at commit and the signing
    -- happens after it. A run that holds this batch keeps it for two minutes;
    -- a second run gets nothing rather than a second signature over the same
    -- transfer. zcash_batch_sending refreshes the lease as it writes the
    -- signature, which covers the thirty seconds of confirmation polling.
    if v_batch.claimed_at is not null and v_batch.claimed_at > now() - interval '2 minutes' then
      return null;
    end if;
    update public.zcash_credit_batches
    set claimed_at = now(), updated_at = now()
    where id = v_batch.id;
    return jsonb_build_object(
      'id', v_batch.id, 'status', v_batch.status, 'resumed', true,
      'unit_micro_usdc', v_batch.unit_micro_usdc,
      'target_micro_usdc', v_batch.target_micro_usdc,
      'credited_micro_usdc', v_batch.credited_micro_usdc,
      'carried_in_micro_usdc', v_batch.carried_in_micro_usdc,
      'carried_out_micro_usdc', v_batch.carried_out_micro_usdc,
      'signature', v_batch.signature, 'valid_until', v_batch.valid_until,
      'requests', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = v_batch.id));
  end if;

  -- The same pre-fail as the per-request credit: a payment whose opportunity
  -- closed or filled while it confirmed never reaches a batch at all.
  update public.zcash_payment_requests r
  set status = 'failed', updated_at = now(),
      error = 'the opportunity closed or filled before the payment confirmed'
  from public.qualified_credit_opportunities o
  where r.opportunity_id = o.id and r.status = 'confirmed' and r.credit_batch_id is null
    and (o.funding_status not in ('open', 'partially_funded')
      or o.funded_micro_usdc + r.amount_micro_usdc > o.funding_target_micro_usdc);

  -- The rows are locked here and attached below, so the set that was summed is
  -- the set that is credited.
  select array_agg(q.id), coalesce(sum(q.amount_micro_usdc), 0)
  into v_ids, v_sum
  from (
    select r.id, r.amount_micro_usdc
    from public.zcash_payment_requests r
    where r.status = 'confirmed' and r.credit_batch_id is null
    order by r.confirmed_at
    limit p_limit
    for update skip locked
  ) q;
  if v_ids is null then
    return null;
  end if;

  v_carry := coalesce((
    select b.carried_out_micro_usdc from public.zcash_credit_batches b
    where b.status = 'credited' order by b.created_at desc limit 1), 0);
  -- Down, never up: integer division is the rounding, and what it drops is
  -- carried to the next batch rather than fronted by the operator.
  v_credited := ((v_carry + v_sum) / p_unit_micro_usdc) * p_unit_micro_usdc;

  insert into public.zcash_credit_batches (
    unit_micro_usdc, carried_in_micro_usdc, target_micro_usdc,
    credited_micro_usdc, carried_out_micro_usdc, claimed_at
  ) values (
    p_unit_micro_usdc, v_carry, v_carry + v_sum,
    v_credited, v_carry + v_sum - v_credited, now()
  ) returning * into v_batch;

  update public.zcash_payment_requests
  set credit_batch_id = v_batch.id, updated_at = now()
  where id = any(v_ids);

  return jsonb_build_object(
    'id', v_batch.id, 'status', v_batch.status, 'resumed', false,
    'unit_micro_usdc', v_batch.unit_micro_usdc,
    'target_micro_usdc', v_batch.target_micro_usdc,
    'credited_micro_usdc', v_batch.credited_micro_usdc,
    'carried_in_micro_usdc', v_batch.carried_in_micro_usdc,
    'carried_out_micro_usdc', v_batch.carried_out_micro_usdc,
    'signature', null, 'valid_until', null,
    'requests', coalesce(array_length(v_ids, 1), 0));
end;
$$;

-- The signature write also renews the lease, so the run that is broadcasting
-- keeps the batch through its confirmation polling.
create or replace function public.zcash_batch_sending(p_id uuid, p_signature text, p_valid_until bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_credit_batches
  set signature = p_signature, valid_until = p_valid_until, status = 'sending',
      claimed_at = now(), updated_at = now()
  where id = p_id and status in ('open', 'sending');
$$;
