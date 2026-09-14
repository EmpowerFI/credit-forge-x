-- The anchoring pipeline's database side: claiming, the single-worker lease,
-- handing jobs back, and reconciliation.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(17);

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

-- ----------------------------------------------------------- reconciliation
-- Only this test's proof is due a check, whatever else the database holds.

update chain_anchors set reconciled_at = now() where status = 'confirmed';
update chain_anchors set status = 'confirmed', commitment = extensions.gen_random_bytes(32), signature = 'sig-900001',
  slot = 1, account_address = 'acct-900001', confirmed_at = now()
where id = 900001;

set local role service_role;
select results_eq(
  $$ select id, payload is not null from claim_reconcile_batch(10) $$,
  $$ values (900001::bigint, true) $$,
  'reconciliation picks up confirmed proofs never checked, with the record as it is now'
);
select is(
  record_reconciliation('[{"id": 900001, "result": "mismatch", "note": "the record changed after it was proven"},
                          {"id": 900002, "result": "verified"}]'::jsonb),
  1, 'it records outcomes for confirmed proofs only'
);
select results_eq(
  $$ select reconcile::text, reconcile_note, reconciled_at is not null from chain_anchors where id = 900001 $$,
  $$ values ('mismatch', 'the record changed after it was proven', true) $$,
  'with what it found'
);
select is((select count(*)::int from claim_reconcile_batch(10)), 0, 'and does not check it again the same day');
set local role postgres;

-- ------------------------------------------------------------------- access

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select start_anchor_run(60) $$, '42501', null, 'users cannot take the worker');
select throws_ok($$ select claim_anchor_jobs(10) $$, '42501', null, 'or claim jobs');
select throws_ok($$ select claim_reconcile_batch(10) $$, '42501', null, 'or read the reconciliation queue');
select throws_ok($$ select record_reconciliation('[]') $$, '42501', null, 'or write its results');
set local role postgres;

select * from finish();
rollback;
