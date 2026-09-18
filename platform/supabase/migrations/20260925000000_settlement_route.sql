-- Settlement routing: her loan is in reais, so which way do the dollars become
-- those reais?
--
--   direct_usdc_pix   USDC → off-ramp (the rate struck at payout) → Pix
--   brl_stable_pix    USDC → BRL stablecoin (the rate struck at allocation) → 1:1 → Pix
--
-- Runs after the Capital Allocation Engine has chosen the global pool, and
-- before she is paid. The two routes differ in where the exchange rate is
-- struck, not only in how many conversions they have: a BRL stablecoin locks
-- her principal in reais early and its payout leg carries no FX at all, at the
-- cost of one more conversion and one more counterparty.
--
-- packages/settlement-route is the same rules in TypeScript, and
-- packages/settlement-route/vectors/scenarios.json holds them both to one
-- answer. Integers only: micro-USDC, centavos, basis points, seconds.
--
-- Nothing here moves money. It prices, decides and records, and the legs that
-- do move USDC — release, payout — are untouched. A BRL stablecoin on Solana
-- is production-only with no sandbox, so its economics are a rate card marked
-- simulated and no transaction of its own is ever written or displayed.
--
-- With private.settlement_experiment() false, no quote and no decision is
-- written and every leg reads exactly as it did before this migration.

create type public.settlement_route as enum ('direct_usdc_pix', 'brl_stable_pix');

-- What a route really is, so no demo claims more than it did (addendum §6).
create type public.quote_reality as enum ('sandbox', 'devnet', 'test', 'simulated');

-- The experiment's switch. P0 is the demo that already works: with this false,
-- disbursement and settlement behave exactly as they did.
create function private.settlement_experiment()
returns boolean language sql immutable set search_path = ''
as $$ select true $$;

create function private.settlement_route_model_version()
returns text language sql immutable set search_path = ''
as $$ select 'settlement-route-v1.0.0' $$;

-- Conversions between the investor's USDC and her Pix (ROUTE_HOPS).
create function private.settlement_hops(p_route text)
returns integer language sql immutable set search_path = ''
as $$ select case p_route when 'brl_stable_pix' then 2 else 1 end $$;

-- ------------------------------------------------------------- the rate cards

-- A provider's economics: an assumption of this prototype, held as data so
-- another stablecoin or off-ramp needs no code.
create table public.settlement_providers (
  provider text primary key,
  route public.settlement_route not null,
  name text not null,
  asset text not null check (asset in ('USDC', 'BRS')),
  fx_spread_bps integer not null check (fx_spread_bps between 0 and 10000),
  -- Where the rate is struck: 'allocation' locks her reais before disbursement.
  fx_struck text not null check (fx_struck in ('allocation', 'payout')),
  -- The provider's fee over the converted amount, every leg of the route together.
  provider_fee_bps integer not null check (provider_fee_bps between 0 and 10000),
  provider_fee_fixed_cents bigint not null default 0 check (provider_fee_fixed_cents >= 0),
  -- Network, account and gas costs, stated even where the provider sponsors them.
  network_fee_cents bigint not null default 0 check (network_fee_cents >= 0),
  execution_eta_sec integer not null check (execution_eta_sec > 0),
  quote_ttl_sec integer not null check (quote_ttl_sec > 0),
  min_ticket_cents bigint not null check (min_ticket_cents > 0),
  max_ticket_cents bigint not null,
  liquidity_cents bigint not null check (liquidity_cents >= 0),
  reality public.quote_reality not null,
  enabled boolean not null default true,
  source_url text,
  updated_at timestamptz not null default now(),
  constraint provider_ticket_range check (max_ticket_cents >= min_ticket_cents)
);

-- One route settles through one provider at a time; the rest are candidates.
create unique index settlement_provider_per_route on public.settlement_providers (route) where enabled;

-- The demo's rate cards, as packages/settlement-route/vectors/scenarios.json.
-- Both are seeded: MoneyGram's sandbox only prices US$2-US$200 and a loan is
-- larger, and BRS has no sandbox at all.
insert into public.settlement_providers (
  provider, route, name, asset, fx_spread_bps, fx_struck, provider_fee_bps, provider_fee_fixed_cents,
  network_fee_cents, execution_eta_sec, quote_ttl_sec, min_ticket_cents, max_ticket_cents, liquidity_cents,
  reality, enabled, source_url
) values
  ('regulated_offramp', 'direct_usdc_pix', 'Regulated off-ramp · USDC to Pix', 'USDC',
   120, 'payout', 60, 0, 0, 900, 600, 10000, 2000000, 5000000, 'simulated', true, null),
  ('brl_stablecoin', 'brl_stable_pix', 'BRL stablecoin · 1:1 to Pix', 'BRS',
   120, 'allocation', 120, 0, 0, 300, 86400, 10000, 2000000, 3000000, 'simulated', true,
   'https://docs.hodle.com.br/docs/asset-brs');

-- ------------------------------------------------------------------ the model

-- What reaches her Pix out of a gross, under one rate card at one rate (netCents).
create function private.settlement_net_cents(p_gross_micro_usdc bigint, p_fx_milli integer, p_card jsonb)
returns bigint
language plpgsql immutable set search_path = ''
as $$
declare
  v_gross bigint := private.usdc_cents(p_gross_micro_usdc, p_fx_milli);
  v_after bigint;
  v_fee bigint;
begin
  v_after := floor(v_gross * (10000 - (p_card ->> 'fx_spread_bps')::integer) / 10000.0)::bigint;
  v_fee := ceil(v_after * (p_card ->> 'provider_fee_bps')::integer / 10000.0)::bigint
           + (p_card ->> 'provider_fee_fixed_cents')::bigint;
  return greatest(0, v_after - v_fee - (p_card ->> 'network_fee_cents')::bigint);
end;
$$;

-- The smallest gross whose net is at least p_cents: what the vault must release
-- for her contracted principal to arrive whole (grossForCents). The net never
-- falls as the gross rises, so this is a search, not an inversion with rounding
-- to argue about.
create function private.settlement_gross_for_cents(p_cents bigint, p_fx_milli integer, p_card jsonb)
returns bigint
language plpgsql immutable set search_path = ''
as $$
declare
  v_lo bigint := 0;
  v_hi bigint;
  v_mid bigint;
begin
  if p_cents is null or p_cents <= 0 or p_fx_milli is null or p_fx_milli <= 0 then return null; end if;
  v_hi := ceil(p_cents * 10000000.0 * 2 / p_fx_milli)::bigint + 1000000;
  if private.settlement_net_cents(v_hi, p_fx_milli, p_card) < p_cents then return null; end if;
  while v_lo < v_hi loop
    v_mid := (v_lo + v_hi) / 2;
    if private.settlement_net_cents(v_mid, p_fx_milli, p_card) >= p_cents then v_hi := v_mid; else v_lo := v_mid + 1; end if;
  end loop;
  return v_lo;
end;
$$;

-- Prices one rate card at one rate, and asks whether it can settle this ticket
-- now (quote). The shape is packages/settlement-route's RouteQuote.
create function private.settlement_quote(
  p_card jsonb, p_fx_milli integer, p_quoted_at timestamptz, p_gross_micro_usdc bigint, p_now timestamptz
)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_gross bigint := private.usdc_cents(p_gross_micro_usdc, p_fx_milli);
  v_after bigint;
  v_fee bigint;
  v_net bigint;
  v_cost bigint;
  v_expires timestamptz;
  v_liquidity boolean;
  v_blocks text[] := '{}';
begin
  v_after := floor(v_gross * (10000 - (p_card ->> 'fx_spread_bps')::integer) / 10000.0)::bigint;
  v_fee := ceil(v_after * (p_card ->> 'provider_fee_bps')::integer / 10000.0)::bigint
           + (p_card ->> 'provider_fee_fixed_cents')::bigint;
  v_net := greatest(0, v_after - v_fee - (p_card ->> 'network_fee_cents')::bigint);
  v_cost := v_gross - v_net;
  v_expires := p_quoted_at + make_interval(secs => (p_card ->> 'quote_ttl_sec')::integer);
  v_liquidity := (p_card ->> 'liquidity_cents')::bigint >= v_gross;

  if not (p_card ->> 'enabled')::boolean then
    v_blocks := array_append(v_blocks, 'ROUTE_PROVIDER_UNAVAILABLE');
  end if;
  if v_gross < (p_card ->> 'min_ticket_cents')::bigint or v_gross > (p_card ->> 'max_ticket_cents')::bigint then
    v_blocks := array_append(v_blocks, 'ROUTE_TICKET_OUTSIDE_POLICY');
  end if;
  if not v_liquidity then
    v_blocks := array_append(v_blocks, 'ROUTE_NO_LIQUIDITY');
  end if;
  -- A rate already struck cannot expire: where the reais were bought at
  -- allocation there is nothing left to execute, however long ago that was.
  -- Whole seconds, as the package compares them, and no session time zone.
  if p_card ->> 'fx_struck' = 'payout'
    and floor(extract(epoch from p_now)) >= floor(extract(epoch from v_expires)) then
    v_blocks := array_append(v_blocks, 'ROUTE_QUOTE_EXPIRED');
  end if;

  return jsonb_build_object(
    'route', p_card ->> 'route',
    'provider', p_card ->> 'provider',
    'asset', p_card ->> 'asset',
    'gross_micro_usdc', p_gross_micro_usdc,
    'fx_rate_milli', p_fx_milli,
    'fx_struck', p_card ->> 'fx_struck',
    'fx_spread_bps', (p_card ->> 'fx_spread_bps')::integer,
    'gross_brl_cents', v_gross,
    'fx_cost_cents', v_gross - v_after,
    'provider_fee_cents', v_fee,
    'network_fee_cents', (p_card ->> 'network_fee_cents')::bigint,
    'net_brl_cents', v_net,
    'total_cost_cents', v_cost,
    'cost_bps', case when v_gross > 0 then round(v_cost * 10000.0 / v_gross)::integer else 0 end,
    'execution_eta_sec', (p_card ->> 'execution_eta_sec')::integer,
    'quote_ttl_sec', (p_card ->> 'quote_ttl_sec')::integer,
    'quoted_at', private.iso(p_quoted_at),
    'expires_at', private.iso(v_expires),
    'liquidity_ok', v_liquidity,
    'reality', p_card ->> 'reality',
    'hops', private.settlement_hops(p_card ->> 'route'),
    'feasible', cardinality(v_blocks) = 0,
    'blocks', to_jsonb(v_blocks)
  );
end;
$$;

-- packages/settlement-route compareRoutes(), in SQL. p_quotes is an array of
-- {provider: <rate card>, fx_rate_milli, quoted_at}; the result is its
-- SettlementRouteResult shape.
create function private.settle_route(
  p_gross_micro_usdc bigint, p_principal_cents bigint, p_now timestamptz, p_quotes jsonb
)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_order text[] := array[
    'DIRECT_LOWEST_COST', 'DIRECT_FEWEST_STEPS', 'BRL_STABLE_BETTER_NET_BRL', 'BRL_STABLE_LOCKS_PRINCIPAL_EARLIER',
    'BRL_STABLE_NO_FX_ON_PAYOUT', 'EXTRA_CONVERSION_ADDS_COST', 'ROUTE_QUOTE_EXPIRED', 'ROUTE_NO_LIQUIDITY',
    'ROUTE_TICKET_OUTSIDE_POLICY', 'ROUTE_PROVIDER_UNAVAILABLE', 'NO_ROUTE_AVAILABLE'];
  v_quotes jsonb;
  v_winner jsonb;
  v_runner jsonb;
  v_direct jsonb;
  v_stable jsonb;
  v_selected text;
  v_delta bigint;
  v_reasons text[];
  v_gross_for jsonb := '{}'::jsonb;
  r jsonb;
begin
  if p_gross_micro_usdc is null or p_gross_micro_usdc <= 0 then
    raise exception 'gross_micro_usdc must be positive' using errcode = '22023';
  end if;

  select jsonb_agg(x.q order by (x.q ->> 'hops')::integer) into v_quotes
  from jsonb_array_elements(p_quotes) e,
  lateral (select private.settlement_quote(e -> 'provider', (e ->> 'fx_rate_milli')::integer,
    (e ->> 'quoted_at')::timestamptz, p_gross_micro_usdc, p_now) as q) x;

  select array_agg(b) into v_reasons
  from jsonb_array_elements(v_quotes) q, jsonb_array_elements_text(q -> 'blocks') b;
  v_reasons := coalesce(v_reasons, '{}');

  select q into v_direct from jsonb_array_elements(v_quotes) q where q ->> 'route' = 'direct_usdc_pix';
  select q into v_stable from jsonb_array_elements(v_quotes) q where q ->> 'route' = 'brl_stable_pix';

  -- More reais to her first, then the cheaper. Then fewer conversions, before
  -- speed: minutes of settlement do not buy a second counterparty to reconcile.
  select q into v_winner from jsonb_array_elements(v_quotes) q where (q ->> 'feasible')::boolean
  order by (q ->> 'net_brl_cents')::bigint desc, (q ->> 'total_cost_cents')::bigint,
    (q ->> 'hops')::integer, (q ->> 'execution_eta_sec')::integer
  limit 1;
  select q into v_runner from jsonb_array_elements(v_quotes) q where (q ->> 'feasible')::boolean
  order by (q ->> 'net_brl_cents')::bigint desc, (q ->> 'total_cost_cents')::bigint,
    (q ->> 'hops')::integer, (q ->> 'execution_eta_sec')::integer
  offset 1 limit 1;

  if v_winner is null then
    v_reasons := array_append(v_reasons, 'NO_ROUTE_AVAILABLE');
  else
    v_selected := v_winner ->> 'route';
    if v_runner is not null then
      v_delta := (v_winner ->> 'net_brl_cents')::bigint - (v_runner ->> 'net_brl_cents')::bigint;
    end if;

    if v_selected = 'direct_usdc_pix' then
      -- With no other route left, the other route's own block code says why.
      if v_delta is not null and (v_delta > 0 or (v_winner ->> 'total_cost_cents')::bigint < (v_runner ->> 'total_cost_cents')::bigint) then
        v_reasons := array_append(v_reasons, 'DIRECT_LOWEST_COST');
      elsif v_delta is not null then
        v_reasons := array_append(v_reasons, 'DIRECT_FEWEST_STEPS');
      end if;
      -- The stablecoin route could have run, and its extra conversion took the difference.
      if v_stable is not null and (v_stable ->> 'feasible')::boolean and v_direct is not null
        and (v_stable ->> 'net_brl_cents')::bigint < (v_direct ->> 'net_brl_cents')::bigint then
        v_reasons := array_append(v_reasons, 'EXTRA_CONVERSION_ADDS_COST');
      end if;
    elsif v_selected = 'brl_stable_pix' and v_stable is not null then
      if v_delta is not null and v_delta > 0 then
        v_reasons := array_append(v_reasons, 'BRL_STABLE_BETTER_NET_BRL');
      end if;
      -- Structural, and true whether or not the other route ran: the rate was
      -- struck before disbursement, so the payout leg carries no FX at all.
      if v_stable ->> 'fx_struck' = 'allocation' then
        v_reasons := array_append(v_reasons, 'BRL_STABLE_NO_FX_ON_PAYOUT');
        if v_direct is not null
          and floor(extract(epoch from (v_stable ->> 'quoted_at')::timestamptz))
            < floor(extract(epoch from (v_direct ->> 'quoted_at')::timestamptz)) then
          v_reasons := array_append(v_reasons, 'BRL_STABLE_LOCKS_PRINCIPAL_EARLIER');
        end if;
      end if;
    end if;
  end if;

  for r in select e from jsonb_array_elements(p_quotes) e loop
    v_gross_for := v_gross_for || jsonb_build_object(
      r -> 'provider' ->> 'route',
      case when p_principal_cents is null then null
        else private.settlement_gross_for_cents(p_principal_cents, (r ->> 'fx_rate_milli')::integer, r -> 'provider') end
    );
  end loop;

  return jsonb_build_object(
    'model_version', private.settlement_route_model_version(),
    'selected', v_selected,
    'reason_codes', to_jsonb(array(select x from unnest(v_order) with ordinality as t(x, n) where x = any(v_reasons) order by n)),
    'quotes', v_quotes,
    'compared_gross_micro_usdc', p_gross_micro_usdc,
    'net_brl_delta_cents', v_delta,
    'principal_cents', p_principal_cents,
    'gross_for_principal', v_gross_for
  );
end;
$$;

-- ------------------------------------------------------ what is priced, when

-- One route's rate card, in the model's shape: the enabled provider, or the
-- candidate that is switched off — a route nobody can use is still priced and
-- still compared, and its own block code says why it was not taken.
create function private.settlement_card(p_route public.settlement_route)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'route', p.route, 'provider', p.provider, 'asset', p.asset, 'fx_spread_bps', p.fx_spread_bps,
    'fx_struck', p.fx_struck, 'provider_fee_bps', p.provider_fee_bps,
    'provider_fee_fixed_cents', p.provider_fee_fixed_cents, 'network_fee_cents', p.network_fee_cents,
    'execution_eta_sec', p.execution_eta_sec, 'quote_ttl_sec', p.quote_ttl_sec,
    'min_ticket_cents', p.min_ticket_cents, 'max_ticket_cents', p.max_ticket_cents,
    'liquidity_cents', p.liquidity_cents, 'reality', p.reality, 'enabled', p.enabled
  )
  from public.settlement_providers p
  where p.route = p_route
  order by p.enabled desc, p.provider
  limit 1
$$;

/*
 * The two quotes an opportunity's disbursement would be priced at.
 *
 * The stablecoin route locked its rate when the opportunity was allocated, and
 * carries that moment; the direct route is priced at today's rate, at the
 * moment the money moves. That is the whole difference between them, and it is
 * read from facts already recorded, not invented here.
 */
create function private.settlement_requests(p_opportunity_id uuid, p_now timestamptz)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x.request order by x.hops), '[]'::jsonb)
  from (
    select private.settlement_hops(r.route::text) as hops,
      jsonb_build_object(
        'provider', private.settlement_card(r.route),
        'fx_rate_milli', case when r.route = 'brl_stable_pix'
          then coalesce(o.fx_brl_per_usdc_milli, private.demo_brl_per_usdc_milli())
          else private.demo_brl_per_usdc_milli() end,
        'quoted_at', case when r.route = 'brl_stable_pix'
          then private.iso(coalesce(o.allocated_at, o.created_at))
          else private.iso(p_now) end
      ) as request
    from public.qualified_credit_opportunities o
    cross join (select distinct route from public.settlement_providers) r
    where o.id = p_opportunity_id
  ) x
$$;

-- --------------------------------------------------------------- the records

create table public.settlement_quotes (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  route public.settlement_route not null,
  provider text not null references public.settlement_providers (provider),
  gross_micro_usdc bigint not null check (gross_micro_usdc > 0),
  fx_rate_milli integer not null check (fx_rate_milli > 0),
  fx_struck text not null,
  fx_spread_bps integer not null,
  gross_brl_cents bigint not null,
  fx_cost_cents bigint not null,
  provider_fee_cents bigint not null,
  network_fee_cents bigint not null,
  net_brl_cents bigint not null,
  total_cost_cents bigint not null,
  cost_bps integer not null,
  execution_eta_sec integer not null,
  quote_ttl_sec integer not null,
  quoted_at timestamptz not null,
  expires_at timestamptz not null,
  liquidity_ok boolean not null,
  reality public.quote_reality not null,
  hops smallint not null,
  feasible boolean not null,
  blocks text[] not null default '{}',
  -- What the vault must release for her contracted principal to arrive whole.
  gross_for_principal_micro_usdc bigint,
  created_at timestamptz not null default now(),
  unique (loan_id, route)
);

create table public.settlement_decisions (
  loan_id uuid primary key references public.loans (id) on delete cascade,
  selected_route public.settlement_route,
  selected_quote_id uuid references public.settlement_quotes (id) on delete set null,
  model_version text not null,
  reason_codes text[] not null,
  compared_gross_micro_usdc bigint not null,
  net_brl_delta_cents bigint,
  principal_cents bigint,
  -- Both quotes as the model saw them, so a decision can be re-read whole.
  compared jsonb not null,
  decided_at timestamptz not null default now()
);

-- Which route paid a leg, and at which quote. Null on every leg written before
-- this migration, and on every leg written with the experiment off.
alter table public.settlement_legs
  add column route public.settlement_route,
  add column quote_id uuid references public.settlement_quotes (id) on delete set null;

alter table public.settlement_providers enable row level security;
alter table public.settlement_quotes enable row level security;
alter table public.settlement_decisions enable row level security;
revoke all on public.settlement_providers, public.settlement_quotes, public.settlement_decisions from anon, authenticated;
grant select on public.settlement_providers, public.settlement_quotes, public.settlement_decisions to authenticated;

-- The rate cards are read by everyone who is shown route economics. Never by
-- an entrepreneur: her side of this is reais and Pix, and nothing else.
create policy settlement_providers_read on public.settlement_providers for select to authenticated using (
  coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider', 'auditor', 'admin')
);
create policy settlement_quotes_read on public.settlement_quotes for select to authenticated using (
  (select private.is_auditor_or_admin())
  or private.funds_loan(loan_id)
  or exists (select 1 from public.loans l where l.id = loan_id and l.partner_id = private.my_partner_id())
);
create policy settlement_decisions_read on public.settlement_decisions for select to authenticated using (
  (select private.is_auditor_or_admin())
  or private.funds_loan(loan_id)
  or exists (select 1 from public.loans l where l.id = loan_id and l.partner_id = private.my_partner_id())
);

-- ------------------------------------------------------- deciding at disbursal

-- Prices both routes for a loan, records them and the decision, and stamps the
-- Pix leg with the route that paid it. Global loans only: a domestic loan has
-- no dollars to convert. Writes nothing when the experiment is off.
create function private.record_settlement_route(p_loan_id uuid, p_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_opp public.qualified_credit_opportunities;
  v_result jsonb;
  v_gross bigint;
  v_quote jsonb;
  v_selected uuid;
begin
  if not private.settlement_experiment() then return; end if;
  select * into v_loan from public.loans where id = p_loan_id;
  select * into v_opp from public.qualified_credit_opportunities where id = v_loan.opportunity_id;
  if v_opp.funding_pool is distinct from 'global' then return; end if;

  v_gross := coalesce(v_opp.funding_target_micro_usdc, 0);
  if v_gross <= 0 then return; end if;

  v_result := private.settle_route(v_gross, v_loan.principal_cents, p_at, private.settlement_requests(v_opp.id, p_at));

  for v_quote in select q from jsonb_array_elements(v_result -> 'quotes') q loop
    insert into public.settlement_quotes (
      loan_id, route, provider, gross_micro_usdc, fx_rate_milli, fx_struck, fx_spread_bps, gross_brl_cents,
      fx_cost_cents, provider_fee_cents, network_fee_cents, net_brl_cents, total_cost_cents, cost_bps,
      execution_eta_sec, quote_ttl_sec, quoted_at, expires_at, liquidity_ok, reality, hops, feasible, blocks,
      gross_for_principal_micro_usdc
    ) values (
      p_loan_id, (v_quote ->> 'route')::public.settlement_route, v_quote ->> 'provider',
      (v_quote ->> 'gross_micro_usdc')::bigint, (v_quote ->> 'fx_rate_milli')::integer, v_quote ->> 'fx_struck',
      (v_quote ->> 'fx_spread_bps')::integer, (v_quote ->> 'gross_brl_cents')::bigint,
      (v_quote ->> 'fx_cost_cents')::bigint, (v_quote ->> 'provider_fee_cents')::bigint,
      (v_quote ->> 'network_fee_cents')::bigint, (v_quote ->> 'net_brl_cents')::bigint,
      (v_quote ->> 'total_cost_cents')::bigint, (v_quote ->> 'cost_bps')::integer,
      (v_quote ->> 'execution_eta_sec')::integer, (v_quote ->> 'quote_ttl_sec')::integer,
      (v_quote ->> 'quoted_at')::timestamptz, (v_quote ->> 'expires_at')::timestamptz,
      (v_quote ->> 'liquidity_ok')::boolean, (v_quote ->> 'reality')::public.quote_reality,
      (v_quote ->> 'hops')::smallint, (v_quote ->> 'feasible')::boolean,
      array(select jsonb_array_elements_text(v_quote -> 'blocks')),
      (v_result -> 'gross_for_principal' ->> (v_quote ->> 'route'))::bigint
    )
    on conflict (loan_id, route) do nothing;
  end loop;

  select q.id into v_selected from public.settlement_quotes q
  where q.loan_id = p_loan_id and q.route = (v_result ->> 'selected')::public.settlement_route;

  insert into public.settlement_decisions (
    loan_id, selected_route, selected_quote_id, model_version, reason_codes,
    compared_gross_micro_usdc, net_brl_delta_cents, principal_cents, compared, decided_at
  ) values (
    p_loan_id, (v_result ->> 'selected')::public.settlement_route, v_selected,
    v_result ->> 'model_version', array(select jsonb_array_elements_text(v_result -> 'reason_codes')),
    (v_result ->> 'compared_gross_micro_usdc')::bigint, (v_result ->> 'net_brl_delta_cents')::bigint,
    (v_result ->> 'principal_cents')::bigint, v_result -> 'quotes', p_at
  )
  on conflict (loan_id) do nothing;

  update public.settlement_legs
  set route = (v_result ->> 'selected')::public.settlement_route, quote_id = v_selected
  where loan_id = p_loan_id and kind in ('release', 'pix_payout');
end;
$$;

-- As before — the real deposits leave the vault for the ramp, and she is paid
-- by (mock) Pix — and now the route that pays her is priced and recorded.
create or replace function private.settle_on_disbursal() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_real bigint;
begin
  select * into v_loan from public.loans where id = new.loan_id;
  v_real := private.real_deposits(v_loan.opportunity_id);
  if v_real > 0 then
    insert into public.settlement_legs (kind, loan_id, amount_micro_usdc, status)
    values ('release', v_loan.id, v_real, 'due')
    on conflict (loan_id) where kind = 'release' do nothing;
  end if;
  insert into public.settlement_legs (kind, loan_id, amount_cents, status, pix_e2e, done_at)
  values ('pix_payout', v_loan.id, v_loan.principal_cents, 'mock', private.mock_pix_e2e(new.created_at), new.created_at)
  on conflict (loan_id) where kind = 'pix_payout' do nothing;
  perform private.record_settlement_route(v_loan.id, new.created_at);
  return new;
end;
$$;

-- --------------------------------------------------------------- the preview

/*
 * Both quotes for an opportunity, priced now, written nowhere: the Credit &
 * Capital Engine's settlement card, and what the desk reads before it
 * formalises. The engine has always been analysis only, and the decision that
 * binds is taken at disbursement, when the money actually moves.
 */
create function public.settlement_route_preview(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := coalesce(private.my_role()::text, '');
  v_opp public.qualified_credit_opportunities;
begin
  if v_role not in ('partner', 'sponsor', 'capital_provider', 'auditor', 'admin') then
    raise exception 'not_allowed_to_see_settlement_routes' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if not private.settlement_experiment() then
    return jsonb_build_object('enabled', false);
  end if;
  if v_opp.funding_pool is distinct from 'global' then
    return jsonb_build_object('enabled', true, 'applies', false, 'funding_pool', v_opp.funding_pool);
  end if;
  return jsonb_build_object('enabled', true, 'applies', true, 'funding_pool', 'global')
    || private.settle_route(
      coalesce(v_opp.funding_target_micro_usdc, 0), v_opp.amount_cents, now(),
      private.settlement_requests(v_opp.id, now()));
end;
$$;

-- The helpers are the database's own: nobody calls them directly, and a new
-- function is executable by PUBLIC until it is told otherwise.
revoke all on function private.settlement_experiment(), private.settlement_route_model_version(),
  private.settlement_hops(text), private.settlement_net_cents(bigint, integer, jsonb),
  private.settlement_gross_for_cents(bigint, integer, jsonb),
  private.settlement_quote(jsonb, integer, timestamptz, bigint, timestamptz),
  private.settle_route(bigint, bigint, timestamptz, jsonb), private.settlement_card(public.settlement_route),
  private.settlement_requests(uuid, timestamptz), private.record_settlement_route(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function private.settlement_experiment(), private.settlement_route_model_version(),
  private.settlement_hops(text), private.settlement_net_cents(bigint, integer, jsonb),
  private.settlement_gross_for_cents(bigint, integer, jsonb),
  private.settlement_quote(jsonb, integer, timestamptz, bigint, timestamptz),
  private.settle_route(bigint, bigint, timestamptz, jsonb), private.settlement_card(public.settlement_route),
  private.settlement_requests(uuid, timestamptz) to service_role;

revoke all on function public.settlement_route_preview(uuid) from public, anon;
grant execute on function public.settlement_route_preview(uuid) to authenticated;
