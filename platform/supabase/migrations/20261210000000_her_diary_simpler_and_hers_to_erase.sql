-- Her diary, simpler, and hers to erase.
--
-- Founder's requests, 04/11/2026:
--
--   * WHAT SHE SELLS COMES FROM THE APP'S LIST. A new enrolment picks one of
--     the mobile app's own categories (public.categories, active ones, in
--     their order) instead of typing: no typos, and the impact area's "by
--     what she sells" groups the same business under one name. Stored as the
--     category's label, as an app account's category already is. The list
--     lives only in the app's databases, so it is read dynamically; where it
--     does not exist, free text is still accepted.
--   * SHE PICKS AN EMOJI for her week's progress: one of a fixed set, kept
--     with her reminder settings so it follows her to every device.
--   * SHE CAN DELETE HER ACCOUNT -- the whole EmpowerFI account, decided by
--     the founder. The diary is shared with the app (one login), and the
--     app's account-delete function removes the login, the app profile,
--     photos and subscriptions -- but entrepreneurs.profile_id is ON DELETE
--     SET NULL, so the diary would survive it, nameless but whole. So the
--     diary erases itself first (diary_account_forget), then the page calls
--     account-delete. Everything hangs off her entrepreneur row ON DELETE
--     CASCADE, except her WhatsApp conversation (SET NULL), deleted here, and
--     her campaign participations, kept by e-mail, deleted here too.

-- ------------------------------------------------------------------ the app's categories

create function public.diary_categories()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if to_regclass('public.categories') is null then
    return '[]'::jsonb;
  end if;
  execute $q$
    select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'label', c.label_pt, 'icon', c.icon)
                              order by c.display_order, c.label_pt), '[]'::jsonb)
      from public.categories c where c.active
  $q$ into v;
  return v;
end;
$$;

-- The category's own label for what she picked, or null when it is not one.
create function private.category_label(p_text text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v text;
begin
  if to_regclass('public.categories') is null or nullif(btrim(p_text), '') is null then
    return null;
  end if;
  execute 'select c.label_pt from public.categories c where c.active and lower(c.label_pt) = lower(btrim($1)) limit 1'
    into v using p_text;
  return v;
end;
$$;

-- As 20261206's, with what she sells checked against the app's list.
create or replace function public.diary_enrol(p_profile jsonb, p_text_version text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_app jsonb;
  v_name text;
  v_state text;
  v_declared_at timestamptz;
  v_sector text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select id into v_id from public.entrepreneurs where profile_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  v_app := coalesce(private.diary_from_app(v_uid), '{}'::jsonb);
  v_name := coalesce(nullif(btrim(p_profile ->> 'name'), ''), v_app ->> 'name');
  v_state := upper(coalesce(nullif(btrim(p_profile ->> 'state_uf'), ''), v_app ->> 'state_uf'));
  v_declared_at := case when coalesce((p_profile ->> 'adult_woman')::boolean, false) then now()
                        else (v_app ->> 'declared_at')::timestamptz end;

  if v_name is null then
    raise exception 'cannot enrol without a name' using errcode = '22023';
  end if;
  if coalesce((p_profile ->> 'consented')::boolean, false) is not true then
    raise exception 'cannot enrol without a consent' using errcode = '22023';
  end if;
  if v_declared_at is null then
    raise exception 'cannot enrol without her declaration as a woman of 18 or over' using errcode = '22023';
  end if;
  if nullif(btrim(p_text_version), '') is null then
    raise exception 'a consent needs the version of the text she read' using errcode = '22023';
  end if;

  -- What she sells: one of the app's categories, when the app's list exists.
  v_sector := left(coalesce(nullif(btrim(p_profile ->> 'sector'), ''), v_app ->> 'sector'), 80);
  if nullif(btrim(p_profile ->> 'sector'), '') is not null and to_regclass('public.categories') is not null then
    v_sector := private.category_label(p_profile ->> 'sector');
    if v_sector is null then
      raise exception 'sector_not_a_category' using errcode = '22023';
    end if;
  end if;

  -- An account older than the trigger that makes profiles has none.
  insert into public.profiles (id, display_name) values (v_uid, left(v_name, 80))
  on conflict (id) do nothing;

  insert into public.entrepreneurs
    (profile_id, display_name, business_name, business_sector, city, state, months_operating,
     self_declared_at, formalization, finance_control)
  values (v_uid, left(v_name, 80),
          v_app ->> 'business_name',
          v_sector,
          left(coalesce(nullif(btrim(p_profile ->> 'city'), ''), v_app ->> 'city'), 80),
          case when v_state ~ '^[A-Z]{2}$' then v_state end,
          nullif(p_profile ->> 'months_operating', '')::smallint,
          v_declared_at,
          nullif(p_profile ->> 'formalization', ''),
          nullif(p_profile ->> 'finance_control', ''))
  returning id into v_id;

  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values (v_id, 1, p_text_version, true, false, false, coalesce((p_profile ->> 'share_impact')::boolean, false), 'app');

  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_id, now());
  return v_id;
end $$;

-- ------------------------------------------------------------------ her week, her emoji

alter table public.diary_reminder_settings
  add column progress_emoji text not null default '🌱'
    check (progress_emoji in ('🌱', '🌸', '🌻', '⭐', '🔥', '💪', '🐝', '🦋', '💎', '🍀', '🎯', '🚀'));

create function public.diary_emoji_set(p_emoji text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  update public.diary_reminder_settings set progress_emoji = p_emoji where entrepreneur_id = v_me;
  return p_emoji;
exception when check_violation then
  raise exception 'emoji_not_offered' using errcode = '22023';
end;
$$;


-- As 20261208's, with her progress emoji.
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
    'progress_emoji', v_s.progress_emoji,
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

-- ------------------------------------------------------------------ erasing her

/**
 * Erases everything the diary holds of her: her entrepreneur row and all
 * that cascades from it (days, entries, goals, rewards, reminders, devices,
 * consents, shares), her WhatsApp conversation and her campaign
 * participations. The caller then deletes the login with the app's
 * account-delete. 'EXCLUIR', typed, as the app asks.
 */
create function public.diary_account_forget(p_confirmation text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := private.my_email();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_confirmation is distinct from 'EXCLUIR' then
    raise exception 'confirmation_mismatch' using errcode = '22023';
  end if;
  select id into v_id from public.entrepreneurs where profile_id = v_uid;
  if v_id is not null then
    delete from public.whatsapp_conversations where entrepreneur_id = v_id;
    delete from public.entrepreneurs where id = v_id;
  end if;
  if v_email is not null then
    delete from public.program_participants where email = v_email;
  end if;
  return jsonb_build_object('erased', v_id is not null);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke execute on function private.category_label(text) from public, anon, authenticated;
revoke execute on function public.diary_categories() from public;
grant execute on function public.diary_categories() to anon, authenticated, service_role;
revoke execute on function public.diary_emoji_set(text), public.diary_account_forget(text) from public, anon;
grant execute on function public.diary_emoji_set(text), public.diary_account_forget(text) to authenticated, service_role;
