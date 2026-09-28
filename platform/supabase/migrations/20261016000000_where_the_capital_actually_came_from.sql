-- Where the capital actually came from.
--
-- The Capital Network page counts routes: four open, two of them global, one
-- that is not credit. It never said how much money each of them carried, and a
-- network whose routes are all equal on screen argues for nothing. The thesis
-- is that domestic capital has several sources — a regional product, a
-- microcredit line, a productive exchange, a pool of people lending in reais —
-- and that money from abroad is two different things, a crowd of investors each
-- funding a share and a fund lending on a mandate it wrote. That claim is
-- either visible in the book or it is a slogan.
--
-- So: one reading per source, over the latest plan recorded for each request.
-- Latest, not all: a request routed twice has two decisions and one answer, and
-- summing both would count her money twice.
--
-- Capacity is reported beside it, and it does not mean the same thing on every
-- row. A partner states what it has; a pool's is a residue — its capital, less
-- what it has lent, less what the allocation engine has listed on it. The row
-- says which of the two it is rather than presenting a declaration and an
-- arithmetic result as one number.

create or replace function public.capital_network_origin()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := private.my_role();
  v_fx integer := private.demo_brl_per_usdc_milli();
begin
  if not (private.is_investor_or_overseer() or private.my_partner_id() is not null or v_role = 'sponsor') then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;

  return (
    with latest as (
      select distinct on (d.opportunity_id) d.*
      from public.capital_route_decisions d
      order by d.opportunity_id, d.decision_no desc
    ),
    routed as (
      select a ->> 'instrument_id' as code,
             sum((a ->> 'amount_cents')::bigint) as cents,
             count(*)::int as requests
      from latest l
      cross join lateral jsonb_array_elements(l.allocations) as t(a)
      group by 1
    ),
    book as (
      select i.code, i.name, i.instrument_type::text as instrument_type,
             i.is_domestic, i.is_credit, i.requires_partner_approval,
             p.display_name as provider, p.provider_type::text as provider_type,
             coalesce(r.cents, 0) as routed_cents,
             coalesce(r.requests, 0) as requests,
             -- What this source has to put up, in her currency. A partner's is
             -- a declaration; a pool's is what is left of its capital once the
             -- loans it has out and the requests already listed on it are
             -- taken off. Two different kinds of number under one label would
             -- be the easy lie, so the basis travels with it.
             case when i.pool is null then i.capacity_cents
                  when i.pool = 'domestic' then greatest(
                    (private.pool_book(i.pool) ->> 'capital')::bigint
                      - (private.pool_book(i.pool) ->> 'lent')::bigint
                      - (private.pool_book(i.pool) ->> 'claimed')::bigint, 0)
                  else greatest(private.usdc_cents(
                    (private.pool_book(i.pool) ->> 'capital')::bigint
                      - (private.pool_book(i.pool) ->> 'lent')::bigint
                      - (private.pool_book(i.pool) ->> 'claimed')::bigint, v_fx), 0)
             end as capacity_cents,
             case when i.pool is null then 'declared' else 'pool_residue' end as capacity_basis
      from public.capital_instruments i
      join public.capital_providers p on p.id = i.provider_id
      left join routed r on r.code = i.code
      where i.active and p.active
        and i.effective_from <= current_date
        and (i.effective_to is null or i.effective_to >= current_date)
    ),
    total as (select coalesce(sum(routed_cents), 0) as cents from book)
    select jsonb_build_object(
      'plans', (select count(*)::int from latest),
      'requested_cents', (select coalesce(sum(requested_cents), 0) from latest),
      'routed_cents', (select cents from total),
      'domestic_cents', (select coalesce(sum(routed_cents), 0) from book where is_domestic),
      'global_cents', (select coalesce(sum(routed_cents), 0) from book where not is_domestic),
      'unfunded_cents', (select coalesce(sum(unfunded_cents), 0) from latest),
      'external_capital_gap_cents', (select coalesce(sum(external_capital_gap_cents), 0) from latest),
      'eligible_gap_cents', (select coalesce(sum(eligible_gap_cents), 0) from latest),
      'sources', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'code', b.code,
          'name', b.name,
          'instrument_type', b.instrument_type,
          'provider', b.provider,
          'provider_type', b.provider_type,
          'is_domestic', b.is_domestic,
          'is_credit', b.is_credit,
          'requires_partner_approval', b.requires_partner_approval,
          'routed_cents', b.routed_cents,
          'requests', b.requests,
          'capacity_cents', b.capacity_cents,
          'capacity_basis', b.capacity_basis,
          -- Of everything the network routed, not of everything asked: this
          -- says how the book divides, and the shortfall has its own figures.
          'share_bps', case when (select cents from total) > 0
                       then round(b.routed_cents * 10000.0 / (select cents from total))::integer
                       else 0 end)
          order by b.is_domestic desc, b.routed_cents desc, b.code), '[]'::jsonb)
        from book b)));
end;
$$;

comment on function public.capital_network_origin() is
  'How much of the recorded book each route carried, domestic sources and international sources apart, over the latest plan per request.';

revoke all on function public.capital_network_origin() from public, anon;
grant execute on function public.capital_network_origin() to authenticated, service_role;
