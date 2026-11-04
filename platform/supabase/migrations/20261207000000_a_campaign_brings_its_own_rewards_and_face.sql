-- A campaign brings its own rewards, and its sponsor's face.
--
-- Founder's request, 04/11/2026:
--
--   * REWARDS BELONG TO A CAMPAIGN. The single, global programme becomes
--     EmpowerFI's (the house campaign keeps every version and grant it had),
--     and every campaign may offer one of its own -- or none
--     (programs.offers_rewards). A version is numbered within its campaign.
--     A day earns from the campaign she was in that day; in a campaign that
--     offers nothing, she earns nothing new and keeps what she earned.
--   * IN A CAMPAIGN, A MILESTONE COUNTS THE DAYS SINCE SHE JOINED IT, within
--     her current streak. Counting the whole streak would hand a woman with
--     fifty days behind her every reward on the day she is authorised. The
--     streak she is shown is still her own, whole.
--   * A grant is once per campaign: the same code in two campaigns is two
--     rewards, earned separately.
--   * THE SPONSOR'S FACE: a campaign may carry the sponsor's logo (an image
--     in the public sponsor-logos bucket, uploaded from the dashboard) and a
--     link to the sponsor's page or product. The diary shows the logo, linked,
--     to the women in the campaign; the impact area shows it as "Sponsored
--     by". Only https links; only PNG, JPEG or WebP up to 512 KB -- no SVG,
--     which can carry script.

-- ------------------------------------------------------------------ the campaign's face and choice

alter table public.programs
  add column offers_rewards boolean not null default false,
  add column logo_path text check (logo_path is null or logo_path ~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$'),
  add column link_url text check (link_url is null or (link_url ~ '^https://[^[:space:]]+$' and char_length(link_url) <= 500));
update public.programs set offers_rewards = true where is_default;

-- ------------------------------------------------------------------ rewards per campaign

alter table public.reward_programme_versions add column program_id uuid references public.programs (id) on delete restrict;
update public.reward_programme_versions set program_id = private.house_program() where program_id is null;
alter table public.reward_programme_versions alter column program_id set not null;
alter table public.reward_programme_versions drop constraint if exists reward_programme_versions_version_key;
alter table public.reward_programme_versions add constraint a_version_is_numbered_within_its_campaign unique (program_id, version);

alter table public.reward_grants add column program_id uuid references public.programs (id) on delete restrict;
update public.reward_grants g set program_id = v.program_id from public.reward_programme_versions v where v.id = g.programme_id;
alter table public.reward_grants alter column program_id set not null;
alter table public.reward_grants drop constraint if exists reward_grants_entrepreneur_id_code_key;
alter table public.reward_grants add constraint a_reward_is_earned_once_per_campaign unique (entrepreneur_id, program_id, code);

-- The campaign a reward call is about: the one named, else EmpowerFI's.
create function private.reward_campaign(p_program_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v uuid := coalesce(p_program_id, private.house_program());
begin
  if not exists (select 1 from public.programs where id = v and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

drop function public.reward_programme_publish(jsonb, text);
drop function public.reward_programme_current();

create function public.reward_programme_publish(p_milestones jsonb, p_note text default null, p_program_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
  v_program uuid;
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  if jsonb_typeof(p_milestones) <> 'array' or jsonb_array_length(p_milestones) = 0 then
    raise exception 'a programme has at least one milestone' using errcode = '22023';
  end if;

  v_program := private.reward_campaign(p_program_id);
  perform pg_advisory_xact_lock(hashtext('reward_programme:' || v_program::text));
  select coalesce(max(version), 0) + 1 into v_version from public.reward_programme_versions where program_id = v_program;
  insert into public.reward_programme_versions (program_id, version, note, published_by)
  values (v_program, v_version, p_note, auth.uid())
  returning id into v_id;

  -- The table's checks are the validation, as before; an unknown recipient
  -- code is refused by its foreign key.
  insert into public.reward_milestones
    (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name, recipient_code)
  select v_id, m ->> 'code', (m ->> 'threshold_days')::integer, m ->> 'kind',
         m ->> 'title', nullif(btrim(m ->> 'how_to_redeem'), ''), nullif(btrim(m ->> 'partner_name'), ''),
         nullif(btrim(m ->> 'recipient_code'), '')
    from jsonb_array_elements(p_milestones) m;

  return jsonb_build_object('version', v_version, 'programme_id', v_id);
end;
$$;

create function public.reward_programme_current(p_program_id uuid default null)
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
          'how_to_redeem', m.how_to_redeem, 'partner_name', m.partner_name,
          'recipient_code', m.recipient_code) order by m.threshold_days)
        from public.reward_milestones m where m.programme_id = v.id))
    from public.reward_programme_versions v
    where v.program_id = private.reward_campaign(p_program_id)
    order by v.version desc limit 1
  );
end;
$$;

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
  v_joined date;
  v_streak integer;
begin
  select * into v_program from public.programs where id = private.program_on(p_entrepreneur_id, p_day);
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

drop function public.campaign_save(uuid, text, text, date, date, text);

create function public.campaign_save(
  p_id uuid,
  p_sponsor_name text,
  p_name text,
  p_period_start date,
  p_period_end date,
  p_description text default null,
  p_offers_rewards boolean default false,
  p_logo_path text default null,
  p_link_url text default null
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
      insert into public.programs (sponsor_id, name, description, period_start, period_end, offers_rewards, logo_path, link_url)
      values (v_sponsor, btrim(p_name), nullif(btrim(p_description), ''), p_period_start, p_period_end,
              coalesce(p_offers_rewards, false), nullif(btrim(p_logo_path), ''), nullif(btrim(p_link_url), ''))
      returning id into v_id;
    else
      update public.programs
         set sponsor_id = v_sponsor, name = btrim(p_name), description = nullif(btrim(p_description), ''),
             period_start = p_period_start, period_end = p_period_end,
             offers_rewards = coalesce(p_offers_rewards, false), logo_path = nullif(btrim(p_logo_path), ''),
             link_url = nullif(btrim(p_link_url), ''), updated_at = now()
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
             'offers_rewards', g.offers_rewards,
             'reward_version', (select max(v.version) from public.reward_programme_versions v where v.program_id = g.id),
             'logo_path', g.logo_path,
             'link_url', g.link_url,
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

create or replace function public.impact_campaigns()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'name', g.name, 'sponsor_name', s.name, 'is_default', g.is_default,
           'period_start', g.period_start, 'period_end', g.period_end,
           'logo_path', g.logo_path, 'link_url', g.link_url
         ) order by g.is_default, g.period_start desc, g.name), '[]'::jsonb)
    from public.programs g join public.sponsors s on s.id = g.sponsor_id
   where not g.is_simulated and private.can_see_campaign(g.id)
$$;

-- She sees her campaign's sponsor (logo and link) and whether it offers rewards.
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
                                           'until', case when g.is_default then null else (
                                             select private.participation_end(p.ends_on, p.program_id)
                                               from public.program_participants p
                                              where p.program_id = g.id and p.email = private.email_of(v_e.id)) end)
                   from public.programs g join public.sponsors s on s.id = g.sponsor_id
                  where g.id = private.program_on(v_e.id, private.sp_today())),
    'impact_consent', (select jsonb_build_object('share', c.impact, 'text_version', c.text_version)
                         from public.consents c where c.entrepreneur_id = v_e.id
                        order by c.consent_no desc limit 1)
  );
end $$;

-- ------------------------------------------------------------------ the logos

-- Public to read (the diary and the impact area show them to anyone they
-- reach), written only by whoever may manage campaigns.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-logos', 'sponsor-logos', true, 512 * 1024, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The storage policies run as the caller, who cannot call private functions.
create function public.can_manage_campaigns()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.can_manage_rewards() $$;

create policy sponsor_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-logos' and (select public.can_manage_campaigns()));
create policy sponsor_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-logos' and (select public.can_manage_campaigns()))
  with check (bucket_id = 'sponsor-logos' and (select public.can_manage_campaigns()));
create policy sponsor_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-logos' and (select public.can_manage_campaigns()));

-- ------------------------------------------------------------------ grants

revoke execute on function private.reward_campaign(uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_campaigns() from public, anon;
grant execute on function public.can_manage_campaigns() to authenticated;
revoke execute on function
  public.reward_programme_publish(jsonb, text, uuid), public.reward_programme_current(uuid),
  public.campaign_save(uuid, text, text, date, date, text, boolean, text, text)
from public, anon;
grant execute on function
  public.reward_programme_publish(jsonb, text, uuid), public.reward_programme_current(uuid),
  public.campaign_save(uuid, text, text, date, date, text, boolean, text, text)
to authenticated, service_role;
