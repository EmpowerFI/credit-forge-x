-- The rate in use is an observation when there is one, and a stated assumption
-- when there is not. Market prices are nobody's private business, but only the
-- feed may write them.
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(11);

-- ------------------------------------------------------------------ fixtures

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'fx-ana@test'),
  ('00000000-0000-0000-0000-0000000005a2', 'fx-admin@test');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000005a2';

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

-- ------------------------------------------------- with nothing observed yet

delete from fx_rates where true;

select is(private.brl_per_usdc_milli(now()), 5400,
  'with nothing observed, the rate is the stated assumption');
select is(fx_market() ->> 'in_use_source', 'assumed', 'and it says so');
select is((fx_market() ->> 'fallback_milli')::integer, 5400, 'naming the assumption it fell back to');

-- ------------------------------------------------------ once the feed speaks

set local role service_role;
select is(
  record_fx_rates(jsonb_build_array(
    jsonb_build_object('source', 'mercado_bitcoin', 'pair', 'USDC/BRL',
      'bid_milli', 5129, 'ask_milli', 5130, 'mid_milli', 5130, 'observed_at', private.iso(now() - interval '2 minutes')),
    jsonb_build_object('source', 'awesomeapi', 'pair', 'USD/BRL',
      'bid_milli', 5108, 'ask_milli', 5109, 'mid_milli', 5109, 'observed_at', private.iso(now() - interval '2 minutes'))
  )),
  2, 'the feed records what it read');
select is(
  record_fx_rates(jsonb_build_array(
    jsonb_build_object('source', 'mercado_bitcoin', 'pair', 'USDC/BRL',
      'bid_milli', 5129, 'ask_milli', 5130, 'mid_milli', 5130, 'observed_at', private.iso(now() - interval '2 minutes'))
  )),
  0, 'and reading the same tick twice records it once');
set local role postgres;

select is(private.brl_per_usdc_milli(now()), 5130, 'the rate in use is the freshest observation');
select is(fx_market() ->> 'in_use_source', 'observed', 'and it says that too');
select is(
  (select count(*)::int from jsonb_array_elements(fx_market() -> 'rates')), 2,
  'both pairs are reported: what USDC fetches, and the commercial dollar beside it');

-- ---------------------------------------------------------- when it goes stale

update fx_rates set observed_at = now() - interval '2 hours' where true;
select is(private.brl_per_usdc_milli(now()), 5400,
  'a feed that stopped is not a rate: it falls back rather than pricing on yesterday');

-- ------------------------------------------------------------------ who may

select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1');
select ok((select count(*) from fx_rates) > 0, 'anyone signed in reads market prices');
select throws_ok(
  $$ select record_fx_rates('[]'::jsonb) $$, '42501', null,
  'but only the feed writes them');
set local role postgres;

select * from finish();
rollback;
