-- Returns in shielded ZEC: a ZEC investor without a Solana wallet gives a
-- return address, and their instalment shares and refunds are owed back as
-- ZEC — claimed once, sent once, recorded with the transaction.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(21);

-- ------------------------------------------------------------------ fixtures
-- Rita's request, approved and repaying: Zed paid 50 USDC of it in ZEC.
-- Sara's, declined: Yan paid 30 in ZEC. Neither has a Solana wallet.

update partners set active = false where name not like 'pgTAP %';
-- Every request here is funded in USDC: the global pool takes any of them.
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}' where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000009f1', 'pgTAP Returns partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'z-admin@test'),
  ('00000000-0000-0000-0000-0000000009a2', 'z-lia@test'),
  ('00000000-0000-0000-0000-0000000009a3', 'z-rita@test'),
  ('00000000-0000-0000-0000-0000000009a4', 'z-sara@test'),
  ('00000000-0000-0000-0000-0000000009a5', 'z-paulo@test'),
  ('00000000-0000-0000-0000-0000000009a6', 'z-audit@test'),
  ('00000000-0000-0000-0000-0000000009a7', 'z-zed@test'),
  ('00000000-0000-0000-0000-0000000009a8', 'z-yan@test'),
  ('00000000-0000-0000-0000-0000000009a9', 'z-sim@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000009a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000009a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000009f1' where id = '00000000-0000-0000-0000-0000000009a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000009a6';
update profiles set role = 'capital_provider' where id in
  ('00000000-0000-0000-0000-0000000009a7', '00000000-0000-0000-0000-0000000009a8', '00000000-0000-0000-0000-0000000009a9');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000009c1', 'pgTAP Returns community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000009a2', 'verified', now(), '00000000-0000-0000-0000-0000000009a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009a3', 'pgTAP Rita Returns', 'Bolos pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009a4', 'pgTAP Sara Returns', 'Ateliê pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000009c1', id from entrepreneurs where display_name like 'pgTAP % Returns';
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Returns';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);
select zcash_configure_treasury('test', 'utest1treasury', 'uviewtest1treasurykey', 4000000);

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Returns';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a4');
select declare_credit_intent('equipment', 150000);
set local role postgres;

set local role service_role;
select record_eligibility_assessment(e.id,
  (select id from credit_intents where entrepreneur_id = e.id),
  (select id from readiness_assessments where entrepreneur_id = e.id),
  '{}'::jsonb,
  jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
    'requested_amount_cents', (select requested_amount_cents from credit_intents where entrepreneur_id = e.id),
    'proposed_amount_cents', (select requested_amount_cents from credit_intents where entrepreneur_id = e.id),
    'term_months', 6, 'instalment_cents', 36000, 'max_instalment_cents', 40000, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb))
from entrepreneurs e where e.display_name like 'pgTAP % Returns';
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities where entrepreneur_id = '00000000-0000-0000-0000-0000000009e1';
create temp table opp2 as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities where entrepreneur_id = '00000000-0000-0000-0000-0000000009e2';
grant select on opp, opp2 to authenticated, service_role;

set local role service_role;
select record_investment('00000000-0000-0000-0000-0000000009a7', (select id from opp), 50000000, 'zcash', null, 'sig-zed-credit');
select record_investment('00000000-0000-0000-0000-0000000009a9', (select id from opp), (select target from opp) - 50000000,
  'simulated', p_is_simulated => true);
select record_investment('00000000-0000-0000-0000-0000000009a8', (select id from opp2), 30000000, 'zcash', null, 'sig-yan-credit');
set local role postgres;
create temp table zed as select id from investments where investor_id = '00000000-0000-0000-0000-0000000009a7';
create temp table yan as select id from investments where investor_id = '00000000-0000-0000-0000-0000000009a8';
grant select on zed, yan to authenticated, service_role;
insert into zcash_payment_requests (ref, investor_id, opportunity_id, amount_micro_usdc, usd_per_zec_cents, quote_source, amount_zat,
  status, investment_id, credit_signature, expires_at) values
  ('EFI-ZEDRETURN1', '00000000-0000-0000-0000-0000000009a7', (select id from opp), 50000000, 114000, 'coingecko', 4386000,
   'credited', (select id from zed), 'sig-zed-credit', now()),
  ('EFI-YANRETURN1', '00000000-0000-0000-0000-0000000009a8', (select id from opp2), 30000000, 114000, 'coingecko', 2632000,
   'credited', (select id from yan), 'sig-yan-credit', now());

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
select partner_decide((select id from opp), 'approved', 200000, 300, 6);
select transition_loan((select id from loans where opportunity_id = (select id from opp)), 'DISBURSED', 'Pix sent');
select transition_loan((select id from loans where opportunity_id = (select id from opp)), 'ACTIVE');
select record_payment((select id from loans where opportunity_id = (select id from opp)), 1, 36000);
set local role postgres;

-- ------------------------------------------------------------------ payouts

select results_eq(
  $$ select status::text from settlement_legs where kind = 'payout' and investment_id = (select id from zed) $$,
  $$ values ('held') $$, 'Zed''s share of instalment 1 is held: no wallet to pay it to'
);
select is((select count(*)::int from zcash_returns), 0, 'and nothing is owed in ZEC while there is no address');

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a8');
select throws_ok(format('select set_zcash_return_address(%L, %L)', (select id from zed), 'utest1' || repeat('q', 80)),
  '42501', 'not_your_position', 'nobody else sets where Zed''s ZEC goes');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a7');
select throws_ok(format('select set_zcash_return_address(%L, %L)', (select id from zed), 'u1' || repeat('q', 80)),
  '22023', 'invalid_zcash_address', 'a mainnet address is refused on testnet');
select throws_ok(format('select set_zcash_return_address(%L, %L)', (select id from zed), 'tmBsTi2xWTjUdEXnuTceL7fecEQKeWaPDJd'),
  '22023', 'invalid_zcash_address', 'and so is a transparent one: returns stay shielded');
select is((select (set_zcash_return_address((select id from zed), ' UTEST1' || repeat('Q', 80)) ->> 'payouts_queued')::int), 1,
  'a unified testnet address is taken, and the held share is queued');
set local role postgres;

select results_eq(
  $$ select kind, status::text, address, amount_micro_usdc = (select amount_micro_usdc from settlement_legs where kind = 'payout' and investment_id = (select id from zed))
     from zcash_returns $$,
  $$ values ('payout', 'due', 'utest1' || repeat('q', 80), true) $$,
  'owed in ZEC: the share, to the address as given, lower-cased'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
select record_payment((select id from loans where opportunity_id = (select id from opp)), 2, 36000);
set local role postgres;
select is((select count(*)::int from zcash_returns where kind = 'payout' and status = 'due'), 2,
  'the next instalment''s share is owed at once, now there is an address');

-- ----------------------------------------------------------- the operator

set local role service_role;
create temp table claimed as select * from zcash_returns_claim(5);
select results_eq($$ select count(*)::int, min(ref), array_agg(instalment_no order by instalment_no) from claimed $$,
  $$ values (2, 'EFI-ZEDRETURN1', array[1, 2]) $$, 'the operator claims both, with the reference and instalment each pays');
select is((select count(*)::int from zcash_returns_claim(5)), 0, 'claimed once: a second run finds nothing to send');

select zcash_return_release((select id from claimed where instalment_no = 2), 'quote unavailable');
select zcash_return_sent((select id from claimed where instalment_no = 1), repeat('ab', 32), 44000, 114000);
select throws_ok(format('select zcash_return_sent(%L, %L, 1, 1)', (select id from claimed where instalment_no = 1), repeat('cd', 32)),
  'P0001', 'return_not_sending', 'and never recorded as sent twice');
set local role postgres;

select results_eq(
  $$ select r.status::text, l.status::text from zcash_returns r join settlement_legs l on l.id = r.leg_id order by r.status $$,
  $$ values ('due', 'held'), ('sent', 'done') $$,
  'sent: its leg is done; released: back in the queue, its leg still held'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a7');
select results_eq(
  $$ select r ->> 'status', r ->> 'txid', (r ->> 'amount_zat')::bigint
     from jsonb_array_elements(zcash_position_returns((select id from zed)) -> 'returns') r where r ->> 'status' = 'sent' $$,
  $$ values ('sent', repeat('ab', 32), 44000::bigint) $$, 'Zed sees the ZEC sent, with its transaction'
);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a8');
select throws_ok(format('select zcash_position_returns(%L)', (select id from zed)), '42501', 'not_your_position', 'Yan does not');
set local role postgres;

-- ------------------------------------------------------------------ refunds

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a5');
select partner_decide((select id from opp2), 'declined', p_reason => 'Outside our focus');
set local role postgres;

set local role service_role;
select is((select count(*)::int from refund_claim(5) where id = (select id from yan)), 0,
  'Yan''s refund waits: no wallet and no return address to send it to');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a7');
select throws_ok(format('select set_zcash_request_return_address(%L, %L)',
  (select id from zcash_payment_requests where ref = 'EFI-YANRETURN1'), 'ztestsapling1' || repeat('x', 70)),
  '42501', 'not_your_request', 'a request''s return address is its investor''s to give');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a8');
select is((select set_zcash_request_return_address((select id from zcash_payment_requests where ref = 'EFI-YANRETURN1'),
  'ztestsapling1' || repeat('x', 70)) ->> 'return_address'), 'ztestsapling1' || repeat('x', 70),
  'Yan gives a Sapling address through the request');
set local role postgres;
update investments set refund_claimed_at = null where id = (select id from yan);

set local role service_role;
select results_eq($$ select wallet_address, amount_micro_usdc from refund_claim(5) where id = (select id from yan) $$,
  $$ values (null::text, 30000000::bigint) $$, 'with an address, it is claimed: its USDC goes back to the ramp, not a wallet');
select refund_sending((select id from yan), 'sig-yan-refund', 999);
select refund_done((select id from yan), 'sig-yan-refund');
set local role postgres;

select results_eq(
  $$ select kind, status::text, amount_micro_usdc, address from zcash_returns where investment_id = (select id from yan) $$,
  $$ values ('refund', 'due', 30000000::bigint, 'ztestsapling1' || repeat('x', 70)) $$,
  'once the vault has returned it, the ZEC is owed back to Yan''s Sapling address'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a6');
select results_eq(
  $$ select (audit_zcash_returns() -> 'counts' ->> 'due')::int, (audit_zcash_returns() -> 'counts' ->> 'sent')::int,
            (audit_zcash_returns() ->> 'sent_zat')::bigint $$,
  $$ values (2, 1, 44000::bigint) $$, 'the auditor sees what the treasury owes and what it paid back'
);
select ok((select audit_zcash_returns()::text not like '%utest1qqqq%'), 'by transaction, never by the investor''s address');
set local role postgres;

select * from finish();
rollback;
