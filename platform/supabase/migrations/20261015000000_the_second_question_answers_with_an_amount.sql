-- The second question answers with an amount, not a yes.
--
-- It asked whether her month could carry the whole residual gap at the price a
-- rail actually quoted, and said no whenever it could not carry all of it. Once
-- the plan started sizing its own allocations against her total instalment
-- (20261013000000), the domestic routes were taking what they could and leaving
-- a headroom that rarely covered every centavo of the gap — so every gap in the
-- seeded book was refused, and the eligible external capital gap on the
-- economics screen read R$ 0,00 across fifteen plans.
--
-- All-or-nothing was the wrong shape for the question. A gap is an amount, and
-- what she can carry of it is an amount too. The gate now computes the largest
-- slice of the gap her remaining month reaches at the quoted price, and refuses
-- only what falls below the smallest ticket a global route would take — because
-- a slice nobody could take is not eligible demand, it is noise on a dashboard.
--
-- A gap only partly reachable says so: GLOBAL_GAP_PARTLY_AFFORDABLE, beside the
-- reasons that say why the rest of it passed.
--
-- Mirrors packages/capital-allocation globalEconomics(), globalGates() and
-- globalEligibility(). The eight vectors carry both engines to one answer.

create or replace function private.global_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'GLOBAL_GAP_CONFIRMED', 'GLOBAL_ECONOMICS_WITHIN_CEILING', 'GLOBAL_GAP_PARTLY_AFFORDABLE',
  'GLOBAL_EVIDENCE_SUFFICIENT',
  'GLOBAL_ROUTE_REGULATED', 'GLOBAL_GAP_ABSENT', 'GLOBAL_DOMESTIC_ROUTE_RECOVERABLE',
  'GLOBAL_COST_EXCEEDS_CEILING', 'GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION',
  'GLOBAL_EVIDENCE_INSUFFICIENT', 'GLOBAL_NO_REGULATED_ROUTE'] $$;

create or replace function private.global_economics(p_ctx jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_term integer := (p_ctx ->> 'term_months')::integer;
  v_gap bigint := (p_ctx ->> 'gap_cents')::bigint;
  v_route integer := (p_ctx ->> 'route_cost_bps')::integer;
  v_modelled integer := (p_ctx ->> 'modelled_ramp_annual_bps')::integer;
  v_quoted integer := (p_ctx ->> 'quoted_mobilization_bps')::integer;
  v_return integer := (p_ctx ->> 'modelled_return_ramp_bps')::integer;
  v_total_mob integer;
  v_annual integer;
  v_total integer;
  v_headroom bigint;
begin
  v_total_mob := v_quoted + v_return;
  v_annual := ceil(v_total_mob * 12.0 / v_term)::integer;
  v_total := v_route - v_modelled + v_annual;
  v_headroom := greatest(0,
    (p_ctx ->> 'max_instalment_cents')::bigint - (p_ctx ->> 'instalment_committed_cents')::bigint);
  return jsonb_build_object(
    'route_cost_bps', v_route,
    'modelled_ramp_annual_bps', v_modelled,
    'quoted_mobilization_bps', v_quoted,
    'modelled_return_ramp_bps', v_return,
    'mobilization_total_bps', v_total_mob,
    'mobilization_annual_bps', v_annual,
    'total_cost_bps', v_total,
    'delta_bps', v_total - v_route,
    'instalment_cents', case when v_gap > 0
      then private.capital_instalment_cents(v_gap, v_total, v_term) else 0 end,
    'instalment_headroom_cents', v_headroom,
    -- How much of the gap that headroom actually reaches, at the quoted cost.
    'affordable_gap_cents', case when v_gap > 0
      then least(v_gap, private.capital_principal_within_instalment(v_headroom, v_total, v_term))
      else 0 end);
end;
$$;

create or replace function private.global_gates(p_ctx jsonb, p_econ jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('gate', 'gap',
      'passed', (p_ctx ->> 'gap_cents')::bigint > 0,
      'reason', 'GLOBAL_GAP_ABSENT',
      'value', (p_ctx ->> 'gap_cents')::bigint, 'limit', 0),
    -- Local demand a local route would take once she brings a paper. Asked
    -- before the economics, because the cheapest global route is still the
    -- wrong answer to it.
    jsonb_build_object('gate', 'domestic_reconsidered',
      'passed', jsonb_array_length(coalesce(p_ctx -> 'recoverable_domestic', '[]'::jsonb)) = 0,
      'reason', 'GLOBAL_DOMESTIC_ROUTE_RECOVERABLE',
      'value', (select coalesce(string_agg(t, ','), '')
                from jsonb_array_elements_text(coalesce(p_ctx -> 'recoverable_domestic', '[]'::jsonb)) as u(t)),
      'limit', to_jsonb(private.global_recoverable_blocks())),
    jsonb_build_object('gate', 'economics',
      'passed', (p_econ ->> 'total_cost_bps')::integer <= private.capital_cost_ceiling_bps(),
      'reason', 'GLOBAL_COST_EXCEEDS_CEILING',
      'value', (p_econ ->> 'total_cost_bps')::integer, 'limit', private.capital_cost_ceiling_bps()),
    -- Asked as an amount, not as a yes. A gap she can carry half of is half a
    -- gap international capital may take, and answering "no" to all of it sends
    -- her away from money she could have used. It refuses only a slice below the
    -- smallest ticket a global route states, which nobody could have taken.
    jsonb_build_object('gate', 'affordability',
      'passed', (p_econ ->> 'affordable_gap_cents')::bigint >= (p_ctx ->> 'global_ticket_min_cents')::bigint,
      'reason', 'GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION',
      'value', (p_econ ->> 'affordable_gap_cents')::bigint,
      'limit', (p_ctx ->> 'global_ticket_min_cents')::bigint),
    jsonb_build_object('gate', 'evidence',
      'passed', (p_ctx ->> 'evidence_score')::integer >= private.global_evidence_min_score()
            and (p_ctx ->> 'months_reported')::integer >= private.global_min_months_reported(),
      'reason', 'GLOBAL_EVIDENCE_INSUFFICIENT',
      'value', (p_ctx ->> 'evidence_score') || '/25 over ' || (p_ctx ->> 'months_reported'),
      'limit', private.global_evidence_min_score() || '/25 over ' || private.global_min_months_reported()),
    jsonb_build_object('gate', 'regulatory_route',
      'passed', (p_ctx ->> 'settlement_feasible')::boolean,
      'reason', 'GLOBAL_NO_REGULATED_ROUTE',
      'value', p_ctx ->> 'settlement_reality', 'limit', (p_ctx ->> 'gap_cents')::bigint))
$$;

create or replace function private.global_eligibility(p_ctx jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_econ jsonb;
  v_gates jsonb;
  v_failed text[];
  v_reasons text[] := '{}';
  v_decision text;
  v_gap bigint := (p_ctx ->> 'gap_cents')::bigint;
begin
  if v_gap is null or v_gap < 0 then
    raise exception 'gap_cents must be a non-negative integer' using errcode = '22023';
  end if;
  if (p_ctx ->> 'term_months')::integer is null or (p_ctx ->> 'term_months')::integer <= 0 then
    raise exception 'term_months must be a positive integer' using errcode = '22023';
  end if;

  v_econ := private.global_economics(p_ctx);
  v_gates := private.global_gates(p_ctx, v_econ);

  -- A gap that never existed is not a refusal, and nothing downstream of it was
  -- ever asked: no quote was requested, no evidence was weighed. The trace says
  -- so by carrying one gate, not six answers to questions nobody put.
  if not (v_gates -> 0 ->> 'passed')::boolean then
    return jsonb_build_object(
      'model_version', private.global_capital_model_version(),
      'decision', 'not_needed',
      'gates', jsonb_build_array(v_gates -> 0),
      'reason_codes', jsonb_build_array('GLOBAL_GAP_ABSENT'),
      'gap_cents', v_gap,
      'eligible_gap_cents', 0,
      'economics', v_econ);
  end if;

  select coalesce(array_agg(g ->> 'reason'), '{}') into v_failed
    from jsonb_array_elements(v_gates) as t(g) where not (g ->> 'passed')::boolean;
  v_reasons := v_failed;
  v_decision := case when cardinality(v_failed) = 0 then 'eligible' else 'refused' end;

  -- Why it said yes, not only that it did.
  v_reasons := array_append(v_reasons, 'GLOBAL_GAP_CONFIRMED');
  if not ('GLOBAL_COST_EXCEEDS_CEILING' = any(v_failed))
     and not ('GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION' = any(v_failed)) then
    v_reasons := array_append(v_reasons, 'GLOBAL_ECONOMICS_WITHIN_CEILING');
  end if;
  -- Reached part of it, not all of it: said plainly, beside the yeses.
  if not ('GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION' = any(v_failed))
     and (v_econ ->> 'affordable_gap_cents')::bigint < v_gap then
    v_reasons := array_append(v_reasons, 'GLOBAL_GAP_PARTLY_AFFORDABLE');
  end if;
  if not ('GLOBAL_EVIDENCE_INSUFFICIENT' = any(v_failed)) then
    v_reasons := array_append(v_reasons, 'GLOBAL_EVIDENCE_SUFFICIENT');
  end if;
  if not ('GLOBAL_NO_REGULATED_ROUTE' = any(v_failed)) then
    v_reasons := array_append(v_reasons, 'GLOBAL_ROUTE_REGULATED');
  end if;

  return jsonb_build_object(
    'model_version', private.global_capital_model_version(),
    'decision', v_decision,
    'gates', v_gates,
    'reason_codes', to_jsonb(private.global_reasons_ordered(v_reasons)),
    'gap_cents', v_gap,
    -- What international capital may take: the part of the gap that passed every
    -- question, which is the part her month reaches at the quoted price.
    'eligible_gap_cents', case when v_decision = 'eligible'
      then (v_econ ->> 'affordable_gap_cents')::bigint else 0 end,
    'economics', v_econ);
end;
$$;

create or replace function private.global_gap_context(
  p_opportunity_id uuid, p_plan jsonb, p_instruments jsonb, p_now timestamptz
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_gap bigint;
  v_global jsonb;
  v_pool public.funding_pools;
  v_quote jsonb;
  v_readiness public.readiness_assessments;
  v_max_instalment bigint;
begin
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  v_gap := (p_plan ->> 'external_capital_gap_cents')::bigint;

  -- The global route as the network engine saw it this run, so its rate here and
  -- its rate on the route card can never disagree.
  select i into v_global from jsonb_array_elements(p_instruments) as t(i)
   where not (i ->> 'is_domestic')::boolean
   order by i ->> 'id' limit 1;

  select * into v_pool from public.funding_pools where pool = 'global';

  select el.max_instalment_cents into v_max_instalment
    from public.eligibility_assessments el where el.id = v_opp.eligibility_id;

  select * into v_readiness from public.readiness_assessments r
   where r.entrepreneur_id = v_opp.entrepreneur_id
   order by r.assessment_no desc limit 1;

  v_quote := private.global_mobilization_quote(p_opportunity_id, v_gap, p_now);

  return jsonb_build_object(
    'gap_cents', v_gap,
    'term_months', v_opp.term_months,
    'max_instalment_cents', coalesce(v_max_instalment, 0),
    'instalment_committed_cents', private.global_instalment_committed(p_plan, p_instruments, v_opp.term_months),
    'route_cost_bps', coalesce((v_global ->> 'estimated_cost_bps')::integer, 0),
    -- The floor the global route states: below it, a slice is not a slice.
    'global_ticket_min_cents', coalesce((v_global ->> 'ticket_min_cents')::bigint, 0),
    -- What her rate already carries for moving money, which the quote replaces.
    'modelled_ramp_annual_bps', ceil(2.0 * coalesce(v_pool.ramp_bps, 0) * 12 / v_opp.term_months)::integer,
    'quoted_mobilization_bps', (v_quote ->> 'quoted_mobilization_bps')::integer,
    -- The return leg, still modelled: nothing in this product prices BRL to
    -- USDC, and inventing a quote for it would be a third place that prices a
    -- spread.
    'modelled_return_ramp_bps', coalesce(v_pool.ramp_bps, 0),
    'evidence_score', coalesce((v_readiness.components ->> 'data_quality')::integer, 0),
    'months_reported', coalesce((v_readiness.features ->> 'months_reported')::integer, 0),
    'settlement_feasible', (v_quote ->> 'settlement_feasible')::boolean,
    'settlement_reality', v_quote ->> 'settlement_reality',
    'settlement_route', v_quote ->> 'settlement_route',
    'recoverable_domestic', private.global_recoverable_domestic(p_plan, p_instruments));
end;
$$;
