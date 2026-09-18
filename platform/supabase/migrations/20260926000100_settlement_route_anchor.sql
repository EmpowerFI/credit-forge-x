/*
 * The routing decision, proven on Solana.
 *
 * It shipped recorded and labelled "derived", because a new proof kind means
 * changing the Anchor program and upgrading it on devnet. The founder asked
 * for the proof, so here it is: `SettlementRouteCommitment`, seeded by the
 * loan, holding which of the two routes paid it and a commitment over the
 * whole decision — both quotes as the comparator saw them, their costs, the
 * reasons and the model version.
 *
 * The chain gets the route and a hash. Not a provider, not an amount, not a
 * rate, not anyone's identity: those stay in the tables, behind the row-level
 * security they already had. And no BRS transaction is invented — this proves
 * that a decision was taken, never that a token moved.
 */

-- ------------------------------------------------------------- the payload

create or replace function private.anchor_payload(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  case p_kind
    -- The decision as the comparator wrote it: `quotes` is the `compared`
    -- column verbatim, not a re-reading of the quote rows, so the commitment
    -- recomputed in the browser matches the one that was sent.
    when 'settlement_route' then
      select jsonb_build_object(
        'loan_id', d.loan_id, 'opportunity_no', o.opportunity_no,
        'selected_route', d.selected_route, 'model_version', d.model_version,
        'reason_codes', to_jsonb(d.reason_codes),
        'compared_gross_micro_usdc', d.compared_gross_micro_usdc,
        'net_brl_delta_cents', d.net_brl_delta_cents, 'principal_cents', d.principal_cents,
        'quotes', d.compared, 'decided_at', private.iso(d.decided_at)
      ) into v
      from public.settlement_decisions d
      join public.loans l on l.id = d.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where d.loan_id = p_entity_id;

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
    -- One consent record: each scope she allowed or refused, the wording's
    -- version, how it was given and by whom.
    when 'consent' then
      select jsonb_build_object(
        'consent_id', k.id, 'entrepreneur_id', k.entrepreneur_id, 'consent_no', k.consent_no,
        'text_version', k.text_version,
        'scopes', jsonb_build_object('assessment', k.assessment, 'partner', k.partner,
          'investors', k.investors, 'impact', k.impact),
        'channel', k.channel, 'recorded_by', k.recorded_by, 'recorded_at', private.iso(k.created_at)
      ) into v
      from public.consents k
      where k.id = p_entity_id;
  end case;

  return v;
end;
$$;

-- --------------------------------------------------------- who may read it

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
  -- The desk that holds the loan, an investor who funds it, an auditor or an
  -- admin. Never the entrepreneur: her side of settlement is reais and Pix,
  -- and the quotes behind it were never hers to read (PRIVACY.md).
  if p_kind = 'settlement_route' then
    return coalesce(
      private.funds_loan(p_entity_id)
      or exists (select 1 from public.loans l where l.id = p_entity_id and l.partner_id = private.my_partner_id()),
      false
    );
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

-- The loan's borrower and desk, so the Edge Function derives its account
-- from the same chain of PDAs every other loan proof uses.

create or replace function private.anchor_entrepreneur(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'settlement_route' then (select entrepreneur_id from public.loans where id = p_entity_id)
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
    when 'consent' then (select entrepreneur_id from public.consents where id = p_entity_id)
  end;
end;
$$;

create or replace function private.anchor_partner(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'settlement_route' then (select partner_id from public.loans where id = p_entity_id)
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

-- ------------------------------------------------------------- queueing it

/*
 * The route's proof depends on the disbursement's, and the disbursement's
 * anchor is queued by `transition_loan` *after* the loan event is inserted —
 * which is when `settle_on_disbursal` runs and takes the routing decision. So
 * the decision exists before the anchor it must wait for.
 *
 * Queueing it here, off the anchor it depends on, is the one place where that
 * dependency cannot be missing. Without it the route could be claimed before
 * the loan reached Disbursed on chain, and the program would refuse it — which
 * is exactly what `depends_on` exists to avoid.
 */
create function private.queue_settlement_route_anchor() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'loan_transition' then
    insert into public.chain_anchors (kind, entity_id, depends_on)
    select 'settlement_route', d.loan_id, new.id
    from public.loan_events e
    join public.settlement_decisions d on d.loan_id = e.loan_id
    where e.id = new.entity_id and e.to_status = 'DISBURSED'
    on conflict (kind, entity_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.queue_settlement_route_anchor() from public, anon, authenticated;

create trigger queue_settlement_route_anchor
after insert on public.chain_anchors
for each row execute function private.queue_settlement_route_anchor();

-- Decisions recorded before the route had a proof kind — a seeded demo, or a
-- loan disbursed this week — are queued too, so no loan carries a weaker claim
-- than its neighbour.
insert into public.chain_anchors (kind, entity_id, depends_on)
select 'settlement_route', d.loan_id, private.anchor_of('loan_transition', (
    select e.id from public.loan_events e
    where e.loan_id = d.loan_id and e.to_status = 'DISBURSED' order by e.created_at, e.id limit 1))
from public.settlement_decisions d
on conflict (kind, entity_id) do nothing;
