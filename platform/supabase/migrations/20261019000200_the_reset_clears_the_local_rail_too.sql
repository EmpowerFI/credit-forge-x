-- The demo reset clears the local rail too.
--
-- local_transactions references loans with on delete restrict, which is right:
-- a ledger row should not vanish because a loan was deleted, and a foreign key
-- is a cheaper place to say so than a convention. The consequence is that the
-- demo's own wipe has to name the rail, and naming it is better than loosening
-- the constraint to make one script's life easier.
--
-- Order matters. Redemptions point at the transaction that burned their units,
-- transactions point at accounts, and accounts point at the economy: it comes
-- apart in the reverse order it was built.

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

  -- Reports describe data that is about to go: their links close with it.
  delete from public.audit_reports where true;
  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  delete from public.zcash_returns where true;
  delete from public.settlement_legs where true;
  delete from public.vault_transfers where true;
  -- Receipts stay: they are the treasury's, read from Zcash. Only their link to a request goes.
  delete from public.zcash_payment_requests where true;
  delete from public.investments where true;
  delete from public.productive_outcomes where true;
  -- The local rail, innermost first: a redemption names the movement that
  -- burned its units, a movement names two accounts, an account names its
  -- economy, and every movement may name the loan whose capital it carried.
  delete from public.local_redemptions where true;
  delete from public.local_transactions where true;
  delete from public.local_accounts where true;
  delete from public.local_merchants where true;
  delete from public.local_economies where true;
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
