-- Invest with shielded ZEC: payment requests, the watcher's record of what the
-- treasury received, the operator's credit to the vault, and the auditor's view.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(39);

-- ------------------------------------------------------------------ fixtures
-- One partner, one community, Rita ready and asking. Wanda invests from a
-- wallet; Yara too; an auditor; the partner.

update partners set active = false where name not like 'pgTAP %';
-- Every request here is funded in USDC: the global pool takes any of them.
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}' where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000005f1', 'pgTAP Zcash partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'z-admin@test'),
  ('00000000-0000-0000-0000-0000000005a2', 'z-lia@test'),
  ('00000000-0000-0000-0000-0000000005a3', 'z-rita@test'),
  ('00000000-0000-0000-0000-0000000005a5', 'z-paulo@test'),
  ('00000000-0000-0000-0000-0000000005a6', 'z-audit@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000005a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000005a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000005f1' where id = '00000000-0000-0000-0000-0000000005a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000005a6';

insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA5555555555555555555555555555555555555","chain":"solana"}}'),
  ('00000000-0000-0000-0000-0000000005b2', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"YaRa55555555555555555555555555555555555555","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000005c1', 'pgTAP Zcash community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000005a2', 'verified', now(), '00000000-0000-0000-0000-0000000005a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005a3', 'pgTAP Rita Zcash', 'Bolos da Rita pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id)
values ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e1');
insert into chain_anchors (kind, entity_id) values ('enrollment', '00000000-0000-0000-0000-0000000005e1');
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);

set local role service_role;
select record_readiness_assessment('00000000-0000-0000-0000-0000000005e1',
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb);
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;

set local role service_role;
select record_eligibility_assessment(e.id,
  (select id from credit_intents where entrepreneur_id = e.id),
  (select id from readiness_assessments where entrepreneur_id = e.id),
  '{}'::jsonb,
  jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
    'requested_amount_cents', 200000, 'proposed_amount_cents', 200000,
    'term_months', 12, 'instalment_cents', 20000, 'max_instalment_cents', 27500, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb))
from entrepreneurs e where e.id = '00000000-0000-0000-0000-0000000005e1';
set local role postgres;

create temp table rita as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000005e1';
grant select on rita to authenticated, service_role;
create temp table req (name text primary key, id uuid, ref text);
grant select, insert on req to service_role, authenticated;

-- ------------------------------------------------------------- the treasury

set local role service_role;
select throws_ok(
  $$ select create_zcash_request('00000000-0000-0000-0000-0000000005b1', (select id from rita), 10000000, 5000, 'demo') $$,
  'P0001', 'zcash_not_configured', 'no request before EmpowerFI has a treasury'
);
select throws_ok(
  $$ select zcash_configure_treasury('test', 'u1mainnetaddress', 'uviewtest1abc', 100) $$,
  '22023', 'not_a_unified_address', 'a testnet treasury takes a testnet unified address'
);
select lives_ok(
  $$ select zcash_configure_treasury('test', 'utest1treasuryaddress', 'uviewtest1treasurykey', 100) $$,
  'the treasury is its address, its viewing key and the height it was born at'
);
select results_eq(
  $$ select zcash_watch_state() ->> 'from_height', zcash_watch_state() ->> 'ufvk' $$,
  $$ values ('100', 'uviewtest1treasurykey') $$,
  'the watcher starts at the birthday, with the viewing key'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select throws_ok(
  $$ select create_zcash_request(auth.uid(), (select id from rita), 10000000, 5000, 'demo') $$,
  '42501', null, 'an investor asks through the function, which fetches the quote, never directly'
);
select throws_ok($$ select zcash_watch_state() $$, '42501', null, 'nor reads the viewing key');
set local role postgres;

-- ---------------------------------------------------------------- requests

set local role service_role;
insert into req select 'wanda', (r ->> 'id')::uuid, r ->> 'ref'
from (select create_zcash_request('00000000-0000-0000-0000-0000000005b1', (select id from rita), 10000000, 5000, 'demo') r) x;
select results_eq(
  $$ select amount_zat, status::text, ref ~ '^EFI-[A-Z0-9]{10}$' from zcash_payment_requests where id = (select id from req where name = 'wanda') $$,
  $$ values (20000000::bigint, 'awaiting', true) $$,
  '10 USDC at 50 dollars a ZEC asks for 0.2 ZEC, under a random reference'
);
select ok(
  (select r ->> 'memo' = 'EmpowerFI allocation ' || (r ->> 'ref') and r ->> 'address' = 'utest1treasuryaddress'
   from (select zcash_request((select id from req where name = 'wanda')) r) x),
  'paid to the treasury, with the reference in the memo'
);
select throws_ok(
  $$ select create_zcash_request('00000000-0000-0000-0000-0000000005b2', (select id from rita), (select target from rita), 5000, 'demo') $$,
  '22023', 'exceeds_remaining', 'an unpaid request holds its share: no one can ask for the whole target now'
);
select is(private.zcash_room((select id from rita)), (select target from rita) - 10000000,
  'the room left is the target less what live requests hold');
select throws_ok(
  $$ select create_zcash_request('00000000-0000-0000-0000-0000000005b2', (select id from rita), 500000, 5000, 'demo') $$,
  '22023', 'amount_too_small', 'at least one USDC'
);
insert into req select 'yara-short', (r ->> 'id')::uuid, r ->> 'ref'
from (select create_zcash_request('00000000-0000-0000-0000-0000000005b2', (select id from rita), 5000000, 5000, 'demo') r) x;
insert into req select 'yara-late', (r ->> 'id')::uuid, r ->> 'ref'
from (select create_zcash_request('00000000-0000-0000-0000-0000000005b2', (select id from rita), 3000000, 5000, 'demo') r) x;
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select is((select zcash_request((select id from req where name = 'wanda')) ->> 'status'), 'awaiting',
  'Wanda follows her request');
select is((select count(*)::int from zcash_payment_requests), 1, 'and sees only her own');
select throws_ok($$ select zcash_request((select id from req where name = 'yara-short')) $$, '42501', 'not_your_request',
  'not Yara''s');
set local role postgres;

-- ---------------------------------------------------------------- watching

update zcash_payment_requests set expires_at = now() - interval '1 minute' where id = (select id from req where name = 'yara-late');

set local role service_role;
select results_eq(
  $$ select zcash_watch_record(100, 100, 'hash100', jsonb_build_array(
       jsonb_build_object('txid', 'aa01', 'pool', 'orchard', 'index', 0, 'value_zat', 20000000,
         'memo', 'EmpowerFI allocation ' || (select ref from req where name = 'wanda'), 'height', 100),
       jsonb_build_object('txid', 'aa02', 'pool', 'sapling', 'index', 1, 'value_zat', 1000,
         'memo', 'EmpowerFI allocation ' || (select ref from req where name = 'yara-short'), 'height', 100),
       jsonb_build_object('txid', 'aa03', 'pool', 'orchard', 'index', 0, 'value_zat', 777, 'memo', 'thanks', 'height', 100)
     )) $$,
  $$ values ('{"seen": 2, "to_credit": 0}'::jsonb) $$,
  'a scan matches two payments by their memos'
);
set local role postgres;
select results_eq(
  $$ select status::text, txid, pool, received_zat from zcash_payment_requests where id = (select id from req where name = 'wanda') $$,
  $$ values ('seen', 'aa01', 'orchard', 20000000::bigint) $$,
  'Wanda''s payment is seen in its block, not yet confirmed'
);
select is((select status::text from zcash_payment_requests where id = (select id from req where name = 'yara-late')), 'expired',
  'an unpaid request expires');
select results_eq(
  $$ select count(*)::int, count(request_id)::int from zcash_receipts $$,
  $$ values (3, 2) $$,
  'every note the key reads is kept, matched or not'
);
select is((select scanned_height from private.zcash_treasury), 100::bigint, 'and the watcher moves on');

set local role service_role;
select results_eq(
  $$ select zcash_watch_record(101, 101, 'hash101', jsonb_build_array(
       jsonb_build_object('txid', 'aa01', 'pool', 'orchard', 'index', 0, 'value_zat', 20000000,
         'memo', 'EmpowerFI allocation ' || (select ref from req where name = 'wanda'), 'height', 100))) $$,
  $$ values ('{"seen": 0, "to_credit": 1}'::jsonb) $$,
  'one more block: two confirmations, and the same note twice is kept once'
);
set local role postgres;
select results_eq(
  $$ select name, status::text from req join zcash_payment_requests z using (id) where name in ('wanda', 'yara-short') order by name $$,
  $$ values ('wanda', 'confirmed'), ('yara-short', 'underpaid') $$,
  'Wanda''s is confirmed; Yara''s paid less than asked and waits for a human'
);
select is((select count(*)::int from zcash_receipts), 3, 'no receipt was added twice');

-- ---------------------------------------------------------------- credit

set local role service_role;
-- A unit of 10 USDC, so that Wanda's payment is exactly one whole unit and this
-- file stays about the credit landing. The carry's arithmetic is its own file.
create temp table claimed as select zcash_batch_claim(10000000) as b;
select is(((select b from claimed)->>'requests')::int, 1, 'the batch claims Wanda''s payment');
select is(((select b from claimed)->>'credited_micro_usdc')::bigint, 10000000::bigint,
  'one whole unit is credited, nothing sent yet');
select is(((select b from claimed)->>'carried_out_micro_usdc')::bigint, 0::bigint, 'and nothing is carried');
select is((zcash_batch_claim(10000000)->>'resumed')::boolean, true,
  'a second run resumes the batch in flight instead of forming another');
select throws_ok($$ select zcash_batch_done((select (b->>'id')::uuid from claimed), 'sig-credit') $$,
  'P0001', 'batch_signature_mismatch',
  'it closes only against the signature recorded before sending');
select zcash_batch_sending((select (b->>'id')::uuid from claimed), 'sig-credit', 1000);
select lives_ok($$ select zcash_batch_done((select (b->>'id')::uuid from claimed), 'sig-credit') $$,
  'the credit lands');
set local role postgres;
select results_eq(
  $$ select i.mode::text, i.amount_micro_usdc, i.deposit_signature, i.wallet_address, z.status::text
     from zcash_payment_requests z join investments i on i.id = z.investment_id
     where z.credit_batch_id = (select (b->>'id')::uuid from claimed) $$,
  $$ values ('zcash', 10000000::bigint, null::text, 'WaNdA5555555555555555555555555555555555555', 'credited') $$,
  'it becomes Wanda''s allocation: mode zcash, and no transfer of her own'
);
select is(
  (select i.credit_batch_id from investments i where i.credit_batch_id is not null),
  (select (b->>'id')::uuid from claimed),
  'the batch is what her position is backed by'
);
select ok(
  exists (select 1 from chain_anchors a join zcash_payment_requests z on a.entity_id = z.investment_id
          where a.kind = 'allocation' and z.credit_batch_id = (select (b->>'id')::uuid from claimed)),
  'queued for Solana like any allocation'
);
select is((select funded_micro_usdc from qualified_credit_opportunities where id = (select id from rita)), 10000000::bigint,
  'and counts toward the opportunity');

-- A confirmed payment for an opportunity that filled meanwhile moves no USDC.
set local role service_role;
insert into req select 'yara-filled', (r ->> 'id')::uuid, r ->> 'ref'
from (select create_zcash_request('00000000-0000-0000-0000-0000000005b2', (select id from rita), 20000000, 5000, 'demo') r) x;
select zcash_watch_record(103, 103, 'hash103', jsonb_build_array(
  jsonb_build_object('txid', 'aa04', 'pool', 'ironwood', 'index', 0, 'value_zat', 40000000,
    'memo', 'EmpowerFI allocation ' || (select ref from req where name = 'yara-filled'), 'height', 102)));
select record_investment('00000000-0000-0000-0000-0000000005b1', (select id from rita), (select target from rita) - 10000000,
  'wallet', 'WaNdA5555555555555555555555555555555555555', 'sig-wanda-fill');
select ok(zcash_batch_claim(10000000) is null, 'a request whose opportunity filled forms no batch');
set local role postgres;
select results_eq(
  $$ select status::text, credit_batch_id, error from zcash_payment_requests where id = (select id from req where name = 'yara-filled') $$,
  $$ values ('failed', null::uuid, 'the opportunity closed or filled before the payment confirmed') $$,
  'it fails before any USDC moves, with the reason'
);

-- ------------------------------------------------------ refunds and audit

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a5');
select partner_decide((select id from rita), 'declined', p_reason => 'Outside our focus');
set local role postgres;
set local role service_role;
select ok(
  (select bool_or(amount_micro_usdc = 10000000 and wallet_address = 'WaNdA5555555555555555555555555555555555555') from refund_claim()),
  'a declined opportunity returns the ZEC allocation as USDC to the investor''s wallet'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select is((select count(*)::int from zcash_receipts), 0, 'an investor does not read the treasury''s receipts');
select throws_ok($$ select audit_zcash() $$, '42501', null, 'nor its audit');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a6');
select results_eq(
  $$ select audit_zcash() ->> 'ufvk', jsonb_array_length(audit_zcash() -> 'receipts'), (audit_zcash() ->> 'received_zat')::bigint $$,
  $$ values ('uviewtest1treasurykey', 4, 60001777::bigint) $$,
  'the auditor holds the viewing key and sees every note it reads'
);
select is((audit_system() -> 'vault' ->> 'zcash_micro_usdc')::bigint, 10000000::bigint,
  'and the vault''s expected balance counts the ZEC credit');
set local role postgres;

select * from finish();
rollback;
