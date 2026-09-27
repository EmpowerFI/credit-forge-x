-- Reading the two economics, and the second question, where the people they
-- concern read them (addendum v2 §8, §10, §12).
--
--   public.capital_plan(opportunity)             now carries the global answer
--   public.capital_mobilization_summary(program) now carries time to global funding
--
-- Nothing new is computed here. Day 1 recorded the global eligibility against
-- the decision, day 2 recorded what mobilising cost against the snapshot; this
-- hands both to the screens that show them, under the row-level rules each one
-- already had.

-- ------------------------------------------------ the global answer on her plan

-- v1 of this reader left the global question out on purpose: the reason codes
-- had no words yet, and a screen rendering an unlabelled code is worse than a
-- screen without it. They have words now, in both languages, so the entrepreneur
-- and the operator read the same answer the audit console does.
--
-- The guard is unchanged, and it is the decision row's own policy asked before
-- the definer's rights take row-level security out of the way.
create or replace function public.capital_plan(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_d public.capital_route_decisions;
  v_allowed boolean;
begin
  select
    (select private.is_auditor_or_admin())
    or coalesce((select private.my_role()::text), '') in ('partner', 'sponsor', 'capital_provider')
    or exists (
      select 1 from public.qualified_credit_opportunities o
      where o.id = p_opportunity_id
        and (o.entrepreneur_id = (select private.my_entrepreneur_id())
             or (select private.leads_entrepreneur(o.entrepreneur_id))))
  into v_allowed;
  if not coalesce(v_allowed, false) then
    raise exception 'not_allowed_to_see_this_plan' using errcode = '42501';
  end if;

  select * into v_d from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'decision_id', v_d.id,
    'decision_no', v_d.decision_no,
    'decided_at', private.iso(v_d.decided_at),
    'is_simulated', v_d.is_simulated,
    'instrument_policy', v_d.instrument_policy,
    'plan', jsonb_build_object(
      'model_version', v_d.engine_version,
      'evaluated', v_d.evaluated,
      'allocations', v_d.allocations,
      'reason_codes', to_jsonb(v_d.reason_codes),
      'requested_cents', v_d.requested_cents,
      'domestic_coverage_cents', v_d.domestic_coverage_cents,
      'global_coverage_cents', v_d.global_coverage_cents,
      'unfunded_cents', v_d.unfunded_cents,
      'external_capital_gap_cents', v_d.external_capital_gap_cents,
      'status', v_d.status),
    -- Whether international capital may take what local capital left, and why
    -- either way. Empty on a decision recorded before the question existed, and
    -- the screen reads that as "not asked" rather than as "refused".
    'global_eligibility', nullif(v_d.global_eligibility, '{}'::jsonb),
    'instruments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', i.code, 'name', i.name, 'instrument_type', i.instrument_type,
        'is_domestic', i.is_domestic, 'is_credit', i.is_credit,
        'provider', p.display_name) order by i.code), '[]'::jsonb)
      from public.capital_instruments i
      join public.capital_providers p on p.id = i.provider_id
      where i.code in (select e ->> 'instrument_id' from jsonb_array_elements(v_d.evaluated) as t(e))));
end;
$$;

-- --------------------------------------------- time to global funding, derived

-- §10 asks how long an opportunity takes to fill from abroad. No column records
-- when one filled, and adding one would mean a second source of truth beside the
-- investments themselves. So it is derived: from the instant the opportunity
-- opened for funding to the instant of its last investment, over the global
-- opportunities that actually reached their target. The metric says it is
-- derived wherever it is shown, because an opportunity that fills in two goes a
-- week apart is measured to the second one, not to the first.
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
    lent as (
      select coalesce(sum(l.principal_cents), 0)::bigint as cents
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
        then round((select coalesce(sum(mobilized_cents), 0) from mobilised) * 10000.0 / l.cents)::integer end from lent l),
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
