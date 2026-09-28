-- The Capital Journey: nine stages, each read from the records that stage wrote
-- (addendum v3 §7.3).
--
-- Two things are worth testing here and the rest follows from them.
--
-- The first is that a stage with nothing in it says so. A hero screen whose
-- arrows all point forward whatever the data holds is a diagram, and a diagram
-- proves nothing; the fixture below deliberately leaves the investment, the
-- position and the settlement stages empty and asserts that the reader reports
-- them empty rather than skipping them.
--
-- The second is attribution. What she bought with the capital that landed in
-- her account is traceable to this loan. What her supplier paid a third
-- merchant afterwards is not — that balance is commingled the moment a second
-- customer pays it — and a journey that counted the onward hop as hers would be
-- claiming a provenance the ledger cannot support.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(27);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000016a1', 'trip-admin@test'),
  ('00000000-0000-0000-0000-0000000016a2', 'trip-leader@test'),
  ('00000000-0000-0000-0000-0000000016a3', 'trip-rosa@test'),
  ('00000000-0000-0000-0000-0000000016a5', 'trip-desk@test');
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents) values
  ('00000000-0000-0000-0000-0000000016ab', 'Trip Desk', 'fintech', 10000, 5000000);
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000016a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000016a2';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000016a3';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000016ab'
  where id = '00000000-0000-0000-0000-0000000016a5';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000016c1', 'pgTAP Journey community', 'association', 'Belém', 'PA',
   '00000000-0000-0000-0000-0000000016a2', 'verified', now(), '00000000-0000-0000-0000-0000000016a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector, city, state) values
  ('00000000-0000-0000-0000-0000000016e1', '00000000-0000-0000-0000-0000000016a3', 'Trip Rosa', 'Ateliê Rosa', 'textiles', 'Belém', 'PA');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-0000000016e1');

insert into local_economies (id, code, name, territory, community_id, uf, currency_code, parity_bps, parity_reference) values
  ('00000000-0000-0000-0000-0000000016f1', 'pgtap_trip', 'Moeda pgTAP Journey', 'Território pgTAP',
   '00000000-0000-0000-0000-0000000016c1', 'PA', 'PGJ', 10000, '1 PGJ = R$ 1, demonstration only');
insert into local_merchants (id, economy_id, code, name, sector, city, uf) values
  ('00000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016f1', 'tecidos', 'Tecidos do Bairro', 'wholesale', 'Belém', 'PA'),
  ('00000000-0000-0000-0000-0000000016b2', '00000000-0000-0000-0000-0000000016f1', 'grafica', 'Gráfica da Esquina', 'services', 'Belém', 'PA');

insert into credit_intents (id, entrepreneur_id, purpose, requested_amount_cents) values
  ('00000000-0000-0000-0000-0000000016d1', '00000000-0000-0000-0000-0000000016e1', 'inventory', 100000);
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features) values
  ('00000000-0000-0000-0000-000000016aa1', '00000000-0000-0000-0000-0000000016e1', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb);
insert into eligibility_assessments (id, entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version,
  decision, requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
  risk_band, risk_points, confidence, reason_codes, inputs) values
  ('00000000-0000-0000-0000-000000016ea1', '00000000-0000-0000-0000-0000000016e1', '00000000-0000-0000-0000-0000000016d1',
   '00000000-0000-0000-0000-000000016aa1', 1, 'test', 'ELIGIBLE', 100000, 100000, 12, 10000, 60000, 'LOW', 10, 'HIGH', '{}', '{}'::jsonb);
insert into qualified_credit_opportunities (id, entrepreneur_id, intent_id, eligibility_id, opportunity_no,
  amount_cents, term_months, instalment_cents, purpose, risk_band, confidence, status, desired_date, urgency) values
  ('00000000-0000-0000-0000-000000016fa1', '00000000-0000-0000-0000-0000000016e1', '00000000-0000-0000-0000-0000000016d1',
   '00000000-0000-0000-0000-000000016ea1', 1, 100000, 12, 10000, 'inventory', 'LOW', 'HIGH', 'in_review', current_date + 30, 'soon');

-- The engine's plan: the whole request on one domestic route.
insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents, evaluated,
  allocations, reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status) values
  ('00000000-0000-0000-0000-000000016fa1', 1, 'test', 100000, '[]'::jsonb,
   '[{"instrument_id": "pool_domestico_p2p", "amount_cents": 100000}]'::jsonb,
   '{}', 100000, 0, 0, 'recommended');

insert into partner_decisions (id, opportunity_id, partner_id, verdict, approved_amount_cents, rate_bps, term_months) values
  ('00000000-0000-0000-0000-000000016dc1', '00000000-0000-0000-0000-000000016fa1', '00000000-0000-0000-0000-0000000016ab', 'approved', 100000, 300, 12);
insert into loans (id, opportunity_id, entrepreneur_id, partner_id, decision_id,
  principal_cents, term_months, rate_bps, instalment_cents, status, is_simulated) values
  ('00000000-0000-0000-0000-000000016cb1', '00000000-0000-0000-0000-000000016fa1', '00000000-0000-0000-0000-0000000016e1',
   '00000000-0000-0000-0000-0000000016ab', '00000000-0000-0000-0000-000000016dc1', 100000, 12, 300, 10000, 'PARTNER_APPROVED', true);
insert into loan_events (loan_id, from_status, to_status, note, is_simulated)
values ('00000000-0000-0000-0000-000000016cb1', 'PARTNER_APPROVED', 'DISBURSED', 'pgTAP', true);
update loans set status = 'DISBURSED', disbursed_at = now() where id = '00000000-0000-0000-0000-000000016cb1';

select pg_temp.act_as('00000000-0000-0000-0000-0000000016a5');
-- She buys from one merchant; that merchant pays a second; the second buys
-- from her. Only the first and the third touch her account.
select public.local_spend('00000000-0000-0000-0000-0000000016b1', 40000, 'inventory', '00000000-0000-0000-0000-0000000016e1');
select public.local_merchant_payment('00000000-0000-0000-0000-0000000016b1', '00000000-0000-0000-0000-0000000016b2', 15000);
select public.local_sale('00000000-0000-0000-0000-0000000016b2', '00000000-0000-0000-0000-0000000016e1', 5000);
set local role postgres;
insert into payments (loan_id, instalment_no, amount_cents, paid_at, is_simulated) values
  ('00000000-0000-0000-0000-000000016cb1', 1, 10000, now(), true);

-- Read once, focused on this request, and assert against the snapshot.
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a5');
create temp table trip as
  select public.capital_journey('00000000-0000-0000-0000-000000016fa1') as j;

set local role postgres;
create function pg_temp.stage(p_no int) returns jsonb language sql stable as $$
  select s from pg_temp.trip, jsonb_array_elements(j -> 'stages') as t(s) where (s ->> 'no')::int = p_no
$$;
create function pg_temp.amt(p_no int) returns bigint language sql stable as $$
  select (pg_temp.stage(p_no) ->> 'amount_cents')::bigint
$$;

-- ---------------------------------------------------------------- the nine

select is(
  (select jsonb_array_length(j -> 'stages') from pg_temp.trip), 9,
  'the journey has nine stages and not a stage more');

select is(
  (select array_agg(s ->> 'key' order by (s ->> 'no')::int)
     from pg_temp.trip, jsonb_array_elements(j -> 'stages') as t(s)),
  array['capital_exists', 'she_asks', 'engine_routes', 'investors_fund', 'position_minted',
        'dollars_become_reais', 'disbursed', 'circulates', 'comes_back'],
  'and they are in the order the capital actually travels');

select is(
  (select j -> 'focus' ->> 'code' from pg_temp.trip),
  private.partner_code('00000000-0000-0000-0000-0000000016e1'),
  'focusing on a request names it by the code this caller''s role sees — the desk''s, here');

-- ------------------------------------------------- the stages that happened

select is(pg_temp.amt(2), 100000::bigint, 'she asked for the amount the opportunity records');
select is((pg_temp.stage(2) ->> 'count')::int, 1, 'and focusing narrows the stage to that one request');

select is(pg_temp.amt(3), 100000::bigint, 'the engine routed the whole of it');
select is((pg_temp.stage(3) ->> 'domestic_cents')::bigint, 100000::bigint, 'to a domestic route');
select is((pg_temp.stage(3) ->> 'global_cents')::bigint, 0::bigint, 'and nothing came from abroad on this one');

select is(pg_temp.amt(7), 100000::bigint, 'the loan disbursed its principal');
select is((pg_temp.stage(7) ->> 'evidence'), 'simulated_assumption',
  'and the demonstration book says it is a demonstration, rather than claiming to be observed');

select is(pg_temp.amt(9), 10000::bigint, 'one instalment came back');
select is((pg_temp.stage(9) ->> 'on_the_rail')::int, 1, 'and it travelled the local rail, because she still held the units');

-- ---------------------------------------------------- the stages that did not

-- The fixture funds no investment, mints no position and settles no dollars.
-- A stage that reports those as having happened is a diagram, not a reading.
select is((pg_temp.stage(4) ->> 'happened')::boolean, false, 'no investor funded this one, and the stage says so');
select is(pg_temp.amt(4), 0::bigint, 'with nothing put up');
select is((pg_temp.stage(5) ->> 'happened')::boolean, false, 'no position was minted, and the stage says so');
select is((pg_temp.stage(4) ->> 'evidence'), 'simulated_assumption',
  'and a stage with nothing in it does not claim to be observed, which is what an empty bool_and would have said');
select is((pg_temp.stage(6) ->> 'happened')::boolean, false, 'no dollars became reais, and the stage says so');

-- -------------------------------------------------------------- attribution

-- PGJ 400 out of her account and PGJ 50 back into it.
select is(pg_temp.amt(8), 45000::bigint,
  'what she traded is what left and re-entered the account the disbursal credited');

-- PGJ 150 between two merchants. Real, in the same territory, and not hers.
select is((pg_temp.stage(8) ->> 'onward_cents')::bigint, 15000::bigint,
  'and what her supplier traded onward is reported apart, never added to hers');

select is((pg_temp.stage(8) ->> 'count')::int, 1,
  'one merchant took capital directly from her, whatever happened after that');

select is((pg_temp.stage(8) ->> 'injected_cents')::bigint, 100000::bigint,
  'the whole principal landed on the rail');

select is((select (j ->> 'circulated_cents')::bigint from pg_temp.trip), 45000::bigint,
  'and the headline figure follows the same rule as the stage, not a looser one');

-- ------------------------------------------------------------------- proof

-- Anchored by hand: this fixture inserts the loan rather than going through
-- formalise_loan, so nothing queued one. A confirmed anchor carries its proof,
-- which the table enforces and this row honours.
insert into chain_anchors (kind, entity_id, status, signature, slot, commitment, confirmed_at)
values ('loan', '00000000-0000-0000-0000-000000016cb1', 'confirmed', 'pgTAPsig', 1, decode(repeat('a', 64), 'hex'), now());


-- A stage can be true and unanchored. Reporting nine of nine proven by leaving
-- out the stages that prove nothing would be the easiest lie on this screen.
select is((pg_temp.stage(8) -> 'anchors' ->> 'total')::int, 0,
  'the local rail anchors nothing, and the journey says none rather than omitting the stage');

select is((pg_temp.stage(7) -> 'anchors' ->> 'total')::int, 0,
  'the reading taken before it was anchored counts no anchor, and invents none');

select is(
  (private.anchor_tally('loan', array['00000000-0000-0000-0000-000000016cb1'::uuid]) ->> 'confirmed')::int,
  1, 'and a confirmed anchor is counted as confirmed, not merely as present');

-- ------------------------------------------------------------------- who reads

select pg_temp.act_as('00000000-0000-0000-0000-0000000016a3');
select throws_ok(
  $$ select public.capital_journey() $$,
  '42501', null, 'an entrepreneur does not read the capital book''s journey');

set local role anon;
select throws_ok(
  $$ select public.capital_journey() $$,
  '42501', null, 'and a signed-out visitor cannot ask at all');

set local role postgres;
select * from finish();
rollback;
