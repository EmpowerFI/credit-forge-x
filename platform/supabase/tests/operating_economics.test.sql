-- Operating economics: the desk, auditors and admins read cost to serve, time to
-- decision, discipline, follow-up and portfolio quality over everything; a
-- sponsor over its own programme; nobody else. Aggregates only.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(28);

-- ------------------------------------------------------------------ fixtures
-- Helena's foundation sponsors a programme run by Lia's community (Ana, Bia,
-- Cris). Olga's community (Dora) is outside it. Sara sponsors something else.
-- Paulo is the desk, Irene invests, Ana is an entrepreneur.

update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-000000000af1', 'pgTAP OE desk', 'other', 10000, 5000000, '{}');
insert into sponsors (id, name, kind) values
  ('00000000-0000-0000-0000-000000000ab1', 'pgTAP OE Foundation', 'foundation'),
  ('00000000-0000-0000-0000-000000000ab2', 'pgTAP OE Other', 'company');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000aa1', 'oe-admin@test'),
  ('00000000-0000-0000-0000-000000000aa2', 'oe-lia@test'),
  ('00000000-0000-0000-0000-000000000aa3', 'oe-ana@test'),
  ('00000000-0000-0000-0000-000000000aa4', 'oe-bia@test'),
  ('00000000-0000-0000-0000-000000000aa5', 'oe-helena@test'),
  ('00000000-0000-0000-0000-000000000aa6', 'oe-sara@test'),
  ('00000000-0000-0000-0000-000000000aa7', 'oe-irene@test'),
  ('00000000-0000-0000-0000-000000000aa8', 'oe-paulo@test'),
  ('00000000-0000-0000-0000-000000000aa9', 'oe-olga@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000aa1';
update profiles set role = 'community_leader' where id in ('00000000-0000-0000-0000-000000000aa2', '00000000-0000-0000-0000-000000000aa9');
update profiles set role = 'sponsor', sponsor_id = '00000000-0000-0000-0000-000000000ab1' where id = '00000000-0000-0000-0000-000000000aa5';
update profiles set role = 'sponsor', sponsor_id = '00000000-0000-0000-0000-000000000ab2' where id = '00000000-0000-0000-0000-000000000aa6';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-000000000aa7';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-000000000af1' where id = '00000000-0000-0000-0000-000000000aa8';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-000000000ac1', 'pgTAP OE community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-000000000aa2', 'verified', now(), '00000000-0000-0000-0000-000000000aa1'),
  ('00000000-0000-0000-0000-000000000ac2', 'pgTAP OE outside', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-000000000aa9', 'verified', now(), '00000000-0000-0000-0000-000000000aa1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000aa3', 'pgTAP Ana OE', 'Bolos OE pgTAP', 'food'),
  ('00000000-0000-0000-0000-000000000ae2', '00000000-0000-0000-0000-000000000aa4', 'pgTAP Bia OE', 'Doces OE pgTAP', 'food'),
  ('00000000-0000-0000-0000-000000000ae3', null, 'pgTAP Cris OE', 'Salgados OE pgTAP', 'food'),
  ('00000000-0000-0000-0000-000000000ae4', null, 'pgTAP Dora OE', 'Fora OE pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000ae1'),
  ('00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000ae2'),
  ('00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000ae3'),
  ('00000000-0000-0000-0000-000000000ac2', '00000000-0000-0000-0000-000000000ae4');
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e where e.display_name like 'pgTAP % OE';
-- Ana reports herself; the others' check-ins are typed in by the leader.
insert into checkins (entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents, keeps_records, active_days, submitted_by)
select e.id, '2026-09', 7777777, 100000, 50000, 60000, true, 22,
  case when e.profile_id is not null and e.display_name = 'pgTAP Ana OE' then e.profile_id else '00000000-0000-0000-0000-000000000aa2'::uuid end
from entrepreneurs e where e.display_name like 'pgTAP % OE';

insert into programs (id, sponsor_id, name, period_start, period_end, funding_committed_cents, funding_deployed_cents) values
  ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000ab1', 'pgTAP OE Programme', '2026-06-01', '2027-05-31', 10000000, 4000000),
  ('00000000-0000-0000-0000-000000000ad2', '00000000-0000-0000-0000-000000000ab2', 'pgTAP OE Other programme', '2026-06-01', '2027-05-31', 10000000, 0);
insert into program_communities (program_id, community_id) values
  ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000ac1'),
  ('00000000-0000-0000-0000-000000000ad2', '00000000-0000-0000-0000-000000000ac2');

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name in ('pgTAP Ana OE', 'pgTAP Bia OE');
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

select pg_temp.request_and_qualify('00000000-0000-0000-0000-000000000aa3', '00000000-0000-0000-0000-000000000ae1');
select pg_temp.request_and_qualify('00000000-0000-0000-0000-000000000aa4', '00000000-0000-0000-0000-000000000ae2');

-- ------------------------------------------------------------------ who reads

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa8');
select ok(
  (select bool_and(operating_economics() ? k) from unnest(array['cost', 'timing', 'discipline', 'capital', 'follow_up', 'quality']) k),
  'the desk reads cost to serve, time to decision, discipline, capital, follow-up and portfolio quality');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa5');
create temp table oe as select operating_economics('00000000-0000-0000-0000-000000000ad1') as v;
select throws_ok($$ select operating_economics() $$, '42501', 'not_allowed_to_see_costs', 'a sponsor does not read everything');
select throws_ok($$ select operating_economics('00000000-0000-0000-0000-000000000ad2') $$, '42501', 'not_allowed_to_see_costs',
  'nor another sponsor''s programme');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa7');
select throws_ok($$ select operating_economics() $$, '42501', 'not_allowed_to_see_costs', 'an investor reads no costs');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-000000000aa3');
select throws_ok($$ select operating_economics() $$, '42501', 'not_allowed_to_see_costs', 'nor does an entrepreneur');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-000000000aa2');
select throws_ok($$ select operating_economics('00000000-0000-0000-0000-000000000ad1') $$, '42501', 'not_allowed_to_see_costs',
  'nor a leader, who has her community''s own');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-000000000aa1');
select throws_ok($$ select operating_economics('00000000-0000-0000-0000-00000000dead') $$, 'P0002', 'program_not_found',
  'an unknown programme is not found');
set local role postgres;

-- ------------------------------------------------------------------ what it says

select is((select (v #>> '{scope,participants}')::int from oe), 3, 'the sponsor''s scope is the three members of the community running its programme');
select is(
  (select count(distinct e ->> 'stage')::int from oe, jsonb_array_elements(v #> '{cost,by_stage}') e),
  (select count(*)::int from cost_rates),
  'every stage of the rate card has its line, even when nothing happened there');
-- A check-in the leader types costs the platform its fee and the leader ten
-- minutes. One fact, two bearers, and the table says which is which.
select is(
  (select jsonb_agg(jsonb_build_object('borne_by', e -> 'borne_by', 'staff_minutes', e -> 'staff_minutes')
                    order by e ->> 'borne_by')
   from oe, jsonb_array_elements(v #> '{cost,by_stage}') e where e ->> 'stage' = 'checkin'),
  '[{"borne_by": "community", "staff_minutes": 20}, {"borne_by": "empowerfi", "staff_minutes": 0}]'::jsonb,
  'the leader''s twenty minutes are hers; the platform keeps only the fee it pays');
select is(
  (select sum((value ->> 'cents')::bigint)::bigint from oe, jsonb_each(v #> '{cost,by_bearer}')),
  (select (v #>> '{cost,total_cents}')::bigint from oe),
  'the bearers add up to the total, with nothing unattributed');
select ok((select (v #>> '{cost,total_cents}')::bigint > 0 from oe), 'enrolment, check-ins and engine runs have a cost');
select is((select v #> '{cost,per_100_disbursed_cents}' from oe), 'null'::jsonb, 'with nothing lent, there is no cost per R$ 100 lent');
select is(
  (select (v #>> '{follow_up,self_reported}')::int || '/' || (v #>> '{follow_up,checkins}') from oe), '1/3',
  'one check-in was self-reported, two were typed in by the leader');
select is(
  (select (x ->> 'n')::int from oe, jsonb_array_elements(v -> 'timing') x where x ->> 'step' = 'intent_to_eligibility'), 2,
  'two requests reached the eligibility engine, and are timed');
select is((select v #> '{discipline,decisions}' from oe), '{"ELIGIBLE": 2}'::jsonb, 'both were found eligible');
select is(
  (select array_agg(distinct k order by k) from oe, jsonb_path_query(v, 'strict $.**{1 to last}') x, jsonb_object_keys(case when jsonb_typeof(x) = 'object' then x else '{}' end) k
   where k in ('display_name', 'business_name', 'entrepreneur_id', 'revenue_cents')),
  null, 'no name, no business, no person id and no reported figure anywhere');
select ok((select v::text !~ '(pgTAP Ana|Bolos OE|7777777)' from oe), 'and none of their values');

-- -------------------------------------------- what the tool is sold for
-- Three participants sit far below the floor, which is what a floor is for: a
-- programme this small does not pay three seats, it pays the minimum.

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa7');
select throws_ok($$ select business_model() $$, '42501', 'not_allowed_to_see_costs', 'an investor reads no prices either');
set local role postgres;

-- Only the licence is seeded: one package is a contract shape the platform
-- supports and has no honest price for yet, so the test brings its own.
insert into pricing_cards (version, effective_from, source, billing_model, seat_cents, floor_cents, community_share_cents, note)
values ('pgTAP bundled', '2000-01-01', 'simulated', 'bundled', 10000, 150000, 1334, 'pgTAP: one package, the community''s share passed through');

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa5');
create temp table bm as select business_model('00000000-0000-0000-0000-000000000ad1') as v;
create temp table bm_bundled as select business_model('00000000-0000-0000-0000-000000000ad1', 'pgTAP bundled') as v;
set local role postgres;

select is((select v #>> '{pricing,billing_model}' from bm), 'tool_licence', 'by default the platform is sold as a tool');
select is((select (v #>> '{monthly,licence_cents}')::bigint from bm), 150000::bigint,
  'three participants pay the floor, not three seats');
select is((select (v #>> '{monthly,floor_applied}')::boolean from bm), true,
  'and the floor is said out loud, not hidden inside the number');
select is((select (v #>> '{monthly,passthrough_cents}')::bigint from bm), 0::bigint,
  'under separate contracts the sponsor pays the community, not us');
select ok((select (v #>> '{monthly,passthrough_cents}')::bigint > 0 from bm_bundled),
  'in one package her share is a cost of ours, and reads as one');
select is((select (v #>> '{borne_by,empowerfi_cents}')::bigint from bm),
  (select (v #>> '{cost,by_bearer,empowerfi,cents}')::bigint from oe),
  'and the two readings of who bore what agree');

-- ------------------------------------------- one opportunity, for its sponsor
-- A sponsor reads what one of its own participants' journeys cost, and the
-- programme's own number beside it. Nobody else's, and no leader's.

create temp table ana_opp as select id from qualified_credit_opportunities
  where entrepreneur_id = '00000000-0000-0000-0000-000000000ae1';
grant select on ana_opp to authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa5');
select is(
  (select opportunity_economics((select id from ana_opp))
          #>> '{programme,program_id}'),
  '00000000-0000-0000-0000-000000000ad1',
  'the programme beside her costs is the sponsor''s own, not everyone''s');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa6');
select throws_ok(
  $$ select opportunity_economics((select id from ana_opp)) $$,
  '42501', 'not_allowed_to_see_costs', 'another sponsor reads nothing of it');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-000000000aa2');
select throws_ok(
  $$ select opportunity_economics((select id from ana_opp)) $$,
  '42501', 'not_allowed_to_see_costs', 'nor a community leader, who has her community''s own costs');
set local role postgres;

select * from finish();
rollback;
