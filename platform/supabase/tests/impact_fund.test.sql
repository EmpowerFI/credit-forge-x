-- The Global Capital Provider profile (addendum v2 §6): who the fund is, what it
-- will fund, the term range it will not go outside, and what an operator may
-- change about any of it.
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
  ('00000000-0000-0000-0000-0000000013a1', 'if-operator@test'),
  ('00000000-0000-0000-0000-0000000013a2', 'if-rita@test');
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000013a1';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000013a2';

-- ------------------------------------------------------------ who the fund is

select is(
  (select provider_type::text from capital_providers where code = 'fundo_impacto_global_demo'),
  'impact_fund', 'an impact fund is its own kind of provider');

select is(
  (select is_simulated from capital_providers where code = 'fundo_impacto_global_demo'),
  true, 'and it is invented, like every other provider in this network');

select is(
  (select legal_name from capital_providers where code = 'fundo_impacto_global_demo'),
  null, 'with no legal name, because no real fund has consented to being named');

select is(
  (select domicile from capital_providers where code = 'fundo_impacto_global_demo'),
  'NL', 'it says where the money is domiciled, because that decides which rules reach it');

select is(
  (select required_return_bps from capital_providers where code = 'fundo_impacto_global_demo'),
  600, 'and what it asks for its capital, before anything is added on top');

select is(
  (select cardinality(reporting_requirements) from capital_providers where code = 'fundo_impacto_global_demo'),
  3, 'what it wants back is codes a screen can list, not prose');

select is(
  (select kyb ->> 'status' from capital_providers where code = 'fundo_impacto_global_demo'),
  'simulated', 'and the counterparty checks say they are simulated rather than implying otherwise');

-- There is one ceiling on what a route may cost her, and it is the engine's.
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'capital_providers'
     and column_name like '%ceiling%'),
  0, 'no second cost ceiling beside private.capital_cost_ceiling_bps()');

-- ---------------------------------------------------------- what it will fund

select is(
  (select instrument_type::text from capital_instruments where code = 'capital_impacto_global'),
  'impact_fund_capital', 'a third party''s capital is not the house''s pool route');

select is(
  (select pool from capital_instruments where code = 'capital_impacto_global'),
  null, 'so it points at no funding pool, and states its own policy instead');

select is(
  (select requires_partner_approval from capital_instruments where code = 'capital_impacto_global'),
  true, 'and the fund still has to say yes, as every third party does');

select is(
  (select array[term_min_months, term_max_months] from capital_instruments where code = 'capital_impacto_global'),
  array[6, 36]::smallint[], 'it funds six to thirty-six months, and not outside that');

select is(
  (select target_population from capital_instruments where code = 'capital_impacto_global'),
  array['women_led', 'verified_community'], 'and names the population its mandate is for');

select throws_ok($$
  update capital_instruments set term_min_months = 40 where code = 'capital_impacto_global'
$$, '23514', null, 'a term range that runs backwards is refused');

select throws_ok($$
  insert into capital_instruments (provider_id, code, name, instrument_type, pool, ticket_min_cents, ticket_max_cents, capacity_cents, is_domestic, is_global)
  select id, 'fund_on_a_pool', 'A fund on the house book', 'impact_fund_capital', 'global', 100000, 500000, 100000, false, true
  from capital_providers where code = 'fundo_impacto_global_demo'
$$, '23514', null, 'and a fund''s capital may not be pointed at EmpowerFI''s own pool');

-- ------------------------------------------------------------------ the gate

-- A term range the engine never reads would be decoration on a screen.
select is(
  (select g ->> 'passed' from jsonb_array_elements(private.capital_gates(
     '{"amount_cents": 500000, "term_months": 3, "purpose": "inventory", "uf": "SP", "business_age_months": 18,
       "documents": ["cnpj_or_mei", "bank_statement_3m"], "max_instalment_cents": 90000}'::jsonb,
     '{"id": "capital_impacto_global", "ticket_min_cents": 100000, "ticket_max_cents": 5000000,
       "eligible_uf": [], "purposes": [], "term_min_months": 6, "term_max_months": 36,
       "business_age_min_months": 6, "required_documents": [], "max_instalment_share_bps": 5000,
       "estimated_cost_bps": 3600, "capacity_cents": 2000000000}'::jsonb)) g
   where g ->> 'gate' = 'term'),
  'false', 'a fund that funds six months does not fund three');

select is(
  (select g ->> 'value' from jsonb_array_elements(private.capital_gates(
     '{"amount_cents": 500000, "term_months": 3, "purpose": "inventory", "uf": "SP", "business_age_months": 18,
       "documents": [], "max_instalment_cents": 90000}'::jsonb,
     '{"id": "x", "ticket_min_cents": 100000, "ticket_max_cents": 5000000, "eligible_uf": [], "purposes": [],
       "term_min_months": 6, "term_max_months": 36, "business_age_min_months": 0, "required_documents": [],
       "max_instalment_share_bps": 5000, "estimated_cost_bps": 3600, "capacity_cents": 2000000000}'::jsonb)) g
   where g ->> 'gate' = 'term'),
  '3', 'and the trace carries both sides of the comparison, as every gate does');

select is(
  (select g ->> 'passed' from jsonb_array_elements(private.capital_gates(
     '{"amount_cents": 500000, "term_months": 60, "purpose": "inventory", "uf": "SP", "business_age_months": 18,
       "documents": [], "max_instalment_cents": 90000}'::jsonb,
     '{"id": "x", "ticket_min_cents": 100000, "ticket_max_cents": 5000000, "eligible_uf": [], "purposes": [],
       "term_min_months": null, "term_max_months": null, "business_age_min_months": 0, "required_documents": [],
       "max_instalment_share_bps": 5000, "estimated_cost_bps": 3600, "capacity_cents": 2000000000}'::jsonb)) g
   where g ->> 'gate' = 'term'),
  'true', 'a route that states no bound never refuses a term');

select is(
  (select count(*)::int from unnest(private.capital_reason_order()) o where o = 'TERM_OUTSIDE_POLICY'),
  1, 'the new refusal has exactly one place in the one order both engines read');

select is(
  (select count(*)::int from unnest(private.capital_reason_order()) o where o = any(private.global_reason_order())),
  0, 'and still no code belongs to both questions');

-- --------------------------------------------- what an operator may change

select pg_temp.act_as('00000000-0000-0000-0000-0000000013a1');

select lives_ok($$
  update capital_instruments set term_min_months = 12, term_max_months = 24,
    target_population = '{women_led}'
  where code = 'capital_impacto_global'
$$, 'an operator narrows the fund''s term range and its target population');

select is(
  (select policy_version from capital_instruments where code = 'capital_impacto_global'),
  2, 'and the policy version moves, so a recorded decision stays readable against its own policy');

select throws_ok($$
  update capital_instruments set instrument_type = 'microcredit' where code = 'capital_impacto_global'
$$, '42501', null, 'what kind of thing a route is stays with a migration');

-- The counterparty is not a commercial term negotiated at a desk.
select throws_ok($$
  update capital_providers set domicile = 'BR' where code = 'fundo_impacto_global_demo'
$$, '42501', null, 'and a fund''s domicile is not an operator''s to change');

select throws_ok($$
  update capital_providers set kyb = '{"status": "verified"}'::jsonb where code = 'fundo_impacto_global_demo'
$$, '42501', null, 'nor are its counterparty checks');

select throws_ok($$
  insert into capital_providers (code, display_name, provider_type)
  values ('a_new_fund', 'A fund from a form', 'impact_fund')
$$, '42501', null, 'nor does a new provider arrive from a form');

-- ----------------------------------------------------------------- who reads it

select pg_temp.act_as('00000000-0000-0000-0000-0000000013a2');

select is(
  (select count(*)::int from capital_providers where code = 'fundo_impacto_global_demo'),
  0, 'an entrepreneur does not read the registry, so none of this reaches her screen');

select finish();
rollback;
