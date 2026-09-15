-- Investing: wallet investors, opportunities open for funding, allocations,
-- refunds, and what an investor may see.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(24);

-- ------------------------------------------------------------------ fixtures
-- One partner, one community, Rita and Sara ready and asking. Two wallet
-- investors, Wanda and Yara; Rita herself as an entrepreneur user.

update partners set active = false where name not like 'pgTAP %';
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents, accepted_purposes) values
  ('00000000-0000-0000-0000-0000000004f1', 'pgTAP Invest partner', 'credit_union', 10000, 1000000, '{inventory,working_capital,equipment}');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'i-admin@test'),
  ('00000000-0000-0000-0000-0000000004a2', 'i-lia@test'),
  ('00000000-0000-0000-0000-0000000004a3', 'i-rita@test'),
  ('00000000-0000-0000-0000-0000000004a4', 'i-sara@test'),
  ('00000000-0000-0000-0000-0000000004a5', 'i-paulo@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000004a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000004a2';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000004f1' where id = '00000000-0000-0000-0000-0000000004a5';

-- Wallet sign-ups, as Supabase's Sign in with Solana creates them.
insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004b1', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"WaNdA1111111111111111111111111111111111111","chain":"solana"}}'),
  ('00000000-0000-0000-0000-0000000004b2', '{"provider":"web3","providers":["web3"]}',
   '{"custom_claims":{"address":"YaRa22222222222222222222222222222222222222","chain":"solana"}}');

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000004c1', 'pgTAP Invest community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000004a2', 'verified', now(), '00000000-0000-0000-0000-0000000004a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector) values
  ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004a3', 'pgTAP Rita Invest', 'Bolos da Rita pgTAP', 'food'),
  ('00000000-0000-0000-0000-0000000004e2', '00000000-0000-0000-0000-0000000004a4', 'pgTAP Sara Invest', 'Ateliê Sara pgTAP', 'crafts');
insert into community_memberships (community_id, entrepreneur_id)
select '00000000-0000-0000-0000-0000000004c1', id from entrepreneurs where display_name like 'pgTAP % Invest';
insert into chain_anchors (kind, entity_id)
select 'enrollment', id from entrepreneurs where display_name like 'pgTAP % Invest';

set local role service_role;
select record_readiness_assessment(id,
  '{"as_of_period":"2026-09","months_reported":6,"records_kept_bps":10000,"inconsistencies":0}'::jsonb,
  '{"model_version":"readiness-v0.1.0","status":"CREDIT_READY","band":"HIGH","score":92,
    "components":{"preparation":25,"regularity":25,"data_quality":25,"business":17},
    "missing_requirements":[],"reason_codes":[]}'::jsonb)
from entrepreneurs where display_name like 'pgTAP % Invest';
set local role postgres;

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000004a3');
select declare_credit_intent('inventory', 200000);
set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a4');
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
from entrepreneurs e where e.display_name like 'pgTAP % Invest';
set local role postgres;

create temp table opp as
select o.id, o.entrepreneur_id, o.funding_target_micro_usdc from qualified_credit_opportunities o
where o.entrepreneur_id in ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004e2');
grant select on opp to authenticated;
create temp table rita as select id, funding_target_micro_usdc as target from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000004e1';
grant select on rita to authenticated;

-- ------------------------------------------------------------------ wallets

select results_eq(
  $$ select role::text, wallet_address from profiles where id = '00000000-0000-0000-0000-0000000004b1' $$,
  $$ values ('capital_provider', 'WaNdA1111111111111111111111111111111111111') $$,
  'signing in with a Solana wallet makes a capital provider, known by its address'
);

-- ------------------------------------------------------------------ funding

select results_eq(
  $$ select funding_status::text, funding_target_micro_usdc, fx_brl_per_usdc_milli
     from qualified_credit_opportunities where id = (select id from rita) $$,
  $$ values ('open', 371000000::bigint, 5400) $$,
  'an eligible request opens for funding: R$ 2,000 at the demo quote of R$ 5.40 is 371 USDC'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000004b1');
select is((select count(*)::int from investor_opportunities() where opportunity_id in (select id from opp)), 2,
  'an investor sees both opportunities in the market');
select ok(
  (select bool_and(code ~ '^Q-[0-9A-F]{6}$') from investor_opportunities() where opportunity_id in (select id from opp))
  and (select string_agg(row_to_json(x)::text, '') from investor_opportunities() x where opportunity_id in (select id from opp))
      !~ 'pgTAP Rita|Bolos da Rita|00000000-0000-0000-0000-0000000004e1',
  'under a code of their own: no name, no business name, no link to the person'
);
select ok(
  (select jsonb_array_length(proofs) >= 1 and readiness_score = 92 and community_name = 'pgTAP Invest community'
   from investor_opportunities() where opportunity_id = (select id from rita)),
  'with the evidence behind it: readiness, verified community, proofs'
);
select throws_ok($$ select record_investment(auth.uid(), (select id from rita), 1000000, 'simulated') $$,
  '42501', null, 'an investor cannot record an allocation directly');
select is((select count(*)::int from investments), 0, 'and sees no one else''s');
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-0000000004a3');
select throws_ok($$ select * from investor_opportunities() $$, '42501', 'not_allowed_to_see_opportunities',
  'an entrepreneur does not browse the market');
set local role postgres;

-- Wanda funds 100 USDC from her wallet; Yara the rest.
select is(
  (record_investment('00000000-0000-0000-0000-0000000004b1', (select id from rita), 100000000, 'wallet',
     'WaNdA1111111111111111111111111111111111111', 'sig-wanda-1') ->> 'reused')::boolean,
  false, 'a confirmed deposit becomes an allocation'
);
select is(
  (record_investment('00000000-0000-0000-0000-0000000004b1', (select id from rita), 100000000, 'wallet',
     'WaNdA1111111111111111111111111111111111111', 'sig-wanda-1') ->> 'reused')::boolean,
  true, 'the same deposit twice is recorded once'
);
select results_eq(
  $$ select funding_status::text, funded_micro_usdc from qualified_credit_opportunities where id = (select id from rita) $$,
  $$ values ('partially_funded', 100000000::bigint) $$,
  'the opportunity is partially funded'
);
select results_eq(
  $$ select (select depends_on from chain_anchors where kind = 'allocation' and entity_id = i.id)
            = (select id from chain_anchors where kind = 'opportunity' and entity_id = i.opportunity_id)
     from investments i where i.deposit_signature = 'sig-wanda-1' $$,
  $$ values (true) $$,
  'its allocation is queued for the chain after the opportunity''s proof'
);
select throws_ok(
  $$ select record_investment('00000000-0000-0000-0000-0000000004b2', (select id from rita), 300000000, 'wallet',
       'YaRa22222222222222222222222222222222222222', 'sig-yara-too-much') $$,
  '22023', 'exceeds_remaining', 'no allocation beyond what is still to fund'
);
select throws_ok(
  $$ insert into investments (investor_id, opportunity_id, amount_micro_usdc, mode)
     values ('00000000-0000-0000-0000-0000000004b2', (select id from rita), 1000000, 'wallet') $$,
  '23514', null, 'wallet money always has a deposit on chain'
);
select record_investment('00000000-0000-0000-0000-0000000004b2', (select id from rita), (select target from rita) - 100000000,
  'wallet', 'YaRa22222222222222222222222222222222222222', 'sig-yara-1');
select is((select funding_status::text from qualified_credit_opportunities where id = (select id from rita)), 'funded',
  'and funded when the target is reached');
select throws_ok(
  $$ select record_investment('00000000-0000-0000-0000-0000000004b2', (select id from rita), 1000000, 'wallet',
       'YaRa22222222222222222222222222222222222222', 'sig-yara-2') $$,
  'P0001', 'opportunity_not_open', 'after which it takes no more'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000004b1');
select results_eq(
  $$ select (investor_portfolio() ->> 'positions')::int, (investor_portfolio() ->> 'invested_micro_usdc')::bigint,
            (select count(*)::int from investments) $$,
  $$ values (1, 100000000::bigint, 1) $$,
  'Wanda''s portfolio is her one position, and she sees only her own allocation'
);
select lives_ok($$ select audit_record('allocation', (select id from investments limit 1)) $$,
  'she can audit her allocation');
select ok(
  (select (investor_position(id) -> 'investment' ->> 'amount_micro_usdc')::bigint = 100000000
     and investor_position(id) -> 'opportunity' ->> 'code' ~ '^Q-' from investments limit 1),
  'her position in full: the allocation and the opportunity as she saw it'
);
select is((select count(*)::int from investor_activity() where kind = 'invested'), 1, 'her activity starts with the allocation');
select is((select count(*)::int from investor_proofs() where kind = 'allocation'), 1, 'and her proofs include it');
set local role postgres;
create temp table wanda_inv as select id from investments where deposit_signature = 'sig-wanda-1';
grant select on wanda_inv to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000004b2');
select throws_ok(
  $$ select audit_record('allocation', (select id from wanda_inv)) $$,
  '42501', 'not_allowed_to_audit', 'Yara cannot audit Wanda''s'
);
select throws_ok($$ select investor_position((select id from wanda_inv)) $$, '42501', 'not_your_position',
  'nor open her position');
set local role postgres;

-- The partner declines Sara, partly funded: her investors are owed their capital.
select record_investment('00000000-0000-0000-0000-0000000004b2', o.id, 50000000, 'wallet',
  'YaRa22222222222222222222222222222222222222', 'sig-yara-sara')
from opp o where o.entrepreneur_id = '00000000-0000-0000-0000-0000000004e2';
select pg_temp.act_as('00000000-0000-0000-0000-0000000004a5');
select partner_decide((select id from opp where entrepreneur_id = '00000000-0000-0000-0000-0000000004e2'), 'declined',
  p_reason => 'Outside our focus');
set local role postgres;
select results_eq(
  $$ select o.funding_status::text, i.status::text from qualified_credit_opportunities o
     join investments i on i.opportunity_id = o.id
     where o.entrepreneur_id = '00000000-0000-0000-0000-0000000004e2' $$,
  $$ values ('refunded', 'refund_due') $$,
  'a declined opportunity refunds: the allocation is due back'
);

select * from finish();
rollback;
