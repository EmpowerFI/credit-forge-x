-- Running the Capital Network over one opportunity.
--
-- Day 1 built the registry, day 2 the matching engine in TypeScript. This is
-- the same engine in SQL, the assembly of its two inputs from what the product
-- already knows, and one explicit entry point:
--
--   private.match_capital(need, instruments)   the engine, pure and immutable
--   private.capital_need(opportunity)          her side of the question
--   private.capital_network_instruments(opp)   the network's side of it
--   public.run_capital_engine(opportunity)     the operator's button
--
-- packages/capital-allocation/src/network.ts and private.match_capital must
-- give one answer, and packages/capital-allocation/vectors/network.json holds
-- them to it — the same discipline as the pool engine before it.
--
-- Three things this deliberately does not do:
--
--   It does not run on a trigger. private.open_for_funding() is untouched: it
--   still chooses a pool when an opportunity opens, and everything downstream
--   of funding_pool behaves exactly as it did. The network is a second, later
--   question, asked by a person (PLAN_CAPITAL_NETWORK §3.2, §6.3).
--
--   It does not approve anything. Every route it recommends whose owner still
--   has to say yes carries requires_partner_approval, and the plan is a
--   recommendation with reasons attached, never an offer.
--
--   It does not hash its own decision. Canonicalisation and commitment live in
--   packages/audit-commitments, as they do for every other anchored fact;
--   snapshot_hash is filled by the anchor path on day 5.

-- ------------------------------------------------- what the decision remembers

-- The inputs the run was made against, as eligibility_assessments.inputs keeps
-- the inputs of an eligibility decision. Without them a stored recommendation
-- could not be reproduced, and the idempotency test below would have nothing to
-- compare.
alter table public.capital_route_decisions
  add column need jsonb not null default '{}'::jsonb;

-- What she has on file, against each instrument's required_documents. No
-- surface in this product records documents yet, so this column starts empty
-- and an operator states them when running the engine; the statement is kept
-- rather than floated, so the next run reproduces this one.
alter table public.qualified_credit_opportunities
  add column documents_on_file text[] not null default '{}';

-- The P2P routes may take her whole affordable instalment, because eligibility
-- sized her amount against exactly that instalment before the opportunity
-- existed. Stated as policy rather than left null, so the affordability gate is
-- skipped only by a route that has no repayment at all.
update public.capital_instruments set max_instalment_share_bps = 10000 where pool is not null;

-- ------------------------------------------------------------- engine policy

-- The weights of addendum §6, in basis points, summing to 10000. Policy about
-- *fit*: the hard gates decide who is eligible at all, and no weight can
-- overturn one. Kept as data so the operator console can show them.
create function private.capital_fit_weights()
returns jsonb language sql immutable set search_path = ''
as $$ select '{"purpose": 2500, "amount_coverage": 2000, "cost": 2000, "availability": 1500,
               "geography": 1000, "mandate": 500, "operational": 500}'::jsonb $$;

-- The annual all-in cost at which a route scores zero on cost. Above it the
-- term is floored rather than going negative: a very expensive route is still a
-- route, and the gates, not the score, are what refuse one.
create function private.capital_cost_ceiling_bps()
returns integer language sql immutable set search_path = ''
as $$ select 12000 $$;

-- One vocabulary, in one order, as packages/capital-allocation REASON_ORDER.
create function private.capital_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'DOMESTIC_COVERAGE_SUFFICIENT', 'DOMESTIC_CAPACITY_PARTIAL', 'DOMESTIC_POOL_EXHAUSTED',
  'PURPOSE_MATCH', 'CLOSED_NETWORK_PURPOSE_MATCH', 'SPONSORED_PROGRAM_MATCH', 'TICKET_MATCH',
  'REGION_MATCH', 'PARTNER_CAPACITY_AVAILABLE', 'LOWER_ESTIMATED_COST', 'GLOBAL_EXPANDS_CAPACITY',
  'GLOBAL_IMPACT_MANDATE_MATCH', 'AFFORDABILITY_LIMIT', 'TICKET_OUTSIDE_POOL_POLICY',
  'PURPOSE_OUTSIDE_POOL_MANDATE', 'REGION_NOT_ELIGIBLE', 'BUSINESS_TOO_YOUNG',
  'INSUFFICIENT_DOCUMENTATION', 'PARTNER_CAPACITY_EXHAUSTED', 'MANUAL_REVIEW_REQUIRED',
  'NO_ROUTE_AVAILABLE'] $$;

create function private.capital_reasons_ordered(p_codes text[])
returns text[] language sql immutable set search_path = ''
as $$
  select array(
    select o from unnest(private.capital_reason_order()) with ordinality as t(o, n)
    where o = any(p_codes) order by n)
$$;

create function private.capital_clamp(p_n numeric)
returns integer language sql immutable set search_path = ''
as $$ select greatest(0, least(100, floor(p_n)))::integer $$;

-- ------------------------------------------------------------------ the engine

-- The largest principal whose flat instalment still fits the share of her
-- affordable instalment this route is allowed to take. affordableAmountCents().
create function private.capital_affordable_cents(p_need jsonb, p_i jsonb)
returns bigint
language plpgsql immutable set search_path = ''
as $$
declare
  v_share integer := (p_i ->> 'max_instalment_share_bps')::integer;
  v_term integer := (p_need ->> 'term_months')::integer;
  v_allowance bigint;
  v_monthly integer;
begin
  -- No repayment, no affordability limit. The only case the gate may skip.
  if v_share is null then return 9007199254740991; end if;
  v_allowance := floor((p_need ->> 'max_instalment_cents')::bigint * v_share / 10000.0);
  if v_allowance <= 0 then return 0; end if;
  v_monthly := ceil(coalesce((p_i ->> 'estimated_cost_bps')::integer, 0) / 12.0);
  return floor(v_allowance * 10000.0 * v_term / (10000 + v_monthly * v_term));
end;
$$;

-- The gates one instrument puts to one need, each with both sides of the
-- comparison: the trace a person can read. gates().
create function private.capital_gates(p_need jsonb, p_i jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  with m as (
    select array(
      select d from jsonb_array_elements_text(p_i -> 'required_documents') as t(d)
      where not (p_need -> 'documents') ? d) as missing
  ),
  a as (select private.capital_affordable_cents(p_need, p_i) as affordable)
  select jsonb_build_array(
    jsonb_build_object(
      'gate', 'geography',
      'passed', jsonb_array_length(p_i -> 'eligible_uf') = 0 or (p_i -> 'eligible_uf') ? (p_need ->> 'uf'),
      'reason', 'REGION_NOT_ELIGIBLE', 'value', p_need -> 'uf', 'limit', p_i -> 'eligible_uf'),
    -- The ticket floor is a real refusal; the ceiling only caps what it takes.
    jsonb_build_object(
      'gate', 'ticket',
      'passed', least((p_need ->> 'amount_cents')::bigint, (p_i ->> 'ticket_max_cents')::bigint)
                >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'TICKET_OUTSIDE_POOL_POLICY', 'value', p_need -> 'amount_cents',
      'limit', jsonb_build_array((p_i ->> 'ticket_min_cents')::bigint, (p_i ->> 'ticket_max_cents')::bigint)),
    jsonb_build_object(
      'gate', 'purpose',
      'passed', jsonb_array_length(p_i -> 'purposes') = 0 or (p_i -> 'purposes') ? (p_need ->> 'purpose'),
      'reason', 'PURPOSE_OUTSIDE_POOL_MANDATE', 'value', p_need -> 'purpose', 'limit', p_i -> 'purposes'),
    jsonb_build_object(
      'gate', 'business_age',
      'passed', (p_need ->> 'business_age_months')::integer >= (p_i ->> 'business_age_min_months')::integer,
      'reason', 'BUSINESS_TOO_YOUNG', 'value', p_need -> 'business_age_months',
      'limit', p_i -> 'business_age_min_months'),
    jsonb_build_object(
      'gate', 'documents',
      'passed', cardinality(m.missing) = 0,
      'reason', 'INSUFFICIENT_DOCUMENTATION', 'value', array_to_string(m.missing, ','),
      'limit', p_i -> 'required_documents'),
    jsonb_build_object(
      'gate', 'affordability',
      'passed', a.affordable >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'AFFORDABILITY_LIMIT', 'value', p_need -> 'max_instalment_cents', 'limit', a.affordable),
    jsonb_build_object(
      'gate', 'capacity',
      'passed', (p_i ->> 'capacity_cents')::bigint >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'PARTNER_CAPACITY_EXHAUSTED', 'value', p_i -> 'ticket_min_cents',
      'limit', p_i -> 'capacity_cents')
  )
  from m, a
$$;

-- How well an eligible instrument fits, term by term, each 0-100. fitOf().
create function private.capital_fit(p_need jsonb, p_i jsonb, p_takeable bigint)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    -- Naming the purpose beats funding anything.
    'purpose', case when (p_i -> 'purposes') ? (p_need ->> 'purpose') then 100 else 60 end,
    'amount_coverage', private.capital_clamp(p_takeable * 100.0 / (p_need ->> 'amount_cents')::bigint),
    -- A route with no cost of capital — an exchange, a grant — scores full.
    'cost', case when p_i ->> 'estimated_cost_bps' is null then 100
            else private.capital_clamp(100 - floor((p_i ->> 'estimated_cost_bps')::integer * 100.0
                                                   / private.capital_cost_ceiling_bps())) end,
    'availability', private.capital_clamp(
      least((p_i ->> 'capacity_cents')::bigint, (p_need ->> 'amount_cents')::bigint) * 100.0
      / (p_need ->> 'amount_cents')::bigint),
    'geography', case when (p_i -> 'eligible_uf') ? (p_need ->> 'uf') then 100 else 70 end,
    'mandate', case when (p_i ->> 'impact_mandate')::boolean and (p_need ->> 'impact_eligible')::boolean
               then 100 else 50 end,
    -- Friction she would meet: another approval, and papers to find.
    'operational', private.capital_clamp(
      100 - case when (p_i ->> 'requires_partner_approval')::boolean then 20 else 0 end
          - jsonb_array_length(p_i -> 'required_documents') * 10)
  )
$$;

create function private.capital_fit_score(p_fit jsonb)
returns integer
language sql immutable set search_path = ''
as $$
  select floor(sum((p_fit ->> k.key)::integer * (k.value)::integer) / 100.0)::integer
  from jsonb_each_text(private.capital_fit_weights()) as k(key, value)
$$;

-- One instrument's whole answer for one need. assess().
create function private.capital_assess(p_need jsonb, p_i jsonb)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_gates jsonb := private.capital_gates(p_need, p_i);
  v_blocks text[];
  v_ok boolean;
  v_takeable bigint;
  v_fit jsonb;
begin
  v_blocks := array(
    select g ->> 'reason' from jsonb_array_elements(v_gates) as t(g) where not (g ->> 'passed')::boolean);
  v_ok := cardinality(v_blocks) = 0;
  v_takeable := greatest(0, least(
    (p_need ->> 'amount_cents')::bigint,
    (p_i ->> 'ticket_max_cents')::bigint,
    private.capital_affordable_cents(p_need, p_i),
    (p_i ->> 'capacity_cents')::bigint));
  v_fit := private.capital_fit(p_need, p_i, v_takeable);
  return jsonb_build_object(
    'instrument_id', p_i -> 'id',
    'eligible', v_ok,
    'gates', v_gates,
    'blocks', to_jsonb(v_blocks),
    'max_takeable_cents', case when v_ok then v_takeable else 0 end,
    'fit_score', case when v_ok then private.capital_fit_score(v_fit) else 0 end,
    'fit', v_fit);
end;
$$;

-- Why this instrument earned its place in the stack. reasonsFor().
create function private.capital_route_reasons(p_need jsonb, p_i jsonb, p_cheapest boolean)
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
    case when not (p_i ->> 'is_domestic')::boolean then 'GLOBAL_EXPANDS_CAPACITY' end,
    case when not (p_i ->> 'is_domestic')::boolean and (p_i ->> 'impact_mandate')::boolean
              and (p_need ->> 'impact_eligible')::boolean then 'GLOBAL_IMPACT_MANDATE_MATCH' end
  ], null))
$$;

-- packages/capital-allocation matchCapital(), in SQL. Instruments as jsonb in
-- the package's Instrument shape, the need in its CapitalNeed shape, the result
-- in its CapitalPlan shape.
--
-- Domestic first, global for the residual. The global route is not a competitor
-- to local products; it exists for the demand local capacity cannot absorb. So
-- the External Capital Gap is measured after the domestic pass and before
-- global money can hide it — which is what makes it worth showing.
create function private.match_capital(p_need jsonb, p_instruments jsonb)
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
      v_take := least((a ->> 'max_takeable_cents')::bigint, v_left);
      -- A route that cannot reach its own floor is not a route for this slice.
      continue when v_take < (i ->> 'ticket_min_cents')::bigint;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
        'instrument_id', i -> 'id',
        'amount_cents', v_take,
        'fit_score', (a ->> 'fit_score')::integer,
        'reasons', to_jsonb(private.capital_route_reasons(
          p_need, i, coalesce((i ->> 'estimated_cost_bps')::integer, 0) = v_low)),
        'requires_partner_approval', (i ->> 'requires_partner_approval')::boolean,
        'is_credit', (i ->> 'is_credit')::boolean));
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

-- --------------------------------------------------------------- her side of it

-- The need, assembled from what the product already knows. There is no
-- capital_needs table (PLAN_CAPITAL_NETWORK §3.1): nine of the addendum's
-- eleven fields are columns on the opportunity or on the eligibility assessment
-- it points at, and duplicating them would immediately raise the question of
-- which copy the partner pipeline and the loan hang off.
create function private.capital_need(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'amount_cents', o.amount_cents,
    'term_months', o.term_months,
    'purpose', o.purpose::text,
    'uf', coalesce(e.state, ''),
    -- No incorporation date is recorded anywhere in this product, so the age of
    -- the business is the span of the history she has actually reported: her
    -- first check-in to this month, inclusive. A proxy, and named as one
    -- wherever it is shown.
    'business_age_months', coalesce((
      select (substr(private.current_period(), 1, 4)::integer * 12 + substr(private.current_period(), 6, 2)::integer)
             - min(substr(c.period, 1, 4)::integer * 12 + substr(c.period, 6, 2)::integer) + 1
      from public.checkins c where c.entrepreneur_id = o.entrepreneur_id), 0),
    'documents', to_jsonb(o.documents_on_file),
    'max_instalment_cents', el.max_instalment_cents,
    -- Women-led, in a verified community: the impact mandate's test, as the
    -- pool engine already asks it.
    'impact_eligible', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = o.entrepreneur_id and c.status = 'verified'),
    -- Gate 1, recorded rather than assumed: the opportunity exists because
    -- eligibility passed, and the trace should say so rather than imply it.
    'readiness_ok', el.decision = 'ELIGIBLE',
    'manual_review_allowed', false)
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments el on el.id = o.eligibility_id
  join public.entrepreneurs e on e.id = o.entrepreneur_id
  where o.id = p_opportunity_id
$$;

-- ------------------------------------------------------ the network's side of it

-- Every active instrument in the engine's shape. The two P2P routes read their
-- ticket range, purposes, mandate and capacity from funding_pools, and their
-- cost from the engine that already prices them, so the network and the
-- Investor Console can never disagree about a pool.
create function private.capital_network_instruments(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with o as (
    select q.amount_cents, q.term_months, q.risk_band, q.purpose,
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
  -- A pool's all-in annual cost for *this* opportunity, from the engine that
  -- already decides it. Never restated here: one answer, in one place.
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
  left join pools pl on pl.pool = i.pool
  left join pool_cost pc on pc.pool = i.pool
  where i.active and pr.active
    and i.effective_from <= current_date
    and (i.effective_to is null or i.effective_to >= current_date)
$$;

-- ---------------------------------------------------------- the operator's button

-- Explicit, idempotent, versioned. Nothing calls this on her behalf: a person
-- with a reason to ask presses it, and the run is recorded with the inputs it
-- was made against.
create function public.run_capital_engine(p_opportunity_id uuid, p_documents text[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text := coalesce((select private.my_role()::text), '');
  v_opp public.qualified_credit_opportunities;
  v_need jsonb;
  v_plan jsonb;
  v_last public.capital_route_decisions;
  v_found boolean;
  v_id uuid;
  v_no integer;
begin
  if not private.capital_network_enabled() then
    raise exception 'capital_network_disabled' using errcode = 'P0001';
  end if;
  -- Routing capital is an operator act. Reading the registry is wider than
  -- this: sponsors and auditors see it, and neither runs the engine.
  if v_role not in ('capital_provider', 'admin') then
    raise exception 'not_a_capital_operator' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  -- The network recommends third-party products, so it needs the consent scope
  -- that allows a partner to be involved at all.
  if not private.has_consent(v_opp.entrepreneur_id, 'partner') then
    raise exception 'partner_consent_missing' using errcode = '42501';
  end if;

  if p_documents is not null then
    update public.qualified_credit_opportunities
      set documents_on_file = p_documents where id = p_opportunity_id;
  end if;

  v_need := private.capital_need(p_opportunity_id);
  v_plan := private.match_capital(v_need, private.capital_network_instruments(p_opportunity_id));

  -- Idempotent: the same engine, over the same need, reaching the same answer,
  -- is the same decision. A second run records a row only when something moved.
  select * into v_last from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  v_found := found;
  if v_found
     and v_last.engine_version = v_plan ->> 'model_version'
     and v_last.need = v_need
     and v_last.evaluated = v_plan -> 'evaluated'
     and v_last.allocations = v_plan -> 'allocations' then
    return jsonb_build_object('decision_id', v_last.id, 'decision_no', v_last.decision_no,
                              'recorded', false, 'plan', v_plan);
  end if;

  v_no := case when v_found then v_last.decision_no + 1 else 1 end;
  insert into public.capital_route_decisions (
    opportunity_id, decision_no, engine_version, requested_cents, need, evaluated, allocations,
    reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status, is_simulated)
  values (
    p_opportunity_id, v_no, v_plan ->> 'model_version', (v_plan ->> 'requested_cents')::bigint,
    v_need, v_plan -> 'evaluated', v_plan -> 'allocations',
    array(select jsonb_array_elements_text(v_plan -> 'reason_codes')),
    (v_plan ->> 'domestic_coverage_cents')::bigint,
    (v_plan ->> 'global_coverage_cents')::bigint,
    (v_plan ->> 'unfunded_cents')::bigint,
    (v_plan ->> 'status')::public.capital_route_status,
    -- Every instrument in this network is invented for the prototype, so every
    -- plan built out of it is simulated too.
    true)
  returning id into v_id;
  return jsonb_build_object('decision_id', v_id, 'decision_no', v_no, 'recorded', true, 'plan', v_plan);
end;
$$;

-- ---------------------------------------------------------------------- grants

revoke all on function
  private.capital_fit_weights(), private.capital_cost_ceiling_bps(), private.capital_reason_order(),
  private.capital_reasons_ordered(text[]), private.capital_clamp(numeric),
  private.capital_affordable_cents(jsonb, jsonb), private.capital_gates(jsonb, jsonb),
  private.capital_fit(jsonb, jsonb, bigint), private.capital_fit_score(jsonb),
  private.capital_assess(jsonb, jsonb), private.capital_route_reasons(jsonb, jsonb, boolean),
  private.match_capital(jsonb, jsonb), private.capital_need(uuid),
  private.capital_network_instruments(uuid)
  from public, anon, authenticated;
grant execute on function
  private.capital_fit_weights(), private.capital_cost_ceiling_bps(), private.capital_reason_order(),
  private.capital_reasons_ordered(text[]), private.capital_clamp(numeric),
  private.capital_affordable_cents(jsonb, jsonb), private.capital_gates(jsonb, jsonb),
  private.capital_fit(jsonb, jsonb, bigint), private.capital_fit_score(jsonb),
  private.capital_assess(jsonb, jsonb), private.capital_route_reasons(jsonb, jsonb, boolean),
  private.match_capital(jsonb, jsonb), private.capital_need(uuid),
  private.capital_network_instruments(uuid)
  to service_role;

revoke all on function public.run_capital_engine(uuid, text[]) from public, anon;
grant execute on function public.run_capital_engine(uuid, text[]) to authenticated, service_role;
