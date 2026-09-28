-- The network offers the pool the request is actually on.
--
-- Measured on the seeded demo: 11 of 15 plans recommended a pool the allocation
-- engine had not chosen. The engine had listed those opportunities on the global
-- pool — they raise in USDC and close when the target is met there — and the
-- network answered that the domestic P2P pool covered them in reais. Both
-- statements were on screen, about the same request, and only one could be true.
--
-- The cause is that private.capital_network_instruments() offered every active
-- instrument, and a pool's capacity is whatever its own book has left. The
-- domestic pool had room precisely because the allocation engine had sent the
-- book elsewhere, so the emptier a pool was of commitments, the more eagerly the
-- network recommended it.
--
-- A pool is now a route for a request only where the engine put that request.
-- Everything else about the network is unchanged: third-party products, the
-- exchange network and the impact fund are offered as before, and a request
-- waiting for capital still sees both pools, because which one could take it is
-- the open question.

create or replace function private.capital_network_instruments(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with o as (
    select q.amount_cents, q.term_months, q.risk_band, q.purpose,
           -- Where the allocation engine listed this request, if it has.
           q.funding_pool as chosen_pool,
           private.demo_brl_per_usdc_milli() as fx_milli
    from public.qualified_credit_opportunities q where q.id = p_opportunity_id
  ),
  pools as (
    select fp.pool, fp.min_ticket_cents, fp.max_ticket_cents, fp.purposes, fp.impact_mandate,
           greatest(case fp.pool
             when 'domestic' then (bk.j ->> 'capital')::bigint - (bk.j ->> 'lent')::bigint - (bk.j ->> 'claimed')::bigint
             else private.usdc_cents(
               (bk.j ->> 'capital')::bigint - (bk.j ->> 'lent')::bigint - (bk.j ->> 'claimed')::bigint,
               (select fx_milli from o))
           end, 0) as available_cents
    from public.funding_pools fp
    cross join lateral (select private.pool_book(fp.pool) as j) bk
  ),
  pool_cost as (
    select p.pool,
           (private.allocation_assess(private.pool_policy(p.pool, p.available_cents),
              o.amount_cents, o.term_months, o.risk_band::text, o.purpose::text) ->> 'all_in_bps')::integer as all_in_bps
    from pools p cross join o
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.code,
    'provider', pr.code,
    'name', i.name,
    'type', i.instrument_type::text,
    'is_credit', i.is_credit,
    'requires_partner_approval', i.requires_partner_approval,
    'ticket_min_cents', coalesce(i.ticket_min_cents, pl.min_ticket_cents),
    'ticket_max_cents', coalesce(i.ticket_max_cents, pl.max_ticket_cents),
    'eligible_uf', to_jsonb(i.eligible_uf),
    'purposes', to_jsonb(coalesce(nullif(i.purposes, '{}'), pl.purposes, '{}'::public.credit_purpose[])),
    'term_min_months', i.term_min_months,
    'term_max_months', i.term_max_months,
    'business_age_min_months', i.business_age_min_months,
    'required_documents', to_jsonb(i.required_documents),
    'max_instalment_share_bps', i.max_instalment_share_bps,
    'estimated_cost_bps', coalesce(i.estimated_cost_bps, pc.all_in_bps),
    'capacity_cents', coalesce(i.capacity_cents, pl.available_cents),
    'impact_mandate', i.impact_mandate or coalesce(pl.impact_mandate, false),
    'is_domestic', i.is_domestic
  ) order by i.code), '[]'::jsonb)
  from public.capital_instruments i
  join public.capital_providers pr on pr.id = i.provider_id
  cross join o
  left join pools pl on pl.pool = i.pool
  left join pool_cost pc on pc.pool = i.pool
  where i.active and pr.active
    and i.effective_from <= current_date
    and (i.effective_to is null or i.effective_to >= current_date)
    -- A pool is a route for this request only where the allocation engine put
    -- it. An opportunity listed on the global pool raises in USDC and closes
    -- when its target is met there; the domestic pool cannot fund it, whatever
    -- liquidity that pool happens to be holding. Offering it anyway is not a
    -- generous recommendation, it is a wrong one.
    --
    -- A request no pool has taken — waiting for capital — keeps both: nothing
    -- has been decided about it, and which pool could take it is exactly what
    -- the network is being asked.
    and (i.pool is null or o.chosen_pool is null or i.pool = o.chosen_pool)
$$;
