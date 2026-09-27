-- A share that could read 188%.
--
-- The v2 reader divided what was mobilised by what was lent, and those are two
-- different populations: mobilized_cents is stamped on an opportunity the moment
-- it is allocated to the global pool, whether or not it ever raised its target,
-- while the denominator counted only loans that were actually disbursed. On the
-- seeded demo that came out at 18869 basis points — a share of 188.69%, under a
-- label that promises a share of everything lent.
--
-- Both sides now come from the same rows: the principal of the loans raised in
-- the global pool, over the principal of all the loans disbursed. A share that
-- cannot exceed 10000 basis points by construction.
--
-- Nothing else moves. What was mobilised, what mobilising it cost and the CTM
-- rate keep their own population, which is every ticket the platform went out to
-- mobilise: the right denominator for a cost, and the wrong one for a share.

create or replace function public.capital_mobilization_summary(p_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_card public.cost_rate_cards;
  v_pool public.funding_pools;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());
  select * into v_pool from public.funding_pools where pool = 'global';

  return (
    with communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    people as materialized (
      select distinct m.entrepreneur_id from public.community_memberships m
      where m.community_id in (select id from communities)
    ),
    scope as materialized (
      select o.* from public.qualified_credit_opportunities o
      where p_program_id is null or o.entrepreneur_id in (select entrepreneur_id from people)
    ),
    mobilised as (
      select s.* from public.operating_economics_snapshots s
      join scope o on o.id = s.opportunity_id
      where s.mobilization_cents is not null
    ),
    gaps as (
      select coalesce(sum(d.eligible_gap_cents), 0)::bigint as cents, count(*)::int as decisions
      from public.capital_route_decisions d
      join scope o on o.id = d.opportunity_id
      where d.eligible_gap_cents > 0
        and d.decision_no = (select max(x.decision_no) from public.capital_route_decisions x
                             where x.opportunity_id = d.opportunity_id)
    ),
    -- Derived, not recorded: opened for funding to its own last investment.
    filled as (
      select extract(epoch from (max(i.created_at) - o.allocated_at)) as s
      from scope o
      join public.investments i on i.opportunity_id = o.id and i.status <> 'refunded'
      where o.funding_pool = 'global' and o.allocated_at is not null
        and o.funding_status in ('funded', 'closed')
      group by o.id, o.allocated_at
    ),
    -- Both sides of the coverage share come from the same rows: the loans that
    -- were actually disbursed, and how much of that principal was raised in the
    -- global pool.
    lent as (
      select coalesce(sum(l.principal_cents), 0)::bigint as cents,
             coalesce(sum(l.principal_cents) filter (where o.funding_pool = 'global'), 0)::bigint as global_cents
      from public.loans l join scope o on o.id = l.opportunity_id
      where l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
    )
    select jsonb_build_object(
      'model_version', 'capital-mobilization-v1.0.0',
      'scope', jsonb_build_object('program_id', p_program_id),
      'tickets', (select count(*)::int from mobilised),
      'mobilized_cents', (select coalesce(sum(mobilized_cents), 0)::bigint from mobilised),
      'cost_cents', (select coalesce(sum(mobilization_cents), 0)::bigint from mobilised),
      'rate_bps', (select case when coalesce(sum(mobilized_cents), 0) > 0
                    then round(sum(mobilization_cents) * 10000.0 / sum(mobilized_cents))::integer end from mobilised),
      'eligible_gap_cents', (select cents from gaps),
      'eligible_gap_decisions', (select decisions from gaps),
      -- What share of everything lent here was funded from outside Brazil.
      'disbursed_cents', (select cents from lent),
      'global_funding_coverage_bps', (select case when l.cents > 0
        then round(l.global_cents * 10000.0 / l.cents)::integer end from lent l),
      'time_to_global_funding', jsonb_build_object(
        'n', (select count(*)::int from filled),
        'median_seconds', (select round(percentile_cont(0.5) within group (order by greatest(s, 0)))::bigint from filled),
        'p90_seconds', (select round(percentile_cont(0.9) within group (order by greatest(s, 0)))::bigint from filled),
        'derived', true),
      'cost_of_capital', jsonb_build_object(
        'fx_hedge_bps_year', coalesce(v_pool.fx_hedge_bps, 0),
        'in_ctm', false),
      'rate_card', jsonb_build_object('version', v_card.version, 'source', v_card.source),
      'provenance', private.cost_provenance(v_card.source))
  );
end;
$$;
