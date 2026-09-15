-- Shareable audit reports: only auditors make them, anyone with the link
-- reads them, revoking closes the link, and nothing personal is in them.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'r-admin@test'),
  ('00000000-0000-0000-0000-0000000008a2', 'r-lia@test'),
  ('00000000-0000-0000-0000-0000000008a3', 'r-rosa@test'),
  ('00000000-0000-0000-0000-0000000008a6', 'r-audit@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000008a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000008a2';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000008a6';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000008c1', 'pgTAP Report community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000008a2', 'verified', now(), '00000000-0000-0000-0000-0000000008a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008a3', 'pgTAP Rosa Report', 'Doces da Rosa pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008e1');
insert into chain_anchors (kind, entity_id, status, commitment, signature, account_address, slot, confirmed_at)
values ('enrollment', '00000000-0000-0000-0000-0000000008e1', 'confirmed', extensions.gen_random_bytes(32),
  'sigREPORT1', 'AccReport1111111111111111111111111111111111', 42, now());
select zcash_configure_treasury('test', 'utest1reportaddress', 'uviewtest1reportviewingkeysecret', 4000000);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a2');
select throws_ok($$ select create_audit_report('Mine') $$, '42501', 'not_an_auditor', 'a community leader cannot make a report');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a6');
create temp table made as
  select create_audit_report('Hackathon review', '{"models":{"checked":24,"reproduced":24}}'::jsonb) as r;
select record_audit_report_checks((select (r ->> 'id')::uuid from made), '{"chain":{"proofs":{"checked":1,"landed":1}}}'::jsonb);
set local role postgres;
grant select on made to anon, authenticated;

select ok((select (r ->> 'token') ~ '^[0-9a-f]{48}$' from made), 'the link carries a 24-byte random token');

set local role anon;
create temp table shared as select shared_audit_report((select r ->> 'token' from made)) as s;
set local role postgres;

select is((select s ->> 'title' from shared), 'Hackathon review', 'anyone with the link reads it, signed in or not');
select is((select (s -> 'checks' -> 'models' ->> 'reproduced')::int from shared), 24, 'with the auditor''s own checks beside it');
select is((select (s -> 'checks' -> 'chain' -> 'proofs' ->> 'landed')::int from shared), 1, 'including those run on the report''s own proofs after it was made');
select ok((select (s -> 'snapshot' -> 'anchors' ->> 'confirmed')::int >= 1 from shared), 'and the proofs as counted when it was made');
select ok((select exists (select 1 from jsonb_array_elements(s -> 'snapshot' -> 'proofs') p where p ->> 'signature' = 'sigREPORT1') from shared),
  'each recent proof by its commitment, account and transaction');
select is((select s -> 'snapshot' -> 'zcash' ->> 'address' from shared), 'utest1reportaddress', 'the treasury by its address');
select ok((select s::text not like '%uviewtest1reportviewingkeysecret%' from shared), 'never its viewing key');
select ok((select s::text not like '%pgTAP Rosa%' and s::text not like '%Doces da Rosa%' and s::text not like '%P-000000%' from shared),
  'nor any name, business name or participant code');
select ok((select not (s -> 'snapshot' -> 'proofs' -> 0 ? 'entity_id') from shared), 'nor the records behind the proofs');

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a6');
select revoke_audit_report((select (r ->> 'id')::uuid from made));
set local role postgres;
set local role anon;
select throws_ok(format('select shared_audit_report(%L)', (select r ->> 'token' from made)), 'P0002', 'report_not_found',
  'revoked, the link closes');
select throws_ok($$ select shared_audit_report('00') $$, 'P0002', 'report_not_found', 'and a guessed token finds nothing');
set local role postgres;

select * from finish();
rollback;
