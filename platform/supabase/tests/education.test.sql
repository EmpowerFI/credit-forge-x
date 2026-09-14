-- Education progress, and the demo reset.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'edu-admin@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'edu-leader@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'edu-maria@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'edu-outsider@test', '{}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000000e2';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000000c1', 'pgTAP Edu Community', 'education_programme', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000000e2', 'verified', now(), '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c2', 'pgTAP Other Community', 'collective', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000000e1', 'verified', now(), '00000000-0000-0000-0000-0000000000e1');

-- Maria has a login and belongs to the community; Joana was enrolled by the
-- leader and has none; Rita belongs to no community the leader runs.
insert into entrepreneurs (id, profile_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e3', 'pgTAP Maria'),
  ('00000000-0000-0000-0000-0000000000a2', null, 'pgTAP Joana'),
  ('00000000-0000-0000-0000-0000000000a3', null, 'pgTAP Rita');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a3');

insert into education_programs (id, title, community_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'pgTAP Credit readiness', null),
  ('00000000-0000-0000-0000-0000000000b2', 'pgTAP Other community only', '00000000-0000-0000-0000-0000000000c2');
insert into education_modules (id, program_id, position, title, estimated_minutes) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 1, 'Cash flow', 30),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 2, 'Pricing', 30),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b2', 1, 'Cooperative books', 45);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- -------------------------------------------------------------- entrepreneur

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select lives_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'in_progress') $$,
  'an entrepreneur records her own progress'
);
select lives_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'completed') $$,
  'and completes the module'
);
select lives_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'in_progress') $$,
  'marking it in progress again is accepted'
);
select results_eq(
  $$ select status::text, completed_at is not null from education_progress
     where entrepreneur_id = '00000000-0000-0000-0000-0000000000a1' and module_id = '00000000-0000-0000-0000-0000000000d1' $$,
  $$ values ('completed', true) $$,
  'but a completed module stays completed'
);
select throws_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', 'completed') $$,
  '42501', 'not_allowed_to_record_progress', 'she cannot record progress for someone else'
);
select throws_ok(
  $$ insert into education_progress (entrepreneur_id, module_id, status)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', 'in_progress') $$,
  '42501', null, 'nor write the table directly'
);
select is((select count(*)::int from education_progress), 1, 'she sees only her own progress');
select is(
  (select count(*)::int from education_modules where program_id = '00000000-0000-0000-0000-0000000000b1'), 2,
  'and can read the programme'
);
set local role postgres;

-- -------------------------------------------------------------------- leader

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select lives_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', 'completed') $$,
  'a leader records progress for a member who has no login'
);
select is(
  (select recorded_by from education_progress where entrepreneur_id = '00000000-0000-0000-0000-0000000000a2'),
  '00000000-0000-0000-0000-0000000000e2'::uuid,
  'and is recorded as the one who marked it'
);
select throws_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1', 'completed') $$,
  '42501', 'not_allowed_to_record_progress', 'but not for someone outside her communities'
);
select is((select count(*)::int from education_progress), 2, 'and sees her members'' progress only');
set local role postgres;

-- A community programme is for that community's members.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ select record_education_progress('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d3', 'completed') $$,
  'P0001', 'programme_not_open_to_her', 'a community programme is not open to non-members'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e4');
select is((select count(*)::int from education_progress), 0, 'an outsider sees no progress');
set local role postgres;

-- ---------------------------------------------------------------- demo reset

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ select reset_demo_data('reset empowerfi-hackathon demo data') $$,
  '42501', null, 'not even an admin can reset the demo from the app'
);
set local role postgres;

create temp table maria_ref as
select borrower_ref from entrepreneurs where id = '00000000-0000-0000-0000-0000000000a1';

set local role service_role;
select throws_ok(
  $$ select reset_demo_data('yes') $$,
  '22023', 'confirmation_phrase_required', 'the service role needs the exact phrase'
);
select lives_ok(
  $$ select reset_demo_data('reset empowerfi-hackathon demo data') $$,
  'and with it, resets'
);
set local role postgres;

select is(
  (select count(*)::int from communities) + (select count(*)::int from education_programs)
    + (select count(*)::int from entrepreneurs where profile_id is null),
  0, 'communities, programmes and login-less entrepreneurs are gone'
);
select ok(
  (select borrower_ref from entrepreneurs where id = '00000000-0000-0000-0000-0000000000a1')
    <> (select borrower_ref from maria_ref),
  'an entrepreneur with a login keeps her record, under a fresh borrower ref'
);

select * from finish();
rollback;
