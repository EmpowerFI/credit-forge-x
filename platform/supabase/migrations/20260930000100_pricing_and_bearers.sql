-- Three businesses, one screen
--
-- Until now the platform could say what the work cost and not who paid for it,
-- and had no idea at all what anything was sold for. Both gaps pushed the same
-- wrong reading: preparation looked like a cost of lending, and EmpowerFI
-- looked like the one bearing it.
--
-- EmpowerFI is a tool. The fieldwork belongs to the community, which has its
-- own budget, and lending belongs to the partner. A sponsor may pay all three
-- under separate contracts, or buy one package and let EmpowerFI pass the
-- community's share through. Which of the two it is changes the margin and
-- nothing else, so it is a card, not an assumption baked into a query.
--
-- The prices here are premises, marked as such like every rate on the cost
-- card, and benchmarked rather than guessed:
--
--   Musoni, core banking for microfinance   €3 per client, US$ 12k minimum
--   Median MFI operating cost, MIX 2018     US$ 106.7 per borrower per year
--   Large-scale Brazilian social investor   R$ 111 per beneficiary per year
--   Group mentoring, private market         R$ 200 per person per month
--
-- R$ 20 per participant-month with a R$ 1,500 floor prices the tool against
-- the first two. R$ 100 prices the accompaniment, which is the community's
-- work to sell — it is kept as the bundled card so the two can be read side
-- by side.

-- ------------------------------------------------- what the company costs to run
-- The cost card prices work per occurrence. It cannot see the cost of simply
-- existing: the person who onboards a programme and answers its questions, the
-- platform, the accountant. That is one number per card, with the number of
-- participants it can carry before the next one is needed.

alter table public.cost_rate_cards
  add column fixed_monthly_cents bigint,
  add column fixed_monthly_capacity_participants integer,
  add column fixed_monthly_note text;

update public.cost_rate_cards set
  fixed_monthly_cents = 920400,
  fixed_monthly_capacity_participants = 2000,
  fixed_monthly_note = 'One FTE for onboarding and support at R$ 4,531 loaded 1.7x, '
    || 'platform and infrastructure at ~US$ 100, 12% overhead; carries about twenty programmes.'
where version = 'pilot-2026.09';

-- ------------------------------------------------------------------- the price
create table public.pricing_cards (
  version text primary key,
  effective_from date not null,
  source text not null check (source in ('simulated', 'observed')),
  -- Separate contracts, or one package with the community's share inside it.
  billing_model text not null check (billing_model in ('tool_licence', 'bundled')),
  -- Per participant per month, and the monthly minimum below which a programme
  -- is too small to carry its own support.
  seat_cents bigint not null check (seat_cents >= 0),
  floor_cents bigint not null check (floor_cents >= 0),
  -- Passed through to the community, per participant-month. Only a bundled
  -- card has one: under separate contracts the sponsor pays the community.
  community_share_cents bigint not null default 0 check (community_share_cents >= 0),
  note text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.pricing_cards is
  'What the platform is sold for, versioned like the cost card. Premises until a signed contract replaces them.';

-- One card answers "what does this cost the sponsor" by default; the others
-- stay readable as scenarios.
create unique index pricing_cards_one_default on public.pricing_cards ((true)) where is_default;

insert into public.pricing_cards
  (version, effective_from, source, billing_model, seat_cents, floor_cents, community_share_cents, note, is_default) values
  ('tool-2026.09', '2000-01-01', 'simulated', 'tool_licence', 2000, 150000, 0,
   'The tool, licensed per participant tracked. R$ 20 a month with a R$ 1,500 floor: above Musoni''s per-client price '
   || 'for the proof and reporting layer it does not have, and around a fifth of a realistic fieldwork budget.', true),
  ('bundled-2026.09', '2000-01-01', 'simulated', 'bundled', 10000, 150000, 1334,
   'One package: R$ 100 a month per participant with the community''s share passed through at the modelled cost of '
   || 'her work. Priced like accompaniment, not like software — kept for comparison.', false);

alter table public.pricing_cards enable row level security;
revoke all on public.pricing_cards from anon, authenticated;
grant select on public.pricing_cards to authenticated;
create policy pricing_cards_read on public.pricing_cards for select to authenticated using (true);

-- --------------------------------------------------------------- the business
-- What the sponsor pays, what it costs to serve, and what is left — for one
-- programme, under one pricing card. Read by the same rule as the rest of the
-- economics: the desk, auditors, admins, and the sponsor of her own programme.

create function public.business_model(
  p_program_id uuid default null,
  p_pricing_version text default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_card public.cost_rate_cards;
  v_price public.pricing_cards;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());
  select * into v_price from public.pricing_cards
    where version = coalesce(p_pricing_version, (select version from public.pricing_cards where is_default limit 1));
  if v_price.version is null then
    raise exception 'pricing_card_not_found' using errcode = 'P0002';
  end if;

  return (
    with communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    state as materialized (
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
    -- Costs are a total over however long the programme has been running; a
    -- price is monthly. Everything below is brought to the month.
    span as (
      select greatest(1.0, coalesce(extract(epoch from (max(created_at) - min(created_at))) / 2629800.0, 0)) as months,
        min(created_at) as first_at, max(created_at) as last_at
      from costs
    ),
    borne as (
      select
        coalesce(sum(amount_cents) filter (where borne_by = 'empowerfi'), 0) as empowerfi_cents,
        coalesce(sum(amount_cents) filter (where borne_by = 'community'), 0) as community_cents,
        coalesce(sum(amount_cents) filter (where borne_by = 'partner'), 0) as partner_cents,
        count(*) filter (where stage = 'chain_anchoring') as proofs,
        count(distinct (stage, fact_id)) as facts
      from costs
    ),
    k as (select (select count(*) from state) as participants),
    money as (
      select
        k.participants,
        s.months,
        -- The seats, or the floor when the programme is too small to reach it.
        greatest(v_price.floor_cents, k.participants * v_price.seat_cents) as licence_cents,
        k.participants * v_price.seat_cents < v_price.floor_cents as floor_applied,
        -- What the platform itself spends: the events it bears, per month, and
        -- its share of the cost of existing.
        round(b.empowerfi_cents / s.months) as variable_cents,
        case when coalesce(v_card.fixed_monthly_capacity_participants, 0) > 0
          then round(v_card.fixed_monthly_cents::numeric * k.participants
                     / v_card.fixed_monthly_capacity_participants) else 0 end as fixed_share_cents,
        case when v_price.billing_model = 'bundled'
          then k.participants * v_price.community_share_cents else 0 end as passthrough_cents,
        b.*
      from k, span s, borne b
    )
    select jsonb_build_object(
      'pricing', jsonb_build_object(
        'version', v_price.version, 'billing_model', v_price.billing_model, 'source', v_price.source,
        'seat_cents', v_price.seat_cents, 'floor_cents', v_price.floor_cents,
        'community_share_cents', v_price.community_share_cents, 'note', v_price.note,
        'is_assumption', v_price.source = 'simulated',
        'others', (select coalesce(jsonb_agg(jsonb_build_object(
              'version', p.version, 'billing_model', p.billing_model,
              'seat_cents', p.seat_cents, 'floor_cents', p.floor_cents) order by p.version), '[]')
          from public.pricing_cards p where p.version <> v_price.version)),

      'scope', jsonb_build_object(
        'program_id', p_program_id,
        'participants', m.participants,
        'months_measured', round(m.months, 2),
        'first_at', s.first_at, 'last_at', s.last_at),

      -- Per month, at the size this programme is now.
      'monthly', jsonb_build_object(
        'licence_cents', m.licence_cents,
        'floor_applied', m.floor_applied,
        'variable_cents', m.variable_cents,
        'fixed_share_cents', m.fixed_share_cents,
        'passthrough_cents', m.passthrough_cents,
        'cost_cents', m.variable_cents + m.fixed_share_cents + m.passthrough_cents,
        'margin_cents', m.licence_cents - (m.variable_cents + m.fixed_share_cents + m.passthrough_cents),
        'margin_bps', case when m.licence_cents > 0
          then round((m.licence_cents - (m.variable_cents + m.fixed_share_cents + m.passthrough_cents))
                     * 10000.0 / m.licence_cents) end),

      'per_participant_month', jsonb_build_object(
        'licence_cents', case when m.participants > 0 then round(m.licence_cents::numeric / m.participants) end,
        'variable_cents', case when m.participants > 0 then round(m.variable_cents::numeric / m.participants) end,
        'fixed_share_cents', case when m.participants > 0 then round(m.fixed_share_cents::numeric / m.participants) end,
        'community_cents', case when m.participants > 0
          then round(m.community_cents / m.months / m.participants) end),

      -- The same programme filled to the capacity one fixed block carries: the
      -- operating leverage, stated rather than implied.
      'at_capacity', case when coalesce(v_card.fixed_monthly_capacity_participants, 0) > 0 and m.participants > 0 then
        jsonb_build_object(
          'participants', v_card.fixed_monthly_capacity_participants,
          'licence_cents', greatest(v_price.floor_cents,
            v_card.fixed_monthly_capacity_participants::bigint * v_price.seat_cents),
          'margin_bps', (
            select case when lic > 0 then round((lic - cost) * 10000.0 / lic) end
            from (select
              greatest(v_price.floor_cents, v_card.fixed_monthly_capacity_participants::bigint * v_price.seat_cents) as lic,
              round(m.variable_cents::numeric / m.participants * v_card.fixed_monthly_capacity_participants)
                + v_card.fixed_monthly_cents
                + case when v_price.billing_model = 'bundled'
                    then v_card.fixed_monthly_capacity_participants::bigint * v_price.community_share_cents
                    else 0 end as cost) q))
        end,

      -- What the money buys the sponsor, which is the reason to pay for a tool
      -- rather than a spreadsheet: facts that can be checked by someone else.
      'evidence', jsonb_build_object(
        'facts', m.facts,
        'proofs', m.proofs,
        'proofs_per_participant', case when m.participants > 0
          then round(m.proofs::numeric / m.participants, 1) end,
        'cost_per_proof_cents', case when m.proofs > 0
          then round(m.empowerfi_cents::numeric / m.proofs) end),

      'borne_by', jsonb_build_object(
        'empowerfi_cents', m.empowerfi_cents,
        'community_cents', m.community_cents,
        'partner_cents', m.partner_cents),

      'rate_card', jsonb_build_object(
        'version', v_card.version, 'source', v_card.source,
        'fixed_monthly_cents', v_card.fixed_monthly_cents,
        'fixed_monthly_capacity_participants', v_card.fixed_monthly_capacity_participants,
        'fixed_monthly_note', v_card.fixed_monthly_note)
    )
    from money m, span s);
end;
$$;

revoke all on function public.business_model(uuid, text) from public, anon;
grant execute on function public.business_model(uuid, text) to authenticated;

-- ------------------------------------------------- the same totals, by bearer
-- operating_economics, re-created with three changes and nothing else: a fact
-- counts once however many people bore a part of it, "automated" means nobody's
-- minutes went into it, and the cost carries who paid.

CREATE OR REPLACE FUNCTION public.operating_economics(p_program_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_card public.cost_rate_cards;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());

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
        count(distinct (stage, fact_id)) as events,
        count(distinct (stage, fact_id))
          - count(distinct (stage, fact_id)) filter (where staff_minutes > 0) as automated_events
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
        -- Three different businesses pay for this work: the platform, the
        -- community that does the fieldwork, and the partner that lends. A
        -- total that adds them together answers no one's question.
        'by_bearer', (
          select coalesce(jsonb_object_agg(b.borne_by, jsonb_build_object(
              'cents', b.cents, 'staff_minutes', b.minutes, 'facts', b.facts,
              'preparation_cents', b.preparation, 'credit_cents', b.credit)), '{}')
          from (
            select borne_by,
              sum(amount_cents) as cents,
              sum(staff_minutes) as minutes,
              count(distinct (stage, fact_id)) as facts,
              coalesce(sum(amount_cents) filter (where phase = 'preparation'), 0) as preparation,
              coalesce(sum(amount_cents) filter (where phase in ('origination', 'servicing')), 0) as credit
            from costs group by borne_by) b),
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
        -- Which card priced all of this, and whether its numbers are assumptions.
        'rate_card', jsonb_build_object(
          'version', v_card.version, 'source', v_card.source,
          'effective_from', v_card.effective_from, 'note', v_card.note),
        'rate_card_is_assumption', v_card.source = 'simulated',
        -- The cards that priced the events counted here: more than one once the
        -- pilot's card arrives, and each event keeps the price it was given.
        'rate_cards_used', (select coalesce(jsonb_agg(distinct rate_version), '[]') from costs),
        'by_stage', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'stage', x.stage, 'phase', x.phase, 'borne_by', x.borne_by,
              'events', x.events, 'staff_minutes', x.minutes, 'cents', x.cents
            ) order by x.stage, x.borne_by), '[]')
          from (
            -- Every stage the card prices, so one nothing has reached yet is
            -- still visible as a line with nothing in it.
            select r.stage::text as stage, r.phase, r.borne_by::text as borne_by,
              0::bigint as events, 0::bigint as minutes, 0::bigint as cents
            from public.cost_rates r
            where r.card_version = v_card.version
              and not exists (select 1 from costs c where c.stage = r.stage)
            union all
            select c.stage::text, c.phase, c.borne_by::text,
              count(distinct c.fact_id), sum(c.staff_minutes), sum(c.amount_cents)
            from costs c group by c.stage, c.phase, c.borne_by) x)),

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
$function$

