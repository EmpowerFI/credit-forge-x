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

select plan(22);

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
  4, 'four demo providers ship with the migration, all simulated');

select is(
  (select count(*)::int from capital_providers where not is_simulated),
  0, 'no provider is presented as real');

select is(
  (select count(*)::int from capital_instruments),
  5, 'five instruments: three partner routes and the two P2P pools');

select is(
  (select count(distinct instrument_type)::int from capital_instruments),
  5, 'five distinct instrument types without a code change');

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
    evaluated, allocations, reason_codes, covered_cents, domestic_coverage_cents, external_capital_gap_cents, status)
  values ('00000000-0000-0000-0000-0000000009f1', 1, 'capital-network-v1.0.0', 500000,
    '[]'::jsonb, '[{"instrument": "microcredito_produtivo", "amount_cents": 300000}]'::jsonb,
    '{DOMESTIC_CAPACITY_PARTIAL}', 300000, 300000, 200000, 'recommended')
$$, 'a partial plan with a residual gap is recordable');

select throws_ok($$
  insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents,
    evaluated, allocations, reason_codes, covered_cents, domestic_coverage_cents, external_capital_gap_cents, status)
  values ('00000000-0000-0000-0000-0000000009f1', 2, 'capital-network-v1.0.0', 500000,
    '[]'::jsonb, '[]'::jsonb, '{}', 300000, 300000, 100000, 'no_route')
$$, '23514', null, 'covered plus the gap must equal what she asked for');

select throws_ok($$
  insert into capital_route_decisions (opportunity_id, decision_no, engine_version, requested_cents,
    evaluated, allocations, reason_codes, covered_cents, domestic_coverage_cents, external_capital_gap_cents, status)
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
  5, 'a capital operator reads the registry');
select is(
  (select count(*)::int from capital_providers),
  4, 'and the providers behind it');

set local role postgres;
select is(
  (select private.capital_network_model_version()),
  'capital-network-v1.0.0', 'the engine version is stated where the audit console can find it');

select * from finish();
rollback;
