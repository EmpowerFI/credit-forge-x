-- A published reward can be corrected.
--
-- Founder's request, 17/11/2026: change a reward after it is published --
-- a live's day, time or link above all. Publishing always made a new version,
-- and a woman earning a milestone from then on read the new words. But one who
-- had already earned it kept reading the words of the version she earned it
-- under, so a corrected link never reached her.
--
-- From now on her earned reward reads the latest published words for its code
-- in that campaign: title, how to redeem, link. The versions stay frozen as
-- history, and what she earned stays earned. A milestone taken out of the
-- programme keeps, for whoever earned it, the words she earned it with.
--
-- private.reward_words(program, programme, code) is that rule; diary_profile
-- is 20261218's with only its rewards reading through it.

create function private.reward_words(p_program_id uuid, p_programme_id uuid, p_code text)
returns table (title text, how_to_redeem text, redeem_url text, kind text)
language sql stable security definer set search_path = ''
as $$
  select m.title, m.how_to_redeem, m.redeem_url, m.kind
    from public.reward_milestones m
    join public.reward_programme_versions v on v.id = m.programme_id
   where v.program_id = p_program_id and m.code = p_code
     and (v.id = p_programme_id
          or v.version = (select max(v2.version) from public.reward_programme_versions v2 where v2.program_id = p_program_id))
   order by (v.id = p_programme_id)  -- the latest first, when it has the code
   limit 1
$$;
revoke execute on function private.reward_words(uuid, uuid, text) from public, anon, authenticated;

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
    'open_days', to_jsonb(v_e.open_days),
    'ai_reading', v_e.ai_reading,
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
        cross join lateral private.reward_words(r.program_id, r.programme_id, r.code) m
        join public.programs g on g.id = r.program_id
        join public.sponsors s on s.id = g.sponsor_id
       where r.entrepreneur_id = v_e.id), '[]'::jsonb)
  );
end $$;
