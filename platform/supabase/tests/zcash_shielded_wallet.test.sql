-- Privacy without a Zcash wallet: an investor who paid with her Solana wallet
-- chooses to be repaid in shielded ZEC, and from then on nothing of hers is
-- paid out on Solana. Her deposit stays public — that is not something this can
-- change — but every share that comes back leaves the shielded treasury.
--
-- The property worth testing is that the two roads cannot both be taken: her
-- payout leg is born held, `settle_claim` only ever claims due legs, and the
-- only thing that closes a held leg is the ZEC sender. Double payment is
-- impossible by construction, and these tests are what say so.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(14);

-- ------------------------------------------------------------------ fixtures
-- One request of Vera's, funded by two wallet investors — Nina, who asks to be
-- repaid in shielded ZEC, and Otto, who does not — plus a simulated investor to
-- close the raise. One instalment is then paid.

update partners set active = false where name not like 'pgTAP %';
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}' where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000008f1', 'pgTAP Shielded partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 's-admin@test'),
  ('00000000-0000-0000-0000-0000000008a2', 's-lia@test'),
  ('00000000-0000-0000-0000-0000000008a3', 's-vera@test'),
  ('00000000-0000-0000-0000-0000000008a5', 's-paulo@test'),
  ('00000000-0000-0000-0000-0000000008a6', 's-audit@test'),
  ('00000000-0000-0000-0000-0000000008a7', 's-nina@test'),
  ('00000000-0000-0000-0000-0000000008a8', 's-otto@test'),
  ('00000000-0000-0000-0000-0000000008a9', 's-sim@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000008a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000008a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000008f1' where id = '00000000-0000-0000-0000-0000000008a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000008a6';
update profiles set role = 'capital_provider' where id in
  ('00000000-0000-0000-0000-0000000008a7', '00000000-0000-0000-0000-0000000008a8', '00000000-0000-0000-0000-0000000008a9');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000008c1', 'pgTAP Shielded community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000008a2', 'verified', now(), '00000000-0000-0000-0000-0000000008a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008a3', 'pgTAP Vera Shielded', 'Costura pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
  values ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008e1');
insert into chain_anchors (kind, entity_id) values ('enrollment', '00000000-0000-0000-0000-0000000008e1');
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values ('00000000-0000-0000-0000-0000000008e1', 1, 'consent-v1', true, true, true, true, 'community');
select zcash_configure_treasury('test', 'utest1treasury', 'uviewtest1treasurykey', 4000000);

set local role service_role;
select record_readiness_assessment('00000000-0000-0000-0000-0000000008e1',
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb);
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;

set local role service_role;
select record_eligibility_assessment('00000000-0000-0000-0000-0000000008e1',
  (select id from credit_intents where entrepreneur_id = '00000000-0000-0000-0000-0000000008e1'),
  (select id from readiness_assessments where entrepreneur_id = '00000000-0000-0000-0000-0000000008e1'),
  '{}'::jsonb,
  jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
    'requested_amount_cents', 200000, 'proposed_amount_cents', 200000,
    'term_months', 6, 'instalment_cents', 36000, 'max_instalment_cents', 40000, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb));
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities where entrepreneur_id = '00000000-0000-0000-0000-0000000008e1';
grant select on opp to authenticated, service_role;

set local role service_role;
select record_investment('00000000-0000-0000-0000-0000000008a7', (select id from opp), 40000000, 'wallet',
  'NinaWaLLet11111111111111111111111111111111', 'sig-nina-deposit');
select record_investment('00000000-0000-0000-0000-0000000008a8', (select id from opp), 30000000, 'wallet',
  'OttoWaLLet11111111111111111111111111111111', 'sig-otto-deposit');
select record_investment('00000000-0000-0000-0000-0000000008a9', (select id from opp), (select target from opp) - 70000000,
  'simulated', p_is_simulated => true);
set local role postgres;
create temp table nina as select id from investments where investor_id = '00000000-0000-0000-0000-0000000008a7';
create temp table otto as select id from investments where investor_id = '00000000-0000-0000-0000-0000000008a8';
create temp table sim as select id from investments where investor_id = '00000000-0000-0000-0000-0000000008a9';
grant select on nina, otto, sim to authenticated, service_role;

-- --------------------------------------------------- her choice, and its guards
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a7');

select throws_ok(
  $$ select set_zcash_return_address((select id from nina), 'tmBsTi2xWTjUdEXnuTceL7fecEQKeWaPDJd') $$,
  '22023', null, 'a transparent address is refused: the point of the road is that it is shielded'
);
select throws_ok(
  $$ select set_zcash_return_address((select id from nina), 'u1' || repeat('q', 80)) $$,
  '22023', null, 'a mainnet address is refused on a testnet treasury'
);
select throws_ok(
  $$ select set_zcash_return_address((select id from otto), 'utest1' || repeat('q', 80)) $$,
  '42501', null, 'nobody can redirect someone else''s returns'
);

select lives_ok(
  $$ select set_zcash_return_address((select id from nina), 'utest1' || repeat('q', 80)) $$,
  'a wallet investor may ask to be repaid in shielded ZEC'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000008a9');
select throws_ok(
  $$ select set_zcash_return_address((select id from sim), 'utest1' || repeat('q', 80)) $$,
  'P0001', null, 'a simulated position has nothing to send, so it cannot ask for it'
);
set local role postgres;

select is(
  (select shielded_return_address from investments where id = (select id from nina)),
  'utest1' || repeat('q', 80),
  'the address goes on the investment, which is where a wallet position can carry one'
);
select is(
  (select shielded_return_address from investments where id = (select id from otto)),
  null, 'and only on hers'
);

-- ------------------------------------------------------------- the instalment
select pg_temp.act_as('00000000-0000-0000-0000-0000000008a5');
select formalise_loan((select id from opp));
select transition_loan((select id from loans where opportunity_id = (select id from opp)), 'DISBURSED', 'Pix sent');
select transition_loan((select id from loans where opportunity_id = (select id from opp)), 'ACTIVE');
select record_payment((select id from loans where opportunity_id = (select id from opp)), 1, 36000);
set local role postgres;

select results_eq(
  $$ select status::text from settlement_legs
     where kind = 'payout' and investment_id = (select id from nina) $$,
  $$ values ('held') $$,
  'her share is born held: there is no road on Solana for it to take'
);
select results_eq(
  $$ select status::text from settlement_legs
     where kind = 'payout' and investment_id = (select id from otto) $$,
  $$ values ('due') $$,
  'and Otto''s is due, because he asked for nothing and his wallet is still where it goes'
);
select is(
  (select destination from settlement_legs where kind = 'payout' and investment_id = (select id from nina)),
  'NinaWaLLet11111111111111111111111111111111',
  'the wallet stays recorded on the leg — it is where the money would have gone, and the record says so'
);

select results_eq(
  $$ select r.kind, r.status::text, r.address, r.amount_micro_usdc = l.amount_micro_usdc
     from zcash_returns r join settlement_legs l on l.id = r.leg_id
     where r.investment_id = (select id from nina) $$,
  $$ values ('payout', 'due', 'utest1' || repeat('q', 80), true) $$,
  'the same share is owed to her in ZEC, for exactly what the leg holds'
);
select is(
  (select count(*) from zcash_returns where investment_id = (select id from otto)), 0::bigint,
  'nothing is owed in ZEC to the investor who is paid on Solana'
);

-- ------------------------------------------- the two roads cannot both be taken
set local role service_role;
select ok(
  not exists (
    select 1 from settle_claim() c, jsonb_array_elements(c.legs) g
    where (g ->> 'investment_id')::uuid = (select id from nina)),
  'the vault''s sender never claims her leg, so her share cannot be paid twice'
);

select is(
  (select status::text from settlement_legs where kind = 'payout' and investment_id = (select id from nina)),
  'held', 'it is still held after the vault has run'
);
set local role postgres;

select * from finish();
rollback;
