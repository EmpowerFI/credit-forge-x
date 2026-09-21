-- Operating economics · the rate card gets a version, and the ticket gets a model
-- (MVP addendum §6, §9, §11, 21 Sep)
--
-- Two things the addendum needs that the cost model did not have.
--
-- A version. `cost_rates` was one mutable row per stage, so the pilot's
-- observed rates would have overwritten the assumed ones in place and no
-- number could have said which card produced it. Now a card is a row of its
-- own, with a source — simulated or observed — and the date it takes effect;
-- each rate belongs to a card; and every cost event is stamped with the card
-- that priced it, chosen by the date of the fact rather than the date of the
-- insert, so facts from July keep July's prices when the pilot's card arrives.
-- The amounts themselves were already immune: `cost_events` has always stored
-- the cents computed at the moment of the fact.
--
-- And a model. Recorded costs are facts about work that happened; moving the
-- ticket does not change them. So `cost_sensitivity()` does not read
-- `cost_events` for its prices at all: it runs over the card, using how often
-- each stage actually occurred as its multipliers, and answers one question —
-- what would cost per R$ 100 lent be if the ticket were larger? Nothing in the
-- work changes; only the denominator does. That is the whole hypothesis of
-- small-ticket credit, stated so that a reader can check it.

create table public.cost_rate_cards (
  version text primary key,
  -- The date from which facts are priced by this card.
  effective_from timestamptz not null,
  -- What the numbers on it are: assumptions, or measured in the pilot.
  source text not null check (source in ('simulated', 'observed')),
  note text not null,
  created_at timestamptz not null default now()
);

comment on table public.cost_rate_cards is
  'Versions of the cost rate card. A card is never edited once facts were priced by it: a new rate card is a new version.';

insert into public.cost_rate_cards (version, effective_from, source, note) values
  ('pilot-2026.09', '2000-01-01', 'simulated',
   'Pilot assumptions: staff time at R$ 30/h (R$ 45/h at the desk and the partner), systems and chain fees per occurrence. The pilot exists to replace them with measured rates.');

-- Every rate belongs to a card, and the pilot card owns the ones that exist.
alter table public.cost_rates add column card_version text not null default 'pilot-2026.09'
  references public.cost_rate_cards (version);
alter table public.cost_rates alter column card_version drop default;
alter table public.cost_rates drop constraint cost_rates_pkey;
alter table public.cost_rates add primary key (card_version, stage);
-- The card says whether its numbers are assumptions; a boolean per rate could
-- disagree with it.
alter table public.cost_rates drop column is_assumption;

-- And every cost event says which card priced it.
alter table public.cost_events add column rate_version text references public.cost_rate_cards (version);
update public.cost_events set rate_version = 'pilot-2026.09' where rate_version is null;
alter table public.cost_events alter column rate_version set not null;

alter table public.cost_rate_cards enable row level security;
revoke all on public.cost_rate_cards from anon, authenticated;
grant select on public.cost_rate_cards to authenticated;
create policy cost_rate_cards_read on public.cost_rate_cards for select to authenticated using (true);

-- The card in force for a fact of that date: the newest one that had taken
-- effect by then, and the oldest card for anything older than all of them.
create function private.rate_card_at(p_at timestamptz)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select version from public.cost_rate_cards
     where effective_from <= coalesce(p_at, now()) order by effective_from desc, version desc limit 1),
    (select version from public.cost_rate_cards order by effective_from, version limit 1));
$$;

-- Prices a fact by the card in force on its date, and records which one that was.
create or replace function private.record_cost(
  p_stage public.cost_stage,
  p_fact_id uuid,
  p_entrepreneur_id uuid,
  p_community_id uuid,
  p_is_simulated boolean,
  p_at timestamptz,
  p_extra_minutes integer default 0
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.cost_rates;
  v_minutes integer;
  v_at timestamptz := coalesce(p_at, now());
  v_card text := private.rate_card_at(coalesce(p_at, now()));
begin
  select * into r from public.cost_rates where stage = p_stage and card_version = v_card;
  v_minutes := r.staff_minutes + p_extra_minutes;
  insert into public.cost_events (
    stage, fact_id, entrepreneur_id, community_id, staff_minutes, amount_cents, borne_by, phase,
    is_simulated, created_at, rate_version
  ) values (
    p_stage, p_fact_id, p_entrepreneur_id,
    coalesce(p_community_id, (
      select community_id from public.community_memberships
      where entrepreneur_id = p_entrepreneur_id order by joined_at limit 1)),
    v_minutes,
    round(v_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents,
    r.borne_by, r.phase, coalesce(p_is_simulated, false), v_at, v_card
  )
  on conflict (stage, fact_id) do nothing;
end;
$$;

-- ----------------------------------------------------------------- reading
-- Who may read operating economics: the desk, auditors and admins over
-- everything; a sponsor over a programme it sponsors. One rule, two readers.

create function private.may_read_economics(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(private.my_role()::text, '') in ('partner', 'admin', 'auditor') then true
    when p_program_id is null then false
    else exists (select 1 from public.programs p
                 where p.id = p_program_id and p.sponsor_id = private.my_sponsor_id())
  end;
$$;

-- --------------------------------------------------------- what a ticket does
-- A model, not a measurement. Each stage costs what the current card says, and
-- occurs as often as it has been occurring: preparation stages per participant,
-- origination and servicing per loan. The conversion — how many participants it
-- takes to reach one loan — is observed here and can be overridden; it moves the
-- all-in answer more than the ticket does, which is why it is returned beside
-- the result rather than buried in it.

create function public.cost_sensitivity(
  p_program_id uuid default null,
  p_tickets_cents bigint[] default array[100000, 200000, 500000, 1000000]::bigint[],
  p_participants_per_loan numeric default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_card public.cost_rate_cards;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;
  if coalesce(array_length(p_tickets_cents, 1), 0) not between 1 and 8
     or exists (select 1 from unnest(p_tickets_cents) t where t <= 0) then
    raise exception 'tickets_out_of_range' using errcode = '22023';
  end if;
  if p_participants_per_loan is not null and p_participants_per_loan <= 0 then
    raise exception 'conversion_out_of_range' using errcode = '22023';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());

  return (
    with card as (
      select r.stage, r.phase, r.borne_by,
        -- What one occurrence of the stage costs, by the card.
        round(r.staff_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents as cents
      from public.cost_rates r where r.card_version = v_card.version
    ),
    communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    people as materialized (
      select distinct m.entrepreneur_id from public.community_memberships m
      where m.community_id in (select id from communities)
    ),
    lent as materialized (
      select l.* from public.loans l
      where l.entrepreneur_id in (select entrepreneur_id from people)
        and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
    ),
    occurrences as (
      select ce.stage, count(*)::numeric as n
      from public.cost_events ce
      where ce.community_id in (select id from communities)
         or ce.entrepreneur_id in (select entrepreneur_id from people)
      group by ce.stage
    ),
    basis as (
      select
        (select count(*) from people)::numeric as participants,
        (select count(*) from lent)::numeric as loans,
        (select coalesce(sum(principal_cents), 0) from lent)::numeric as disbursed
    ),
    -- How often each stage happens per unit: per participant for preparation,
    -- per loan for the rest. With no loans yet there is nothing to observe, so
    -- the model falls back to one occurrence per loan and twelve instalments,
    -- and says so.
    per_stage as (
      select c.stage, c.phase, c.borne_by, c.cents,
        case
          when c.phase = 'preparation' then
            case when b.participants > 0 then coalesce(o.n, 0) / b.participants end
          when b.loans > 0 then coalesce(o.n, 0) / b.loans
          when c.stage = 'servicing' then 12
          else 1
        end as per_unit
      from card c cross join basis b left join occurrences o on o.stage = c.stage
    ),
    model as (
      select
        coalesce(sum(p.cents * p.per_unit) filter (where p.phase <> 'preparation'), 0) as credit_per_loan,
        sum(p.cents * p.per_unit) filter (where p.phase = 'preparation') as pipeline_per_participant
      from per_stage p
    ),
    shape as (
      select m.credit_per_loan, m.pipeline_per_participant,
        coalesce(p_participants_per_loan, case when b.loans > 0 then b.participants / b.loans end) as conversion,
        case when p_participants_per_loan is not null then 'given'
             when b.loans > 0 then 'observed' end as conversion_source,
        case when b.loans > 0 then 'observed' else 'assumed' end as occurrence_basis,
        b.participants, b.loans, b.disbursed,
        case when b.loans > 0 then round(b.disbursed / b.loans) end as current_ticket_cents
      from model m cross join basis b
    ),
    ticket_rows as (
      select k.ord, k.ticket,
        round(s.credit_per_loan * 10000 / k.ticket)::bigint as credit_per_100_cents,
        case when s.conversion is not null
          then round((s.credit_per_loan + s.pipeline_per_participant * s.conversion) * 10000 / k.ticket)::bigint
        end as per_100_disbursed_cents
      from unnest(p_tickets_cents) with ordinality k(ticket, ord) cross join shape s
    )
    select jsonb_build_object(
      'card', jsonb_build_object(
        'version', v_card.version, 'source', v_card.source,
        'effective_from', v_card.effective_from, 'note', v_card.note),
      'basis', jsonb_build_object(
        'program_id', p_program_id,
        'participants', s.participants, 'loans', s.loans, 'disbursed_cents', s.disbursed,
        'current_ticket_cents', s.current_ticket_cents,
        'participants_per_loan', s.conversion,
        'participants_per_loan_source', s.conversion_source,
        'occurrences', s.occurrence_basis),
      'per_loan', jsonb_build_object(
        'credit_cents', round(s.credit_per_loan)::bigint,
        'pipeline_cents', case when s.conversion is not null
          then round(s.pipeline_per_participant * s.conversion)::bigint end,
        'by_stage', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'stage', p.stage, 'phase', p.phase, 'borne_by', p.borne_by,
              'cents', p.cents,
              'per_unit_milli', round(p.per_unit * 1000)::bigint,
              'cents_per_loan', round(p.cents * p.per_unit *
                case when p.phase = 'preparation' then coalesce(s.conversion, 0) else 1 end)::bigint
            ) order by p.stage), '[]')
          from per_stage p where p.per_unit is not null and p.per_unit > 0)),
      'tickets', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'ticket_cents', r.ticket,
            'credit_per_100_cents', r.credit_per_100_cents,
            'per_100_disbursed_cents', r.per_100_disbursed_cents
          ) order by r.ord), '[]')
        from ticket_rows r)
    )
    from shape s
  );
end;
$$;

revoke all on function public.cost_sensitivity(uuid, bigint[], numeric) from public, anon;
grant execute on function public.cost_sensitivity(uuid, bigint[], numeric) to authenticated;
revoke all on function private.rate_card_at(timestamptz) from public, anon, authenticated;
revoke all on function private.may_read_economics(uuid) from public, anon;
grant execute on function private.may_read_economics(uuid) to authenticated;
revoke all on function private.record_cost(public.cost_stage, uuid, uuid, uuid, boolean, timestamptz, integer)
  from public, anon, authenticated;

-- ------------------------------------------------- the card, wherever costs are
-- operating_economics(), unchanged but for two things: the permission rule now
-- has a name, and every cost number it returns says which card priced it.

create or replace function public.operating_economics(p_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
              'stage', r.stage, 'phase', r.phase, 'borne_by', r.borne_by,
              'events', coalesce(x.events, 0), 'staff_minutes', coalesce(x.minutes, 0), 'cents', coalesce(x.cents, 0)
            ) order by r.stage), '[]')
          from public.cost_rates r
          left join (select stage, count(*) as events, sum(staff_minutes) as minutes, sum(amount_cents) as cents
                     from costs group by stage) x on x.stage = r.stage
          where r.card_version = v_card.version)),

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

-- cts_summary(): the community's own reader. It said 'pilot assumptions'; now
-- it names the card, so a leader's number and the desk's number can be told
-- apart when the pilot's card lands.
create or replace function public.cts_summary(p_community_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if p_community_id is not null and not (private.leads_community(p_community_id) or private.is_auditor_or_admin()) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_community_id is null and not private.is_auditor_or_admin() then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;

  with scope as (
    select m.entrepreneur_id from public.community_memberships m
    where p_community_id is null or m.community_id = p_community_id
  ),
  costs as (
    select * from public.cost_events ce
    where p_community_id is null or ce.community_id = p_community_id
       or ce.entrepreneur_id in (select entrepreneur_id from scope)
  ),
  funnel as (
    select
      (select count(*) from scope) as participants,
      (select count(*) from public.latest_readiness r where r.entrepreneur_id in (select entrepreneur_id from scope) and r.status = 'CREDIT_READY') as ready,
      (select count(*) from public.qualified_credit_opportunities o where o.entrepreneur_id in (select entrepreneur_id from scope)) as opportunities,
      (select count(*) from public.loans l where l.entrepreneur_id in (select entrepreneur_id from scope) and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')) as loans,
      (select coalesce(sum(l.principal_cents), 0) from public.loans l where l.entrepreneur_id in (select entrepreneur_id from scope) and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')) as disbursed_cents
  ),
  totals as (
    select
      coalesce(sum(amount_cents), 0) as total_cents,
      coalesce(sum(amount_cents) filter (where phase = 'preparation'), 0) as preparation_cents,
      coalesce(sum(amount_cents) filter (where phase = 'origination'), 0) as origination_cents,
      coalesce(sum(amount_cents) filter (where phase = 'servicing'), 0) as servicing_cents,
      coalesce(sum(amount_cents) filter (where staff_minutes = 0), 0) as automated_cents,
      coalesce(sum(staff_minutes), 0) as staff_minutes
    from costs
  )
  select jsonb_build_object(
    'participants', f.participants,
    'ready', f.ready,
    'opportunities', f.opportunities,
    'loans', f.loans,
    'disbursed_cents', f.disbursed_cents,
    'total_cents', t.total_cents,
    'staff_minutes', t.staff_minutes,
    'by_phase', jsonb_build_object('preparation', t.preparation_cents, 'origination', t.origination_cents, 'servicing', t.servicing_cents),
    'per_participant_cents', case when f.participants > 0 then round(t.total_cents::numeric / f.participants) end,
    'per_ready_cents', case when f.ready > 0 then round(t.total_cents::numeric / f.ready) end,
    'per_opportunity_cents', case when f.opportunities > 0 then round(t.total_cents::numeric / f.opportunities) end,
    'per_loan_cents', case when f.loans > 0 then round(t.total_cents::numeric / f.loans) end,
    -- Cost for every R$ 100 lent, the unit-economics number.
    'per_100_disbursed_cents', case when f.disbursed_cents > 0 then round(t.total_cents * 10000.0 / f.disbursed_cents) end,
    'automated_share_bps', case when t.total_cents > 0 then round(t.automated_cents * 10000.0 / t.total_cents) end,
    'by_stage', (
      select coalesce(jsonb_object_agg(stage, cents), '{}'::jsonb)
      from (select stage, sum(amount_cents) as cents from costs group by stage) s
    ),
    'rate_card', (select coalesce(jsonb_agg(distinct rate_version), '[]') from costs),
    'rate_card_current', private.rate_card_at(now())
  ) into v
  from funnel f, totals t;

  return v;
end;
$$;

revoke all on function public.operating_economics(uuid) from public, anon;
grant execute on function public.operating_economics(uuid) to authenticated;
revoke all on function public.cts_summary(uuid) from public, anon;
grant execute on function public.cts_summary(uuid) to authenticated;
