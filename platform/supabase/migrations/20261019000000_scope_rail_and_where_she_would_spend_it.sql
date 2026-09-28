-- Where a route's capital reaches, how it reaches her, and where she would
-- spend it (addendum v3 §6).
--
-- Three facts the engine has been inferring or ignoring:
--
--   capital_scope       — a regional cooperative and a fund in Amsterdam are
--                         both "not the domestic pool", and the difference
--                         between them is what the v3 thesis is about. It stops
--                         being inferred from is_domestic.
--   settlement_rail     — how value actually reaches her. Four rails, and the
--                         one v3 turns on is the first: capital that arrives as
--                         local units and is spent inside a territory instead of
--                         leaving it the moment it lands.
--   supplier_geography  — where she would spend it. Asked because circulation is
--                         the whole claim: a need whose supplier is abroad
--                         circulates nowhere, and a multiplier shown for it
--                         would be measuring nothing.
--
-- And the six reason codes §6 names. All six are codes, not gates: a route is
-- not refused for want of a local rail, it pays her in reais and says so. That
-- keeps eligibility and every fit score exactly where they were, and confines
-- the change to what a plan explains about itself.
--
-- Mirrors packages/capital-allocation. The vectors carry both engines to one
-- answer, and scripts/regenerate-network-vectors.mts writes the pgTAP from the
-- same JSON the TypeScript tests read.

create type public.capital_scope as enum ('territorial', 'regional', 'national', 'global');
create type public.settlement_rail as enum ('local_currency', 'brl_pix', 'partner_card', 'usdc_solana');
create type public.supplier_geography as enum (
  'same_neighbourhood', 'municipality', 'state', 'other_brazil', 'international');

-- ------------------------------------------------------------ the registry

alter table public.capital_instruments
  add column capital_scope public.capital_scope not null default 'national',
  add column settlement_rail public.settlement_rail not null default 'brl_pix';

comment on column public.capital_instruments.capital_scope is
  'How far this route''s capital reaches (addendum v3 §6). Not derivable from is_domestic: a regional cooperative and a national line are both domestic.';
comment on column public.capital_instruments.settlement_rail is
  'How value reaches her from this route (addendum v3 §6).';

-- Setting a new field's first value is not a change of terms, so the policy
-- version does not move for it: a decision recorded last week was made under
-- exactly the terms it was made under, and bumping every route here would age
-- every stored plan for a column that did not exist when they ran. A later edit
-- to either field is a real change and does bump, because the trigger is only
-- suspended for this backfill.
alter table public.capital_instruments disable trigger capital_instrument_edited;

-- The demo network, told apart. The productive exchange is territorial and
-- settles on a partner's own instrument, not on the local rail: its unit of
-- account is not money and nobody repays it, and putting it on the rail that
-- carries capital she does repay would merge two different promises.
update public.capital_instruments set capital_scope = 'regional', settlement_rail = 'brl_pix'
  where code = 'credito_regional_capital_giro';
update public.capital_instruments set capital_scope = 'national', settlement_rail = 'brl_pix'
  where code = 'microcredito_produtivo';
update public.capital_instruments set capital_scope = 'territorial', settlement_rail = 'partner_card'
  where code = 'troca_produtiva_rede';
update public.capital_instruments set capital_scope = 'national', settlement_rail = 'local_currency'
  where code = 'pool_domestico_p2p';
update public.capital_instruments set capital_scope = 'global', settlement_rail = 'local_currency'
  where code = 'pool_global_impacto';
update public.capital_instruments set capital_scope = 'global', settlement_rail = 'local_currency'
  where code = 'capital_impacto_global';

alter table public.capital_instruments enable trigger capital_instrument_edited;

-- -------------------------------------------------------------- the need

-- Where she would spend it, stated with the request. Null where she was never
-- asked, which the engine reads as "other Brazil": the conservative answer, and
-- never as a local supplier match nobody confirmed.
alter table public.credit_intents
  add column supplier_geography public.supplier_geography;

comment on column public.credit_intents.supplier_geography is
  'Where the capital would be spent (addendum v3 §6). Null means unasked, and the engine assumes other_brazil rather than a local match.';

-- ------------------------------------------------------------ the engine

create or replace function private.capital_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'DOMESTIC_COVERAGE_SUFFICIENT', 'DOMESTIC_CAPACITY_PARTIAL', 'DOMESTIC_POOL_EXHAUSTED',
  'PURPOSE_MATCH', 'CLOSED_NETWORK_PURPOSE_MATCH', 'SPONSORED_PROGRAM_MATCH', 'TICKET_MATCH',
  'REGION_MATCH', 'PARTNER_CAPACITY_AVAILABLE', 'LOWER_ESTIMATED_COST',
  'AFFORDABILITY_BUDGET_SHARED', 'LOCAL_RAIL_ELIGIBLE', 'LOCAL_SUPPLIER_MATCH',
  'GLOBAL_EXPANDS_CAPACITY', 'GLOBAL_IMPACT_MANDATE_MATCH',
  'TERRITORIAL_CAPACITY_PARTIAL', 'EXTERNAL_GAP_EXISTS', 'GLOBAL_ADDITIONALITY',
  'AFFORDABILITY_LIMIT', 'TICKET_OUTSIDE_POOL_POLICY',
  'PURPOSE_OUTSIDE_POOL_MANDATE', 'TERM_OUTSIDE_POLICY', 'REGION_NOT_ELIGIBLE', 'BUSINESS_TOO_YOUNG',
  'INSUFFICIENT_DOCUMENTATION', 'PARTNER_CAPACITY_EXHAUSTED', 'LOCAL_RAIL_UNAVAILABLE',
  'MANUAL_REVIEW_REQUIRED', 'NO_ROUTE_AVAILABLE'] $$;

drop function if exists private.capital_route_reasons(jsonb, jsonb, boolean, boolean);
create function private.capital_route_reasons(
  p_need jsonb, p_i jsonb, p_cheapest boolean, p_budget_bound boolean, p_capacity_bound boolean
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
    -- The local rail, and what it takes to be more than a label: a territory
    -- that has one, and a supplier close enough that the units can be spent.
    case when p_i ->> 'settlement_rail' = 'local_currency' then
      case when (p_need ->> 'local_rail_available')::boolean
        then 'LOCAL_RAIL_ELIGIBLE' else 'LOCAL_RAIL_UNAVAILABLE' end end,
    case when p_i ->> 'settlement_rail' = 'local_currency'
              and (p_need ->> 'local_rail_available')::boolean
              and p_need ->> 'supplier_geography' in ('same_neighbourhood', 'municipality')
         then 'LOCAL_SUPPLIER_MATCH' end,
    -- Said of the scope rather than of the instrument: "the neighbourhood ran
    -- out" and "a national line ran out" are different facts about one shortfall.
    case when p_i ->> 'capital_scope' = 'territorial' and p_capacity_bound
         then 'TERRITORIAL_CAPACITY_PARTIAL' end,
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
  v_spent bigint := 0;
  v_bound boolean := false;
  v_cost integer;
  v_repays boolean;
  v_within bigint;
  v_ceiling bigint;
  v_trimmed boolean;
  -- It gave everything it had and there was still need: a shortfall of capacity
  -- rather than of her month, and they are told apart.
  v_capacity_bound boolean;
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

  if not (p_need ->> 'readiness_ok')::boolean and not (p_need ->> 'manual_review_allowed')::boolean then
    return jsonb_build_object(
      'model_version', private.capital_network_model_version(),
      'evaluated', v_evaluated, 'allocations', '[]'::jsonb,
      'reason_codes', jsonb_build_array('MANUAL_REVIEW_REQUIRED'),
      'requested_cents', v_amount, 'domestic_coverage_cents', 0, 'global_coverage_cents', 0,
      'unfunded_cents', v_amount, 'external_capital_gap_cents', v_amount, 'status', 'manual_review');
  end if;

  for v_pass in 1..2 loop
    v_left := v_amount - v_domestic;
    continue when v_left <= 0;
    select min(coalesce((ins.i ->> 'estimated_cost_bps')::integer, 0)) into v_low
      from jsonb_array_elements(v_evaluated) as e(a)
      join jsonb_array_elements(p_instruments) as ins(i) on ins.i ->> 'id' = e.a ->> 'instrument_id'
     where (e.a ->> 'eligible')::boolean
       and (ins.i ->> 'is_domestic')::boolean = (v_pass = 1);

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
      v_repays := (i ->> 'max_instalment_share_bps') is not null;
      v_within := case when v_repays
        then private.capital_principal_within_instalment(
               (p_need ->> 'max_instalment_cents')::bigint - v_spent, v_cost, v_term)
        else 9007199254740991 end;
      v_ceiling := least((a ->> 'max_takeable_cents')::bigint, v_left);
      v_take := least(v_ceiling, v_within);
      v_trimmed := v_repays and v_within < v_ceiling;
      if v_take < (i ->> 'ticket_min_cents')::bigint then
        if v_trimmed then v_bound := true; end if;
        continue;
      end if;
      if v_trimmed then v_bound := true; end if;
      v_capacity_bound := v_take >= (i ->> 'capacity_cents')::bigint and v_take < v_left;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
        'instrument_id', i -> 'id',
        'amount_cents', v_take,
        'fit_score', (a ->> 'fit_score')::integer,
        'reasons', to_jsonb(private.capital_route_reasons(p_need, i, v_cost = v_low, v_trimmed, v_capacity_bound)),
        'requires_partner_approval', (i ->> 'requires_partner_approval')::boolean,
        'is_credit', (i ->> 'is_credit')::boolean));
      if v_repays then
        v_spent := v_spent + private.capital_instalment_cents(v_take, v_cost, v_term);
      end if;
      v_left := v_left - v_take;
      if v_pass = 1 then v_domestic := v_domestic + v_take; else v_global := v_global + v_take; end if;
    end loop;
  end loop;

  v_gap := v_amount - v_domestic;

  if v_domestic >= v_amount then v_reasons := array_append(v_reasons, 'DOMESTIC_COVERAGE_SUFFICIENT');
  elsif v_domestic > 0 then v_reasons := array_append(v_reasons, 'DOMESTIC_CAPACITY_PARTIAL');
  else v_reasons := array_append(v_reasons, 'DOMESTIC_POOL_EXHAUSTED');
  end if;
  v_reasons := v_reasons || array(
    select r from jsonb_array_elements(v_allocations) as t(al),
                  jsonb_array_elements_text(t.al -> 'reasons') as u(r));
  if v_bound then v_reasons := array_append(v_reasons, 'AFFORDABILITY_BUDGET_SHARED'); end if;
  -- Two facts about the plan rather than about any one route (v3 §6, §8). The
  -- gap is stated before anyone asks who fills it, and additionality is claimed
  -- only where capital from abroad answered demand local capital had not.
  if v_gap > 0 then v_reasons := array_append(v_reasons, 'EXTERNAL_GAP_EXISTS'); end if;
  if v_global > 0 and v_domestic < v_amount then
    v_reasons := array_append(v_reasons, 'GLOBAL_ADDITIONALITY');
  end if;
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

-- --------------------------------------------------- what the engine is given

-- The two new instrument fields reach the engine, and the need carries where she
-- would spend it and whether her territory has a rail at all.
create or replace function private.capital_need(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'amount_cents', o.amount_cents,
    'term_months', o.term_months,
    'purpose', o.purpose::text,
    'uf', coalesce(e.state, ''),
    'business_age_months', coalesce((
      select (substr(private.current_period(), 1, 4)::integer * 12 + substr(private.current_period(), 6, 2)::integer)
             - min(substr(c.period, 1, 4)::integer * 12 + substr(c.period, 6, 2)::integer) + 1
      from public.checkins c where c.entrepreneur_id = o.entrepreneur_id), 0),
    'documents', to_jsonb(o.documents_on_file),
    'max_instalment_cents', el.max_instalment_cents,
    'impact_eligible', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = o.entrepreneur_id and c.status = 'verified'),
    -- Where she would spend it. Unasked is 'other_brazil', the conservative
    -- answer: never a local supplier match nobody confirmed.
    'supplier_geography', coalesce(ci.supplier_geography::text, 'other_brazil'),
    -- Whether her territory has a rail at all. A route that settles in local
    -- units where none exists is not refused; it pays her in reais and says so.
    'local_rail_available', exists (
      select 1 from public.local_economies le
      join public.community_memberships m on m.community_id = le.community_id
      where m.entrepreneur_id = o.entrepreneur_id),
    'readiness_ok', el.decision in ('ELIGIBLE', 'ELIGIBLE_REDUCED'),
    'manual_review_allowed', false)
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments el on el.id = o.eligibility_id
  join public.entrepreneurs e on e.id = o.entrepreneur_id
  left join public.credit_intents ci on ci.id = o.intent_id
  where o.id = p_opportunity_id
$$;

revoke all on function private.capital_route_reasons(jsonb, jsonb, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function private.capital_route_reasons(jsonb, jsonb, boolean, boolean, boolean)
  to service_role;

-- ------------------------------------------------- and the engine is told them

-- The registry's two new fields reach the engine. Everything else about this
-- function is the version 20261012000100 left, so the pool a request is offered
-- and the claim it adds back are untouched.

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
    'is_domestic', i.is_domestic,
    -- v3 §6. How far this route's capital reaches, and how it reaches her.
    'capital_scope', i.capital_scope::text,
    'settlement_rail', i.settlement_rail::text
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
