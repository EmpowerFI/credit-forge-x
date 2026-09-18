-- Settlement routing: the same answers as packages/settlement-route, a route
-- priced and decided when a global loan is disbursed, her Pix untouched, and
-- the whole experiment switchable off.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(38);

-- The comparator's helpers are the database's own: no role but the owner may
-- call them, so the expected model version is read here, once, as postgres.
create temp table mv as select private.settlement_route_model_version() as v;
grant select on mv to public;

-- ------------------------------------------------------------ the vectors
-- packages/settlement-route/vectors/scenarios.json, which the package's own
-- tests hold the TypeScript model to. Quoted and expiry timestamps are left
-- out of the comparison: private.iso writes microseconds where JavaScript
-- writes milliseconds, and every other field is the model's answer.

create function pg_temp.direct(p_over jsonb default '{}') returns jsonb language sql as $$
  select '{"route": "direct_usdc_pix", "provider": "regulated_offramp", "asset": "USDC", "fx_spread_bps": 120,
           "fx_struck": "payout", "provider_fee_bps": 60, "provider_fee_fixed_cents": 0, "network_fee_cents": 0,
           "execution_eta_sec": 900, "quote_ttl_sec": 600, "min_ticket_cents": 10000, "max_ticket_cents": 2000000,
           "liquidity_cents": 5000000, "reality": "simulated", "enabled": true}'::jsonb || p_over
$$;

create function pg_temp.stable(p_over jsonb default '{}') returns jsonb language sql as $$
  select '{"route": "brl_stable_pix", "provider": "brl_stablecoin", "asset": "BRS", "fx_spread_bps": 120,
           "fx_struck": "allocation", "provider_fee_bps": 120, "provider_fee_fixed_cents": 0, "network_fee_cents": 0,
           "execution_eta_sec": 300, "quote_ttl_sec": 86400, "min_ticket_cents": 10000, "max_ticket_cents": 2000000,
           "liquidity_cents": 3000000, "reality": "simulated", "enabled": true}'::jsonb || p_over
$$;

-- One scenario: the two rate cards, each at its rate and its moment.
create function pg_temp.routed(
  p_direct jsonb, p_stable jsonb, p_gross bigint default 100000000, p_principal bigint default null,
  p_direct_fx integer default 5400, p_stable_fx integer default 5400,
  p_direct_at text default '2026-09-18T11:58:00Z', p_stable_at text default '2026-09-18T10:00:00Z',
  p_now text default '2026-09-18T12:00:00Z'
) returns jsonb language sql as $$
  select private.settle_route(p_gross, p_principal, p_now::timestamptz, jsonb_build_array(
    jsonb_build_object('provider', p_direct, 'fx_rate_milli', p_direct_fx, 'quoted_at', p_direct_at),
    jsonb_build_object('provider', p_stable, 'fx_rate_milli', p_stable_fx, 'quoted_at', p_stable_at)))
$$;

-- What the vectors compare: the decision, and each route's economics.
create function pg_temp.summary(r jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'selected', r -> 'selected',
    'reason_codes', r -> 'reason_codes',
    'net_brl_delta_cents', r -> 'net_brl_delta_cents',
    'gross_for_principal', r -> 'gross_for_principal',
    'routes', (select jsonb_object_agg(q ->> 'route', jsonb_build_object(
        'net_brl_cents', q -> 'net_brl_cents', 'cost_bps', q -> 'cost_bps', 'feasible', q -> 'feasible'))
      from jsonb_array_elements(r -> 'quotes') q)
  )
$$;

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable(), 100000000, 150000)),
  '{"selected": "direct_usdc_pix", "reason_codes": ["DIRECT_LOWEST_COST", "EXTRA_CONVERSION_ADDS_COST"],
    "net_brl_delta_cents": 320, "gross_for_principal": {"direct_usdc_pix": 282850000, "brl_stable_pix": 284566667},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 52711, "cost_bps": 239, "feasible": true}}}'::jsonb,
  'vector A: at the same rate, the extra conversion is not worth taking'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable(), 100000000, 150000, 5180)),
  '{"selected": "brl_stable_pix",
    "reason_codes": ["BRL_STABLE_BETTER_NET_BRL", "BRL_STABLE_LOCKS_PRINCIPAL_EARLIER", "BRL_STABLE_NO_FX_ON_PAYOUT"],
    "net_brl_delta_cents": 1841, "gross_for_principal": {"direct_usdc_pix": 294862935, "brl_stable_pix": 284566667},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 50870, "cost_bps": 180, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 52711, "cost_bps": 239, "feasible": true}}}'::jsonb,
  'vector B: the rate moved against the payout leg, and the locked reais win'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable(), 100000000, null, 5400, 5400, '2026-09-18T11:45:00Z')),
  '{"selected": "brl_stable_pix",
    "reason_codes": ["BRL_STABLE_LOCKS_PRINCIPAL_EARLIER", "BRL_STABLE_NO_FX_ON_PAYOUT", "ROUTE_QUOTE_EXPIRED"],
    "net_brl_delta_cents": null, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": false},
               "brl_stable_pix": {"net_brl_cents": 52711, "cost_bps": 239, "feasible": true}}}'::jsonb,
  'vector B2: the direct quote expired before the money moved'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable(), 100000000, null, 5400, 5620,
    '2026-09-18T11:58:00Z', '2026-09-15T09:00:00Z')),
  '{"selected": "brl_stable_pix",
    "reason_codes": ["BRL_STABLE_BETTER_NET_BRL", "BRL_STABLE_LOCKS_PRINCIPAL_EARLIER", "BRL_STABLE_NO_FX_ON_PAYOUT"],
    "net_brl_delta_cents": 1827, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 54858, "cost_bps": 239, "feasible": true}}}'::jsonb,
  'vector B3: a rate struck at allocation does not expire, however old it is'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable('{"enabled": false}'))),
  '{"selected": "direct_usdc_pix", "reason_codes": ["ROUTE_PROVIDER_UNAVAILABLE"],
    "net_brl_delta_cents": null, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 52711, "cost_bps": 239, "feasible": false}}}'::jsonb,
  'vector C: the stablecoin provider is not available'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable('{"liquidity_cents": 20000}'))),
  '{"selected": "direct_usdc_pix", "reason_codes": ["ROUTE_NO_LIQUIDITY"],
    "net_brl_delta_cents": null, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 52711, "cost_bps": 239, "feasible": false}}}'::jsonb,
  'vector C2: the stablecoin route cannot settle this ticket'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable(), 1000000)),
  '{"selected": null, "reason_codes": ["ROUTE_TICKET_OUTSIDE_POLICY", "NO_ROUTE_AVAILABLE"],
    "net_brl_delta_cents": null, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 529, "cost_bps": 204, "feasible": false},
               "brl_stable_pix": {"net_brl_cents": 526, "cost_bps": 259, "feasible": false}}}'::jsonb,
  'vector D: a ticket under both rate cards settles nowhere'
);

select is(
  pg_temp.summary(pg_temp.routed(pg_temp.direct(), pg_temp.stable('{"provider_fee_bps": 60}'))),
  '{"selected": "direct_usdc_pix", "reason_codes": ["DIRECT_FEWEST_STEPS"],
    "net_brl_delta_cents": 0, "gross_for_principal": {"direct_usdc_pix": null, "brl_stable_pix": null},
    "routes": {"direct_usdc_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true},
               "brl_stable_pix": {"net_brl_cents": 53031, "cost_bps": 179, "feasible": true}}}'::jsonb,
  'vector E: on equal economics the shorter route wins, even when it is the slower one'
);

-- ------------------------------------------------------------- the rate cards

select ok(private.settlement_experiment(), 'the experiment is on for the hackathon');

select is(private.settlement_card('direct_usdc_pix'), pg_temp.direct(),
  'the seeded direct card is the one the vectors were reasoned from');
select is(private.settlement_card('brl_stable_pix'), pg_temp.stable(),
  'and so is the stablecoin''s');

select ok(
  private.settlement_net_cents(private.settlement_gross_for_cents(150000, 5400, pg_temp.direct()), 5400, pg_temp.direct()) >= 150000,
  'the gross her principal needs delivers at least her principal'
);
select ok(
  private.settlement_net_cents(private.settlement_gross_for_cents(150000, 5400, pg_temp.direct()) - 1, 5400, pg_temp.direct()) < 150000,
  'and is the smallest gross that does'
);

-- ------------------------------------------------------------------ fixtures
-- Wanda funds Rita's request in USDC; the desk formalises and disburses it.
-- Sara's is disbursed with the experiment switched off.

update partners set active = false where name not like 'pgTAP %';
-- Every request here is funded in USDC, and the global pool has room whether
-- this database is fresh or seeded: what else happens to be raising is not
-- this file's subject.
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}',
  capital_micro_usdc = 100000000000 where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000007f1', 'pgTAP Route partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'r-admin@test'),
  ('00000000-0000-0000-0000-0000000007a2', 'r-lia@test'),
  ('00000000-0000-0000-0000-0000000007a3', 'r-rita@test'),
  ('00000000-0000-0000-0000-0000000007a4', 'r-sara@test'),
  ('00000000-0000-0000-0000-0000000007a5', 'r-paulo@test'),
  ('00000000-0000-0000-0000-0000000007a6', 'r-audit@test'),
  ('00000000-0000-0000-0000-0000000007a8', 'r-sim@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000007a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000007a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000007f1' where id = '00000000-0000-0000-0000-0000000007a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000007a6';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000007a8';
insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA7777777777777777777777777777777777777","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000007c1', 'pgTAP Route community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000007a2', 'verified', now(), '00000000-0000-0000-0000-0000000007a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007a3', 'pgTAP Rita Route', 'Bolos da Rita rota', 'food'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007a4', 'pgTAP Sara Route', 'Ateliê Sara rota', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000007c1', id from entrepreneurs where display_name like 'pgTAP % Route';
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Route';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where e.display_name like 'pgTAP % Route';

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Route';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select declare_credit_intent('equipment', 150000);
set local role postgres;

set local role service_role;
select record_eligibility_assessment(e.id,
  (select id from credit_intents where entrepreneur_id = e.id),
  (select id from readiness_assessments where entrepreneur_id = e.id),
  '{}'::jsonb,
  jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
    'requested_amount_cents', (select requested_amount_cents from credit_intents where entrepreneur_id = e.id),
    'proposed_amount_cents', (select requested_amount_cents from credit_intents where entrepreneur_id = e.id),
    'term_months', 12, 'instalment_cents', 20000, 'max_instalment_cents', 27500, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb))
from entrepreneurs e where e.display_name like 'pgTAP % Route';
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000007e1';
grant select on opp to authenticated, service_role;
create temp table opp2 as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000007e2';
grant select on opp2 to authenticated, service_role;

select record_investment('00000000-0000-0000-0000-0000000007b1', (select id from opp), 100000000, 'wallet',
  'WaNdA7777777777777777777777777777777777777', 'sig-wanda-route');
select record_investment('00000000-0000-0000-0000-0000000007a8', (select id from opp), (select target from opp) - 100000000,
  'simulated', p_is_simulated => true);
select record_investment('00000000-0000-0000-0000-0000000007a8', (select id from opp2), (select target from opp2),
  'simulated', p_is_simulated => true);

-- ----------------------------------------------------------- who may look

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select is((select count(*)::int from settlement_providers), 0,
  'an entrepreneur is never shown a rate card: her side of this is reais and Pix');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a8');
select is((select count(*)::int from settlement_providers), 2,
  'an investor, who is shown the route her capital takes, reads both cards');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select throws_ok(
  format('select settlement_route_preview(%L)', (select id from opp)),
  '42501', null, 'and cannot ask for a settlement preview'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select is(
  (select jsonb_build_object('applies', p -> 'applies', 'model_version', p -> 'model_version',
     'routes', (select count(*)::int from jsonb_array_elements(p -> 'quotes')), 'selected', p -> 'selected')
   from (select settlement_route_preview((select id from opp)) as p) t),
  jsonb_build_object('applies', 'true'::jsonb, 'model_version', to_jsonb((select v from mv)),
    'routes', 2, 'selected', '"direct_usdc_pix"'::jsonb),
  'the desk may price both routes before it formalises, and nothing is written'
);
set local role postgres;

-- Scoped to this fixture's opportunity: a seeded database may hold quotes of its own.
select is(
  (select count(*)::int from settlement_quotes q join loans l on l.id = q.loan_id where l.opportunity_id = (select id from opp)),
  0, 'a preview writes no quote'
);

-- A request the domestic pool takes has no dollars to convert.
update qualified_credit_opportunities set funding_pool = 'domestic' where id = (select id from opp2);
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select is((settlement_route_preview((select id from opp2))) -> 'applies', 'false'::jsonb,
  'a domestic request is not routed: it never leaves reais');
set local role postgres;

-- ------------------------------------------------------------ at disbursal

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select formalise_loan((select id from opp));
set local role postgres;
create temp table loan as select id, principal_cents from loans where opportunity_id = (select id from opp);
grant select on loan to authenticated, service_role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select transition_loan((select id from loan), 'DISBURSED', 'Pix sent');
set local role postgres;

select results_eq(
  $$ select route::text, feasible, net_brl_cents > 0 from settlement_quotes
     where loan_id = (select id from loan) order by hops $$,
  $$ values ('direct_usdc_pix', true, true), ('brl_stable_pix', true, true) $$,
  'disbursing a global loan prices both routes at the same gross'
);

select results_eq(
  $$ select selected_route::text, model_version, cardinality(reason_codes) > 0, principal_cents
     from settlement_decisions where loan_id = (select id from loan) $$,
  $$ select 'direct_usdc_pix'::text, (select v from mv), true, principal_cents from loan $$,
  'and records one decision, with the model that took it and why'
);

select is(
  (select route::text from settlement_legs where kind = 'pix_payout' and loan_id = (select id from loan)),
  'direct_usdc_pix',
  'and the leg that pays her carries the route that paid it'
);

select is(
  (select count(*)::int from settlement_quotes q join settlement_providers p on p.provider = q.provider
   where p.asset = 'BRS' and q.reality <> 'simulated'),
  0, 'no stablecoin quote is ever marked real'
);

select results_eq(
  $$ select amount_cents, status::text from settlement_legs where kind = 'pix_payout' and loan_id = (select id from loan) $$,
  $$ select principal_cents, 'mock'::text from loan $$,
  'and she is still paid her whole principal: routing costs are never taken out of her Pix'
);

select results_eq(
  $$ select amount_micro_usdc, status::text, destination from settlement_legs
     where kind = 'release' and loan_id = (select id from loan) $$,
  $$ values (100000000::bigint, 'due'::text, null::text) $$,
  'and the real deposits still leave the vault for the ramp, as they did before routing existed'
);

-- ---------------------------------------------------------- the proof of it

select is(
  (select jsonb_build_object('kind', kind::text, 'status', status::text,
     'behind', depends_on = private.anchor_of('loan_transition', (
       select id from loan_events where loan_id = (select id from loan) and to_status = 'DISBURSED')))
   from chain_anchors where kind = 'settlement_route' and entity_id = (select id from loan)),
  '{"kind": "settlement_route", "status": "pending", "behind": true}'::jsonb,
  'the decision is queued for the chain, behind the disbursement that caused it'
);

-- The payload is what the browser recomputes, so it must be the decision as
-- the model wrote it, and nothing else.
select is(
  (select jsonb_build_object(
     'selected_route', p -> 'selected_route', 'model_version', p -> 'model_version',
     'principal_cents', p -> 'principal_cents',
     'quotes', (select count(*)::int from jsonb_array_elements(p -> 'quotes')),
     'same_as_compared', (p -> 'quotes') = (select compared from settlement_decisions where loan_id = (select id from loan)))
   from (select private.anchor_payload('settlement_route', (select id from loan)) as p) t),
  jsonb_build_object('selected_route', '"direct_usdc_pix"'::jsonb, 'model_version', to_jsonb((select v from mv)),
    'principal_cents', to_jsonb((select principal_cents from loan)), 'quotes', 2, 'same_as_compared', 'true'::jsonb),
  'and its payload is the decision the comparator wrote, quotes and all'
);

-- Nothing on chain, and nothing in the payload, can name a person or a price
-- she would recognise: the whole point of committing rather than publishing.
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
     private.anchor_payload('settlement_route', (select id from loan))) k
   where k in ('entrepreneur_id', 'pix_key', 'wallet_address', 'investor_id', 'name', 'cpf')),
  null,
  'the payload carries no person: no entrepreneur, investor, wallet, Pix key or name'
);

select is(
  (select count(*)::int from jsonb_array_elements(private.anchor_payload('settlement_route', (select id from loan)) -> 'quotes') q
   where q ? 'signature' or q ? 'txid' or q ? 'explorer_url'),
  0,
  'and no quote carries a transaction that was never made'
);

-- Who may read the record behind the proof, which is not the same as who may
-- read the chain: the chain is public, the decision is not.
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select ok(not private.can_see_anchor('settlement_route', (select id from loan)),
  'the entrepreneur reads no routing proof: her side of settlement is reais and Pix');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select ok(private.can_see_anchor('settlement_route', (select id from loan)),
  'the desk that holds the loan reads it');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a8');
select ok(private.can_see_anchor('settlement_route', (select id from loan)),
  'and so does an investor whose capital it routed');

select is((select count(*)::int from settlement_quotes where loan_id = (select id from loan)), 2,
  'an investor funding the loan reads the quotes her capital was routed by');

-- What the investor console reads: her position's route, and the two quotes it was chosen from.
select is(
  (select jsonb_build_object(
     'selected', p -> 'settlement' -> 'route' -> 'selected',
     'quotes', (select count(*)::int from jsonb_array_elements(p -> 'settlement' -> 'route' -> 'quotes')),
     'model_version', p -> 'settlement' -> 'route' -> 'model_version')
   from (select investor_position((select id from investments
     where opportunity_id = (select id from opp) and investor_id = '00000000-0000-0000-0000-0000000007a8')) as p) t),
  jsonb_build_object('selected', '"direct_usdc_pix"'::jsonb, 'quotes', 2,
    'model_version', to_jsonb((select v from mv))),
  'her position carries the route her capital took, with both quotes beside it'
);

-- The roll-up is over every loan, so this asserts what must be there, not the
-- whole list: a seeded database settles cases of its own.
select is(
  (select jsonb_build_object('experiment', o -> 'experiment',
     'direct', (select count(*)::int from jsonb_array_elements(o -> 'routes') r where r ->> 'route' = 'direct_usdc_pix'))
   from (select settlement_overview() as o) t),
  '{"experiment": true, "direct": 1}'::jsonb,
  'and the settlement page counts what each route has settled'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select is((select count(*)::int from settlement_quotes), 0,
  'and an entrepreneur reads none of them');
set local role postgres;

-- ------------------------------------------------------- with it switched off

create or replace function private.settlement_experiment()
returns boolean language sql immutable set search_path = ''
as $$ select false $$;

update qualified_credit_opportunities set funding_pool = 'global' where id = (select id from opp2);
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select formalise_loan((select id from opp2));
set local role postgres;
create temp table loan2 as select id, principal_cents from loans where opportunity_id = (select id from opp2);
grant select on loan2 to authenticated, service_role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select transition_loan((select id from loan2), 'DISBURSED', 'Pix sent');
set local role postgres;

select is(
  (select count(*)::int from settlement_quotes q join loan2 l on l.id = q.loan_id)
  + (select count(*)::int from settlement_decisions d join loan2 l on l.id = d.loan_id),
  0, 'with the experiment off, a disbursal prices nothing and decides nothing'
);

select results_eq(
  $$ select kind::text, amount_cents, status::text, route is null from settlement_legs
     where loan_id = (select id from loan2) and kind = 'pix_payout' $$,
  $$ select 'pix_payout'::text, principal_cents, 'mock'::text, true from loan2 $$,
  'and the legs read exactly as they did before this migration'
);

select * from finish();
rollback;
