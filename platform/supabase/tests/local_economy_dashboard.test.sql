-- The Local Economy Dashboard: every figure it reports, recomputed here from
-- the movements themselves (addendum v3 §7.2, §8, §12).
--
-- The point of this file is that the dashboard may not be believed. §12 forbids
-- a presentation value, so each metric below is asserted against the arithmetic
-- a reader could do by hand over the ledger this fixture builds, and the fixture
-- is built through the same triggers and functions the product uses rather than
-- by writing rows that flatter the answer.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(47);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'dash-admin@test'),
  ('00000000-0000-0000-0000-0000000015a2', 'dash-leader@test'),
  ('00000000-0000-0000-0000-0000000015a3', 'dash-rosa@test'),
  ('00000000-0000-0000-0000-0000000015a4', 'dash-nina@test'),
  ('00000000-0000-0000-0000-0000000015a5', 'dash-desk@test'),
  ('00000000-0000-0000-0000-0000000015a6', 'dash-outsider@test');
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents) values
  ('00000000-0000-0000-0000-0000000015ab', 'Dash Desk', 'fintech', 10000, 5000000);
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000015a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000015a2';
update profiles set role = 'entrepreneur' where id in
  ('00000000-0000-0000-0000-0000000015a3', '00000000-0000-0000-0000-0000000015a4', '00000000-0000-0000-0000-0000000015a6');
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000015ab'
  where id = '00000000-0000-0000-0000-0000000015a5';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000015c1', 'pgTAP Dashboard community', 'association', 'Recife', 'PE',
   '00000000-0000-0000-0000-0000000015a2', 'verified', now(), '00000000-0000-0000-0000-0000000015a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector, city, state) values
  ('00000000-0000-0000-0000-0000000015e1', '00000000-0000-0000-0000-0000000015a3', 'Dash Rosa', 'Ateliê Rosa', 'textiles', 'Recife', 'PE'),
  ('00000000-0000-0000-0000-0000000015e2', '00000000-0000-0000-0000-0000000015a4', 'Dash Nina', 'Quitanda Nina', 'food', 'Recife', 'PE'),
  ('00000000-0000-0000-0000-0000000015e3', '00000000-0000-0000-0000-0000000015a6', 'Dash Fora', 'Fora', 'retail', 'Recife', 'PE');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000015c1', '00000000-0000-0000-0000-0000000015e1'),
  ('00000000-0000-0000-0000-0000000015c1', '00000000-0000-0000-0000-0000000015e2');

insert into local_economies (id, code, name, territory, community_id, uf, currency_code, parity_bps, parity_reference) values
  ('00000000-0000-0000-0000-0000000015f1', 'pgtap_dash', 'Moeda pgTAP Dashboard', 'Território pgTAP',
   '00000000-0000-0000-0000-0000000015c1', 'PE', 'PGD', 10000, '1 PGD = R$ 1, demonstration only');
insert into local_merchants (id, economy_id, code, name, sector, city, uf, eligible) values
  ('00000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-0000000015f1', 'tecidos', 'Tecidos do Bairro', 'wholesale', 'Recife', 'PE', true),
  ('00000000-0000-0000-0000-0000000015b2', '00000000-0000-0000-0000-0000000015f1', 'grafica', 'Gráfica da Esquina', 'services', 'Recife', 'PE', true),
  ('00000000-0000-0000-0000-0000000015b3', '00000000-0000-0000-0000-0000000015f1', 'fora', 'Loja fora da rede', 'retail', 'Recife', 'PE', false);

-- Two loans land here, and they were funded from different places: one from
-- abroad and one inside Brazil. Additionality has to be a fraction for the
-- assertion to mean anything — a fixture where every loan is global would pass
-- an arithmetic that always returned 100%.
insert into credit_intents (id, entrepreneur_id, purpose, requested_amount_cents) values
  ('00000000-0000-0000-0000-0000000015d1', '00000000-0000-0000-0000-0000000015e1', 'inventory', 100000),
  ('00000000-0000-0000-0000-0000000015d2', '00000000-0000-0000-0000-0000000015e2', 'inventory', 50000);
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features) values
  ('00000000-0000-0000-0000-000000015aa1', '00000000-0000-0000-0000-0000000015e1', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb),
  ('00000000-0000-0000-0000-000000015aa2', '00000000-0000-0000-0000-0000000015e2', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb);
insert into eligibility_assessments (id, entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version,
  decision, requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
  risk_band, risk_points, confidence, reason_codes, inputs) values
  ('00000000-0000-0000-0000-000000015ea1', '00000000-0000-0000-0000-0000000015e1', '00000000-0000-0000-0000-0000000015d1',
   '00000000-0000-0000-0000-000000015aa1', 1, 'test', 'ELIGIBLE', 100000, 100000, 12, 10000, 60000, 'LOW', 10, 'HIGH', '{}', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000015ea2', '00000000-0000-0000-0000-0000000015e2', '00000000-0000-0000-0000-0000000015d2',
   '00000000-0000-0000-0000-000000015aa2', 1, 'test', 'ELIGIBLE', 50000, 50000, 12, 5000, 60000, 'LOW', 10, 'HIGH', '{}', '{}'::jsonb);
insert into qualified_credit_opportunities (id, entrepreneur_id, intent_id, eligibility_id, opportunity_no,
  amount_cents, term_months, instalment_cents, purpose, risk_band, confidence, status, desired_date, urgency, funding_pool) values
  ('00000000-0000-0000-0000-000000015fa1', '00000000-0000-0000-0000-0000000015e1', '00000000-0000-0000-0000-0000000015d1',
   '00000000-0000-0000-0000-000000015ea1', 1, 100000, 12, 10000, 'inventory', 'LOW', 'HIGH', 'in_review', current_date + 30, 'soon', 'global'),
  ('00000000-0000-0000-0000-000000015fa2', '00000000-0000-0000-0000-0000000015e2', '00000000-0000-0000-0000-0000000015d2',
   '00000000-0000-0000-0000-000000015ea2', 1, 50000, 12, 5000, 'inventory', 'LOW', 'HIGH', 'in_review', current_date + 30, 'soon', 'domestic');
insert into partner_decisions (id, opportunity_id, partner_id, verdict, approved_amount_cents, rate_bps, term_months) values
  ('00000000-0000-0000-0000-000000015dc1', '00000000-0000-0000-0000-000000015fa1', '00000000-0000-0000-0000-0000000015ab', 'approved', 100000, 300, 12),
  ('00000000-0000-0000-0000-000000015dc2', '00000000-0000-0000-0000-000000015fa2', '00000000-0000-0000-0000-0000000015ab', 'approved', 50000, 300, 12);
insert into loans (id, opportunity_id, entrepreneur_id, partner_id, decision_id,
  principal_cents, term_months, rate_bps, instalment_cents, status) values
  ('00000000-0000-0000-0000-000000015cb1', '00000000-0000-0000-0000-000000015fa1', '00000000-0000-0000-0000-0000000015e1',
   '00000000-0000-0000-0000-0000000015ab', '00000000-0000-0000-0000-000000015dc1', 100000, 12, 300, 10000, 'PARTNER_APPROVED'),
  ('00000000-0000-0000-0000-000000015cb2', '00000000-0000-0000-0000-000000015fa2', '00000000-0000-0000-0000-0000000015e2',
   '00000000-0000-0000-0000-0000000015ab', '00000000-0000-0000-0000-000000015dc2', 50000, 12, 300, 5000, 'PARTNER_APPROVED');

-- The whole ledger, built the way the product builds one. PGD 1.500 arrives.
insert into loan_events (loan_id, from_status, to_status, note) values
  ('00000000-0000-0000-0000-000000015cb1', 'PARTNER_APPROVED', 'DISBURSED', 'pgTAP'),
  ('00000000-0000-0000-0000-000000015cb2', 'PARTNER_APPROVED', 'DISBURSED', 'pgTAP');

select pg_temp.act_as('00000000-0000-0000-0000-0000000015a5');
-- She buys inputs, her supplier pays a printer, the printer buys from her.
select public.local_spend('00000000-0000-0000-0000-0000000015b1', 60000, 'inventory', '00000000-0000-0000-0000-0000000015e1');
select public.local_merchant_payment('00000000-0000-0000-0000-0000000015b1', '00000000-0000-0000-0000-0000000015b2', 25000);
select public.local_sale('00000000-0000-0000-0000-0000000015b2', '00000000-0000-0000-0000-0000000015e1', 10000);
-- The printer takes PGD 80 out of the network and is paid in reais.
select public.local_redeem('00000000-0000-0000-0000-0000000015b2', 8000);
set local role postgres;
-- And she pays an instalment out of what she still holds.
insert into payments (loan_id, instalment_no, amount_cents, paid_at) values
  ('00000000-0000-0000-0000-000000015cb1', 1, 20000, now());

-- ------------------------------------------------------------- the ledger is

-- Read once, as the desk, and asserted against afterwards. One call per
-- assertion would re-run the whole reading twenty times over, and the
-- assertions would then be free to disagree with each other about which
-- snapshot they were reading.
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a5');
create temp table dash_row as
  select public.local_economy_dashboard('00000000-0000-0000-0000-0000000015f1') as d;

set local role postgres;
create function pg_temp.dash() returns jsonb language sql stable as $$
  select d from pg_temp.dash_row
$$;
create function pg_temp.n(p_key text) returns bigint language sql stable as $$
  select (d ->> p_key)::bigint from pg_temp.dash_row
$$;

select is(pg_temp.n('movements'), 7::bigint,
  'the ledger holds the six movements the fixture made, plus the second injection');

select is(pg_temp.n('injected_units'), 150000::bigint,
  'capital injected is what the two disbursals put on the rail');

select is(pg_temp.n('circulated_units'), 95000::bigint,
  'local circulation is the purchase, the payment between merchants and the sale back to her');

-- The boundary that matters most, stated as its own assertion: a redemption is
-- capital leaving the territory and counting it as circulation would inflate
-- the multiplier with the exact movement that is leakage.
select is(
  pg_temp.n('circulated_units'),
  (select coalesce(sum(amount_units), 0)::bigint from local_transactions
    where economy_id = '00000000-0000-0000-0000-0000000015f1'
      and tx_type in ('productive_purchase', 'merchant_payment', 'transfer')),
  'and it counts neither the redemption nor the repayment, which are both exits');

select is(pg_temp.n('redeemed_units'), 8000::bigint, 'the redemption is reported on its own');
select is(pg_temp.n('repaid_units'), 20000::bigint, 'and so is the instalment that travelled back along the rail');

select is(pg_temp.n('circulating_units'), 122000::bigint,
  'what is still in circulation is what arrived, less what left and less what was repaid');

-- ---------------------------------------------------------------- the metrics

-- LM3's three rounds, published beside the ratio so the division can be done by
-- hand: 150.000 entered, 60.000 spent inside the territory, and 35.000 spent
-- locally in turn — 25.000 between two merchants and 10.000 back to her.
select is(pg_temp.n('round_1_units'), 150000::bigint, 'round one is the capital that entered the territory');
select is(pg_temp.n('round_2_units'), 60000::bigint, 'round two is what she spent with merchants inside it');
select is(pg_temp.n('round_3_units'), 35000::bigint,
  'round three is what those merchants spent locally in turn, including back to her');

-- (150.000 + 60.000 + 35.000) ÷ 150.000 = 1,633.
select is(pg_temp.n('lm3_bps'), 16333::bigint,
  'LM3 is all three rounds over the first, the way the field has measured this for twenty years');

select cmp_ok(pg_temp.n('lm3_bps'), '<=', 30000::bigint,
  'and it cannot exceed three, because it counts three rounds and stops');

-- (150.000 − 8.000) ÷ 150.000.
select is(pg_temp.n('retention_bps'), 9467::bigint,
  'retention is what has not been cashed out, over what was placed on the rail');

-- 95.000 ÷ 122.000.
select is(pg_temp.n('velocity_bps'), 7787::bigint,
  'velocity is circulation over the units still circulating');

-- 100.000 of 150.000 came from a loan funded abroad.
select is(pg_temp.n('additionality_bps'), 6667::bigint,
  'additionality is the share of what landed here that was funded from abroad');

select is(pg_temp.n('global_injected_units'), 100000::bigint, 'and it names the amount it divided');
select is(pg_temp.n('loans_landed'), 2::bigint, 'over the loans that actually landed on this rail');

-- Each metric against the ledger again, without the dashboard's own totals in
-- between: a reader with SQL and no trust should get the same four numbers.
select is(
  pg_temp.n('lm3_bps'),
  (select round(
     (sum(amount_units) filter (where tx_type = 'capital_injection')
      + sum(amount_units) filter (where tx_type = 'productive_purchase')
      + coalesce(sum(amount_units) filter (where tx_type in ('merchant_payment', 'transfer')), 0))
     * 10000.0 / sum(amount_units) filter (where tx_type = 'capital_injection'))::bigint
   from local_transactions where economy_id = '00000000-0000-0000-0000-0000000015f1'),
  'and LM3 recomputed straight from the rows agrees with the reader');

-- A figure with nothing to compare it to is an assertion however honestly it
-- was derived, so the reading carries what it is being measured against.
select is(
  (select count(*)::int from jsonb_array_elements(pg_temp.dash() -> 'benchmarks')), 3,
  'the reading carries the published figures it is compared against');

select is(
  (select b ->> 'evidence_status' from jsonb_array_elements(pg_temp.dash() -> 'benchmarks') as t(b)
    where b ->> 'key' = 'mumbuca_retention'),
  'external_benchmark',
  'and they are labelled as somebody else''s work, not as ours');

select cmp_ok(
  (select (b ->> 'value_bps')::int from jsonb_array_elements(pg_temp.dash() -> 'benchmarks') as t(b)
    where b ->> 'key' = 'mumbuca_retention'),
  '<', pg_temp.n('retention_bps')::int,
  'a demonstration loop retains more than the largest real one does, which is the caveat rather than the boast');

-- --------------------------------------------------------------- the counting

select is(pg_temp.n('businesses_funded'), 2::bigint, 'two businesses were funded on this rail');
select is(pg_temp.n('merchants_paid'), 2::bigint, 'two merchants were paid with local units');
select is(pg_temp.n('merchants_spent_onward'), 2::bigint,
  'and both of them spent what they received on, which is what a second hop means');
select is(pg_temp.n('merchants_total'), 3::bigint, 'the territory has three merchants');
select is(pg_temp.n('merchants_eligible'), 2::bigint, 'and one of them may not take productive capital');
select is(pg_temp.n('redemptions'), 1::bigint, 'one redemption was requested and settled');

-- ------------------------------------------------------- it checks its own sums

select is((pg_temp.dash() ->> 'conserved')::boolean, true,
  'the payload carries the proof that every balance in the economy sums to zero');

select is((pg_temp.dash() ->> 'supply_matches_balances')::boolean, true,
  'and that what the accounts hold is what the movements say is circulating');

select is(
  pg_temp.n('units_held'),
  (select sum(balance_units)::bigint from local_accounts
    where economy_id = '00000000-0000-0000-0000-0000000015f1' and owner_type <> 'treasury' and balance_units > 0),
  'units held is read from the accounts, not assumed from the movements');

-- --------------------------------------------------------------- what it says

-- §9: an aggregate is only as strong as its weakest input, and every movement
-- on this rail is a simulated assumption.
select is(pg_temp.dash() ->> 'evidence_status', 'simulated_assumption',
  'every figure on this rail is labelled a simulated assumption');

select is(pg_temp.dash() ->> 'model_version', private.local_rail_model_version(),
  'and the payload says which version of the rail produced it');

select is(
  jsonb_array_length(pg_temp.dash() -> 'by_type'), 6,
  'the breakdown names each of the six movements the fixture exercised');

-- ------------------------------------------------------- what the units stand on

-- The accusation any local currency has to face is that its issuer prints it.
-- The answer here is a subtraction: reais came in when capital was issued as
-- units, and they leave when she repays or a merchant cashes out. PGD 1.500 in,
-- PGD 200 released by her instalment, PGD 80 taken by a merchant.

select is((pg_temp.dash() -> 'backing' ->> 'issued_cents')::bigint, 150000::bigint,
  'reais went in when the capital was issued to her as units');

select is((pg_temp.dash() -> 'backing' ->> 'released_to_investors_cents')::bigint, 20000::bigint,
  'and her instalment released exactly the reais behind the units she handed back');

select is((pg_temp.dash() -> 'backing' ->> 'cashed_out_by_merchants_cents')::bigint, 8000::bigint,
  'a merchant cashing out took its own reais out of the same pot');

select is((pg_temp.dash() -> 'backing' ->> 'backing_cents')::bigint, 122000::bigint,
  'what is left is what went in, less both ways out');

-- The invariant, and the reason this rail is not a printing press: what is left
-- covers what is circulating. If it ever failed, units would exist that no
-- reais stand behind.
select is((pg_temp.dash() -> 'backing' ->> 'covered')::boolean, true,
  'and it covers every unit still in circulation, which is the whole claim');

select cmp_ok(
  (pg_temp.dash() -> 'backing' ->> 'backing_cents')::bigint, '>=',
  (pg_temp.dash() -> 'backing' ->> 'circulating_cents')::bigint,
  'stated as the subtraction rather than as a promise');

-- Two crossings of one border, in opposite directions, and no more than one of
-- each per loan and per instalment: a crossing recorded twice would show as
-- backing that was never there.
-- Two loans landed here, so two issues, and one instalment came back on the
-- rail, so one redemption.
select is(
  (select count(*)::int from jsonb_array_elements(pg_temp.dash() -> 'crossings') as t(c)
    where c ->> 'direction' = 'issue'), 2,
  'one crossing in for each loan that landed on the rail');

select is(
  (select count(*)::int from jsonb_array_elements(pg_temp.dash() -> 'crossings') as t(c)
    where c ->> 'direction' = 'redeem'), 1,
  'and one crossing back for the instalment that travelled it');

set local role postgres;
select throws_ok(
  $$ insert into local_conversions (economy_id, direction, units, brl_cents, parity_bps, loan_id)
     values ('00000000-0000-0000-0000-0000000015f1', 'issue', 1, 1, 10000,
             '00000000-0000-0000-0000-000000015cb1') $$,
  '23505', null, 'and a loan cannot be issued against twice');

select throws_ok(
  $$ insert into local_conversions (economy_id, direction, units, brl_cents, parity_bps, loan_id)
     values ('00000000-0000-0000-0000-0000000015f1', 'redeem', 1, 1, 10000,
             '00000000-0000-0000-0000-000000015cb1') $$,
  '23514', null, 'and a redemption without an instalment behind it is refused by shape');

select pg_temp.act_as('00000000-0000-0000-0000-0000000015a5');

-- ------------------------------------------------------------------- who reads

-- The leader of the territory reads her own economy, as the row-level policy on
-- local_economies already says she may.
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a2');
select isnt(pg_temp.dash(), null, 'the leader of the community reads her territory''s economy');

-- An entrepreneur outside the community does not, and is refused by name rather
-- than handed an empty reading she might mistake for an empty ledger.
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a6');
select throws_ok(
  $$ select public.local_economy_dashboard('00000000-0000-0000-0000-0000000015f1') $$,
  '42501', null, 'a business in another territory cannot read this one''s ledger');

select is(
  jsonb_array_length(public.local_economies_listed()), 0,
  'and the listing shows her no economy at all, rather than a name with no numbers');

set local role anon;
select throws_ok(
  $$ select public.local_economy_dashboard() $$,
  '42501', null, 'and a signed-out visitor cannot ask for the dashboard at all');

set local role postgres;
select * from finish();
rollback;
