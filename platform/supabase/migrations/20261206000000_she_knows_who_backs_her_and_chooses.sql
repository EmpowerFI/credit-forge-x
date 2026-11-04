-- She knows who backs her, and she chooses whether she counts.
--
-- Two things the diary owes her now that campaigns exist:
--
--   * Whose campaign she is in. diary_profile returns it (the campaign's and
--     the sponsor's names, and until when); for everyone else it is
--     EmpowerFI's diary. Never the budget, never anyone else in it.
--   * A choice, not a condition: whether her business is counted, with
--     others and never alone, in the figures the campaign's sponsor sees
--     (consents.impact, "Incluir meu negócio nos números de impacto"). The
--     diary works the same either way. A new sign-up answers it with the
--     consent (p_profile.share_impact); whoever signed up before is asked
--     once, and either can change it at any time. Each answer is a new
--     consent row under the wording she read -- the history is the record.

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

  -- An account older than the trigger that makes profiles has none.
  insert into public.profiles (id, display_name) values (v_uid, left(v_name, 80))
  on conflict (id) do nothing;

  insert into public.entrepreneurs
    (profile_id, display_name, business_name, business_sector, city, state, months_operating,
     self_declared_at, formalization, finance_control)
  values (v_uid, left(v_name, 80),
          v_app ->> 'business_name',
          left(coalesce(nullif(btrim(p_profile ->> 'sector'), ''), v_app ->> 'sector'), 80),
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

-- As before, plus the campaign she is in today and her current answer about
-- impact figures (with the wording it was given under).
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

-- Her answer, as a new consent: the other scopes carry over unchanged.
create function public.diary_impact_consent_set(p_share boolean, p_text_version text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_last public.consents%rowtype;
begin
  if p_share is null or nullif(btrim(p_text_version), '') is null then
    raise exception 'a consent needs an answer and the version of the text she read' using errcode = '22023';
  end if;
  select * into v_last from public.consents where entrepreneur_id = v_me order by consent_no desc limit 1;
  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel, is_simulated)
  values (v_me, coalesce(v_last.consent_no, 0) + 1, left(btrim(p_text_version), 40),
          coalesce(v_last.assessment, true), coalesce(v_last.partner, false), coalesce(v_last.investors, false),
          p_share, 'app', coalesce(v_last.is_simulated, false));
  return jsonb_build_object('share', p_share, 'text_version', left(btrim(p_text_version), 40));
end $$;

revoke execute on function public.diary_impact_consent_set(boolean, text) from public, anon;
grant execute on function public.diary_impact_consent_set(boolean, text) to authenticated;
