-- M7 · cost to serve, measured from the top of the funnel
--
-- The problem EmpowerFI exists for is unit economics: originating, preparing
-- and servicing a small loan costs nearly what a large one does. So cost is
-- counted from the first community onboarding — not from disbursement — and
-- every stage carries its own line.
--
-- Costs come from triggers on the facts themselves, so the live path and the
-- seed are counted by the same rules, and each fact counts once
-- (unique (stage, fact_id)). The rate card is a set of pilot assumptions,
-- marked as such: the pilot exists to replace them with measured numbers.

create type public.cost_stage as enum (
  'community_onboarding',
  'community_verification',
  'enrollment',
  'education',
  'checkin',
  'readiness_assessment',
  'credit_intent',
  'eligibility_assessment',
  'opportunity_preparation',
  'partner_referral',
  'partner_decision',
  'disbursement',
  'servicing',
  'chain_anchoring'
);

create type public.cost_bearer as enum ('empowerfi', 'community', 'partner');

create table public.cost_rates (
  stage public.cost_stage primary key,
  -- Staff time per occurrence, and its cost per hour.
  staff_minutes integer not null check (staff_minutes >= 0),
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  -- Systems, fees, per occurrence.
  fixed_cents integer not null check (fixed_cents >= 0),
  borne_by public.cost_bearer not null,
  -- Preparation, origination or servicing: the three places cost lands.
  phase text not null check (phase in ('preparation', 'origination', 'servicing')),
  note text not null,
  is_assumption boolean not null default true
);

-- A pilot rate card. R$ 30/h for staff time; chain cost is the transaction
-- fee (≈5,000 lamports) at an assumed SOL price, not the rent deposit, which
-- stays locked in the proof account and is reported separately.
insert into public.cost_rates (stage, staff_minutes, hourly_rate_cents, fixed_cents, borne_by, phase, note) values
  ('community_onboarding',    120, 3000,  0, 'empowerfi', 'preparation', 'Meeting the leader, setting the programme up'),
  ('community_verification',   90, 3000,  0, 'empowerfi', 'preparation', 'Site visit or call, documents, review'),
  ('enrollment',               15, 3000,  0, 'community', 'preparation', 'Registering a participant'),
  ('education',                10, 3000,  0, 'community', 'preparation', 'Facilitation share per completed module'),
  ('checkin',                   0, 3000,  2, 'empowerfi', 'preparation', 'Self-reported; 10 min of the leader when she enters it'),
  ('readiness_assessment',      0, 3000,  2, 'empowerfi', 'preparation', 'Automated engine run'),
  ('credit_intent',             0, 3000,  1, 'empowerfi', 'origination', 'Automated'),
  ('eligibility_assessment',    0, 3000,  2, 'empowerfi', 'origination', 'Automated engine run'),
  ('opportunity_preparation',  10, 3000,  0, 'empowerfi', 'origination', 'Packaging the opportunity; review when flagged'),
  ('partner_referral',          5, 3000,  0, 'empowerfi', 'origination', 'Referral to a matching partner'),
  ('partner_decision',         30, 4500,  0, 'partner',   'origination', 'Partner analyst time'),
  ('disbursement',             15, 4500,  0, 'partner',   'origination', 'Contract and transfer'),
  ('servicing',                 3, 3000,  0, 'partner',   'servicing',   'Per instalment recorded'),
  ('chain_anchoring',           0, 3000,  1, 'empowerfi', 'preparation', 'Transaction fee per proof, at an assumed SOL price');

create table public.cost_events (
  id bigint generated always as identity primary key,
  stage public.cost_stage not null,
  -- The fact that incurred it; a fact is counted once.
  fact_id uuid not null,
  entrepreneur_id uuid references public.entrepreneurs (id) on delete cascade,
  community_id uuid references public.communities (id) on delete cascade,
  staff_minutes integer not null,
  amount_cents bigint not null,
  borne_by public.cost_bearer not null,
  phase text not null,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (stage, fact_id)
);

create index cost_events_entrepreneur_idx on public.cost_events (entrepreneur_id);
create index cost_events_community_idx on public.cost_events (community_id);

alter table public.cost_rates enable row level security;
alter table public.cost_events enable row level security;
revoke all on public.cost_rates, public.cost_events from anon, authenticated;
grant select on public.cost_rates, public.cost_events to authenticated;

create policy cost_rates_read on public.cost_rates for select to authenticated using (true);
-- Costs of her own journey, of the communities one leads, and all of them for
-- auditors and admins.
create policy cost_events_read on public.cost_events for select to authenticated using (
  (select private.is_auditor_or_admin())
  or entrepreneur_id = (select private.my_entrepreneur_id())
  or (entrepreneur_id is not null and (select private.leads_entrepreneur(entrepreneur_id)))
  or (community_id is not null and (select private.leads_community(community_id)))
);

-- ----------------------------------------------------------------- record

create function private.record_cost(
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
begin
  select * into r from public.cost_rates where stage = p_stage;
  v_minutes := r.staff_minutes + p_extra_minutes;
  insert into public.cost_events (
    stage, fact_id, entrepreneur_id, community_id, staff_minutes, amount_cents, borne_by, phase, is_simulated, created_at
  ) values (
    p_stage, p_fact_id, p_entrepreneur_id,
    coalesce(p_community_id, (
      select community_id from public.community_memberships
      where entrepreneur_id = p_entrepreneur_id order by joined_at limit 1)),
    v_minutes,
    round(v_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents,
    r.borne_by, r.phase, coalesce(p_is_simulated, false), coalesce(p_at, now())
  )
  on conflict (stage, fact_id) do nothing;
end;
$$;

revoke all on function private.record_cost(public.cost_stage, uuid, uuid, uuid, boolean, timestamptz, integer) from public;

-- --------------------------------------------------------------- triggers
-- One small trigger function per fact table; each names its stage.

create function private.cost_on_community() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_cost('community_onboarding', new.id, null, new.id, new.is_simulated, new.created_at);
  end if;
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    -- A distinct fact id per stage: the verification is not the onboarding.
    perform private.record_cost('community_verification', new.id, null, new.id, new.is_simulated, new.verified_at);
  end if;
  return new;
end $$;
create trigger cost_on_community after insert or update of status on public.communities
  for each row execute function private.cost_on_community();

create function private.cost_on_membership() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('enrollment', new.entrepreneur_id, new.entrepreneur_id, new.community_id,
    (select is_simulated from public.entrepreneurs where id = new.entrepreneur_id), new.joined_at);
  return new;
end $$;
create trigger cost_on_membership after insert on public.community_memberships
  for each row execute function private.cost_on_membership();

-- Education: the fact is the (entrepreneur, module) completion; derive a
-- stable id from the pair.
create function private.cost_on_education() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform private.record_cost('education',
      (substr(md5(new.entrepreneur_id::text || new.module_id::text), 1, 8) || '-' ||
       substr(md5(new.entrepreneur_id::text || new.module_id::text), 9, 4) || '-4' ||
       substr(md5(new.entrepreneur_id::text || new.module_id::text), 14, 3) || '-8' ||
       substr(md5(new.entrepreneur_id::text || new.module_id::text), 18, 3) || '-' ||
       substr(md5(new.entrepreneur_id::text || new.module_id::text), 21, 12))::uuid,
      new.entrepreneur_id, null,
      (select is_simulated from public.entrepreneurs where id = new.entrepreneur_id), new.completed_at);
  end if;
  return new;
end $$;
create trigger cost_on_education after insert or update of status on public.education_progress
  for each row execute function private.cost_on_education();

-- A check-in she sends herself costs system time; one the leader types in for
-- her costs ten minutes of the leader.
create function private.cost_on_checkin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('checkin', new.id, new.entrepreneur_id, null, new.is_simulated, new.created_at,
    case when new.submitted_by is not null and new.submitted_by is distinct from
      (select profile_id from public.entrepreneurs where id = new.entrepreneur_id) then 10 else 0 end);
  return new;
end $$;
create trigger cost_on_checkin after insert on public.checkins
  for each row execute function private.cost_on_checkin();

create function private.cost_on_readiness() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('readiness_assessment', new.id, new.entrepreneur_id, null, new.is_simulated, new.created_at);
  return new;
end $$;
create trigger cost_on_readiness after insert on public.readiness_assessments
  for each row execute function private.cost_on_readiness();

create function private.cost_on_intent() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('credit_intent', new.id, new.entrepreneur_id, null, new.is_simulated, new.created_at);
  return new;
end $$;
create trigger cost_on_intent after insert on public.credit_intents
  for each row execute function private.cost_on_intent();

create function private.cost_on_eligibility() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('eligibility_assessment', new.id, new.entrepreneur_id, null, new.is_simulated, new.created_at);
  return new;
end $$;
create trigger cost_on_eligibility after insert on public.eligibility_assessments
  for each row execute function private.cost_on_eligibility();

-- Preparing the opportunity costs more when the rules sent it for review.
create function private.cost_on_opportunity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_cost('opportunity_preparation', new.id, new.entrepreneur_id, null, new.is_simulated,
      new.created_at, case when new.status = 'in_review' then 20 else 0 end);
  end if;
  if new.referred_at is not null and (tg_op = 'INSERT' or old.referred_at is null) then
    perform private.record_cost('partner_referral', new.id, new.entrepreneur_id, null, new.is_simulated, new.referred_at);
  end if;
  return new;
end $$;
create trigger cost_on_opportunity after insert or update of referred_at on public.qualified_credit_opportunities
  for each row execute function private.cost_on_opportunity();

create function private.cost_on_decision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('partner_decision', new.id,
    (select entrepreneur_id from public.qualified_credit_opportunities where id = new.opportunity_id),
    null, new.is_simulated, new.created_at);
  return new;
end $$;
create trigger cost_on_decision after insert on public.partner_decisions
  for each row execute function private.cost_on_decision();

create function private.cost_on_loan_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.to_status = 'DISBURSED' then
    perform private.record_cost('disbursement', new.id,
      (select entrepreneur_id from public.loans where id = new.loan_id), null, new.is_simulated, new.created_at);
  end if;
  return new;
end $$;
create trigger cost_on_loan_event after insert on public.loan_events
  for each row execute function private.cost_on_loan_event();

create function private.cost_on_payment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('servicing', new.id,
    (select entrepreneur_id from public.loans where id = new.loan_id), null, new.is_simulated, new.paid_at);
  return new;
end $$;
create trigger cost_on_payment after insert on public.payments
  for each row execute function private.cost_on_payment();

-- Each proof, once it is confirmed on chain.
create function private.cost_on_anchor() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_entrepreneur uuid;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_entrepreneur := private.anchor_entrepreneur(new.kind, new.entity_id);
    -- Keyed by the anchor row: several anchors can concern one entity.
    perform private.record_cost('chain_anchoring',
      ('00000000-0000-4000-8000-' || lpad(to_hex(new.id), 12, '0'))::uuid,
      v_entrepreneur,
      case when new.kind in ('community', 'community_verification') then new.entity_id end,
      coalesce((select is_simulated from public.entrepreneurs where id = v_entrepreneur), false),
      new.confirmed_at);
  end if;
  return new;
end $$;
create trigger cost_on_anchor after update of status on public.chain_anchors
  for each row execute function private.cost_on_anchor();

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
revoke all on function private.record_cost(public.cost_stage, uuid, uuid, uuid, boolean, timestamptz, integer)
  from authenticated;

-- ---------------------------------------------------------------- metrics

-- The cost-to-serve ratios, for one community or for everything the caller
-- may see. Every ratio divides by what was actually reached, so a funnel that
-- prepares many and lends to few shows it.
create function public.cts_summary(p_community_id uuid default null)
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
    'rate_card', 'pilot assumptions'
  ) into v
  from funnel f, totals t;

  return v;
end;
$$;

revoke all on function public.cts_summary(uuid) from public, anon;
grant execute on function public.cts_summary(uuid) to authenticated;

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
