-- Impact Intelligence: a sponsor reads its programme in aggregate, small groups
-- stay hidden, consent decides what is listed, and investors set mandates.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(19);

-- ------------------------------------------------------------------ fixtures
-- Helena's foundation sponsors a programme run by Lia's community: five food
-- businesses and one craft business. Ana and Cida ask for capital; Cida has not
-- agreed to be shown to investors. Olga's community is outside the programme.
-- Sara sponsors nothing. Irene and Ivo invest; Eva is an entrepreneur.

update funding_pools set capital_cents = 5000000 where pool = 'domestic';
update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000009f1', 'pgTAP II desk', 'other', 10000, 5000000, '{}');

insert into sponsors (id, name, kind) values
  ('00000000-0000-0000-0000-0000000009b1', 'pgTAP Foundation', 'foundation'),
  ('00000000-0000-0000-0000-0000000009b2', 'pgTAP Other sponsor', 'company');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'ii-admin@test'),
  ('00000000-0000-0000-0000-0000000009a2', 'ii-lia@test'),
  ('00000000-0000-0000-0000-0000000009a3', 'ii-ana@test'),
  ('00000000-0000-0000-0000-0000000009a4', 'ii-cida@test'),
  ('00000000-0000-0000-0000-0000000009a5', 'ii-helena@test'),
  ('00000000-0000-0000-0000-0000000009a6', 'ii-sara@test'),
  ('00000000-0000-0000-0000-0000000009a7', 'ii-irene@test'),
  ('00000000-0000-0000-0000-0000000009a8', 'ii-ivo@test'),
  ('00000000-0000-0000-0000-0000000009a9', 'ii-olga@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000009a1';
update profiles set role = 'community_leader' where id in ('00000000-0000-0000-0000-0000000009a2', '00000000-0000-0000-0000-0000000009a9');
update profiles set role = 'sponsor', sponsor_id = '00000000-0000-0000-0000-0000000009b1' where id = '00000000-0000-0000-0000-0000000009a5';
update profiles set role = 'sponsor', sponsor_id = '00000000-0000-0000-0000-0000000009b2' where id = '00000000-0000-0000-0000-0000000009a6';
update profiles set role = 'capital_provider' where id in ('00000000-0000-0000-0000-0000000009a7', '00000000-0000-0000-0000-0000000009a8');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000009c1', 'pgTAP II community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000009a2', 'verified', now(), '00000000-0000-0000-0000-0000000009a1'),
  ('00000000-0000-0000-0000-0000000009c2', 'pgTAP II outside', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000009a9', 'verified', now(), '00000000-0000-0000-0000-0000000009a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009a3', 'pgTAP Ana II', 'Bolos II pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009a4', 'pgTAP Cida II', 'Doces II pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e3', null, 'pgTAP Duda II', 'Salgados II pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e4', null, 'pgTAP Edna II', 'Marmitas II pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e5', null, 'pgTAP Fran II', 'Pães II pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e6', null, 'pgTAP Gil II', 'Ateliê II pgTAP', 'crafts'),
  ('00000000-0000-0000-0000-0000000009e7', null, 'pgTAP Outside II', 'Fora II pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000009c1', id from entrepreneurs
where display_name like 'pgTAP % II' and display_name <> 'pgTAP Outside II';
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000009c2', '00000000-0000-0000-0000-0000000009e7');
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % II';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, e.display_name <> 'pgTAP Cida II', true, 'community' from entrepreneurs e
where e.display_name like 'pgTAP % II';
insert into checkins (entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents, keeps_records, active_days)
select id, '2026-09', 8888888, 100000, 50000, 60000, true, 22 from entrepreneurs where display_name like 'pgTAP % II';

insert into programs (id, sponsor_id, name, period_start, period_end, funding_committed_cents, funding_deployed_cents) values
  ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009b1', 'pgTAP Programme', '2026-06-01', '2027-05-31', 10000000, 4000000);
insert into program_communities (program_id, community_id) values
  ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009c1');

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name in ('pgTAP Ana II', 'pgTAP Cida II');
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.request_and_qualify(p_user uuid, p_entrepreneur uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select declare_credit_intent('inventory', 200000);
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

select pg_temp.request_and_qualify('00000000-0000-0000-0000-0000000009a3', '00000000-0000-0000-0000-0000000009e1');
select pg_temp.request_and_qualify('00000000-0000-0000-0000-0000000009a4', '00000000-0000-0000-0000-0000000009e2');

-- ------------------------------------------------------------------ sponsors

select throws_ok($$ update profiles set role = 'sponsor' where id = '00000000-0000-0000-0000-0000000009a8' $$,
  '23514', null, 'a sponsor user always acts for a sponsor');

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a7');
select throws_ok($$ select impact_intelligence('00000000-0000-0000-0000-0000000009d1') $$, '42501', 'not_allowed_to_see_program',
  'an investor cannot read a sponsor''s programme');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a6');
select throws_ok($$ select impact_intelligence('00000000-0000-0000-0000-0000000009d1') $$, '42501', 'not_allowed_to_see_program',
  'nor can another sponsor');
select is((select count(*) from programs where id = '00000000-0000-0000-0000-0000000009d1'), 0::bigint, 'who does not see its row either');
select is(jsonb_array_length(engine_opportunities()), 0, 'and finds nothing of it in the engine');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
create temp table ii as select impact_intelligence('00000000-0000-0000-0000-0000000009d1') as v;
select is((select count(*) from programs), 1::bigint, 'the sponsor sees its own programme');
set local role postgres;

select is((select v #>> '{program,name}' from ii), 'pgTAP Programme', 'the sponsor reads its programme');
select is((select (v #>> '{hero,reached}')::int from ii), 6, 'reaching the six members of the community that runs it, not the one outside');
select ok(
  (select bool_and(n <= coalesce(prev, n)) from (
     select (x ->> 'n')::int as n, lag((x ->> 'n')::int) over (order by ord) as prev
     from ii, jsonb_array_elements(v -> 'funnel') with ordinality as f(x, ord)) t),
  'its funnel never grows from one stage to the next');
select is(
  (select jsonb_agg(x order by x ->> 'key') from ii, jsonb_array_elements(v #> '{segments,sector}') x),
  '[{"n": null, "key": "crafts", "cents": null, "share_bps": null, "suppressed": true},
    {"n": 5, "key": "food", "share_bps": 8333, "suppressed": false}]'::jsonb,
  'a group under five is hidden: the one craft business cannot be singled out');
select is(
  (select array_agg(distinct k order by k) from ii, jsonb_path_query(v, 'strict $.**{1 to last}') x, jsonb_object_keys(case when jsonb_typeof(x) = 'object' then x else '{}' end) k
   where k in ('display_name', 'business_name', 'entrepreneur_id', 'revenue_cents', 'avg_revenue_cents')),
  null, 'no name, no business, no person id and no reported figure anywhere');
select ok((select v::text !~ '(pgTAP Ana|Bolos II|8888888)' from ii), 'and none of their values');
select is(
  (select jsonb_agg(left(x ->> 'code', 2)) from ii, jsonb_array_elements(v -> 'opportunities') x),
  '["Q-"]'::jsonb, 'opportunities are listed by Q- code, only Ana''s: Cida did not agree to be shown to investors');

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
select is((select array_agg(left(x ->> 'code', 2)) from jsonb_array_elements(engine_opportunities()) x), array['Q-'],
  'the sponsor opens the same one in the Credit & Capital Engine');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a2');
select is((select count(*) from programs), 1::bigint, 'the leader of a community that runs the programme sees who sponsors it');
set local role postgres;

-- ------------------------------------------------------------------ mandates

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a7');
select is(
  (select kind::text || ' ' || array_to_string(purposes, ',') from set_mandate('impact_fund', 'pgTAP Fund', true, '{PE}', '{inventory,equipment}')),
  'impact_fund inventory,equipment', 'an investor sets its mandate as an impact fund');
select throws_ok($$ select set_mandate('individual', p_min_ticket_cents => 500000, p_max_ticket_cents => 100000) $$,
  '23514', null, 'a mandate''s ticket range is ordered');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a8');
select is((select count(*) from investor_mandates), 0::bigint, 'another investor cannot read it');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');
select throws_ok($$ select set_mandate('individual') $$, '42501', 'only_investors_set_a_mandate', 'an entrepreneur sets no mandate');
set local role postgres;

select * from finish();
rollback;
