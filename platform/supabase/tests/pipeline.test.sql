-- The anchoring pipeline's database side: claiming, the single-worker lease,
-- and handing jobs back.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(11);

-- Start from an idle worker and no due jobs, whatever the database holds.
update private.anchor_worker set busy_until = '-infinity';
update chain_anchors set next_attempt_at = now() + interval '1 day' where status in ('pending', 'submitted');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'pipe-leader@test');
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000000f1';
insert into communities (id, name, kind, city, state, leader_id) values
  ('00000000-0000-0000-0000-0000000000f2', 'pgTAP Pipeline', 'other', 'Belém', 'PA', '00000000-0000-0000-0000-0000000000f1');
insert into chain_anchors (id, kind, entity_id) overriding system value values
  (900001, 'community', '00000000-0000-0000-0000-0000000000f2');
insert into chain_anchors (id, kind, entity_id, depends_on) overriding system value values
  (900002, 'community_verification', '00000000-0000-0000-0000-0000000000f2', 900001);

-- ------------------------------------------------------------------ claiming

set local role service_role;
select results_eq(
  $$ select id from claim_anchor_jobs(10) $$,
  $$ values (900001::bigint) $$,
  'a claim takes only jobs whose dependency has confirmed'
);
select results_eq(
  $$ select attempts, next_attempt_at > now() + interval '1 minute' from chain_anchors where id = 900001 $$,
  $$ values (1, true) $$,
  'and leases them: one attempt counted, hidden from other workers for a while'
);
select is((select count(*)::int from claim_anchor_jobs(10)), 0, 'so a second claim gets nothing');

select lives_ok($$ select release_anchor_jobs(array[900001::bigint], 0) $$, 'an untouched job can be handed back');
select results_eq(
  $$ select attempts, next_attempt_at <= now() from chain_anchors where id = 900001 $$,
  $$ values (0, true) $$,
  'without the unused claim counting as an attempt'
);

-- ---------------------------------------------------------------- the lease

select is(start_anchor_run(60), true, 'the first run gets the worker');
select is(start_anchor_run(60), null, 'a second run does not');
select lives_ok($$ select finish_anchor_run() $$, 'the run releases it');
select is(start_anchor_run(60), true, 'and the next run gets it');
select finish_anchor_run();
set local role postgres;

-- ------------------------------------------------------------------- access

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select start_anchor_run(60) $$, '42501', null, 'users cannot take the worker');
select throws_ok($$ select claim_anchor_jobs(10) $$, '42501', null, 'or claim jobs');
set local role postgres;

select * from finish();
rollback;
