-- Streaks and rewards: a habit, rewarded for being kept.
--
-- The programme (docs/whatsapp/diario.pt-BR.md, section 5): a perk at one
-- complete week, a bigger one at two, a bigger one at four, and at sixty days
-- the partner's financial benefit -- first, a credit card, which the partner
-- offers and decides on. Rewards are for regularity, never for amounts: what
-- earns them is a day kept, and a day with nothing sold is kept the moment she
-- says so.
--
-- Where things live:
--
--   reward_programme_versions / reward_milestones
--       the programme, as PUBLISHED. The dashboard edits a draft wherever it
--       likes and publishes through reward_programme_publish(), an admin-gated
--       RPC -- the same handoff the dashboard uses for campaigns. A published
--       version is frozen; publishing again makes a new one. WhatsApp only
--       ever reads the latest published version.
--   reward_grants
--       what each woman earned, once per milestone, with the version it was
--       earned under. A milestone is identified by its code, which is stable
--       across versions: renaming the title of "week1" changes what the next
--       woman reads, not who has already earned it.
--
-- The streak: a run of kept days in which no calendar week (Monday to Sunday)
-- is missing more than one -- one day of grace per week, as decided. Its
-- length is the number of days KEPT in the run. A milestone of seven is seven
-- kept days.
--
-- Partner benefits wait for consent: earned at sixty days, but nothing of hers
-- goes to a partner without the partner-sharing consent, so the grant is
-- recorded as awaiting_consent until she gives it.

-- ------------------------------------------------------------------ the programme

create table public.reward_programme_versions (
  id            uuid primary key default gen_random_uuid(),
  version       integer not null unique check (version > 0),
  note          text check (note is null or char_length(note) <= 500),
  published_at  timestamptz not null default now(),
  -- Null for the version this migration seeds.
  published_by  uuid
);

create table public.reward_milestones (
  programme_id    uuid not null references public.reward_programme_versions (id) on delete restrict,
  code            text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  threshold_days  integer not null check (threshold_days between 1 and 3650),
  kind            text not null check (kind in ('perk', 'partner_benefit')),
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  how_to_redeem   text check (how_to_redeem is null or char_length(how_to_redeem) <= 300),
  partner_name    text check (partner_name is null or char_length(btrim(partner_name)) between 1 and 80),
  primary key (programme_id, code),
  unique (programme_id, threshold_days),
  -- A partner's benefit names the partner: the message says whose offer it is.
  constraint a_partner_benefit_names_its_partner check (kind <> 'partner_benefit' or partner_name is not null)
);

create table public.reward_grants (
  id                 uuid primary key default gen_random_uuid(),
  entrepreneur_id    uuid not null references public.entrepreneurs (id) on delete cascade,
  code               text not null,
  programme_id       uuid not null references public.reward_programme_versions (id) on delete restrict,
  status             text not null check (status in ('granted', 'awaiting_consent')),
  streak_started_on  date not null,
  kept_days          integer not null,
  granted_at         timestamptz not null default now(),
  is_simulated       boolean not null default false,
  unique (entrepreneur_id, code)
);

alter table public.reward_programme_versions enable row level security;
alter table public.reward_milestones enable row level security;
alter table public.reward_grants enable row level security;
revoke all on public.reward_programme_versions, public.reward_milestones, public.reward_grants from anon, authenticated;

-- The first programme, so the habit has something to aim at from day one.
-- Titles are placeholders until the dashboard publishes the real ones; the
-- partner is named there too.
with v as (
  insert into public.reward_programme_versions (version, note)
  values (1, 'Programa inicial: semanas 1, 2 e 4, e o benefício do parceiro aos 60 dias.')
  returning id
)
insert into public.reward_milestones (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name)
select v.id, m.code, m.days, m.kind, m.title, m.how, m.partner
  from v, (values
    ('week1', 7,  'perk',            'Presente da semana 1',          'A equipe da EmpowerFI vai falar com você para combinar a entrega.', null),
    ('week2', 14, 'perk',            'Presente da semana 2',          'A equipe da EmpowerFI vai falar com você para combinar a entrega.', null),
    ('week4', 28, 'perk',            'Presente das 4 semanas',        'A equipe da EmpowerFI vai falar com você para combinar a entrega.', null),
    ('day60', 60, 'partner_benefit', 'Oferta de cartão de crédito',   'O parceiro vai analisar o seu histórico e entrar em contato.',      'um parceiro da EmpowerFI')
  ) as m(code, days, kind, title, how, partner);

-- --------------------------------------------------------------------- who may publish
--
-- The credit platform's admins, or an owner of the dashboard's admin layer.
-- That layer (public.admin_users / public.admin_role()) belongs to the app's
-- repository and exists in production; it is looked up by name so this
-- migration still applies to a database that does not have it.

create function private.can_manage_rewards()
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text;
begin
  if coalesce(auth.role(), '') = 'service_role' or private.is_admin() then
    return true;
  end if;
  if to_regprocedure('public.admin_role()') is not null then
    execute 'select public.admin_role()' into v_role;
    return v_role = 'owner';
  end if;
  return false;
end;
$$;

/**
 * Publishes a new, frozen version of the programme.
 *
 * p_milestones: [{ code, threshold_days, kind, title, how_to_redeem?, partner_name? }]
 * Every milestone of the programme, not a change to the last one: what is
 * published is exactly what women will read from the next message on.
 */
create function public.reward_programme_publish(p_milestones jsonb, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  if jsonb_typeof(p_milestones) <> 'array' or jsonb_array_length(p_milestones) = 0 then
    raise exception 'a programme has at least one milestone' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.reward_programme_versions;
  insert into public.reward_programme_versions (version, note, published_by)
  values (v_version, p_note, auth.uid())
  returning id into v_id;

  -- The table's checks are the validation: a duplicate code or threshold, a
  -- partner benefit without a partner, an empty title -- any of them refuses
  -- the whole version.
  insert into public.reward_milestones (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name)
  select v_id, m ->> 'code', (m ->> 'threshold_days')::integer, m ->> 'kind',
         m ->> 'title', nullif(btrim(m ->> 'how_to_redeem'), ''), nullif(btrim(m ->> 'partner_name'), '')
    from jsonb_array_elements(p_milestones) m;

  return jsonb_build_object('version', v_version, 'programme_id', v_id);
end;
$$;

/** The programme as published now, for the dashboard to show and to start a draft from. */
create function public.reward_programme_current()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed_to_read_rewards' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'version', v.version, 'published_at', v.published_at, 'note', v.note,
      'milestones', (select jsonb_agg(jsonb_build_object(
          'code', m.code, 'threshold_days', m.threshold_days, 'kind', m.kind, 'title', m.title,
          'how_to_redeem', m.how_to_redeem, 'partner_name', m.partner_name) order by m.threshold_days)
        from public.reward_milestones m where m.programme_id = v.id))
    from public.reward_programme_versions v
    order by v.version desc limit 1
  );
end;
$$;

-- ----------------------------------------------------------------------- the streak

/**
 * Her current run of kept days, as of a day.
 *
 * Walks back from p_as_of. A day not kept is forgiven once per calendar week;
 * the second one in the same week ends the run there. Days before her first
 * kept day are not misses -- she had not started.
 */
create function private.journal_streak(p_entrepreneur_id uuid, p_as_of date)
returns table (started_on date, kept_days integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_first date;
  v_day date;
  v_week date := null;
  v_missed integer := 0;
begin
  started_on := null;
  kept_days := 0;
  select min(day) into v_first from public.journal_days where entrepreneur_id = p_entrepreneur_id;
  if v_first is null or v_first > p_as_of then
    return next;
    return;
  end if;

  v_day := p_as_of;
  while v_day >= v_first loop
    if v_week is distinct from date_trunc('week', v_day)::date then
      v_week := date_trunc('week', v_day)::date;
      v_missed := 0;
    end if;
    if exists (select 1 from public.journal_days where entrepreneur_id = p_entrepreneur_id and day = v_day) then
      kept_days := kept_days + 1;
      started_on := v_day;
    else
      v_missed := v_missed + 1;
      exit when v_missed >= 2;
    end if;
    v_day := v_day - 1;
  end loop;
  return next;
end;
$$;

/**
 * After a day is written: her streak, anything it has just earned, and what
 * comes next. Granting is idempotent -- a milestone is earned once, ever --
 * so a second call for the same day earns nothing new.
 */
create function public.journal_progress(p_entrepreneur_id uuid, p_day date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prog uuid;
  v_started date;
  v_kept integer;
  v_sim boolean;
  v_partner_ok boolean;
  v_new jsonb;
  v_next jsonb;
begin
  select id into v_prog from public.reward_programme_versions order by version desc limit 1;
  select s.started_on, s.kept_days into v_started, v_kept from private.journal_streak(p_entrepreneur_id, p_day) s;
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;
  v_partner_ok := private.has_consent(p_entrepreneur_id, 'partner');

  with earned as (
    insert into public.reward_grants (entrepreneur_id, code, programme_id, status, streak_started_on, kept_days, is_simulated)
    select p_entrepreneur_id, m.code, v_prog,
           case when m.kind = 'partner_benefit' and not v_partner_ok then 'awaiting_consent' else 'granted' end,
           v_started, v_kept, coalesce(v_sim, false)
      from public.reward_milestones m
     where m.programme_id = v_prog and m.threshold_days <= v_kept and v_started is not null
    on conflict (entrepreneur_id, code) do nothing
    returning code, status
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'kind', m.kind, 'title', m.title, 'how_to_redeem', m.how_to_redeem,
           'partner_name', m.partner_name, 'threshold_days', m.threshold_days, 'status', e.status)
           order by m.threshold_days), '[]'::jsonb)
    into v_new
    from earned e join public.reward_milestones m on m.programme_id = v_prog and m.code = e.code;

  select jsonb_build_object('code', m.code, 'title', m.title, 'kind', m.kind,
                            'threshold_days', m.threshold_days, 'days_left', m.threshold_days - v_kept)
    into v_next
    from public.reward_milestones m
   where m.programme_id = v_prog
     and not exists (select 1 from public.reward_grants g where g.entrepreneur_id = p_entrepreneur_id and g.code = m.code)
   order by m.threshold_days
   limit 1;

  return jsonb_build_object(
    'streak_days', v_kept,
    'streak_started_on', v_started,
    'earned', v_new,
    'next', v_next
  );
end;
$$;

/**
 * She authorises sharing her history with partners, in her own words on
 * WhatsApp, after reading what it means (the text the caller sent, versioned
 * in p_text_version). A new consent row, as every change of consent is: the
 * other scopes are carried over unchanged. Anything she had earned that was
 * waiting on this is released, and returned so she is told what.
 */
create function public.whatsapp_partner_consent(p_entrepreneur_id uuid, p_text_version text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_last public.consents%rowtype;
  v_released jsonb;
begin
  select * into v_last from public.consents
   where entrepreneur_id = p_entrepreneur_id order by consent_no desc limit 1;
  if not found then
    raise exception 'no consent on record to extend' using errcode = 'P0001';
  end if;

  if not v_last.partner then
    insert into public.consents
      (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel, is_simulated)
    values (p_entrepreneur_id, v_last.consent_no + 1, p_text_version, v_last.assessment, true,
            v_last.investors, v_last.impact, 'whatsapp', v_last.is_simulated);
  end if;

  with released as (
    update public.reward_grants g set status = 'granted'
     where g.entrepreneur_id = p_entrepreneur_id and g.status = 'awaiting_consent'
    returning g.code, g.programme_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'kind', m.kind, 'title', m.title, 'how_to_redeem', m.how_to_redeem,
           'partner_name', m.partner_name, 'threshold_days', m.threshold_days, 'status', 'granted')), '[]'::jsonb)
    into v_released
    from released r join public.reward_milestones m on m.programme_id = r.programme_id and m.code = r.code;

  return jsonb_build_object('already', v_last.partner, 'released', v_released);
end;
$$;

/** Whether anything she earned is waiting on her consent: what AUTORIZO is answering. */
create function public.reward_awaiting_consent(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.reward_grants
                  where entrepreneur_id = p_entrepreneur_id and status = 'awaiting_consent')
$$;

revoke execute on function public.whatsapp_partner_consent(uuid, text) from public, anon, authenticated;
revoke execute on function public.reward_awaiting_consent(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_partner_consent(uuid, text) to service_role;
grant execute on function public.reward_awaiting_consent(uuid) to service_role;
revoke execute on function private.can_manage_rewards() from public, anon;
revoke execute on function public.reward_programme_publish(jsonb, text) from public, anon;
revoke execute on function public.reward_programme_current() from public, anon;
revoke execute on function private.journal_streak(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_progress(uuid, date) from public, anon, authenticated;
-- Signed-in callers reach the two programme RPCs; the gate inside decides.
grant execute on function public.reward_programme_publish(jsonb, text) to authenticated, service_role;
grant execute on function public.reward_programme_current() to authenticated, service_role;
grant execute on function public.journal_progress(uuid, date) to service_role;
