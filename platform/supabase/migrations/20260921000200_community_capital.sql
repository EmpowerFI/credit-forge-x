-- Community Intelligence feeds P2P demand (P2P North Star, 16 Sep).
--
-- The funnel now ends where the capital comes in: Eligible → P2P opportunity
-- → Funded. The leader sees what her members' opportunities ask — qualified
-- capital demand — how much investors have funded, the funding gap, and how
-- much of it came from domestic and from global capital: totals only, never
-- an investor, a wallet or a position. Next actions cover every step, and the
-- impact view follows financed capital to repayment.
--
-- A leader also stops reading opportunities, decisions and loans straight
-- from their tables: what she needs arrives through these functions.

-- Demand, funded, gap and each pool's share, from the three sums.
create function private.capital_totals(p_demand bigint, p_domestic bigint, p_global bigint)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'eligible_cents', p_demand,
    'funded_cents', p_domestic + p_global,
    'gap_cents', greatest(p_demand - p_domestic - p_global, 0),
    'domestic_cents', p_domestic,
    'global_cents', p_global,
    'domestic_coverage_bps', case when p_demand > 0 then floor(p_domestic * 10000.0 / p_demand) else 0 end,
    'global_coverage_bps', case when p_demand > 0 then floor(p_global * 10000.0 / p_demand) else 0 end
  )
$$;

create or replace function private.outreach_extra_minutes(p_action public.outreach_action)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_action
    when 'checkin_reminder' then 0
    when 'education_followup' then 10
    when 'readiness_followup' then 10
    when 'credit_intent_check' then 10
    when 'capital_need_check' then 10
    when 'funding_followup' then 5
    when 'servicing_followup' then 15
    when 'human_followup' then 25
  end
$$;

-- Where each member stands: as before, with her opportunity's amount, pool and funding.
drop function private.community_state(uuid);
create function private.community_state(p_community_id uuid)
returns table (
  entrepreneur_id uuid,
  display_name text,
  business_name text,
  business_sector text,
  is_simulated boolean,
  joined_at timestamptz,
  intake text,
  core_total integer,
  core_done integer,
  education_complete boolean,
  checkins integer,
  last_period text,
  reported_latest boolean,
  readiness_status public.readiness_status,
  readiness_band public.readiness_band,
  readiness_score integer,
  regularity integer,
  data_quality integer,
  months_reported integer,
  records_kept_bps integer,
  missing_requirements jsonb,
  readiness_reasons text[],
  assessed_at timestamptz,
  model_version text,
  first_ready_at timestamptz,
  intent_purpose public.credit_purpose,
  intent_cents bigint,
  intent_at timestamptz,
  eligibility_decision public.eligibility_decision,
  eligibility_reasons text[],
  opportunity_status public.opportunity_status,
  referred_at timestamptz,
  loan_status public.loan_status,
  instalments_paid integer,
  loan_term integer,
  late boolean,
  opportunity_cents bigint,
  funding_pool public.funding_pool,
  funding_status public.funding_status,
  funded_cents bigint,
  principal_cents bigint,
  repaid_cents bigint,
  instalments_due integer,
  stage text,
  stage_no integer,
  next_action public.outreach_action,
  contacted_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with latest as (
    select max(c.period) as period
    from public.checkins c
    join public.community_memberships m on m.entrepreneur_id = c.entrepreneur_id
    where m.community_id = p_community_id
  ),
  core as (
    select md.id from public.education_modules md
    join public.education_programs pr on pr.id = md.program_id
    where pr.community_id is null
  ),
  base as (
    select
      e.id, e.display_name, e.business_name, e.business_sector, e.is_simulated, m.joined_at,
      (select count(*) from core)::integer as core_total,
      (select count(*) from public.education_progress ep
        where ep.entrepreneur_id = e.id and ep.status = 'completed' and ep.module_id in (select id from core))::integer as core_done,
      (select count(*) from public.checkins c where c.entrepreneur_id = e.id)::integer as checkins,
      (select max(c.period) from public.checkins c where c.entrepreneur_id = e.id) as last_period,
      r.status as readiness_status, r.band as readiness_band, r.score::integer as readiness_score,
      (r.components ->> 'regularity')::integer as regularity,
      (r.components ->> 'data_quality')::integer as data_quality,
      (r.features ->> 'months_reported')::integer as months_reported,
      (r.features ->> 'records_kept_bps')::integer as records_kept_bps,
      r.missing_requirements, r.reason_codes as readiness_reasons, r.created_at as assessed_at, r.model_version,
      (select min(ra.created_at) from public.readiness_assessments ra
        where ra.entrepreneur_id = e.id and ra.status = 'CREDIT_READY') as first_ready_at,
      i.purpose as intent_purpose, i.requested_amount_cents as intent_cents, i.created_at as intent_at,
      el.decision as eligibility_decision, el.reason_codes as eligibility_reasons,
      o.status as opportunity_status, o.referred_at,
      o.amount_cents as opportunity_cents, o.funding_pool, o.funding_status,
      -- Funded, in reais: the loan once it is lent, or investors' allocations at the opportunity's quote.
      case when l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') then l.principal_cents
           when o.funded_micro_usdc > 0 then least(o.amount_cents, private.usdc_cents(o.funded_micro_usdc, o.fx_brl_per_usdc_milli)) end as funded_cents,
      l.principal_cents,
      (select coalesce(sum(p.amount_cents), 0) from public.payments p where p.loan_id = l.id)::bigint as repaid_cents,
      l.status as loan_status, l.term_months::integer as loan_term,
      (select count(*) from public.payments p where p.loan_id = l.id)::integer as instalments_paid,
      (select min(le.created_at) from public.loan_events le where le.loan_id = l.id and le.to_status = 'ACTIVE') as active_since
    from public.community_memberships m
    join public.entrepreneurs e on e.id = m.entrepreneur_id
    left join lateral (
      select * from public.readiness_assessments ra where ra.entrepreneur_id = e.id
      order by ra.assessment_no desc limit 1
    ) r on true
    left join lateral (
      select * from public.credit_intents ci where ci.entrepreneur_id = e.id and ci.status = 'active'
      order by ci.created_at desc limit 1
    ) i on true
    left join lateral (
      select * from public.eligibility_assessments ea where ea.entrepreneur_id = e.id and ea.intent_id = i.id
      order by ea.eligibility_no desc limit 1
    ) el on true
    left join lateral (
      select * from public.qualified_credit_opportunities q where q.entrepreneur_id = e.id
      order by q.created_at desc limit 1
    ) o on true
    left join lateral (
      select * from public.loans ln where ln.opportunity_id = o.id limit 1
    ) l on true
    where m.community_id = p_community_id and m.status = 'active'
  ),
  judged as (
    select b.*,
      (b.core_total = 0 or b.core_done >= b.core_total) as education_complete,
      coalesce(b.last_period = (select period from latest), false) as reported_latest,
      (b.loan_status = 'DEFAULTED'
        or (b.loan_status = 'ACTIVE' and b.active_since is not null
            and b.instalments_paid < (extract(year from age(now(), b.active_since)) * 12
                                      + extract(month from age(now(), b.active_since)))::integer)) as late,
      case when b.loan_status = 'ACTIVE' then private.instalments_due(b.active_since, b.loan_term)
           when b.loan_status in ('PAID', 'DEFAULTED') then b.loan_term else 0 end as instalments_due
    from base b
  ),
  staged as (
    select j.*,
      case
        when j.loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') or j.funding_status = 'funded' then 7
        when j.opportunity_status in ('open', 'referred', 'partner_approved') then 6
        when j.intent_purpose is not null and j.eligibility_decision in ('ELIGIBLE', 'ELIGIBLE_REDUCED') then 5
        when j.readiness_status = 'CREDIT_READY' and j.intent_purpose is not null then 4
        when j.readiness_status = 'CREDIT_READY' then 3
        when j.education_complete and j.readiness_status is not null and j.readiness_status <> 'NEEDS_MORE_DATA' then 2
        when j.education_complete then 1
        else 0
      end as stage_no,
      case
        when j.late then 'servicing_followup'
        when j.readiness_status = 'MANUAL_REVIEW' or j.eligibility_decision = 'MANUAL_REVIEW' then 'human_followup'
        when not coalesce(j.last_period = (select period from latest), false) then 'checkin_reminder'
        when not j.education_complete then 'education_followup'
        -- One requirement from ready: a conversation can close it.
        when j.readiness_status in ('NEEDS_MORE_DATA', 'NEEDS_PREPARATION')
             and jsonb_array_length(coalesce(j.missing_requirements, '[]')) <= 1 then 'readiness_followup'
        when j.readiness_status = 'CREDIT_READY' and j.intent_purpose is null and j.loan_status is null then 'credit_intent_check'
        when j.readiness_status = 'CREDIT_READY' and j.intent_purpose is not null and j.opportunity_status is null
             and j.eligibility_decision is distinct from 'NOT_ELIGIBLE' then 'capital_need_check'
        -- Her request is a P2P opportunity not yet funded: where it stands, and what it waits on.
        when j.opportunity_status in ('open', 'referred') and j.loan_status is null
             and j.funding_status is distinct from 'funded' then 'funding_followup'
      end::public.outreach_action as next_action
    from judged j
  )
  select
    s.id, s.display_name, s.business_name, s.business_sector, s.is_simulated, s.joined_at,
    to_char(s.joined_at, 'YYYY-MM'),
    s.core_total, s.core_done, s.education_complete, s.checkins, s.last_period, s.reported_latest,
    s.readiness_status, s.readiness_band, s.readiness_score, s.regularity, s.data_quality, s.months_reported,
    s.records_kept_bps, s.missing_requirements, s.readiness_reasons, s.assessed_at, s.model_version, s.first_ready_at,
    s.intent_purpose, s.intent_cents, s.intent_at, s.eligibility_decision, s.eligibility_reasons,
    s.opportunity_status, s.referred_at, s.loan_status, s.instalments_paid, s.loan_term, s.late,
    s.opportunity_cents, s.funding_pool, s.funding_status, s.funded_cents, s.principal_cents, s.repaid_cents, s.instalments_due,
    (array['joined', 'education', 'data_sufficient', 'credit_ready', 'credit_intent', 'eligible', 'p2p_opportunity', 'funded'])[s.stage_no + 1],
    s.stage_no,
    s.next_action,
    -- Contacted for that same action in the last seven days: already in hand.
    (select max(oe.created_at) from public.outreach_events oe
      where oe.entrepreneur_id = s.id and oe.community_id = p_community_id and oe.action = s.next_action
        and oe.created_at > now() - interval '7 days')
  from staged s
$$;

revoke all on function private.community_state(uuid) from public;

create or replace function public.community_overview(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_community public.communities;
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  select * into v_community from public.communities where id = p_community_id;

  return (
    with cs as materialized (select * from private.community_state(p_community_id))
    select jsonb_build_object(
      'community', jsonb_build_object('id', v_community.id, 'name', v_community.name, 'kind', v_community.kind,
        'city', v_community.city, 'state', v_community.state, 'status', v_community.status,
        'verified_at', private.iso(v_community.verified_at), 'is_simulated', v_community.is_simulated),
      'as_of_period', (select max(last_period) from cs),
      'hero', (select jsonb_build_object(
        'participants', count(*),
        'joined_this_month', count(*) filter (where joined_at >= date_trunc('month', now())),
        'education_complete', count(*) filter (where stage_no >= 1),
        'credit_ready', count(*) filter (where stage_no >= 3),
        'credit_intent', count(*) filter (where stage_no >= 4),
        'eligible', count(*) filter (where stage_no >= 5),
        'p2p_opportunity', count(*) filter (where stage_no >= 6),
        'funded', count(*) filter (where stage_no >= 7),
        -- Qualified capital demand: what her members' P2P opportunities ask, in reais.
        'qualified_demand_cents', coalesce(sum(opportunity_cents) filter (where stage_no >= 6), 0),
        'funded_cents', coalesce(sum(funded_cents) filter (where stage_no >= 6), 0)) from cs),
      -- Where the capital comes from, as totals: never who put it in.
      'capital', (select private.capital_totals(
          coalesce(sum(opportunity_cents) filter (where stage_no >= 6), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'domestic'), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'global'), 0))
        || jsonb_build_object(
          'financed_cents', coalesce(sum(principal_cents) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')), 0),
          'repaid_cents', coalesce(sum(repaid_cents), 0),
          'instalments_paid', coalesce(sum(instalments_paid) filter (where loan_status in ('ACTIVE', 'PAID', 'DEFAULTED')), 0),
          'instalments_due', coalesce(sum(instalments_due), 0),
          'loans_repaying', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE') and not late),
          'loans_late', count(*) filter (where late and loan_status = 'ACTIVE'),
          'loans_paid', count(*) filter (where loan_status = 'PAID'),
          'loans_defaulted', count(*) filter (where loan_status = 'DEFAULTED'),
          'waiting_for_capital', count(*) filter (where stage_no = 6 and funding_status is null))
        from cs),
      -- Reached at least this stage; the stages are cumulative by construction.
      'funnel', (
        select jsonb_agg(jsonb_build_object('stage', st.stage, 'n', (select count(*) from cs where stage_no >= st.ord - 1)) order by st.ord)
        from unnest(array['joined', 'education', 'data_sufficient', 'credit_ready', 'credit_intent', 'eligible', 'p2p_opportunity', 'funded'])
          with ordinality as st(stage, ord)
      ),
      'health', (select jsonb_build_object(
        'checkin_completion_bps', case when count(*) > 0 then round(10000.0 * count(*) filter (where reported_latest) / count(*)) end,
        'data_quality_bps', round(avg(data_quality) filter (where data_quality is not null) * 10000 / 25),
        'regularity_bps', round(avg(regularity) filter (where regularity is not null) * 10000 / 25),
        'needs_human_followup', count(*) filter (where readiness_status = 'MANUAL_REVIEW' or eligibility_decision = 'MANUAL_REVIEW'),
        'avg_days_to_ready', round(avg(extract(epoch from first_ready_at - joined_at) / 86400) filter (where first_ready_at is not null)),
        'credit_alerts', count(*) filter (where late)) from cs),
      'queue', (
        select jsonb_agg(jsonb_build_object(
          'action', a.action,
          'pending', (select count(*) from cs where next_action = a.action and contacted_at is null),
          'contacted', (select count(*) from cs where next_action = a.action and contacted_at is not null),
          'participants', (select coalesce(jsonb_agg(jsonb_build_object('entrepreneur_id', entrepreneur_id, 'display_name', display_name)
                              order by display_name), '[]')
                            from cs where next_action = a.action and contacted_at is null)
        ) order by a.ord)
        from unnest(enum_range(null::public.outreach_action)) with ordinality as a(action, ord)
      ),
      'recent_outreach', (
        select coalesce(jsonb_agg(jsonb_build_object('action', x.action, 'n', x.n, 'at', private.iso(x.at)) order by x.at desc), '[]')
        from (
          select oe.action, count(*) as n, max(oe.created_at) as at
          from public.outreach_events oe
          where oe.community_id = p_community_id and oe.created_at > now() - interval '30 days'
          group by oe.action
        ) x
      )
    )
  );
end;
$$;


create or replace function public.community_cohorts(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  return (
    with s as (select * from private.community_state(p_community_id)),
    measured as (
      select distinct on (po.loan_id) po.entrepreneur_id, po.evc_cents, po.capital_use,
        po.avg_revenue_after_cents > po.avg_revenue_before_cents as revenue_up,
        private.has_consent(po.entrepreneur_id, 'impact') as counted
      from public.productive_outcomes po
      where po.entrepreneur_id in (select entrepreneur_id from s)
      order by po.loan_id, po.outcome_no desc
    ),
    outcomes as (select * from measured where counted)
    select coalesce(jsonb_agg(c order by c ->> 'intake'), '[]')
    from (
      select jsonb_build_object(
        'intake', s.intake,
        'participants', count(*),
        'funnel', jsonb_build_object(
          'joined', count(*),
          'education', count(*) filter (where stage_no >= 1),
          'data_sufficient', count(*) filter (where stage_no >= 2),
          'credit_ready', count(*) filter (where stage_no >= 3),
          'credit_intent', count(*) filter (where stage_no >= 4),
          'eligible', count(*) filter (where stage_no >= 5),
          'p2p_opportunity', count(*) filter (where stage_no >= 6),
          'funded', count(*) filter (where stage_no >= 7)
        ),
        'capital', private.capital_totals(
          coalesce(sum(opportunity_cents) filter (where stage_no >= 6), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'domestic'), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'global'), 0)),
        'days_to_ready', jsonb_build_object(
          'le_30', count(*) filter (where first_ready_at - joined_at <= interval '30 days'),
          'd31_60', count(*) filter (where first_ready_at - joined_at > interval '30 days' and first_ready_at - joined_at <= interval '60 days'),
          'd61_90', count(*) filter (where first_ready_at - joined_at > interval '60 days' and first_ready_at - joined_at <= interval '90 days'),
          'gt_90', count(*) filter (where first_ready_at - joined_at > interval '90 days'),
          'not_yet', count(*) filter (where first_ready_at is null),
          'median', percentile_cont(0.5) within group (order by extract(epoch from first_ready_at - joined_at) / 86400)
                      filter (where first_ready_at is not null)
        ),
        'not_ready_reasons', (
          select coalesce(jsonb_object_agg(code, n), '{}')
          from (
            select mr ->> 'code' as code, count(*) as n
            from s s2, jsonb_array_elements(coalesce(s2.missing_requirements, '[]')) mr
            where s2.intake = s.intake and s2.readiness_status in ('NEEDS_MORE_DATA', 'NEEDS_PREPARATION')
            group by 1
          ) x
        ),
        'manual_review', count(*) filter (where readiness_status = 'MANUAL_REVIEW' or eligibility_decision = 'MANUAL_REVIEW'),
        'need_by_purpose', (
          select coalesce(jsonb_object_agg(purpose, jsonb_build_object('n', n, 'cents', cents)), '{}')
          from (
            select s3.intent_purpose as purpose, count(*) as n, sum(s3.intent_cents) as cents
            from s s3 where s3.intake = s.intake and s3.intent_purpose is not null group by 1
          ) x
        ),
        'operations', jsonb_build_object(
          'p2p_opportunities', count(*) filter (where stage_no >= 6),
          'funded', count(*) filter (where stage_no >= 7),
          'disbursed', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED'))
        ),
        'outcomes', (
          select jsonb_build_object(
            'measured', count(*),
            'revenue_up', count(*) filter (where o.revenue_up),
            'as_declared', count(*) filter (where o.capital_use = 'as_declared'),
            'evc_cents', coalesce(sum(o.evc_cents), 0),
            'evc_positive', count(*) filter (where o.evc_cents > 0),
            'withheld', (select count(*) from measured m join s s5 on s5.entrepreneur_id = m.entrepreneur_id
                         where s5.intake = s.intake and not m.counted)
          )
          from outcomes o join s s4 on s4.entrepreneur_id = o.entrepreneur_id
          where s4.intake = s.intake
        )
      ) as c
      from s
      group by s.intake
    ) cohorts
  );
end;
$$;


-- Each member, with her opportunity's amount, pool and funding in reais.
create or replace function public.community_participants(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'entrepreneur_id', s.entrepreneur_id, 'display_name', s.display_name, 'business_name', s.business_name,
      'business_sector', s.business_sector, 'is_simulated', s.is_simulated,
      'joined_at', private.iso(s.joined_at), 'intake', s.intake,
      'core_total', s.core_total, 'core_done', s.core_done, 'checkins', s.checkins, 'last_period', s.last_period,
      'reported_latest', s.reported_latest,
      'readiness_status', s.readiness_status, 'readiness_band', s.readiness_band, 'readiness_score', s.readiness_score,
      'regularity', s.regularity, 'data_quality', s.data_quality, 'months_reported', s.months_reported,
      'missing_requirements', coalesce(s.missing_requirements, '[]'), 'readiness_reasons', coalesce(to_jsonb(s.readiness_reasons), '[]'),
      'intent_purpose', s.intent_purpose, 'intent_cents', s.intent_cents,
      'eligibility_decision', s.eligibility_decision, 'eligibility_reasons', coalesce(to_jsonb(s.eligibility_reasons), '[]'),
      'opportunity_status', s.opportunity_status, 'referred_at', private.iso(s.referred_at),
      'loan_status', s.loan_status, 'instalments_paid', s.instalments_paid, 'loan_term', s.loan_term, 'late', s.late,
      'opportunity_cents', s.opportunity_cents, 'funding_pool', s.funding_pool, 'funding_status', s.funding_status,
      'funded_cents', s.funded_cents,
      'stage', s.stage, 'stage_no', s.stage_no, 'next_action', s.next_action, 'contacted_at', private.iso(s.contacted_at),
      'consent', private.consent_brief(s.entrepreneur_id)
    ) order by s.display_name), '[]')
    from private.community_state(p_community_id) s
  );
end;
$$;


-- ------------------------------------------------------ what a leader reads

drop policy opportunities_read on public.qualified_credit_opportunities;
create policy opportunities_read on public.qualified_credit_opportunities for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.is_auditor_or_admin())
  or (partner_id is not null and partner_id = (select private.my_partner_id()))
);

drop policy decisions_read on public.partner_decisions;
create policy decisions_read on public.partner_decisions for select to authenticated using (
  partner_id = (select private.my_partner_id())
  or (select private.is_auditor_or_admin())
  or exists (
    select 1 from public.qualified_credit_opportunities o
    where o.id = opportunity_id and o.entrepreneur_id = (select private.my_entrepreneur_id())
  )
);

drop policy loans_read on public.loans;
create policy loans_read on public.loans for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or partner_id = (select private.my_partner_id())
  or (select private.is_auditor_or_admin())
);

revoke all on function private.capital_totals(bigint, bigint, bigint) from public;
grant execute on function private.capital_totals(bigint, bigint, bigint) to authenticated, service_role;

-- The consent wording changed with the P2P desk: new records carry the new
-- version, and every record keeps the version it was given under.
create or replace function private.consent_text_version()
returns text
language sql immutable set search_path = ''
as $$ select 'consent-v2' $$;
