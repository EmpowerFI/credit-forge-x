-- An authorisation guard that never fires.
--
-- transition_loan() and record_payment() both gate on
--
--     if not found or not (v_loan.partner_id = private.my_partner_id() or private.is_admin())
--
-- and `private.my_partner_id()` is null for everyone who is not a partner. In
-- SQL `uuid = null` is null, not false; `null or false` is null; and `not null`
-- is null. An IF whose condition is null does not execute its branch — so for
-- exactly the callers the guard exists to stop, it raises nothing and the
-- function proceeds.
--
-- Demonstrated on a seeded database, signed in as the demo investor, who is
-- neither the loan's partner nor an admin:
--
--   select public.transition_loan('<another partner''s loan>', 'ACTIVE', '…');
--   -- loan moves DISBURSED -> ACTIVE, loan_event written, anchor queued
--
--   select public.record_payment('<the same loan>', 7, 50634);
--   -- payment row written, and local_repay_on_payment walks local units
--   -- out of her account into the treasury
--
-- Both write to the ledger this product asks people to trust, and the second
-- moves the local rail. Neither is reachable from our own UI, which is why it
-- survived: every screen that calls them is already behind a partner route.
-- RLS does not cover it either, because both are security definer.
--
-- The fix is to make each disjunct a real boolean. capital_allocation.sql
-- already guards its own the null-safe way — `(private.my_partner_id() is not
-- null and v_opp.partner_id = private.my_partner_id())` — so the shape was
-- known in one place and not carried to the others.
--
-- Both functions are rebuilt from the migrations that define them today
-- (20260920000000 for transition_loan, 20260914200100 for record_payment), not
-- from prosrc, and are otherwise unchanged.

create or replace function public.transition_loan(p_loan_id uuid, p_to public.loan_status, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_event uuid;
  v_previous bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  -- coalesce, because `uuid = null` is null and `not (null or false)` is null,
  -- and an IF that is null does not fire. See this migration's header.
  if not found or not (coalesce(v_loan.partner_id = private.my_partner_id(), false)
                       or coalesce(private.is_admin(), false)) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;
  if p_to = 'PARTNER_APPROVED' then
    raise exception 'approval_comes_from_the_partner_decision' using errcode = 'P0001';
  end if;
  if not private.loan_can_become(v_loan.status, p_to) then
    raise exception 'invalid_loan_transition' using errcode = 'P0001';
  end if;
  -- The partner disburses only capital that is there: while investors are
  -- still funding, it waits. An opportunity never listed, or taken off the
  -- market, is lent from the partner's own capital.
  if p_to = 'DISBURSED' and (select funding_status from public.qualified_credit_opportunities where id = v_loan.opportunity_id)
       in ('open', 'partially_funded') then
    raise exception 'not_fully_funded' using errcode = 'P0001';
  end if;
  if p_to = 'PAID' and (select count(*) from public.payments where loan_id = p_loan_id) < v_loan.term_months then
    raise exception 'instalments_outstanding' using errcode = 'P0001';
  end if;
  if p_to = 'CANCELLED' and nullif(trim(p_note), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  v_previous := private.latest_loan_anchor(p_loan_id);
  insert into public.loan_events (loan_id, from_status, to_status, actor, note)
  values (p_loan_id, v_loan.status, p_to, auth.uid(), nullif(trim(p_note), ''))
  returning id into v_event;
  update public.loans
  set status = p_to, updated_at = now(),
      disbursed_at = case when p_to = 'DISBURSED' then now() else disbursed_at end
  where id = p_loan_id;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('loan_transition', v_event, v_previous);

  -- Declined at formalisation: the opportunity closes and its investors are
  -- owed their capital back (open_for_funding, then refund_on_close).
  if p_to = 'CANCELLED' then
    update public.qualified_credit_opportunities set status = 'partner_declined'
    where id = v_loan.opportunity_id and status = 'partner_approved';
  end if;
end;
$$;

create or replace function public.record_payment(
  p_loan_id uuid,
  p_instalment_no integer,
  p_amount_cents bigint,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_id uuid;
  v_previous bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  -- coalesce, because `uuid = null` is null and `not (null or false)` is null,
  -- and an IF that is null does not fire. See this migration's header.
  if not found or not (coalesce(v_loan.partner_id = private.my_partner_id(), false)
                       or coalesce(private.is_admin(), false)) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;
  if v_loan.status not in ('DISBURSED', 'ACTIVE') then
    raise exception 'loan_not_repaying' using errcode = 'P0001';
  end if;
  if p_instalment_no < 1 or p_instalment_no > v_loan.term_months then
    raise exception 'invalid_instalment' using errcode = '22023';
  end if;

  v_previous := private.latest_loan_anchor(p_loan_id);
  begin
    insert into public.payments (loan_id, instalment_no, amount_cents, paid_at, recorded_by)
    values (p_loan_id, p_instalment_no, p_amount_cents, p_paid_at, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'instalment_already_paid' using errcode = '23505';
  end;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('payment', v_id, v_previous);
  return v_id;
end;
$$;
