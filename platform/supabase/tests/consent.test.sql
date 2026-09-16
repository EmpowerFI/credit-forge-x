-- Consent: recorded by her or her community, proven, and enforced — no
-- assessment, referral or investor listing without the scope that allows it.
-- And the audit console that checks it.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(38);

-- ------------------------------------------------------------------ fixtures
-- One partner and two communities. Rita and Sara are entrepreneurs with a
-- login; Tina has none, so her leader, Lia, records for her. Olga leads
-- elsewhere. Wanda and Yara invest; Ivo audits.

update partners set active = false where name not like 'pgTAP %';
-- Every request here is funded in USDC: the global pool takes any of them.
update funding_pools set capital_cents = 0 where pool = 'domestic';
update funding_pools set purposes = '{}', max_ticket_cents = 5000000, eligible_risk_bands = '{LOW,MEDIUM,HIGH}' where pool = 'global';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000007f1', 'pgTAP Consent partner', 'credit_union', 10000, 1000000, '{inventory,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000007a1', 'k-admin@test'),
  ('00000000-0000-0000-0000-0000000007a2', 'k-lia@test'),
  ('00000000-0000-0000-0000-0000000007a3', 'k-rita@test'),
  ('00000000-0000-0000-0000-0000000007a4', 'k-sara@test'),
  ('00000000-0000-0000-0000-0000000007a5', 'k-paulo@test'),
  ('00000000-0000-0000-0000-0000000007a6', 'k-ivo@test'),
  ('00000000-0000-0000-0000-0000000007a7', 'k-olga@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000007a1';
update profiles set role = 'community_leader' where id in ('00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-0000000007a7');
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000007f1' where id = '00000000-0000-0000-0000-0000000007a5';
update profiles set role = 'auditor' where id = '00000000-0000-0000-0000-0000000007a6';

insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA7777777777777777777777777777777777777","chain":"solana"}}'),
  ('00000000-0000-0000-0000-0000000007b2', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"YaRa77777777777777777777777777777777777777","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000007c1', 'pgTAP Consent community', 'association', 'Olinda', 'PE',
   '00000000-0000-0000-0000-0000000007a2', 'verified', now(), '00000000-0000-0000-0000-0000000007a1'),
  ('00000000-0000-0000-0000-0000000007c2', 'pgTAP Other community', 'collective', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000007a7', 'verified', now(), '00000000-0000-0000-0000-0000000007a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007a3', 'pgTAP Rita Consent', 'Bolos pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007a4', 'pgTAP Sara Consent', 'Ateliê pgTAP', 'crafts'),
  ('00000000-0000-0000-0000-0000000007e3', null, 'pgTAP Tina Consent', null, 'food');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000007c1', id from entrepreneurs where display_name like 'pgTAP % Consent';
insert into chain_anchors (kind, entity_id)
select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Consent';

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.assess(p_entrepreneur uuid) returns jsonb language sql as $$
  select record_readiness_assessment(p_entrepreneur,
    '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
    '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
      "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
      "missing_requirements":[],"reason_codes":[]}'::jsonb)
$$;

create function pg_temp.eligible(p_entrepreneur uuid) returns jsonb language sql as $$
  select record_eligibility_assessment(p_entrepreneur,
    (select id from credit_intents where entrepreneur_id = p_entrepreneur and status = 'active'),
    (select id from readiness_assessments where entrepreneur_id = p_entrepreneur order by assessment_no desc limit 1),
    '{}'::jsonb,
    jsonb_build_object('model_version', 'eligibility-v0.1.0', 'decision', 'ELIGIBLE',
      'requested_amount_cents', 200000, 'proposed_amount_cents', 200000,
      'term_months', 12, 'instalment_cents', 20000, 'max_instalment_cents', 27500, 'affordability_bps', 1500,
      'suggested_min_cents', 100000, 'suggested_max_cents', 250000, 'risk_band', 'LOW', 'risk_points', 0,
      'confidence', 'HIGH', 'reason_codes', '["AFFORDABLE"]'::jsonb))
$$;

-- ------------------------------------------------------------- recording

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select throws_ok($$ select readiness_inputs('00000000-0000-0000-0000-0000000007e1') $$,
  'P0001', 'no_consent_to_assess', 'no consent on record: her data is not assessed');
select throws_ok($$ select record_consent(false, true, false, false) $$,
  '22023', 'consent_scope_needs_the_one_before', 'nothing is shared that she did not allow to be assessed');
select is((record_consent(true, false, false, true) ->> 'consent_no')::int, 1, 'she records her choices herself');
select is((record_consent(true, false, false, true) ->> 'reused')::boolean, true, 'the same choices again record nothing new');
select results_eq(
  $$ select channel::text, text_version, recorded_by from consents where entrepreneur_id = '00000000-0000-0000-0000-0000000007e1' $$,
  $$ values ('app', 'consent-v2', '00000000-0000-0000-0000-0000000007a3'::uuid) $$,
  'recorded as hers, from the app, against the wording she saw'
);
select ok(readiness_inputs('00000000-0000-0000-0000-0000000007e1') ? 'checkins', 'with consent, the engine may read her months');
set local role postgres;

select is(
  (select count(*)::int from chain_anchors a where a.kind = 'consent'
     and a.depends_on = (select id from chain_anchors where kind = 'enrollment' and entity_id = '00000000-0000-0000-0000-0000000007e1')),
  1, 'the record is queued for Solana, after her registration');
select results_eq(
  $$ select private.anchor_payload('consent', k.id) -> 'scopes', private.anchor_entrepreneur('consent', k.id)
     from consents k where entrepreneur_id = '00000000-0000-0000-0000-0000000007e1' $$,
  $$ values ('{"assessment":true,"partner":false,"investors":false,"impact":true}'::jsonb, '00000000-0000-0000-0000-0000000007e1'::uuid) $$,
  'what is committed: each scope, allowed or not'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a2');
select is((record_consent(true, true, true, true, '00000000-0000-0000-0000-0000000007e3') ->> 'consent_no')::int, 1,
  'a leader records it for a participant without a login, from the signed form');
select is((select channel::text from consents where entrepreneur_id = '00000000-0000-0000-0000-0000000007e3'), 'community',
  'and it says so');
select is((select count(*)::int from consents), 2, 'the leader sees her participants'' records');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a7');
select throws_ok($$ select record_consent(true, true, true, true, '00000000-0000-0000-0000-0000000007e3') $$,
  '42501', 'not_allowed_to_record_consent', 'a leader of another community cannot');
select is((select count(*)::int from consents), 0, 'nor see them');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007b1');
select is((select count(*)::int from consents), 0, 'an investor sees no one''s consent');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select is((select count(*)::int from consents), 0, 'nor does another participant');
select lives_ok($$ select record_consent(true, true, true, true) $$, 'Sara allows everything');
set local role postgres;

-- ------------------------------------------------------------- enforcement

set local role service_role;
select pg_temp.assess(id) from entrepreneurs where id in ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007e2');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select throws_ok($$ select declare_credit_intent('inventory', 200000) $$,
  'P0001', 'no_consent_to_share_with_partner', 'asking for credit needs consent to share with a partner');
select is((record_consent(true, true, false, true) ->> 'consent_no')::int, 2, 'a change of mind is the next record');
select lives_ok($$ select declare_credit_intent('inventory', 200000) $$, 'and then she may ask');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select declare_credit_intent('equipment', 200000);
set local role postgres;

set local role service_role;
select pg_temp.eligible(id) from entrepreneurs where id in ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007e2');
set local role postgres;

create temp table opp as
select o.id, o.entrepreneur_id from qualified_credit_opportunities o
where o.entrepreneur_id in ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007e2');
grant select on opp to authenticated;
create temp table rita as select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000007e1';
create temp table sara as select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000007e2';
grant select on rita, sara to authenticated, service_role;

select results_eq(
  $$ select status::text, funding_status::text from qualified_credit_opportunities where id = (select id from rita) $$,
  $$ values ('referred', null::text) $$,
  'referred to the partner, as she allowed — but not offered to investors'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000007b1');
select is((select count(*)::int from investor_opportunities() where opportunity_id in (select id from opp)), 1,
  'the market shows only Sara''s');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select record_consent(true, true, true, true);
set local role postgres;
select is((select funding_status::text from qualified_credit_opportunities where id = (select id from rita)), 'open',
  'once she allows it, her request opens to investors');
select pg_temp.act_as('00000000-0000-0000-0000-0000000007b1');
select ok((select proofs @> '[{"kind":"consent"}]' from investor_opportunities() where opportunity_id = (select id from rita)),
  'with the proof of her consent among the evidence');
set local role postgres;

set local role service_role;
select record_investment('00000000-0000-0000-0000-0000000007b1', (select id from rita), 5000000, 'wallet',
  'WaNdA7777777777777777777777777777777777777', 'pgTAP-consent-deposit-1');
set local role postgres;

-- She withdraws it: the market forgets her, and Wanda is owed her 5 USDC back.
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a3');
select record_consent(true, true, false, true);
set local role postgres;
select results_eq(
  $$ select o.funding_status::text, i.status::text from qualified_credit_opportunities o
     join investments i on i.opportunity_id = o.id where o.id = (select id from rita) $$,
  $$ values ('refunded', 'refund_due') $$,
  'withdrawing investor consent takes it off the market and refunds what was put in'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000007b2');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from rita)), 0,
  'an investor without a position no longer sees it');
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000007b1');
select is((select count(*)::int from investor_opportunities() where opportunity_id = (select id from rita)), 1,
  'the investor who funded it still sees what became of it');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select record_consent(true, true, false, true);
set local role postgres;
select is((select funding_status::text from qualified_credit_opportunities where id = (select id from sara)), null::text,
  'with nothing funded yet, it simply leaves the market');

-- The partner lends from its own capital what investors are no longer funding.
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select partner_decide((select id from rita), 'approved', 200000, 250, 12);
select lives_ok($$ select transition_loan((select id from loans where opportunity_id = (select id from rita)), 'DISBURSED') $$,
  'a loan taken off the market is disbursed from the partner''s own capital');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a4');
select record_consent(true, true, true, true);
set local role postgres;
select is((select funding_status::text from qualified_credit_opportunities where id = (select id from sara)), 'open',
  'giving it back lists again what was never funded');
select pg_temp.act_as('00000000-0000-0000-0000-0000000007a5');
select partner_decide((select id from sara), 'approved', 200000, 250, 12);
select throws_ok($$ select transition_loan((select id from loans where opportunity_id = (select id from sara)), 'DISBURSED') $$,
  'P0001', 'not_fully_funded', 'while investors are still funding, the partner waits');
set local role postgres;

-- ----------------------------------------------------------------- audit

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a2');
select throws_ok($$ select audit_consents() $$, '42501', 'not_an_auditor', 'a leader does not open the audit console');
select throws_ok($$ select audit_attestations() $$, '42501', 'not_an_auditor', 'nor its proofs list');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000007a6');
select is(audit_consents() -> 'checks',
  '{"assessed_without_consent":0,"eligibility_without_consent":0,"referred_without_consent":0,"listed_without_consent":0}'::jsonb,
  'every assessment, referral and listing happened with the consent in force');
select results_eq(
  $$ select (audit_consents() ->> 'records')::int, (audit_consents() ->> 'changes')::int,
            (audit_consents() -> 'by_channel' ->> 'community')::int $$,
  $$ values (8, 5, 1) $$,
  'eight records, five of them changes of mind, one recorded by a community'
);
select is((audit_attestations('consent') ->> 'total')::int, 8, 'each record has its proof queued');
select ok(
  (select bool_and(r ->> 'participant' ~ '^P-[0-9A-F]{6}$') from jsonb_array_elements(audit_attestations('consent') -> 'rows') r),
  'proofs name participants by code');
select ok(
  audit_events() @> '[{"kind":"consent"}]' and audit_events()::text !~ 'pgTAP (Rita|Sara|Tina)',
  'the event log shows every consent, and no one''s name');
select ok(audit_system() ?& array['anchors', 'reconcile', 'refunds', 'vault', 'jobs']
  and (audit_system() -> 'refunds' ->> 'due')::int = 1,
  'the system view shows the queues, including the refund owed to Wanda');
set local role postgres;

select * from finish();
rollback;
