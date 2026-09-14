-- M5 + M6 · eligibility, opportunity, partner decision, loan, payment
--
-- Readiness becomes capital, with every judgement kept apart:
--   · eligibility_assessments — EmpowerFI's view of a specific requested
--     amount (packages/eligibility-engine, run by eligibility-evaluate);
--   · qualified_credit_opportunities — what EmpowerFI takes to a partner:
--     Product 2 of the business model;
--   · partner_decisions — the partner's own decision, stored separately. A
--     schema that cannot say "eligible, and declined by the partner" cannot
--     describe the business;
--   · loans, loan_events, payments — the lifecycle, under the same state
--     machine the program enforces on chain.
--
-- Partners see what is referred to them, pseudonymously: indicators, the
-- verified community and the sector — never a name, a document or a phone.

create type public.eligibility_decision as enum ('ELIGIBLE', 'ELIGIBLE_REDUCED', 'MANUAL_REVIEW', 'NOT_ELIGIBLE');
create type public.grade as enum ('LOW', 'MEDIUM', 'HIGH');
create type public.opportunity_status as enum ('in_review', 'open', 'referred', 'partner_approved', 'partner_declined', 'withdrawn');
create type public.partner_verdict as enum ('approved', 'declined', 'more_information');
create type public.loan_status as enum ('DRAFT', 'PARTNER_APPROVED', 'DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED');

-- ------------------------------------------------------------------ tables

create table public.eligibility_assessments (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  intent_id uuid not null references public.credit_intents (id) on delete cascade,
  readiness_assessment_id uuid not null references public.readiness_assessments (id) on delete cascade,
  eligibility_no integer not null check (eligibility_no > 0),
  model_version text not null,
  decision public.eligibility_decision not null,
  requested_amount_cents bigint not null,
  proposed_amount_cents bigint,
  term_months smallint,
  instalment_cents bigint,
  max_instalment_cents bigint not null,
  affordability_bps integer,
  suggested_min_cents bigint,
  suggested_max_cents bigint,
  risk_band public.grade not null,
  risk_points smallint not null,
  confidence public.grade not null,
  reason_codes text[] not null,
  -- The engine's input: re-running the engine on it must give this row.
  inputs jsonb not null,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entrepreneur_id, eligibility_no),
  unique (intent_id, readiness_assessment_id)
);

create table public.qualified_credit_opportunities (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  intent_id uuid not null unique references public.credit_intents (id) on delete cascade,
  eligibility_id uuid not null references public.eligibility_assessments (id) on delete cascade,
  opportunity_no integer not null check (opportunity_no > 0),
  amount_cents bigint not null check (amount_cents > 0),
  term_months smallint not null check (term_months between 1 and 24),
  instalment_cents bigint not null,
  purpose public.credit_purpose not null,
  risk_band public.grade not null,
  confidence public.grade not null,
  status public.opportunity_status not null,
  partner_id uuid references public.partners (id),
  referred_at timestamptz,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entrepreneur_id, opportunity_no),
  constraint referral_is_recorded check (
    status not in ('referred', 'partner_approved', 'partner_declined') or (partner_id is not null and referred_at is not null)
  )
);

create table public.partner_decisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.qualified_credit_opportunities (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  verdict public.partner_verdict not null,
  approved_amount_cents bigint check (approved_amount_cents > 0),
  -- The partner's price, monthly, in basis points. Theirs, not EmpowerFI's.
  rate_bps integer check (rate_bps between 0 and 1000),
  term_months smallint check (term_months between 1 and 24),
  reason text check (char_length(reason) <= 500),
  decided_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint approval_has_terms check (
    verdict <> 'approved' or (approved_amount_cents is not null and rate_bps is not null and term_months is not null)
  )
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.qualified_credit_opportunities (id) on delete cascade,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  decision_id uuid not null references public.partner_decisions (id),
  principal_cents bigint not null check (principal_cents > 0),
  term_months smallint not null check (term_months between 1 and 24),
  rate_bps integer not null,
  instalment_cents bigint not null,
  status public.loan_status not null default 'DRAFT',
  disbursed_at timestamptz,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loan_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  from_status public.loan_status not null,
  to_status public.loan_status not null,
  actor uuid references public.profiles (id),
  note text check (char_length(note) <= 500),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  instalment_no smallint not null check (instalment_no > 0),
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz not null,
  recorded_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (loan_id, instalment_no)
);

create index opportunities_partner_idx on public.qualified_credit_opportunities (partner_id, status);
create index loans_partner_idx on public.loans (partner_id, status);
create index loan_events_loan_idx on public.loan_events (loan_id, created_at);

-- ----------------------------------------------------------------- helpers

create function private.my_partner_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select partner_id from public.profiles where id = auth.uid() and role = 'partner' $$;

-- The loan state machine — the same one the program enforces.
create function private.loan_can_become(p_from public.loan_status, p_to public.loan_status)
returns boolean
language sql immutable set search_path = ''
as $$
  select (p_from, p_to) in (
    ('DRAFT'::public.loan_status, 'PARTNER_APPROVED'::public.loan_status),
    ('DRAFT', 'CANCELLED'),
    ('PARTNER_APPROVED', 'DISBURSED'),
    ('PARTNER_APPROVED', 'CANCELLED'),
    ('DISBURSED', 'ACTIVE'),
    ('ACTIVE', 'PAID'),
    ('ACTIVE', 'DEFAULTED')
  )
$$;

-- The newest anchor about a loan, which the next one has to wait for: the
-- chain applies a loan's changes in the order they happened.
create function private.latest_loan_anchor(p_loan_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select max(a.id) from public.chain_anchors a
  where (a.kind = 'loan' and a.entity_id = p_loan_id)
     or (a.kind = 'loan_transition' and a.entity_id in (select id from public.loan_events where loan_id = p_loan_id))
$$;

create function private.anchor_of(p_kind public.anchor_kind, p_entity_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$ select id from public.chain_anchors where kind = p_kind and entity_id = p_entity_id $$;

-- Flat instalment, rounded up: the partner's price over the partner's term.
create function private.flat_instalment(p_principal bigint, p_rate_bps integer, p_term integer)
returns bigint
language sql immutable set search_path = ''
as $$ select ceil(p_principal * (10000 + p_rate_bps * p_term)::numeric / (10000 * p_term))::bigint $$;

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
  end;
end;
$$;

-- The partner a fact concerns, for the kinds a partner takes part in.
create function private.anchor_partner(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'opportunity' then (select partner_id from public.qualified_credit_opportunities where id = p_entity_id)
    when 'loan' then (select partner_id from public.loans where id = p_entity_id)
    when 'loan_transition' then (
      select l.partner_id from public.loan_events e join public.loans l on l.id = e.loan_id where e.id = p_entity_id)
    when 'payment' then (
      select l.partner_id from public.payments p join public.loans l on l.id = p.loan_id where p.id = p_entity_id)
  end;
end;
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
  if private.my_partner_id() is not null then
    return coalesce(private.anchor_partner(p_kind, p_entity_id) = private.my_partner_id(), false);
  end if;
  v_entrepreneur := private.anchor_entrepreneur(p_kind, p_entity_id);
  return coalesce(
    v_entrepreneur = private.my_entrepreneur_id() or private.leads_entrepreneur(v_entrepreneur),
    false
  );
end;
$$;

revoke all on function private.my_partner_id(), private.loan_can_become(public.loan_status, public.loan_status),
  private.latest_loan_anchor(uuid), private.anchor_of(public.anchor_kind, uuid),
  private.flat_instalment(bigint, integer, integer), private.anchor_partner(public.anchor_kind, uuid) from public;
grant execute on function private.my_partner_id(), private.loan_can_become(public.loan_status, public.loan_status),
  private.latest_loan_anchor(uuid), private.anchor_of(public.anchor_kind, uuid),
  private.flat_instalment(bigint, integer, integer), private.anchor_partner(public.anchor_kind, uuid)
  to authenticated, service_role;

-- --------------------------------------------------------------------- RLS

alter table public.eligibility_assessments enable row level security;
alter table public.qualified_credit_opportunities enable row level security;
alter table public.partner_decisions enable row level security;
alter table public.loans enable row level security;
alter table public.loan_events enable row level security;
alter table public.payments enable row level security;

revoke all on public.eligibility_assessments, public.qualified_credit_opportunities, public.partner_decisions,
  public.loans, public.loan_events, public.payments from anon, authenticated;
grant select on public.eligibility_assessments, public.qualified_credit_opportunities, public.partner_decisions,
  public.loans, public.loan_events, public.payments to authenticated;

-- Eligibility is EmpowerFI's assessment: herself, her leaders, auditors, admins.
-- Partners get a summary through partner_pipeline(), not the raw inputs.
create policy eligibility_read on public.eligibility_assessments for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);

create policy opportunities_read on public.qualified_credit_opportunities for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
  or (partner_id is not null and partner_id = (select private.my_partner_id()))
);

create policy decisions_read on public.partner_decisions for select to authenticated using (
  partner_id = (select private.my_partner_id())
  or (select private.is_auditor_or_admin())
  or exists (
    select 1 from public.qualified_credit_opportunities o
    where o.id = opportunity_id
      and (o.entrepreneur_id = (select private.my_entrepreneur_id()) or (select private.leads_entrepreneur(o.entrepreneur_id)))
  )
);

create policy loans_read on public.loans for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or partner_id = (select private.my_partner_id())
  or (select private.is_auditor_or_admin())
);

create policy loan_events_read on public.loan_events for select to authenticated using (
  exists (select 1 from public.loans l where l.id = loan_id)  -- visible through loans' own policy
);

create policy payments_read on public.payments for select to authenticated using (
  exists (select 1 from public.loans l where l.id = loan_id)
);

-- ------------------------------------------------------------ eligibility

-- The engine's inputs for her active request. Only for someone in the credit
-- pipeline (ready AND asked): eligibility never runs on readiness alone.
create function public.eligibility_inputs(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_intent public.credit_intents;
  v_ready public.readiness_assessments;
begin
  if not private.can_act_for(p_entrepreneur_id) then
    raise exception 'not_allowed_to_assess' using errcode = '42501';
  end if;
  if not exists (select 1 from private.credit_pipeline() where entrepreneur_id = p_entrepreneur_id) then
    raise exception 'not_in_credit_pipeline' using errcode = 'P0001';
  end if;

  select * into v_intent from public.credit_intents where entrepreneur_id = p_entrepreneur_id and status = 'active';
  select * into v_ready from public.readiness_assessments
  where entrepreneur_id = p_entrepreneur_id order by assessment_no desc limit 1;

  return jsonb_build_object(
    'intent_id', v_intent.id,
    'readiness_assessment_id', v_ready.id,
    'input', jsonb_build_object(
      'readiness_status', v_ready.status,
      'readiness_band', v_ready.band,
      'requested_amount_cents', v_intent.requested_amount_cents,
      'purpose', v_intent.purpose,
      'months_reported', (v_ready.features ->> 'months_reported')::integer,
      'records_kept_bps', (v_ready.features ->> 'records_kept_bps')::integer,
      'inconsistencies', (v_ready.features ->> 'inconsistencies')::integer,
      'avg_revenue_cents', (v_ready.features ->> 'avg_revenue_cents')::bigint,
      'avg_net_business_cents', (v_ready.features ->> 'avg_net_business_cents')::bigint,
      'avg_household_cents', (v_ready.features ->> 'avg_household_cents')::bigint,
      'revenue_cv_bps', (v_ready.features ->> 'revenue_cv_bps')::integer,
      'revenue_trend_bps', (v_ready.features ->> 'revenue_trend_bps')::integer,
      'household_share_bps', (v_ready.features ->> 'household_share_bps')::integer
    )
  );
end;
$$;

-- The partner best placed for an opportunity: active, and whose ticket range
-- and purposes cover it.
create function private.match_partner(p_amount bigint, p_purpose public.credit_purpose)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.partners
  where active and p_amount between min_ticket_cents and max_ticket_cents
    and (cardinality(accepted_purposes) = 0 or p_purpose::text = any (accepted_purposes))
  order by created_at
  limit 1
$$;

-- Records the engine's eligibility for her active request (service role only)
-- and, unless it is NOT_ELIGIBLE, the qualified opportunity — referred to a
-- matching partner at once, or held for EmpowerFI's review when the rules
-- were not confident. Asking again for the same request and the same
-- readiness returns what was recorded.
create function public.record_eligibility_assessment(
  p_entrepreneur_id uuid,
  p_intent_id uuid,
  p_readiness_assessment_id uuid,
  p_inputs jsonb,
  p_result jsonb,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_existing public.eligibility_assessments;
  v_row public.eligibility_assessments;
  v_opportunity public.qualified_credit_opportunities;
  v_partner uuid;
  v_intent public.credit_intents;
begin
  perform 1 from public.entrepreneurs where id = p_entrepreneur_id for update;

  select * into v_existing from public.eligibility_assessments
  where intent_id = p_intent_id and readiness_assessment_id = p_readiness_assessment_id;
  if found then
    select * into v_opportunity from public.qualified_credit_opportunities where intent_id = p_intent_id;
    return jsonb_build_object('id', v_existing.id, 'eligibility_no', v_existing.eligibility_no,
      'opportunity_id', v_opportunity.id, 'reused', true);
  end if;

  select * into v_intent from public.credit_intents where id = p_intent_id and entrepreneur_id = p_entrepreneur_id;
  if not found then
    raise exception 'intent_not_found' using errcode = 'P0002';
  end if;

  insert into public.eligibility_assessments (
    entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version, decision,
    requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
    affordability_bps, suggested_min_cents, suggested_max_cents, risk_band, risk_points, confidence,
    reason_codes, inputs, is_simulated, created_at
  ) values (
    p_entrepreneur_id, p_intent_id, p_readiness_assessment_id,
    coalesce((select max(eligibility_no) from public.eligibility_assessments where entrepreneur_id = p_entrepreneur_id), 0) + 1,
    p_result ->> 'model_version',
    (p_result ->> 'decision')::public.eligibility_decision,
    (p_result ->> 'requested_amount_cents')::bigint,
    (p_result ->> 'proposed_amount_cents')::bigint,
    (p_result ->> 'term_months')::smallint,
    (p_result ->> 'instalment_cents')::bigint,
    (p_result ->> 'max_instalment_cents')::bigint,
    (p_result ->> 'affordability_bps')::integer,
    (p_result ->> 'suggested_min_cents')::bigint,
    (p_result ->> 'suggested_max_cents')::bigint,
    (p_result ->> 'risk_band')::public.grade,
    (p_result ->> 'risk_points')::smallint,
    (p_result ->> 'confidence')::public.grade,
    array(select jsonb_array_elements_text(p_result -> 'reason_codes')),
    p_inputs, p_is_simulated, p_created_at
  )
  returning * into v_row;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('eligibility', v_row.id, private.anchor_of('readiness', p_readiness_assessment_id));

  if v_row.decision <> 'NOT_ELIGIBLE' and not exists (
    select 1 from public.qualified_credit_opportunities where intent_id = p_intent_id
  ) then
    v_partner := case when v_row.decision = 'MANUAL_REVIEW' then null
                      else private.match_partner(v_row.proposed_amount_cents, v_intent.purpose) end;
    insert into public.qualified_credit_opportunities (
      entrepreneur_id, intent_id, eligibility_id, opportunity_no, amount_cents, term_months, instalment_cents,
      purpose, risk_band, confidence, status, partner_id, referred_at, is_simulated, created_at
    ) values (
      p_entrepreneur_id, p_intent_id, v_row.id,
      coalesce((select max(opportunity_no) from public.qualified_credit_opportunities where entrepreneur_id = p_entrepreneur_id), 0) + 1,
      v_row.proposed_amount_cents, v_row.term_months, v_row.instalment_cents, v_intent.purpose,
      v_row.risk_band, v_row.confidence,
      (case when v_row.decision = 'MANUAL_REVIEW' then 'in_review'
            when v_partner is null then 'open' else 'referred' end)::public.opportunity_status,
      v_partner, case when v_partner is not null then p_created_at end,
      p_is_simulated, p_created_at
    )
    returning * into v_opportunity;

    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('opportunity', v_opportunity.id, private.anchor_of('eligibility', v_row.id));
  end if;

  return jsonb_build_object('id', v_row.id, 'eligibility_no', v_row.eligibility_no,
    'opportunity_id', v_opportunity.id, 'partner_id', v_opportunity.partner_id, 'reused', false);
end;
$$;

-- An admin clears an opportunity the rules sent for review, and refers it.
create function public.refer_opportunity(p_opportunity_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_opportunity public.qualified_credit_opportunities;
  v_partner uuid;
begin
  if not private.is_admin() then
    raise exception 'only_admins_refer' using errcode = '42501';
  end if;
  select * into v_opportunity from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found or v_opportunity.status not in ('in_review', 'open') then
    raise exception 'opportunity_not_referable' using errcode = 'P0001';
  end if;
  v_partner := private.match_partner(v_opportunity.amount_cents, v_opportunity.purpose);
  if v_partner is null then
    raise exception 'no_matching_partner' using errcode = 'P0001';
  end if;
  update public.qualified_credit_opportunities
  set status = 'referred', partner_id = v_partner, referred_at = now()
  where id = p_opportunity_id;
  return v_partner;
end;
$$;

-- ----------------------------------------------------------- the partner

-- What a partner sees of the opportunities referred to it: the request, the
-- eligibility summary, readiness indicators, the verified community and the
-- sector. No name, no business name, no raw monthly figures.
create function public.partner_pipeline()
returns table (
  opportunity_id uuid,
  participant text,
  status public.opportunity_status,
  amount_cents bigint,
  term_months smallint,
  instalment_cents bigint,
  purpose public.credit_purpose,
  risk_band public.grade,
  confidence public.grade,
  eligibility_decision public.eligibility_decision,
  max_instalment_cents bigint,
  affordability_bps integer,
  suggested_min_cents bigint,
  suggested_max_cents bigint,
  eligibility_reasons text[],
  readiness_band public.readiness_band,
  months_reported integer,
  avg_revenue_cents bigint,
  avg_net_business_cents bigint,
  revenue_cv_bps integer,
  business_sector text,
  community_name text,
  community_city text,
  community_state text,
  referred_at timestamptz,
  is_simulated boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    o.id,
    'P-' || upper(left(replace(o.entrepreneur_id::text, '-', ''), 6)),
    o.status, o.amount_cents, o.term_months, o.instalment_cents, o.purpose, o.risk_band, o.confidence,
    e.decision, e.max_instalment_cents, e.affordability_bps, e.suggested_min_cents, e.suggested_max_cents,
    e.reason_codes,
    r.band,
    (r.features ->> 'months_reported')::integer,
    -- Rounded to R$ 100: enough to judge, not a ledger.
    round((r.features ->> 'avg_revenue_cents')::numeric, -4)::bigint,
    round((r.features ->> 'avg_net_business_cents')::numeric, -4)::bigint,
    (r.features ->> 'revenue_cv_bps')::integer,
    en.business_sector,
    c.name, c.city, c.state,
    o.referred_at, o.is_simulated
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments e on e.id = o.eligibility_id
  join public.readiness_assessments r on r.id = e.readiness_assessment_id
  join public.entrepreneurs en on en.id = o.entrepreneur_id
  left join lateral (
    select co.name, co.city, co.state from public.community_memberships m
    join public.communities co on co.id = m.community_id
    where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified'
    order by m.joined_at limit 1
  ) c on true
  where o.partner_id is not null
    and (o.partner_id = private.my_partner_id() or private.is_auditor_or_admin())
  order by o.referred_at desc
$$;

-- The partner's decision on a referred opportunity. Only that partner's own
-- users decide; EmpowerFI does not. An approval opens the loan in DRAFT and
-- moves it to PARTNER_APPROVED, each step queued for the chain.
create function public.partner_decide(
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
  v_loan public.loans;
  v_event uuid;
begin
  select * into v_opportunity from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  -- The caller must act for a partner, and for this one. (Two nulls must not
  -- pass as a match: an admin has no partner, nor does an unreferred opportunity.)
  if not found or private.my_partner_id() is null or v_opportunity.partner_id is distinct from private.my_partner_id() then
    raise exception 'not_your_opportunity' using errcode = '42501';
  end if;
  if v_opportunity.status <> 'referred' then
    raise exception 'opportunity_not_awaiting_decision' using errcode = 'P0001';
  end if;
  if p_verdict = 'approved' and p_approved_amount_cents > v_opportunity.amount_cents then
    raise exception 'approval_above_opportunity' using errcode = '22023';
  end if;

  insert into public.partner_decisions (
    opportunity_id, partner_id, verdict, approved_amount_cents, rate_bps, term_months, reason, decided_by
  ) values (
    p_opportunity_id, v_opportunity.partner_id, p_verdict,
    case when p_verdict = 'approved' then p_approved_amount_cents end,
    case when p_verdict = 'approved' then p_rate_bps end,
    case when p_verdict = 'approved' then p_term_months end,
    nullif(trim(p_reason), ''), auth.uid()
  )
  returning id into v_decision;

  if p_verdict = 'declined' then
    update public.qualified_credit_opportunities set status = 'partner_declined' where id = p_opportunity_id;
  elsif p_verdict = 'approved' then
    update public.qualified_credit_opportunities set status = 'partner_approved' where id = p_opportunity_id;

    insert into public.loans (
      opportunity_id, entrepreneur_id, partner_id, decision_id, principal_cents, term_months, rate_bps, instalment_cents
    ) values (
      p_opportunity_id, v_opportunity.entrepreneur_id, v_opportunity.partner_id, v_decision,
      p_approved_amount_cents, p_term_months, p_rate_bps,
      private.flat_instalment(p_approved_amount_cents, p_rate_bps, p_term_months)
    )
    returning * into v_loan;
    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('loan', v_loan.id, private.anchor_of('opportunity', p_opportunity_id));

    insert into public.loan_events (loan_id, from_status, to_status, actor, note)
    values (v_loan.id, 'DRAFT', 'PARTNER_APPROVED', auth.uid(), 'Partner decision')
    returning id into v_event;
    update public.loans set status = 'PARTNER_APPROVED', updated_at = now() where id = v_loan.id;
    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('loan_transition', v_event, private.latest_loan_anchor(v_loan.id));
  end if;

  return v_decision;
end;
$$;

-- Moves a loan along its state machine: its partner, or an admin. Approval
-- only ever comes from partner_decide.
create function public.transition_loan(p_loan_id uuid, p_to public.loan_status, p_note text default null)
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

-- Records an instalment paid: the loan's partner (its servicing data), or an admin.
create function public.record_payment(
  p_loan_id uuid,
  p_instalment_no integer,
  p_amount_cents bigint,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_id uuid;
  v_previous bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found or not (v_loan.partner_id = private.my_partner_id() or private.is_admin()) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;
  if v_loan.status not in ('DISBURSED', 'ACTIVE') then
    raise exception 'loan_not_repaying' using errcode = 'P0001';
  end if;
  if p_instalment_no < 1 or p_instalment_no > v_loan.term_months then
    raise exception 'invalid_instalment' using errcode = '22023';
  end if;

  v_previous := private.latest_loan_anchor(p_loan_id);
  begin
    insert into public.payments (loan_id, instalment_no, amount_cents, paid_at, recorded_by)
    values (p_loan_id, p_instalment_no, p_amount_cents, p_paid_at, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'instalment_already_paid' using errcode = '23505';
  end;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('payment', v_id, v_previous);
  return v_id;
end;
$$;

-- --------------------------------------------------------------- payloads

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
  end case;

  return v;
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function
  public.eligibility_inputs(uuid),
  public.refer_opportunity(uuid),
  public.partner_pipeline(),
  public.partner_decide(uuid, public.partner_verdict, bigint, integer, integer, text),
  public.transition_loan(uuid, public.loan_status, text),
  public.record_payment(uuid, integer, bigint, timestamptz)
from public, anon;
grant execute on function
  public.eligibility_inputs(uuid),
  public.refer_opportunity(uuid),
  public.partner_pipeline(),
  public.partner_decide(uuid, public.partner_verdict, bigint, integer, integer, text),
  public.transition_loan(uuid, public.loan_status, text),
  public.record_payment(uuid, integer, bigint, timestamptz)
to authenticated;

revoke all on function
  public.record_eligibility_assessment(uuid, uuid, uuid, jsonb, jsonb, boolean, timestamptz),
  private.match_partner(bigint, public.credit_purpose)
from public, anon, authenticated;
grant execute on function
  public.record_eligibility_assessment(uuid, uuid, uuid, jsonb, jsonb, boolean, timestamptz),
  private.match_partner(bigint, public.credit_purpose)
to service_role;
