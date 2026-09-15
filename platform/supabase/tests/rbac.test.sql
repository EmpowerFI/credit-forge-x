-- Role-based access, as a whole: the rules every table, view and function must
-- keep, and a matrix of who can read a person's data.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(22);

-- ---------------------------------------------------------------- structure
-- Checked from the catalog, so a table or function added later is held to
-- the same rules without anyone remembering to write a test for it.

select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null, 'every table has row-level security'
);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))),
  null, 'anonymous visitors can read or write no table or view'
);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
          or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  null, 'signed-in users write no table directly: every change goes through a checked function'
);
select is(
  (select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  null, 'every view runs as the caller, under the caller''s row-level security'
);
select is(
  (select array_agg(n.nspname || '.' || p.proname order by 1) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)),
  null, 'every security-definer function pins its search_path'
);
select is(
  (select array_agg(p.proname::text order by 1) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'EXECUTE')
     -- Trigger functions cannot be called, only fired (the hosted platform adds one of its own).
     and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)),
  null, 'anonymous visitors can call no function'
);
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'nor reach the private schema');
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'partner_id', 'UPDATE'),
  'nobody grants themselves a role or a partner'
);

-- ------------------------------------------------------------------ fixtures
-- Community A (leader Lia) with Eva, who reports, is assessed and asks.
-- Community B (leader Bia). A partner user, a capital provider, an auditor.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000003a1', 'r-admin@test'),
  ('00000000-0000-0000-0000-0000000003a2', 'r-lia@test'),
  ('00000000-0000-0000-0000-0000000003a3', 'r-bia@test'),
  ('00000000-0000-0000-0000-0000000003a4', 'r-eva@test'),
  ('00000000-0000-0000-0000-0000000003a5', 'r-paulo@test'),
  ('00000000-0000-0000-0000-0000000003a6', 'r-irene@test'),
  ('00000000-0000-0000-0000-0000000003a7', 'r-otavio@test'),
  ('00000000-0000-0000-0000-0000000003a8', 'r-ivo@test');
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents) values
  ('00000000-0000-0000-0000-0000000003f1', 'pgTAP RBAC partner', 'credit_union', 10000, 1000000);
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000003a1';
update profiles set role = 'community_leader' where id in ('00000000-0000-0000-0000-0000000003a2', '00000000-0000-0000-0000-0000000003a3');
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000003f1' where id = '00000000-0000-0000-0000-0000000003a5';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000003a6';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000003a7';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000003c1', 'pgTAP RBAC A', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000003a2', 'verified', now(), '00000000-0000-0000-0000-0000000003a1'),
  ('00000000-0000-0000-0000-0000000003c2', 'pgTAP RBAC B', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000003a3', 'verified', now(), '00000000-0000-0000-0000-0000000003a1');
insert into entrepreneurs (id, profile_id, display_name, business_sector) values
  ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003a4', 'pgTAP Eva', 'food');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e1');
insert into checkins (entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents, keeps_records, active_days)
values ('00000000-0000-0000-0000-0000000003e1', '2026-08', 400000, 150000, 50000, 90000, true, 22);

-- Consent as each participant's community recorded it (M14): all four scopes.
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);

set local role service_role;
select record_readiness_assessment('00000000-0000-0000-0000-0000000003e1',
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":95,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":20},
    "missing_requirements":[],"reason_codes":[]}'::jsonb);
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a4');
select declare_credit_intent('working_capital', 150000);
set local role postgres;

-- What each role sees of Eva: entrepreneur row, membership, check-ins,
-- readiness, request, and the cost of serving her.
create function pg_temp.sees_eva() returns int[] language sql as $$
  select array[
    (select count(*)::int from entrepreneurs where id = '00000000-0000-0000-0000-0000000003e1'),
    (select count(*)::int from community_memberships where entrepreneur_id = '00000000-0000-0000-0000-0000000003e1'),
    (select count(*)::int from checkins where entrepreneur_id = '00000000-0000-0000-0000-0000000003e1'),
    (select count(*)::int from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000003e1'),
    (select count(*)::int from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000003e1'),
    (select least(count(*), 1)::int from cost_events where entrepreneur_id = '00000000-0000-0000-0000-0000000003e1')
  ]
$$;
grant execute on function pg_temp.sees_eva() to authenticated;

-- -------------------------------------------------------------------- matrix

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a4');
select is(pg_temp.sees_eva(), array[1, 1, 1, 1, 1, 1], 'Eva sees all of her own record');
select is((select count(*)::int from profiles), 1, 'and only her own profile');
select throws_ok($$ update profiles set role = 'admin' where id = auth.uid() $$, '42501', null,
  'and cannot make herself an admin');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a2');
select is(pg_temp.sees_eva(), array[1, 1, 1, 1, 1, 1], 'the leader of her community sees her record');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a3');
select is(pg_temp.sees_eva(), array[0, 0, 0, 0, 0, 0], 'the leader of another community sees none of it');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a5');
select is(pg_temp.sees_eva(), array[0, 0, 0, 0, 0, 0], 'a credit partner sees none of it: opportunities reach it pseudonymous');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a6');
select is(pg_temp.sees_eva(), array[0, 0, 0, 0, 0, 0], 'a capital provider sees none of it');
select throws_ok($$ select cts_summary() $$, '42501', 'not_allowed_to_see_costs', 'nor the platform''s costs person by person');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a8');
select is(pg_temp.sees_eva(), array[0, 0, 0, 0, 0, 0], 'someone signed in with no role in her story sees none of it');
select throws_ok($$ select audit_record('readiness', (select id from readiness_assessments limit 1)) $$,
  '42501', 'not_allowed_to_audit', 'nor audits her proofs');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000003a7');
select is(pg_temp.sees_eva(), array[1, 1, 1, 1, 1, 1], 'the auditor reads everything');
select throws_ok($$ select declare_credit_intent('inventory', 100000) $$, '42501', null, 'and changes nothing: no request in her name');
select throws_ok($$ select verify_community('00000000-0000-0000-0000-0000000003c2') $$, '42501', null, 'no community verified');
set local role postgres;

set local role anon;
select throws_ok($$ select count(*) from checkins $$, '42501', null, 'anonymous: not even a count of check-ins');
set local role postgres;

select * from finish();
rollback;
