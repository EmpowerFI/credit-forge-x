-- Settlement: releases to the ramp when a loan is disbursed, mock Pix both
-- ways, payouts of each real investor's share, and the vault's ledger.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(25);

-- ------------------------------------------------------------------ fixtures
-- Rita's request, approved by the partner. Wanda funds 100 USDC from her
-- wallet; Zed 50 by ZEC, with no Solana wallet; the rest is simulated.
-- Sara's, disbursed alongside, has 20 USDC of Wanda's.

update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000006f1', 'pgTAP Settle partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 's-admin@test'),
  ('00000000-0000-0000-0000-0000000006a2', 's-lia@test'),
  ('00000000-0000-0000-0000-0000000006a3', 's-rita@test'),
  ('00000000-0000-0000-0000-0000000006a4', 's-sara@test'),
  ('00000000-0000-0000-0000-0000000006a5', 's-paulo@test'),
  ('00000000-0000-0000-0000-0000000006a6', 's-audit@test'),
  ('00000000-0000-0000-0000-0000000006a7', 's-zed@test'),
  ('00000000-0000-0000-0000-0000000006a8', 's-sim@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000006a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000006a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000006f1' where id = '00000000-0000-0000-0000-0000000006a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000006a6';
update profiles set role = 'capital_provider' where id in ('00000000-0000-0000-0000-0000000006a7', '00000000-0000-0000-0000-0000000006a8');
insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA6666666666666666666666666666666666666","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000006c1', 'pgTAP Settle community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000006a2', 'verified', now(), '00000000-0000-0000-0000-0000000006a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006a3', 'pgTAP Rita Settle', 'Bolos da Rita pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000006e2', '00000000-0000-0000-0000-0000000006a4', 'pgTAP Sara Settle', 'Ateliê Sara pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000006c1', id from entrepreneurs where display_name like 'pgTAP % Settle';
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Settle';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Settle';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000006a4');
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
    'term_months', 12, 'instalment_cents', 20000, 'max_instalment_cents', 27500, 'affordability_bps', 1500,
    'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
    'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb))
from entrepreneurs e where e.display_name like 'pgTAP % Settle';
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000006e1';
grant select on opp to authenticated, service_role;
create temp table opp2 as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000006e2';
grant select on opp2 to authenticated, service_role;

select record_investment('00000000-0000-0000-0000-0000000006b1', (select id from opp), 100000000, 'wallet',
  'WaNdA6666666666666666666666666666666666666', 'sig-wanda');
select record_investment('00000000-0000-0000-0000-0000000006a7', (select id from opp), 50000000, 'zcash', null, 'sig-zed-credit');
select record_investment('00000000-0000-0000-0000-0000000006a8', (select id from opp), (select target from opp) - 150000000,
  'simulated', p_is_simulated => true);

-- Sara: 20 USDC from Wanda's wallet, the rest simulated.
select record_investment('00000000-0000-0000-0000-0000000006b1', (select id from opp2), 20000000, 'wallet',
  'WaNdA6666666666666666666666666666666666666', 'sig-wanda-sara');
select record_investment('00000000-0000-0000-0000-0000000006a8', (select id from opp2), (select target from opp2) - 20000000,
  'simulated', p_is_simulated => true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a5');
select partner_decide((select id from opp), 'approved', 200000, 300, 12);
select partner_decide((select id from opp2), 'approved', 150000, 300, 12);
set local role postgres;
create temp table loan as select id, principal_cents, instalment_cents from loans where opportunity_id = (select id from opp);
grant select on loan to authenticated, service_role;
create temp table loan2 as select id from loans where opportunity_id = (select id from opp2);
grant select on loan2 to authenticated, service_role;

-- ------------------------------------------------------------ disbursement

select is((select count(*)::int from settlement_legs where loan_id = (select id from loan)), 0,
  'nothing moves before the partner disburses');

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a5');
select transition_loan((select id from loan), 'DISBURSED', 'Pix sent');
select transition_loan((select id from loan2), 'DISBURSED', 'Pix sent');
set local role postgres;

select results_eq(
  $$ select amount_micro_usdc, status::text, destination from settlement_legs where kind = 'release' and loan_id = (select id from loan) $$,
  $$ values (150000000::bigint, 'due', null::text) $$,
  'disbursed: the real deposits, 150 USDC, are due to leave the vault for the ramp; simulated ones move nothing'
);
select results_eq(
  $$ select amount_cents, status::text, pix_e2e ~ '^E99999999[0-9]{12}[A-Za-z0-9]{11}$'
     from settlement_legs where kind = 'pix_payout' and loan_id = (select id from loan) $$,
  $$ select principal_cents, 'mock', true from loan $$,
  'and she is paid the principal by Pix: a mock, with an end-to-end id in Pix''s format'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a5');
select transition_loan((select id from loan), 'ACTIVE');
select record_payment((select id from loan), 1, (select instalment_cents from loan));
set local role postgres;
create temp table pay1 as select id from payments where loan_id = (select id from loan) and instalment_no = 1;
grant select on pay1 to authenticated, service_role;

-- ------------------------------------------------------------ instalments

select is((select status::text from settlement_legs where kind = 'pix_in' and payment_id = (select id from pay1)), 'mock',
  'an instalment arrives by (mock) Pix');
select results_eq(
  $$ select i.mode::text, l.amount_micro_usdc, l.destination, l.status::text
     from settlement_legs l join investments i on i.id = l.investment_id
     where l.kind = 'payout' and l.payment_id = (select id from pay1) order by i.mode::text $$,
  $$ values
     ('wallet', private.share_usdc((select instalment_cents from loan), 100000000::numeric / (select target from opp), 5400),
      'WaNdA6666666666666666666666666666666666666', 'due'),
     ('zcash', private.share_usdc((select instalment_cents from loan), 50000000::numeric / (select target from opp), 5400),
      null, 'held') $$,
  'each real investor''s share is due to their wallet; without a wallet it is held'
);
select is((select count(*)::int from settlement_legs l join investments i on i.id = l.investment_id where i.is_simulated), 0,
  'simulated positions are paid nothing');

select pg_temp.act_as('00000000-0000-0000-0000-0000000006b1');
select is((select count(*)::int from settlement_legs), 0, 'an investor does not read the legs directly');
select throws_ok($$ select * from settle_claim() $$, '42501', null, 'nor claims them');
set local role postgres;

-- ---------------------------------------------------------------- sending

set local role service_role;
create temp table claimed as select * from settle_claim();
select results_eq(
  $$ select kind::text, inflow_micro_usdc, outflow_micro_usdc, signature, jsonb_array_length(legs) from claimed order by kind::text $$,
  $$ values ('payout', (select amount_micro_usdc from settlement_legs where kind = 'payout' and status = 'sending'),
               (select amount_micro_usdc from settlement_legs where kind = 'payout' and status = 'sending'), null::text, 1),
            ('release', 0::bigint, 170000000::bigint, null::text, 2) $$,
  'both loans'' releases leave in one transfer, never loan by loan; another brings Wanda''s share into the vault and pays it out'
);
select is((select count(*)::int from settle_claim()), 0, 'a second run claims neither');
select throws_ok($$ select settle_done((select id from claimed where kind = 'release'), 'sig-release') $$,
  'P0001', 'transfer_not_pending', 'a transfer is done only with the signature recorded before sending');
select settle_sending(id, 'sig-' || kind::text, 1000) from claimed;
select settle_done(id, 'sig-' || kind::text) from claimed;
set local role postgres;

select is((select count(*)::int from settlement_legs where kind in ('release', 'payout') and status = 'done'), 3,
  'both land: the two releases and Wanda''s payout are done');
select results_eq(
  $$ select (v->>'in_vault_micro_usdc')::bigint, (v->>'released_micro_usdc')::bigint,
            (v->>'repaid_in_micro_usdc')::bigint = (v->>'paid_out_micro_usdc')::bigint
     from (select private.vault_ledger() v) x $$,
  $$ values (0::bigint, 170000000::bigint, true) $$,
  'the vault''s ledger: the deposits went to the ramp, and each payout brought in what it paid out'
);

-- ----------------------------------------------------------------- readers

select pg_temp.act_as('00000000-0000-0000-0000-0000000006b1');
create temp table wanda_inv as select id from investments where deposit_signature = 'sig-wanda';
select results_eq(
  $$ select p -> 'settlement' -> 'release' ->> 'status', p -> 'settlement' -> 'release' ->> 'signature',
            (p -> 'settlement' -> 'pix' ->> 'brl_cents')::bigint
     from (select investor_position((select id from wanda_inv)) p) x $$,
  $$ values ('done', 'sig-release', 200000::bigint) $$,
  'Wanda''s position shows the release, its transaction, and the Pix to Rita'
);
select is(
  (select (investor_position((select id from wanda_inv)) -> 'settlement' -> 'release' ->> 'loans_in_transfer')::int), 2,
  'with the number of loans it left alongside'
);
select results_eq(
  $$ select s -> 'payout' ->> 'status', s -> 'payout' ->> 'signature', s ->> 'pix_e2e' ~ '^E'
     from (select jsonb_array_elements(investor_position((select id from wanda_inv)) -> 'schedule') s) x
     where (s ->> 'instalment_no')::int = 1 $$,
  $$ values ('done', 'sig-payout', true) $$,
  'and, on the first instalment, her payout and its transaction'
);
select results_eq(
  $$ select (o -> 'mine' ->> 'paid_out_micro_usdc')::bigint > 0, (o -> 'mine' ->> 'payouts')::int, (o -> 'pix' ->> 'payouts')::int >= 1
     from (select settlement_overview() o) x $$,
  $$ values (true, 1, true) $$,
  'the Settlement page sums what reached her wallet'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a7');
select results_eq(
  $$ select (settlement_overview() -> 'mine' ->> 'held_micro_usdc')::bigint > 0, (settlement_overview() -> 'mine' ->> 'payouts')::int $$,
  $$ values (true, 0) $$,
  'Zed, with no wallet, sees his share held'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a3');
select throws_ok($$ select settlement_overview() $$, '42501', 'not_allowed_to_see_portfolio',
  'an entrepreneur does not read the vault''s flows');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a6');
select results_eq(
  $$ select (audit_system() -> 'vault' ->> 'expected_micro_usdc')::bigint, (audit_system() -> 'vault' ->> 'released_micro_usdc')::bigint,
            (audit_system() -> 'settlement' ->> 'held')::int $$,
  $$ values (0::bigint, 170000000::bigint, 1) $$,
  'the auditor''s vault check nets out the release, and counts the held payout'
);
set local role postgres;

-- ----------------------------------------------------------------- failure

select pg_temp.act_as('00000000-0000-0000-0000-0000000006a5');
select record_payment((select id from loan), 2, (select instalment_cents from loan));
set local role postgres;
set local role service_role;
create temp table claimed2 as select * from settle_claim();
select is((select count(*)::int from claimed2), 1, 'the second instalment''s payout is claimed');
select settle_sending((select id from claimed2), 'sig-p2', 1000);
select settle_failed((select id from claimed2), 'transaction failed: InsufficientFunds');
set local role postgres;
select results_eq(
  $$ select t.status::text, l.status::text, t.error from vault_transfers t join settlement_legs l on l.transfer_id = t.id
     where t.id = (select id from claimed2) $$,
  $$ values ('failed', 'failed', 'transaction failed: InsufficientFunds') $$,
  'a transfer that landed and failed is left, with its error, for a human'
);
select is((private.vault_ledger() ->> 'paid_out_micro_usdc')::bigint,
  (select amount_micro_usdc from settlement_legs where kind = 'payout' and status = 'done'),
  'and counts in no one''s ledger');

select lives_ok($$ select reset_demo_data('reset empowerfi-hackathon demo data') $$, 'the demo reset clears settlement too');
select is((select count(*)::int from settlement_legs) + (select count(*)::int from vault_transfers), 0, 'nothing left behind');

select * from finish();
rollback;
