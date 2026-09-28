-- What every number is made of: the four evidence labels, derived from the rows
-- rather than declared (addendum v3 §9).
--
-- The thing worth testing is that a label cannot be talked up. A score computed
-- from a simulated month is a simulated score however carefully it was
-- computed, and this file sets up exactly that trap: real assessments over
-- simulated check-ins, and a real loan over both. If the reader ever reported a
-- family by its own flag alone, the product would claim to have observed
-- something it inferred from an invention.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(17);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.fam(p_key text) returns jsonb language sql stable as $$
  select f from public.evidence_ledger(), jsonb_array_elements(evidence_ledger -> 'families') as t(f)
   where f ->> 'key' = p_key
$$;
create function pg_temp.ev(p_key text) returns text language sql stable as $$
  select pg_temp.fam(p_key) ->> 'evidence'
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1', 'ev-admin@test'),
  ('00000000-0000-0000-0000-0000000017a2', 'ev-leader@test'),
  ('00000000-0000-0000-0000-0000000017a3', 'ev-rosa@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000017a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000017a2';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000017a3';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000017c1', 'pgTAP Evidence community', 'association', 'Natal', 'RN',
   '00000000-0000-0000-0000-0000000017a2', 'verified', now(), '00000000-0000-0000-0000-0000000017a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector, city, state) values
  ('00000000-0000-0000-0000-0000000017e1', '00000000-0000-0000-0000-0000000017a3', 'Ev Rosa', 'Ateliê Rosa', 'textiles', 'Natal', 'RN');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000017c1', '00000000-0000-0000-0000-0000000017e1');

-- --------------------------------------------------------------- the shape

select pg_temp.act_as('00000000-0000-0000-0000-0000000017a1');

select is(
  (select (evidence_ledger -> 'families_total')::int from public.evidence_ledger()), 11,
  'the product names eleven families of figures, and labels every one of them');

select is(
  (select array_agg(f ->> 'key')
     from public.evidence_ledger(), jsonb_array_elements(evidence_ledger -> 'families') as t(f)),
  array['business_months', 'readiness_and_eligibility', 'loans_and_instalments', 'pool_capital',
        'partner_routes', 'settlement_quotes', 'fx_rates', 'cost_rates', 'solana_anchors',
        'zcash_returns', 'local_rail'],
  'in the order a figure is built, from the months a business reports outwards');

-- ------------------------------------------------------ nothing claims too much

-- An empty table is not evidence of anything, and the safe direction is down.
select is(pg_temp.ev('fx_rates'), 'simulated_assumption',
  'with no exchange rate recorded from a source, the rate is this prototype''s assumption');

select is(pg_temp.ev('zcash_returns'), 'simulated_assumption',
  'and with no shielded return sent, there is nothing observed to report');

select is(pg_temp.ev('solana_anchors'), 'simulated_assumption',
  'a queue of anchors nobody has confirmed proves nothing yet');

-- ---------------------------------------------------- and a label travels up

set local role postgres;
insert into checkins (entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents,
  keeps_records, active_days, is_simulated)
values ('00000000-0000-0000-0000-0000000017e1', private.current_period(), 500000, 200000, 60000, 100000,
  true, 24, true);
-- Deliberately not simulated: an assessment claiming to be observed, computed
-- from a month that was invented.
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features, is_simulated) values
  ('00000000-0000-0000-0000-000000017aa1', '00000000-0000-0000-0000-0000000017e1', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb, false);

select pg_temp.act_as('00000000-0000-0000-0000-0000000017a1');

select is(pg_temp.ev('business_months'), 'simulated_assumption',
  'the month was invented, and says so');

select is((pg_temp.fam('readiness_and_eligibility') ->> 'real_rows')::int, 1,
  'the assessment over it carries no simulation flag of its own');

select is(pg_temp.ev('readiness_and_eligibility'), 'simulated_assumption',
  'and it is a simulated figure anyway, because a score is never stronger than the month under it');

-- ------------------------------------------------------- proof makes a family

set local role postgres;
insert into chain_anchors (kind, entity_id, status, signature, slot, commitment, confirmed_at)
values ('community', '00000000-0000-0000-0000-0000000017c1', 'confirmed', 'pgTAPsig', 1, decode(repeat('a', 64), 'hex'), now());
select pg_temp.act_as('00000000-0000-0000-0000-0000000017a1');

select is(pg_temp.ev('solana_anchors'), 'observed_pilot_data',
  'one confirmed anchor is a transaction that happened, and the family says observed');

select is((pg_temp.fam('solana_anchors') ->> 'real_rows')::int, 1,
  'and it counts the confirmed one rather than the queue');

select is((select (evidence_ledger -> 'observed_families')::int from public.evidence_ledger()), 1,
  'which is the one family here anybody has observed');

-- The product still may not claim more than its weakest family, whatever any
-- single family managed to prove.
select is((select evidence_ledger ->> 'weakest' from public.evidence_ledger()), 'simulated_assumption',
  'and the product as a whole still claims only what its weakest family claims');

-- ------------------------------------------------------------- the mapping

set local role postgres;

-- A rail vocabulary of four values narrows onto the addendum's four words, and
-- does not map one to one: a sandbox is an institution's own figure and a
-- devnet transaction is one that happened.
select is(private.evidence_from_quote_reality('sandbox')::text, 'partner_provided',
  'a partner''s sandbox quote is that partner''s own figure');
select is(private.evidence_from_quote_reality('devnet')::text, 'observed_pilot_data',
  'a devnet transaction happened and was recorded');
select is(private.evidence_from_quote_reality('simulated')::text, 'simulated_assumption',
  'and a simulated rail quotes an assumption');

-- --------------------------------------------------------------- who reads

-- Counts only, and no figure about any person: whoever may read a number in
-- this product may read what kind of claim it is.
select pg_temp.act_as('00000000-0000-0000-0000-0000000017a3');
select isnt((select evidence_ledger from public.evidence_ledger()), null,
  'an entrepreneur reads what kind of numbers she is being shown');

set local role anon;
select throws_ok(
  $$ select public.evidence_ledger() $$,
  '42501', null, 'and a signed-out visitor cannot ask at all');

set local role postgres;
select * from finish();
rollback;
