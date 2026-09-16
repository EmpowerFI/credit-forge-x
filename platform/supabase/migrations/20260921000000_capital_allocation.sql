-- The Capital Allocation Engine: two pools of P2P capital, and which one funds
-- each qualified opportunity.
--
--   Domestic P2P   Brazilian investors, a simulated BRL pool       → Pix
--   Global P2P     international investors, test USDC on devnet   → regulated off-ramp → Pix
--
-- When an opportunity opens to investors, private.allocate_funding chooses its
-- pool: feasibility first (risk appetite, ticket policy, mandate, liquidity),
-- economics second (her all-in cost a year). The same rules are
-- packages/capital-allocation, held to one answer by its vectors; the browser
-- re-runs them. The pool, the reason codes and the engine's figures are kept
-- on the opportunity. The committed opportunity payload does not change: its
-- proof covers the request, not where the capital comes from.
--
-- EmpowerFI runs the P2P desk (founder decision D1, 16 Sep). There is no
-- separate approval: a funded opportunity is formalised at the rate the engine
-- set (formalise_loan). The desk can still decline, and investors are refunded.
-- Every figure here is a prototype of a future regulated P2P architecture:
-- the pools and their returns are simulated.

create type public.funding_pool as enum ('domestic', 'global');

create table public.funding_pools (
  pool public.funding_pool primary key,
  name text not null,
  -- Domestic capital is counted in reais, global capital in USDC.
  capital_cents bigint check (capital_cents >= 0),
  capital_micro_usdc bigint check (capital_micro_usdc >= 0),
  required_return_bps integer not null check (required_return_bps between 0 and 10000),
  eligible_risk_bands public.grade[] not null,
  min_ticket_cents bigint not null check (min_ticket_cents > 0),
  max_ticket_cents bigint not null,
  -- Productive purposes it funds; empty funds any.
  purposes public.credit_purpose[] not null default '{}',
  impact_mandate boolean not null default false,
  fx_hedge_bps integer not null default 0 check (fx_hedge_bps between 0 and 10000),
  ramp_bps integer not null default 0 check (ramp_bps between 0 and 1000),
  is_simulated boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint ticket_range check (max_ticket_cents >= min_ticket_cents),
  constraint pool_currency check (
    (pool = 'domestic' and capital_cents is not null and capital_micro_usdc is null and fx_hedge_bps = 0 and ramp_bps = 0)
    or (pool = 'global' and capital_micro_usdc is not null and capital_cents is null)
  )
);

-- The demo's pools. Assumptions, labelled as such wherever they show.
insert into public.funding_pools (
  pool, name, capital_cents, capital_micro_usdc, required_return_bps, eligible_risk_bands,
  min_ticket_cents, max_ticket_cents, purposes, impact_mandate, fx_hedge_bps, ramp_bps
) values
  ('domestic', 'Domestic P2P', 2700000, null, 1600, '{LOW,MEDIUM}', 50000, 400000, '{}', false, 0, 0),
  ('global', 'Global P2P', null, 7800000000, 800, '{LOW,MEDIUM}', 100000, 1000000,
   '{working_capital,inventory,equipment}', true, 500, 100);

alter table public.funding_pools enable row level security;
revoke all on public.funding_pools from anon, authenticated;

alter table public.qualified_credit_opportunities
  add column funding_pool public.funding_pool,
  -- The engine's answer when it last ran: both pools' assessments and the chosen one's economics.
  add column allocation jsonb,
  add column allocation_reason_codes text[],
  add column allocation_model_version text,
  add column allocated_at timestamptz;

create index opportunities_pool_idx on public.qualified_credit_opportunities (funding_pool, funding_status);

-- What a domestic investor put in, in reais. Its USDC equivalent at the
-- opportunity's quote is what the book keeps, as for every position.
alter table public.investments add column amount_cents bigint check (amount_cents > 0);

-- ------------------------------------------------------------------ the engine

create function private.allocation_model_version()
returns text language sql immutable set search_path = ''
as $$ select 'capital-allocation-v1.0.0' $$;

-- As packages/capital-allocation RULES.
create function private.allocation_expected_loss_bps(p_band text)
returns integer language sql immutable set search_path = ''
as $$ select case p_band when 'LOW' then 300 when 'MEDIUM' then 700 else 1500 end $$;

create function private.allocation_cost_to_serve_bps()
returns integer language sql immutable set search_path = ''
as $$ select 600 $$;

-- One pool's answer for one opportunity: what blocks it, and her all-in cost a year through it.
create function private.allocation_assess(p_pool jsonb, p_amount_cents bigint, p_term integer, p_band text, p_purpose text)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_blocks text[] := '{}';
  v_ramp_year integer;
begin
  if not (p_pool -> 'eligible_risk_bands') ? p_band then
    v_blocks := array_append(v_blocks, 'RISK_BAND_NOT_ELIGIBLE');
  end if;
  if p_amount_cents < (p_pool ->> 'min_ticket_cents')::bigint or p_amount_cents > (p_pool ->> 'max_ticket_cents')::bigint then
    v_blocks := array_append(v_blocks, 'TICKET_OUTSIDE_POOL_POLICY');
  end if;
  if jsonb_array_length(p_pool -> 'purposes') > 0 and not (p_pool -> 'purposes') ? p_purpose then
    v_blocks := array_append(v_blocks, 'PURPOSE_OUTSIDE_POOL_MANDATE');
  end if;
  if (p_pool ->> 'available_cents')::bigint < p_amount_cents then
    v_blocks := array_append(v_blocks, (case when p_pool ->> 'id' = 'domestic' then 'DOMESTIC_POOL_EXHAUSTED' else 'GLOBAL_POOL_EXHAUSTED' end));
  end if;
  -- Into reais and back out, spread over the loan's years.
  v_ramp_year := ceil(2 * (p_pool ->> 'ramp_bps')::integer * 12 / p_term::numeric);
  return jsonb_build_object(
    'pool', p_pool ->> 'id',
    'feasible', cardinality(v_blocks) = 0,
    'blocks', to_jsonb(v_blocks),
    'all_in_bps', (p_pool ->> 'required_return_bps')::integer + private.allocation_expected_loss_bps(p_band)
                  + private.allocation_cost_to_serve_bps() + (p_pool ->> 'fx_hedge_bps')::integer + v_ramp_year,
    'fx_hedge_bps', (p_pool ->> 'fx_hedge_bps')::integer,
    'ramp_bps_year', v_ramp_year
  );
end;
$$;

-- packages/capital-allocation allocate(), in SQL. Pools as jsonb in the
-- package's PoolPolicy shape; the result in its AllocationResult shape.
create function private.allocate_funding(
  p_amount_cents bigint, p_term integer, p_band text, p_purpose text, p_impact boolean,
  p_domestic jsonb, p_global jsonb
)
returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  v_order text[] := array[
    'DOMESTIC_LOWEST_COST', 'DOMESTIC_LIQUIDITY_AVAILABLE', 'GLOBAL_LOWER_REQUIRED_RETURN', 'GLOBAL_EXPANDS_CAPACITY',
    'GLOBAL_IMPACT_MANDATE_MATCH', 'GLOBAL_FX_COST_DOMINATES', 'GLOBAL_RAMP_COST_DOMINATES', 'DOMESTIC_POOL_EXHAUSTED',
    'GLOBAL_POOL_EXHAUSTED', 'RISK_BAND_NOT_ELIGIBLE', 'TICKET_OUTSIDE_POOL_POLICY', 'PURPOSE_OUTSIDE_POOL_MANDATE',
    'NO_POOL_AVAILABLE'];
  d jsonb;
  g jsonb;
  v_reasons text[];
  v_pool text;
  v_chosen jsonb;
  v_policy jsonb;
  v_monthly integer;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_cents must be positive' using errcode = '22023';
  end if;
  if p_term is null or p_term <= 0 then
    raise exception 'term_months must be positive' using errcode = '22023';
  end if;
  d := private.allocation_assess(p_domestic, p_amount_cents, p_term, p_band, p_purpose);
  g := private.allocation_assess(p_global, p_amount_cents, p_term, p_band, p_purpose);
  v_reasons := array(select jsonb_array_elements_text(d -> 'blocks')) || array(select jsonb_array_elements_text(g -> 'blocks'));

  if (d ->> 'feasible')::boolean and (g ->> 'feasible')::boolean then
    v_pool := case when (g ->> 'all_in_bps')::integer < (d ->> 'all_in_bps')::integer then 'global' else 'domestic' end;
    if v_pool = 'domestic' then
      v_reasons := v_reasons || array['DOMESTIC_LOWEST_COST', 'DOMESTIC_LIQUIDITY_AVAILABLE'];
      -- Global capital asked less, and its conversion costs took the difference away.
      if (p_global ->> 'required_return_bps')::integer < (p_domestic ->> 'required_return_bps')::integer then
        v_reasons := array_append(v_reasons, (case when (g ->> 'fx_hedge_bps')::integer >= (g ->> 'ramp_bps_year')::integer
                                        then 'GLOBAL_FX_COST_DOMINATES' else 'GLOBAL_RAMP_COST_DOMINATES' end));
      end if;
    else
      v_reasons := array_append(v_reasons, 'GLOBAL_LOWER_REQUIRED_RETURN');
    end if;
  elsif (d ->> 'feasible')::boolean then
    v_pool := 'domestic';
    v_reasons := array_append(v_reasons, 'DOMESTIC_LIQUIDITY_AVAILABLE');
  elsif (g ->> 'feasible')::boolean then
    v_pool := 'global';
    v_reasons := array_append(v_reasons, 'GLOBAL_EXPANDS_CAPACITY');
  else
    v_reasons := array_append(v_reasons, 'NO_POOL_AVAILABLE');
  end if;
  if v_pool = 'global' and (p_global ->> 'impact_mandate')::boolean and p_impact then
    v_reasons := array_append(v_reasons, 'GLOBAL_IMPACT_MANDATE_MATCH');
  end if;

  v_chosen := case v_pool when 'domestic' then d when 'global' then g end;
  v_policy := case v_pool when 'domestic' then p_domestic when 'global' then p_global end;
  v_monthly := ceil((v_chosen ->> 'all_in_bps')::integer / 12.0);
  return jsonb_build_object(
    'model_version', private.allocation_model_version(),
    'pool', v_pool,
    'reason_codes', to_jsonb(array(select r from unnest(v_order) with ordinality as t(r, n) where r = any(v_reasons) order by n)),
    'domestic', d,
    'global', g,
    'borrower_rate_bps_month', v_monthly,
    -- Flat, as eligibility sizes instalments, rounded up to the centavo.
    'instalment_cents', case when v_monthly is not null then private.flat_instalment(p_amount_cents, v_monthly, p_term) end,
    'investor_return_bps', (v_policy ->> 'required_return_bps')::integer,
    'investor_net_return_bps', (v_policy ->> 'required_return_bps')::integer - case when v_pool is not null then private.allocation_expected_loss_bps(p_band) end
  );
end;
$$;

-- ------------------------------------------------------------ the pools' book

-- A pool's capital, what is lent out of it, and what opportunities raising in
-- it have claimed. Domestic units are centavos; global units are micro-USDC.
-- Lent: loans disbursed and not paid back (a default's capital is lost, and
-- stays counted). Claimed: allocated opportunities still raising or funded,
-- before disbursal.
create function private.pool_book(p_pool public.funding_pool)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with p as (select * from public.funding_pools where pool = p_pool),
  opp as (
    select o.id, case when p_pool = 'domestic' then o.amount_cents else o.funding_target_micro_usdc end as units,
           exists (select 1 from public.loans l where l.opportunity_id = o.id and l.status in ('DISBURSED', 'ACTIVE', 'DEFAULTED')) as lent,
           exists (select 1 from public.loans l where l.opportunity_id = o.id and l.status in ('DISBURSED', 'ACTIVE', 'DEFAULTED', 'PAID', 'CANCELLED')) as settled
    from public.qualified_credit_opportunities o
    where o.funding_pool = p_pool and o.funding_status in ('open', 'partially_funded', 'funded')
  )
  select jsonb_build_object(
    'capital', coalesce(p.capital_cents, p.capital_micro_usdc),
    'lent', (select coalesce(sum(units), 0) from opp where lent),
    'claimed', (select coalesce(sum(units), 0) from opp where not settled)
  )
  from p
$$;

-- A pool's policy in the engine's shape, with what it has available in reais.
create function private.pool_policy(p_pool public.funding_pool, p_available_cents bigint)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.pool, 'available_cents', greatest(p_available_cents, 0), 'required_return_bps', p.required_return_bps,
    'eligible_risk_bands', to_jsonb(p.eligible_risk_bands), 'min_ticket_cents', p.min_ticket_cents,
    'max_ticket_cents', p.max_ticket_cents, 'purposes', to_jsonb(p.purposes), 'impact_mandate', p.impact_mandate,
    'fx_hedge_bps', p.fx_hedge_bps, 'ramp_bps', p.ramp_bps
  )
  from public.funding_pools p where p.pool = p_pool
$$;

-- Reais for micro-USDC at a quote, down to the centavo (usdcToCents).
create function private.usdc_cents(p_micro bigint, p_fx_milli integer)
returns bigint language sql immutable set search_path = ''
as $$ select floor(p_micro * p_fx_milli / 10000000.0)::bigint $$;

-- ------------------------------------------------------- allocation on opening

-- Funding opens with her consent to be shown to investors, as before; the
-- engine now chooses the pool first. With no pool able to take it, the
-- opportunity waits, with the engine's reasons, and is tried again on its next
-- change of status.
create or replace function private.open_for_funding() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_fx integer;
  v_domestic jsonb;
  v_global jsonb;
  v_result jsonb;
begin
  if new.funding_status is null and new.status in ('open', 'referred', 'partner_approved')
     and private.has_consent(new.entrepreneur_id, 'investors') then
    -- One allocation at a time: each draws down what the pools have left.
    perform 1 from public.funding_pools for update;
    v_fx := private.demo_brl_per_usdc_milli();
    v_domestic := private.pool_book('domestic');
    v_global := private.pool_book('global');
    v_result := private.allocate_funding(
      new.amount_cents, new.term_months, new.risk_band::text, new.purpose::text,
      -- Women-led, in a verified community: the impact mandate's test.
      exists (select 1 from public.community_memberships m join public.communities c on c.id = m.community_id
              where m.entrepreneur_id = new.entrepreneur_id and c.status = 'verified'),
      private.pool_policy('domestic', (v_domestic ->> 'capital')::bigint - (v_domestic ->> 'lent')::bigint - (v_domestic ->> 'claimed')::bigint),
      private.pool_policy('global', private.usdc_cents(
        (v_global ->> 'capital')::bigint - (v_global ->> 'lent')::bigint - (v_global ->> 'claimed')::bigint, v_fx))
    );
    new.allocation := v_result;
    new.funding_pool := (v_result ->> 'pool')::public.funding_pool;
    new.allocation_reason_codes := array(select jsonb_array_elements_text(v_result -> 'reason_codes'));
    new.allocation_model_version := v_result ->> 'model_version';
    new.allocated_at := now();
    if new.funding_pool is not null then
      new.funding_status := 'open';
      new.fx_brl_per_usdc_milli := v_fx;
      -- centavos → reais → USDC → micro-USDC, rounded up to a whole USDC for
      -- USDC investors. The domestic pool keeps its book in the same unit at
      -- the same quote, to the micro-USDC, so its target reads as her reais.
      new.funding_target_micro_usdc := case new.funding_pool
        when 'global' then ceil(new.amount_cents * 10.0 / v_fx) * 1000000
        else round(new.amount_cents * 10000000.0 / v_fx) end;
    end if;
  end if;
  if new.status in ('partner_declined', 'withdrawn') and new.funding_status in ('open', 'partially_funded', 'funded') then
    new.funding_status := (case when new.funded_micro_usdc > 0 then 'refunded' else 'closed' end)::public.funding_status;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ investing

-- As before, with one rule more: the domestic pool is simulated reais, so no
-- USDC or ZEC funds it.
create or replace function public.record_investment(
  p_investor_id uuid,
  p_opportunity_id uuid,
  p_amount_micro_usdc bigint,
  p_mode public.investment_mode,
  p_wallet_address text default null,
  p_deposit_signature text default null,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_existing public.investments;
  v_id uuid;
  v_funded bigint;
begin
  if p_deposit_signature is not null then
    select * into v_existing from public.investments where deposit_signature = p_deposit_signature;
    if found then
      return jsonb_build_object('id', v_existing.id, 'reused', true);
    end if;
  end if;
  if not exists (select 1 from public.profiles where id = p_investor_id and role = 'capital_provider') then
    raise exception 'not_an_investor' using errcode = '42501';
  end if;

  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.funding_status not in ('open', 'partially_funded') then
    raise exception 'opportunity_not_open' using errcode = 'P0001';
  end if;
  if v_opp.funding_pool = 'domestic' and p_mode <> 'simulated' then
    raise exception 'domestic_pool_is_simulated' using errcode = 'P0001';
  end if;
  if p_amount_micro_usdc <= 0 or v_opp.funded_micro_usdc + p_amount_micro_usdc > v_opp.funding_target_micro_usdc then
    raise exception 'exceeds_remaining' using errcode = '22023';
  end if;

  insert into public.investments (
    investor_id, opportunity_id, wallet_address, amount_micro_usdc, deposit_signature, mode, is_simulated, created_at
  ) values (
    p_investor_id, p_opportunity_id, p_wallet_address, p_amount_micro_usdc, p_deposit_signature, p_mode, p_is_simulated, p_created_at
  ) returning id into v_id;

  v_funded := v_opp.funded_micro_usdc + p_amount_micro_usdc;
  update public.qualified_credit_opportunities
  set funded_micro_usdc = v_funded,
      funding_status = (case when v_funded >= funding_target_micro_usdc then 'funded' else 'partially_funded' end)::public.funding_status
  where id = p_opportunity_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('allocation', v_id, private.anchor_of('opportunity', p_opportunity_id));
  return jsonb_build_object('id', v_id, 'reused', false, 'funded_micro_usdc', v_funded);
end;
$$;

-- A domestic investor's allocation, in reais: simulated, and labelled so. It
-- is booked at the opportunity's quote, like every position; the last reais
-- of the target round to exactly what remains.
create function public.allocate_domestic(p_opportunity_id uuid, p_amount_cents bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_micro bigint;
  v_remaining bigint;
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'capital_provider') then
    raise exception 'not_an_investor' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found or not private.has_consent(v_opp.entrepreneur_id, 'investors') then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.funding_pool is distinct from 'domestic' then
    raise exception 'not_a_domestic_opportunity' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents < 10000 then
    raise exception 'amount_too_small' using errcode = '22023';
  end if;
  v_remaining := v_opp.funding_target_micro_usdc - v_opp.funded_micro_usdc;
  v_micro := round(p_amount_cents * 10000000.0 / v_opp.fx_brl_per_usdc_milli);
  -- Within a real of what remains is what remains.
  if v_micro > v_remaining and v_micro - v_remaining <= round(100 * 10000000.0 / v_opp.fx_brl_per_usdc_milli) then
    v_micro := v_remaining;
  end if;
  v_result := public.record_investment(auth.uid(), p_opportunity_id, v_micro, 'simulated', null, null, true, now());
  update public.investments set amount_cents = p_amount_cents where id = (v_result ->> 'id')::uuid;
  return v_result;
end;
$$;

-- ZEC funds only global opportunities.
create or replace function private.zcash_pool_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select funding_pool from public.qualified_credit_opportunities where id = new.opportunity_id) = 'domestic' then
    raise exception 'domestic_pool_is_simulated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger zcash_pool_check before insert on public.zcash_payment_requests
  for each row execute function private.zcash_pool_check();

-- ---------------------------------------------------------- the EmpowerFI desk

-- Formalising a funded opportunity: the loan, at the rate the engine set when
-- it chose the pool, for the amount and term eligibility proposed. The desk or
-- an admin; once, and only when investors have funded all of it.
create function public.formalise_loan(p_opportunity_id uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_rate integer;
  v_decision uuid;
  v_loan public.loans;
  v_event uuid;
begin
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found or not ((private.my_partner_id() is not null and v_opp.partner_id = private.my_partner_id()) or private.is_admin()) then
    raise exception 'not_your_opportunity' using errcode = '42501';
  end if;
  if v_opp.status <> 'referred' then
    raise exception 'opportunity_not_awaiting_decision' using errcode = 'P0001';
  end if;
  if v_opp.funding_status is distinct from 'funded' then
    raise exception 'not_fully_funded' using errcode = 'P0001';
  end if;
  v_rate := (v_opp.allocation ->> 'borrower_rate_bps_month')::integer;
  if v_opp.funding_pool is null or v_rate is null then
    raise exception 'not_allocated' using errcode = 'P0001';
  end if;

  insert into public.partner_decisions (
    opportunity_id, partner_id, verdict, approved_amount_cents, rate_bps, term_months, reason, decided_by, is_simulated
  ) values (
    p_opportunity_id, v_opp.partner_id, 'approved', v_opp.amount_cents, v_rate, v_opp.term_months,
    coalesce(nullif(trim(p_note), ''), 'Formalised at the Capital Allocation Engine''s rate'), auth.uid(), v_opp.is_simulated
  ) returning id into v_decision;
  update public.qualified_credit_opportunities set status = 'partner_approved' where id = p_opportunity_id;

  insert into public.loans (
    opportunity_id, entrepreneur_id, partner_id, decision_id, principal_cents, term_months, rate_bps, instalment_cents
  ) values (
    p_opportunity_id, v_opp.entrepreneur_id, v_opp.partner_id, v_decision,
    v_opp.amount_cents, v_opp.term_months, v_rate, private.flat_instalment(v_opp.amount_cents, v_rate, v_opp.term_months)
  ) returning * into v_loan;
  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('loan', v_loan.id, private.anchor_of('opportunity', p_opportunity_id));

  insert into public.loan_events (loan_id, from_status, to_status, actor, note)
  values (v_loan.id, 'DRAFT', 'PARTNER_APPROVED', auth.uid(), 'Formalised')
  returning id into v_event;
  update public.loans set status = 'PARTNER_APPROVED', updated_at = now() where id = v_loan.id;
  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('loan_transition', v_event, private.latest_loan_anchor(v_loan.id));
  return v_loan.id;
end;
$$;

-- The desk's decision is now only ever a decline: approval is formalisation,
-- at the engine's rate, once investors have funded it.
create or replace function public.partner_decide(
  p_opportunity_id uuid,
  p_verdict public.partner_verdict,
  p_approved_amount_cents bigint default null,
  p_rate_bps integer default null,
  p_term_months integer default null,
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_opportunity public.qualified_credit_opportunities;
  v_decision uuid;
begin
  select * into v_opportunity from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found or private.my_partner_id() is null or v_opportunity.partner_id is distinct from private.my_partner_id() then
    raise exception 'not_your_opportunity' using errcode = '42501';
  end if;
  if p_verdict = 'approved' then
    raise exception 'approval_is_formalisation' using errcode = 'P0001';
  end if;
  if v_opportunity.status <> 'referred' then
    raise exception 'opportunity_not_awaiting_decision' using errcode = 'P0001';
  end if;

  insert into public.partner_decisions (opportunity_id, partner_id, verdict, reason, decided_by)
  values (p_opportunity_id, v_opportunity.partner_id, p_verdict, nullif(trim(p_reason), ''), auth.uid())
  returning id into v_decision;
  update public.qualified_credit_opportunities set status = 'partner_declined' where id = p_opportunity_id;
  return v_decision;
end;
$$;

-- ------------------------------------------------------------- the overview

-- The two pools and the demand they face: qualified opportunities open to
-- investors and not yet lent, in the order they came. Coverage replays the
-- engine over that demand with what each pool has not lent: what domestic
-- capital alone would cover, and what both together do.
create function private.capital_coverage(p_domestic_cents bigint, p_global_cents bigint)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_demand bigint := 0;
  v_alone bigint := 0;
  v_both bigint := 0;
  v_run integer;
  v_left_d bigint;
  v_left_g bigint;
  v_result jsonb;
  o record;
begin
  for v_run in 1..2 loop
    v_left_d := p_domestic_cents;
    v_left_g := case when v_run = 1 then 0 else p_global_cents end;
    for o in
      select q.amount_cents, q.term_months, q.risk_band::text as band, q.purpose::text as purpose,
             exists (select 1 from public.community_memberships m join public.communities c on c.id = m.community_id
                     where m.entrepreneur_id = q.entrepreneur_id and c.status = 'verified') as impact
      from public.qualified_credit_opportunities q
      where q.allocation is not null
        and q.status in ('open', 'referred', 'partner_approved')
        and coalesce(q.funding_status::text, 'waiting') in ('waiting', 'open', 'partially_funded', 'funded')
        and not exists (select 1 from public.loans l where l.opportunity_id = q.id and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED'))
      order by q.created_at, q.id
    loop
      v_result := private.allocate_funding(o.amount_cents, o.term_months, o.band, o.purpose, o.impact,
        private.pool_policy('domestic', v_left_d), private.pool_policy('global', v_left_g));
      if v_run = 2 then v_demand := v_demand + o.amount_cents; end if;
      if v_result ->> 'pool' = 'domestic' then v_left_d := v_left_d - o.amount_cents; end if;
      if v_result ->> 'pool' = 'global' then v_left_g := v_left_g - o.amount_cents; end if;
      if v_result ->> 'pool' is not null then
        if v_run = 1 then v_alone := v_alone + o.amount_cents; else v_both := v_both + o.amount_cents; end if;
      end if;
    end loop;
  end loop;
  return jsonb_build_object(
    'demand_cents', v_demand,
    'domestic_only_cents', v_alone,
    'combined_cents', v_both,
    'domestic_coverage_bps', case when v_demand > 0 then floor(v_alone * 10000.0 / v_demand) else 0 end,
    'combined_coverage_bps', case when v_demand > 0 then floor(v_both * 10000.0 / v_demand) else 0 end
  );
end;
$$;

create function public.capital_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fx integer := private.demo_brl_per_usdc_milli();
  v_d jsonb := private.pool_book('domestic');
  v_g jsonb := private.pool_book('global');
  v_d_cents bigint;
  v_g_cents bigint;
begin
  if not (private.is_investor_or_overseer() or private.my_partner_id() is not null) then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;
  v_d_cents := (v_d ->> 'capital')::bigint - (v_d ->> 'lent')::bigint;
  v_g_cents := private.usdc_cents((v_g ->> 'capital')::bigint - (v_g ->> 'lent')::bigint, v_fx);
  return jsonb_build_object(
    'model_version', private.allocation_model_version(),
    'fx_brl_per_usdc_milli', v_fx,
    'expected_loss_bps', jsonb_build_object('LOW', 300, 'MEDIUM', 700, 'HIGH', 1500),
    'cost_to_serve_bps', private.allocation_cost_to_serve_bps(),
    'pools', (
      select jsonb_agg(jsonb_build_object(
        'pool', p.pool, 'name', p.name, 'is_simulated', p.is_simulated,
        'policy', private.pool_policy(p.pool, 0) - 'available_cents',
        'capital_cents', case p.pool when 'domestic' then p.capital_cents else private.usdc_cents(p.capital_micro_usdc, v_fx) end,
        'capital_micro_usdc', p.capital_micro_usdc,
        'lent', b.book -> 'lent', 'claimed', b.book -> 'claimed',
        -- Not lent: what this demand can draw on.
        'liquidity_cents', case p.pool when 'domestic' then v_d_cents else v_g_cents end,
        'liquidity_micro_usdc', case p.pool when 'global' then (v_g ->> 'capital')::bigint - (v_g ->> 'lent')::bigint end
      ) order by p.pool)
      from public.funding_pools p
      cross join lateral (select case p.pool when 'domestic' then v_d else v_g end as book) b
    ),
    'coverage', private.capital_coverage(v_d_cents, v_g_cents),
    'demand', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'opportunity_id', q.id, 'code', private.opportunity_code(q.id),
        'amount_cents', q.amount_cents, 'term_months', q.term_months, 'risk_band', q.risk_band, 'purpose', q.purpose,
        'impact_eligible', true, 'funding_pool', q.funding_pool, 'funding_status', q.funding_status,
        'reason_codes', to_jsonb(q.allocation_reason_codes)
      ) order by q.created_at, q.id), '[]')
      from public.qualified_credit_opportunities q
      where q.allocation is not null
        and q.status in ('open', 'referred', 'partner_approved')
        and coalesce(q.funding_status::text, 'waiting') in ('waiting', 'open', 'partially_funded', 'funded')
        and not exists (select 1 from public.loans l where l.opportunity_id = q.id and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED'))
    )
  );
end;
$$;

-- --------------------------------------------------------------- the market

drop function public.investor_opportunities();
create function public.investor_opportunities()
returns table (
  opportunity_id uuid,
  code text,
  purpose public.credit_purpose,
  business_sector text,
  community_name text,
  community_city text,
  community_state text,
  amount_cents bigint,
  term_months smallint,
  instalment_cents bigint,
  funding_status public.funding_status,
  funding_target_micro_usdc bigint,
  funded_micro_usdc bigint,
  fx_brl_per_usdc_milli integer,
  investors integer,
  my_micro_usdc bigint,
  indicative_yield_bps integer,
  risk_band public.grade,
  confidence public.grade,
  eligibility_decision public.eligibility_decision,
  affordability_bps integer,
  eligibility_reasons text[],
  eligibility_model text,
  readiness_score integer,
  readiness_band public.readiness_band,
  readiness_model text,
  months_reported integer,
  records_kept_bps integer,
  loan_status public.loan_status,
  created_at timestamptz,
  proofs jsonb,
  funding_pool public.funding_pool,
  allocation jsonb,
  allocation_reason_codes text[]
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_investor_or_overseer() then
    raise exception 'not_allowed_to_see_opportunities' using errcode = '42501';
  end if;
  return query
  select
    o.id, private.opportunity_code(o.id), o.purpose, en.business_sector,
    c.name, c.city, c.state,
    o.amount_cents, o.term_months, o.instalment_cents,
    o.funding_status, o.funding_target_micro_usdc, o.funded_micro_usdc, o.fx_brl_per_usdc_milli,
    (select count(distinct i.investor_id)::integer from public.investments i where i.opportunity_id = o.id),
    (select coalesce(sum(i.amount_micro_usdc), 0)::bigint from public.investments i where i.opportunity_id = o.id and i.investor_id = auth.uid()),
    -- What the chosen pool's investors ask, net of expected loss.
    coalesce((o.allocation ->> 'investor_net_return_bps')::integer, private.indicative_yield_bps(o.risk_band)),
    o.risk_band, o.confidence, e.decision, e.affordability_bps, e.reason_codes, e.model_version,
    r.score::integer, r.band, r.model_version,
    (r.features ->> 'months_reported')::integer, (r.features ->> 'records_kept_bps')::integer,
    (select l.status from public.loans l where l.opportunity_id = o.id),
    o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile, 'confirmed_at', private.iso(a.confirmed_at)
      ) order by a.id), '[]')
     from public.chain_anchors a
     where (a.kind = 'readiness' and a.entity_id = e.readiness_assessment_id)
        or (a.kind = 'eligibility' and a.entity_id = e.id)
        or (a.kind = 'opportunity' and a.entity_id = o.id)
        or (a.kind = 'consent' and a.entity_id = (
              select k.id from public.consents k where k.entrepreneur_id = o.entrepreneur_id
              order by k.consent_no desc limit 1))),
    o.funding_pool, o.allocation, o.allocation_reason_codes
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments e on e.id = o.eligibility_id
  join public.readiness_assessments r on r.id = e.readiness_assessment_id
  join public.entrepreneurs en on en.id = o.entrepreneur_id
  left join lateral (
    select co.name, co.city, co.state from public.community_memberships m join public.communities co on co.id = m.community_id
    where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified' order by m.joined_at limit 1
  ) c on true
  where o.funding_status is not null
    and (private.has_consent(o.entrepreneur_id, 'investors')
         or exists (select 1 from public.investments i where i.opportunity_id = o.id and i.investor_id = auth.uid()))
  order by (o.funding_status in ('open', 'partially_funded')) desc, o.created_at desc;
end;
$$;


-- ------------------------------------------------------------- positions

-- As before, with each position's pool and, for a domestic one, its reais.
-- (Investments now have an amount_cents of their own: the opportunity's is
-- named apart.)
create or replace function public.investor_portfolio()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if private.my_role() is distinct from 'capital_provider' and not private.is_auditor_or_admin() then
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  with mine as (
    select i.*, o.funding_target_micro_usdc, o.funding_status, o.purpose, o.risk_band, o.term_months,
      o.amount_cents as opportunity_cents, o.fx_brl_per_usdc_milli, o.funding_pool, en.business_sector,
      i.amount_micro_usdc::numeric / o.funding_target_micro_usdc as share,
      l.id as loan_id, l.status as loan_status, l.principal_cents, l.instalment_cents, l.term_months as loan_term,
      l.disbursed_at,
      (select count(*) from public.payments p where p.loan_id = l.id)::integer as paid,
      (select coalesce(sum(p.amount_cents), 0) from public.payments p where p.loan_id = l.id) as repaid_cents,
      (select po.evc_cents from public.productive_outcomes po where po.loan_id = l.id order by po.outcome_no desc limit 1) as evc_cents,
      a.status as proof_status, a.signature as proof_signature, a.reconcile as proof_reconcile
    from public.investments i
    join public.qualified_credit_opportunities o on o.id = i.opportunity_id
    join public.entrepreneurs en on en.id = o.entrepreneur_id
    left join public.loans l on l.opportunity_id = o.id
    left join public.chain_anchors a on a.kind = 'allocation' and a.entity_id = i.id
    where i.investor_id = auth.uid()
  )
  select jsonb_build_object(
    'invested_micro_usdc', coalesce(sum(amount_micro_usdc), 0),
    'deployed_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')), 0),
    -- Its share of instalments received, in USDC at the opportunity's quote.
    'repaid_micro_usdc', coalesce(round(sum(share * private.usdc_micro(repaid_cents, fx_brl_per_usdc_milli))), 0),
    'expected_micro_usdc', coalesce(round(sum(share * private.usdc_micro(coalesce(instalment_cents * loan_term, opportunity_cents * (10000 + 250 * term_months) / 10000), fx_brl_per_usdc_milli))), 0),
    'positions', count(*),
    'by_risk', (select coalesce(jsonb_object_agg(risk_band, n), '{}') from (select risk_band, sum(amount_micro_usdc) n from mine group by risk_band) x),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'investment_id', id, 'opportunity_id', opportunity_id, 'code', private.opportunity_code(opportunity_id),
      'purpose', purpose, 'business_sector', business_sector, 'risk_band', risk_band,
      'amount_micro_usdc', amount_micro_usdc, 'share_bps', round(share * 10000), 'mode', mode, 'status', status,
      'deposit_signature', deposit_signature, 'invested_at', private.iso(created_at), 'is_simulated', is_simulated,
      'funding_status', funding_status, 'loan_status', loan_status, 'term_months', coalesce(loan_term, term_months),
      'paid', coalesce(paid, 0), 'disbursed_at', private.iso(disbursed_at),
      'repaid_micro_usdc', round(share * private.usdc_micro(coalesce(repaid_cents, 0), fx_brl_per_usdc_milli)),
      'evc_cents', evc_cents,
      'funding_pool', funding_pool, 'amount_cents', amount_cents, 'fx_brl_per_usdc_milli', fx_brl_per_usdc_milli,
      'proof', jsonb_build_object('status', proof_status, 'signature', proof_signature, 'reconcile', proof_reconcile)
    ) order by created_at desc), '[]')
  ) into v
  from mine;
  return v;
end;
$$;

-- As before, with the pool and the engine's reasons.
create or replace function public.investor_position(p_investment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv public.investments;
  v_opp public.qualified_credit_opportunities;
  v_loan public.loans;
  v_share numeric;
  v_active timestamptz;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or not (v_inv.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_inv.opportunity_id;
  select * into v_loan from public.loans where opportunity_id = v_opp.id;
  v_share := v_inv.amount_micro_usdc::numeric / v_opp.funding_target_micro_usdc;
  select min(created_at) into v_active from public.loan_events where loan_id = v_loan.id and to_status = 'ACTIVE';

  return jsonb_build_object(
    'investment', jsonb_build_object(
      'id', v_inv.id, 'amount_micro_usdc', v_inv.amount_micro_usdc, 'amount_cents', v_inv.amount_cents, 'share_bps', round(v_share * 10000),
      'mode', v_inv.mode, 'status', v_inv.status, 'deposit_signature', v_inv.deposit_signature,
      'wallet_address', v_inv.wallet_address, 'invested_at', private.iso(v_inv.created_at), 'is_simulated', v_inv.is_simulated,
      'refund_signature', case when v_inv.status = 'refunded' then v_inv.refund_signature end, 'refunded_at', private.iso(v_inv.refunded_at)
    ),
    'zcash', (select jsonb_build_object(
        'ref', z.ref, 'txid', z.txid, 'pool', z.pool, 'amount_zat', z.amount_zat, 'received_zat', z.received_zat,
        'usd_per_zec_cents', z.usd_per_zec_cents, 'quote_source', z.quote_source, 'mined_height', z.mined_height,
        'confirmed_at', private.iso(z.confirmed_at), 'credit_signature', z.credit_signature)
      from public.zcash_payment_requests z where z.investment_id = v_inv.id),
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_inv.id),
    'opportunity', jsonb_build_object(
      'id', v_opp.id, 'code', private.opportunity_code(v_opp.id), 'purpose', v_opp.purpose,
      'business_sector', (select business_sector from public.entrepreneurs where id = v_opp.entrepreneur_id),
      'amount_cents', v_opp.amount_cents, 'term_months', v_opp.term_months, 'risk_band', v_opp.risk_band,
      'funding_status', v_opp.funding_status, 'funding_target_micro_usdc', v_opp.funding_target_micro_usdc,
      'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli,
      'funding_pool', v_opp.funding_pool, 'allocation_reason_codes', to_jsonb(v_opp.allocation_reason_codes)
    ),
    'loan', case when v_loan.id is null then null else jsonb_build_object(
      'id', v_loan.id, 'status', v_loan.status, 'principal_cents', v_loan.principal_cents,
      'rate_bps', v_loan.rate_bps, 'term_months', v_loan.term_months, 'instalment_cents', v_loan.instalment_cents,
      'disbursed_at', private.iso(v_loan.disbursed_at), 'active_since', private.iso(v_active),
      'instalment_share_micro_usdc', private.share_usdc(v_loan.instalment_cents, v_share, v_opp.fx_brl_per_usdc_milli)
    ) end,
    'settlement', case when v_loan.id is null then null else jsonb_build_object(
      'ramp_bps', private.ramp_bps(),
      'release', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc,
          'signature', t.signature, 'transfer_micro_usdc', t.outflow_micro_usdc,
          'loans_in_transfer', (select count(*) from public.settlement_legs b where b.transfer_id = l.transfer_id),
          'at', private.iso(t.confirmed_at))
        from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
        where l.kind = 'release' and l.loan_id = v_loan.id),
      'pix', (select jsonb_build_object('e2e', l.pix_e2e, 'brl_cents', l.amount_cents,
          'at', private.iso((select min(e.created_at) from public.loan_events e where e.loan_id = v_loan.id and e.to_status = 'DISBURSED')))
        from public.settlement_legs l where l.kind = 'pix_payout' and l.loan_id = v_loan.id)
    ) end,
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instalment_no', n,
        'due_at', case when v_active is not null then private.iso(v_active + make_interval(months => n)) end,
        'paid_at', private.iso(p.paid_at),
        'payment_id', p.id,
        'share_micro_usdc', case when p.id is not null then private.share_usdc(p.amount_cents, v_share, v_opp.fx_brl_per_usdc_milli) end,
        'pix_e2e', (select l.pix_e2e from public.settlement_legs l where l.kind = 'pix_in' and l.payment_id = p.id),
        'payout', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc, 'signature', t.signature)
          from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
          where l.kind = 'payout' and l.payment_id = p.id and l.investment_id = v_inv.id)
      ) order by n)
      from generate_series(1, coalesce(v_loan.term_months, 0)) n
      left join public.payments p on p.loan_id = v_loan.id and p.instalment_no = n
    ), '[]'),
    'servicing', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'to_status', e.to_status, 'note', e.note, 'at', private.iso(e.created_at)) order by e.created_at)
      from public.loan_events e where e.loan_id = v_loan.id
    ), '[]'),
    'outcome', (
      select jsonb_build_object('id', po.id, 'avg_revenue_before_cents', po.avg_revenue_before_cents,
        'avg_revenue_after_cents', po.avg_revenue_after_cents, 'evc_cents', po.evc_cents, 'capital_use', po.capital_use,
        'confidence', po.confidence, 'measured_at', private.iso(po.measured_at))
      from public.productive_outcomes po where po.loan_id = v_loan.id order by po.outcome_no desc limit 1
    )
  );
end;
$$;


-- ------------------------------------------------------------------ the desk

-- An opportunity's funding as the desk sees it, now with its pool, the
-- engine's reasons and the rate a formalised loan will carry. Never who.
create or replace function private.partner_funding(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', o.funding_status,
    'target_micro_usdc', o.funding_target_micro_usdc,
    'funded_micro_usdc', o.funded_micro_usdc,
    'fx_brl_per_usdc_milli', o.fx_brl_per_usdc_milli,
    'investors', (select count(distinct i.investor_id) from public.investments i where i.opportunity_id = o.id),
    'real_micro_usdc', (select coalesce(sum(i.amount_micro_usdc), 0) from public.investments i
      where i.opportunity_id = o.id and not i.is_simulated and i.mode in ('wallet', 'zcash')),
    'refund_due', (select count(*) from public.investments i where i.opportunity_id = o.id and i.status = 'refund_due'),
    'refunded', (select count(*) from public.investments i where i.opportunity_id = o.id and i.status = 'refunded'),
    'pool', o.funding_pool,
    'reason_codes', to_jsonb(o.allocation_reason_codes),
    'rate_bps_month', (o.allocation ->> 'borrower_rate_bps_month')::integer,
    'instalment_cents', (o.allocation ->> 'instalment_cents')::bigint
  )
  from public.qualified_credit_opportunities o where o.id = p_opportunity_id
$$;

-- ------------------------------------------------------------------ grants

revoke all on function private.allocation_model_version(), private.allocation_expected_loss_bps(text),
  private.allocation_cost_to_serve_bps(), private.allocation_assess(jsonb, bigint, integer, text, text),
  private.allocate_funding(bigint, integer, text, text, boolean, jsonb, jsonb), private.pool_book(public.funding_pool),
  private.pool_policy(public.funding_pool, bigint), private.usdc_cents(bigint, integer),
  private.capital_coverage(bigint, bigint), private.zcash_pool_check() from public;
grant execute on function private.allocation_model_version(), private.allocation_expected_loss_bps(text),
  private.allocation_cost_to_serve_bps(), private.allocation_assess(jsonb, bigint, integer, text, text),
  private.allocate_funding(bigint, integer, text, text, boolean, jsonb, jsonb), private.pool_book(public.funding_pool),
  private.pool_policy(public.funding_pool, bigint), private.usdc_cents(bigint, integer),
  private.capital_coverage(bigint, bigint) to authenticated, service_role;
revoke all on function public.capital_overview(), public.investor_opportunities(),
  public.allocate_domestic(uuid, bigint), public.formalise_loan(uuid, text) from public, anon;
grant execute on function public.capital_overview(), public.investor_opportunities(),
  public.allocate_domestic(uuid, bigint), public.formalise_loan(uuid, text) to authenticated;
