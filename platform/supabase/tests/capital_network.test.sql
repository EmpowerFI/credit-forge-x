-- The Capital Network: the registry's shape, the guardrails written into it,
-- and who may read what.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(82);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'cn-admin@test'),
  ('00000000-0000-0000-0000-0000000009a2', 'cn-rita@test'),
  ('00000000-0000-0000-0000-0000000009a3', 'cn-operator@test');
-- A profile row follows each auth user; the test only sets its role.
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000009a1';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000009a2';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000009a3';

-- ------------------------------------------------------------- the seed itself

select is(
  (select count(*)::int from capital_providers where is_simulated),
  5, 'five demo providers ship with the migrations, all simulated');

select is(
  (select count(*)::int from capital_providers where not is_simulated),
  0, 'no provider is presented as real');

select is(
  (select count(*)::int from capital_instruments),
  6, 'six instruments: three partner routes, the two P2P pools and the impact fund''s capital');

select is(
  (select count(distinct instrument_type)::int from capital_instruments),
  6, 'six distinct instrument types without a code change');

-- The guardrail of addendum §12, as data.
select is(
  (select is_credit from capital_instruments where code = 'troca_produtiva_rede'),
  false, 'the productive exchange route is not credit');

select is(
  (select currency from capital_instruments where code = 'troca_produtiva_rede'),
  'unit', 'and its unit of account is not money');

select is(
  (select bool_and(requires_partner_approval) from capital_instruments where pool is null),
  true, 'every partner route still requires that partner to say yes');

select is(
  (select bool_and(not requires_partner_approval) from capital_instruments where pool is not null),
  true, 'the P2P pools are the only routes EmpowerFI itself can close');

-- ------------------------------------------------------ policy lives in one place

select is(
  (select count(*)::int from capital_instruments where pool is not null and (ticket_min_cents is not null or capacity_cents is not null)),
  0, 'a pool-backed instrument copies no policy out of funding_pools');

select throws_ok($$
  insert into capital_instruments (provider_id, code, name, instrument_type, pool, ticket_min_cents, ticket_max_cents, capacity_cents)
  select id, 'bad_pool_copy', 'Copies pool policy', 'domestic_p2p', 'domestic', 10000, 500000, 100000
  from capital_providers where code = 'empowerfi_pools'
$$, '23514', null, 'a pool-backed instrument may not restate the pool ticket range');

select throws_ok($$
  insert into capital_instruments (provider_id, code, name, instrument_type, pool)
  select id, 'bad_pool_kind', 'Not a pool route', 'microcredit', 'domestic'
  from capital_providers where code = 'empowerfi_pools'
$$, '23514', null, 'only the two P2P types may point at a funding pool');

select throws_ok($$
  insert into capital_instruments (provider_id, code, name, instrument_type)
  select id, 'bad_no_policy', 'States no policy', 'microcredit'
  from capital_providers where code = 'microcredito_demo'
$$, '23514', null, 'an instrument that is not a pool must state its own ticket range and capacity');

select throws_ok($$
  insert into capital_instruments (provider_id, code, name, instrument_type, ticket_min_cents, ticket_max_cents, capacity_cents, is_domestic, is_global)
  select id, 'bad_both_sides', 'Domestic and global at once', 'microcredit', 10000, 500000, 100000, true, true
  from capital_providers where code = 'microcredito_demo'
$$, '23514', null, 'an instrument is domestic or global, never both');

-- ------------------------------------------------------------- the decision row

insert into entrepreneurs (id, profile_id, display_name, city, state)
values ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009a2', 'CN Rita', 'Campinas', 'SP');
insert into credit_intents (id, entrepreneur_id, purpose, requested_amount_cents)
values ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009e1', 'inventory', 500000);
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features)
values ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009e1', 1, 'test',
  private.current_period(), 'CREDIT_READY', 'HIGH', 70, '{}'::jsonb, '{}', '{}', '{}'::jsonb);
insert into eligibility_assessments (id, entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version,
  decision, requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
  risk_band, risk_points, confidence, reason_codes, inputs)
values ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009c1',
  '00000000-0000-0000-0000-0000000009d1', 1, 'test', 'ELIGIBLE', 500000, 500000, 12, 50000, 60000,
  'LOW', 10, 'HIGH', '{}', '{}'::jsonb);
insert into qualified_credit_opportunities (id, entrepreneur_id, intent_id, eligibility_id, opportunity_no,
  amount_cents, term_months, instalment_cents, purpose, risk_band, confidence, status, desired_date, urgency)
values ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009c1',
  '00000000-0000-0000-0000-0000000009b1', 1, 500000, 12, 50000, 'inventory', 'LOW', 'HIGH', 'in_review',
  current_date + 30, 'soon');

select is(
  (select urgency from qualified_credit_opportunities where id = '00000000-0000-0000-0000-0000000009f1'),
  'soon', 'the opportunity carries the two capital-need fields it lacked');

select lives_ok($$
  insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents,
    evaluated, allocations, reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status)
  values ('00000000-0000-0000-0000-0000000009f1', 1, 'capital-network-v1.0.0', 500000,
    '[]'::jsonb, '[{"instrument": "microcredito_produtivo", "amount_cents": 300000}]'::jsonb,
    '{DOMESTIC_CAPACITY_PARTIAL}', 300000, 120000, 80000, 'recommended')
$$, 'a partial plan, a global top-up and a residue are recordable together');

select is(
  (select external_capital_gap_cents from capital_route_decisions where opportunity_id = '00000000-0000-0000-0000-0000000009f1'),
  200000::bigint, 'the external capital gap measures what domestic could not absorb, global top-up included');

select throws_ok($$
  insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents,
    evaluated, allocations, reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status)
  values ('00000000-0000-0000-0000-0000000009f1', 2, 'capital-network-v1.0.0', 500000,
    '[]'::jsonb, '[]'::jsonb, '{}', 300000, 100000, 50000, 'no_route')
$$, '23514', null, 'the three coverage numbers must account for every centavo she asked for');

select throws_ok($$
  insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents,
    evaluated, allocations, reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status)
  values ('00000000-0000-0000-0000-0000000009f1', 3, 'capital-network-v1.0.0', 500000,
    '[]'::jsonb, '[]'::jsonb, '{}', 0, 0, 500000, 'recommended')
$$, '23514', null, 'a recommendation with no route is not a recommendation');

-- ---------------------------------------------------------------------- RLS

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');
select is(
  (select count(*)::int from capital_instruments),
  0, 'an entrepreneur cannot read the capital policies of the whole network');
select is(
  (select count(*)::int from capital_route_decisions),
  1, 'but she reads the plan recommended for her');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');
select is(
  (select count(*)::int from capital_instruments),
  6, 'a capital operator reads the registry');
select is(
  (select count(*)::int from capital_providers),
  5, 'and the providers behind it');

set local role postgres;
select is(
  (select private.capital_network_model_version()),
  'capital-network-v1.0.0', 'the engine version is stated where the audit console can find it');

-- ------------------------------------------------------------------ the vectors
-- Generated by scripts/regenerate-network-vectors.mts from
-- packages/capital-allocation/vectors/network.json. Do not edit by hand: the
-- package's own tests hold the TypeScript engine to the same expectations, so
-- the browser and the database give one answer about a capital plan.

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_COVERAGE_SUFFICIENT","PURPOSE_MATCH","CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST"],"allocations":[{"instrument_id":"credito_regional_capital_giro","amount_cents":437837,"fit_score":8490,"reasons":["PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE"],"requires_partner_approval":true,"is_credit":true},{"instrument_id":"troca_produtiva_rede","amount_cents":62163,"fit_score":8400,"reasons":["CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST"],"requires_partner_approval":true,"is_credit":false}],"domestic_coverage_cents":500000,"global_coverage_cents":0,"unfunded_cents":0,"external_capital_gap_cents":0,"eligible":["credito_regional_capital_giro","microcredito_produtivo","troca_produtiva_rede","pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":8490,"microcredito_produtivo":7740,"troca_produtiva_rede":8400,"pool_domestico_p2p":7650,"pool_global_impacto":9300}}'::jsonb,
  'vector: Rita''s R$5,000 for stock: a regional product for the bulk, the exchange network for the tail'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":150000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":0,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_CAPACITY_PARTIAL","PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH","EXTERNAL_GAP_EXISTS","GLOBAL_ADDITIONALITY","PARTNER_CAPACITY_EXHAUSTED"],"allocations":[{"instrument_id":"credito_regional_capital_giro","amount_cents":150000,"fit_score":6300,"reasons":["PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST"],"requires_partner_approval":true,"is_credit":true},{"instrument_id":"pool_global_impacto","amount_cents":350000,"fit_score":9300,"reasons":["PURPOSE_MATCH","TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH"],"requires_partner_approval":false,"is_credit":true}],"domestic_coverage_cents":150000,"global_coverage_cents":350000,"unfunded_cents":0,"external_capital_gap_cents":350000,"eligible":["credito_regional_capital_giro","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":6300,"microcredito_produtivo":0,"troca_produtiva_rede":0,"pool_domestico_p2p":0,"pool_global_impacto":9300}}'::jsonb,
  'vector: when local capacity runs dry, the gap is what global capital answers'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":5000,"term_months":6,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"no_route","reason_codes":["DOMESTIC_POOL_EXHAUSTED","EXTERNAL_GAP_EXISTS","TICKET_OUTSIDE_POOL_POLICY","NO_ROUTE_AVAILABLE"],"allocations":[],"domestic_coverage_cents":0,"global_coverage_cents":0,"unfunded_cents":5000,"external_capital_gap_cents":5000,"eligible":[],"fit_scores":{"credito_regional_capital_giro":0,"microcredito_produtivo":0,"troca_produtiva_rede":0,"pool_domestico_p2p":0,"pool_global_impacto":0}}'::jsonb,
  'vector: a need under every route''s floor is qualified demand nothing in the network can take'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":false,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"manual_review","reason_codes":["MANUAL_REVIEW_REQUIRED"],"allocations":[],"domestic_coverage_cents":0,"global_coverage_cents":0,"unfunded_cents":500000,"external_capital_gap_cents":500000,"eligible":["credito_regional_capital_giro","microcredito_produtivo","troca_produtiva_rede","pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":8490,"microcredito_produtivo":7740,"troca_produtiva_rede":8400,"pool_domestico_p2p":7650,"pool_global_impacto":9300}}'::jsonb,
  'vector: a need that never passed eligibility gets a review, not a recommendation'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":300000,"term_months":12,"purpose":"inventory","uf":"BA","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_COVERAGE_SUFFICIENT","TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","REGION_NOT_ELIGIBLE"],"allocations":[{"instrument_id":"pool_domestico_p2p","amount_cents":300000,"fit_score":8050,"reasons":["TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH"],"requires_partner_approval":false,"is_credit":true}],"domestic_coverage_cents":300000,"global_coverage_cents":0,"unfunded_cents":0,"external_capital_gap_cents":0,"eligible":["pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":0,"microcredito_produtivo":0,"troca_produtiva_rede":0,"pool_domestico_p2p":8050,"pool_global_impacto":9300}}'::jsonb,
  'vector: in a state no partner serves, the P2P pools are the network''s backstop'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":150000,"term_months":6,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["network_membership"],"max_instalment_cents":20000,"impact_eligible":false,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_COVERAGE_SUFFICIENT","CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","AFFORDABILITY_LIMIT","INSUFFICIENT_DOCUMENTATION"],"allocations":[{"instrument_id":"troca_produtiva_rede","amount_cents":150000,"fit_score":9600,"reasons":["CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST"],"requires_partner_approval":true,"is_credit":false}],"domestic_coverage_cents":150000,"global_coverage_cents":0,"unfunded_cents":0,"external_capital_gap_cents":0,"eligible":["troca_produtiva_rede","pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":0,"microcredito_produtivo":0,"troca_produtiva_rede":9600,"pool_domestico_p2p":7470,"pool_global_impacto":8470}}'::jsonb,
  'vector: with only her network membership on file, the one route left is not credit at all'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":200000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":0,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"},{"id":"capital_impacto_global","provider":"fundo_impacto_global_demo","name":"Fundo de impacto internacional · capital próprio","type":"impact_fund_capital","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":5000000,"eligible_uf":[],"purposes":[],"term_min_months":6,"term_max_months":36,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":5000,"estimated_cost_bps":3600,"capacity_cents":2000000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_CAPACITY_PARTIAL","PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH","EXTERNAL_GAP_EXISTS","GLOBAL_ADDITIONALITY","PARTNER_CAPACITY_EXHAUSTED"],"allocations":[{"instrument_id":"credito_regional_capital_giro","amount_cents":200000,"fit_score":6650,"reasons":["PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST"],"requires_partner_approval":true,"is_credit":true},{"instrument_id":"capital_impacto_global","amount_cents":300000,"fit_score":7480,"reasons":["TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH"],"requires_partner_approval":true,"is_credit":true}],"domestic_coverage_cents":200000,"global_coverage_cents":300000,"unfunded_cents":0,"external_capital_gap_cents":300000,"eligible":["credito_regional_capital_giro","capital_impacto_global"],"fit_scores":{"credito_regional_capital_giro":6650,"troca_produtiva_rede":0,"pool_global_impacto":0,"capital_impacto_global":7480}}'::jsonb,
  'vector: the fund''s capital takes the residual when the pool''s has run out'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":3,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"capital_impacto_global","provider":"fundo_impacto_global_demo","name":"Fundo de impacto internacional · capital próprio","type":"impact_fund_capital","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":5000000,"eligible_uf":[],"purposes":[],"term_min_months":6,"term_max_months":36,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":5000,"estimated_cost_bps":3600,"capacity_cents":2000000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"no_route","reason_codes":["DOMESTIC_POOL_EXHAUSTED","EXTERNAL_GAP_EXISTS","TERM_OUTSIDE_POLICY","PARTNER_CAPACITY_EXHAUSTED","NO_ROUTE_AVAILABLE"],"allocations":[],"domestic_coverage_cents":0,"global_coverage_cents":0,"unfunded_cents":500000,"external_capital_gap_cents":500000,"eligible":[],"fit_scores":{"credito_regional_capital_giro":0,"capital_impacto_global":0}}'::jsonb,
  'vector: a fund that funds six months does not fund three, and says so'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":1500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":24,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":150000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_CAPACITY_PARTIAL","PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","AFFORDABILITY_BUDGET_SHARED","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH","EXTERNAL_GAP_EXISTS","GLOBAL_ADDITIONALITY"],"allocations":[{"instrument_id":"credito_regional_capital_giro","amount_cents":729729,"fit_score":7710,"reasons":["PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE"],"requires_partner_approval":true,"is_credit":true},{"instrument_id":"pool_domestico_p2p","amount_cents":400000,"fit_score":6570,"reasons":["TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH"],"requires_partner_approval":false,"is_credit":true},{"instrument_id":"pool_global_impacto","amount_cents":177154,"fit_score":8620,"reasons":["PURPOSE_MATCH","TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","AFFORDABILITY_BUDGET_SHARED","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH"],"requires_partner_approval":false,"is_credit":true}],"domestic_coverage_cents":1129729,"global_coverage_cents":177154,"unfunded_cents":193117,"external_capital_gap_cents":370271,"eligible":["credito_regional_capital_giro","pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":7710,"pool_domestico_p2p":6570,"pool_global_impacto":8620}}'::jsonb,
  'vector: three routes that each fit alone are sized so the plan fits too'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":300000,"term_months":12,"purpose":"inventory","uf":"BA","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":false}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":4000000,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":1500000,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":600000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":2700000,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_COVERAGE_SUFFICIENT","TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","REGION_NOT_ELIGIBLE","LOCAL_RAIL_UNAVAILABLE"],"allocations":[{"instrument_id":"pool_domestico_p2p","amount_cents":300000,"fit_score":8050,"reasons":["TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_UNAVAILABLE"],"requires_partner_approval":false,"is_credit":true}],"domestic_coverage_cents":300000,"global_coverage_cents":0,"unfunded_cents":0,"external_capital_gap_cents":0,"eligible":["pool_domestico_p2p","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":0,"microcredito_produtivo":0,"troca_produtiva_rede":0,"pool_domestico_p2p":8050,"pool_global_impacto":9300}}'::jsonb,
  'vector: a territory with no local rail is still funded, in reais, and the plan says which'
);

select is(
  (select jsonb_build_object(
     'status', p -> 'status', 'reason_codes', p -> 'reason_codes', 'allocations', p -> 'allocations',
     'domestic_coverage_cents', p -> 'domestic_coverage_cents', 'global_coverage_cents', p -> 'global_coverage_cents',
     'unfunded_cents', p -> 'unfunded_cents', 'external_capital_gap_cents', p -> 'external_capital_gap_cents',
     'eligible', coalesce((select jsonb_agg(e -> 'instrument_id') from jsonb_array_elements(p -> 'evaluated') as t(e)
                           where (e ->> 'eligible')::boolean), '[]'::jsonb),
     'fit_scores', (select jsonb_object_agg(e ->> 'instrument_id', e -> 'fit_score')
                    from jsonb_array_elements(p -> 'evaluated') as t(e)))
   from (select private.match_capital(
     '{"amount_cents":500000,"term_months":12,"purpose":"inventory","uf":"SP","business_age_months":18,"documents":["cnpj_or_mei","bank_statement_3m","cpf","proof_of_activity","network_membership"],"max_instalment_cents":90000,"impact_eligible":true,"readiness_ok":true,"manual_review_allowed":false,"supplier_geography":"municipality","local_rail_available":true}'::jsonb,
     '[{"id":"credito_regional_capital_giro","provider":"coop_regional_demo","name":"Crédito produtivo regional · capital de giro","type":"regional_credit_product","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":100000,"ticket_max_cents":1500000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":6,"required_documents":["cnpj_or_mei","bank_statement_3m"],"max_instalment_share_bps":6000,"estimated_cost_bps":4800,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"regional","settlement_rail":"brl_pix"},{"id":"microcredito_produtivo","provider":"microcredito_demo","name":"Microcrédito produtivo orientado","type":"microcredit","is_credit":true,"requires_partner_approval":true,"ticket_min_cents":50000,"ticket_max_cents":500000,"eligible_uf":["SP","MG"],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["cpf","proof_of_activity"],"max_instalment_share_bps":4000,"estimated_cost_bps":6600,"capacity_cents":0,"impact_mandate":true,"is_domestic":true,"capital_scope":"national","settlement_rail":"brl_pix"},{"id":"troca_produtiva_rede","provider":"rede_troca_demo","name":"Troca produtiva em rede","type":"productive_exchange_network","is_credit":false,"requires_partner_approval":true,"ticket_min_cents":10000,"ticket_max_cents":200000,"eligible_uf":["SP"],"purposes":["working_capital","inventory"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":["network_membership"],"max_instalment_share_bps":null,"estimated_cost_bps":null,"capacity_cents":150000,"impact_mandate":false,"is_domestic":true,"capital_scope":"territorial","settlement_rail":"partner_card"},{"id":"pool_domestico_p2p","provider":"empowerfi_pools","name":"Pool doméstico P2P · investidores brasileiros","type":"domestic_p2p","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":50000,"ticket_max_cents":400000,"eligible_uf":[],"purposes":[],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2500,"capacity_cents":0,"impact_mandate":false,"is_domestic":true,"capital_scope":"national","settlement_rail":"local_currency"},{"id":"pool_global_impacto","provider":"empowerfi_pools","name":"Pool global P2P · investidores no exterior","type":"global_impact_capital","is_credit":true,"requires_partner_approval":false,"ticket_min_cents":100000,"ticket_max_cents":1000000,"eligible_uf":[],"purposes":["working_capital","inventory","equipment"],"term_min_months":null,"term_max_months":null,"business_age_min_months":0,"required_documents":[],"max_instalment_share_bps":10000,"estimated_cost_bps":2400,"capacity_cents":9000000,"impact_mandate":true,"is_domestic":false,"capital_scope":"global","settlement_rail":"local_currency"}]'::jsonb) as p) q),
  '{"status":"recommended","reason_codes":["DOMESTIC_CAPACITY_PARTIAL","PURPOSE_MATCH","CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH","TERRITORIAL_CAPACITY_PARTIAL","EXTERNAL_GAP_EXISTS","GLOBAL_ADDITIONALITY","PARTNER_CAPACITY_EXHAUSTED"],"allocations":[{"instrument_id":"troca_produtiva_rede","amount_cents":150000,"fit_score":7150,"reasons":["CLOSED_NETWORK_PURPOSE_MATCH","TICKET_MATCH","REGION_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","TERRITORIAL_CAPACITY_PARTIAL"],"requires_partner_approval":true,"is_credit":false},{"instrument_id":"pool_global_impacto","amount_cents":350000,"fit_score":9300,"reasons":["PURPOSE_MATCH","TICKET_MATCH","PARTNER_CAPACITY_AVAILABLE","LOWER_ESTIMATED_COST","LOCAL_RAIL_ELIGIBLE","LOCAL_SUPPLIER_MATCH","GLOBAL_EXPANDS_CAPACITY","GLOBAL_IMPACT_MANDATE_MATCH"],"requires_partner_approval":false,"is_credit":true}],"domestic_coverage_cents":150000,"global_coverage_cents":350000,"unfunded_cents":0,"external_capital_gap_cents":350000,"eligible":["troca_produtiva_rede","pool_global_impacto"],"fit_scores":{"credito_regional_capital_giro":0,"microcredito_produtivo":0,"troca_produtiva_rede":7150,"pool_domestico_p2p":0,"pool_global_impacto":9300}}'::jsonb,
  'vector: a route inside the territory gives everything it has, and that is a different shortfall'
);

-- ------------------------------------------------------------- the engine's run

-- She agreed to a partner being involved. Without that scope the engine refuses
-- to look at third-party products at all.
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
values ('00000000-0000-0000-0000-0000000009e1', 1, 'test', true, true, false, false, 'app');

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');
select throws_ok(
  $$ select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1') $$,
  '42501', null, 'routing capital is an operator act, not something she runs on herself');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a1');

select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1',
     array['cpf', 'proof_of_activity', 'network_membership']) ->> 'recorded'),
  'true', 'an admin runs the engine and the run is recorded');

select is(
  (select max(decision_no) from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1'),
  2, 'as the next decision for that opportunity, never overwriting the last');

-- The business-age proxy, and what it costs her: with no check-ins on file there
-- is no reported history, so the regional product's six-month minimum blocks it.
select is(
  (select need -> 'business_age_months' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 2),
  '0'::jsonb, 'the decision records the need it ran against, history proxy included');

select ok(
  (select 'BUSINESS_TOO_YOUNG' = any(reason_codes) from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 2),
  'and says which gate that proxy closed');

-- A route she can reach: the exchange network asked only for her membership.
select ok(
  (select exists (select 1 from jsonb_array_elements(allocations) as t(a)
                  where a ->> 'instrument_id' = 'troca_produtiva_rede')
   from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 2),
  'the exchange network is in the stack, on the one document she has');

select is(
  (select bool_and(not (a ->> 'is_credit')::boolean)
   from capital_route_decisions d, jsonb_array_elements(d.allocations) as t(a)
   where d.opportunity_id = '00000000-0000-0000-0000-0000000009f1' and d.decision_no = 2
     and a ->> 'instrument_id' = 'troca_produtiva_rede'),
  true, 'and it is carried as what it is: not credit');

-- Idempotent: the same engine, the same need, the same answer, no second row.
select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1') ->> 'recorded'),
  'false', 'running it again on an unchanged need records nothing');

select is(
  (select count(*)::int from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1'),
  2, 'so the decision history stays as long as the number of real answers');

-- Something moved: she found her papers.
select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1',
     array['cpf', 'proof_of_activity', 'network_membership', 'cnpj_or_mei', 'bank_statement_3m']) ->> 'recorded'),
  'true', 'a changed need is a new decision');

select is(
  (select need -> 'documents' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 3),
  '["cpf", "proof_of_activity", "network_membership", "cnpj_or_mei", "bank_statement_3m"]'::jsonb,
  'with what she stated on file, kept rather than floated');

-- The pools' policy is read, never copied: the domestic route's ticket range in
-- the engine's input is funding_pools', to the centavo. Read as postgres, since
-- an operator has no business selecting the pool table directly.
set local role postgres;
select is(
  (select i -> 'ticket_max_cents'
   from jsonb_array_elements(private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) as t(i)
   where i ->> 'id' = 'pool_domestico_p2p'),
  to_jsonb((select max_ticket_cents from funding_pools where pool = 'domestic')),
  'a pool-backed instrument takes its ticket ceiling from funding_pools');

-- A pool is a route only where the allocation engine put this request. Offering
-- the other one is not generosity: an opportunity raising in USDC cannot be
-- funded by the domestic pool, however much liquidity that pool is holding.
select is(
  (select count(*)::int
   from jsonb_array_elements(private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) as t(i)
   where i ->> 'id' in ('pool_domestico_p2p', 'pool_global_impacto')),
  2, 'a request no pool has taken still sees both pools: which one could take it is the question');

update qualified_credit_opportunities set funding_pool = 'global'
  where id = '00000000-0000-0000-0000-0000000009f1';

select is(
  (select array_agg(i ->> 'id' order by i ->> 'id')
   from jsonb_array_elements(private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) as t(i)
   where i ->> 'id' in ('pool_domestico_p2p', 'pool_global_impacto')),
  array['pool_global_impacto'],
  'listed on the global pool, the domestic pool stops being a route for it');

select is(
  (select count(*)::int
   from jsonb_array_elements(private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) as t(i)
   where i ->> 'id' not in ('pool_domestico_p2p', 'pool_global_impacto')),
  4, 'and every route that is not a pool is offered exactly as before');

update qualified_credit_opportunities set funding_pool = 'domestic'
  where id = '00000000-0000-0000-0000-0000000009f1';

select is(
  (select array_agg(i ->> 'id' order by i ->> 'id')
   from jsonb_array_elements(private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) as t(i)
   where i ->> 'id' in ('pool_domestico_p2p', 'pool_global_impacto')),
  array['pool_domestico_p2p'],
  'and the same holds the other way round');

update qualified_credit_opportunities set funding_pool = null
  where id = '00000000-0000-0000-0000-0000000009f1';

select is(
  (select jsonb_typeof(private.capital_fit_weights())),
  'object', 'the fit weights are named terms, not a positional list');

select is(
  (select sum(value::integer)::integer from jsonb_each_text(private.capital_fit_weights())),
  10000, 'and they sum to one, as the TypeScript engine asserts of its own');

-- Consent is load-bearing: withdraw the partner scope and the engine stops.
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
values ('00000000-0000-0000-0000-0000000009e1', 2, 'test', true, false, false, false, 'app');

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a1');
select throws_ok(
  $$ select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1') $$,
  '42501', null, 'with the partner scope withdrawn, no third-party route may be recommended');

-- ------------------------------------------------------- who may edit a policy

-- Commercial terms an operator owns, and the kind of thing a route is, which a
-- migration owns. The line between them is the guardrail of addendum §12.

set local role postgres;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a4', 'cn-auditor@test');
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000009a4';
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');

select lives_ok($$
  update capital_instruments set capacity_cents = 5000000 where code = 'credito_regional_capital_giro'
$$, 'an operator moves a partner route''s capacity');

select is(
  (select policy_version from capital_instruments where code = 'credito_regional_capital_giro'),
  2, 'and the policy version moves with it, so a stored decision can be read against the policy that made it');

-- A name is not a policy. An operator cannot change one at all, and a migration
-- that fixes a label should not age every decision recorded under the terms that
-- did not move.
set local role postgres;
update capital_instruments set name = 'Crédito produtivo regional · capital de giro (2026)'
  where code = 'credito_regional_capital_giro';
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');

select is(
  (select policy_version from capital_instruments where code = 'credito_regional_capital_giro'),
  2, 'but renaming a route does not: what it is called was never part of its terms');

select throws_ok($$
  update capital_instruments set is_credit = true where code = 'troca_produtiva_rede'
$$, '42501', null, 'a route that must never be called credit cannot be turned into credit from a screen');

select throws_ok($$
  update capital_instruments set name = 'Crédito rápido' where code = 'troca_produtiva_rede'
$$, '42501', null, 'nor reworded into one: the name she reads is not an operator''s field');

select throws_ok($$
  update capital_instruments set max_instalment_share_bps = null where code = 'microcredito_produtivo'
$$, '23514', null, 'a credit route may not drop the share of her instalment it is allowed to take');

select throws_ok($$
  update capital_instruments set active = false where code = 'pool_domestico_p2p'
$$, '42501', null, 'a P2P route is closed in funding_pools, not here, or the network would hide what still funds');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a4');
-- No error: row-level security simply leaves the row alone.
update capital_instruments set capacity_cents = 1 where code = 'microcredito_produtivo';
select is(
  (select capacity_cents from capital_instruments where code = 'microcredito_produtivo'),
  1500000::bigint, 'an auditor reads every policy in the network and sets none');

-- The P2P desk is the role that routes capital day to day, and the engine knows
-- it by name rather than by a list repeated in every screen.
set local role postgres;
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, is_simulated)
values ('00000000-0000-0000-0000-0000000009ab', 'Mesa P2P (teste)', 'fintech', 10000, 2000000, true);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a5', 'cn-desk@test');
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000009ab'
  where id = '00000000-0000-0000-0000-0000000009a5';
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
select ok(
  (select private.is_capital_operator()),
  'the EmpowerFI P2P desk is a capital operator');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');
select ok(
  not (select private.is_capital_operator()),
  'and an entrepreneur is not');

set local role postgres;
-- --------------------------------------------------- the plan, where she reads it

-- She agrees to a partner again, after the withdrawal above.
set local role postgres;
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
values ('00000000-0000-0000-0000-0000000009e1', 3, 'test', true, true, false, false, 'app');
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a1');

-- The operator moved a policy a few assertions ago, so the same answer under a
-- moved policy is a new decision: "re-confirmed under policy 2" is a different
-- fact from "decided under policy 1".
select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1') ->> 'recorded'),
  'true', 'a policy that moved records a new decision, even reaching the same answer');

select is(
  (select instrument_policy -> 'credito_regional_capital_giro' from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 4),
  '2'::jsonb, 'and the decision records which version of each policy it ran under');

select is(
  (select public.run_capital_engine('00000000-0000-0000-0000-0000000009f1') ->> 'recorded'),
  'false', 'while an unchanged policy and an unchanged need still record nothing');

-- She may not read capital_instruments — the registry is every provider's
-- policy — so the plan resolves the routes it names, and only those.
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');

select is(
  (select jsonb_array_length(public.capital_plan('00000000-0000-0000-0000-0000000009f1') -> 'instruments')),
  6, 'she reads the names of the routes her own plan evaluated');

select is(
  (select count(*)::int from capital_instruments),
  0, 'without the registry those names live in');

select is(
  (select public.capital_plan('00000000-0000-0000-0000-0000000009f1') -> 'plan' ->> 'requested_cents'),
  '500000', 'and the plan itself, in the engine''s own shape');

-- An account with no entrepreneur behind it is nobody this plan concerns.
set local role postgres;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a6', 'cn-stranger@test');
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000009a6';
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a6');
select throws_ok(
  $$ select public.capital_plan('00000000-0000-0000-0000-0000000009f1') $$,
  '42501', null, 'and nobody else reads a plan that is not theirs');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a1');
select is(
  (select public.capital_plan(gen_random_uuid())),
  null, 'an opportunity the engine never ran over has no plan, and that is not an error');

-- What a plan would commit to, if a program instruction existed to accept it.
set local role postgres;
select is(
  (select private.capital_route_payload(d.id) ->> 'external_capital_gap_cents'
   from capital_route_decisions d
   where d.opportunity_id = '00000000-0000-0000-0000-0000000009f1' and d.decision_no = 4),
  (select external_capital_gap_cents::text from capital_route_decisions
   where opportunity_id = '00000000-0000-0000-0000-0000000009f1' and decision_no = 4),
  'the anchor payload commits to the gap the decision recorded');

select ok(
  (select private.capital_route_payload(d.id) ? 'instrument_policy'
   from capital_route_decisions d
   where d.opportunity_id = '00000000-0000-0000-0000-0000000009f1' and d.decision_no = 4),
  'and to the policy versions that reproduce its trace');

-- Gate 1 reads the same decisions the credit engine qualifies on: an amount
-- reduced to what the business can repay is a qualified opportunity, not a
-- request for someone to look at.
set local role postgres;
update eligibility_assessments set decision = 'ELIGIBLE_REDUCED'
  where id = '00000000-0000-0000-0000-0000000009b1';
select is(
  (select private.capital_need('00000000-0000-0000-0000-0000000009f1') -> 'readiness_ok'),
  'true'::jsonb, 'a smaller amount than she asked for still passes gate 1');

update eligibility_assessments set decision = 'MANUAL_REVIEW'
  where id = '00000000-0000-0000-0000-0000000009b1';
select is(
  (select private.capital_need('00000000-0000-0000-0000-0000000009f1') -> 'readiness_ok'),
  'false'::jsonb, 'while a request a person is still looking at does not');

select is(
  (select private.match_capital(
     private.capital_need('00000000-0000-0000-0000-0000000009f1'),
     private.capital_network_instruments('00000000-0000-0000-0000-0000000009f1')) ->> 'status'),
  'manual_review', 'and gets a review rather than route cards it has not earned');

update eligibility_assessments set decision = 'ELIGIBLE'
  where id = '00000000-0000-0000-0000-0000000009b1';

-- ------------------------------------------- where the capital came from

-- The book, divided by source. It is the only place the thesis of this page is
-- checkable: that domestic capital has several sources rather than one pool,
-- and that the two routes from abroad are not the same kind of money.

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');
select throws_ok(
  $$ select public.capital_network_origin() $$,
  '42501', null, 'the whole network''s book is not an entrepreneur''s to read');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');

select is(
  (select (public.capital_network_origin() ->> 'plans')::int),
  (select count(distinct opportunity_id)::int from capital_route_decisions),
  'one plan per request, however many times the engine ran over it');

select is(
  (select (public.capital_network_origin() ->> 'routed_cents')::bigint),
  (select (public.capital_network_origin() ->> 'domestic_cents')::bigint
        + (public.capital_network_origin() ->> 'global_cents')::bigint),
  'every centavo the network routed is on one side of the border or the other');

select is(
  (select sum((s ->> 'routed_cents')::bigint)::bigint
   from jsonb_array_elements(public.capital_network_origin() -> 'sources') as t(s)),
  (select (public.capital_network_origin() ->> 'routed_cents')::bigint),
  'and the sources account for all of it');

-- Capacity does not mean one thing. A partner states what it has, and nothing
-- draws that down when a plan names it; a pool's is arithmetic on its own book.
-- Presenting the two as one number is the mistake this field exists to prevent.
select is(
  (select array_agg(s ->> 'code' order by s ->> 'code')
   from jsonb_array_elements(public.capital_network_origin() -> 'sources') as t(s)
   where s ->> 'capacity_basis' = 'pool_residue'),
  array['pool_domestico_p2p', 'pool_global_impacto'],
  'only the two pool routes report a residue; every partner route reports a declaration');

select is(
  (select count(*)::int
   from jsonb_array_elements(public.capital_network_origin() -> 'sources') as t(s)
   where not (s ->> 'is_domestic')::boolean),
  2, 'and capital from abroad arrives as two routes, not one');

set local role postgres;

select * from finish();
rollback;
