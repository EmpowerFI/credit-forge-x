-- The vault sees a batch, not a person.
--
-- Credits are made in batches, rounded down to whole units, and the remainder
-- waits for the next batch. Three properties are worth a test, and they are the
-- ones that cost money if they are wrong:
--
--   the carry never reaches one whole unit, so the shortfall the rounding
--   creates is bounded no matter how many batches run;
--
--   a batch closes once, so a transfer that landed is never sent or booked
--   twice;
--
--   a failed batch releases its payments and does not consume the carry, so a
--   transfer that never landed costs a retry rather than an investor's money.
--
-- Rounding down is the direction that matters: the operator never moves money it
-- has not received. Rounding up would commit money that has not arrived, and
-- applied per batch it would accumulate without bound.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(23);

-- ------------------------------------------------------------------ fixtures
-- One request of Lena's, paid in shielded ZEC by five investors in amounts
-- chosen so that every batch below has a remainder. The unit is 10 USDC here,
-- small enough for a request this size; the product's is a thousand.

update partners set active = false where name not like 'pgTAP %';
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}' where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000009f1', 'pgTAP Batch partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a1', 'b-admin@test'),
  ('00000000-0000-0000-0000-0000000009a2', 'b-lia@test'),
  ('00000000-0000-0000-0000-0000000009a3', 'b-lena@test'),
  ('00000000-0000-0000-0000-0000000009a5', 'b-paulo@test'),
  ('00000000-0000-0000-0000-0000000009b1', 'b-one@test'),
  ('00000000-0000-0000-0000-0000000009b2', 'b-two@test'),
  ('00000000-0000-0000-0000-0000000009b3', 'b-three@test'),
  ('00000000-0000-0000-0000-0000000009b4', 'b-four@test'),
  ('00000000-0000-0000-0000-0000000009b5', 'b-five@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000009a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000009a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000009f1' where id = '00000000-0000-0000-0000-0000000009a5';
update profiles set role = 'capital_provider' where id in (
  '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009b2',
  '00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009b4',
  '00000000-0000-0000-0000-0000000009b5');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000009c1', 'pgTAP Batch community', 'association', 'Olinda', 'PE',
   '00000000-0000-0000-0000-0000000009a2', 'verified', now(), '00000000-0000-0000-0000-0000000009a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009a3', 'pgTAP Lena Batch', 'Doces pgTAP', 'food');
insert into community_memberships (community_id, entrepreneur_id)
  values ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009e1');
insert into chain_anchors (kind, entity_id) values ('enrollment', '00000000-0000-0000-0000-0000000009e1');
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values ('00000000-0000-0000-0000-0000000009e1', 1, 'consent-v1', true, true, true, true, 'community');
select zcash_configure_treasury('test', 'utest1batchtreasury', 'uviewtest1batchkey', 4000000);

set local role service_role;
select record_readiness_assessment('00000000-0000-0000-0000-0000000009e1',
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb);
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000009a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;

set local role service_role;
select record_eligibility_assessment('00000000-0000-0000-0000-0000000009e1',
  (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000009e1'),
  (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000009e1'),
  '{}'::jsonb,
  jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
    'requested_amount_cents', 200000, 'proposed_amount_cents', 200000,
    'term_months', 6, 'instalment_cents', 36000, 'max_instalment_cents', 40000, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb));
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000009e1';
grant select on opp to authenticated, service_role;

-- A shielded payment that confirms. At 50 USD per ZEC a payment of n micro-USDC
-- is 2n zatoshi, and the watcher is told about it two blocks deep.
create function pg_temp.paid(p_investor uuid, p_micro bigint, p_height bigint) returns uuid
language plpgsql as $$
declare v_r jsonb; begin
  v_r := create_zcash_request(p_investor, (select id from opp), p_micro, 5000, 'demo');
  perform zcash_watch_record(p_height, p_height, 'hash' || p_height, jsonb_build_array(
    jsonb_build_object('txid', 'tx' || p_height, 'pool', 'ironwood', 'index', 0,
      'value_zat', p_micro * 2, 'memo', 'EmpowerFI allocation ' || (v_r ->> 'ref'),
      'height', p_height - 1)));
  return (v_r ->> 'id')::uuid;
end; $$;

-- ------------------------------------------------- a batch rounds down and carries

set local role service_role;
select pg_temp.paid('00000000-0000-0000-0000-0000000009b1', 12000000, 101);
select pg_temp.paid('00000000-0000-0000-0000-0000000009b2', 15500000, 102);
select pg_temp.paid('00000000-0000-0000-0000-0000000009b3',  8000000, 103);

create temp table one as select zcash_batch_claim(10000000) as b;
select is(((select b from one)->>'requests')::int, 3, 'the batch takes all three confirmed payments');
select is(((select b from one)->>'target_micro_usdc')::bigint, 35500000::bigint,
  'it owes 35.5 USDC: nothing was carried into the first batch');
select is(((select b from one)->>'credited_micro_usdc')::bigint, 30000000::bigint,
  'and credits 30 — three whole units, rounded down');
select is(((select b from one)->>'carried_out_micro_usdc')::bigint, 5500000::bigint,
  'the 5.5 left over waits for the next batch rather than being fronted');

select is((zcash_batch_claim(10000000)->>'resumed')::boolean, true,
  'a second run resumes the batch in flight: a carry is never read twice');

select zcash_batch_sending((select (b->>'id')::uuid from one), 'sig-batch-one', 500);
select is((zcash_batch_done((select (b->>'id')::uuid from one), 'sig-batch-one')->>'booked')::int, 3,
  'closing it books all three positions');

set local role postgres;
select is((select count(*)::int from investments where credit_batch_id = (select (b->>'id')::uuid from one)), 3,
  'the three share one batch');
select is((select count(*)::int from investments
           where credit_batch_id = (select (b->>'id')::uuid from one) and deposit_signature is not null), 0,
  'and not one of them owns a Solana transfer of its own');
select is((select sum(amount_micro_usdc)::bigint from investments where credit_batch_id = (select (b->>'id')::uuid from one)),
  35500000::bigint,
  'the book holds what was received, which is more than the vault was sent');

-- ------------------------------------------------------- closing twice is a no-op

set local role service_role;
select is((zcash_batch_done((select (b->>'id')::uuid from one), 'sig-batch-one')->>'already')::boolean, true,
  'a batch already credited closes again as a no-op: the landed transfer is never booked twice');
set local role postgres;
select is((select count(*)::int from investments where credit_batch_id = (select (b->>'id')::uuid from one)), 3,
  'and no fourth position appeared');

-- --------------------------------------------- the carry enters the next batch

set local role service_role;
select pg_temp.paid('00000000-0000-0000-0000-0000000009b4', 7000000, 104);
create temp table two as select zcash_batch_claim(10000000) as b;
select is(((select b from two)->>'carried_in_micro_usdc')::bigint, 5500000::bigint,
  'the next batch starts with what the last one left');
select is(((select b from two)->>'credited_micro_usdc')::bigint, 10000000::bigint,
  '5.5 carried plus 7 received credits one whole unit');
select is(((select b from two)->>'carried_out_micro_usdc')::bigint, 2500000::bigint,
  'and carries 2.5 on');
select zcash_batch_sending((select (b->>'id')::uuid from two), 'sig-batch-two', 500);
select zcash_batch_done((select (b->>'id')::uuid from two), 'sig-batch-two');

-- ------------------------------------- a batch under one unit moves nothing at all

select pg_temp.paid('00000000-0000-0000-0000-0000000009b5', 3000000, 105);
create temp table three as select zcash_batch_claim(10000000) as b;
select is(((select b from three)->>'credited_micro_usdc')::bigint, 0::bigint,
  '2.5 carried plus 3 received is under a unit, so nothing moves on Solana');
select lives_ok($$ select zcash_batch_done((select (b->>'id')::uuid from three)) $$,
  'it closes with no signature, because there was no transfer to sign');
set local role postgres;
select is((select count(*)::int from investments where credit_batch_id = (select (b->>'id')::uuid from three)), 1,
  'and her position is booked anyway: we hold her ZEC, so the book has to say so');

-- ------------------------------------- a failed batch gives its payments back

set local role service_role;
select pg_temp.paid('00000000-0000-0000-0000-0000000009b1', 4000000, 106);
create temp table four as select zcash_batch_claim(10000000) as b;
select zcash_batch_failed((select (b->>'id')::uuid from four), 'the transfer expired');
set local role postgres;
select is((select count(*)::int from zcash_payment_requests
           where status = 'confirmed' and credit_batch_id is null), 1,
  'the payment goes back to waiting, for a later batch to carry');

set local role service_role;
create temp table retry as select zcash_batch_claim(10000000) as b;
select is(((select b from retry)->>'carried_in_micro_usdc')::bigint, 5500000::bigint,
  'and the failed batch consumed no carry: only a credited batch is ever read for it');

-- -------------------------- a crowd of payments is not a crowd of people

-- b1 has a payment waiting (the failed batch gave it back) and pays again, so
-- the next batch carries two positions belonging to one investor. The amounts
-- blend; the total does not, and the two counts are what let the screen say so.
-- The batch that claim left open has to go first: a claim resumes an open batch
-- rather than forming a second one, which is the guard against crediting a
-- carry twice and here it would simply hand the same batch back.
select zcash_batch_failed((select (b->>'id')::uuid from retry), 'cleared for the next case');
select pg_temp.paid('00000000-0000-0000-0000-0000000009b1', 6000000, 107);
create temp table five as select zcash_batch_claim(10000000) as b;
set local role postgres;
-- By id, not by position in the queue: inside one transaction every batch
-- shares the same created_at, so there is no newest one to ask for.
select is((select (x->>'members')::int from jsonb_array_elements(zcash_batch_queue(20)->'batches') x
           where x->>'id' = (select (b->>'id')::text from five)), 2,
  'the batch carried two positions');
select is((select (x->>'investors')::int from jsonb_array_elements(zcash_batch_queue(20)->'batches') x
           where x->>'id' = (select (b->>'id')::text from five)), 1,
  'but one investor: a crowd of payments is not a crowd of people');

-- ------------------------------- the two rules the database refuses to break

set local role postgres;
select throws_ok(
  $$ insert into zcash_credit_batches (unit_micro_usdc, carried_in_micro_usdc, target_micro_usdc,
       credited_micro_usdc, carried_out_micro_usdc) values (10000000, 0, 10000000, 0, 10000000) $$,
  '23514', null, 'a carry of one whole unit is refused: it would mean a unit went uncredited');
select throws_ok(
  $$ insert into zcash_credit_batches (unit_micro_usdc, carried_in_micro_usdc, target_micro_usdc,
       credited_micro_usdc, carried_out_micro_usdc) values (10000000, 0, 12500000, 12500000, 0) $$,
  '23514', null, 'and a credit that is not whole units is refused: that is the amount that would leak');

select * from finish();
rollback;
