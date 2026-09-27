-- A plan she can actually carry.
--
-- Every route's affordability gate asks whether its own slice fits a share of
-- the instalment eligibility sized for her. Nothing asked what the slices came
-- to together. Measured on the seeded demo: 5 of 15 plans recommended a
-- combination whose instalments summed to more than her maximum — up to 105% of
-- it. Each slice fitted on its own; the plan did not.
--
-- It also put the engine at odds with itself on one screen. The global
-- eligibility added in v2 is the only thing that did add instalments up, so it
-- refused, for GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION, the very gap the plan
-- beside it had just allocated.
--
-- The allocation loop now carries a running budget: her affordable instalment,
-- less what the routes already taken will cost her each month. A route may take
-- what its own policy allows or what the budget has left, whichever is smaller,
-- and a route trimmed that way says so — AFFORDABILITY_BUDGET_SHARED, in both
-- languages, on the route card and in the plan's reasons.
--
-- Mirrors packages/capital-allocation matchCapital(). The vectors carry both to
-- the same answer.

-- The inverse of private.capital_instalment_cents(): the largest principal whose
-- instalment still fits a headroom. The same arithmetic capital_affordable_cents
-- does against one route's share, asked here of what her month has left.
create function private.capital_principal_within_instalment(
  p_headroom_cents bigint, p_all_in_bps integer, p_term_months integer
)
returns bigint language sql immutable set search_path = ''
as $$
  select case when p_headroom_cents <= 0 then 0::bigint
         else floor(p_headroom_cents * 10000.0 * p_term_months
                    / (10000 + ceil(p_all_in_bps / 12.0) * p_term_months))::bigint end
$$;

-- One vocabulary, in one order, as packages/capital-allocation REASON_ORDER.
create or replace function private.capital_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'DOMESTIC_COVERAGE_SUFFICIENT', 'DOMESTIC_CAPACITY_PARTIAL', 'DOMESTIC_POOL_EXHAUSTED',
  'PURPOSE_MATCH', 'CLOSED_NETWORK_PURPOSE_MATCH', 'SPONSORED_PROGRAM_MATCH', 'TICKET_MATCH',
  'REGION_MATCH', 'PARTNER_CAPACITY_AVAILABLE', 'LOWER_ESTIMATED_COST',
  'AFFORDABILITY_BUDGET_SHARED', 'GLOBAL_EXPANDS_CAPACITY',
  'GLOBAL_IMPACT_MANDATE_MATCH', 'AFFORDABILITY_LIMIT', 'TICKET_OUTSIDE_POOL_POLICY',
  'PURPOSE_OUTSIDE_POOL_MANDATE', 'TERM_OUTSIDE_POLICY', 'REGION_NOT_ELIGIBLE', 'BUSINESS_TOO_YOUNG',
  'INSUFFICIENT_DOCUMENTATION', 'PARTNER_CAPACITY_EXHAUSTED', 'MANUAL_REVIEW_REQUIRED',
  'NO_ROUTE_AVAILABLE'] $$;

-- Why this instrument earned its place, and whether the plan around it made its
-- slice smaller than its own policy would have allowed.
drop function if exists private.capital_route_reasons(jsonb, jsonb, boolean);
create function private.capital_route_reasons(
  p_need jsonb, p_i jsonb, p_cheapest boolean, p_budget_bound boolean
)
returns text[]
language sql immutable set search_path = ''
as $$
  select private.capital_reasons_ordered(array_remove(array[
    case when (p_i -> 'purposes') ? (p_need ->> 'purpose') then
      case when p_i ->> 'type' = 'productive_exchange_network'
        then 'CLOSED_NETWORK_PURPOSE_MATCH' else 'PURPOSE_MATCH' end end,
    case when p_i ->> 'type' = 'sponsored_capital' then 'SPONSORED_PROGRAM_MATCH' end,
    case when (p_i -> 'eligible_uf') ? (p_need ->> 'uf') then 'REGION_MATCH' end,
    'TICKET_MATCH',
    case when (p_i ->> 'capacity_cents')::bigint > 0 then 'PARTNER_CAPACITY_AVAILABLE' end,
    case when p_cheapest then 'LOWER_ESTIMATED_COST' end,
    case when p_budget_bound then 'AFFORDABILITY_BUDGET_SHARED' end,
    case when not (p_i ->> 'is_domestic')::boolean then 'GLOBAL_EXPANDS_CAPACITY' end,
    case when not (p_i ->> 'is_domestic')::boolean and (p_i ->> 'impact_mandate')::boolean
              and (p_need ->> 'impact_eligible')::boolean then 'GLOBAL_IMPACT_MANDATE_MATCH' end
  ], null))
$$;

create or replace function private.match_capital(p_need jsonb, p_instruments jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_amount bigint := (p_need ->> 'amount_cents')::bigint;
  v_term integer := (p_need ->> 'term_months')::integer;
  v_evaluated jsonb;
  v_allocations jsonb := '[]'::jsonb;
  v_reasons text[] := '{}';
  v_domestic bigint := 0;
  v_global bigint := 0;
  v_gap bigint;
  v_pass integer;
  v_left bigint;
  v_low integer;
  v_take bigint;
  -- What her month has already been promised to the routes taken so far.
  v_spent bigint := 0;
  v_bound boolean := false;
  v_cost integer;
  v_repays boolean;
  v_within bigint;
  v_ceiling bigint;
  v_trimmed boolean;
  a jsonb;
  i jsonb;
begin
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount_cents must be a positive integer' using errcode = '22023';
  end if;
  if v_term is null or v_term <= 0 then
    raise exception 'term_months must be a positive integer' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(private.capital_assess(p_need, t.i) order by t.n), '[]'::jsonb)
    into v_evaluated
    from jsonb_array_elements(p_instruments) with ordinality as t(i, n);

  -- Gate 1. Readiness is the opportunity's own precondition; a run against a
  -- need that never passed it produces a review, not a recommendation.
  if not (p_need ->> 'readiness_ok')::boolean and not (p_need ->> 'manual_review_allowed')::boolean then
    return jsonb_build_object(
      'model_version', private.capital_network_model_version(),
      'evaluated', v_evaluated, 'allocations', '[]'::jsonb,
      'reason_codes', jsonb_build_array('MANUAL_REVIEW_REQUIRED'),
      'requested_cents', v_amount, 'domestic_coverage_cents', 0, 'global_coverage_cents', 0,
      'unfunded_cents', v_amount, 'external_capital_gap_cents', v_amount, 'status', 'manual_review');
  end if;

  -- Pass 1 spends her whole need against domestic routes; pass 2 offers what
  -- they left to a global one.
  for v_pass in 1..2 loop
    v_left := v_amount - v_domestic;
    continue when v_left <= 0;
    -- The cheapest eligible route of this pass, for LOWER_ESTIMATED_COST.
    select min(coalesce((ins.i ->> 'estimated_cost_bps')::integer, 0)) into v_low
      from jsonb_array_elements(v_evaluated) as e(a)
      join jsonb_array_elements(p_instruments) as ins(i) on ins.i ->> 'id' = e.a ->> 'instrument_id'
     where (e.a ->> 'eligible')::boolean
       and (ins.i ->> 'is_domestic')::boolean = (v_pass = 1);

    -- Best fit first; ties to the cheaper route, then to the lower id, so a run
    -- is reproducible and independent of the order the rows came back in.
    for a, i in
      select e.a, ins.i
        from jsonb_array_elements(v_evaluated) as e(a)
        join jsonb_array_elements(p_instruments) as ins(i) on ins.i ->> 'id' = e.a ->> 'instrument_id'
       where (e.a ->> 'eligible')::boolean
         and (ins.i ->> 'is_domestic')::boolean = (v_pass = 1)
       order by (e.a ->> 'fit_score')::integer desc,
                coalesce((ins.i ->> 'estimated_cost_bps')::integer, 0) asc,
                ins.i ->> 'id' asc
    loop
      exit when v_left <= 0;
      v_cost := coalesce((i ->> 'estimated_cost_bps')::integer, 0);
      -- A route with no repayment — an exchange, a grant — takes nothing from
      -- her month, so it neither spends the budget nor is bound by it.
      v_repays := (i ->> 'max_instalment_share_bps') is not null;
      v_within := case when v_repays
        then private.capital_principal_within_instalment(
               (p_need ->> 'max_instalment_cents')::bigint - v_spent, v_cost, v_term)
        else 9007199254740991 end;
      v_ceiling := least((a ->> 'max_takeable_cents')::bigint, v_left);
      v_take := least(v_ceiling, v_within);
      v_trimmed := v_repays and v_within < v_ceiling;
      -- A route that cannot reach its own floor is not a route for this slice.
      if v_take < (i ->> 'ticket_min_cents')::bigint then
        if v_trimmed then v_bound := true; end if;
        continue;
      end if;
      if v_trimmed then v_bound := true; end if;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
        'instrument_id', i -> 'id',
        'amount_cents', v_take,
        'fit_score', (a ->> 'fit_score')::integer,
        'reasons', to_jsonb(private.capital_route_reasons(p_need, i, v_cost = v_low, v_trimmed)),
        'requires_partner_approval', (i ->> 'requires_partner_approval')::boolean,
        'is_credit', (i ->> 'is_credit')::boolean));
      if v_repays then
        v_spent := v_spent + private.capital_instalment_cents(v_take, v_cost, v_term);
      end if;
      v_left := v_left - v_take;
      if v_pass = 1 then v_domestic := v_domestic + v_take; else v_global := v_global + v_take; end if;
    end loop;
  end loop;

  -- The addendum's External Capital Gap: what domestic capacity could not absorb.
  v_gap := v_amount - v_domestic;

  if v_domestic >= v_amount then v_reasons := array_append(v_reasons, 'DOMESTIC_COVERAGE_SUFFICIENT');
  elsif v_domestic > 0 then v_reasons := array_append(v_reasons, 'DOMESTIC_CAPACITY_PARTIAL');
  else v_reasons := array_append(v_reasons, 'DOMESTIC_POOL_EXHAUSTED');
  end if;
  v_reasons := v_reasons || array(
    select r from jsonb_array_elements(v_allocations) as t(al),
                  jsonb_array_elements_text(t.al -> 'reasons') as u(r));
  -- A plan the budget bound says so, even where the route it stopped never made
  -- it into the stack to carry the reason itself.
  if v_bound then v_reasons := array_append(v_reasons, 'AFFORDABILITY_BUDGET_SHARED'); end if;
  v_reasons := v_reasons || array(
    select r from jsonb_array_elements(v_evaluated) as t(e),
                  jsonb_array_elements_text(t.e -> 'blocks') as u(r));
  if jsonb_array_length(v_allocations) = 0 then
    v_reasons := array_append(v_reasons, 'NO_ROUTE_AVAILABLE');
  end if;

  return jsonb_build_object(
    'model_version', private.capital_network_model_version(),
    'evaluated', v_evaluated,
    'allocations', v_allocations,
    'reason_codes', to_jsonb(private.capital_reasons_ordered(v_reasons)),
    'requested_cents', v_amount,
    'domestic_coverage_cents', v_domestic,
    'global_coverage_cents', v_global,
    'unfunded_cents', v_gap - v_global,
    'external_capital_gap_cents', v_gap,
    'status', case when jsonb_array_length(v_allocations) > 0 then 'recommended' else 'no_route' end);
end;
$$;

-- ---------------------------------------------------------------------- grants
-- The new function, and the recreated one whose grants the drop took with it.
-- rbac.test.sql asks the whole schema this question, and it caught both.
revoke all on function
  private.capital_principal_within_instalment(bigint, integer, integer),
  private.capital_route_reasons(jsonb, jsonb, boolean, boolean)
  from public, anon, authenticated;
grant execute on function
  private.capital_principal_within_instalment(bigint, integer, integer),
  private.capital_route_reasons(jsonb, jsonb, boolean, boolean)
  to service_role;
