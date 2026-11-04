-- The sponsor keeps its own promise, and she joins with a tap.
--
-- Founder's decisions, 04/11/2026:
--
--   * A SPONSOR'S REWARDS ARE THE SPONSOR'S. Whoever delivers a reward sets
--     it: a campaign's rewards are edited and published by the sponsor's own
--     people (every address in sponsor_viewers) in the site's impact area,
--     and so is the choice to offer them at all. EmpowerFI's team reads them
--     and edits only EmpowerFI's own (the house campaign), from
--     empowerfi-dashboard, as before.
--   * A sponsor delivers by CODE OR LINK. A sponsor's reward always says how
--     to redeem it (a coupon, an instruction) and may carry an https link;
--     she sees both when she earns it and keeps them under "Seus prêmios".
--     Nothing of hers reaches the sponsor: it still sees only totals.
--   * A CAMPAIGN MAY BE OPEN. Besides naming e-mails (a specific audience), a
--     campaign can let anyone in the diary join it with one tap while it
--     runs (programs.enrolment = 'open'). Joining starts today. ONE CAMPAIGN
--     AT A TIME still holds: she sees open campaigns only while she is
--     EmpowerFI's, and one that would overlap a campaign she is already
--     named in is refused, naming it.
--   * SHE MAY LEAVE A CAMPAIGN SHE JOINED, BUT NOT COME BACK to it. Today
--     stays with the campaign; from tomorrow she is EmpowerFI's. Not coming
--     back keeps a milestone from being earned twice.

-- ------------------------------------------------------------------ open campaigns

alter table public.programs
  add column enrolment text not null default 'invited' check (enrolment in ('invited', 'open'));

alter table public.program_participants
  add column joined_herself boolean not null default false;

-- ------------------------------------------------------------------ a reward's link

alter table public.reward_milestones
  add column redeem_url text check (redeem_url is null or (redeem_url ~ '^https://[^[:space:]]+$' and char_length(redeem_url) <= 500));

-- ------------------------------------------------------------------ who sets a campaign's rewards

-- EmpowerFI's: the dashboard's owners (and the platform's admins). A
-- sponsor's: that sponsor's people, and nobody else.
create function private.can_edit_rewards(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when g.is_default then private.can_manage_rewards()
    else exists (select 1 from public.sponsor_viewers v
                  where v.sponsor_id = g.sponsor_id and v.email = private.my_email())
  end
    from public.programs g
   where g.id = p_program_id and not g.is_simulated
$$;

create or replace function public.reward_programme_publish(p_milestones jsonb, p_note text default null, p_program_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
  v_program uuid;
  v_house boolean;
begin
  v_program := private.reward_campaign(p_program_id);
  if not coalesce(private.can_edit_rewards(v_program), false) then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  if jsonb_typeof(p_milestones) <> 'array' or jsonb_array_length(p_milestones) = 0 then
    raise exception 'a programme has at least one milestone' using errcode = '22023';
  end if;
  select is_default into v_house from public.programs where id = v_program;

  -- A sponsor's reward is a gift it hands over itself, by code or link: no
  -- partner benefit (that is the credit partner's, and EmpowerFI's to set),
  -- and always the words that say how to redeem it.
  if not v_house then
    if exists (select 1 from jsonb_array_elements(p_milestones) m
                where coalesce(m ->> 'kind', '') <> 'perk'
                   or nullif(btrim(m ->> 'partner_name'), '') is not null
                   or nullif(btrim(m ->> 'recipient_code'), '') is not null) then
      raise exception 'a_sponsor_reward_is_a_gift' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_milestones) m
                where nullif(btrim(m ->> 'how_to_redeem'), '') is null) then
      raise exception 'a_sponsor_reward_says_how_to_redeem' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from jsonb_array_elements(p_milestones) m
              where nullif(btrim(m ->> 'redeem_url'), '') is not null
                and (btrim(m ->> 'redeem_url') !~ '^https://[^[:space:]]+$' or char_length(btrim(m ->> 'redeem_url')) > 500)) then
    raise exception 'link_must_be_https' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('reward_programme:' || v_program::text));
  select coalesce(max(version), 0) + 1 into v_version from public.reward_programme_versions where program_id = v_program;
  insert into public.reward_programme_versions (program_id, version, note, published_by)
  values (v_program, v_version, p_note, auth.uid())
  returning id into v_id;

  -- The table's checks are the rest of the validation, as before; an unknown
  -- recipient code is refused by its foreign key.
  insert into public.reward_milestones
    (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name, recipient_code, redeem_url)
  select v_id, m ->> 'code', (m ->> 'threshold_days')::integer, m ->> 'kind',
         m ->> 'title', nullif(btrim(m ->> 'how_to_redeem'), ''), nullif(btrim(m ->> 'partner_name'), ''),
         nullif(btrim(m ->> 'recipient_code'), ''), nullif(btrim(m ->> 'redeem_url'), '')
    from jsonb_array_elements(p_milestones) m;

  return jsonb_build_object('version', v_version, 'programme_id', v_id);
end;
$$;

-- Read by whoever may edit it, and by whoever may see the campaign.
create or replace function public.reward_programme_current(p_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_program uuid := private.reward_campaign(p_program_id);
begin
  if not (coalesce(private.can_edit_rewards(v_program), false) or private.can_see_campaign(v_program)) then
    raise exception 'not_allowed_to_read_rewards' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'version', v.version, 'published_at', v.published_at, 'note', v.note,
      'milestones', (select jsonb_agg(jsonb_build_object(
          'code', m.code, 'threshold_days', m.threshold_days, 'kind', m.kind, 'title', m.title,
          'how_to_redeem', m.how_to_redeem, 'partner_name', m.partner_name,
          'recipient_code', m.recipient_code, 'redeem_url', m.redeem_url) order by m.threshold_days)
        from public.reward_milestones m where m.programme_id = v.id))
    from public.reward_programme_versions v
    where v.program_id = v_program
    order by v.version desc limit 1
  );
end;
$$;

/**
 * The impact area's rewards panel for one campaign: whether it offers them,
 * whether the caller may change that, the published programme, and how many
 * women earned each milestone in it (a count says nothing about who).
 */
create function public.impact_rewards(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
begin
  if p_program_id is null or not private.can_see_campaign(p_program_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_g from public.programs where id = p_program_id;
  return jsonb_build_object(
    'offers_rewards', v_g.offers_rewards,
    'can_edit', coalesce(private.can_edit_rewards(p_program_id), false),
    'programme', public.reward_programme_current(p_program_id),
    'earned', coalesce((select jsonb_object_agg(code, n) from (
                 select g.code, count(*) as n from public.reward_grants g
                  where g.program_id = p_program_id and not g.is_simulated
                  group by g.code) x), '{}'::jsonb)
  );
end;
$$;

/** The sponsor turns its campaign's rewards on or off. EmpowerFI's always offers them. */
create function public.impact_rewards_offer(p_program_id uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_on is null then
    raise exception 'a choice is required' using errcode = '22023';
  end if;
  if exists (select 1 from public.programs where id = p_program_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if not coalesce(private.can_edit_rewards(p_program_id), false) then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  update public.programs set offers_rewards = p_on, updated_at = now() where id = p_program_id;
  return p_on;
end;
$$;

-- ------------------------------------------------------------------ what she earns, and keeps

-- As 20261207's, with each reward's link and, in a sponsor's campaign, whose it is.
create or replace function public.journal_progress(p_entrepreneur_id uuid, p_day date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prog uuid;
  v_started date;
  v_kept integer;
  v_sim boolean;
  v_new jsonb;
  v_next jsonb;
  v_ids uuid[];
  v_codes text[];
  v_statuses text[];
  v_grant record;
  v_program public.programs%rowtype;
  v_sponsor text;
  v_joined date;
  v_streak integer;
begin
  select * into v_program from public.programs where id = private.program_on(p_entrepreneur_id, p_day);
  if not v_program.is_default then
    select name into v_sponsor from public.sponsors where id = v_program.sponsor_id;
  end if;
  -- A campaign that offers no rewards: none to earn, none to aim at.
  if v_program.offers_rewards then
    select id into v_prog from public.reward_programme_versions
     where program_id = v_program.id order by version desc limit 1;
  end if;
  select s.started_on, s.kept_days into v_started, v_kept from private.journal_streak(p_entrepreneur_id, p_day) s;
  v_streak := v_kept;
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;

  -- In a campaign, a milestone counts her days since she joined it.
  if not v_program.is_default and v_started is not null then
    select p.starts_on into v_joined from public.program_participants p
     where p.program_id = v_program.id and p.email = private.email_of(p_entrepreneur_id);
    if v_joined is not null and v_joined > v_started then
      v_started := v_joined;
      select count(*)::integer into v_kept from public.journal_days d
       where d.entrepreneur_id = p_entrepreneur_id and d.day between v_joined and p_day;
    end if;
  end if;

  with earned as (
    insert into public.reward_grants (entrepreneur_id, program_id, code, programme_id, status, streak_started_on, kept_days, is_simulated)
    select p_entrepreneur_id, v_program.id, m.code, v_prog,
           case when m.kind = 'partner_benefit' then 'awaiting_consent' else 'granted' end,
           v_started, v_kept, coalesce(v_sim, false)
      from public.reward_milestones m
     where m.programme_id = v_prog and m.threshold_days <= v_kept and v_started is not null
    on conflict (entrepreneur_id, program_id, code) do nothing
    returning id, code, status
  )
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(code), '{}'), coalesce(array_agg(status), '{}')
    into v_ids, v_codes, v_statuses
    from earned;

  for v_grant in
    select j.id, r.id as recipient_id
      from unnest(v_ids, v_codes, v_statuses) j (id, code, status)
      join public.reward_milestones m on m.programme_id = v_prog and m.code = j.code
      join public.passport_recipients r on r.code = m.recipient_code and r.active
     where j.status = 'awaiting_consent'
  loop
    begin
      perform private.share_propose(p_entrepreneur_id, v_grant.recipient_id, 'credit_offer',
                                    private.share_default_indicators(), 3, 30, v_grant.id, null);
    exception when sqlstate 'P0001' then
      null;  -- nothing_to_share: no month closed yet; staff propose it later.
    end;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'kind', m.kind, 'title', m.title, 'how_to_redeem', m.how_to_redeem,
           'redeem_url', m.redeem_url, 'sponsor_name', v_sponsor,
           'partner_name', m.partner_name, 'threshold_days', m.threshold_days, 'status', j.status)
           order by m.threshold_days), '[]'::jsonb)
    into v_new
    from unnest(v_codes, v_statuses) j (code, status)
    join public.reward_milestones m on m.programme_id = v_prog and m.code = j.code;

  select jsonb_build_object('code', m.code, 'title', m.title, 'kind', m.kind,
                            'threshold_days', m.threshold_days, 'days_left', m.threshold_days - v_kept)
    into v_next
    from public.reward_milestones m
   where m.programme_id = v_prog
     and not exists (select 1 from public.reward_grants g
                      where g.entrepreneur_id = p_entrepreneur_id and g.program_id = v_program.id and g.code = m.code)
   order by m.threshold_days
   limit 1;

  return jsonb_build_object(
    'streak_days', v_streak,
    'streak_started_on', v_started,
    'earned', v_new,
    'next', v_next
  );
end;
$$;

-- ------------------------------------------------------------------ the campaign itself

drop function public.campaign_save(uuid, text, text, date, date, text, boolean, text, text);

/**
 * As 20261207's, with who may join (p_enrolment: 'invited', only the e-mails
 * named; 'open', anyone in the diary with one tap; null keeps it, or
 * 'invited' for a new campaign). p_offers_rewards is still accepted, so a
 * dashboard from before this migration keeps saving, but it is ignored: the
 * sponsor decides that now, in the impact area.
 */
create function public.campaign_save(
  p_id uuid,
  p_sponsor_name text,
  p_name text,
  p_period_start date,
  p_period_end date,
  p_description text default null,
  p_offers_rewards boolean default null,
  p_logo_path text default null,
  p_link_url text default null,
  p_enrolment text default null
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
  if nullif(btrim(p_link_url), '') is not null
     and (btrim(p_link_url) !~ '^https://[^[:space:]]+$' or char_length(btrim(p_link_url)) > 500) then
    raise exception 'link_must_be_https' using errcode = '22023';
  end if;
  if nullif(btrim(p_logo_path), '') is not null
     and btrim(p_logo_path) !~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$' then
    raise exception 'logo_path_invalid' using errcode = '22023';
  end if;
  if p_enrolment is not null and p_enrolment not in ('invited', 'open') then
    raise exception 'enrolment_invalid' using errcode = '22023';
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
      insert into public.programs (sponsor_id, name, description, period_start, period_end, logo_path, link_url, enrolment)
      values (v_sponsor, btrim(p_name), nullif(btrim(p_description), ''), p_period_start, p_period_end,
              nullif(btrim(p_logo_path), ''), nullif(btrim(p_link_url), ''), coalesce(p_enrolment, 'invited'))
      returning id into v_id;
    else
      update public.programs
         set sponsor_id = v_sponsor, name = btrim(p_name), description = nullif(btrim(p_description), ''),
             period_start = p_period_start, period_end = p_period_end,
             logo_path = nullif(btrim(p_logo_path), ''), link_url = nullif(btrim(p_link_url), ''),
             enrolment = coalesce(p_enrolment, enrolment), updated_at = now()
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

create or replace function public.campaign_list()
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
             'enrolment', g.enrolment,
             'offers_rewards', g.offers_rewards,
             'reward_version', (select max(v.version) from public.reward_programme_versions v where v.program_id = g.id),
             'logo_path', g.logo_path,
             'link_url', g.link_url,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'authorised', (select count(*) from public.program_participants p where p.program_id = g.id),
             'joined_herself', (select count(*) from public.program_participants p
                                 where p.program_id = g.id and p.joined_herself),
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

-- As 20261204's, with whether she joined by herself.
create or replace function public.campaign_participants(p_program_id uuid)
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
             'joined_herself', p.joined_herself,
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

create or replace function public.impact_campaigns()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'name', g.name, 'sponsor_name', s.name, 'is_default', g.is_default,
           'period_start', g.period_start, 'period_end', g.period_end,
           'logo_path', g.logo_path, 'link_url', g.link_url,
           'enrolment', g.enrolment, 'offers_rewards', g.offers_rewards,
           'can_edit_rewards', coalesce(private.can_edit_rewards(g.id), false)
         ) order by g.is_default, g.period_start desc, g.name), '[]'::jsonb)
    from public.programs g join public.sponsors s on s.id = g.sponsor_id
   where not g.is_simulated and private.can_see_campaign(g.id)
$$;

-- ------------------------------------------------------------------ joining and leaving, from the diary

/**
 * Open campaigns she can join today: running, open, never joined by her.
 * Empty while she is in a campaign. One that would overlap a campaign she is
 * already named in for later says so in 'blocked_by'.
 */
create function public.diary_campaigns()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_email text := private.my_email();
  v_today date := private.sp_today();
begin
  if private.program_on(v_me, v_today) <> private.house_program() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'name', g.name, 'description', g.description, 'sponsor_name', s.name,
             'period_end', g.period_end, 'logo_path', g.logo_path, 'link_url', g.link_url,
             'offers_rewards', g.offers_rewards,
             'blocked_by', private.overlapping_campaign(v_email, v_today, g.period_end, null)
           ) order by g.period_end, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where g.enrolment = 'open' and not g.is_default and not g.is_simulated
       and v_today between g.period_start and g.period_end
       and not exists (select 1 from public.program_participants p where p.program_id = g.id and p.email = v_email)
  ), '[]'::jsonb);
end;
$$;

/** She joins an open campaign, from today to its end. */
create function public.diary_campaign_join(p_program_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  -- Only the check that she is in the diary at all (20261130's).
  v_me uuid := private.diary_me();
  v_email text := private.my_email();
  v_today date := private.sp_today();
  v_g public.programs%rowtype;
  v_clash text;
begin
  select * into v_g from public.programs where id = p_program_id and not is_simulated and not is_default;
  if not found or v_g.enrolment <> 'open' then
    raise exception 'campaign_not_open' using errcode = '42501';
  end if;
  if v_today < v_g.period_start or v_today > v_g.period_end then
    raise exception 'campaign_not_running' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('program_participants:' || v_email));
  if exists (select 1 from public.program_participants where program_id = p_program_id and email = v_email) then
    raise exception 'already_in_this_campaign' using errcode = '23505';
  end if;
  v_clash := private.overlapping_campaign(v_email, v_today, v_g.period_end, null);
  if v_clash is not null then
    raise exception 'in_another_campaign' using errcode = '23P01', detail = v_clash;
  end if;
  insert into public.program_participants (program_id, email, starts_on, authorised_by, joined_herself)
  values (p_program_id, v_email, v_today, auth.uid(), true);
  return jsonb_build_object('starts_on', v_today, 'until', v_g.period_end);
end;
$$;

/**
 * She leaves the campaign she joined by herself. Today stays with it; from
 * tomorrow she is EmpowerFI's. She cannot join it again. A campaign that
 * named her by e-mail is left through EmpowerFI, which named her.
 */
create function public.diary_campaign_leave()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_today date := private.sp_today();
  v_p public.program_participants%rowtype;
begin
  select p.* into v_p from public.program_participants p
   where p.email = private.my_email()
     and v_today >= p.starts_on
     and v_today <= coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date)
     and p.program_id = private.program_on(v_me, v_today);
  if not found then
    raise exception 'not_in_a_campaign' using errcode = 'P0002';
  end if;
  if not v_p.joined_herself then
    raise exception 'campaign_named_you' using errcode = '42501';
  end if;
  if v_p.ends_on is not null then
    raise exception 'already_left' using errcode = '22023';
  end if;
  update public.program_participants
     set ends_on = v_today, ended_by = auth.uid(), ended_at = now()
   where id = v_p.id;
  return jsonb_build_object('ends_on', v_today);
end;
$$;

-- As 20261207's, with whether she may leave her campaign, and every reward
-- she has earned (with how to redeem it), newest first.
create or replace function public.diary_profile()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_e public.entrepreneurs%rowtype;
  v_s public.diary_reminder_settings%rowtype;
  v_app jsonb;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into v_e from public.entrepreneurs where profile_id = v_uid;
  if not found then
    v_app := private.diary_from_app(v_uid);
    return jsonb_build_object(
      'enrolled', false,
      'today', private.sp_today(),
      'from_app', case when v_app is not null
                       then (v_app - 'declared_at') || jsonb_build_object('declared', v_app ->> 'declared_at' is not null)
                  end
    );
  end if;
  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_e.id, now())
  on conflict (entrepreneur_id) do update set last_seen_at = now()
  returning * into v_s;
  return jsonb_build_object(
    'enrolled', true,
    'today', private.sp_today(),
    'name', v_e.display_name,
    'reminders', jsonb_build_object('enabled', v_s.enabled, 'remind_at', to_char(v_s.remind_at, 'HH24:MI'),
                                    'time_zone', v_s.time_zone),
    'devices', (select count(*) from public.push_subscriptions
                 where entrepreneur_id = v_e.id and disabled_at is null),
    'campaign', (select jsonb_build_object('name', g.name, 'sponsor_name', s.name, 'is_default', g.is_default,
                                           'logo_path', g.logo_path, 'link_url', g.link_url,
                                           'offers_rewards', g.offers_rewards,
                                           'until', p.until,
                                           'joined_herself', coalesce(p.joined_herself, false),
                                           -- She left: today is its last day.
                                           'leaving', coalesce(p.leaving, false))
                   from public.programs g join public.sponsors s on s.id = g.sponsor_id
                   left join lateral (
                     select private.participation_end(pp.ends_on, pp.program_id) as until, pp.joined_herself,
                            pp.joined_herself and pp.ends_on is not null as leaving
                       from public.program_participants pp
                      where pp.program_id = g.id and not g.is_default and pp.email = private.email_of(v_e.id)
                   ) p on true
                  where g.id = private.program_on(v_e.id, private.sp_today())),
    'impact_consent', (select jsonb_build_object('share', c.impact, 'text_version', c.text_version)
                         from public.consents c where c.entrepreneur_id = v_e.id
                        order by c.consent_no desc limit 1),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', m.title, 'how_to_redeem', m.how_to_redeem, 'redeem_url', m.redeem_url,
               'kind', m.kind, 'status', r.status, 'granted_at', r.granted_at,
               'sponsor_name', case when g.is_default then null else s.name end)
             order by r.granted_at desc)
        from public.reward_grants r
        join public.reward_milestones m on m.programme_id = r.programme_id and m.code = r.code
        join public.programs g on g.id = r.program_id
        join public.sponsors s on s.id = g.sponsor_id
       where r.entrepreneur_id = v_e.id), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------------ grants

revoke execute on function private.can_edit_rewards(uuid) from public, anon, authenticated;
revoke execute on function
  public.impact_rewards(uuid), public.impact_rewards_offer(uuid, boolean),
  public.campaign_save(uuid, text, text, date, date, text, boolean, text, text, text),
  public.diary_campaigns(), public.diary_campaign_join(uuid), public.diary_campaign_leave()
from public, anon;
grant execute on function
  public.impact_rewards(uuid), public.impact_rewards_offer(uuid, boolean),
  public.campaign_save(uuid, text, text, date, date, text, boolean, text, text, text),
  public.diary_campaigns(), public.diary_campaign_join(uuid), public.diary_campaign_leave()
to authenticated, service_role;
