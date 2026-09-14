-- Eligibility → opportunity → partner decision → loan → payment, and cost to serve.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(49);

-- ------------------------------------------------------------------ fixtures
-- Maria, Bea and Cris are ready and asked; Ana is ready and did not ask.
-- Two partners: Horizonte (matches everything here) and Distante (only large tickets).

-- The remote holds a demo partner too; inside this rolled-back transaction,
-- only the test's partners take referrals.
update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000002f1', 'pgTAP Horizonte', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}'),
  ('00000000-0000-0000-0000-0000000002f2', 'pgTAP Distante', 'bank', 2000000, 5000000, '{}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'c-admin@test'),
  ('00000000-0000-0000-0000-0000000002a2', 'c-lia@test'),
  ('00000000-0000-0000-0000-0000000002a3', 'c-maria@test'),
  ('00000000-0000-0000-0000-0000000002a4', 'c-ana@test'),
  ('00000000-0000-0000-0000-0000000002a5', 'c-bea@test'),
  ('00000000-0000-0000-0000-0000000002a6', 'c-cris@test'),
  ('00000000-0000-0000-0000-0000000002a7', 'c-paulo@test'),
  ('00000000-0000-0000-0000-0000000002a8', 'c-dora@test'),
  ('00000000-0000-0000-0000-0000000002a9', 'c-otto@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000002a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000002a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000002f1' where id = '00000000-0000-0000-0000-0000000002a7';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000002f2' where id = '00000000-0000-0000-0000-0000000002a8';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000002c1', 'pgTAP Credit', 'education_programme', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000002a2', 'verified', now(), '00000000-0000-0000-0000-0000000002a1');

insert into entrepreneurs (id, profile_id, display_name, business_sector) values
  ('00000000-0000-0000-0000-0000000002e1', '00000000-0000-0000-0000-0000000002a3', 'pgTAP Maria', 'food'),
  ('00000000-0000-0000-0000-0000000002e2', '00000000-0000-0000-0000-0000000002a4', 'pgTAP Ana', 'crafts'),
  ('00000000-0000-0000-0000-0000000002e3', '00000000-0000-0000-0000-0000000002a5', 'pgTAP Bea', 'beauty'),
  ('00000000-0000-0000-0000-0000000002e4', '00000000-0000-0000-0000-0000000002a6', 'pgTAP Cris', 'retail');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000002c1', id from entrepreneurs where display_name like 'pgTAP %';
insert into chain_anchors (kind, entity_id)
select 'enrollment', id from entrepreneurs where display_name like 'pgTAP %';

create temp table fx as select
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":97,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":22},
    "missing_requirements":[],"reason_codes":["EDUCATION_COMPLETE"]}'::jsonb as ready,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0,
    "avg_revenue_cents":305000,"avg_net_business_cents":135000,"avg_household_cents":80000,
    "revenue_cv_bps":1000,"revenue_trend_bps":0,"household_share_bps":5926}'::jsonb as features;
grant select on fx to authenticated, service_role;

set local role service_role;
select record_readiness_assessment(id, (select features from fx), (select ready from fx))
from entrepreneurs where display_name like 'pgTAP %';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- Maria, Bea and Cris ask; Ana does not.
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a5');
select declare_credit_intent('equipment', 150000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a6');
select declare_credit_intent('working_capital', 120000);
set local role postgres;

-- What the engine would return for each.
create temp table results as select
  '{"model_version":"eligibility-v0.1.0","decision":"ELIGIBLE","requested_amount_cents":200000,
    "proposed_amount_cents":200000,"term_months":12,"instalment_cents":21667,"max_instalment_cents":27500,
    "affordability_bps":1605,"suggested_min_cents":140000,"suggested_max_cents":250000,
    "risk_band":"LOW","risk_points":0,"confidence":"HIGH","reason_codes":["AFFORDABLE"]}'::jsonb as eligible,
  '{"model_version":"eligibility-v0.1.0","decision":"MANUAL_REVIEW","requested_amount_cents":120000,
    "proposed_amount_cents":120000,"term_months":6,"instalment_cents":23000,"max_instalment_cents":27500,
    "affordability_bps":1704,"suggested_min_cents":140000,"suggested_max_cents":250000,
    "risk_band":"LOW","risk_points":1,"confidence":"LOW","reason_codes":["LOW_CONFIDENCE","SHORT_HISTORY"]}'::jsonb as review;
grant select on results to authenticated, service_role;

-- ------------------------------------------------------------- eligibility

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a3');
select ok(
  (eligibility_inputs('00000000-0000-0000-0000-0000000002e1') -> 'input' ->> 'requested_amount_cents')::int = 200000,
  'eligibility gathers her request and her readiness'
);
select throws_ok(
  $$ select record_eligibility_assessment('00000000-0000-0000-0000-0000000002e1',
       (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
       (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
       '{}'::jsonb, (select eligible from results)) $$,
  '42501', null, 'nobody records their own eligibility'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a4');
select throws_ok(
  $$ select eligibility_inputs('00000000-0000-0000-0000-0000000002e2') $$,
  'P0001', 'not_in_credit_pipeline', 'THESIS: ready without a request, eligibility does not run'
);
set local role postgres;

set local role service_role;
create temp table recorded as select record_eligibility_assessment(
  '00000000-0000-0000-0000-0000000002e1',
  (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
  (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
  '{"requested_amount_cents":200000}'::jsonb, (select eligible from results)) as r;
select is(
  (record_eligibility_assessment(
    '00000000-0000-0000-0000-0000000002e1',
    (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
    (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
    '{}'::jsonb, (select eligible from results)) ->> 'reused')::boolean,
  true, 'the same request on the same readiness is assessed once'
);
-- Bea: eligible too. Cris: the rules were not confident.
select record_eligibility_assessment('00000000-0000-0000-0000-0000000002e3',
  (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000002e3'),
  (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000002e3'),
  '{}'::jsonb, jsonb_set((select eligible from results), '{proposed_amount_cents}', '150000'));
select record_eligibility_assessment('00000000-0000-0000-0000-0000000002e4',
  (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4'),
  (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4'),
  '{}'::jsonb, (select review from results));
set local role postgres;

create temp table opp as
select o.id, o.entrepreneur_id, o.status, o.partner_id from qualified_credit_opportunities o;
grant select on opp to authenticated;

select results_eq(
  $$ select status::text, partner_id from qualified_credit_opportunities where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1' $$,
  $$ values ('referred', '00000000-0000-0000-0000-0000000002f1'::uuid) $$,
  'an eligible request becomes an opportunity, referred to the partner whose range and purposes fit'
);
select is(
  (select status::text from qualified_credit_opportunities where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4'),
  'in_review', 'one the rules were not sure about waits for EmpowerFI'
);
select results_eq(
  $$ select (select depends_on from chain_anchors where kind = 'eligibility' and entity_id = e.id)
              = (select id from chain_anchors where kind = 'readiness' and entity_id = e.readiness_assessment_id),
            (select depends_on from chain_anchors where kind = 'opportunity' and entity_id = o.id)
              = (select id from chain_anchors where kind = 'eligibility' and entity_id = e.id)
     from eligibility_assessments e join qualified_credit_opportunities o on o.eligibility_id = e.id
     where e.entrepreneur_id = '00000000-0000-0000-0000-0000000002e1' $$,
  $$ values (true, true) $$,
  'on chain, eligibility waits for readiness and the opportunity for eligibility'
);

-- ------------------------------------------------------------------ partner

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a8');
select is((select count(*)::int from partner_pipeline()), 0, 'a partner sees nothing referred to someone else');
select throws_ok(
  $$ select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'), 'approved', 200000, 300, 12) $$,
  '42501', 'not_your_opportunity', 'and cannot decide on it'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a7');
select is((select count(*)::int from partner_pipeline()), 2, 'the partner sees what was referred to it');
select ok(
  (select bool_and(participant ~ '^P-[0-9A-F]{6}$') from partner_pipeline()),
  'as pseudonyms: no names'
);
select is(
  (select business_sector || ' · ' || community_name from partner_pipeline()
   where opportunity_id = (select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1')),
  'food · pgTAP Credit', 'with the sector and the verified community'
);
select is((select count(*)::int from entrepreneurs), 0, 'and no way into the entrepreneurs themselves');
select throws_ok(
  $$ select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'), 'approved', 900000, 300, 12) $$,
  '22023', 'approval_above_opportunity', 'it cannot approve more than the opportunity'
);
select lives_ok(
  $$ select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1'),
       'approved', 200000, 300, 12, 'Good history') $$,
  'the partner approves Maria'
);
select lives_ok(
  $$ select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e3'),
       'declined', p_reason => 'Outside our sector focus') $$,
  'and declines Bea'
);
set local role postgres;

select results_eq(
  $$ select l.status::text, l.principal_cents, l.instalment_cents from loans l
     where l.entrepreneur_id = '00000000-0000-0000-0000-0000000002e1' $$,
  $$ values ('PARTNER_APPROVED', 200000::bigint, 22667::bigint) $$,
  'approval opens her loan at the partner''s terms (R$ 2,000 at 3%/month over 12: R$ 226.67)'
);
select results_eq(
  $$ select e.decision::text, d.verdict::text, o.status::text
     from eligibility_assessments e
     join qualified_credit_opportunities o on o.eligibility_id = e.id
     join partner_decisions d on d.opportunity_id = o.id
     where e.entrepreneur_id = '00000000-0000-0000-0000-0000000002e3' $$,
  $$ values ('ELIGIBLE', 'declined', 'partner_declined') $$,
  'eligible to EmpowerFI, declined by the partner: two facts, two records'
);
select results_eq(
  $$ select (select count(*) from chain_anchors a where a.kind = 'loan' and a.entity_id = l.id)::int,
            (select depends_on from chain_anchors where kind = 'loan_transition'
               and entity_id = (select id from loan_events where loan_id = l.id)) =
            (select id from chain_anchors where kind = 'loan' and entity_id = l.id)
     from loans l where l.entrepreneur_id = '00000000-0000-0000-0000-0000000002e1' $$,
  $$ values (1, true) $$,
  'the loan and its approval are queued for the chain, in order'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a1');
select throws_ok(
  $$ select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4'), 'approved', 120000, 300, 6) $$,
  '42501', 'not_your_opportunity', 'EmpowerFI never makes the lending decision, not even an admin'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a2');
select throws_ok(
  $$ select refer_opportunity((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4')) $$,
  '42501', 'only_admins_refer', 'a leader cannot clear a flagged opportunity'
);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a1');
select is(
  refer_opportunity((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4')),
  '00000000-0000-0000-0000-0000000002f1'::uuid, 'an admin reviews it and refers it'
);
set local role postgres;

-- ---------------------------------------------------------------- the loan

create temp table loan as select id from loans where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1';
grant select on loan to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a7');
select throws_ok($$ select transition_loan((select id from loan), 'ACTIVE') $$,
  'P0001', 'invalid_loan_transition', 'a loan cannot skip disbursement');
select throws_ok($$ select record_payment((select id from loan), 1, 21667) $$,
  'P0001', 'loan_not_repaying', 'nor be repaid before it is disbursed');
select lives_ok($$ select transition_loan((select id from loan), 'DISBURSED', 'Pix sent') $$, 'the partner disburses');
select lives_ok($$ select transition_loan((select id from loan), 'ACTIVE') $$, 'the loan becomes active');
select lives_ok($$ select record_payment((select id from loan), 1, 21667) $$, 'the first instalment is recorded');
select throws_ok($$ select record_payment((select id from loan), 1, 21667) $$,
  '23505', 'instalment_already_paid', 'once');
select throws_ok($$ select record_payment((select id from loan), 13, 21667) $$,
  '22023', 'invalid_instalment', 'within the term');
select throws_ok($$ select transition_loan((select id from loan), 'PAID') $$,
  'P0001', 'instalments_outstanding', 'and it is not paid until every instalment is');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a3');
select results_eq(
  $$ select (select count(*) from loans)::int, (select count(*) from partner_decisions)::int, (select count(*) from payments)::int $$,
  $$ values (1, 1, 1) $$,
  'Maria sees her loan, the decision on it and her payment'
);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a9');
select is((select count(*)::int from loans) + (select count(*)::int from qualified_credit_opportunities), 0,
  'an outsider sees no opportunities or loans');
set local role postgres;

-- ------------------------------------------------------------- cost to serve

select ok(
  (select array_agg(distinct stage::text) from cost_events) @> array[
    'community_onboarding', 'community_verification', 'enrollment', 'readiness_assessment', 'credit_intent',
    'eligibility_assessment', 'opportunity_preparation', 'partner_referral', 'partner_decision',
    'disbursement', 'servicing'],
  'cost is counted at every stage, from the community onward'
);
select is(
  (select staff_minutes from cost_events where stage = 'opportunity_preparation'
   and fact_id = (select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e4')),
  30, 'a flagged opportunity costs its review time'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a2');
select ok((cts_summary('00000000-0000-0000-0000-0000000002c1') ->> 'per_participant_cents')::int > 0,
  'the leader sees her community''s cost per participant');
select throws_ok($$ select cts_summary() $$, '42501', 'not_allowed_to_see_costs', 'but not everyone''s');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000002a1');
select ok(
  (cts_summary() ->> 'per_100_disbursed_cents') is not null
  and (cts_summary() -> 'by_phase' ->> 'preparation')::int > 0,
  'admins see cost per R$ 100 lent, with preparation counted in'
);
set local role postgres;

-- ------------------------------------------------------------------ capital
-- Irene funds Horizonte; Ivo funds Distante.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002b1', 'c-irene@test'),
  ('00000000-0000-0000-0000-0000000002b2', 'c-ivo@test');
update profiles set role = 'capital_provider'
where id in ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002b2');
insert into capital_commitments (provider_id, partner_id, committed_cents, target_return_bps) values
  ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002f1', 5000000, 1200),
  ('00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000002f2', 3000000, 1000);

create temp table pay as select id from payments where loan_id = (select id from loan);
grant select on pay to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002b1');
create temp table pf as select capital_portfolio() as p;
select results_eq(
  $$ select (p ->> 'loans')::int, (p ->> 'deployed_cents')::bigint, (p ->> 'received_cents')::bigint,
            (p ->> 'principal_repaid_cents')::bigint, (p ->> 'available_cents')::bigint from pf $$,
  $$ values (1, 200000::bigint, 21667::bigint, 16667::bigint, 4816667::bigint) $$,
  'the provider sees the portfolio its capital funds: deployed, received, principal back, still available'
);
select ok(
  (select bool_and(b ->> 'code' ~ '^L-[0-9A-F]{6}$') from pf, jsonb_array_elements(p -> 'book') b)
  and (select p::text from pf) !~ 'pgTAP Maria'
  and (select p::text from pf) !~ '00000000-0000-0000-0000-0000000002e1',
  'loan by loan under a code of the loan''s own: no name, no link to the person'
);
select ok(
  (select (p -> 'expected' ->> 'net_cents')::bigint > 0 and (p ->> 'is_simulated')::boolean from pf),
  'expected return is shown, and marked simulated'
);
select lives_ok(
  $$ select audit_record('loan', (select id from loan)) $$,
  'the provider can audit the loan it funds'
);
select lives_ok(
  $$ select audit_record('payment', (select id from pay)) $$,
  'and its payments'
);
select throws_ok(
  $$ select audit_record('opportunity', (select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000002e1')) $$,
  '42501', 'not_allowed_to_audit', 'but nothing about the person upstream of the loan'
);
select throws_ok(
  $$ select audit_record('enrollment', '00000000-0000-0000-0000-0000000002e1') $$,
  '42501', 'not_allowed_to_audit', 'not even her registration'
);
select is(
  (select count(*)::int from loans) + (select count(*)::int from entrepreneurs) + (select count(*)::int from checkins)
    + (select count(*)::int from qualified_credit_opportunities) + (select count(*)::int from readiness_assessments),
  0, 'no rows of loans, people, check-ins, opportunities or readiness'
);
select is((select count(*)::int from capital_commitments), 1, 'its own commitment only');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002b2');
select is((capital_portfolio() ->> 'loans')::int, 0, 'another provider does not see a portfolio it does not fund');
select throws_ok(
  $$ select audit_record('loan', (select id from loan)) $$,
  '42501', 'not_allowed_to_audit', 'nor audit its loans'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000002a7');
select throws_ok($$ select capital_portfolio() $$, '42501', 'not_allowed_to_see_portfolio',
  'the portfolio view is for capital providers, auditors and admins');
set local role postgres;

select * from finish();
rollback;
