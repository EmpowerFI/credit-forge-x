-- Check-ins, readiness assessments, credit intent — and the thesis.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(33);

-- ------------------------------------------------------------------ fixtures
-- One verified community led by Lia, with Maria (login) and Joana (no login).
-- Ana has a login and is a member too. Rita belongs to another community.
-- Lone has a login and an entrepreneur record but no community. Otto is nobody.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'r-admin@test'),
  ('00000000-0000-0000-0000-0000000001a2', 'r-lia@test'),
  ('00000000-0000-0000-0000-0000000001a3', 'r-maria@test'),
  ('00000000-0000-0000-0000-0000000001a4', 'r-ana@test'),
  ('00000000-0000-0000-0000-0000000001a5', 'r-lone@test'),
  ('00000000-0000-0000-0000-0000000001a6', 'r-otto@test'),
  ('00000000-0000-0000-0000-0000000001a7', 'r-auditor@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000001a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000001a2';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000001a7';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000001c1', 'pgTAP Readiness', 'education_programme', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000001a2', 'verified', now(), '00000000-0000-0000-0000-0000000001a1'),
  ('00000000-0000-0000-0000-0000000001c2', 'pgTAP Elsewhere', 'collective', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000001a1', 'verified', now(), '00000000-0000-0000-0000-0000000001a1');

insert into entrepreneurs (id, profile_id, display_name) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000001a3', 'pgTAP Maria'),
  ('00000000-0000-0000-0000-0000000001e2', null, 'pgTAP Joana'),
  ('00000000-0000-0000-0000-0000000001e3', '00000000-0000-0000-0000-0000000001a4', 'pgTAP Ana'),
  ('00000000-0000-0000-0000-0000000001e4', null, 'pgTAP Rita'),
  ('00000000-0000-0000-0000-0000000001e5', '00000000-0000-0000-0000-0000000001a5', 'pgTAP Lone');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001e1'),
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001e2'),
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001e3'),
  ('00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-0000000001e4');
insert into chain_anchors (kind, entity_id) values
  ('enrollment', '00000000-0000-0000-0000-0000000001e1'),
  ('enrollment', '00000000-0000-0000-0000-0000000001e2'),
  ('enrollment', '00000000-0000-0000-0000-0000000001e3');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create temp table periods as select
  private.current_period() as now_p,
  to_char(to_date(private.current_period(), 'YYYY-MM') - interval '1 month', 'YYYY-MM') as last_p,
  to_char(to_date(private.current_period(), 'YYYY-MM') + interval '1 month', 'YYYY-MM') as next_p,
  to_char(to_date(private.current_period(), 'YYYY-MM') - interval '13 months', 'YYYY-MM') as old_p;
grant select on periods to authenticated, service_role;

-- A readiness result and features the engine could have produced.
create temp table results as select
  '{"model_version":"readiness-v0.1.0","status":"NEEDS_MORE_DATA","band":"LOW","score":20,
    "components":{"preparation":20,"regularity":0,"data_quality":0,"business":0},
    "missing_requirements":[{"code":"INSUFFICIENT_HISTORY","current":1,"required":3}],
    "reason_codes":["EDUCATION_COMPLETE"]}'::jsonb as not_ready,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":97,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":22},
    "missing_requirements":[],"reason_codes":["EDUCATION_COMPLETE","KEEPS_RECORDS"]}'::jsonb as ready,
  '{"as_of_period":"2026-09","months_reported":1}'::jsonb as features_a,
  '{"as_of_period":"2026-09","months_reported":6}'::jsonb as features_b;
grant select on results to authenticated, service_role;

-- ---------------------------------------------------------------- check-ins

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a3');
select lives_ok(
  $$ select submit_checkin((select now_p from periods), 300000, 120000, 50000, 80000, true, 22) $$,
  'an entrepreneur reports her month'
);
select throws_ok(
  $$ select submit_checkin((select now_p from periods), 1, 0, 0, 0, true, 1) $$,
  '23505', 'checkin_exists_for_period', 'once per month'
);
select throws_ok(
  $$ select submit_checkin((select next_p from periods), 1, 0, 0, 0, true, 1) $$,
  '22023', 'period_in_future', 'not for a month that has not happened'
);
select throws_ok(
  $$ select submit_checkin((select old_p from periods), 1, 0, 0, 0, true, 1) $$,
  '22023', 'period_too_old', 'not for more than a year ago'
);
select throws_ok(
  $$ select submit_checkin('2026-13', 1, 0, 0, 0, true, 1) $$,
  '22023', 'invalid_period', 'not for a month that does not exist'
);
select throws_ok(
  $$ select submit_checkin((select last_p from periods), 1, 0, 0, 0, true, 1,
       p_entrepreneur_id => '00000000-0000-0000-0000-0000000001e2') $$,
  '42501', 'not_allowed_to_report', 'and not for someone else'
);
select results_eq(
  $$ select net_business_cents, net_after_household_cents, gross_margin_bps from checkin_cash_flow $$,
  $$ values (130000::bigint, 50000::bigint, 6000) $$,
  'the month becomes a cash-flow view'
);
set local role postgres;

select results_eq(
  $$ select a.depends_on = e.id from chain_anchors a, chain_anchors e
     where a.kind = 'checkin' and e.kind = 'enrollment' and e.entity_id = '00000000-0000-0000-0000-0000000001e1'
       and a.entity_id in (select id from checkins where entrepreneur_id = '00000000-0000-0000-0000-0000000001e1') $$,
  $$ values (true) $$,
  'her month is queued for the chain behind her own registration'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a2');
select lives_ok(
  $$ select submit_checkin((select now_p from periods), 90000, 30000, 10000, 20000, true, 18,
       p_entrepreneur_id => '00000000-0000-0000-0000-0000000001e2') $$,
  'a leader reports for a member without a login'
);
select throws_ok(
  $$ select submit_checkin((select now_p from periods), 1, 0, 0, 0, true, 1,
       p_entrepreneur_id => '00000000-0000-0000-0000-0000000001e4') $$,
  '42501', 'not_allowed_to_report', 'but not for someone outside her communities'
);
select is((select count(*)::int from checkins), 2, 'and sees her members'' months');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a5');
select throws_ok(
  $$ select submit_checkin((select now_p from periods), 1, 0, 0, 0, true, 1) $$,
  'P0001', 'not_enrolled', 'reporting needs a verified community'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a6');
select throws_ok(
  $$ select submit_checkin((select now_p from periods), 1, 0, 0, 0, true, 1) $$,
  '42501', 'not_allowed_to_report', 'someone with no entrepreneur record reports nothing'
);
select is((select count(*)::int from checkins), 0, 'and sees nothing');
set local role postgres;

-- Consent as each participant's community recorded it (M14): all four scopes.
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);

-- --------------------------------------------------------------- readiness

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a3');
select results_eq(
  $$ select (readiness_inputs('00000000-0000-0000-0000-0000000001e1') ->> 'community_verified')::boolean,
            jsonb_array_length(readiness_inputs('00000000-0000-0000-0000-0000000001e1') -> 'checkins') $$,
  $$ values (true, 1) $$,
  'the engine''s inputs are gathered for her'
);
select throws_ok(
  $$ select readiness_inputs('00000000-0000-0000-0000-0000000001e4') $$,
  '42501', 'not_allowed_to_assess', 'but not for someone else'
);
select throws_ok(
  $$ select record_readiness_assessment('00000000-0000-0000-0000-0000000001e1',
       (select features_b from results), (select ready from results)) $$,
  '42501', null, 'and nobody records their own result'
);
set local role postgres;

set local role service_role;
select is(
  (record_readiness_assessment('00000000-0000-0000-0000-0000000001e1',
     (select features_a from results), (select not_ready from results)) ->> 'assessment_no')::int,
  1, 'the service records the engine''s first assessment'
);
select is(
  (record_readiness_assessment('00000000-0000-0000-0000-0000000001e1',
     (select features_a from results), (select not_ready from results)) ->> 'reused')::boolean,
  true, 'the same features again reuse it, instead of attesting twice'
);
select is(
  (record_readiness_assessment('00000000-0000-0000-0000-0000000001e1',
     (select features_b from results), (select ready from results)) ->> 'assessment_no')::int,
  2, 'new features make a new assessment'
);
-- Ana: ready too, and she will not ask for credit.
select record_readiness_assessment('00000000-0000-0000-0000-0000000001e3',
  (select features_b from results), (select ready from results));
-- Lone: assessed, not ready.
select record_readiness_assessment('00000000-0000-0000-0000-0000000001e5',
  (select features_a from results), (select not_ready from results));
set local role postgres;

select is(
  (select count(*)::int from chain_anchors a join readiness_assessments r on r.id = a.entity_id
   where a.kind = 'readiness' and r.entrepreneur_id = '00000000-0000-0000-0000-0000000001e1'),
  2, 'each of her assessments is queued for attestation'
);
select is(
  (select count(*)::int from chain_anchors a join readiness_assessments r on r.id = a.entity_id
   where a.kind = 'readiness' and r.entrepreneur_id = '00000000-0000-0000-0000-0000000001e5'),
  0, 'but not for someone with no borrower account to attest against'
);

-- ----------------------------------------------------------- credit intent

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a2');
select throws_ok(
  $$ select declare_credit_intent('working_capital', 200000) $$,
  '42501', 'only_the_entrepreneur_declares_intent', 'a leader cannot ask for credit on anyone''s behalf'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a5');
select throws_ok(
  $$ select declare_credit_intent('working_capital', 200000) $$,
  'P0001', 'not_credit_ready', 'intent comes after readiness'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a3');
select lives_ok(
  $$ select declare_credit_intent('inventory', 300000, 'Stock for the December orders') $$,
  'a ready entrepreneur asks, herself'
);
select throws_ok(
  $$ select declare_credit_intent('equipment', 100000) $$,
  '23505', 'intent_already_active', 'one open request at a time'
);
select throws_ok(
  $$ select declare_credit_intent('equipment', 5000) $$,
  '23514', null, 'within the microcredit range'
);
set local role postgres;

-- -------------------------------------------------------------- the thesis

select is(
  (select array_agg(entrepreneur_id) from private.credit_pipeline()
   where entrepreneur_id::text like '00000000-0000-0000-0000-0000000001%'),
  array['00000000-0000-0000-0000-0000000001e1'::uuid],
  'the pipeline holds whoever is ready and asked — Maria'
);
select ok(
  not exists (select 1 from private.credit_pipeline() where entrepreneur_id = '00000000-0000-0000-0000-0000000001e3'),
  'THESIS: Ana is CREDIT_READY with no intent, and never enters the credit pipeline'
);
select is(
  (select status::text from latest_readiness where entrepreneur_id = '00000000-0000-0000-0000-0000000001e3'),
  'CREDIT_READY', 'and she stays CREDIT_READY, left alone'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a3');
select lives_ok($$ select withdraw_credit_intent() $$, 'Maria can change her mind');
set local role postgres;
select is((select count(*)::int from private.credit_pipeline()
  where entrepreneur_id::text like '00000000-0000-0000-0000-0000000001%'), 0, 'and leaves the pipeline');

-- -------------------------------------------------------------------- audit

select pg_temp.act_as('00000000-0000-0000-0000-0000000001a7');
select is(
  length(audit_record('checkin',
    (select id from checkins where entrepreneur_id = '00000000-0000-0000-0000-0000000001e1')) ->> 'borrower_ref'),
  64, 'an auditor gets the borrower ref a month is anchored against'
);
set local role postgres;

select * from finish();
rollback;
