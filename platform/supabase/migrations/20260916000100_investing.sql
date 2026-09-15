-- M11 · investing
--
-- Founder decision R1 (PLAN_REDESIGN.md): once eligibility qualifies a
-- request, the opportunity is open to investors; when it is funded, the
-- partner — lender of record — formalises and disburses. The partner still
-- decides; EmpowerFI never does.
--
-- Investors deposit devnet USDC into one vault owned by the program (R4). The
-- chain sees a deposit into the vault, never which opportunity it funds: the
-- allocation lives here, and is proven by a commitment keyed by a random
-- reference (AllocationCommitment). Investors see an opportunity without a
-- name (R2): purpose, sector, verified community, indicators, and the
-- evidence that it was assessed — never her words, figures or identity.

-- ------------------------------------------------------------ wallet users

alter table public.profiles add column wallet_address text unique
  check (wallet_address is null or wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$');

-- Signing in with a Solana wallet makes a capital provider, known by its address.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet text := new.raw_user_meta_data -> 'custom_claims' ->> 'address';
begin
  if new.raw_app_meta_data ->> 'provider' = 'web3' and v_wallet is not null then
    insert into public.profiles (id, display_name, role, wallet_address)
    values (new.id, 'Investor ' || left(v_wallet, 4) || '…' || right(v_wallet, 4), 'capital_provider', v_wallet);
    return new;
  end if;
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1),
      'Participant'
    )
  );
  return new;
end;
$$;

-- --------------------------------------------------------------- funding

create type public.funding_status as enum ('open', 'partially_funded', 'funded', 'closed', 'refunded');

-- A demo quote, labelled as such wherever it shows: reais per USDC, x1000.
create function private.demo_brl_per_usdc_milli()
returns integer
language sql immutable set search_path = ''
as $$ select 5400 $$;

alter table public.qualified_credit_opportunities
  add column funding_status public.funding_status,
  add column funding_target_micro_usdc bigint check (funding_target_micro_usdc is null or funding_target_micro_usdc > 0),
  add column funded_micro_usdc bigint not null default 0 check (funded_micro_usdc >= 0),
  add column fx_brl_per_usdc_milli integer;

-- An opportunity opens to investors when it reaches a partner (a flagged one
-- waits for EmpowerFI's review first), at a USDC target fixed at that moment.
create function private.open_for_funding() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.funding_status is null and new.status in ('open', 'referred', 'partner_approved') then
    new.funding_status := 'open';
    new.fx_brl_per_usdc_milli := private.demo_brl_per_usdc_milli();
    -- centavos → reais → USDC → micro-USDC, rounded up to a whole USDC.
    new.funding_target_micro_usdc := ceil(new.amount_cents * 10.0 / new.fx_brl_per_usdc_milli) * 1000000;
  end if;
  if new.status in ('partner_declined', 'withdrawn') and new.funding_status in ('open', 'partially_funded', 'funded') then
    new.funding_status := (case when new.funded_micro_usdc > 0 then 'refunded' else 'closed' end)::public.funding_status;
  end if;
  return new;
end;
$$;
create trigger open_for_funding before insert or update of status on public.qualified_credit_opportunities
  for each row execute function private.open_for_funding();

update public.qualified_credit_opportunities set status = status
where status in ('open', 'referred', 'partner_approved') and funding_status is null;

-- ------------------------------------------------------------ investments

create type public.investment_mode as enum ('wallet', 'cloak', 'simulated');
create type public.investment_status as enum ('allocated', 'refund_due', 'refunded');

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.qualified_credit_opportunities (id) on delete cascade,
  wallet_address text,
  amount_micro_usdc bigint not null check (amount_micro_usdc > 0),
  -- The devnet transfer into the vault; null only for simulated positions.
  deposit_signature text unique,
  mode public.investment_mode not null,
  status public.investment_status not null default 'allocated',
  -- 32 random bytes, never derived: its hash keys the allocation's account.
  allocation_ref bytea not null unique default extensions.gen_random_bytes(32) check (octet_length(allocation_ref) = 32),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint real_money_has_a_deposit check (mode = 'simulated' or deposit_signature is not null)
);

create index investments_investor_idx on public.investments (investor_id);
create index investments_opportunity_idx on public.investments (opportunity_id);

alter table public.investments enable row level security;
revoke all on public.investments from anon, authenticated;
grant select on public.investments to authenticated;

create policy investments_read on public.investments for select to authenticated using (
  investor_id = (select auth.uid()) or (select private.is_auditor_or_admin())
);

-- A partner declining, or a request withdrawn, owes investors their capital back.
create function private.refund_on_close() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.funding_status = 'refunded' and old.funding_status is distinct from 'refunded' then
    update public.investments set status = 'refund_due' where opportunity_id = new.id and status = 'allocated';
  end if;
  return new;
end;
$$;
-- On any update: funding_status is set by the trigger above, never in a SET list.
create trigger refund_on_close after update on public.qualified_credit_opportunities
  for each row when (old.funding_status is distinct from new.funding_status)
  execute function private.refund_on_close();

-- Records a confirmed allocation: the Edge Function that read the deposit on
-- chain, or the seed for simulated positions. Never a user directly.
create function public.record_investment(
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

-- The partner disburses only capital that is there.
create or replace function public.transition_loan(p_loan_id uuid, p_to public.loan_status, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_event uuid;
  v_previous bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found or not (v_loan.partner_id = private.my_partner_id() or private.is_admin()) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;
  if p_to = 'PARTNER_APPROVED' then
    raise exception 'approval_comes_from_the_partner_decision' using errcode = 'P0001';
  end if;
  if not private.loan_can_become(v_loan.status, p_to) then
    raise exception 'invalid_loan_transition' using errcode = 'P0001';
  end if;
  if p_to = 'DISBURSED' and (select funding_status from public.qualified_credit_opportunities where id = v_loan.opportunity_id)
       is distinct from 'funded' then
    raise exception 'not_fully_funded' using errcode = 'P0001';
  end if;
  if p_to = 'PAID' and (select count(*) from public.payments where loan_id = p_loan_id) < v_loan.term_months then
    raise exception 'instalments_outstanding' using errcode = 'P0001';
  end if;

  v_previous := private.latest_loan_anchor(p_loan_id);
  insert into public.loan_events (loan_id, from_status, to_status, actor, note)
  values (p_loan_id, v_loan.status, p_to, auth.uid(), nullif(trim(p_note), ''))
  returning id into v_event;
  update public.loans
  set status = p_to, updated_at = now(),
      disbursed_at = case when p_to = 'DISBURSED' then now() else disbursed_at end
  where id = p_loan_id;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('loan_transition', v_event, v_previous);
end;
$$;

-- ------------------------------------------------------------ what investors see

-- Indicative yield for an investor, a year, in reais: the reference rate the
-- eligibility engine sizes instalments at, less expected loss for the band and
-- an assumed 8% a year for the partner's servicing and EmpowerFI. Simulated.
create function private.indicative_yield_bps(p_band public.grade)
returns integer
language sql immutable set search_path = ''
as $$ select 250 * 12 - private.expected_loss_bps(p_band) - 800 $$;

-- The code an investor knows an opportunity by. Not the partner's P- code nor
-- the capital view's L- code: the three views cannot be joined on it.
create function private.opportunity_code(p_id uuid)
returns text
language sql immutable set search_path = ''
as $$ select 'Q-' || upper(substr(encode(extensions.digest('opportunity:' || p_id::text, 'sha256'), 'hex'), 1, 6)) $$;

create function private.is_investor_or_overseer()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.my_role() in ('capital_provider', 'auditor', 'admin'), false) $$;

-- The market: every opportunity open, being funded or funded, as an investor
-- may see it. No name, no business name, no words of hers, no raw figure.
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
  proofs jsonb
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
    private.indicative_yield_bps(o.risk_band),
    o.risk_band, o.confidence, e.decision, e.affordability_bps, e.reason_codes, e.model_version,
    r.score::integer, r.band, r.model_version,
    (r.features ->> 'months_reported')::integer, (r.features ->> 'records_kept_bps')::integer,
    (select l.status from public.loans l where l.opportunity_id = o.id),
    o.created_at,
    -- The evidence: which proofs exist and where, never what they contain.
    (select coalesce(jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile, 'confirmed_at', private.iso(a.confirmed_at)
      ) order by a.id), '[]')
     from public.chain_anchors a
     where (a.kind = 'readiness' and a.entity_id = e.readiness_assessment_id)
        or (a.kind = 'eligibility' and a.entity_id = e.id)
        or (a.kind = 'opportunity' and a.entity_id = o.id))
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments e on e.id = o.eligibility_id
  join public.readiness_assessments r on r.id = e.readiness_assessment_id
  join public.entrepreneurs en on en.id = o.entrepreneur_id
  left join lateral (
    select co.name, co.city, co.state from public.community_memberships m join public.communities co on co.id = m.community_id
    where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified' order by m.joined_at limit 1
  ) c on true
  where o.funding_status is not null
  order by (o.funding_status in ('open', 'partially_funded')) desc, o.created_at desc;
end;
$$;

-- The investor's own positions: each allocation, its proof, and what became
-- of the loan it funds — its share of the repayments, and the outcome.
create function public.investor_portfolio()
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
      o.amount_cents, o.fx_brl_per_usdc_milli, en.business_sector,
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
    'repaid_micro_usdc', coalesce(round(sum(share * repaid_cents * 10000 / fx_brl_per_usdc_milli)), 0),
    'expected_micro_usdc', coalesce(round(sum(share * coalesce(instalment_cents * loan_term, amount_cents * (10000 + 250 * term_months) / 10000) * 10000 / fx_brl_per_usdc_milli)), 0),
    'positions', count(*),
    'by_risk', (select coalesce(jsonb_object_agg(risk_band, n), '{}') from (select risk_band, sum(amount_micro_usdc) n from mine group by risk_band) x),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'investment_id', id, 'opportunity_id', opportunity_id, 'code', private.opportunity_code(opportunity_id),
      'purpose', purpose, 'business_sector', business_sector, 'risk_band', risk_band,
      'amount_micro_usdc', amount_micro_usdc, 'share_bps', round(share * 10000), 'mode', mode, 'status', status,
      'deposit_signature', deposit_signature, 'invested_at', private.iso(created_at), 'is_simulated', is_simulated,
      'funding_status', funding_status, 'loan_status', loan_status, 'term_months', coalesce(loan_term, term_months),
      'paid', coalesce(paid, 0), 'disbursed_at', private.iso(disbursed_at),
      'repaid_micro_usdc', round(share * coalesce(repaid_cents, 0) * 10000 / fx_brl_per_usdc_milli),
      'evc_cents', evc_cents,
      'proof', jsonb_build_object('status', proof_status, 'signature', proof_signature, 'reconcile', proof_reconcile)
    ) order by created_at desc), '[]')
  ) into v
  from mine;
  return v;
end;
$$;

-- ------------------------------------------------------------------ audit

create or replace function private.anchor_entrepreneur(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'enrollment' then p_entity_id
    when 'checkin' then (select entrepreneur_id from public.checkins where id = p_entity_id)
    when 'readiness' then (select entrepreneur_id from public.readiness_assessments where id = p_entity_id)
    when 'eligibility' then (select entrepreneur_id from public.eligibility_assessments where id = p_entity_id)
    when 'opportunity' then (select entrepreneur_id from public.qualified_credit_opportunities where id = p_entity_id)
    when 'loan' then (select entrepreneur_id from public.loans where id = p_entity_id)
    when 'loan_transition' then (
      select l.entrepreneur_id from public.loan_events e join public.loans l on l.id = e.loan_id where e.id = p_entity_id)
    when 'payment' then (
      select l.entrepreneur_id from public.payments p join public.loans l on l.id = p.loan_id where p.id = p_entity_id)
    when 'outcome' then (select entrepreneur_id from public.productive_outcomes where id = p_entity_id)
    -- An allocation is the investor's, not hers: no borrower account behind it.
    when 'allocation' then null
  end;
end;
$$;

-- Loans an investor funds, directly or through a partner it committed to.
create function private.funds_loan(p_loan_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.loans l join public.investments i on i.opportunity_id = l.opportunity_id
    where l.id = p_loan_id and i.investor_id = auth.uid()
  ) or exists (
    select 1 from public.loans l where l.id = p_loan_id and l.partner_id = any (private.my_capital_partners())
  )
$$;

create or replace function private.can_see_anchor(p_kind public.anchor_kind, p_entity_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid;
begin
  if private.is_auditor_or_admin() then
    return true;
  end if;
  if p_kind in ('community', 'community_verification') then
    return coalesce(private.leads_community(p_entity_id) or private.is_member(p_entity_id), false);
  end if;
  if p_kind = 'allocation' then
    return coalesce((select investor_id = auth.uid() from public.investments where id = p_entity_id), false);
  end if;
  if private.my_partner_id() is not null then
    return coalesce(private.anchor_partner(p_kind, p_entity_id) = private.my_partner_id(), false);
  end if;
  if private.my_role() = 'capital_provider' then
    return coalesce(case p_kind
      when 'loan' then private.funds_loan(p_entity_id)
      when 'loan_transition' then private.funds_loan((select loan_id from public.loan_events where id = p_entity_id))
      when 'payment' then private.funds_loan((select loan_id from public.payments where id = p_entity_id))
      else false
    end, false);
  end if;
  v_entrepreneur := private.anchor_entrepreneur(p_kind, p_entity_id);
  return coalesce(
    v_entrepreneur = private.my_entrepreneur_id() or private.leads_entrepreneur(v_entrepreneur),
    false
  );
end;
$$;

create or replace function private.anchor_payload(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  case p_kind
    when 'community' then
      select jsonb_build_object(
        'community_id', c.id, 'community_ref', encode(c.chain_ref, 'hex'), 'name', c.name, 'kind', c.kind,
        'city', c.city, 'state', c.state, 'leader_id', c.leader_id, 'created_at', private.iso(c.created_at)
      ) into v from public.communities c where c.id = p_entity_id;

    when 'community_verification' then
      select jsonb_build_object(
        'community_id', c.id, 'status', c.status, 'verified_by', c.verified_by, 'verified_at', private.iso(c.verified_at)
      ) into v from public.communities c where c.id = p_entity_id and c.status = 'verified';

    when 'enrollment' then
      select jsonb_build_object(
        'entrepreneur_id', m.entrepreneur_id, 'community_id', m.community_id, 'joined_at', private.iso(m.joined_at)
      ) into v from public.community_memberships m
      where m.entrepreneur_id = p_entity_id order by m.joined_at, m.community_id limit 1;

    when 'checkin' then
      select jsonb_build_object(
        'checkin_id', c.id, 'entrepreneur_id', c.entrepreneur_id, 'period', c.period,
        'revenue_cents', c.revenue_cents, 'cogs_cents', c.cogs_cents, 'opex_cents', c.opex_cents,
        'household_cents', c.household_cents, 'keeps_records', c.keeps_records, 'active_days', c.active_days,
        'submitted_at', private.iso(c.created_at)
      ) into v from public.checkins c where c.id = p_entity_id;

    when 'readiness' then
      select jsonb_build_object(
        'assessment_id', r.id, 'entrepreneur_id', r.entrepreneur_id, 'assessment_no', r.assessment_no,
        'model_version', r.model_version, 'as_of_period', r.as_of_period, 'status', r.status, 'band', r.band,
        'score', r.score, 'components', r.components, 'missing_requirements', r.missing_requirements,
        'reason_codes', to_jsonb(r.reason_codes), 'features', r.features, 'assessed_at', private.iso(r.created_at)
      ) into v from public.readiness_assessments r where r.id = p_entity_id;

    -- The whole assessment, with its inputs, and the readiness it relied on.
    when 'eligibility' then
      select jsonb_build_object(
        'eligibility_id', e.id, 'entrepreneur_id', e.entrepreneur_id, 'intent_id', e.intent_id,
        'readiness_assessment_id', e.readiness_assessment_id, 'readiness_assessment_no', r.assessment_no,
        'eligibility_no', e.eligibility_no, 'model_version', e.model_version, 'decision', e.decision,
        'requested_amount_cents', e.requested_amount_cents, 'proposed_amount_cents', e.proposed_amount_cents,
        'term_months', e.term_months, 'instalment_cents', e.instalment_cents,
        'max_instalment_cents', e.max_instalment_cents, 'affordability_bps', e.affordability_bps,
        'suggested_min_cents', e.suggested_min_cents, 'suggested_max_cents', e.suggested_max_cents,
        'risk_band', e.risk_band, 'risk_points', e.risk_points, 'confidence', e.confidence,
        'reason_codes', to_jsonb(e.reason_codes), 'inputs', e.inputs, 'assessed_at', private.iso(e.created_at)
      ) into v
      from public.eligibility_assessments e join public.readiness_assessments r on r.id = e.readiness_assessment_id
      where e.id = p_entity_id;

    when 'opportunity' then
      select jsonb_build_object(
        'opportunity_id', o.id, 'entrepreneur_id', o.entrepreneur_id, 'intent_id', o.intent_id,
        'eligibility_id', o.eligibility_id, 'eligibility_no', e.eligibility_no, 'opportunity_no', o.opportunity_no,
        'amount_cents', o.amount_cents, 'term_months', o.term_months, 'instalment_cents', o.instalment_cents,
        'purpose', o.purpose, 'risk_band', o.risk_band, 'confidence', o.confidence,
        'created_at', private.iso(o.created_at)
      ) into v
      from public.qualified_credit_opportunities o join public.eligibility_assessments e on e.id = o.eligibility_id
      where o.id = p_entity_id;

    -- The loan's terms: principal, the partner's rate and term.
    when 'loan' then
      select jsonb_build_object(
        'loan_id', l.id, 'opportunity_id', l.opportunity_id, 'opportunity_no', o.opportunity_no,
        'partner_id', l.partner_id, 'decision_id', l.decision_id, 'principal_cents', l.principal_cents,
        'term_months', l.term_months, 'rate_bps', l.rate_bps, 'instalment_cents', l.instalment_cents,
        'created_at', private.iso(l.created_at)
      ) into v
      from public.loans l join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where l.id = p_entity_id;

    -- A status change, with the partner's decision when it is the approval.
    when 'loan_transition' then
      select jsonb_build_object(
        'loan_event_id', ev.id, 'loan_id', ev.loan_id, 'opportunity_no', o.opportunity_no,
        'from_status', ev.from_status, 'to_status', ev.to_status, 'actor', ev.actor,
        'at', private.iso(ev.created_at),
        'decision', case when ev.to_status = 'PARTNER_APPROVED' then jsonb_build_object(
          'decision_id', d.id, 'partner_id', d.partner_id, 'verdict', d.verdict,
          'approved_amount_cents', d.approved_amount_cents, 'rate_bps', d.rate_bps,
          'term_months', d.term_months, 'decided_by', d.decided_by, 'decided_at', private.iso(d.created_at)
        ) end
      ) into v
      from public.loan_events ev
      join public.loans l on l.id = ev.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      join public.partner_decisions d on d.id = l.decision_id
      where ev.id = p_entity_id;

    when 'payment' then
      select jsonb_build_object(
        'payment_id', p.id, 'loan_id', p.loan_id, 'opportunity_no', o.opportunity_no,
        'instalment_no', p.instalment_no, 'amount_cents', p.amount_cents, 'paid_at', private.iso(p.paid_at)
      ) into v
      from public.payments p
      join public.loans l on l.id = p.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where p.id = p_entity_id;
    -- A productive-outcome measurement: before and after the loan, in the
    -- business's own reported months.
    when 'outcome' then
      select jsonb_build_object(
        'outcome_id', po.id, 'loan_id', po.loan_id, 'opportunity_no', o.opportunity_no, 'outcome_no', po.outcome_no,
        'model_version', po.model_version, 'disbursement_period', po.disbursement_period,
        'months_before', po.months_before, 'months_after', po.months_after,
        'avg_revenue_before_cents', po.avg_revenue_before_cents, 'avg_revenue_after_cents', po.avg_revenue_after_cents,
        'avg_net_before_cents', po.avg_net_before_cents, 'avg_net_after_cents', po.avg_net_after_cents,
        'incremental_profit_cents', po.incremental_profit_cents, 'cost_of_credit_cents', po.cost_of_credit_cents,
        'evc_cents', po.evc_cents, 'capital_use', po.capital_use, 'confidence', po.confidence,
        'measured_at', private.iso(po.measured_at)
      ) into v
      from public.productive_outcomes po
      join public.loans l on l.id = po.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where po.id = p_entity_id;
    -- An investor's allocation: whose wallet, how much, to which
    -- opportunity, from which deposit. The reference whose hash keys the
    -- account on chain is part of it.
    when 'allocation' then
      select jsonb_build_object(
        'investment_id', i.id, 'opportunity_id', i.opportunity_id, 'investor_wallet', i.wallet_address,
        'amount_micro_usdc', i.amount_micro_usdc, 'deposit_signature', i.deposit_signature, 'mode', i.mode,
        'allocation_ref', encode(i.allocation_ref, 'hex'), 'allocated_at', private.iso(i.created_at)
      ) into v
      from public.investments i
      where i.id = p_entity_id;
  end case;

  return v;
end;
$$;

revoke all on function
  public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz)
  to service_role;
revoke all on function public.investor_opportunities(), public.investor_portfolio() from public, anon;
grant execute on function public.investor_opportunities(), public.investor_portfolio() to authenticated;
revoke all on function private.demo_brl_per_usdc_milli(), private.open_for_funding(), private.refund_on_close(),
  private.indicative_yield_bps(public.grade), private.opportunity_code(uuid), private.is_investor_or_overseer(),
  private.funds_loan(uuid) from public;
grant execute on function private.demo_brl_per_usdc_milli(), private.indicative_yield_bps(public.grade),
  private.opportunity_code(uuid), private.is_investor_or_overseer(), private.funds_loan(uuid)
  to authenticated, service_role;

-- ------------------------------------------------------------- demo reset

create or replace function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;

  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  delete from public.investments where true;
  delete from public.productive_outcomes where true;
  delete from public.payments where true;
  delete from public.loan_events where true;
  delete from public.loans where true;
  delete from public.partner_decisions where true;
  delete from public.qualified_credit_opportunities where true;
  delete from public.eligibility_assessments where true;
  delete from public.credit_intents where true;
  delete from public.readiness_assessments where true;
  delete from public.checkins where true;
  delete from public.education_progress where true;
  delete from public.education_programs where true;

  delete from public.communities where true;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32) where true;
  -- Deleting facts left their triggers' costs behind: clear them after too.
  delete from public.cost_events where true;

  return jsonb_build_object('anchors', v_anchors, 'communities', v_communities, 'entrepreneurs', v_entrepreneurs);
end;
$$;
