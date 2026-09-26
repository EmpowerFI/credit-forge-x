-- The Capital Network: a business needs capital, and a loan is one of the
-- answers, not the answer (addendum §2).
--
-- Until now the Capital Allocation Engine asked one question — domestic pool or
-- global pool? — and both answers were a loan funded by investors. A business
-- that needs R$5,000 for stock and services may be better served by a regional
-- partner product for part of it, a microcredit line for another part, and a
-- productive exchange inside a network for the rest. This migration is the
-- registry that makes those answers expressible.
--
-- Two things it deliberately does not do (PLAN_CAPITAL_NETWORK §3.2):
--
--   1. It does not touch funding_pools, funding_pool, funding_target_micro_usdc
--      or anything downstream of them. The two P2P pools become two instruments
--      in this network whose policy is *read from* funding_pools rather than
--      copied, so the engine and the Investor Console can never disagree about
--      how much a pool has left. Their route keeps writing exactly the columns
--      it writes today.
--   2. The instruments that are not pools never create an investment, never
--      mint a position and never touch loans. They produce a recommendation and
--      a status. Approval stays with whoever owns the product.
--
-- With private.capital_network_enabled() false, nothing here is read and every
-- allocation behaves exactly as it did before this migration.

create function private.capital_network_enabled()
returns boolean language sql immutable set search_path = ''
as $$ select true $$;

-- ------------------------------------------------------------------- the types

-- Descriptive, and deliberately not a legal conclusion (addendum §4.1). A
-- provider's regulated role, where it has one, is a fact about that provider
-- and not something this table decides.
create type public.capital_provider_type as enum (
  'credit_cooperative',
  'microcredit_operator',
  'commercial_partner',
  'community_network',
  'sponsor_programme',
  'p2p_pool',
  'other'
);

-- Addendum §5. The engine must never assume a route is a conventional loan.
create type public.capital_instrument_type as enum (
  'regional_credit_product',
  'microcredit',
  'commercial_credit',
  'productive_exchange_network',
  'sponsored_capital',
  'domestic_p2p',
  'global_impact_capital'
);

create type public.capital_route_status as enum ('recommended', 'manual_review', 'no_route');

create function private.capital_network_model_version()
returns text language sql immutable set search_path = ''
as $$ select 'capital-network-v1.0.0' $$;

-- --------------------------------------------------------------- the providers

create table public.capital_providers (
  id uuid primary key default gen_random_uuid(),
  -- A stable key, so a seed, a test and a demo script can name the same row.
  code text not null unique check (code ~ '^[a-z0-9_]{3,40}$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  legal_name text check (char_length(legal_name) <= 200),
  provider_type public.capital_provider_type not null,
  -- Where it operates. Empty means "no stated restriction", not "everywhere".
  coverage_uf text[] not null default '{}',
  coverage_note text check (char_length(coverage_note) <= 200),
  -- Set only where this provider is also the regulated counterparty that
  -- approves credit. A community exchange network is not one, and saying so in
  -- the schema is cheaper than saying it in every screen.
  partner_id uuid references public.partners (id),
  -- Referral fee, success fee, platform fee or none. Informational: nothing in
  -- this prototype bills anything, and every arrangement needs its own
  -- validation before it could (addendum §12).
  commercial_model jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  is_simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- the instruments

create table public.capital_instruments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.capital_providers (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9_]{3,40}$'),
  name text not null check (char_length(name) between 2 and 140),
  instrument_type public.capital_instrument_type not null,
  -- The pool whose policy this instrument *is*. Set for the two P2P routes and
  -- null for everything else; where it is set, ticket, purposes, bands and
  -- capacity are read from funding_pools and must not be duplicated here.
  pool public.funding_pool references public.funding_pools (pool),
  -- 'unit' is for a route whose unit of account is not money at all.
  currency text not null default 'BRL' check (currency in ('BRL', 'USDC', 'unit')),
  ticket_min_cents bigint check (ticket_min_cents > 0),
  ticket_max_cents bigint,
  -- Empty means no stated geographic restriction.
  eligible_uf text[] not null default '{}',
  -- Empty funds any productive purpose.
  purposes public.credit_purpose[] not null default '{}',
  business_age_min_months smallint not null default 0 check (business_age_min_months between 0 and 240),
  required_documents text[] not null default '{}',
  -- The share of her affordable instalment this route may take. Null where the
  -- route has no repayment, which is also the only case the affordability gate
  -- is allowed to skip.
  max_instalment_share_bps integer check (max_instalment_share_bps between 1 and 10000),
  -- Her all-in annual cost through this route, where the provider states one.
  estimated_cost_bps integer check (estimated_cost_bps between 0 and 100000),
  -- Accepted merchants, suppliers or closed-loop rules, where the route has them.
  closed_network_rules jsonb not null default '{}'::jsonb,
  capacity_cents bigint check (capacity_cents >= 0),
  impact_mandate boolean not null default false,
  is_domestic boolean not null default true,
  is_global boolean not null default false,
  -- Whether the route's owner still has to say yes. True for every partner
  -- product: a match is never an approval (addendum §16.8).
  requires_partner_approval boolean not null default true,
  -- False for a route that must never be described as a loan, as credit or as
  -- currency unless a concrete legal structure supports the word (§12). The UI
  -- reads this, so the guardrail cannot be forgotten in a translation.
  is_credit boolean not null default true,
  active boolean not null default true,
  policy_version integer not null default 1 check (policy_version > 0),
  effective_from date not null default current_date,
  effective_to date,
  is_simulated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instrument_ticket_range check (ticket_max_cents is null or ticket_min_cents is null or ticket_max_cents >= ticket_min_cents),
  constraint instrument_effective_range check (effective_to is null or effective_to >= effective_from),
  -- A pool-backed instrument reads its policy from funding_pools; anything else
  -- has to state its own ticket range and capacity.
  constraint pool_is_a_p2p_route check (
    (pool is null) = (instrument_type not in ('domestic_p2p', 'global_impact_capital'))
  ),
  constraint pool_policy_lives_in_funding_pools check (
    pool is null or (ticket_min_cents is null and ticket_max_cents is null and capacity_cents is null)
  ),
  constraint own_policy_is_complete check (
    pool is not null or (ticket_min_cents is not null and ticket_max_cents is not null and capacity_cents is not null)
  ),
  constraint global_is_not_domestic check (is_global <> is_domestic)
);

create index capital_instruments_active on public.capital_instruments (instrument_type)
  where active and effective_to is null;

-- ---------------------------------------------------------------- the decision

-- One run of the engine over one qualified opportunity: every instrument it
-- considered, what it recommends, and the gap it could not close. Versioned and
-- kept, so a recommendation can be reproduced from the engine and policy
-- versions that produced it (addendum §14).
create table public.capital_route_decisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.qualified_credit_opportunities (id) on delete cascade,
  decision_no integer not null check (decision_no > 0),
  engine_version text not null,
  decided_at timestamptz not null default now(),
  requested_cents bigint not null check (requested_cents > 0),
  -- Every instrument evaluated, with each gate's result and both sides of the
  -- comparison: the trace a person can read, in the shape poolChecks() uses.
  evaluated jsonb not null,
  -- The recommended stack: instrument, amount, fit score and its reasons. More
  -- than one entry is the point of this table.
  allocations jsonb not null,
  reason_codes text[] not null,
  covered_cents bigint not null check (covered_cents >= 0),
  domestic_coverage_cents bigint not null check (domestic_coverage_cents >= 0),
  external_capital_gap_cents bigint not null check (external_capital_gap_cents >= 0),
  status public.capital_route_status not null,
  -- sha-256 of the canonical decision, for the chain anchor added in P0 day 5.
  snapshot_hash text check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  is_simulated boolean not null default true,
  unique (opportunity_id, decision_no),
  constraint coverage_adds_up check (covered_cents + external_capital_gap_cents = requested_cents),
  constraint domestic_is_part_of_covered check (domestic_coverage_cents <= covered_cents),
  constraint a_route_or_a_reason check (status <> 'recommended' or jsonb_array_length(allocations) > 0)
);

-- ------------------------------------------------- what the opportunity gained

-- The two fields of addendum §4.3 that the qualified opportunity did not
-- already carry. The other nine are columns it has, or columns on the
-- eligibility assessment it points at.
alter table public.qualified_credit_opportunities
  add column desired_date date,
  add column urgency text check (urgency in ('routine', 'soon', 'urgent'));

-- ----------------------------------------------------------------------- RLS

alter table public.capital_providers enable row level security;
alter table public.capital_instruments enable row level security;
alter table public.capital_route_decisions enable row level security;
revoke all on public.capital_providers, public.capital_instruments, public.capital_route_decisions from anon, authenticated;
grant select on public.capital_providers, public.capital_instruments, public.capital_route_decisions to authenticated;

-- The registry is capital policy: read by the people who route capital and
-- audit it. Never by an entrepreneur — she is shown the routes recommended for
-- her, not the policies of every provider in the network.
create policy capital_providers_read on public.capital_providers for select to authenticated using (
  coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider', 'auditor', 'admin')
);
create policy capital_instruments_read on public.capital_instruments for select to authenticated using (
  coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider', 'auditor', 'admin')
);

-- A decision follows its opportunity: she sees her own plan, her community
-- leader sees it, the partner it was referred to sees it, oversight sees all.
create policy capital_route_decisions_read on public.capital_route_decisions for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or exists (
    select 1 from public.qualified_credit_opportunities o
    where o.id = opportunity_id
      and (o.entrepreneur_id = (select private.my_entrepreneur_id())
           or (select private.leads_entrepreneur(o.entrepreneur_id)))
  )
);

revoke all on function private.capital_network_enabled(), private.capital_network_model_version() from public, anon, authenticated;
grant execute on function private.capital_network_enabled(), private.capital_network_model_version() to service_role;

-- ---------------------------------------------------------------- demo network

-- Four providers and five instruments, every one of them invented for the
-- prototype and marked as such. No real institution is named here: a partner
-- appears in this product only after it has agreed to, and the addendum's own
-- §17 calls the partner-interest signal untested.
insert into public.capital_providers (code, display_name, provider_type, coverage_uf, coverage_note, commercial_model, is_simulated) values
  ('coop_regional_demo', 'Cooperativa regional (demonstração)', 'credit_cooperative', '{SP}',
   'Interior de São Paulo', '{"model": "referral_fee", "note": "informational only"}'::jsonb, true),
  ('microcredito_demo', 'Operadora de microcrédito (demonstração)', 'microcredit_operator', '{SP,MG}',
   null, '{"model": "success_fee", "note": "informational only"}'::jsonb, true),
  ('rede_troca_demo', 'Rede de troca produtiva (demonstração)', 'community_network', '{SP}',
   'Rede local de fornecedores e serviços', '{"model": "no_fee"}'::jsonb, true),
  ('empowerfi_pools', 'EmpowerFI · pools P2P (protótipo)', 'p2p_pool', '{}',
   null, '{"model": "no_fee"}'::jsonb, true);

insert into public.capital_instruments (
  provider_id, code, name, instrument_type, pool, currency,
  ticket_min_cents, ticket_max_cents, eligible_uf, purposes, business_age_min_months,
  required_documents, max_instalment_share_bps, estimated_cost_bps, closed_network_rules,
  capacity_cents, impact_mandate, is_domestic, is_global, requires_partner_approval, is_credit, is_simulated
)
select p.id, v.code, v.name, v.instrument_type, v.pool, v.currency,
       v.ticket_min_cents, v.ticket_max_cents, v.eligible_uf, v.purposes, v.business_age_min_months,
       v.required_documents, v.max_instalment_share_bps, v.estimated_cost_bps, v.closed_network_rules,
       v.capacity_cents, v.impact_mandate, v.is_domestic, v.is_global, v.requires_partner_approval, v.is_credit, true
from (values
  -- A regional product for stock and working capital, mid-sized tickets.
  ('coop_regional_demo', 'credito_regional_capital_giro', 'Crédito produtivo regional · capital de giro',
   'regional_credit_product'::public.capital_instrument_type, null::public.funding_pool, 'BRL',
   100000::bigint, 1500000::bigint, '{SP}'::text[], '{working_capital,inventory}'::public.credit_purpose[], 6::smallint,
   '{cnpj_or_mei,bank_statement_3m}'::text[], 6000, 4800, '{}'::jsonb,
   4000000::bigint, false, true, false, true, true),
  -- Small tickets, equipment included, no minimum trading history.
  ('microcredito_demo', 'microcredito_produtivo', 'Microcrédito produtivo orientado',
   'microcredit'::public.capital_instrument_type, null, 'BRL',
   50000::bigint, 500000::bigint, '{SP,MG}'::text[], '{working_capital,inventory,equipment}'::public.credit_purpose[], 0::smallint,
   '{cpf,proof_of_activity}'::text[], 4000, 6600, '{}'::jsonb,
   1500000::bigint, true, true, false, true, true),
  -- Not credit. Goods and services inside a network, in its own unit of
  -- account, settled between members. Never to be called a loan (§12).
  ('rede_troca_demo', 'troca_produtiva_rede', 'Troca produtiva em rede',
   'productive_exchange_network'::public.capital_instrument_type, null, 'unit',
   10000::bigint, 200000::bigint, '{SP}'::text[], '{working_capital,inventory}'::public.credit_purpose[], 0::smallint,
   '{network_membership}'::text[], null, null,
   '{"accepted": ["suppliers", "business_services"], "closed_loop": true}'::jsonb,
   600000::bigint, false, true, false, true, false),
  -- The two P2P routes. Their policy lives in funding_pools.
  ('empowerfi_pools', 'pool_domestico_p2p', 'Pool doméstico P2P · investidores brasileiros',
   'domestic_p2p'::public.capital_instrument_type, 'domestic'::public.funding_pool, 'BRL',
   null, null, '{}'::text[], '{}'::public.credit_purpose[], 0::smallint,
   '{}'::text[], null, null, '{}'::jsonb, null, false, true, false, false, true),
  ('empowerfi_pools', 'pool_global_impacto', 'Capital global de impacto · USDC na Solana',
   'global_impact_capital'::public.capital_instrument_type, 'global'::public.funding_pool, 'USDC',
   null, null, '{}'::text[], '{}'::public.credit_purpose[], 0::smallint,
   '{}'::text[], null, null, '{}'::jsonb, null, true, false, true, false, true)
) as v (provider_code, code, name, instrument_type, pool, currency,
        ticket_min_cents, ticket_max_cents, eligible_uf, purposes, business_age_min_months,
        required_documents, max_instalment_share_bps, estimated_cost_bps, closed_network_rules,
        capacity_cents, impact_mandate, is_domestic, is_global, requires_partner_approval, is_credit)
join public.capital_providers p on p.code = v.provider_code;
