-- The Capital Allocation Engine: the same answers as packages/capital-allocation,
-- a pool chosen when an opportunity opens to investors, domestic allocations in
-- reais, and formalisation at the engine's rate by the EmpowerFI P2P desk.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(50);

-- ------------------------------------------------------------ the vectors
-- Generated from packages/capital-allocation/vectors/scenarios.json: the
-- package's tests hold the TypeScript engine to the same expectations.

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 6, 'LOW', 'inventory', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "domestic", "reason_codes": ["DOMESTIC_LOWEST_COST", "DOMESTIC_LIQUIDITY_AVAILABLE", "GLOBAL_FX_COST_DOMINATES"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2600, "borrower_rate_bps_month": 209, "instalment_cents": 56270, "investor_return_bps": 1600, "investor_net_return_bps": 1300}'::jsonb,
  'vector: domestic is cheaper over six months: the FX hedge takes global''s lower return away'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 12, 'MEDIUM', 'equipment', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "global", "reason_codes": ["GLOBAL_LOWER_REQUIRED_RETURN", "GLOBAL_IMPACT_MANDATE_MATCH"], "domestic_all_in_bps": 2900, "global_all_in_bps": 2800, "borrower_rate_bps_month": 234, "instalment_cents": 32020, "investor_return_bps": 800, "investor_net_return_bps": 100}'::jsonb,
  'vector: global is cheaper over twelve months, for a mandate it holds'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(200000, 3, 'LOW', 'working_capital', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "domestic", "reason_codes": ["DOMESTIC_LOWEST_COST", "DOMESTIC_LIQUIDITY_AVAILABLE", "GLOBAL_RAMP_COST_DOMINATES"], "domestic_all_in_bps": 2500, "global_all_in_bps": 3000, "borrower_rate_bps_month": 209, "instalment_cents": 70847, "investor_return_bps": 1600, "investor_net_return_bps": 1300}'::jsonb,
  'vector: on a three-month loan the ramp''s round trip is what keeps it domestic'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 6, 'LOW', 'inventory', true,
    '{"id": "domestic", "available_cents": 100000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "global", "reason_codes": ["GLOBAL_EXPANDS_CAPACITY", "GLOBAL_IMPACT_MANDATE_MATCH", "DOMESTIC_POOL_EXHAUSTED"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2600, "borrower_rate_bps_month": 217, "instalment_cents": 56510, "investor_return_bps": 800, "investor_net_return_bps": 500}'::jsonb,
  'vector: the domestic pool is exhausted: global capital expands capacity'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(600000, 12, 'LOW', 'equipment', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "global", "reason_codes": ["GLOBAL_EXPANDS_CAPACITY", "GLOBAL_IMPACT_MANDATE_MATCH", "TICKET_OUTSIDE_POOL_POLICY"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2400, "borrower_rate_bps_month": 200, "instalment_cents": 62000, "investor_return_bps": 800, "investor_net_return_bps": 500}'::jsonb,
  'vector: a ticket above the domestic pool''s policy goes global'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 12, 'LOW', 'renovation', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "domestic", "reason_codes": ["DOMESTIC_LIQUIDITY_AVAILABLE", "PURPOSE_OUTSIDE_POOL_MANDATE"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2400, "borrower_rate_bps_month": 209, "instalment_cents": 31270, "investor_return_bps": 1600, "investor_net_return_bps": 1300}'::jsonb,
  'vector: a purpose outside the global mandate stays domestic'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 12, 'LOW', 'inventory', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1500, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "domestic", "reason_codes": ["DOMESTIC_LOWEST_COST", "DOMESTIC_LIQUIDITY_AVAILABLE", "GLOBAL_FX_COST_DOMINATES"], "domestic_all_in_bps": 2400, "global_all_in_bps": 2400, "borrower_rate_bps_month": 200, "instalment_cents": 31000, "investor_return_bps": 1500, "investor_net_return_bps": 1200}'::jsonb,
  'vector: a tie goes domestic'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(200000, 6, 'HIGH', 'inventory', true,
    '{"id": "domestic", "available_cents": 4850000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": null, "reason_codes": ["RISK_BAND_NOT_ELIGIBLE", "NO_POOL_AVAILABLE"], "domestic_all_in_bps": 3700, "global_all_in_bps": 3800, "borrower_rate_bps_month": null, "instalment_cents": null, "investor_return_bps": null, "investor_net_return_bps": null}'::jsonb,
  'vector: a risk band outside both pools'' appetite fits no pool'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 6, 'LOW', 'inventory', true,
    '{"id": "domestic", "available_cents": 0, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 0, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": null, "reason_codes": ["DOMESTIC_POOL_EXHAUSTED", "GLOBAL_POOL_EXHAUSTED", "NO_POOL_AVAILABLE"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2600, "borrower_rate_bps_month": null, "instalment_cents": null, "investor_return_bps": null, "investor_net_return_bps": null}'::jsonb,
  'vector: with both pools exhausted nothing is allocated'
);

select is(
  (select jsonb_build_object('pool', r -> 'pool', 'reason_codes', r -> 'reason_codes',
     'domestic_all_in_bps', r -> 'domestic' -> 'all_in_bps', 'global_all_in_bps', r -> 'global' -> 'all_in_bps',
     'borrower_rate_bps_month', r -> 'borrower_rate_bps_month', 'instalment_cents', r -> 'instalment_cents',
     'investor_return_bps', r -> 'investor_return_bps', 'investor_net_return_bps', r -> 'investor_net_return_bps')
   from (select private.allocate_funding(300000, 6, 'LOW', 'inventory', false,
    '{"id": "domestic", "available_cents": 100000, "required_return_bps": 1600, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 50000, "max_ticket_cents": 400000, "purposes": [], "impact_mandate": false, "fx_hedge_bps": 0, "ramp_bps": 0}'::jsonb,
    '{"id": "global", "available_cents": 9849600, "required_return_bps": 800, "eligible_risk_bands": ["LOW", "MEDIUM"], "min_ticket_cents": 100000, "max_ticket_cents": 1000000, "purposes": ["working_capital", "inventory", "equipment"], "impact_mandate": true, "fx_hedge_bps": 500, "ramp_bps": 100}'::jsonb) as r) t),
  '{"pool": "global", "reason_codes": ["GLOBAL_EXPANDS_CAPACITY", "DOMESTIC_POOL_EXHAUSTED"], "domestic_all_in_bps": 2500, "global_all_in_bps": 2600, "borrower_rate_bps_month": 217, "instalment_cents": 56510, "investor_return_bps": 800, "investor_net_return_bps": 500}'::jsonb,
  'vector: global capital without the impact flag earns no mandate code'
);
-- ------------------------------------------------------------------ fixtures
-- Pools small enough to run out: R$ 3,000 domestic, 500 USDC global (R$ 2,700).
-- Ana (R$ 2,000, six months) is cheaper at home; Bia's then finds the domestic
-- pool short and goes global; Dora's finds neither able to take it. Cida has
-- not agreed to be shown to investors.

update funding_pools set capital_cents = 300000 where pool = 'domestic';
update funding_pools set capital_micro_usdc = 500000000 where pool = 'global';
update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000008f1', 'pgTAP P2P desk', 'other', 10000, 5000000, '{}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'ca-admin@test'),
  ('00000000-0000-0000-0000-0000000008a2', 'ca-lia@test'),
  ('00000000-0000-0000-0000-0000000008a3', 'ca-ana@test'),
  ('00000000-0000-0000-0000-0000000008a4', 'ca-bia@test'),
  ('00000000-0000-0000-0000-0000000008a5', 'ca-dora@test'),
  ('00000000-0000-0000-0000-0000000008a6', 'ca-cida@test'),
  ('00000000-0000-0000-0000-0000000008a7', 'ca-paulo@test'),
  ('00000000-0000-0000-0000-0000000008a8', 'ca-irene@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000008a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000008a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000008f1' where id = '00000000-0000-0000-0000-0000000008a7';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000008a8';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000008c1', 'pgTAP Allocation community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000008a2', 'verified', now(), '00000000-0000-0000-0000-0000000008a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008a3', 'pgTAP Ana Alloc', 'Bolos pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008a4', 'pgTAP Bia Alloc', 'Ateliê pgTAP', 'crafts'),
  ('00000000-0000-0000-0000-0000000008e3', '00000000-0000-0000-0000-0000000008a5', 'pgTAP Dora Alloc', 'Doces pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000008e4', '00000000-0000-0000-0000-0000000008a6', 'pgTAP Cida Alloc', 'Costura pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000008c1', id from entrepreneurs where display_name like 'pgTAP % Alloc';
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Alloc';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, e.display_name <> 'pgTAP Cida Alloc', true, 'community' from entrepreneurs e
where e.display_name like 'pgTAP % Alloc';

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0,"avg_revenue_cents":412345,"avg_net_business_cents":151234,"revenue_cv_bps":800}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Alloc';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.request(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select declare_credit_intent('inventory', 200000);
  set local role postgres;
$$;

-- Eligible for R$ 2,000 over six months, LOW risk: one at a time, in order.
create function pg_temp.eligible(p_entrepreneur uuid) returns void language sql as $$
  set local role service_role;
  select record_eligibility_assessment(p_entrepreneur,
    (select id from credit_intents where entrepreneur_id = p_entrepreneur),
    (select id from readiness_assessments where entrepreneur_id = p_entrepreneur),
    '{}'::jsonb,
    '{"model_version":"eligibility-v0.1.0","decision":"ELIGIBLE","requested_amount_cents":200000,"proposed_amount_cents":200000,
      "term_months":6,"instalment_cents":36000,"max_instalment_cents":40000,"affordability_bps":1500,
      "suggested_min_cents":100000,"suggested_max_cents":250000,"risk_band":"LOW","risk_points":0,
      "confidence":"HIGH","reason_codes":["AFFORDABLE"]}'::jsonb);
  set local role postgres;
$$;

select pg_temp.request('00000000-0000-0000-0000-0000000008a3');
select pg_temp.request('00000000-0000-0000-0000-0000000008a4');
select pg_temp.request('00000000-0000-0000-0000-0000000008a5');
select pg_temp.request('00000000-0000-0000-0000-0000000008a6');
select pg_temp.eligible('00000000-0000-0000-0000-0000000008e1');
select pg_temp.eligible('00000000-0000-0000-0000-0000000008e2');
select pg_temp.eligible('00000000-0000-0000-0000-0000000008e3');
select pg_temp.eligible('00000000-0000-0000-0000-0000000008e4');

create temp table o as
select e.display_name as who, q.* from qualified_credit_opportunities q join entrepreneurs e on e.id = q.entrepreneur_id
where e.display_name like 'pgTAP % Alloc';
grant select on o to authenticated, service_role;

-- --------------------------------------------------------- allocation on opening

select is((select funding_pool::text from o where who = 'pgTAP Ana Alloc'), 'domestic', 'Ana''s request is funded at home');
select is((select allocation_reason_codes from o where who = 'pgTAP Ana Alloc'),
  '{DOMESTIC_LOWEST_COST,DOMESTIC_LIQUIDITY_AVAILABLE,GLOBAL_FX_COST_DOMINATES}'::text[],
  'because it costs her less: the hedge takes global capital''s lower return away');
select is((select funding_target_micro_usdc from o where who = 'pgTAP Ana Alloc'), 370370370::bigint,
  'its target is her R$ 2,000 at the quote, to the micro-USDC');
select is((select allocation_reason_codes from o where who = 'pgTAP Bia Alloc'),
  '{GLOBAL_EXPANDS_CAPACITY,GLOBAL_IMPACT_MANDATE_MATCH,DOMESTIC_POOL_EXHAUSTED}'::text[],
  'Bia''s finds R$ 1,000 left at home, and global capital takes it');
select ok((select funding_pool is null and funding_status is null from o where who = 'pgTAP Dora Alloc')
  and (select allocation_reason_codes from o where who = 'pgTAP Dora Alloc') @> '{NO_POOL_AVAILABLE}',
  'Dora''s waits: neither pool has R$ 2,000 left, and the reasons say so');
select ok((select allocation is null and funding_status is null from o where who = 'pgTAP Cida Alloc'),
  'Cida''s is never allocated: she has not agreed to be shown to investors');

-- ------------------------------------------------ the console she browses

-- An external investor allocates USDC and has no rail to send reais on, so a
-- request the engine routed to the domestic desk is not an offer that can be
-- made here. What leaves the market is counted rather than hidden: an investor
-- who sees one request should be able to learn that the engine qualified two.
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')), 0,
  'the market an investor browses leaves out what the engine routed to reais');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from o where who = 'pgTAP Bia Alloc')), 1,
  'and keeps what it can fund in USDC');
select is(market_funded_elsewhere(), jsonb_build_object('count', 1, 'amount_cents', 200000),
  'saying in one line how much qualified demand raises on the rail it does not carry');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a1');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')), 1,
  'an overseer still sees it: seeing what was routed away is the job');
set local role postgres;

-- --------------------------------------------------------------- investing

set local role service_role;
select throws_ok(
  $$ select record_investment('00000000-0000-0000-0000-0000000008a8', (select id from o where who = 'pgTAP Ana Alloc'), 10000000, 'wallet', 'W', 'sig-ca-1') $$,
  'P0001', 'domestic_pool_is_simulated', 'no USDC funds a domestic opportunity');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
select throws_ok($$ select allocate_domestic((select id from o where who = 'pgTAP Bia Alloc'), 50000) $$,
  'P0001', 'not_a_domestic_opportunity', 'nor reais a global one');
select lives_ok($$ select allocate_domestic((select id from o where who = 'pgTAP Ana Alloc'), 150000) $$,
  'an investor allocates R$ 1,500 to Ana''s, simulated');
select lives_ok($$ select allocate_domestic((select id from o where who = 'pgTAP Ana Alloc'), 50000) $$,
  'and the last R$ 500');
set local role postgres;
select is((select funding_status::text from qualified_credit_opportunities where id = (select id from o where who = 'pgTAP Ana Alloc')),
  'funded', 'which funds it exactly, rounding and all');
select is((select array_agg(amount_cents order by amount_cents) from investments where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')),
  '{50000,150000}'::bigint[], 'each position keeping the reais put in');
select ok((select bool_and(mode = 'simulated' and is_simulated) from investments where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')),
  'both marked simulated');
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')), 1,
  'and a domestic one she holds comes back: a position that cannot be opened is worse than a route that cannot be taken');
set local role postgres;

-- ------------------------------------------------------------- formalisation

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
select throws_ok($$ select formalise_loan((select id from o where who = 'pgTAP Ana Alloc')) $$,
  '42501', 'not_your_opportunity', 'an investor does not formalise');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a7');
select throws_ok($$ select partner_decide((select id from o where who = 'pgTAP Ana Alloc'), 'approved', 200000, 300, 6) $$,
  'P0001', 'approval_is_formalisation', 'the desk sets no rate of its own');
select throws_ok($$ select formalise_loan((select id from o where who = 'pgTAP Bia Alloc')) $$,
  'P0001', 'not_fully_funded', 'nor formalises what investors have not funded');
select lives_ok($$ select formalise_loan((select id from o where who = 'pgTAP Ana Alloc')) $$,
  'the desk formalises Ana''s, funded');
set local role postgres;
select is((select array[rate_bps::bigint, instalment_cents, principal_cents] from loans where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')),
  array[209, 37514, 200000]::bigint[], 'at the engine''s 2.09% a month: R$ 375.14 a month for six');
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a7');
select lives_ok($$ select transition_loan((select id from loans where opportunity_id = (select id from o where who = 'pgTAP Ana Alloc')), 'DISBURSED', 'Pix sent') $$,
  'and disburses it');
set local role postgres;

-- ------------------------------------------------------------------ overview

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select capital_overview() $$, '42501', 'not_allowed_to_see_capital', 'a community leader sees no pools');
set local role postgres;

-- ------------------------------------------------------------ the community

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a2');
select is((select count(*)::int from qualified_credit_opportunities) + (select count(*)::int from loans), 0,
  'nor reads her members'' opportunities or loans from their tables');
select is(
  (select community_overview('00000000-0000-0000-0000-0000000008c1') -> 'capital')
    - array['financed_cents', 'repaid_cents', 'instalments_paid', 'instalments_due', 'loans_repaying', 'loans_late', 'loans_paid', 'loans_defaulted', 'waiting_for_capital'],
  '{"eligible_cents":800000,"funded_cents":200000,"gap_cents":600000,"domestic_cents":200000,"global_cents":0,"domestic_coverage_bps":2500,"global_coverage_bps":0}'::jsonb,
  'she sees capital as totals: R$ 8,000 of P2P demand, R$ 2,000 funded at home, a R$ 6,000 gap'
);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
create temp table ov as select capital_overview() as v;
set local role postgres;
select is((select v -> 'coverage' from ov),
  '{"demand_cents":400000,"domestic_only_cents":0,"combined_cents":200000,"domestic_coverage_bps":0,"combined_coverage_bps":5000}'::jsonb,
  'demand is Bia''s and Dora''s: R$ 1,000 at home covers neither, global capital covers Bia''s');

-- Two figures, two questions. Coverage weighs the pools against all qualified
-- demand, claimed requests included on both sides, and the engine page asks what
-- the pool may still put into the next request. Reading the first as the second
-- is how the engine page came to answer "Global P2P selected" about a request
-- the database had recorded as waiting for capital.
select is(
  (select (p ->> 'available_cents')::bigint from ov, jsonb_array_elements(v -> 'pools') p where p ->> 'pool' = 'global'),
  (select private.usdc_cents(
     (private.pool_book('global') ->> 'capital')::bigint
       - (private.pool_book('global') ->> 'lent')::bigint
       - (private.pool_book('global') ->> 'claimed')::bigint,
     private.demo_brl_per_usdc_milli())),
  'a pool reports what it may still allocate, on the arithmetic the allocation trigger itself uses');

select ok(
  (select bool_and((p ->> 'available_cents')::bigint <= (p ->> 'liquidity_cents')::bigint)
   from ov, jsonb_array_elements(v -> 'pools') p),
  'and it is never more than what the pool has not lent');

-- Bia''s request is raising on the global pool, so the pool is holding it: it is
-- gone from what may be allocated next and still there in what is not lent.
select ok(
  (select (p ->> 'available_micro_usdc')::bigint < (p ->> 'liquidity_micro_usdc')::bigint
   from ov, jsonb_array_elements(v -> 'pools') p where p ->> 'pool' = 'global'),
  'a request already raising on a pool is spoken for, and only one of the two figures says so');

-- ------------------------------------------------------------ the engine page

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select engine_opportunities() $$, '42501', 'not_allowed_to_see_capital', 'a community leader cannot open the engine page');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a8');
create temp table eng_investor as select engine_opportunities() as v;
set local role postgres;
select is(
  (select jsonb_agg(jsonb_build_object('pool', x -> 'funding_pool', 'status', x -> 'funding_status', 'code', left(x ->> 'code', 2)) order by x ->> 'funding_status')
   from eng_investor, jsonb_array_elements(v) x),
  '[{"pool": "global", "status": "open", "code": "Q-"}, {"pool": null, "status": "waiting", "code": "Q-"}]'::jsonb,
  'an investor selects from the queue: Bia''s global request and Dora''s waiting one, by Q- code; Ana''s is lent, Cida''s never shown'
);
select is(
  (select array_agg(distinct k order by k) from eng_investor, jsonb_array_elements(v) x, jsonb_object_keys(x) k
   where k in ('display_name', 'business_name', 'entrepreneur_id', 'avg_revenue_cents', 'features', 'inputs')),
  null, 'with no name, no business name, no person id and no raw figures'
);
select ok(
  (select bool_and((x -> 'readiness' ->> 'score') is not null and (x -> 'eligibility' ->> 'decision') is not null and jsonb_typeof(x -> 'proofs') = 'array')
   from eng_investor, jsonb_array_elements(v) x),
  'each with its readiness, its eligibility and the proofs behind them'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a7');
select is((select array_agg(left(x ->> 'code', 2)) from jsonb_array_elements(engine_opportunities()) x), array['P-', 'P-'],
  'the desk sees the same two, by its own P- codes');
select is((select count(*)::int from jsonb_array_elements(engine_opportunities()) x where (x ->> 'settled')::boolean), 0,
  'and its queue still holds nothing that was already lent');
create temp table eng_settled as
  select x, i from jsonb_array_elements(engine_opportunities(true)) with ordinality t(x, i)
  where (x ->> 'opportunity_id')::uuid in (select id from o);
set local role postgres;

-- The engine page's third act follows the capital after the decision, and every
-- request that got that far is a loan — precisely what the queue leaves out. So
-- a caller can ask for those too, without the queue losing its meaning.
--
-- Scoped to this file's own three requests. Run against a deployment with a
-- seeded book this reader returns everything that deployment ever lent, and a
-- test that counted the whole array would be asserting on somebody else's data.
select is((select count(*)::int from eng_settled), 3,
  'asked for settled requests too, the desk also sees the one it already lent');
select is(
  (select array_agg((x ->> 'settled')::boolean order by i) from eng_settled),
  array[false, false, true],
  'the queue first and the lent one after it, never mixed into the work still to be done');
select is(
  (select array_agg(x ->> 'reached' order by i) from eng_settled
   where (x ->> 'opportunity_id')::uuid = (select id from o where who = 'pgTAP Ana Alloc')),
  array['disbursed'],
  'each saying how far its capital got, so nobody follows a request that never left the first movement');
