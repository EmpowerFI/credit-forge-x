-- Global Capital Eligibility — the second question, asked of the residual gap.
--
-- packages/capital-allocation/src/global.ts in SQL, plus the assembly of its
-- context out of what the product already computed, and the operator's button
-- extended to record the answer:
--
--   private.global_economics(ctx)          her cost with the quote in place of the constant
--   private.global_gates(ctx, econ)        the six gates, each with both sides
--   private.global_eligibility(ctx)        the answer, and why, either way
--   private.global_gap_context(opp, plan)  the question, assembled
--   public.run_capital_engine(opportunity) now records both answers
--
-- packages/capital-allocation/vectors/global.json holds the engine here and the
-- engine in the browser to one answer, as network.json does for the pass before
-- it.
--
-- Three things this deliberately does not do:
--
--   It does not price a conversion. The mobilisation cost arrives from
--   private.settle_route(), which is the one place in this database allowed to
--   compute a spread. A second FX calculation would be the third.
--
--   It does not add the quote to her rate. Her rate on the global pool already
--   carries a modelled cost of moving money — the pool engine's ramp_bps_year —
--   so the quote *replaces* that term. Adding it would charge her twice for one
--   conversion, and the whole point of asking is to find out what the estimate
--   was hiding. On a twelve-month loan it is hiding about 79 basis points.
--
--   It does not allocate. A gap this call finds eligible is a gap a global
--   instrument may then be offered, and nothing more.

-- ------------------------------------------------- what the decision remembers

-- The section of the same decision row v2 §5.1 asks for as an object of its own.
-- A fifth decision table would give the audit console two rows to reconcile for
-- one run (PLAN_CAPITAL_NETWORK_V2 §3.1).
alter table public.capital_route_decisions
  add column global_eligibility jsonb not null default '{}'::jsonb;

-- The addendum's Eligible External Capital Gap, as a column because §10 reports
-- it across a portfolio and reading it out of jsonb for every row would make
-- that aggregation a scan of documents instead of a sum of integers.
alter table public.capital_route_decisions
  add column eligible_gap_cents bigint not null default 0 check (eligible_gap_cents >= 0);

-- ------------------------------------------------------------- engine policy

create function private.global_capital_model_version()
returns text language sql immutable set search_path = ''
as $$ select 'global-capital-v1.0.0' $$;

-- The share of the readiness data_quality component (0-25) a cross-border route
-- asks for, and the months of history behind it. Higher than a local product
-- asks, and stated as policy rather than buried: money that crosses a border is
-- reported on to people who will never meet her.
create function private.global_evidence_min_score()
returns integer language sql immutable set search_path = ''
as $$ select 12 $$;

create function private.global_min_months_reported()
returns integer language sql immutable set search_path = ''
as $$ select 3 $$;

-- A domestic refusal she could undo this week. Papers she can fetch; a state the
-- product does not serve, a purpose outside a mandate, a business younger than a
-- floor, an exhausted partner — those she cannot.
create function private.global_recoverable_blocks()
returns text[] language sql immutable set search_path = ''
as $$ select array['INSUFFICIENT_DOCUMENTATION'] $$;

-- One vocabulary in one order, as global.ts REASON_ORDER. Kept apart from
-- private.capital_reason_order() because the two lists answer two questions and
-- a plan's reason codes must never pick up a code about global capital.
create function private.global_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'GLOBAL_GAP_CONFIRMED', 'GLOBAL_ECONOMICS_WITHIN_CEILING', 'GLOBAL_EVIDENCE_SUFFICIENT',
  'GLOBAL_ROUTE_REGULATED', 'GLOBAL_GAP_ABSENT', 'GLOBAL_DOMESTIC_ROUTE_RECOVERABLE',
  'GLOBAL_COST_EXCEEDS_CEILING', 'GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION',
  'GLOBAL_EVIDENCE_INSUFFICIENT', 'GLOBAL_NO_REGULATED_ROUTE'] $$;

create function private.global_reasons_ordered(p_codes text[])
returns text[] language sql immutable set search_path = ''
as $$
  select array(
    select o from unnest(private.global_reason_order()) with ordinality as t(o, n)
    where o = any(p_codes) order by n)
$$;

-- ------------------------------------------------------------------ the engine

-- The flat instalment of a principal at an annual all-in rate, as the pool
-- engine sizes one and as eligibility sized hers. instalmentCents().
create function private.capital_instalment_cents(p_principal_cents bigint, p_all_in_bps integer, p_term_months integer)
returns bigint language sql immutable set search_path = ''
as $$
  select ceil(p_principal_cents * (10000 + ceil(p_all_in_bps / 12.0) * p_term_months)
              / (10000.0 * p_term_months))::bigint
$$;

-- Her economics on the gap, with the quote in place of the modelled constant.
-- globalEconomics().
create function private.global_economics(p_ctx jsonb)
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
begin
  v_total_mob := v_quoted + v_return;
  v_annual := ceil(v_total_mob * 12.0 / v_term)::integer;
  v_total := v_route - v_modelled + v_annual;
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
    'instalment_headroom_cents', greatest(0,
      (p_ctx ->> 'max_instalment_cents')::bigint - (p_ctx ->> 'instalment_committed_cents')::bigint));
end;
$$;

-- The gates the global question puts to a residual gap, in the order it asks
-- them. globalGates().
create function private.global_gates(p_ctx jsonb, p_econ jsonb)
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
    -- The affordability gate of the network engine, asked a second time:
    -- against the quoted cost, and against what the domestic routes left of her
    -- instalment rather than against the whole of it.
    jsonb_build_object('gate', 'affordability',
      'passed', (p_econ ->> 'instalment_cents')::bigint <= (p_econ ->> 'instalment_headroom_cents')::bigint,
      'reason', 'GLOBAL_AFFORDABILITY_AFTER_MOBILIZATION',
      'value', (p_econ ->> 'instalment_cents')::bigint,
      'limit', (p_econ ->> 'instalment_headroom_cents')::bigint),
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

-- Whether international capital may take this residual gap, and why either way.
-- globalEligibility().
create function private.global_eligibility(p_ctx jsonb)
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
    'eligible_gap_cents', case when v_decision = 'eligible' then v_gap else 0 end,
    'economics', v_econ);
end;
$$;

-- ------------------------------------------------------- the question, assembled

-- Domestic instruments this need was refused by for something she could fix,
-- and nothing else. recoverableDomestic().
create function private.global_recoverable_domestic(p_plan jsonb, p_instruments jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(e.a ->> 'instrument_id' order by e.n), '[]'::jsonb)
  from jsonb_array_elements(p_plan -> 'evaluated') with ordinality as e(a, n)
  join jsonb_array_elements(p_instruments) as ins(i) on ins.i ->> 'id' = e.a ->> 'instrument_id'
  where (ins.i ->> 'is_domestic')::boolean
    and not (e.a ->> 'eligible')::boolean
    and not exists (
      select 1 from jsonb_array_elements_text(e.a -> 'blocks') as b(code)
      where not (b.code = any(private.global_recoverable_blocks())))
$$;

-- What the plan's domestic allocations already take of her monthly instalment.
-- instalmentCommittedCents().
create function private.global_instalment_committed(p_plan jsonb, p_instruments jsonb, p_term_months integer)
returns bigint
language sql immutable set search_path = ''
as $$
  select coalesce(sum(private.capital_instalment_cents(
           (al.a ->> 'amount_cents')::bigint,
           coalesce((ins.i ->> 'estimated_cost_bps')::integer, 0), p_term_months)), 0)::bigint
  from jsonb_array_elements(p_plan -> 'allocations') as al(a)
  join jsonb_array_elements(p_instruments) as ins(i) on ins.i ->> 'id' = al.a ->> 'instrument_id'
  -- A route with no repayment takes nothing from her month, and the global route
  -- is the one being asked about: counting its own instalment against its own
  -- headroom would refuse every gap it was offered.
  where (ins.i ->> 'is_domestic')::boolean
    and (ins.i ->> 'is_credit')::boolean and ins.i ->> 'max_instalment_share_bps' is not null
$$;

-- What it costs to bring this gap into reais, from the comparator that already
-- prices it. Nothing here converts anything: the gross is the one that delivers
-- the gap through the route the comparator itself chose.
create function private.global_mobilization_quote(p_opportunity_id uuid, p_gap_cents bigint, p_now timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fx integer := private.demo_brl_per_usdc_milli();
  v_gross bigint;
  v_result jsonb;
  v_quote jsonb;
begin
  if p_gap_cents <= 0 then
    return jsonb_build_object('quoted_mobilization_bps', 0, 'settlement_feasible', false,
                              'settlement_reality', 'simulated', 'settlement_route', null);
  end if;
  -- The gross whose net is the gap, priced off the direct card, and the gross
  -- both routes are then compared at — as private.settle_route requires one.
  v_gross := private.settlement_gross_for_cents(p_gap_cents, v_fx, private.settlement_card('direct_usdc_pix'));
  if v_gross is null then
    return jsonb_build_object('quoted_mobilization_bps', 0, 'settlement_feasible', false,
                              'settlement_reality', 'simulated', 'settlement_route', null);
  end if;
  v_result := private.settle_route(v_gross, p_gap_cents, p_now,
                private.settlement_requests(p_opportunity_id, p_now));
  -- The route the comparator chose, or the direct one to report a cost with
  -- when it chose none.
  select q into v_quote from jsonb_array_elements(v_result -> 'quotes') as t(q)
   where q ->> 'route' = coalesce(v_result ->> 'selected', 'direct_usdc_pix');
  return jsonb_build_object(
    'quoted_mobilization_bps', coalesce((v_quote ->> 'cost_bps')::integer, 0),
    'settlement_feasible', v_result ->> 'selected' is not null,
    'settlement_reality', coalesce(v_quote ->> 'reality', 'simulated'),
    'settlement_route', v_result ->> 'selected');
end;
$$;

-- The global question, assembled from what the product already computed. Every
-- figure here was decided somewhere else: the gap by the network engine, the
-- rate by the pool engine, the conversion by the comparator, the evidence by
-- the readiness engine.
create function private.global_gap_context(
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

-- ------------------------------------------------ the operator's button, again

-- Third revision: one run, two answers. The plan is what the network can do;
-- the global eligibility is what international capital may do about what it
-- could not. Both are recorded against the same decision number, and both enter
-- the idempotency comparison — a run whose global answer moved is a new
-- decision even where the allocations did not.
create or replace function public.run_capital_engine(p_opportunity_id uuid, p_documents text[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_need jsonb;
  v_instruments jsonb;
  v_policy jsonb;
  v_plan jsonb;
  v_global jsonb;
  v_last public.capital_route_decisions;
  v_found boolean;
  v_id uuid;
  v_no integer;
begin
  if not private.capital_network_enabled() then
    raise exception 'capital_network_disabled' using errcode = 'P0001';
  end if;
  if not (select private.is_capital_operator()) then
    raise exception 'not_a_capital_operator' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if not private.has_consent(v_opp.entrepreneur_id, 'partner') then
    raise exception 'partner_consent_missing' using errcode = '42501';
  end if;

  if p_documents is not null then
    update public.qualified_credit_opportunities
      set documents_on_file = p_documents where id = p_opportunity_id;
  end if;

  v_need := private.capital_need(p_opportunity_id);
  v_instruments := private.capital_network_instruments(p_opportunity_id);
  v_plan := private.match_capital(v_need, v_instruments);
  v_global := private.global_eligibility(
    private.global_gap_context(p_opportunity_id, v_plan, v_instruments, now()));

  select coalesce(jsonb_object_agg(i.code, i.policy_version), '{}'::jsonb) into v_policy
  from public.capital_instruments i
  where i.code in (select jsonb_array_elements(v_instruments) ->> 'id');

  select * into v_last from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  v_found := found;
  if v_found
     and v_last.engine_version = v_plan ->> 'model_version'
     and v_last.need = v_need
     and v_last.evaluated = v_plan -> 'evaluated'
     and v_last.allocations = v_plan -> 'allocations'
     and v_last.instrument_policy = v_policy
     and v_last.global_eligibility = v_global then
    return jsonb_build_object('decision_id', v_last.id, 'decision_no', v_last.decision_no,
                              'recorded', false, 'plan', v_plan, 'global_eligibility', v_global);
  end if;

  v_no := case when v_found then v_last.decision_no + 1 else 1 end;
  insert into public.capital_route_decisions (
    opportunity_id, decision_no, engine_version, requested_cents, need, evaluated, allocations,
    reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status,
    instrument_policy, global_eligibility, eligible_gap_cents, is_simulated)
  values (
    p_opportunity_id, v_no, v_plan ->> 'model_version', (v_plan ->> 'requested_cents')::bigint,
    v_need, v_plan -> 'evaluated', v_plan -> 'allocations',
    array(select jsonb_array_elements_text(v_plan -> 'reason_codes')),
    (v_plan ->> 'domestic_coverage_cents')::bigint,
    (v_plan ->> 'global_coverage_cents')::bigint,
    (v_plan ->> 'unfunded_cents')::bigint,
    (v_plan ->> 'status')::public.capital_route_status,
    v_policy,
    v_global,
    (v_global ->> 'eligible_gap_cents')::bigint,
    true)
  returning id into v_id;
  return jsonb_build_object('decision_id', v_id, 'decision_no', v_no, 'recorded', true,
                            'plan', v_plan, 'global_eligibility', v_global);
end;
$$;

-- ---------------------------------------------------------------------- grants

revoke all on function
  private.global_capital_model_version(), private.global_evidence_min_score(),
  private.global_min_months_reported(), private.global_recoverable_blocks(),
  private.global_reason_order(), private.global_reasons_ordered(text[]),
  private.capital_instalment_cents(bigint, integer, integer),
  private.global_economics(jsonb), private.global_gates(jsonb, jsonb),
  private.global_eligibility(jsonb), private.global_recoverable_domestic(jsonb, jsonb),
  private.global_instalment_committed(jsonb, jsonb, integer),
  private.global_mobilization_quote(uuid, bigint, timestamptz),
  private.global_gap_context(uuid, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function
  private.global_capital_model_version(), private.global_evidence_min_score(),
  private.global_min_months_reported(), private.global_recoverable_blocks(),
  private.global_reason_order(), private.global_reasons_ordered(text[]),
  private.capital_instalment_cents(bigint, integer, integer),
  private.global_economics(jsonb), private.global_gates(jsonb, jsonb),
  private.global_eligibility(jsonb), private.global_recoverable_domestic(jsonb, jsonb),
  private.global_instalment_committed(jsonb, jsonb, integer),
  private.global_mobilization_quote(uuid, bigint, timestamptz),
  private.global_gap_context(uuid, jsonb, jsonb, timestamptz)
  to service_role;
