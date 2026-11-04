-- A campaign, and who is in it.
--
-- Founder's decision, 03/11/2026. The impact dashboard becomes a real
-- product fed by the diary, and campaigns are run from empowerfi-dashboard:
--
--   * A campaign is a programme: a sponsor's name, the campaign's name, a
--     start and an end date. It reuses public.sponsors and public.programs
--     (the prototype's), which reached people only through communities; the
--     diary has none, so a campaign now lists its participants itself.
--   * Participants are authorised BY E-MAIL. The address may belong to a
--     woman already in the diary or to one who has not signed up yet: the
--     day she enrols with it, she is in. Nothing here is copied from her
--     account; the e-mail is matched when a figure is computed.
--   * ONE CAMPAIGN AT A TIME. Every day she records belongs to exactly one
--     sponsor -- the campaign she was in that day -- so no sponsor counts a
--     day another one also counts. An authorisation that would overlap is
--     refused and names the campaign in the way.
--   * Everyone else belongs to EmpowerFI: a house sponsor with a default
--     programme that has no end, because the point is a continuous record.
--     Whoever leaves a campaign goes back to it from the next day, and her
--     earlier days stay with the campaign they were recorded in.
--   * The people a sponsor names (sponsor_viewers, by e-mail) may open that
--     sponsor's campaigns in the reserved area of the site. EmpowerFI's team
--     sees all of them. Nobody outside reads these tables directly.
--
-- Writes go through functions gated like the rewards programme: the
-- platform's admins or an owner of the dashboard's admin layer
-- (private.can_manage_rewards). Every refusal is an error code the dashboard
-- turns into words.

-- ------------------------------------------------------------------ the house

alter table public.sponsors add column is_house boolean not null default false;
create unique index sponsors_one_house on public.sponsors (is_house) where is_house;

alter table public.programs alter column period_end drop not null;
alter table public.programs alter column funding_committed_cents set default 0;
alter table public.programs add column is_default boolean not null default false;
alter table public.programs add column updated_at timestamptz not null default now();
create unique index programs_one_default on public.programs (is_default) where is_default;
-- Only the house programme runs without an end; a campaign always has one.
alter table public.programs add constraint a_campaign_ends check (is_default or period_end is not null);

insert into public.sponsors (name, kind, is_house) values ('EmpowerFI', 'company', true)
on conflict (name) do update set is_house = true;

insert into public.programs (sponsor_id, name, description, period_start, period_end, is_default)
select id, 'Diário EmpowerFI', 'Quem usa o diário sem uma campanha de patrocinador.', date '2026-11-02', null, true
  from public.sponsors where is_house
on conflict (sponsor_id, name) do update set is_default = true, period_end = null;

-- ------------------------------------------------------------------ who is in

create table public.program_participants (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs (id) on delete cascade,
  email         text not null check (email = lower(btrim(email)) and char_length(email) <= 254
                                     and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  starts_on     date not null,
  -- Null: until the campaign ends. Set when she is taken out early.
  ends_on       date,
  authorised_by uuid,
  authorised_at timestamptz not null default now(),
  ended_by      uuid,
  ended_at      timestamptz,
  unique (program_id, email),
  constraint a_participation_is_ordered check (ends_on is null or ends_on >= starts_on)
);
create index program_participants_email_idx on public.program_participants (email);

create table public.sponsor_viewers (
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  email      text not null check (email = lower(btrim(email)) and char_length(email) <= 254
                                  and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  added_by   uuid,
  added_at   timestamptz not null default now(),
  primary key (sponsor_id, email)
);
create index sponsor_viewers_email_idx on public.sponsor_viewers (email);

alter table public.program_participants enable row level security;
alter table public.sponsor_viewers enable row level security;
revoke all on public.program_participants, public.sponsor_viewers from anon, authenticated;

-- ------------------------------------------------------------------ helpers

create function private.house_program()
returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.programs where is_default $$;

-- The caller's verified address, from the account itself, never from the request.
create function private.my_email()
returns text
language sql stable security definer set search_path = ''
as $$ select lower(btrim(email)) from auth.users where id = auth.uid() $$;

-- An entrepreneur's address, the same way.
create function private.email_of(p_entrepreneur_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(btrim(u.email))
    from public.entrepreneurs e join auth.users u on u.id = e.profile_id
   where e.id = p_entrepreneur_id
$$;

-- The last day a participation covers: its own end, else its campaign's.
create function private.participation_end(p_ends_on date, p_program_id uuid)
returns date
language sql stable security definer set search_path = ''
as $$ select coalesce(p_ends_on, (select period_end from public.programs where id = p_program_id)) $$;

-- EmpowerFI's team: the platform's admins and every admin of the dashboard's
-- layer, owner or not (they read; only owners write, through can_manage_rewards).
create function private.is_impact_staff()
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' or private.is_admin() then
    return true;
  end if;
  if to_regprocedure('public.is_admin()') is not null then
    execute 'select public.is_admin()' into v;
    return coalesce(v, false);
  end if;
  return false;
end;
$$;

create function private.can_see_campaign(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_impact_staff()
    or exists (select 1 from public.programs g
                 join public.sponsor_viewers v on v.sponsor_id = g.sponsor_id
                where g.id = p_program_id and not g.is_simulated and v.email = private.my_email())
$$;

/**
 * Which campaign a day of hers belongs to: the one whose participation
 * covered it, else EmpowerFI's. Overlaps are refused on the way in, so at
 * most one participation can cover a day.
 */
create function private.program_on(p_entrepreneur_id uuid, p_day date)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select p.program_id
      from public.program_participants p
     where p.email = private.email_of(p_entrepreneur_id)
       and p_day >= p.starts_on
       and p_day <= coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date)
     order by p.starts_on desc
     limit 1
  ), private.house_program())
$$;

-- The campaign whose participation of this address overlaps [p_from, p_to],
-- other than p_except_id: the reason an authorisation is refused.
create function private.overlapping_campaign(p_email text, p_from date, p_to date, p_except_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select g.name || ' (' || s.name || ')'
    from public.program_participants p
    join public.programs g on g.id = p.program_id
    join public.sponsors s on s.id = g.sponsor_id
   where p.email = p_email
     and p.id is distinct from p_except_id
     and p.starts_on <= coalesce(p_to, 'infinity'::date)
     and coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date) >= p_from
   order by p.starts_on
   limit 1
$$;

create function private.require_campaign_manager()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_manage_rewards() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ------------------------------------------------------------------ for empowerfi-dashboard

/** Every real campaign, newest first, the house one last, with its counts and its sponsor's viewers. */
create function public.campaign_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'name', g.name,
             'description', g.description,
             'sponsor_id', s.id,
             'sponsor_name', s.name,
             'is_default', g.is_default,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'authorised', (select count(*) from public.program_participants p where p.program_id = g.id),
             'enrolled', (select count(*) from public.program_participants p
                           join auth.users u on lower(btrim(u.email)) = p.email
                           join public.entrepreneurs e on e.profile_id = u.id
                          where p.program_id = g.id),
             'viewers', coalesce((select jsonb_agg(v.email order by v.email) from public.sponsor_viewers v
                                   where v.sponsor_id = s.id), '[]'::jsonb)
           ) order by g.is_default, g.period_start desc, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where not g.is_simulated
  ), '[]'::jsonb);
end;
$$;

/**
 * Creates (p_id null) or edits a campaign. The sponsor is found by name, or
 * made. The house programme is not edited here. Changing the dates moves the
 * participations with them: nobody starts before the campaign or stays after
 * it, and a change that would make two campaigns overlap for someone is
 * refused, naming her campaign.
 */
create function public.campaign_save(
  p_id uuid,
  p_sponsor_name text,
  p_name text,
  p_period_start date,
  p_period_end date,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_sponsor uuid;
  v_id uuid;
  v_sponsor_name text := btrim(coalesce(p_sponsor_name, ''));
  v_clash text;
  v_p record;
begin
  perform private.require_campaign_manager();
  if char_length(v_sponsor_name) not between 2 and 120 then
    raise exception 'sponsor_name_length' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'campaign_name_length' using errcode = '22023';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'campaign_period_invalid' using errcode = '22023';
  end if;
  if p_id is not null and exists (select 1 from public.programs where id = p_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if p_id is not null and not exists (select 1 from public.programs where id = p_id and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;

  select id into v_sponsor from public.sponsors where lower(name) = lower(v_sponsor_name);
  if v_sponsor is null then
    insert into public.sponsors (name, kind) values (v_sponsor_name, 'company') returning id into v_sponsor;
  elsif exists (select 1 from public.sponsors where id = v_sponsor and is_house) then
    raise exception 'house_sponsor_is_fixed' using errcode = '22023';
  end if;

  begin
    if p_id is null then
      insert into public.programs (sponsor_id, name, description, period_start, period_end)
      values (v_sponsor, btrim(p_name), nullif(btrim(p_description), ''), p_period_start, p_period_end)
      returning id into v_id;
    else
      update public.programs
         set sponsor_id = v_sponsor, name = btrim(p_name), description = nullif(btrim(p_description), ''),
             period_start = p_period_start, period_end = p_period_end, updated_at = now()
       where id = p_id
      returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'campaign_name_taken' using errcode = '23505';
  end;

  -- Participations follow the new dates.
  delete from public.program_participants
   where program_id = v_id and (starts_on > p_period_end or coalesce(ends_on, p_period_end) < p_period_start);
  update public.program_participants
     set starts_on = greatest(starts_on, p_period_start),
         ends_on = case when ends_on is null then null else least(ends_on, p_period_end) end
   where program_id = v_id;
  for v_p in select * from public.program_participants where program_id = v_id loop
    v_clash := private.overlapping_campaign(v_p.email, v_p.starts_on, coalesce(v_p.ends_on, p_period_end), v_p.id);
    if v_clash is not null then
      raise exception 'participant_in_another_campaign' using errcode = '23P01',
        detail = v_p.email || ' -> ' || v_clash;
    end if;
  end loop;
  return v_id;
end;
$$;

/** Deletes a campaign that has not started; one that has is ended instead (campaign_save with today). */
create function public.campaign_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  if exists (select 1 from public.programs where id = p_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if exists (select 1 from public.programs where id = p_id and period_start <= private.sp_today()) then
    raise exception 'campaign_already_started' using errcode = '22023';
  end if;
  delete from public.programs where id = p_id and not is_simulated;
end;
$$;

/**
 * A campaign's participants, for EmpowerFI's team: the address, whether it
 * has signed up to the diary (and then her name and city), the dates, and
 * how many days she has recorded within them.
 */
create function public.campaign_participants(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id,
             'email', p.email,
             'starts_on', p.starts_on,
             'ends_on', private.participation_end(p.ends_on, p.program_id),
             'ended_early', p.ends_on is not null,
             'enrolled', e.id is not null,
             'name', e.display_name,
             'city', e.city,
             'state', e.state,
             'days_recorded', case when e.id is null then 0 else (
               select count(*) from public.journal_days d
                where d.entrepreneur_id = e.id and d.day >= p.starts_on
                  and d.day <= coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date)) end
           ) order by p.email)
      from public.program_participants p
      left join auth.users u on lower(btrim(u.email)) = p.email
      left join public.entrepreneurs e on e.profile_id = u.id
     where p.program_id = p_program_id
  ), '[]'::jsonb);
end;
$$;

/**
 * Authorises addresses into a campaign, from p_starts_on (default: today or
 * the campaign's start, whichever is later) to its end. Each address comes
 * back in one of four lists: added, already (in this campaign), conflicts
 * (in another campaign at the same time, with its name) or invalid.
 */
create function public.campaign_authorise(p_program_id uuid, p_emails text[], p_starts_on date default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
  v_from date;
  v_raw text;
  v_email text;
  v_clash text;
  v_added text[] := '{}';
  v_already text[] := '{}';
  v_invalid text[] := '{}';
  v_conflicts jsonb := '[]'::jsonb;
begin
  perform private.require_campaign_manager();
  select * into v_g from public.programs where id = p_program_id and not is_simulated;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if v_g.is_default then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  v_from := greatest(coalesce(p_starts_on, private.sp_today()), v_g.period_start);
  if v_from > v_g.period_end then
    raise exception 'campaign_already_ended' using errcode = '22023';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 500 then
    raise exception 'too_many_at_once' using errcode = '22023';
  end if;

  foreach v_raw in array coalesce(p_emails, '{}') loop
    v_email := lower(btrim(v_raw));
    continue when v_email = '';
    if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_invalid := v_invalid || v_raw;
      continue;
    end if;
    -- Two authorisations of one address at once must not both pass the check.
    perform pg_advisory_xact_lock(hashtext('program_participants:' || v_email));
    if exists (select 1 from public.program_participants where program_id = p_program_id and email = v_email) then
      v_already := v_already || v_email;
      continue;
    end if;
    v_clash := private.overlapping_campaign(v_email, v_from, v_g.period_end, null);
    if v_clash is not null then
      v_conflicts := v_conflicts || jsonb_build_object('email', v_email, 'campaign', v_clash);
      continue;
    end if;
    insert into public.program_participants (program_id, email, starts_on, authorised_by)
    values (p_program_id, v_email, v_from, auth.uid());
    v_added := v_added || v_email;
  end loop;

  return jsonb_build_object('added', to_jsonb(v_added), 'already', to_jsonb(v_already),
                            'conflicts', v_conflicts, 'invalid', to_jsonb(v_invalid), 'starts_on', v_from);
end;
$$;

/**
 * Takes her out. Before her participation started it is simply removed;
 * after, it ends yesterday, so the days she recorded stay with this campaign
 * and from today she is EmpowerFI's.
 */
create function public.campaign_remove(p_participant_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.program_participants%rowtype;
  v_today date := private.sp_today();
begin
  perform private.require_campaign_manager();
  select * into v_p from public.program_participants where id = p_participant_id;
  if not found then
    raise exception 'no_such_participant' using errcode = 'P0002';
  end if;
  if v_p.starts_on >= v_today then
    delete from public.program_participants where id = p_participant_id;
    return jsonb_build_object('status', 'removed');
  end if;
  if coalesce(private.participation_end(v_p.ends_on, v_p.program_id), 'infinity'::date) < v_today then
    return jsonb_build_object('status', 'already_over');
  end if;
  update public.program_participants
     set ends_on = v_today - 1, ended_by = auth.uid(), ended_at = now()
   where id = p_participant_id;
  return jsonb_build_object('status', 'ended', 'ends_on', v_today - 1);
end;
$$;

/** Who at a sponsor may open its campaigns in the reserved area of the site. */
create function public.sponsor_viewer_set(p_sponsor_id uuid, p_email text, p_allowed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform private.require_campaign_manager();
  if not exists (select 1 from public.sponsors where id = p_sponsor_id and not is_simulated) then
    raise exception 'no_such_sponsor' using errcode = 'P0002';
  end if;
  if p_allowed then
    if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'invalid_email' using errcode = '22023';
    end if;
    insert into public.sponsor_viewers (sponsor_id, email, added_by) values (p_sponsor_id, v_email, auth.uid())
    on conflict do nothing;
  else
    delete from public.sponsor_viewers where sponsor_id = p_sponsor_id and email = v_email;
  end if;
  return coalesce((select jsonb_agg(email order by email) from public.sponsor_viewers where sponsor_id = p_sponsor_id),
                  '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke execute on function
  private.house_program(), private.my_email(), private.email_of(uuid), private.participation_end(date, uuid),
  private.is_impact_staff(), private.can_see_campaign(uuid), private.program_on(uuid, date),
  private.overlapping_campaign(text, date, date, uuid), private.require_campaign_manager()
from public, anon, authenticated;

revoke execute on function
  public.campaign_list(), public.campaign_save(uuid, text, text, date, date, text), public.campaign_delete(uuid),
  public.campaign_participants(uuid), public.campaign_authorise(uuid, text[], date), public.campaign_remove(uuid),
  public.sponsor_viewer_set(uuid, text, boolean)
from public, anon;
grant execute on function
  public.campaign_list(), public.campaign_save(uuid, text, text, date, date, text), public.campaign_delete(uuid),
  public.campaign_participants(uuid), public.campaign_authorise(uuid, text[], date), public.campaign_remove(uuid),
  public.sponsor_viewer_set(uuid, text, boolean)
to authenticated, service_role;
