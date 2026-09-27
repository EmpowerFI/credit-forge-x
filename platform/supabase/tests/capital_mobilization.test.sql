-- Cost to Mobilize Capital: what it costs to bring the money in, itemised, and
-- the boundary that keeps it out of cost to serve (addendum v2 §7, §8).
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(37);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000012a1', 'ctm-rita@test'),
  ('00000000-0000-0000-0000-0000000012a2', 'ctm-desk@test'),
  ('00000000-0000-0000-0000-0000000012a3', 'ctm-clara@test');
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents) values
  ('00000000-0000-0000-0000-0000000012ab', 'CTM Desk', 'fintech', 10000, 5000000);
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000012a1';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000012ab'
  where id = '00000000-0000-0000-0000-0000000012a2';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000012a3';

-- ------------------------------------------------------------- the rate card

select is(
  (select count(*)::int from capital_mobilization_rates where card_version = 'pilot-2026.09'),
  3, 'the pilot card prices the three mobilisation stages of §7');

select is(
  (select count(*)::int from capital_mobilization_rates r
   where not exists (select 1 from cost_rate_cards c where c.version = r.card_version)),
  0, 'and every mobilisation rate belongs to a card, as every cost rate does');

-- Priced by the same formula private.record_cost() uses, so a minute costs the
-- same whichever side of the boundary it is spent on.
select is(
  (select round(staff_minutes * hourly_rate_cents / 60.0) + fixed_cents
   from capital_mobilization_rates where stage = 'compliance_kyb' and card_version = 'pilot-2026.09'),
  3375::numeric, 'forty-five minutes at the desk rate is R$ 33,75');

select is(
  (select sum(round(staff_minutes * hourly_rate_cents / 60.0) + fixed_cents)
   from capital_mobilization_rates where card_version = 'pilot-2026.09'),
  5175::numeric, 'operating one mobilisation costs R$ 51,75 by the pilot card');

-- ------------------------------------------------- the boundary §7 asks for

-- The reason these rates are not on cost_rates: public.operating_economics()
-- lists every stage the card prices, so a mobilisation rate placed there would
-- appear inside cost to serve by default.
select is(
  (select count(*)::int from cost_rates
   where stage::text in ('compliance_kyb', 'wallet_infrastructure', 'capital_mobilization')),
  0, 'no mobilisation stage is a cost-to-serve rate');

select is(
  (select count(*)::int from pg_enum
   where enumtypid = 'public.cost_stage'::regtype
     and enumlabel in ('compliance_kyb', 'wallet_infrastructure', 'capital_mobilization')),
  0, 'nor a value of cost_stage, so it cannot be recorded against a person');

select is(
  (select count(*)::int from cost_events
   where stage::text in ('compliance_kyb', 'wallet_infrastructure', 'capital_mobilization')),
  0, 'and no cost event carries one');

-- --------------------------------------------------------------- provenance

select is(private.provenance_values(),
  array['observed', 'partner_provided', 'simulated', 'benchmark'],
  'provenance is its own four-value question, beside reality and the data legend');

select is(private.cost_provenance('simulated'), 'simulated',
  'an assumed rate card makes an assumed number');

select is(private.cost_provenance('observed'), 'observed',
  'and a measured one a measured number');

select is(private.quote_provenance('sandbox'), 'partner_provided',
  'a number a provider''s sandbox returned was given to us');

select is(private.quote_provenance('simulated'), 'simulated',
  'and a seeded rate card was not: never the same mark');

-- ------------------------------------------------------ CTM for one ticket

insert into entrepreneurs (id, profile_id, display_name, city, state) values
  ('00000000-0000-0000-0000-0000000012e1', '00000000-0000-0000-0000-0000000012a1', 'CTM Rita', 'Campinas', 'SP'),
  ('00000000-0000-0000-0000-0000000012e2', '00000000-0000-0000-0000-0000000012a3', 'CTM Clara', 'Campinas', 'SP');
insert into credit_intents (id, entrepreneur_id, purpose, requested_amount_cents) values
  ('00000000-0000-0000-0000-0000000012c1', '00000000-0000-0000-0000-0000000012e1', 'inventory', 500000),
  ('00000000-0000-0000-0000-0000000012c2', '00000000-0000-0000-0000-0000000012e2', 'inventory', 300000);
insert into readiness_assessments (id, entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
  components, missing_requirements, reason_codes, features) values
  ('00000000-0000-0000-0000-0000000012d1', '00000000-0000-0000-0000-0000000012e1', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb),
  ('00000000-0000-0000-0000-0000000012d2', '00000000-0000-0000-0000-0000000012e2', 1, 'test', private.current_period(),
   'CREDIT_READY', 'HIGH', 70, '{"data_quality": 18}'::jsonb, '{}', '{}', '{"months_reported": 12}'::jsonb);
insert into eligibility_assessments (id, entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version,
  decision, requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
  risk_band, risk_points, confidence, reason_codes, inputs) values
  ('00000000-0000-0000-0000-0000000012b1', '00000000-0000-0000-0000-0000000012e1', '00000000-0000-0000-0000-0000000012c1',
   '00000000-0000-0000-0000-0000000012d1', 1, 'test', 'ELIGIBLE', 500000, 500000, 12, 50000, 90000, 'LOW', 10, 'HIGH', '{}', '{}'::jsonb),
  ('00000000-0000-0000-0000-0000000012b2', '00000000-0000-0000-0000-0000000012e2', '00000000-0000-0000-0000-0000000012c2',
   '00000000-0000-0000-0000-0000000012d2', 1, 'test', 'ELIGIBLE', 300000, 300000, 12, 30000, 60000, 'LOW', 10, 'HIGH', '{}', '{}'::jsonb);
-- One ticket funded from abroad, one funded at home.
insert into qualified_credit_opportunities (id, entrepreneur_id, intent_id, eligibility_id, opportunity_no,
  amount_cents, term_months, instalment_cents, purpose, risk_band, confidence, status, desired_date, urgency, funding_pool) values
  ('00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012e1', '00000000-0000-0000-0000-0000000012c1',
   '00000000-0000-0000-0000-0000000012b1', 1, 500000, 12, 50000, 'inventory', 'LOW', 'HIGH', 'in_review', current_date + 30, 'soon', 'global'),
  ('00000000-0000-0000-0000-0000000012f2', '00000000-0000-0000-0000-0000000012e2', '00000000-0000-0000-0000-0000000012c2',
   '00000000-0000-0000-0000-0000000012b2', 1, 300000, 12, 30000, 'inventory', 'LOW', 'HIGH', 'in_review', current_date + 30, 'soon', 'domestic');

select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') ->> 'mobilized_cents')::bigint,
  500000::bigint, 'CTM is asked about the capital that actually crosses the border');

select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'operating' ->> 'total_cents')::bigint,
  5175::bigint, 'operating the mobilisation is the card''s three stages');

select ok(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'market' ->> 'cost_bps')::integer > 0,
  'and the rails are priced by the comparator, which is the only place that prices a conversion');

-- The two sides add up, and nothing else is in the total.
select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') ->> 'total_cents')::bigint,
  (select (m ->> 'x')::bigint from (select jsonb_build_object('x',
     (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'operating' ->> 'total_cents')::bigint
     + (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'market' ->> 'total_cents')::bigint) as m) t),
  'CTM is operations plus rails, and nothing else');

-- §7's rule, and decision 2 of PLAN_CAPITAL_NETWORK_V2 §6.1.
select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'cost_of_capital' ->> 'in_ctm'),
  'false', 'the hedge is reported beside CTM, never inside it');

select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') -> 'cost_of_capital' ->> 'fx_hedge_bps_year')::integer,
  500, 'and it is named for what it is: 500 basis points a year of currency risk');

-- One integer, because basis points of the principal and centavos per R$ 100 are
-- the same number, and two keys would invite a screen to show it as two facts.
select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') ->> 'rate_bps')::integer,
  (select round(
     (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') ->> 'total_cents')::numeric * 10000 / 500000)::integer),
  'the CTM rate is the cost over the capital moved');

select ok(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1') ->> 'rate_bps')::integer between 200 and 400,
  'which on a R$ 5.000 ticket is a few hundred basis points, not nothing');

-- An amount outside every provider's policy is still priced, and marked as not
-- executable: a quote nobody can execute still says what the conversion costs,
-- and CTM is a cost question. Reporting nothing there would read as free.
select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1', 900000000) -> 'market' ->> 'executable'),
  'false', 'a ticket outside every provider''s policy is priced, and says it cannot be executed');

select ok(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f1', 900000000) ->> 'total_cents')::bigint > 5175,
  'and CTM still carries both sides of it, not a silent zero');

-- Nothing mobilised, nothing spent mobilising it: the operating stages are not
-- charged against a ticket that never crossed a border.
select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f2') ->> 'total_cents')::bigint,
  0::bigint, 'a ticket funded at home has no cost to mobilize at all');

select is(
  (private.capital_mobilization('00000000-0000-0000-0000-0000000012f2') ->> 'rate_bps'),
  null, 'and no rate, because there is nothing to divide by');

-- ------------------------------------------------------------ the snapshot

set local role postgres;
update qualified_credit_opportunities set allocated_at = now(), allocation_model_version = 'test'
  where id in ('00000000-0000-0000-0000-0000000012f1', '00000000-0000-0000-0000-0000000012f2');

select ok(
  (select mobilization_cents > 0 from operating_economics_snapshots
   where opportunity_id = '00000000-0000-0000-0000-0000000012f1'),
  'the snapshot freezes what mobilising this ticket cost when it opened for funding');

select is(
  (select mobilized_cents from operating_economics_snapshots
   where opportunity_id = '00000000-0000-0000-0000-0000000012f1'),
  500000::bigint, 'beside how much was mobilised, so a rate can be recomputed from the row');

select is(
  (select mobilization_cents from operating_economics_snapshots
   where opportunity_id = '00000000-0000-0000-0000-0000000012f2'),
  null, 'a ticket funded at home mobilised nothing, and the column says null, not zero');

select isnt(
  (select cost_total_cents from operating_economics_snapshots
   where opportunity_id = '00000000-0000-0000-0000-0000000012f1'),
  (select mobilization_cents from operating_economics_snapshots
   where opportunity_id = '00000000-0000-0000-0000-0000000012f1'),
  'cost to serve and cost to mobilize are two columns, and one row never adds them');

-- ---------------------------------------------------------- the portfolio

select pg_temp.act_as('00000000-0000-0000-0000-0000000012a2');

select ok(
  (public.capital_mobilization_summary() ->> 'mobilized_cents')::bigint >= 500000,
  'the desk reads the portfolio: what crossed the border, and what that cost');

select is(
  (public.capital_mobilization_summary() ->> 'tickets')::int,
  1, 'counting only the tickets that mobilised anything');

select is(
  (public.capital_mobilization_summary() -> 'cost_of_capital' ->> 'in_ctm'),
  'false', 'and the hedge stays beside the portfolio number too');

select is(
  (public.capital_mobilization_summary() ->> 'provenance'),
  'simulated', 'every figure carries the mark of the card that priced it');

select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');

select throws_ok(
  $$ select public.capital_mobilization_summary() $$,
  '42501', null, 'an entrepreneur does not read what it costs to fund her');

-- -------------------------------------------- CTS and CTM in one payload

select pg_temp.act_as('00000000-0000-0000-0000-0000000012a2');

select isnt(
  (public.opportunity_economics('00000000-0000-0000-0000-0000000012f1') -> 'mobilization'),
  null, 'one opportunity comes back with cost to serve and cost to mobilize together');

select is(
  (public.opportunity_economics('00000000-0000-0000-0000-0000000012f2') -> 'mobilization'),
  'null'::jsonb, 'and with nothing where nothing crossed a border');

select isnt(
  (public.opportunity_economics('00000000-0000-0000-0000-0000000012f1') -> 'so_far'),
  null, 'cost to serve is untouched by any of this');

-- The one number §8 exists to prevent being hidden: the cost of serving the loan
-- is still reported, whatever the rails cost. Counted as postgres, because the
-- desk does not read cost_events directly and the comparison would be empty.
set local role postgres;
select ok(
  (public.operating_economics() #>> '{cost,total_cents}')::bigint
    = (select coalesce(sum(amount_cents), 0) from cost_events),
  'and the programme''s cost to serve still counts every recorded event, and only those');

select finish();
rollback;
