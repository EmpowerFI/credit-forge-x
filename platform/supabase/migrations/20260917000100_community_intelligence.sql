-- Community Intelligence: the leader's operating view of her community.
--
-- One private function works out where each participant stands — education,
-- reporting, readiness, intent, eligibility, the partner, the loan — and what
-- the community could do next. Four readers build on it: an overview, the
-- participant table, one participant's journey and the cohorts by intake
-- month. They return no reported sales, costs or household amounts: a leader
-- sees regularity and data quality, not a participant's accounts.
--
-- Outreach is recorded, not sent: the community reaches its members on its own
-- channels. Each contact is logged as a fact and counted in cost to serve, so
-- the work of preparing people who may never borrow shows up in the numbers.

-- ------------------------------------------------------------------ outreach

create type public.outreach_action as enum (
  'checkin_reminder',     -- the latest month is not reported
  'education_followup',   -- core education unfinished
  'human_followup',       -- manual review: the rules would not decide alone
  'capital_need_check',   -- ready and asking: confirm purpose and amount
  'servicing_followup'    -- a loan is late
);

create table public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  action public.outreach_action not null,
  note text check (char_length(note) <= 500),
  created_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);
create index outreach_events_community_idx on public.outreach_events (community_id, created_at desc);
create index outreach_events_entrepreneur_idx on public.outreach_events (entrepreneur_id, created_at desc);

alter table public.outreach_events enable row level security;
revoke all on public.outreach_events from anon, authenticated;
grant select on public.outreach_events to authenticated;
create policy outreach_read on public.outreach_events for select to authenticated using (
  (select private.leads_community(community_id)) or (select private.is_auditor_or_admin())
);

-- A reminder is five minutes of the community's time; a conversation more.
insert into public.cost_rates (stage, staff_minutes, hourly_rate_cents, fixed_cents, borne_by, phase, note) values
  ('outreach', 5, 3000, 0, 'community', 'preparation', 'A reminder or follow-up by the community; longer for a conversation');

create function private.outreach_extra_minutes(p_action public.outreach_action)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_action
    when 'checkin_reminder' then 0
    when 'education_followup' then 10
    when 'capital_need_check' then 10
    when 'servicing_followup' then 15
    when 'human_followup' then 25
  end
$$;

create function private.can_see_community(p_community_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.leads_community(p_community_id) or private.is_auditor_or_admin() $$;

-- The leader logs that she reached these participants. Returns how many.
create function public.record_outreach(
  p_community_id uuid,
  p_action public.outreach_action,
  p_entrepreneur_ids uuid[],
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_entrepreneur uuid;
  v_count integer := 0;
begin
  if not (private.leads_community(p_community_id) or private.is_admin()) then
    raise exception 'not_your_community' using errcode = '42501';
  end if;
  if coalesce(array_length(p_entrepreneur_ids, 1), 0) = 0 or array_length(p_entrepreneur_ids, 1) > 200 then
    raise exception 'between_1_and_200_participants' using errcode = '22023';
  end if;
  foreach v_entrepreneur in array p_entrepreneur_ids loop
    if not exists (
      select 1 from public.community_memberships
      where community_id = p_community_id and entrepreneur_id = v_entrepreneur and status = 'active'
    ) then
      raise exception 'not_a_member' using errcode = '22023';
    end if;
    insert into public.outreach_events (community_id, entrepreneur_id, action, note, created_by)
    values (p_community_id, v_entrepreneur, p_action, nullif(trim(p_note), ''), auth.uid())
    returning id into v_id;
    perform private.record_cost('outreach', v_id, v_entrepreneur, p_community_id, false, now(),
      private.outreach_extra_minutes(p_action));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ------------------------------------------------------------------- state

-- Where each active member stands, as of the community's latest reported month.
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
                                      + extract(month from age(now(), b.active_since)))::integer)) as late
    from base b
  ),
  staged as (
    select j.*,
      case
        when j.loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') then 7
        when j.referred_at is not null then 6
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
        when j.readiness_status = 'CREDIT_READY' and j.intent_purpose is not null and j.opportunity_status is null
             and j.eligibility_decision is distinct from 'NOT_ELIGIBLE' then 'capital_need_check'
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
    (array['joined', 'education', 'data_sufficient', 'credit_ready', 'credit_intent', 'eligible', 'referred', 'financed'])[s.stage_no + 1],
    s.stage_no,
    s.next_action,
    -- Contacted for that same action in the last seven days: already in hand.
    (select max(oe.created_at) from public.outreach_events oe
      where oe.entrepreneur_id = s.id and oe.community_id = p_community_id and oe.action = s.next_action
        and oe.created_at > now() - interval '7 days')
  from staged s
$$;

revoke all on function private.community_state(uuid) from public;

-- ---------------------------------------------------------------- readers

create function public.community_overview(p_community_id uuid)
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
        'financed', count(*) filter (where stage_no >= 7)) from cs),
      -- Reached at least this stage; the stages are cumulative by construction.
      'funnel', (
        select jsonb_agg(jsonb_build_object('stage', st.stage, 'n', (select count(*) from cs where stage_no >= st.ord - 1)) order by st.ord)
        from unnest(array['joined', 'education', 'data_sufficient', 'credit_ready', 'credit_intent', 'eligible', 'referred', 'financed'])
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

create function public.community_participants(p_community_id uuid)
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
      'stage', s.stage, 'stage_no', s.stage_no, 'next_action', s.next_action, 'contacted_at', private.iso(s.contacted_at)
    ) order by s.display_name), '[]')
    from private.community_state(p_community_id) s
  );
end;
$$;

-- Intake-month cohorts: how each one converts, how long readiness takes,
-- what holds people back, what they need capital for, and what came of it.
create function public.community_cohorts(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  return (
    with s as (select * from private.community_state(p_community_id)),
    outcomes as (
      select distinct on (po.loan_id) po.entrepreneur_id, po.evc_cents, po.capital_use,
        po.avg_revenue_after_cents > po.avg_revenue_before_cents as revenue_up
      from public.productive_outcomes po
      where po.entrepreneur_id in (select entrepreneur_id from s)
      order by po.loan_id, po.outcome_no desc
    )
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
          'referred', count(*) filter (where stage_no >= 6),
          'financed', count(*) filter (where stage_no >= 7)
        ),
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
          'referred', count(*) filter (where referred_at is not null),
          'approved', count(*) filter (where opportunity_status = 'partner_approved'),
          'disbursed', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED'))
        ),
        'outcomes', (
          select jsonb_build_object(
            'measured', count(*),
            'revenue_up', count(*) filter (where o.revenue_up),
            'as_declared', count(*) filter (where o.capital_use = 'as_declared'),
            'evc_cents', coalesce(sum(o.evc_cents), 0),
            'evc_positive', count(*) filter (where o.evc_cents > 0)
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

-- One participant's journey, for the leaders of her communities: every step
-- with its proof, the outreach she received, and no reported amounts.
create function public.community_participant(p_community_id uuid, p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_state jsonb;
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  select to_jsonb(s) into v_state from private.community_state(p_community_id) s where s.entrepreneur_id = p_entrepreneur_id;
  if v_state is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'state', v_state,
    'education', (
      select coalesce(jsonb_agg(jsonb_build_object('module_id', md.id, 'title', md.title, 'position', md.position,
          'program', pr.title, 'core', pr.community_id is null, 'status', ep.status, 'completed_at', private.iso(ep.completed_at))
        order by pr.community_id nulls first, md.position), '[]')
      from public.education_modules md
      join public.education_programs pr on pr.id = md.program_id
      left join public.education_progress ep on ep.module_id = md.id and ep.entrepreneur_id = p_entrepreneur_id
      where pr.community_id is null or pr.community_id = p_community_id
    ),
    'timeline', (
      select coalesce(jsonb_agg(t order by t ->> 'at'), '[]') from (
        select jsonb_build_object('at', private.iso(m.joined_at), 'kind', 'joined', 'label', c.name,
          'proof', private.proof_brief('enrollment', p_entrepreneur_id)) as t
        from public.community_memberships m join public.communities c on c.id = m.community_id
        where m.entrepreneur_id = p_entrepreneur_id and m.community_id = p_community_id
        union all
        select jsonb_build_object('at', private.iso(ep.completed_at), 'kind', 'education', 'label', md.title)
        from public.education_progress ep join public.education_modules md on md.id = ep.module_id
        where ep.entrepreneur_id = p_entrepreneur_id and ep.status = 'completed'
        union all
        select jsonb_build_object('at', private.iso(ck.created_at), 'kind', 'checkin', 'label', ck.period,
          'detail', jsonb_build_object('keeps_records', ck.keeps_records), 'proof', private.proof_brief('checkin', ck.id))
        from public.checkins ck where ck.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ra.created_at), 'kind', 'readiness', 'label', ra.status,
          'detail', jsonb_build_object('score', ra.score, 'band', ra.band, 'model_version', ra.model_version,
            'missing', ra.missing_requirements, 'reasons', to_jsonb(ra.reason_codes)),
          'proof', private.proof_brief('readiness', ra.id))
        from public.readiness_assessments ra where ra.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ci.created_at), 'kind', 'intent', 'label', ci.purpose,
          'detail', jsonb_build_object('amount_cents', ci.requested_amount_cents, 'status', ci.status))
        from public.credit_intents ci where ci.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ci.withdrawn_at), 'kind', 'intent_withdrawn', 'label', ci.purpose)
        from public.credit_intents ci where ci.entrepreneur_id = p_entrepreneur_id and ci.withdrawn_at is not null
        union all
        select jsonb_build_object('at', private.iso(ea.created_at), 'kind', 'eligibility', 'label', ea.decision,
          'detail', jsonb_build_object('reasons', to_jsonb(ea.reason_codes), 'model_version', ea.model_version),
          'proof', private.proof_brief('eligibility', ea.id))
        from public.eligibility_assessments ea where ea.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(q.referred_at), 'kind', 'referred', 'label', q.purpose,
          'proof', private.proof_brief('opportunity', q.id))
        from public.qualified_credit_opportunities q where q.entrepreneur_id = p_entrepreneur_id and q.referred_at is not null
        union all
        select jsonb_build_object('at', private.iso(pd.created_at), 'kind', 'partner_decision', 'label', pd.verdict)
        from public.partner_decisions pd join public.qualified_credit_opportunities q on q.id = pd.opportunity_id
        where q.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(le.created_at), 'kind', 'loan', 'label', le.to_status,
          'proof', private.proof_brief('loan_transition', le.id))
        from public.loan_events le join public.loans l on l.id = le.loan_id
        where l.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(p.paid_at), 'kind', 'payment', 'label', p.instalment_no::text,
          'proof', private.proof_brief('payment', p.id))
        from public.payments p join public.loans l on l.id = p.loan_id
        where l.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(po.measured_at), 'kind', 'outcome', 'label', po.capital_use,
          'proof', private.proof_brief('outcome', po.id))
        from public.productive_outcomes po where po.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(oe.created_at), 'kind', 'outreach', 'label', oe.action,
          'detail', jsonb_build_object('note', oe.note))
        from public.outreach_events oe
        where oe.entrepreneur_id = p_entrepreneur_id and oe.community_id = p_community_id
      ) x
    )
  );
end;
$$;

-- A proof's state in brief, for a timeline row.
create function private.proof_brief(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('kind', a.kind, 'entity_id', a.entity_id, 'status', a.status,
    'signature', a.signature, 'reconcile', a.reconcile)
  from public.chain_anchors a where a.kind = p_kind and a.entity_id = p_entity_id
$$;

revoke all on function private.proof_brief(public.anchor_kind, uuid), private.can_see_community(uuid),
  private.outreach_extra_minutes(public.outreach_action) from public;

revoke all on function public.record_outreach(uuid, public.outreach_action, uuid[], text),
  public.community_overview(uuid), public.community_participants(uuid), public.community_cohorts(uuid),
  public.community_participant(uuid, uuid) from public, anon;
grant execute on function public.record_outreach(uuid, public.outreach_action, uuid[], text),
  public.community_overview(uuid), public.community_participants(uuid), public.community_cohorts(uuid),
  public.community_participant(uuid, uuid) to authenticated;
