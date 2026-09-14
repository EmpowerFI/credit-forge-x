-- M10 · productive outcomes
--
-- Success is not only repayment. After a loan reaches the business, EmpowerFI
-- measures what changed, from the months she reports anyway: sales and result
-- in the three months before the loan's month against the months after it.
--
--   incremental profit = (average monthly result after − before) × months after
--   cost of credit     = interest in the instalments paid so far
--   EVC                = incremental profit − cost of credit
--   EVM                = EVC / principal
--
-- An observation, not a causal claim: a business can grow for reasons that
-- have nothing to do with the loan, and the screens say so. Every measurement
-- is anchored (OutcomeCommitment); its figures stay here.

create type public.capital_use as enum ('as_declared', 'partly_as_declared', 'other_use', 'not_reported');

create table public.productive_outcomes (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  outcome_no smallint not null check (outcome_no > 0),
  model_version text not null,
  -- The loan's month; "before" and "after" exclude it.
  disbursement_period text not null check (disbursement_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  months_before smallint not null,
  months_after smallint not null,
  avg_revenue_before_cents bigint not null,
  avg_revenue_after_cents bigint not null,
  avg_net_before_cents bigint not null,
  avg_net_after_cents bigint not null,
  incremental_profit_cents bigint not null,
  cost_of_credit_cents bigint not null,
  evc_cents bigint not null,
  capital_use public.capital_use not null,
  confidence public.grade not null,
  is_simulated boolean not null default false,
  measured_by uuid references public.profiles (id),
  measured_at timestamptz not null default now(),
  unique (loan_id, outcome_no)
);

create index productive_outcomes_entrepreneur_idx on public.productive_outcomes (entrepreneur_id);

alter table public.productive_outcomes enable row level security;
revoke all on public.productive_outcomes from anon, authenticated;
grant select on public.productive_outcomes to authenticated;

-- Herself, her community's leaders, the loan's partner, auditors and admins.
-- Capital providers see outcomes only in aggregate (capital_portfolio).
create policy productive_outcomes_read on public.productive_outcomes for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
  or exists (select 1 from public.loans l where l.id = loan_id and l.partner_id = (select private.my_partner_id()))
);

-- ------------------------------------------------------------- measurement

create function private.month_of(p_at timestamptz)
returns text
language sql immutable set search_path = ''
as $$ select to_char(p_at at time zone 'America/Sao_Paulo', 'YYYY-MM') $$;

-- Measures a loan's outcome from her check-ins. EmpowerFI (an admin) or the
-- loan's partner; the service role for the seed. Needs two reported months on
-- each side of the loan's month.
create function public.measure_outcome(
  p_loan_id uuid,
  p_capital_use public.capital_use default 'not_reported'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_month text;
  v_before record;
  v_after record;
  v_paid integer;
  v_no smallint;
  v_id uuid;
  v_incremental bigint;
  v_cost bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'loan_not_found' using errcode = 'P0002';
  end if;
  if not (coalesce(auth.role(), '') = 'service_role' or private.is_admin()
          or v_loan.partner_id = private.my_partner_id()) then
    raise exception 'not_allowed_to_measure' using errcode = '42501';
  end if;
  if v_loan.status not in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') or v_loan.disbursed_at is null then
    raise exception 'loan_not_disbursed' using errcode = 'P0001';
  end if;

  v_month := private.month_of(v_loan.disbursed_at);
  select count(*)::int as n,
         round(avg(revenue_cents))::bigint as revenue,
         round(avg(revenue_cents - cogs_cents - opex_cents))::bigint as net,
         bool_and(keeps_records) as records,
         bool_or(is_simulated) as simulated
    into v_before
    from (select * from public.checkins where entrepreneur_id = v_loan.entrepreneur_id and period < v_month
          order by period desc limit 3) c;
  select count(*)::int as n,
         round(avg(revenue_cents))::bigint as revenue,
         round(avg(revenue_cents - cogs_cents - opex_cents))::bigint as net,
         bool_and(keeps_records) as records,
         bool_or(is_simulated) as simulated
    into v_after
    from public.checkins where entrepreneur_id = v_loan.entrepreneur_id and period > v_month;
  if v_before.n < 2 or v_after.n < 2 then
    raise exception 'not_enough_history' using errcode = 'P0001';
  end if;

  -- Interest is what an instalment carries beyond its even share of principal.
  select count(*)::int into v_paid from public.payments where loan_id = p_loan_id;
  v_cost := v_paid * (v_loan.instalment_cents - round(v_loan.principal_cents::numeric / v_loan.term_months)::bigint);
  v_incremental := (v_after.net - v_before.net) * v_after.n;
  select coalesce(max(outcome_no), 0) + 1 into v_no from public.productive_outcomes where loan_id = p_loan_id;

  insert into public.productive_outcomes (
    loan_id, entrepreneur_id, outcome_no, model_version, disbursement_period, months_before, months_after,
    avg_revenue_before_cents, avg_revenue_after_cents, avg_net_before_cents, avg_net_after_cents,
    incremental_profit_cents, cost_of_credit_cents, evc_cents, capital_use, confidence, is_simulated, measured_by
  ) values (
    p_loan_id, v_loan.entrepreneur_id, v_no, 'outcome-v0.1.0', v_month, v_before.n, v_after.n,
    v_before.revenue, v_after.revenue, v_before.net, v_after.net,
    v_incremental, v_cost, v_incremental - v_cost, p_capital_use,
    case when v_before.n >= 3 and v_after.n >= 3 and v_before.records and v_after.records then 'HIGH'
         when v_before.records or v_after.records then 'MEDIUM'
         else 'LOW' end::public.grade,
    coalesce(v_loan.is_simulated or v_before.simulated or v_after.simulated, false),
    auth.uid()
  ) returning id into v_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('outcome', v_id, private.latest_loan_anchor(p_loan_id));
  return v_id;
end;
$$;

revoke all on function public.measure_outcome(uuid, public.capital_use) from public, anon;
grant execute on function public.measure_outcome(uuid, public.capital_use) to authenticated, service_role;
revoke all on function private.month_of(timestamptz) from public;
grant execute on function private.month_of(timestamptz) to authenticated, service_role;

-- Measuring costs a follow-up conversation.
insert into public.cost_rates (stage, staff_minutes, hourly_rate_cents, fixed_cents, borne_by, phase, note) values
  ('outcome_measurement', 20, 3000, 0, 'empowerfi', 'servicing', 'Follow-up on use of capital and results');

create function private.cost_on_outcome() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('outcome_measurement', new.id, new.entrepreneur_id, null, new.is_simulated, new.measured_at);
  return new;
end $$;
create trigger cost_on_outcome after insert on public.productive_outcomes
  for each row execute function private.cost_on_outcome();
revoke all on function private.cost_on_outcome() from public;

-- ---------------------------------------------------------- anchor helpers

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
  end;
end;
$$;

create or replace function private.anchor_partner(p_kind public.anchor_kind, p_entity_id uuid)
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
    when 'outcome' then (
      select l.partner_id from public.productive_outcomes po join public.loans l on l.id = po.loan_id where po.id = p_entity_id)
  end;
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
  end case;

  return v;
end;
$$;


-- ------------------------------------------------------- the capital view
-- Outcomes in aggregate: how many measured, how many grew, EVC and EVM.

create or replace function public.capital_portfolio()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_partners uuid[];
  v_committed bigint;
  v_target integer;
  v_simulated boolean;
  v jsonb;
begin
  if private.is_auditor_or_admin() then
    select array_agg(distinct partner_id), sum(committed_cents),
           round(sum(committed_cents::numeric * target_return_bps) / nullif(sum(committed_cents), 0)),
           coalesce(bool_or(is_simulated), false)
      into v_partners, v_committed, v_target, v_simulated
      from public.capital_commitments;
  elsif private.my_role() = 'capital_provider' then
    select array_agg(distinct partner_id), sum(committed_cents),
           round(sum(committed_cents::numeric * target_return_bps) / nullif(sum(committed_cents), 0)),
           coalesce(bool_or(is_simulated), false)
      into v_partners, v_committed, v_target, v_simulated
      from public.capital_commitments where provider_id = auth.uid();
  else
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  v_partners := coalesce(v_partners, '{}');
  v_committed := coalesce(v_committed, 0);

  with book as (
    select
      l.*, o.risk_band, o.purpose, o.confidence,
      (select count(*) from public.payments p where p.loan_id = l.id)::integer as paid,
      (select coalesce(sum(p.amount_cents), 0) from public.payments p where p.loan_id = l.id) as received_cents,
      (select min(e.created_at) from public.loan_events e where e.loan_id = l.id and e.to_status = 'ACTIVE') as active_since,
      (select m.community_id from public.community_memberships m
        where m.entrepreneur_id = l.entrepreneur_id order by m.joined_at, m.community_id limit 1) as community_id,
      l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') as deployed
    from public.loans l
    join public.qualified_credit_opportunities o on o.id = l.opportunity_id
    where l.partner_id = any (v_partners)
  ),
  priced as (
    select b.*,
      -- A flat instalment repays principal evenly; the rest is interest.
      case when b.deployed then round(b.principal_cents::numeric * least(b.paid, b.term_months) / b.term_months) else 0 end as principal_repaid,
      -- Instalments fall due monthly from the start of repayment.
      case when b.active_since is null then 0
        else least(b.term_months, (
          select count(*) from generate_series(1, b.term_months) n
          where b.active_since + make_interval(months => n) <= now()))::integer
      end as due,
      case when b.active_since is null or b.status <> 'ACTIVE' then false
        else exists (
          select 1 from generate_series(b.paid + 1, b.term_months) n
          where b.active_since + make_interval(months => n) + interval '30 days' < now())
      end as over_30
    from book b
  ),
  sums as (
    select
      count(*) filter (where deployed) as loans,
      coalesce(sum(principal_cents) filter (where deployed), 0) as deployed_cents,
      coalesce(sum(principal_cents) filter (where status = 'PARTNER_APPROVED'), 0) as approved_cents,
      count(*) filter (where status = 'PARTNER_APPROVED') as approved,
      coalesce(sum(received_cents), 0) as received_cents,
      coalesce(sum(principal_repaid), 0) as principal_repaid_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where status in ('DISBURSED', 'ACTIVE')), 0) as outstanding_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where status = 'DEFAULTED'), 0) as defaulted_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where over_30), 0) as par30_cents,
      coalesce(sum(due), 0) as instalments_due,
      coalesce(sum(least(paid, due)), 0) as instalments_paid_of_due,
      coalesce(sum(paid), 0) as instalments_received,
      coalesce(sum(instalment_cents * term_months - principal_cents) filter (where deployed), 0) as scheduled_interest_cents,
      coalesce(sum(round(principal_cents::numeric * private.expected_loss_bps(risk_band) / 10000)) filter (where deployed), 0) as expected_loss_cents,
      coalesce(sum(principal_cents::numeric * term_months) filter (where deployed), 0) as principal_months
    from priced
  ),
  scope as (
    -- Everyone in the communities the portfolio lends in: the cost of
    -- preparing those who never borrowed belongs to the loans too.
    select distinct m.entrepreneur_id
    from public.community_memberships m
    where m.community_id in (
      select m2.community_id from public.community_memberships m2
      where m2.entrepreneur_id in (select entrepreneur_id from book where deployed))
  ),
  cost as (
    select
      coalesce(sum(ce.amount_cents), 0) as total_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'preparation'), 0) as preparation_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'origination'), 0) as origination_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'servicing'), 0) as servicing_cents
    from public.cost_events ce
    where ce.entrepreneur_id in (select entrepreneur_id from scope)
       or ce.community_id in (select m.community_id from public.community_memberships m where m.entrepreneur_id in (select entrepreneur_id from scope))
  ),
  facts as (
    select 'loan'::public.anchor_kind as kind, id from book
    union all select 'loan_transition', e.id from public.loan_events e where e.loan_id in (select id from book)
    union all select 'payment', p.id from public.payments p where p.loan_id in (select id from book)
    union all select 'outcome', po.id from public.productive_outcomes po where po.loan_id in (select id from book)
  ),
  outs as (
    -- The latest measurement of each loan in the book.
    select distinct on (po.loan_id) po.*, b.principal_cents
    from public.productive_outcomes po join book b on b.id = po.loan_id
    order by po.loan_id, po.outcome_no desc
  ),
  outcome_sums as (
    select
      count(*) as measured,
      count(*) filter (where avg_revenue_after_cents > avg_revenue_before_cents) as sales_up,
      count(*) filter (where avg_net_after_cents > avg_net_before_cents) as profit_up,
      count(*) filter (where capital_use = 'as_declared') as as_declared,
      count(*) filter (where capital_use <> 'not_reported') as use_reported,
      coalesce(sum(evc_cents), 0) as evc_cents,
      coalesce(sum(incremental_profit_cents), 0) as incremental_profit_cents,
      coalesce(sum(cost_of_credit_cents), 0) as cost_of_credit_cents,
      coalesce(sum(principal_cents), 0) as measured_principal_cents,
      round(avg(case when avg_revenue_before_cents > 0
        then (avg_revenue_after_cents - avg_revenue_before_cents) * 10000.0 / avg_revenue_before_cents end)) as avg_revenue_change_bps,
      bool_or(is_simulated) as simulated
    from outs
  ),
  audit as (
    select
      count(*) as facts,
      count(a.id) filter (where a.status = 'confirmed') as confirmed,
      count(a.id) filter (where a.reconcile = 'verified') as reconciled,
      count(a.id) filter (where a.reconcile in ('missing', 'mismatch')) as discrepancies
    from facts f
    left join public.chain_anchors a on a.kind = f.kind and a.entity_id = f.id
  )
  select jsonb_build_object(
    'is_simulated', v_simulated,
    'committed_cents', v_committed,
    'target_return_bps', v_target,
    'deployed_cents', s.deployed_cents,
    'available_cents', greatest(0, v_committed - s.deployed_cents + s.principal_repaid_cents),
    'approved_not_disbursed_cents', s.approved_cents,
    'approved_not_disbursed', s.approved,
    'received_cents', s.received_cents,
    'principal_repaid_cents', s.principal_repaid_cents,
    'outstanding_cents', s.outstanding_cents,
    'defaulted_cents', s.defaulted_cents,
    'loans', s.loans,
    'average_ticket_cents', case when s.loans > 0 then round(s.deployed_cents::numeric / s.loans) end,
    'repayment', jsonb_build_object(
      'instalments_received', s.instalments_received,
      'instalments_due', s.instalments_due,
      'on_time_bps', case when s.instalments_due > 0 then round(s.instalments_paid_of_due * 10000.0 / s.instalments_due) end,
      'par30_cents', s.par30_cents,
      'par30_bps', case when s.outstanding_cents > 0 then round(s.par30_cents * 10000.0 / s.outstanding_cents) else 0 end
    ),
    'expected', jsonb_build_object(
      'interest_cents', s.scheduled_interest_cents,
      'loss_cents', s.expected_loss_cents,
      'net_cents', s.scheduled_interest_cents - s.expected_loss_cents,
      -- Net return a year on the capital deployed, over the loans' terms.
      'net_return_bps_year', case when s.principal_months > 0
        then round((s.scheduled_interest_cents - s.expected_loss_cents) * 120000.0 / s.principal_months) end,
      'loss_bps_by_band', jsonb_build_object('LOW', private.expected_loss_bps('LOW'), 'MEDIUM', private.expected_loss_bps('MEDIUM'), 'HIGH', private.expected_loss_bps('HIGH'))
    ),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from book group by status) x),
    'by_risk', (
      select coalesce(jsonb_object_agg(risk_band, jsonb_build_object('loans', n, 'principal_cents', cents)), '{}')
      from (select risk_band, count(*) n, sum(principal_cents) cents from book where deployed group by risk_band) x
    ),
    'by_purpose', (
      select coalesce(jsonb_object_agg(purpose, jsonb_build_object('loans', n, 'principal_cents', cents)), '{}')
      from (select purpose, count(*) n, sum(principal_cents) cents from book where deployed group by purpose) x
    ),
    'by_community', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'city', c.city, 'state', c.state,
        'verified', c.status = 'verified', 'loans', x.n, 'principal_cents', x.cents) order by x.cents desc), '[]')
      from (select community_id, count(*) n, sum(principal_cents) cents from book where deployed group by community_id) x
      join public.communities c on c.id = x.community_id
    ),
    'cost', jsonb_build_object(
      'total_cents', c.total_cents,
      'by_phase', jsonb_build_object('preparation', c.preparation_cents, 'origination', c.origination_cents, 'servicing', c.servicing_cents),
      'per_loan_cents', case when s.loans > 0 then round(c.total_cents::numeric / s.loans) end,
      'per_1000_deployed_cents', case when s.deployed_cents > 0 then round(c.total_cents * 100000.0 / s.deployed_cents) end
    ),
    'outcomes', jsonb_build_object(
      'measured', os.measured,
      'sales_up', os.sales_up,
      'profit_up', os.profit_up,
      'as_declared', os.as_declared,
      'use_reported', os.use_reported,
      'avg_revenue_change_bps', os.avg_revenue_change_bps,
      'incremental_profit_cents', os.incremental_profit_cents,
      'cost_of_credit_cents', os.cost_of_credit_cents,
      'evc_cents', os.evc_cents,
      'evm_bps', case when os.measured_principal_cents > 0 then round(os.evc_cents * 10000.0 / os.measured_principal_cents) end,
      'measured_principal_cents', os.measured_principal_cents,
      'is_simulated', coalesce(os.simulated, false)
    ),
    'audit', jsonb_build_object('facts', a.facts, 'confirmed', a.confirmed, 'reconciled', a.reconciled, 'discrepancies', a.discrepancies),
    'book', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'loan_id', p.id,
        'code', 'L-' || upper(substr(encode(extensions.digest('loan:' || p.id::text, 'sha256'), 'hex'), 1, 6)),
        'status', p.status, 'principal_cents', p.principal_cents, 'term_months', p.term_months,
        'rate_bps', p.rate_bps, 'instalment_cents', p.instalment_cents, 'paid', p.paid,
        'risk_band', p.risk_band, 'purpose', p.purpose,
        'community_name', (select c.name from public.communities c where c.id = p.community_id),
        'disbursed_at', private.iso(p.disbursed_at), 'over_30', p.over_30,
        'evc_cents', (select o2.evc_cents from outs o2 where o2.loan_id = p.id)
      ) order by p.created_at desc), '[]')
      from priced p
    )
  ) into v
  from sums s, cost c, audit a, outcome_sums os;

  return v;
end;
$$;
