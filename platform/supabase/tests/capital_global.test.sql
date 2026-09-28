-- Global Capital Eligibility: the second question, asked of the residual gap.
-- The same expectations packages/capital-allocation/vectors/global.json holds
-- globalEligibility() to, put to private.global_eligibility(). A gap judged one
-- way in the browser and another way in the database is one of them being
-- wrong, and neither is allowed to be.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(43);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- One answer, reduced to what the vectors assert: the decision, why, the gap it
-- allows, which gates refused, and her economics to the centavo.
create function pg_temp.g(p_ctx jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'decision', s.r ->> 'decision',
    'reason_codes', s.r -> 'reason_codes',
    'eligible_gap_cents', s.r -> 'eligible_gap_cents',
    'failed_gates', (select coalesce(jsonb_agg(t.x ->> 'gate' order by t.n), '[]'::jsonb)
                     from jsonb_array_elements(s.r -> 'gates') with ordinality as t(x, n)
                     where not (t.x ->> 'passed')::boolean),
    'economics', s.r -> 'economics')
  from (select private.global_eligibility(p_ctx) as r) s
$$;

-- ---------------------------------------------------------------- the vectors
select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "eligible", "economics": {"affordable_gap_cents": 200000, "delta_bps": 79, "instalment_cents": 25807, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 200000, "failed_gates": [], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED"]}'::jsonb,
  'the residual domestic capacity left, and what a real quote costs her');

select is(
  pg_temp.g('{"evidence_score": 0, "gap_cents": 0, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 0, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": false, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "not_needed", "economics": {"affordable_gap_cents": 0, "delta_bps": 79, "instalment_cents": 0, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 0, "failed_gates": ["gap"], "reason_codes": ["GLOBAL_GAP_ABSENT"]}'::jsonb,
  'a gap that never existed is not a refusal');

select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 179, "recoverable_domestic": ["credito_regional_capital_giro"], "route_cost_bps": 5400, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "refused", "economics": {"affordable_gap_cents": 200000, "delta_bps": 79, "instalment_cents": 25807, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 0, "failed_gates": ["domestic_reconsidered"], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED", "GLOBAL_DOMESTIC_ROUTE_RECOVERABLE"]}'::jsonb,
  'a paper she could fetch keeps the money at home');

select is(
  pg_temp.g('{"evidence_score": 8, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 2, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "refused", "economics": {"affordable_gap_cents": 200000, "delta_bps": 79, "instalment_cents": 25807, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 0, "failed_gates": ["evidence"], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING", "GLOBAL_ROUTE_REGULATED", "GLOBAL_EVIDENCE_INSUFFICIENT"]}'::jsonb,
  'too little reported history for money that crosses a border');

select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 88000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "refused", "economics": {"affordable_gap_cents": 15499, "delta_bps": 79, "instalment_cents": 25807, "instalment_headroom_cents": 2000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 0, "failed_gates": ["affordability"], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED", "GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION"]}'::jsonb,
  'her month is already committed to the domestic routes');

select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": false, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "refused", "economics": {"affordable_gap_cents": 200000, "delta_bps": 79, "instalment_cents": 25807, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 279, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 5400, "total_cost_bps": 5479}, "eligible_gap_cents": 0, "failed_gates": ["regulatory_route"], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_NO_REGULATED_ROUTE"]}'::jsonb,
  'no regulated rail can settle it now');

select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 54000, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 7000, "recoverable_domestic": [], "route_cost_bps": 5400, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 12}'::jsonb),
  '{"decision": "refused", "economics": {"affordable_gap_cents": 193721, "delta_bps": 6900, "instalment_cents": 37167, "instalment_headroom_cents": 36000, "mobilization_annual_bps": 7100, "mobilization_total_bps": 7100, "modelled_ramp_annual_bps": 200, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 7000, "route_cost_bps": 5400, "total_cost_bps": 12300}, "eligible_gap_cents": 0, "failed_gates": ["economics"], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_GAP_PARTLY_AFFORDABLE", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED", "GLOBAL_COST_EXCEEDS_CEILING"]}'::jsonb,
  'a quote so expensive the ceiling refuses the route');

select is(
  pg_temp.g('{"evidence_score": 18, "gap_cents": 200000, "global_ticket_min_cents": 100000, "instalment_committed_cents": 0, "max_instalment_cents": 90000, "modelled_ramp_annual_bps": 800, "modelled_return_ramp_bps": 100, "months_reported": 12, "quoted_mobilization_bps": 179, "recoverable_domestic": [], "route_cost_bps": 6000, "settlement_feasible": true, "settlement_reality": "simulated", "term_months": 3}'::jsonb),
  '{"decision": "eligible", "economics": {"affordable_gap_cents": 200000, "delta_bps": 316, "instalment_cents": 77207, "instalment_headroom_cents": 90000, "mobilization_annual_bps": 1116, "mobilization_total_bps": 279, "modelled_ramp_annual_bps": 800, "modelled_return_ramp_bps": 100, "quoted_mobilization_bps": 179, "route_cost_bps": 6000, "total_cost_bps": 6316}, "eligible_gap_cents": 200000, "failed_gates": [], "reason_codes": ["GLOBAL_GAP_CONFIRMED", "GLOBAL_ECONOMICS_WITHIN_CEILING", "GLOBAL_EVIDENCE_SUFFICIENT", "GLOBAL_ROUTE_REGULATED"]}'::jsonb,
  'a short term concentrates the conversion into three months');

-- ------------------------------------------------------------- engine policy

select is(private.global_capital_model_version(), 'global-capital-v1.0.0',
  'the engine names its version, and the vectors are written for it');

select is(private.global_evidence_min_score(), 12,
  'a cross-border route asks for half the data-quality component, stated as policy');

select is(private.global_min_months_reported(), 3,
  'and for three months of history behind it: one good month is not a history');

select is(private.global_recoverable_blocks(), array['INSUFFICIENT_DOCUMENTATION'],
  'papers she can fetch are the only domestic refusal this engine calls recoverable');

select is(
  (select count(*)::int from unnest(private.global_reason_order()) o
   where o = any(private.capital_reason_order())),
  0, 'no code belongs to both questions, so a plan can never pick up a global reason');

select is(
  private.global_reasons_ordered(array['GLOBAL_NO_REGULATED_ROUTE', 'GLOBAL_GAP_CONFIRMED']),
  array['GLOBAL_GAP_CONFIRMED', 'GLOBAL_NO_REGULATED_ROUTE'],
  'reasons come back in the engine order, whatever order they were raised in');

-- The pool engine's own instalment, mirrored rather than reinvented: R$ 5.000
-- over twelve months at 5400 bps is R$ 641,67 a month.
select is(private.capital_instalment_cents(500000, 5400, 12), 64167::bigint,
  'the instalment of a principal at a rate is the one the pool engine sizes');

select is(private.capital_instalment_cents(500000, 5479, 12), 64517::bigint,
  'and the quote costs her R$ 3,50 a month on that loan, which is the whole point');

-- ------------------------------------------------------- reading the domestic pass

select is(
  private.global_recoverable_domestic(
    '{"evaluated": [
       {"instrument_id": "credito_regional_capital_giro", "eligible": false, "blocks": ["INSUFFICIENT_DOCUMENTATION"]},
       {"instrument_id": "microcredito_produtivo", "eligible": false, "blocks": ["REGION_NOT_ELIGIBLE", "INSUFFICIENT_DOCUMENTATION"]},
       {"instrument_id": "pool_global_impacto", "eligible": false, "blocks": ["INSUFFICIENT_DOCUMENTATION"]}]}'::jsonb,
    '[{"id": "credito_regional_capital_giro", "is_domestic": true},
      {"id": "microcredito_produtivo", "is_domestic": true},
      {"id": "pool_global_impacto", "is_domestic": false}]'::jsonb),
  '["credito_regional_capital_giro"]'::jsonb,
  'only a domestic route refused for papers alone counts as recoverable');

select is(
  private.global_instalment_committed(
    '{"allocations": [
       {"instrument_id": "credito_regional_capital_giro", "amount_cents": 437837},
       {"instrument_id": "troca_produtiva_rede", "amount_cents": 62163},
       {"instrument_id": "pool_global_impacto", "amount_cents": 200000}]}'::jsonb,
    '[{"id": "credito_regional_capital_giro", "is_domestic": true, "is_credit": true, "estimated_cost_bps": 4800, "max_instalment_share_bps": 6000},
      {"id": "troca_produtiva_rede", "is_domestic": true, "is_credit": false, "estimated_cost_bps": null, "max_instalment_share_bps": null},
      {"id": "pool_global_impacto", "is_domestic": false, "is_credit": true, "estimated_cost_bps": 2400, "max_instalment_share_bps": 10000}]'::jsonb,
    12),
  54000::bigint,
  'only the domestic credit routes commit her month: R$ 540, and nothing from the exchange or from the route being asked about');

-- --------------------------------------------------------------- the guardrails

select throws_ok(
  $$ select private.global_eligibility('{"gap_cents": -1, "term_months": 12}'::jsonb) $$,
  '22023', null, 'a gap that is not a non-negative integer is refused, not rounded');

select throws_ok(
  $$ select private.global_eligibility('{"gap_cents": 200000, "term_months": 0}'::jsonb) $$,
  '22023', null, 'and a term of no months is refused too');

-- ---------------------------------------------------- one run, two answers

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010a1', 'gc-rita@test'),
  ('00000000-0000-0000-0000-0000000010a2', 'gc-operator@test');
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000010a1';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000010a2';

insert into entrepreneurs (id, profile_id, display_name, city, state)
values ('00000000-0000-0000-0000-0000000010e1', '00000000-0000-0000-0000-0000000010a1', 'GC Rita', 'Campinas', 'SP');
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
values ('00000000-0000-0000-0000-0000000010e1', 1, 'v1', true, true, false, false, 'app');
insert into credit_intents (id, entrepreneur_id, purpose, requested_amount_cents)
values ('00000000-0000-0000-0000-0000000010c1', '00000000-0000-0000-0000-0000000010e1', 'inventory', 500000);
-- The evidence the global question asks about: the readiness engine's own
-- data_quality component, over the months it was computed from.
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features)
values ('00000000-0000-0000-0000-0000000010d1', '00000000-0000-0000-0000-0000000010e1', 1, 'test',
  private.current_period(), 'CREDIT_READY', 'HIGH', 70,
  '{"preparation": 25, "regularity": 20, "data_quality": 18, "business": 7}'::jsonb,
  '{}', '{}', '{"months_reported": 12}'::jsonb);
insert into eligibility_assessments (id, entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version,
  decision, requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
  risk_band, risk_points, confidence, reason_codes, inputs)
values ('00000000-0000-0000-0000-0000000010b1', '00000000-0000-0000-0000-0000000010e1', '00000000-0000-0000-0000-0000000010c1',
  '00000000-0000-0000-0000-0000000010d1', 1, 'test', 'ELIGIBLE', 500000, 500000, 12, 50000, 90000,
  'LOW', 10, 'HIGH', '{}', '{}'::jsonb);
insert into qualified_credit_opportunities (id, entrepreneur_id, intent_id, eligibility_id, opportunity_no,
  amount_cents, term_months, instalment_cents, purpose, risk_band, confidence, status, desired_date, urgency,
  documents_on_file)
values ('00000000-0000-0000-0000-0000000010f1', '00000000-0000-0000-0000-0000000010e1', '00000000-0000-0000-0000-0000000010c1',
  '00000000-0000-0000-0000-0000000010b1', 1, 500000, 12, 50000, 'inventory', 'LOW', 'HIGH', 'in_review',
  current_date + 30, 'soon',
  '{cnpj_or_mei,bank_statement_3m,cpf,proof_of_activity,network_membership}');

select pg_temp.act_as('00000000-0000-0000-0000-0000000010a2');

select lives_ok(
  $$ select public.run_capital_engine('00000000-0000-0000-0000-0000000010f1') $$,
  'the operator runs the engine once and gets both answers');

set local role postgres;

select isnt(
  (select global_eligibility from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  '{}'::jsonb, 'the decision records the global question beside the plan');

select is(
  (select global_eligibility ->> 'model_version' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  'global-capital-v1.0.0', 'under the engine version that answered it');

select is(
  (select eligible_gap_cents from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  (select (global_eligibility ->> 'eligible_gap_cents')::bigint from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  'and the column §10 aggregates says what the answer says');

-- Her whole need is inside domestic capacity, so there is nothing for
-- international money to answer. That is not a refusal.
select is(
  (select global_eligibility ->> 'decision' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  'not_needed', 'a need domestic capacity covered leaves the global question unasked');

select is(
  (select global_eligibility -> 'reason_codes' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 1),
  '["GLOBAL_GAP_ABSENT"]'::jsonb, 'and says so in one code, not in a list of refusals');

select pg_temp.act_as('00000000-0000-0000-0000-0000000010a2');

select pg_temp.act_as('00000000-0000-0000-0000-0000000010a2');

select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000010f1') ->> 'recorded'),
  'false', 'the same run twice is the same decision, both answers included');

-- The domestic network closed for the afternoon, so the whole need becomes a
-- residual and the global question is asked for real.
set local role postgres;
update capital_instruments set active = false where is_domestic;
select pg_temp.act_as('00000000-0000-0000-0000-0000000010a2');

select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000010f1') ->> 'recorded'),
  'true', 'a network that moved records a new decision');

set local role postgres;

select is(
  (select global_eligibility ->> 'decision' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 2),
  'eligible', 'a real gap, with the papers and the history behind it, may go abroad');

select is(
  (select eligible_gap_cents from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 2),
  500000::bigint, 'and the eligible external capital gap is the whole of what she asked for');

select ok(
  (select (global_eligibility -> 'economics' ->> 'total_cost_bps')::integer
     < (global_eligibility -> 'economics' ->> 'route_cost_bps')::integer
       + (global_eligibility -> 'economics' ->> 'mobilization_annual_bps')::integer
   from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 2),
  'the quote replaces the modelled ramp in her rate and is never added to it');

select ok(
  (select (global_eligibility -> 'economics' ->> 'quoted_mobilization_bps')::integer > 0
   from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 2),
  'the cost of moving the money is quoted by the comparator, not assumed here');

-- The evidence moved, the network did not. A run whose global answer changed is
-- a new decision: the whole reason both enter the idempotency test.
update readiness_assessments
  set components = jsonb_set(components, '{data_quality}', '4'::jsonb)
  where id = '00000000-0000-0000-0000-0000000010d1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000010a2');

select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000010f1') ->> 'recorded'),
  'true', 'evidence that moved records a new decision even where the plan did not move');

set local role postgres;

select is(
  (select global_eligibility ->> 'decision' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 3),
  'refused', 'thin evidence refuses the gap for global funding');

select ok(
  (select global_eligibility -> 'reason_codes' @> '["GLOBAL_EVIDENCE_INSUFFICIENT"]'::jsonb
   from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 3),
  'and says which of the six gates refused it');

select is(
  (select eligible_gap_cents from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 3),
  0::bigint, 'a refused gap is no part of the eligible external capital gap');

-- §17's criterion, end to end: domestic coverage is zero and the gap is still
-- refused for global funding. Insufficient local capacity is not an argument.
select is(
  (select domestic_coverage_cents from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 3),
  0::bigint, 'with domestic coverage at nothing, and the refusal standing anyway');

select is(
  (select count(*)::int from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000010f1'),
  3, 'three decisions, none of them overwriting the last');

-- ------------------------------------------------ where the people it concerns read it

select pg_temp.act_as('00000000-0000-0000-0000-0000000010a1');

select is(
  (public.capital_plan('00000000-0000-0000-0000-0000000010f1') -> 'global_eligibility' ->> 'decision'),
  'refused', 'she reads the answer about her own gap, in her own plan');

select ok(
  (public.capital_plan('00000000-0000-0000-0000-0000000010f1') -> 'global_eligibility' -> 'gates')
    @> '[{"gate": "evidence"}]'::jsonb,
  'with every question it was put to, both sides of each');

-- A decision recorded before the question existed says nothing about it, and a
-- screen has to read that as "not asked" rather than as "refused".
set local role postgres;
update capital_route_decisions set global_eligibility = '{}'::jsonb
  where opportunity_id = '00000000-0000-0000-0000-0000000010f1' and decision_no = 3;
select pg_temp.act_as('00000000-0000-0000-0000-0000000010a1');

select is(
  (public.capital_plan('00000000-0000-0000-0000-0000000010f1') -> 'global_eligibility'),
  'null'::jsonb, 'a decision made before the question existed carries no answer to it');

-- --------------------------------------------------------------- who may ask

select pg_temp.act_as('00000000-0000-0000-0000-0000000010a1');

select throws_ok(
  $$ select private.global_eligibility('{"gap_cents": 1, "term_months": 12}'::jsonb) $$,
  '42501', null, 'the engine itself is the database''s own, not hers to call');

select throws_ok(
  $$ select private.global_gap_context('00000000-0000-0000-0000-0000000010f1', '{}'::jsonb, '[]'::jsonb, now()) $$,
  '42501', null, 'nor is the assembly of the question');

select finish();
rollback;
