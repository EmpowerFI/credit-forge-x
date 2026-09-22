-- The reference rate comes from the central bank, and each pair ages differently
--
-- AwesomeAPI answered 429 from the function's egress address: a free scraper
-- rate-limited by IP is not something a demo should depend on. The commercial
-- dollar now comes from the Banco Central's PTAX, which is the official rate,
-- free, and needs no key.
--
-- PTAX publishes on business days, so on a Monday the last one is Friday's.
-- That is not staleness, it is what a daily reference is — while the USDC/BRL
-- price that actually prices a decision has to be minutes old. So freshness is
-- per pair: half an hour for the market that settles, two days for the
-- reference beside it.

alter table public.fx_rates drop constraint fx_rates_source_check;
alter table public.fx_rates add constraint fx_rates_source_check
  check (source in ('mercado_bitcoin', 'bcb_ptax', 'awesomeapi'));

create function private.fx_max_age(p_pair text)
returns interval language sql immutable set search_path = ''
as $$ select case p_pair when 'USD/BRL' then interval '2 days' else interval '30 minutes' end $$;

-- The rate in use, unchanged in meaning: the freshest USDC/BRL at or before
-- that instant, and the stated assumption when there is none.
create or replace function private.brl_per_usdc_milli(p_at timestamptz default now())
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select r.mid_milli from public.fx_rates r
      where r.pair = 'USDC/BRL'
        and r.observed_at <= coalesce(p_at, now())
        and r.observed_at >= coalesce(p_at, now()) - private.fx_max_age('USDC/BRL')
      order by r.observed_at desc limit 1),
    5400);
$$;

create or replace function public.fx_market()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object(
          'pair', x.pair, 'source', x.source,
          'bid_milli', x.bid_milli, 'ask_milli', x.ask_milli, 'mid_milli', x.mid_milli,
          'observed_at', private.iso(x.observed_at),
          'age_seconds', floor(extract(epoch from (now() - x.observed_at)))::bigint,
          -- Half an hour for the market that settles; two days for a reference
          -- the central bank publishes once a business day.
          'fresh', x.observed_at >= now() - private.fx_max_age(x.pair)
        ) order by x.pair)
      from (
        select distinct on (r.pair) r.* from public.fx_rates r order by r.pair, r.observed_at desc
      ) x), '[]'::jsonb),
    'in_use_milli', private.brl_per_usdc_milli(now()),
    'in_use_source', case
      when exists (select 1 from public.fx_rates r where r.pair = 'USDC/BRL'
                   and r.observed_at >= now() - private.fx_max_age('USDC/BRL'))
      then 'observed' else 'assumed' end,
    'fallback_milli', 5400,
    'max_age_seconds', extract(epoch from private.fx_max_age('USDC/BRL'))::integer);
$$;

drop function private.fx_max_age();

revoke all on function private.fx_max_age(text) from public, anon;
revoke all on function public.fx_market() from public, anon;
grant execute on function public.fx_market() to authenticated;
