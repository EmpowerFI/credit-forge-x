-- M3 + M4 · check-ins, readiness, credit intent
--
-- Data becomes readiness. An entrepreneur (or the leader who runs her
-- sessions) reports a month of the business; the readiness engine
-- (packages/readiness-engine, run by the readiness-evaluate Edge Function)
-- turns her history into an assessment; and, only if she is ready and only if
-- she asks, a credit intent records what capital would be for.
--
-- Three separations this schema exists to keep:
--   · readiness_assessments is its own table — never a row type shared with
--     eligibility (next week), which answers a different question;
--   · a credit intent is declared by the entrepreneur herself, never by a
--     leader or the platform: CREDIT_READY without an intent is a complete,
--     successful state, and nothing here moves her on from it;
--   · the credit pipeline is ready AND intent. Ready alone never enters it.

create type public.readiness_status as enum ('CREDIT_READY', 'NEEDS_MORE_DATA', 'NEEDS_PREPARATION', 'MANUAL_REVIEW');
create type public.readiness_band as enum ('LOW', 'MEDIUM', 'HIGH');
create type public.credit_purpose as enum ('working_capital', 'inventory', 'equipment', 'renovation', 'other');
create type public.credit_intent_status as enum ('active', 'withdrawn');

-- The month, in Brazil: a check-in for "this month" means this month in São Paulo.
create function private.current_period()
returns text
language sql stable set search_path = ''
as $$ select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') $$;

-- ---------------------------------------------------------------- check-ins

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- Cents. The caps are sanity bounds, not policy.
  revenue_cents bigint not null check (revenue_cents between 0 and 10000000000),
  cogs_cents bigint not null check (cogs_cents between 0 and 10000000000),
  opex_cents bigint not null check (opex_cents between 0 and 10000000000),
  household_cents bigint not null check (household_cents between 0 and 10000000000),
  keeps_records boolean not null,
  active_days smallint not null check (active_days between 0 and 31),
  note text check (char_length(note) <= 500),
  submitted_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entrepreneur_id, period)
);

-- The cash-flow view of each month: derived, never stored twice.
create view public.checkin_cash_flow with (security_invoker = true) as
select
  c.id as checkin_id,
  c.entrepreneur_id,
  c.period,
  c.revenue_cents,
  c.cogs_cents,
  c.opex_cents,
  c.household_cents,
  c.revenue_cents - c.cogs_cents - c.opex_cents as net_business_cents,
  c.revenue_cents - c.cogs_cents - c.opex_cents - c.household_cents as net_after_household_cents,
  case when c.revenue_cents > 0
    then round((c.revenue_cents - c.cogs_cents) * 10000.0 / c.revenue_cents)::integer
  end as gross_margin_bps,
  c.keeps_records,
  c.active_days
from public.checkins c;

-- -------------------------------------------------------------- readiness

create table public.readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  assessment_no integer not null check (assessment_no > 0),
  model_version text not null,
  as_of_period text not null check (as_of_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status public.readiness_status not null,
  band public.readiness_band not null,
  score smallint not null check (score between 0 and 100),
  components jsonb not null,
  missing_requirements jsonb not null,
  reason_codes text[] not null,
  -- The engine's input snapshot: re-running the engine on it must give this row.
  features jsonb not null,
  requested_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entrepreneur_id, assessment_no)
);

create view public.latest_readiness with (security_invoker = true) as
select distinct on (entrepreneur_id) *
from public.readiness_assessments
order by entrepreneur_id, assessment_no desc;

-- ----------------------------------------------------------- credit intent

create table public.credit_intents (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  purpose public.credit_purpose not null,
  -- R$ 100 to R$ 50,000: productive microcredit, not a mortgage.
  requested_amount_cents bigint not null check (requested_amount_cents between 10000 and 5000000),
  description text check (char_length(description) <= 500),
  status public.credit_intent_status not null default 'active',
  -- Always herself. A leader cannot declare it for her.
  declared_by uuid references public.profiles (id),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint withdrawal_is_dated check ((status = 'withdrawn') = (withdrawn_at is not null))
);

create unique index credit_intents_one_active on public.credit_intents (entrepreneur_id) where status = 'active';

-- --------------------------------------------------------------------- RLS

alter table public.checkins enable row level security;
alter table public.readiness_assessments enable row level security;
alter table public.credit_intents enable row level security;

revoke all on public.checkins, public.readiness_assessments, public.credit_intents from anon, authenticated;
grant select on public.checkins, public.readiness_assessments, public.credit_intents to authenticated;
grant select on public.checkin_cash_flow, public.latest_readiness to authenticated;

-- Herself, the leaders of her communities, auditors and admins.
create policy checkins_read on public.checkins for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);
create policy readiness_read on public.readiness_assessments for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);
create policy credit_intents_read on public.credit_intents for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);

-- ----------------------------------------------------------------- helpers

create function private.can_act_for(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    p_entrepreneur_id = private.my_entrepreneur_id()
    or private.leads_entrepreneur(p_entrepreneur_id)
    or private.is_admin(),
    false
  )
$$;

create function private.enrollment_anchor(p_entrepreneur_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$ select id from public.chain_anchors where kind = 'enrollment' and entity_id = p_entrepreneur_id $$;

-- The entrepreneur a fact is about, for the kinds that are about one.
create function private.anchor_entrepreneur(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'enrollment' then p_entity_id
    when 'checkin' then (select entrepreneur_id from public.checkins where id = p_entity_id)
    when 'readiness' then (select entrepreneur_id from public.readiness_assessments where id = p_entity_id)
  end;
end;
$$;

revoke all on function private.can_act_for(uuid), private.enrollment_anchor(uuid),
  private.anchor_entrepreneur(public.anchor_kind, uuid), private.current_period() from public;
grant execute on function private.can_act_for(uuid), private.enrollment_anchor(uuid),
  private.anchor_entrepreneur(public.anchor_kind, uuid), private.current_period() to authenticated, service_role;

-- -------------------------------------------------------------- check-in RPC

-- Reports one month. Herself, or a leader of hers for someone without a login.
create function public.submit_checkin(
  p_period text,
  p_revenue_cents bigint,
  p_cogs_cents bigint,
  p_opex_cents bigint,
  p_household_cents bigint,
  p_keeps_records boolean,
  p_active_days integer,
  p_note text default null,
  p_entrepreneur_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid := coalesce(p_entrepreneur_id, private.my_entrepreneur_id());
  v_id uuid;
begin
  if v_entrepreneur is null or not private.can_act_for(v_entrepreneur) then
    raise exception 'not_allowed_to_report' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.community_memberships m
    join public.communities c on c.id = m.community_id
    where m.entrepreneur_id = v_entrepreneur and m.status = 'active' and c.status = 'verified'
  ) then
    raise exception 'not_enrolled' using errcode = 'P0001';
  end if;
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  if p_period > private.current_period() then
    raise exception 'period_in_future' using errcode = '22023';
  end if;
  if to_date(p_period, 'YYYY-MM') < to_date(private.current_period(), 'YYYY-MM') - interval '12 months' then
    raise exception 'period_too_old' using errcode = '22023';
  end if;

  begin
    insert into public.checkins (
      entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents,
      keeps_records, active_days, note, submitted_by
    ) values (
      v_entrepreneur, p_period, p_revenue_cents, p_cogs_cents, p_opex_cents, p_household_cents,
      p_keeps_records, p_active_days, nullif(trim(p_note), ''), auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'checkin_exists_for_period' using errcode = '23505';
  end;

  -- Anchored once her own registration on chain has confirmed.
  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('checkin', v_id, private.enrollment_anchor(v_entrepreneur));

  return v_id;
end;
$$;

-- --------------------------------------------------------------- readiness

-- What the engine needs, gathered in one place. The Edge Function calls this
-- with the caller's own session, so who may ask is decided here.
create function public.readiness_inputs(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_act_for(p_entrepreneur_id) then
    raise exception 'not_allowed_to_assess' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'as_of_period', private.current_period(),
    'community_verified', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = p_entrepreneur_id and m.status = 'active' and c.status = 'verified'
    ),
    -- The core programme is EmpowerFI's own: programmes with no community.
    'core_modules_total', (
      select count(*) from public.education_modules em
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null
    ),
    'core_modules_completed', (
      select count(*) from public.education_progress pr
      join public.education_modules em on em.id = pr.module_id
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null and pr.entrepreneur_id = p_entrepreneur_id and pr.status = 'completed'
    ),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_cents', revenue_cents,
        'cogs_cents', cogs_cents,
        'opex_cents', opex_cents,
        'household_cents', household_cents,
        'keeps_records', keeps_records,
        'active_days', active_days
      ) order by period)
      from public.checkins where entrepreneur_id = p_entrepreneur_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Records an assessment the engine produced. Service role only: the Edge
-- Function computes it, clients never write a result. Evaluating again with
-- the same features and model returns the latest assessment instead of a new
-- one, so repeated requests cannot pile up attestations on chain.
create function public.record_readiness_assessment(
  p_entrepreneur_id uuid,
  p_features jsonb,
  p_result jsonb,
  p_requested_by uuid default null,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_latest public.readiness_assessments;
  v_row public.readiness_assessments;
  v_enrollment bigint;
begin
  -- Serialise assessments of one entrepreneur, so numbering has no gaps or twins.
  perform 1 from public.entrepreneurs where id = p_entrepreneur_id for update;
  if not found then
    raise exception 'entrepreneur_not_found' using errcode = 'P0002';
  end if;

  select * into v_latest from public.readiness_assessments
  where entrepreneur_id = p_entrepreneur_id order by assessment_no desc limit 1;

  if v_latest.id is not null
     and v_latest.features = p_features
     and v_latest.model_version = p_result ->> 'model_version' then
    return jsonb_build_object('id', v_latest.id, 'assessment_no', v_latest.assessment_no, 'reused', true);
  end if;

  insert into public.readiness_assessments (
    entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
    components, missing_requirements, reason_codes, features, requested_by, is_simulated, created_at
  ) values (
    p_entrepreneur_id,
    coalesce(v_latest.assessment_no, 0) + 1,
    p_result ->> 'model_version',
    p_features ->> 'as_of_period',
    (p_result ->> 'status')::public.readiness_status,
    (p_result ->> 'band')::public.readiness_band,
    (p_result ->> 'score')::smallint,
    p_result -> 'components',
    p_result -> 'missing_requirements',
    array(select jsonb_array_elements_text(p_result -> 'reason_codes')),
    p_features,
    p_requested_by,
    p_is_simulated,
    p_created_at
  )
  returning * into v_row;

  -- Attested once her registration is on chain; without one there is no
  -- borrower account to attest against, and nothing to queue.
  v_enrollment := private.enrollment_anchor(p_entrepreneur_id);
  if v_enrollment is not null then
    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('readiness', v_row.id, v_enrollment);
  end if;

  return jsonb_build_object('id', v_row.id, 'assessment_no', v_row.assessment_no, 'reused', false);
end;
$$;

-- ----------------------------------------------------------- credit intent

-- Declared by the entrepreneur herself, once she is ready. There is no
-- parameter for whom: it is always the caller.
create function public.declare_credit_intent(
  p_purpose public.credit_purpose,
  p_requested_amount_cents bigint,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid := private.my_entrepreneur_id();
  v_status public.readiness_status;
  v_id uuid;
begin
  if v_entrepreneur is null then
    raise exception 'only_the_entrepreneur_declares_intent' using errcode = '42501';
  end if;

  select status into v_status from public.readiness_assessments
  where entrepreneur_id = v_entrepreneur order by assessment_no desc limit 1;
  if v_status is distinct from 'CREDIT_READY' then
    raise exception 'not_credit_ready' using errcode = 'P0001';
  end if;

  begin
    insert into public.credit_intents (entrepreneur_id, purpose, requested_amount_cents, description, declared_by)
    values (v_entrepreneur, p_purpose, p_requested_amount_cents, nullif(trim(p_description), ''), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'intent_already_active' using errcode = '23505';
  end;
  return v_id;
end;
$$;

create function public.withdraw_credit_intent()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.credit_intents
  set status = 'withdrawn', withdrawn_at = now()
  where entrepreneur_id = private.my_entrepreneur_id() and status = 'active';
  if not found then
    raise exception 'no_active_intent' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------ the pipeline

-- Who may be taken to eligibility: ready on her latest assessment AND with an
-- active intent she declared. Ready alone never appears here — the thesis
-- regression test pins that.
create function private.credit_pipeline()
returns table (entrepreneur_id uuid, intent_id uuid, assessment_id uuid)
language sql stable security definer set search_path = ''
as $$
  select i.entrepreneur_id, i.id, r.id
  from public.credit_intents i
  join public.latest_readiness r on r.entrepreneur_id = i.entrepreneur_id
  where i.status = 'active' and r.status = 'CREDIT_READY'
$$;

revoke all on function private.credit_pipeline() from public;
grant execute on function private.credit_pipeline() to service_role;

-- ------------------------------------------------- anchoring the new kinds

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
        'community_id', c.id,
        'community_ref', encode(c.chain_ref, 'hex'),
        'name', c.name,
        'kind', c.kind,
        'city', c.city,
        'state', c.state,
        'leader_id', c.leader_id,
        'created_at', private.iso(c.created_at)
      ) into v
      from public.communities c where c.id = p_entity_id;

    when 'community_verification' then
      select jsonb_build_object(
        'community_id', c.id,
        'status', c.status,
        'verified_by', c.verified_by,
        'verified_at', private.iso(c.verified_at)
      ) into v
      from public.communities c where c.id = p_entity_id and c.status = 'verified';

    when 'enrollment' then
      select jsonb_build_object(
        'entrepreneur_id', m.entrepreneur_id,
        'community_id', m.community_id,
        'joined_at', private.iso(m.joined_at)
      ) into v
      from public.community_memberships m
      where m.entrepreneur_id = p_entity_id
      order by m.joined_at, m.community_id
      limit 1;

    -- The figures she reported, committed; never published.
    when 'checkin' then
      select jsonb_build_object(
        'checkin_id', c.id,
        'entrepreneur_id', c.entrepreneur_id,
        'period', c.period,
        'revenue_cents', c.revenue_cents,
        'cogs_cents', c.cogs_cents,
        'opex_cents', c.opex_cents,
        'household_cents', c.household_cents,
        'keeps_records', c.keeps_records,
        'active_days', c.active_days,
        'submitted_at', private.iso(c.created_at)
      ) into v
      from public.checkins c where c.id = p_entity_id;

    -- The whole assessment, inputs included, so it can be re-run and checked.
    when 'readiness' then
      select jsonb_build_object(
        'assessment_id', r.id,
        'entrepreneur_id', r.entrepreneur_id,
        'assessment_no', r.assessment_no,
        'model_version', r.model_version,
        'as_of_period', r.as_of_period,
        'status', r.status,
        'band', r.band,
        'score', r.score,
        'components', r.components,
        'missing_requirements', r.missing_requirements,
        'reason_codes', to_jsonb(r.reason_codes),
        'features', r.features,
        'assessed_at', private.iso(r.created_at)
      ) into v
      from public.readiness_assessments r where r.id = p_entity_id;
  end case;

  return v;
end;
$$;

-- claim_anchor_jobs now also hands out the borrower ref for check-ins and
-- readiness: both are anchored against her borrower account.
create or replace function public.claim_anchor_jobs(p_limit integer default 5)
returns table (
  id bigint,
  kind public.anchor_kind,
  entity_id uuid,
  attempts integer,
  payload jsonb,
  community_ref text,
  borrower_ref text
)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.chain_anchors a
    set attempts = a.attempts + 1,
        next_attempt_at = now() + interval '2 minutes'
    where a.id in (
      select j.id from public.chain_anchors j
      where j.id in (select private.due_anchor_jobs())
      order by j.id
      limit p_limit
      for update skip locked
    )
    returning a.id, a.kind, a.entity_id, a.attempts
  )
  select
    c.id,
    c.kind,
    c.entity_id,
    c.attempts,
    private.anchor_payload(c.kind, c.entity_id),
    case
      when c.kind in ('community', 'community_verification') then
        (select encode(co.chain_ref, 'hex') from public.communities co where co.id = c.entity_id)
      when c.kind = 'enrollment' then
        (select encode(co.chain_ref, 'hex')
         from public.community_memberships m
         join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = c.entity_id
         order by m.joined_at, m.community_id
         limit 1)
    end,
    (select encode(e.borrower_ref, 'hex') from public.entrepreneurs e
     where e.id = private.anchor_entrepreneur(c.kind, c.entity_id))
  from claimed c
  order by c.id;
end;
$$;

create or replace function public.audit_record(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_anchor public.chain_anchors;
  v_entrepreneur uuid := private.anchor_entrepreneur(p_kind, p_entity_id);
begin
  if not private.can_see_anchor(p_kind, p_entity_id) then
    raise exception 'not_allowed_to_audit' using errcode = '42501';
  end if;

  select * into v_anchor from public.chain_anchors where kind = p_kind and entity_id = p_entity_id;
  if not found then
    raise exception 'anchor_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'anchor', jsonb_build_object(
      'kind', v_anchor.kind,
      'entity_id', v_anchor.entity_id,
      'status', v_anchor.status,
      'commitment', encode(v_anchor.commitment, 'hex'),
      'account_address', v_anchor.account_address,
      'signature', v_anchor.signature,
      'slot', v_anchor.slot,
      'program_id', v_anchor.program_id,
      'reconcile', v_anchor.reconcile,
      'confirmed_at', private.iso(v_anchor.confirmed_at)
    ),
    'payload', private.anchor_payload(p_kind, p_entity_id),
    'community_ref', case
      when p_kind = 'enrollment' then
        (select encode(co.chain_ref, 'hex')
         from public.community_memberships m
         join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = p_entity_id
         order by m.joined_at, m.community_id
         limit 1)
      when p_kind in ('community', 'community_verification') then
        (select encode(co.chain_ref, 'hex') from public.communities co where co.id = p_entity_id)
    end,
    'borrower_ref', case
      when v_entrepreneur is not null and private.is_auditor_or_admin() then
        (select encode(borrower_ref, 'hex') from public.entrepreneurs where id = v_entrepreneur)
    end
  );
end;
$$;

-- The demo reset also clears her reported months, assessments and intents —
-- including those of entrepreneurs who keep their record.
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

  return jsonb_build_object('anchors', v_anchors, 'communities', v_communities, 'entrepreneurs', v_entrepreneurs);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function
  public.submit_checkin(text, bigint, bigint, bigint, bigint, boolean, integer, text, uuid),
  public.readiness_inputs(uuid),
  public.declare_credit_intent(public.credit_purpose, bigint, text),
  public.withdraw_credit_intent()
from public, anon;
grant execute on function
  public.submit_checkin(text, bigint, bigint, bigint, bigint, boolean, integer, text, uuid),
  public.readiness_inputs(uuid),
  public.declare_credit_intent(public.credit_purpose, bigint, text),
  public.withdraw_credit_intent()
to authenticated;

revoke all on function
  public.record_readiness_assessment(uuid, jsonb, jsonb, uuid, boolean, timestamptz)
from public, anon, authenticated;
grant execute on function
  public.record_readiness_assessment(uuid, jsonb, jsonb, uuid, boolean, timestamptz)
to service_role;
