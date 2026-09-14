-- Community flow and access rules, exercised as each role would.
--   npx supabase test db --workdir platform
begin;
-- Against a linked project the CLI connects as a restricted login role; act as
-- postgres for the whole transaction, and return to it (never `reset role`,
-- which would drop back to the login role) after acting as a user.
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- The CLI may have installed pgtap already, in a schema of its choosing.
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(40);

-- ------------------------------------------------------------------ fixtures

-- Five people. The auth trigger gives each an entrepreneur profile.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test', '{"display_name":"Ana Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'leader@test', '{"display_name":"Lia Leader"}'),
  ('00000000-0000-0000-0000-00000000000c', 'maria@test', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@test', '{"display_name":"Otto"}'),
  ('00000000-0000-0000-0000-00000000000e', 'auditor@test', '{"display_name":"Aud"}');

select is(
  (select count(*)::int from profiles where role = 'entrepreneur'), 5,
  'every new user gets an entrepreneur profile'
);
select is(
  (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000c'), 'maria',
  'with a name from metadata, or the email prefix'
);

-- Roles are granted by the service role, never by the user.
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-00000000000b';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-00000000000e';

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ------------------------------------------------------------------ profiles

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$ update profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null, 'a user cannot change her own role'
);
select lives_ok(
  $$ update profiles set display_name = 'Maria Silva' where id = auth.uid() $$,
  'but she can rename herself'
);
select is((select count(*)::int from profiles), 1, 'and she sees only her own profile');
select throws_ok(
  $$ insert into communities (name, kind, city, state, leader_id)
     values ('Nope', 'other', 'São Paulo', 'SP', auth.uid()) $$,
  '42501', null, 'nobody writes a table directly'
);
select throws_ok(
  $$ select create_community('Mine', 'collective', 'São Paulo', 'SP') $$,
  '42501', 'only_leaders_create_communities', 'an entrepreneur cannot create a community'
);
set local role postgres;

-- ------------------------------------------------------------ create/verify

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ select create_community('Mulheres do Grajaú', 'education_programme', ' São Paulo ', 'sp', 'Cohort 1') $$,
  'a leader creates a community'
);
select lives_ok(
  $$ select create_community('Coletivo Pendente', 'collective', 'Recife', 'PE') $$,
  'and a second one that will stay pending'
);
set local role postgres;

create temp table ids as
select
  (select id from communities where name = 'Mulheres do Grajaú') as grajau,
  (select id from communities where name = 'Coletivo Pendente') as pendente;
grant select on ids to authenticated;

select results_eq(
  $$ select status::text, city, state from communities where id = (select grajau from ids) $$,
  $$ values ('pending_verification', 'São Paulo', 'SP') $$,
  'it starts pending, with its fields trimmed and normalised'
);
select results_eq(
  $$ select kind::text, status::text, depends_on from chain_anchors where entity_id = (select grajau from ids) $$,
  $$ values ('community', 'pending', null::bigint) $$,
  'and its registration is queued for the chain'
);
select is(
  (select octet_length(chain_ref) from communities where id = (select grajau from ids)), 32,
  'with a 32-byte chain ref'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select verify_community((select grajau from ids)) $$,
  '42501', 'only_admins_verify_communities', 'a leader cannot verify, not even her own'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ select verify_community((select grajau from ids), 'Visited on site') $$,
  'an admin verifies it'
);
select throws_ok(
  $$ select verify_community((select grajau from ids)) $$,
  'P0001', 'community_already_reviewed', 'once'
);
select lives_ok(
  $$ select create_community('Admin Own', 'other', 'Salvador', 'BA') $$,
  'an admin can also lead a community'
);
select throws_ok(
  $$ select verify_community((select id from communities where name = 'Admin Own')) $$,
  '42501', 'cannot_verify_own_community', 'but cannot verify one she leads'
);
select throws_ok(
  $$ select reject_community((select pendente from ids), '  ') $$,
  '22023', 'rejection_needs_a_reason', 'a rejection needs a reason'
);
set local role postgres;

select results_eq(
  $$ select v.kind::text, v.depends_on = c.id
     from chain_anchors v, chain_anchors c
     where v.entity_id = (select grajau from ids) and v.kind = 'community_verification'
       and c.entity_id = (select grajau from ids) and c.kind = 'community' $$,
  $$ values ('community_verification', true) $$,
  'verification is queued, waiting on the registration'
);
select isnt(
  (select verified_by from communities where id = (select grajau from ids)), null,
  'and records who verified'
);

-- ------------------------------------------------------------------- enroll

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select enroll_entrepreneur((select pendente from ids), 'Joana') $$,
  'P0001', 'community_not_verified', 'nobody is enrolled in a community that is not verified'
);
select throws_ok(
  $$ select enroll_entrepreneur((select grajau from ids), '  ') $$,
  '22023', 'entrepreneur_needs_a_name', 'a new entrepreneur needs a name'
);
select lives_ok(
  $$ select enroll_entrepreneur((select grajau from ids), 'Joana Costa', 'Doces da Jô', 'food', 'São Paulo', 'SP') $$,
  'the leader enrolls an entrepreneur in her verified community'
);
set local role postgres;

create temp table joana as select id from entrepreneurs where display_name = 'Joana Costa';
grant select on joana to authenticated;

select is(
  (select octet_length(borrower_ref) from entrepreneurs where id = (select id from joana)), 32,
  'she gets a 32-byte borrower ref'
);
select results_eq(
  $$ select e.depends_on = v.id
     from chain_anchors e, chain_anchors v
     where e.kind = 'enrollment' and e.entity_id = (select id from joana)
       and v.kind = 'community_verification' and v.entity_id = (select grajau from ids) $$,
  $$ values (true) $$,
  'and her on-chain registration is queued, waiting on the verification'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select enroll_entrepreneur((select grajau from ids), p_entrepreneur_id => (select id from joana)) $$,
  '23505', 'already_a_member', 'she cannot be enrolled twice'
);
select throws_ok(
  $$ select borrower_ref from entrepreneurs $$,
  '42501', null, 'the leader cannot read borrower refs'
);
select is((select count(*)::int from entrepreneurs), 1, 'but sees the entrepreneur she enrolled');
select is((select count(*)::int from chain_anchors), 4, 'and every proof about the communities she leads and her member');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$ select enroll_entrepreneur((select grajau from ids), 'Intrusa') $$,
  '42501', 'only_the_leader_enrolls', 'someone else cannot enroll into her community'
);
select is((select count(*)::int from entrepreneurs), 0, 'an outsider sees no entrepreneurs');
select is((select count(*)::int from chain_anchors), 0, 'and no proofs');
select is(
  (select array_agg(name order by name) from communities), array['Mulheres do Grajaú'],
  'and only verified communities'
);
select throws_ok(
  $$ select audit_record('enrollment', (select id from joana)) $$,
  '42501', 'not_allowed_to_audit', 'and cannot audit'
);
set local role postgres;

-- -------------------------------------------------------------------- audit

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from chain_anchors), 5, 'an auditor sees every proof');
select is(
  length(audit_record('enrollment', (select id from joana)) ->> 'borrower_ref'), 64,
  'and gets the borrower ref, to recompute the account seed'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  audit_record('enrollment', (select id from joana)) ->> 'borrower_ref', null,
  'a leader can audit her member, without the ref'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(
    audit_record('community', (select grajau from ids)) -> 'payload') k),
  array['city', 'community_id', 'community_ref', 'created_at', 'kind', 'leader_id', 'name', 'state'],
  'a community commits to its identity, place and creation, nothing more'
);
select ok(
  (audit_record('enrollment', (select id from joana)) -> 'payload') ?& array['entrepreneur_id', 'community_id', 'joined_at']
  and not (audit_record('enrollment', (select id from joana)) -> 'payload') ? 'borrower_ref',
  'an enrollment commits to who, where and when — never the borrower ref'
);
set local role postgres;

set local role anon;
select throws_ok(
  $$ select create_community('Anon', 'other', 'Rio', 'RJ') $$,
  '42501', null, 'anonymous callers cannot reach the RPCs'
);
set local role postgres;

select * from finish();
rollback;
