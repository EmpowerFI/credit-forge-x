-- The Global Capital Provider profile (addendum v2 §6), on the tables that
-- already hold a provider's policy.
--
-- v2 asks for a fund profile: domicile, deployment currency, target population,
-- duration constraints, reporting requirements, KYC/KYB metadata, required
-- return. v1 already built the home for most of it — capital_providers holds who
-- a provider is, capital_instruments holds what it will fund, with column-level
-- grants protecting what an operator may not change. So this adds the fields v1
-- lacks, to whichever of the two tables the field is a fact about, and leaves
-- investor_mandates alone: that is one investor account's filter for the
-- Investor Console, a different question with a different owner
-- (PLAN_CAPITAL_NETWORK_V2 §3.3).
--
-- Two deviations from the plan, both stated rather than quiet:
--
--   No "required-return ceiling". A fund states the return it requires, and this
--   records it. A second ceiling beside private.capital_cost_ceiling_bps() would
--   be two ceilings with no stated precedence, and the engine already refuses a
--   route whose all-in cost to her passes the one ceiling there is.
--
--   No deployment currency on the provider. capital_instruments.currency already
--   says what a route is denominated in, and a provider-level copy would be the
--   second place to look when they disagreed.
--
-- And one thing the day added that the plan did not ask for: the duration
-- constraint is a *gate*, not a column. A term range the engine never reads
-- would be decoration on a screen, so private.capital_gates() asks it and
-- packages/capital-allocation asks it identically.

-- ------------------------------------------------------- who the provider is

alter table public.capital_providers
  -- ISO 3166-1 alpha-2. Where the money is domiciled decides which rules reach
  -- it, and a fund that will not say is a fund we cannot place.
  add column domicile text check (domicile ~ '^[A-Z]{2}$'),
  -- What the fund asks for its capital, before expected loss, cost to serve and
  -- the cost of moving it. Null where a provider states none.
  add column required_return_bps integer check (required_return_bps between 0 and 10000),
  -- What it will want back, as codes rather than prose, so a screen can list
  -- them and counsel can be asked about each.
  add column reporting_requirements text[] not null default '{}',
  -- Who checked the counterparty, when, and against what. Simulated in this
  -- prototype, and the object says so rather than a screen implying otherwise.
  add column kyb jsonb not null default '{}'::jsonb;

comment on column public.capital_providers.required_return_bps is
  'What the provider asks for its capital, a year, in basis points. Not her rate: the engine adds expected loss, cost to serve and the cost of moving the money on top.';

comment on column public.capital_providers.kyb is
  'Counterparty checks: {status, verified_at, reference, note}. Simulated throughout this prototype.';

-- ---------------------------------------------------- what it will fund

alter table public.capital_instruments
  -- §6's target population, as codes the impact mandate already speaks in.
  add column target_population text[] not null default '{}',
  -- §6's duration constraints. Null at either end means no restriction stated,
  -- which is not the same as any term.
  add column term_min_months smallint check (term_min_months between 1 and 240),
  add column term_max_months smallint check (term_max_months between 1 and 240),
  add constraint instrument_term_range
    check (term_max_months is null or term_min_months is null or term_max_months >= term_min_months);

-- --------------------------------------------------------------- the gate

-- One more gate in the same shape, asked after purpose and before the papers:
-- a fund that funds twelve months does not fund three, and the trace has to say
-- so in her language rather than leaving the route silently unranked.
create or replace function private.capital_gates(p_need jsonb, p_i jsonb)
returns jsonb
language sql immutable set search_path = ''
as $$
  with m as (
    select array(
      select d from jsonb_array_elements_text(p_i -> 'required_documents') as r(d)
      where not (p_need -> 'documents' ? d)) as missing
  ),
  a as (select private.capital_affordable_cents(p_need, p_i) as affordable)
  select jsonb_build_array(
    jsonb_build_object('gate', 'geography',
      'passed', jsonb_array_length(p_i -> 'eligible_uf') = 0 or (p_i -> 'eligible_uf') ? (p_need ->> 'uf'),
      'reason', 'REGION_NOT_ELIGIBLE', 'value', p_need ->> 'uf', 'limit', p_i -> 'eligible_uf'),
    -- The ticket floor is a real refusal; the ceiling only caps what it takes.
    jsonb_build_object('gate', 'ticket',
      'passed', least((p_need ->> 'amount_cents')::bigint, (p_i ->> 'ticket_max_cents')::bigint)
                >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'TICKET_OUTSIDE_POOL_POLICY', 'value', (p_need ->> 'amount_cents')::bigint,
      'limit', jsonb_build_array((p_i ->> 'ticket_min_cents')::bigint, (p_i ->> 'ticket_max_cents')::bigint)),
    jsonb_build_object('gate', 'purpose',
      'passed', jsonb_array_length(p_i -> 'purposes') = 0 or (p_i -> 'purposes') ? (p_need ->> 'purpose'),
      'reason', 'PURPOSE_OUTSIDE_POOL_MANDATE', 'value', p_need ->> 'purpose', 'limit', p_i -> 'purposes'),
    jsonb_build_object('gate', 'term',
      'passed', ((p_i ->> 'term_min_months') is null
                 or (p_need ->> 'term_months')::integer >= (p_i ->> 'term_min_months')::integer)
            and ((p_i ->> 'term_max_months') is null
                 or (p_need ->> 'term_months')::integer <= (p_i ->> 'term_max_months')::integer),
      'reason', 'TERM_OUTSIDE_POLICY', 'value', (p_need ->> 'term_months')::integer,
      'limit', jsonb_build_array(p_i -> 'term_min_months', p_i -> 'term_max_months')),
    jsonb_build_object('gate', 'business_age',
      'passed', (p_need ->> 'business_age_months')::integer >= (p_i ->> 'business_age_min_months')::integer,
      'reason', 'BUSINESS_TOO_YOUNG', 'value', (p_need ->> 'business_age_months')::integer,
      'limit', (p_i ->> 'business_age_min_months')::integer),
    jsonb_build_object('gate', 'documents',
      'passed', cardinality((select missing from m)) = 0,
      'reason', 'INSUFFICIENT_DOCUMENTATION',
      'value', array_to_string((select missing from m), ','), 'limit', p_i -> 'required_documents'),
    jsonb_build_object('gate', 'affordability',
      'passed', (select affordable from a) >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'AFFORDABILITY_LIMIT', 'value', (p_need ->> 'max_instalment_cents')::bigint,
      'limit', (select affordable from a)),
    jsonb_build_object('gate', 'capacity',
      'passed', (p_i ->> 'capacity_cents')::bigint >= (p_i ->> 'ticket_min_cents')::bigint,
      'reason', 'PARTNER_CAPACITY_EXHAUSTED', 'value', (p_i ->> 'ticket_min_cents')::bigint,
      'limit', (p_i ->> 'capacity_cents')::bigint))
$$;

-- The new refusal takes its place in the one order both engines read.
create or replace function private.capital_reason_order()
returns text[] language sql immutable set search_path = ''
as $$ select array[
  'DOMESTIC_COVERAGE_SUFFICIENT', 'DOMESTIC_CAPACITY_PARTIAL', 'DOMESTIC_POOL_EXHAUSTED',
  'PURPOSE_MATCH', 'CLOSED_NETWORK_PURPOSE_MATCH', 'SPONSORED_PROGRAM_MATCH', 'TICKET_MATCH',
  'REGION_MATCH', 'PARTNER_CAPACITY_AVAILABLE', 'LOWER_ESTIMATED_COST', 'GLOBAL_EXPANDS_CAPACITY',
  'GLOBAL_IMPACT_MANDATE_MATCH', 'AFFORDABILITY_LIMIT', 'TICKET_OUTSIDE_POOL_POLICY',
  'PURPOSE_OUTSIDE_POOL_MANDATE', 'TERM_OUTSIDE_POLICY', 'REGION_NOT_ELIGIBLE', 'BUSINESS_TOO_YOUNG',
  'INSUFFICIENT_DOCUMENTATION', 'PARTNER_CAPACITY_EXHAUSTED', 'MANUAL_REVIEW_REQUIRED',
  'NO_ROUTE_AVAILABLE'] $$;

-- And the engine's instrument shape carries the two new bounds.
create or replace function private.capital_network_instruments(p_opportunity_id uuid)
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
  left join pools pl on pl.pool = i.pool
  left join pool_cost pc on pc.pool = i.pool
  where i.active and pr.active
    and i.effective_from <= current_date
    and (i.effective_to is null or i.effective_to >= current_date)
$$;

-- --------------------------------------------------------- the invented fund

-- Invented, and simulated, as every provider in v1 is. A real fund is named on
-- a screen only once it has consented, which is the rule the advisory board
-- follows too (PLAN_CAPITAL_NETWORK_V2 §6.1, decision 1).
insert into public.capital_providers (
  code, display_name, legal_name, provider_type, coverage_uf, coverage_note,
  domicile, required_return_bps, reporting_requirements, kyb, commercial_model, is_simulated
) values (
  'fundo_impacto_global_demo',
  'Fundo de impacto global (demonstração)',
  null,
  'impact_fund',
  '{}',
  'Capital internacional com mandato de impacto. Provedor inventado para o protótipo.',
  'NL',
  600,
  '{quarterly_impact_report, annual_audited_accounts, borrower_level_anonymised}',
  jsonb_build_object(
    'status', 'simulated',
    'verified_at', null,
    'reference', null,
    'note', 'Nenhuma verificação real foi feita: o fundo é inventado e existe para demonstrar a política, não a contraparte.'),
  jsonb_build_object('model', 'no_fee', 'note', 'informational only'),
  true
);

-- What it will fund: bigger tickets than the domestic routes reach, a term range
-- it will not go outside, and a population its mandate names.
insert into public.capital_instruments (
  provider_id, code, name, instrument_type, currency,
  ticket_min_cents, ticket_max_cents, eligible_uf, purposes,
  term_min_months, term_max_months, business_age_min_months, required_documents,
  target_population, max_instalment_share_bps, estimated_cost_bps, capacity_cents,
  impact_mandate, is_domestic, is_global, requires_partner_approval, is_credit, is_simulated
)
select pr.id, 'capital_impacto_global', 'Capital de impacto internacional', 'impact_fund_capital', 'BRL',
  100000, 5000000, '{}', '{}',
  6, 36, 6, '{cnpj_or_mei, bank_statement_3m}',
  '{women_led, verified_community}', 5000, 3600, 2000000000,
  true, false, true, true, true, true
from public.capital_providers pr where pr.code = 'fundo_impacto_global_demo';

-- ------------------------------------------- what an operator may still change

-- The two new policy fields join the grant v1 wrote. Everything about the
-- counterparty — its domicile, its checks, what it requires back — stays with a
-- migration: capital_providers has no update grant at all, and a fund's identity
-- is not a commercial term an operator negotiates at a desk.
grant update (
  target_population, term_min_months, term_max_months
) on public.capital_instruments to authenticated;
