-- The rate stops being a constant
--
-- Until now every price in reais came from private.demo_brl_per_usdc_milli(),
-- a fixed 5.40. That made one claim of the settlement model untestable: the two
-- routes differ in *where the rate is struck* — the BRL stablecoin buys her
-- reais at allocation, the direct off-ramp at payout — and with a constant,
-- striking it earlier changed nothing at all. The only difference left between
-- the routes was the fee we assumed for them.
--
-- So the rate becomes an observation. public.fx_rates is a time series of what
-- USDC is actually worth in reais, fetched by the fx-quote function from
-- Mercado Bitcoin (USDC/BRL, the price at which USDC becomes reais in Brazil)
-- and AwesomeAPI (USD/BRL, the commercial dollar, as the reference beside it).
-- private.brl_per_usdc_milli(at) reads the freshest observation at or before
-- that instant and falls back to the old constant when there is none — so with
-- an empty table, or a feed that stopped, every number reads exactly as it did
-- before this migration, and says it is an assumption.
--
-- Nothing personal leaves the platform for this: both sources are public price
-- endpoints that take no parameters.

create table public.fx_rates (
  id bigint generated always as identity primary key,
  -- Who was asked, and for what price.
  source text not null check (source in ('mercado_bitcoin', 'awesomeapi')),
  pair text not null check (pair in ('USDC/BRL', 'USD/BRL')),
  -- Reais per unit, in thousandths, as everything else in this schema.
  bid_milli integer not null check (bid_milli > 0),
  ask_milli integer not null check (ask_milli > 0),
  mid_milli integer not null check (mid_milli > 0),
  -- The venue's own timestamp, and when we read it.
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  constraint fx_rates_spread check (ask_milli >= bid_milli),
  unique (source, pair, observed_at)
);

comment on table public.fx_rates is
  'Observed market rates, from public price endpoints. Never a quote for a transaction: what a provider would charge is its own rate card.';

create index fx_rates_pair_idx on public.fx_rates (pair, observed_at desc);

alter table public.fx_rates enable row level security;
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to authenticated;
-- Market prices are nobody's private business.
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);

-- How old an observation may be and still be the rate in use. The feed runs
-- every ten minutes; beyond half an hour the market has moved without us and
-- the honest answer is to say so and fall back.
create function private.fx_max_age()
returns interval language sql immutable set search_path = ''
as $$ select interval '30 minutes' $$;

-- What USDC was worth in reais at that instant: the freshest observation at or
-- before it, and the old constant when there is none.
create function private.brl_per_usdc_milli(p_at timestamptz default now())
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select r.mid_milli from public.fx_rates r
      where r.pair = 'USDC/BRL'
        and r.observed_at <= coalesce(p_at, now())
        and r.observed_at >= coalesce(p_at, now()) - private.fx_max_age()
      order by r.observed_at desc limit 1),
    5400);
$$;

-- The old name, kept so every caller keeps working, and no longer a constant.
-- New code calls private.brl_per_usdc_milli(at); this one always means "now".
create or replace function private.demo_brl_per_usdc_milli()
returns integer
language sql stable set search_path = ''
as $$ select private.brl_per_usdc_milli(now()) $$;

-- ------------------------------------------------------------------ reading

-- The market, for the screens: the latest of each pair, the rate actually in
-- use, and whether that rate is an observation or the fallback.
create function public.fx_market()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'rates', coalesce((
      select jsonb_agg(jsonb_build_object(
          'pair', x.pair, 'source', x.source,
          'bid_milli', x.bid_milli, 'ask_milli', x.ask_milli, 'mid_milli', x.mid_milli,
          'observed_at', private.iso(x.observed_at),
          'fresh', x.observed_at >= now() - private.fx_max_age()
        ) order by x.pair)
      from (
        select distinct on (r.pair) r.* from public.fx_rates r order by r.pair, r.observed_at desc
      ) x), '[]'::jsonb),
    'in_use_milli', private.brl_per_usdc_milli(now()),
    'in_use_source', case
      when exists (select 1 from public.fx_rates r where r.pair = 'USDC/BRL'
                   and r.observed_at >= now() - private.fx_max_age())
      then 'observed' else 'assumed' end,
    'fallback_milli', 5400,
    'max_age_seconds', extract(epoch from private.fx_max_age())::integer);
$$;

revoke all on function public.fx_market() from public, anon;
grant execute on function public.fx_market() to authenticated;
revoke all on function private.brl_per_usdc_milli(timestamptz), private.fx_max_age() from public, anon;

-- ------------------------------------------------------------------ writing

-- The fx-quote function hands over what it read. One row per source, pair and
-- venue timestamp: reading the same tick twice records it once.
create function public.record_fx_rates(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows_must_be_an_array' using errcode = '22023';
  end if;
  with incoming as (
    select
      e ->> 'source' as source,
      e ->> 'pair' as pair,
      (e ->> 'bid_milli')::integer as bid_milli,
      (e ->> 'ask_milli')::integer as ask_milli,
      (e ->> 'mid_milli')::integer as mid_milli,
      (e ->> 'observed_at')::timestamptz as observed_at
    from jsonb_array_elements(p_rows) e
  ),
  inserted as (
    insert into public.fx_rates (source, pair, bid_milli, ask_milli, mid_milli, observed_at)
    select source, pair, bid_milli, ask_milli, mid_milli, observed_at from incoming
    on conflict (source, pair, observed_at) do nothing
    returning 1
  )
  select count(*)::integer into v_count from inserted;
  return v_count;
end;
$$;

revoke all on function public.record_fx_rates(jsonb) from public, anon, authenticated;
grant execute on function public.record_fx_rates(jsonb) to service_role;

-- -------------------------------------------------------------- the dispatcher

create function private.dispatch_fx_quote()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_fx_quote: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/fx-quote'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.dispatch_fx_quote() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('fx-quote');
exception when others then
  null;
end $$;

select cron.schedule('fx-quote', '*/10 * * * *', 'select private.dispatch_fx_quote()');
