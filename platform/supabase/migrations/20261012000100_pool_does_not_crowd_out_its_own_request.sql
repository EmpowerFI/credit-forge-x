-- A pool does not crowd out the request it is holding.
--
-- With the network offering only the pool a request was listed on, the global
-- pool still never carried a centavo of any plan: it reported no capacity. The
-- reason is that private.pool_book() counts every opportunity listed on a pool
-- as claimed against it — including the one being routed. Asked "how much could
-- the global pool put into this request", the engine subtracted this request
-- from the pool's headroom and answered "nothing".
--
-- That is right for the pool's accounts, where the money is spoken for, and
-- wrong for the question the network asks. Being listed on a pool is the pool
-- taking the request on; what limits its slice is the pool's policy — ticket
-- range, purposes, risk bands, what her instalment bears — not liquidity it has
-- set aside for this very request.
--
-- Only the request's own claim is added back, and only against the pool that
-- holds it. Every other commitment still reduces the pool, and a request that
-- has already become a loan adds nothing back, because the money is gone.

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
  -- What this very request is already holding in the pool it was listed on.
  -- private.pool_book() counts it as claimed, which is right for the pool's own
  -- accounts and wrong as an answer to "how much could this pool put into this
  -- request": it subtracts the request from its own headroom.
  mine as (
    select q.funding_pool as pool,
           case when q.funding_pool = 'domestic' then q.amount_cents else q.funding_target_micro_usdc end as units
    from public.qualified_credit_opportunities q
    where q.id = p_opportunity_id
      and q.funding_pool is not null
      and q.funding_status in ('open', 'partially_funded', 'funded')
      and not exists (select 1 from public.loans l where l.opportunity_id = q.id
                      and l.status in ('DISBURSED', 'ACTIVE', 'DEFAULTED', 'PAID', 'CANCELLED'))
  ),
  pools as (
    select fp.pool, fp.min_ticket_cents, fp.max_ticket_cents, fp.purposes, fp.impact_mandate,
           greatest(case fp.pool
             when 'domestic' then (bk.j ->> 'capital')::bigint - (bk.j ->> 'lent')::bigint - bk.free
             else private.usdc_cents(
               (bk.j ->> 'capital')::bigint - (bk.j ->> 'lent')::bigint - bk.free,
               (select fx_milli from o))
           end, 0) as available_cents
    from public.funding_pools fp
    cross join lateral (
      select private.pool_book(fp.pool) as j,
             (private.pool_book(fp.pool) ->> 'claimed')::bigint
               - coalesce((select m.units from mine m where m.pool = fp.pool), 0) as free
    ) bk
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
