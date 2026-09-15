-- Community Intelligence: where each participant stands, what the community
-- could do next, who may see it, and that it never shows reported amounts.
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
-- Lia leads a verified community with Ana (ready, asking), Bia (nothing yet)
-- and Cida (manual review). Olga leads another community.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'ci-admin@test'),
  ('00000000-0000-0000-0000-0000000005a2', 'ci-lia@test'),
  ('00000000-0000-0000-0000-0000000005a3', 'ci-ana@test'),
  ('00000000-0000-0000-0000-0000000005a4', 'ci-olga@test'),
  ('00000000-0000-0000-0000-0000000005a5', 'ci-auditor@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000005a1';
update profiles set role = 'community_leader' where id in ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005a4');
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000005a5';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000005c1', 'pgTAP CI community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000005a2', 'verified', now(), '00000000-0000-0000-0000-0000000005a1'),
  ('00000000-0000-0000-0000-0000000005c2', 'pgTAP CI other', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000005a4', 'verified', now(), '00000000-0000-0000-0000-0000000005a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005a3', 'pgTAP Ana CI', 'Doces da Ana pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000005e2', null, 'pgTAP Bia CI', 'Costura Bia pgTAP', 'crafts'),
  ('00000000-0000-0000-0000-0000000005e3', null, 'pgTAP Cida CI', 'Salão Cida pgTAP', 'beauty'),
  ('00000000-0000-0000-0000-0000000005e4', null, 'pgTAP Olga member', 'Outra pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id, joined_at) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e1', '2026-07-01'),
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e2', '2026-07-03'),
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e3', '2026-07-05'),
  ('00000000-0000-0000-0000-0000000005c2', '00000000-0000-0000-0000-0000000005e4', '2026-07-05');

-- EmpowerFI's core programme: two modules. Ana and Cida finished it.
insert into education_programs (id, title) values ('00000000-0000-0000-0000-0000000005d0', 'pgTAP core');
insert into education_modules (id, program_id, position, title, estimated_minutes) values
  ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005d0', 1, 'pgTAP module 1', 20),
  ('00000000-0000-0000-0000-0000000005d2', '00000000-0000-0000-0000-0000000005d0', 2, 'pgTAP module 2', 20);
insert into education_progress (entrepreneur_id, module_id, status, completed_at)
select e, m, 'completed', '2026-07-20'
from unnest(array['00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005e3']::uuid[]) e,
     unnest(array['00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005d2']::uuid[]) m;

-- Ana and Cida reported July and August, with an unmistakable revenue figure.
insert into checkins (entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents, keeps_records, active_days)
select e, p, 7777777, 100000, 50000, 60000, true, 22
from unnest(array['00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005e3']::uuid[]) e,
     unnest(array['2026-07', '2026-08']) p;

set local role service_role;
select record_readiness_assessment('00000000-0000-0000-0000-0000000005e1',
  '{"as_of_period":"2026-08","months_reported":2,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":88,
    "components":{"preparation":25,"regularity":20,"data_quality":25,"business":18},
    "missing_requirements":[],"reason_codes":["KEEPS_RECORDS"]}'::jsonb,
  p_created_at => '2026-08-20');
select record_readiness_assessment('00000000-0000-0000-0000-0000000005e3',
  '{"as_of_period":"2026-08","months_reported":2,"records_kept_bps":10000,"inconsistencies":2}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"MANUAL_REVIEW","band":"MEDIUM","score":61,
    "components":{"preparation":25,"regularity":20,"data_quality":9,"business":7},
    "missing_requirements":[],"reason_codes":["DATA_INCONSISTENT"]}'::jsonb);
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a3');
select declare_credit_intent('equipment', 300000);
set local role postgres;

-- ------------------------------------------------------------------ access

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a4');
select throws_ok($$ select community_overview('00000000-0000-0000-0000-0000000005c1') $$, '42501', 'not_allowed_to_see_community',
  'another community''s leader cannot see it');
select throws_ok($$ select record_outreach('00000000-0000-0000-0000-0000000005c1', 'checkin_reminder',
    array['00000000-0000-0000-0000-0000000005e2']::uuid[]) $$, '42501', 'not_your_community',
  'nor log outreach for it');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a3');
select throws_ok($$ select community_participants('00000000-0000-0000-0000-0000000005c1') $$, '42501', null,
  'a participant does not see the leader''s view');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a5');
select lives_ok($$ select community_overview('00000000-0000-0000-0000-0000000005c1') $$, 'an auditor can');
set local role postgres;

-- ------------------------------------------------------------------ state

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a2');
create temp table ov as select community_overview('00000000-0000-0000-0000-0000000005c1') as v;
create temp table pp as select jsonb_array_elements(community_participants('00000000-0000-0000-0000-0000000005c1')) as p;

select is((select (v -> 'hero' ->> 'participants')::int from ov), 3, 'her community has three participants');
select is((select v ->> 'as_of_period' from ov), '2026-08', 'as of the latest month anyone reported');
select results_eq(
  $$ select (f ->> 'n')::int from ov, jsonb_array_elements(v -> 'funnel') f $$,
  $$ values (3), (2), (2), (1), (1), (0), (0), (0) $$,
  'the funnel: 3 joined, 2 educated with enough data, Ana ready and asking'
);
select results_eq(
  $$ select p ->> 'display_name', p ->> 'stage', p ->> 'next_action' from pp order by 1 $$,
  $$ values ('pgTAP Ana CI', 'credit_intent', 'capital_need_check'),
            ('pgTAP Bia CI', 'joined', 'checkin_reminder'),
            ('pgTAP Cida CI', 'data_sufficient', 'human_followup') $$,
  'each one''s stage and the next thing to do: confirm the need, remind, talk'
);
select is((select (v -> 'health' ->> 'checkin_completion_bps')::int from ov), 6667, 'two of three reported August');
select is((select (v -> 'health' ->> 'needs_human_followup')::int from ov), 1, 'one needs a human follow-up');
select ok((select v::text from ov) !~ '7777777' and (select string_agg(p::text, '') from pp) !~ '7777777',
  'no reported revenue anywhere in the leader''s view');

-- ------------------------------------------------------------------ outreach

select is(record_outreach('00000000-0000-0000-0000-0000000005c1', 'checkin_reminder',
  array['00000000-0000-0000-0000-0000000005e2']::uuid[], 'WhatsApp'), 1, 'Lia logs a reminder to Bia');
select ok(
  (select q ->> 'pending' = '0' and q ->> 'contacted' = '1'
   from jsonb_array_elements(community_overview('00000000-0000-0000-0000-0000000005c1') -> 'queue') q
   where q ->> 'action' = 'checkin_reminder'),
  'and Bia leaves the queue: contacted this week'
);
select record_outreach('00000000-0000-0000-0000-0000000005c1', 'human_followup',
  array['00000000-0000-0000-0000-0000000005e3']::uuid[]);
select throws_ok($$ select record_outreach('00000000-0000-0000-0000-0000000005c1', 'checkin_reminder',
    array['00000000-0000-0000-0000-0000000005e4']::uuid[]) $$, '22023', 'not_a_member',
  'she cannot log outreach to someone outside her community');
set local role postgres;

select results_eq(
  $$ select e.display_name, c.staff_minutes, c.borne_by::text from cost_events c
     join outreach_events o on o.id = c.fact_id join entrepreneurs e on e.id = o.entrepreneur_id
     where c.stage = 'outreach' order by 1 $$,
  $$ values ('pgTAP Bia CI', 5, 'community'), ('pgTAP Cida CI', 30, 'community') $$,
  'each contact is a cost to serve: five minutes for a reminder, thirty for a conversation'
);

-- ------------------------------------------------------------------ journey and cohorts

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a2');
create temp table j as select community_participant('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e3') as v;
select ok(
  (select array_agg(distinct t ->> 'kind') from j, jsonb_array_elements(v -> 'timeline') t)
    @> array['joined', 'education', 'checkin', 'readiness', 'outreach'],
  'Cida''s journey: joined, education, check-ins, readiness, the follow-up'
);
select ok((select v::text from j) !~ '7777777', 'with no reported amount in it');
select throws_ok($$ select community_participant('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e4') $$,
  '42501', 'not_a_member', 'nor a journey from outside her community');
select results_eq(
  $$ select c ->> 'intake', (c ->> 'participants')::int, (c -> 'funnel' ->> 'credit_intent')::int,
            (c -> 'need_by_purpose' -> 'equipment' ->> 'cents')::bigint
     from jsonb_array_elements(community_cohorts('00000000-0000-0000-0000-0000000005c1')) c $$,
  $$ values ('2026-07', 3, 1, 300000::bigint) $$,
  'the July cohort: three joined, one asking, R$ 3,000 of equipment'
);
set local role postgres;

select * from finish();
rollback;
