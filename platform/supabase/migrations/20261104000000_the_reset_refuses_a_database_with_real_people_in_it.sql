-- reset_demo_data deletes unconditionally from thirty tables -- `where true`,
-- not filtered by is_simulated -- and its only guard is a confirmation phrase
-- written out in a migration anyone can read in the public repository. That is
-- correct for a showroom whose whole point is being resettable, and it is a
-- loaded gun in a database that holds a real woman's revenue.
--
-- The credit platform is moving into the mobile app's database, which has real
-- people in it. So the guard stops being a phrase somebody types and becomes a
-- fact about the database: if anything here is not simulated, the function
-- refuses, whatever phrase it was given.
--
-- Self-configuring on purpose. An environment variable or a database setting
-- is a thing to remember when a new environment is created, and the one time
-- it is forgotten is the time it matters. A row that is not simulated is
-- evidence the database itself carries.
--
-- The hackathon project is unaffected: all hundred of its entrepreneurs are
-- simulated, so the check passes and seed-demo.mts keeps working.

create or replace function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
  v_real_table text;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  -- The three that would hurt most, and would be first to appear. Checked
  -- before anything is deleted, so a database with one real record loses
  -- nothing rather than losing everything but that record.
  select x.t into v_real_table from (
    select 'entrepreneurs' as t where exists (select 1 from public.entrepreneurs where not is_simulated)
    union all
    select 'checkins' where exists (select 1 from public.checkins where not is_simulated)
    union all
    select 'loans' where exists (select 1 from public.loans where not is_simulated)
  ) x limit 1;

  if v_real_table is not null then
    raise exception
      'this database holds real records (public.%), and the demo reset will not run against it', v_real_table
      using errcode = '42501';
  end if;

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;
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
  -- The local rail, innermost first: a crossing between reais and units names
  -- the loan, the instalment and the movement it paired with; a redemption
  -- names the movement that burned its units; a movement names two accounts;
  -- an account names its economy.
  delete from public.local_conversions where true;
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
