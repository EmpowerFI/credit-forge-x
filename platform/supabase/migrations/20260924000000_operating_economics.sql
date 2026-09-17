-- Operating economics: can productive credit become cheaper to operate without
-- becoming weaker credit? (refactor spec §2A, 17 Sep)
--
-- The prototype does not claim the answer. It measures, from the facts it
-- already records, what the pilot must test, side by side:
--   what must improve          what must not be sacrificed
--   cost to serve              eligibility discipline
--   time to decision           affordability checks
--   operational scalability    continuous follow-up
--   capital access             portfolio quality
--
-- Costs come from cost_events (priced by the pilot rate card, which is an
-- assumption); times from the timestamps of intents, eligibility runs,
-- opportunities, desk decisions and disbursements; discipline from the
-- engines' reason codes; quality from loan and instalment states.
--
-- For the operator (the desk), auditors and admins, over everything; for a
-- sponsor, over its own programme. Aggregates only.

create function public.operating_economics(p_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := coalesce(private.my_role()::text, '');
begin
  if p_program_id is null then
    if v_role not in ('partner', 'admin', 'auditor') then
      raise exception 'not_allowed_to_see_costs' using errcode = '42501';
    end if;
  else
    if not (v_role in ('partner', 'admin', 'auditor')
            or exists (select 1 from public.programs p where p.id = p_program_id and p.sponsor_id = private.my_sponsor_id())) then
      raise exception 'not_allowed_to_see_costs' using errcode = '42501';
    end if;
    if not exists (select 1 from public.programs where id = p_program_id) then
      raise exception 'program_not_found' using errcode = 'P0002';
    end if;
  end if;

  return (
    with communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    state as materialized (
      -- A member of two communities counts once.
      select distinct on (s.entrepreneur_id) s.*
      from communities c cross join lateral private.community_state(c.id) s
      order by s.entrepreneur_id, s.joined_at
    ),
    people as materialized (select entrepreneur_id from state),
    costs as materialized (
      select ce.* from public.cost_events ce
      where p_program_id is null
         or ce.community_id in (select id from communities)
         or ce.entrepreneur_id in (select entrepreneur_id from people)
    ),
    opportunities as materialized (
      select o.* from public.qualified_credit_opportunities o
      where o.entrepreneur_id in (select entrepreneur_id from people)
    ),
    lent as materialized (
      select l.* from public.loans l
      where l.entrepreneur_id in (select entrepreneur_id from people)
        and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
    ),
    runs as materialized (
      select ea.* from public.eligibility_assessments ea
      where ea.entrepreneur_id in (select entrepreneur_id from people)
    ),
    -- Each step's duration, in seconds, for every case that took it.
    steps as (
      select 'intent_to_eligibility' as step, extract(epoch from (e.first_at - i.created_at)) as s
      from public.credit_intents i
      join lateral (select min(ea.created_at) as first_at from runs ea where ea.intent_id = i.id) e on e.first_at is not null
      where i.entrepreneur_id in (select entrepreneur_id from people)
      union all
      select 'eligibility_to_opportunity', extract(epoch from (o.created_at - ea.created_at))
      from opportunities o join runs ea on ea.id = o.eligibility_id
      union all
      select 'opportunity_to_decision', extract(epoch from (d.created_at - o.created_at))
      from public.partner_decisions d join opportunities o on o.id = d.opportunity_id
      union all
      select 'decision_to_disbursement', extract(epoch from (l.disbursed_at - d.created_at))
      from lent l join public.partner_decisions d on d.id = l.decision_id
      where l.disbursed_at is not null
      union all
      select 'intent_to_disbursement', extract(epoch from (l.disbursed_at - i.created_at))
      from lent l join opportunities o on o.id = l.opportunity_id join public.credit_intents i on i.id = o.intent_id
      where l.disbursed_at is not null
    ),
    totals as (
      select
        coalesce(sum(amount_cents), 0) as total_cents,
        coalesce(sum(amount_cents) filter (where phase = 'preparation'), 0) as preparation_cents,
        coalesce(sum(amount_cents) filter (where phase = 'origination'), 0) as origination_cents,
        coalesce(sum(amount_cents) filter (where phase = 'servicing'), 0) as servicing_cents,
        coalesce(sum(staff_minutes), 0) as staff_minutes,
        coalesce(sum(staff_minutes) filter (where phase = 'preparation'), 0) as preparation_minutes,
        coalesce(sum(staff_minutes) filter (where phase in ('origination', 'servicing')), 0) as credit_minutes,
        count(*) as events,
        count(*) filter (where staff_minutes = 0) as automated_events
      from costs
    ),
    counts as (
      select
        (select count(*) from state) as participants,
        (select count(*) from opportunities) as opportunities,
        (select count(*) from lent) as loans,
        (select coalesce(sum(principal_cents), 0) from lent) as disbursed_cents
    )
    select jsonb_build_object(
      'scope', jsonb_build_object(
        'program_id', p_program_id,
        'communities', (select count(*) from communities),
        'participants', k.participants),

      'cost', jsonb_build_object(
        'total_cents', t.total_cents,
        'staff_minutes', t.staff_minutes,
        'events', t.events,
        -- Steps that took no one's time: engine runs, self-reported check-ins, proofs.
        'automated_events_share_bps', case when t.events > 0 then floor(t.automated_events * 10000.0 / t.events) end,
        'by_phase', jsonb_build_object('preparation', t.preparation_cents, 'origination', t.origination_cents, 'servicing', t.servicing_cents),
        'minutes_by_phase', jsonb_build_object('preparation', t.preparation_minutes, 'credit', t.credit_minutes),
        'per_participant_cents', case when k.participants > 0 then round(t.total_cents::numeric / k.participants) end,
        'per_opportunity_cents', case when k.opportunities > 0 then round(t.total_cents::numeric / k.opportunities) end,
        'per_loan_cents', case when k.loans > 0 then round(t.total_cents::numeric / k.loans) end,
        'credit_minutes_per_loan', case when k.loans > 0 then round(t.credit_minutes::numeric / k.loans) end,
        -- Cost for every R$ 100 lent: everything, and the credit alone. Preparation
        -- reaches every participant, and a sponsor's programme pays for it; what
        -- a loan adds is its origination and servicing.
        'per_100_disbursed_cents', case when k.disbursed_cents > 0 then round(t.total_cents * 10000.0 / k.disbursed_cents) end,
        'credit_per_100_disbursed_cents', case when k.disbursed_cents > 0
          then round((t.origination_cents + t.servicing_cents) * 10000.0 / k.disbursed_cents) end,
        'opportunities', k.opportunities,
        'loans', k.loans,
        'disbursed_cents', k.disbursed_cents,
        'rate_card_is_assumption', (select coalesce(bool_or(is_assumption), false) from public.cost_rates),
        'by_stage', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'stage', r.stage, 'phase', r.phase, 'borne_by', r.borne_by,
              'events', coalesce(x.events, 0), 'staff_minutes', coalesce(x.minutes, 0), 'cents', coalesce(x.cents, 0)
            ) order by r.stage), '[]')
          from public.cost_rates r
          left join (select stage, count(*) as events, sum(staff_minutes) as minutes, sum(amount_cents) as cents
                     from costs group by stage) x on x.stage = r.stage)),

      'timing', (
        select jsonb_agg(jsonb_build_object(
            'step', w.step, 'n', coalesce(m.n, 0), 'median_seconds', m.median, 'p90_seconds', m.p90
          ) order by w.ord)
        from (values ('intent_to_eligibility', 1), ('eligibility_to_opportunity', 2), ('opportunity_to_decision', 3),
                     ('decision_to_disbursement', 4), ('intent_to_disbursement', 5)) w(step, ord)
        left join (
          select step, count(*) as n,
            round(percentile_cont(0.5) within group (order by greatest(s, 0)))::bigint as median,
            round(percentile_cont(0.9) within group (order by greatest(s, 0)))::bigint as p90
          from steps group by step
        ) m on m.step = w.step),

      'discipline', jsonb_build_object(
        'runs', (select count(*) from runs),
        'decisions', (select coalesce(jsonb_object_agg(decision, n), '{}') from (select decision, count(*) as n from runs group by decision) d),
        'reasons', (
          select coalesce(jsonb_agg(jsonb_build_object('code', code, 'n', n) order by n desc, code), '[]')
          from (select code, count(*) as n from runs, unnest(reason_codes) code group by code) r),
        'affordability_checked', (select count(*) from runs where affordability_bps is not null or max_instalment_cents > 0),
        'model_versions', (select coalesce(jsonb_agg(distinct model_version), '[]') from runs)),

      'capital', jsonb_build_object(
        'opportunities', k.opportunities,
        'allocated', (select count(*) from opportunities where allocated_at is not null),
        'domestic', (select count(*) from opportunities where funding_pool = 'domestic'),
        'global', (select count(*) from opportunities where funding_pool = 'global'),
        'waiting', (select count(*) from opportunities where allocated_at is not null and funding_pool is null),
        'funded', (select count(*) from state where stage_no = 7),
        'reasons', (
          select coalesce(jsonb_agg(jsonb_build_object('code', code, 'n', n) order by n desc, code), '[]')
          from (select code, count(*) as n from opportunities, unnest(allocation_reason_codes) code group by code) r)),

      'follow_up', jsonb_build_object(
        'checkins', (select count(*) from public.checkins c where c.entrepreneur_id in (select entrepreneur_id from people)),
        'self_reported', (
          select count(*) from public.checkins c join public.entrepreneurs e on e.id = c.entrepreneur_id
          where c.entrepreneur_id in (select entrepreneur_id from people)
            and (c.submitted_by is null or c.submitted_by = e.profile_id)),
        'reporting', (select count(*) from state where reported_latest),
        'open_follow_ups', (select count(*) from state where next_action is not null and contacted_at is null),
        'contacts', (select count(*) from public.outreach_events oe where oe.community_id in (select id from communities)),
        'instalments_recorded', (select count(*) from public.payments p where p.loan_id in (select id from lent)),
        'outcomes_measured', (
          select count(distinct po.loan_id) from public.productive_outcomes po where po.loan_id in (select id from lent))),

      'quality', (select jsonb_build_object(
          'loans', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')),
          'repaying', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE') and not late),
          'late', count(*) filter (where late and loan_status = 'ACTIVE'),
          'paid', count(*) filter (where loan_status = 'PAID'),
          'defaulted', count(*) filter (where loan_status = 'DEFAULTED'),
          'instalments_due', coalesce(sum(instalments_due), 0),
          'instalments_paid', coalesce(sum(least(instalments_paid, instalments_due)) filter (where instalments_due > 0), 0))
        from state)
    )
    from totals t, counts k
  );
end;
$$;

revoke all on function public.operating_economics(uuid) from public, anon;
grant execute on function public.operating_economics(uuid) to authenticated;
