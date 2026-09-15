-- The partner's desk: what it shows, to whom, and formalisation — disbursing
-- only funded capital, and a decline at formalisation refunding investors.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(19);

-- ------------------------------------------------------------------ fixtures
-- Ana's request and Bia's, both approved by the partner. Wanda funds 30 USDC
-- of Ana's from her wallet and the rest is simulated; Bia's is still raising.

update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000007f1', 'pgTAP Desk partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}'),
  ('00000000-0000-0000-0000-0000000007f2', 'pgTAP Other partner', 'fintech', 10000, 1000000, '{inventory}');
update partners set active = false where id = '00000000-0000-0000-0000-0000000007f2';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'd-admin@test'),
  ('00000000-0000-0000-0000-0000000007a2', 'd-lia@test'),
  ('00000000-0000-0000-0000-0000000007a3', 'd-ana@test'),
  ('00000000-0000-0000-0000-0000000007a4', 'd-bia@test'),
  ('00000000-0000-0000-0000-0000000007a5', 'd-paulo@test'),
  ('00000000-0000-0000-0000-0000000007a6', 'd-audit@test'),
  ('00000000-0000-0000-0000-0000000007a7', 'd-sim@test'),
  ('00000000-0000-0000-0000-0000000007a8', 'd-other@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000007a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000007a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000007f1' where id = '00000000-0000-0000-0000-0000000007a5';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000007f2' where id = '00000000-0000-0000-0000-0000000007a8';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000007a6';
update profiles set role = 'capital_provider' where id = '00000000-0000-0000-0000-0000000007a7';
insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA7777777777777777777777777777777777777","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000007c1', 'pgTAP Desk community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000007a2', 'verified', now(), '00000000-0000-0000-0000-0000000007a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007a3', 'pgTAP Ana Desk', 'Bolos da Ana pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007a4', 'pgTAP Bia Desk', 'Ateliê Bia pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000007c1', id from entrepreneurs where display_name like 'pgTAP % Desk';
insert into chain_anchors (kind, entity_id) select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Desk';
insert into consents (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
select e.id, 1, 'consent-v1', true, true, true, true, 'community' from entrepreneurs e
where not exists (select 1 from consents k where k.entrepreneur_id = e.id);

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0,"avg_revenue_cents":412345,"avg_net_business_cents":151234,"revenue_cv_bps":800}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Desk';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
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
from entrepreneurs e where e.display_name like 'pgTAP % Desk';
set local role postgres;

create temp table opp as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000007e1';
create temp table opp2 as
select id, funding_target_micro_usdc as target from qualified_credit_opportunities
where entrepreneur_id = '00000000-0000-0000-0000-0000000007e2';
grant select on opp, opp2 to authenticated, service_role;

set local role service_role;
select record_investment('00000000-0000-0000-0000-0000000007b1', (select id from opp), 30000000, 'wallet',
  'WaNdA7777777777777777777777777777777777777', 'sig-desk-wanda');
select record_investment('00000000-0000-0000-0000-0000000007a7', (select id from opp), (select target from opp) - 30000000,
  'simulated', p_is_simulated => true);
select record_investment('00000000-0000-0000-0000-0000000007a7', (select id from opp2), 10000000,
  'simulated', p_is_simulated => true);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select partner_decide((select id from opp), 'approved', 200000, 300, 6);
select partner_decide((select id from opp2), 'approved', 150000, 300, 6);
set local role postgres;
create temp table loan as select id from loans where opportunity_id = (select id from opp);
create temp table loan2 as select id from loans where opportunity_id = (select id from opp2);
grant select on loan, loan2 to authenticated, service_role;

-- ------------------------------------------------------------------- access

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a7');
select throws_ok($$ select partner_desk() $$, '42501', 'not_a_partner', 'an investor has no desk');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a2');
select throws_ok($$ select partner_desk() $$, '42501', 'not_a_partner', 'nor does a community leader');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
create temp table desk as select partner_desk() as d;
set local role postgres;

select is((select d -> 'partner' ->> 'name' from desk), 'pgTAP Desk partner', 'the desk is the partner''s own');
select is((select jsonb_array_length(d -> 'opportunities') from desk), 2, 'with both opportunities referred to it');
select ok((select d::text not like '%pgTAP Ana%' and d::text not like '%Bolos da Ana%' from desk),
  'and neither her name nor her business name anywhere in it');
select is(
  (select o ->> 'participant' from desk, jsonb_array_elements(d -> 'opportunities') o where (o ->> 'opportunity_id')::uuid = (select id from opp)),
  'P-000000', 'she appears under the partner''s code'
);
select is(
  (select (o -> 'avg_revenue_cents')::bigint from desk, jsonb_array_elements(d -> 'opportunities') o where (o ->> 'opportunity_id')::uuid = (select id from opp)),
  410000::bigint, 'her average sales rounded to R$ 100, not her ledger'
);
select results_eq(
  $$ select (o -> 'funding' ->> 'status'), (o -> 'funding' ->> 'investors')::int, (o -> 'funding' ->> 'real_micro_usdc')::bigint
     from desk, jsonb_array_elements(d -> 'opportunities') o where (o ->> 'opportunity_id')::uuid = (select id from opp) $$,
  $$ values ('funded', 2, 30000000::bigint) $$,
  'funding as the partner sees it: funded, by two investors, 30 USDC of it real'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a8');
select is((select jsonb_array_length(partner_desk() -> 'opportunities')), 0, 'another partner sees none of it');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a6');
select ok((select jsonb_array_length(partner_desk() -> 'loans') >= 2), 'an auditor follows every desk');
set local role postgres;

-- ------------------------------------------------------------- formalisation

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select throws_ok($$ select transition_loan((select id from loan2), 'DISBURSED') $$, 'P0001', 'not_fully_funded',
  'Bia''s loan waits while investors are still funding it');
select throws_ok($$ select transition_loan((select id from loan), 'CANCELLED') $$, '22023', 'reason_required',
  'a decline at formalisation needs a reason');
select transition_loan((select id from loan), 'CANCELLED', 'Guarantor not reached');
set local role postgres;

select results_eq(
  $$ select status::text, funding_status::text from qualified_credit_opportunities where id = (select id from opp) $$,
  $$ values ('partner_declined', 'refunded') $$,
  'declined at formalisation: the opportunity closes, refunded'
);
select results_eq(
  $$ select mode::text, status::text from investments where opportunity_id = (select id from opp) order by mode $$,
  $$ values ('simulated', 'refunded'), ('wallet', 'refund_due') $$,
  'every investor in it is refunded: the simulated position at once, the wallet''s due back from the vault'
);
select is((select count(*)::int from chain_anchors where kind = 'loan_transition'
    and entity_id in (select id from loan_events where loan_id = (select id from loan) and to_status = 'CANCELLED')), 1,
  'the cancellation is queued for the chain');

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select results_eq(
  $$ select l ->> 'status', (l -> 'funding' ->> 'refund_due')::int, (l -> 'funding' ->> 'refunded')::int, l -> 'events' -> -1 ->> 'note'
     from jsonb_array_elements(partner_desk() -> 'loans') l where (l ->> 'id')::uuid = (select id from loan) $$,
  $$ values ('CANCELLED', 1, 1, 'Guarantor not reached') $$,
  'the desk shows it cancelled, its reason, one refund done and one on its way'
);
set local role postgres;

-- ----------------------------------------------------------------- servicing
-- Bia's loan, funded in full, disbursed and repaying since two months and a day ago.

set local role service_role;
select record_investment('00000000-0000-0000-0000-0000000007a7', (select id from opp2), (select target from opp2) - 10000000,
  'simulated', p_is_simulated => true);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select transition_loan((select id from loan2), 'DISBURSED', 'Pix sent');
select transition_loan((select id from loan2), 'ACTIVE');
set local role postgres;
update loan_events set created_at = now() - interval '2 months 1 day'
where loan_id = (select id from loan2) and to_status = 'ACTIVE';

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select results_eq(
  $$ select (l ->> 'due_now')::int, (l ->> 'overdue')::int, (l -> 'schedule' -> 0 ->> 'late')::boolean,
            (l -> 'schedule' -> 2 ->> 'late')::boolean, l -> 'pix_payout' ->> 'e2e' is not null
     from jsonb_array_elements(partner_desk() -> 'loans') l where (l ->> 'id')::uuid = (select id from loan2) $$,
  $$ values (2, 2, true, false, true) $$,
  'two months in with nothing paid: two instalments due, both overdue, the third not yet; her Pix payout is recorded'
);
select record_payment((select id from loan2), 1, 36000);
select results_eq(
  $$ select (l ->> 'overdue')::int, (l ->> 'paid')::int, (l ->> 'received_cents')::bigint,
            (l -> 'schedule' -> 0 ->> 'late')::boolean, l -> 'schedule' -> 0 ->> 'pix_e2e' is not null,
            (l ->> 'next_due_at')::timestamptz::date
     from jsonb_array_elements(partner_desk() -> 'loans') l where (l ->> 'id')::uuid = (select id from loan2) $$,
  $$ select 1, 1, 36000::bigint, true, true, ((now() - interval '2 months 1 day') + interval '2 months')::date $$,
  'instalment 1 paid, late: one still overdue, the next due date is instalment 2''s, and its Pix in is recorded'
);
select is(
  (select (l -> 'schedule' -> 0 -> 'to_investors' ->> 'amount_micro_usdc')::bigint
   from jsonb_array_elements(partner_desk() -> 'loans') l where (l ->> 'id')::uuid = (select id from loan2)),
  0::bigint, 'simulated investors: nothing goes back to the vault for them'
);
set local role postgres;

select * from finish();
rollback;
