-- She already has the app.
--
-- Founder's request, 02/11/2026: whoever already has an e-mail in the
-- EmpowerFI app is not asked to sign up again for the diary.
--
-- The app and the credit platform share one database and one auth: the app's
-- public.users.id and the platform's profiles.id are both auth.users.id. So a
-- woman who signs in to the diary with the e-mail she uses in the app is
-- already the same account, and what the app knows about her is one join
-- away: her name, city and state, her business and its category, and the
-- app's own gate, "Eu me declaro mulher", made by an empresária who accepted
-- 18+ terms.
--
-- diary_profile now returns that, as from_app, while she is not enrolled;
-- the browser shows it back to her instead of the questions, and she only
-- agrees. diary_enrol takes from the app whatever the browser did not send,
-- and counts the app's declaration as hers -- with its own date, not today's,
-- so the record says when she actually made it.
--
-- What is NOT carried over is the consent. The app never kept her sales and
-- expenses; the diary does, so she agrees to that here, on the 'app' channel,
-- as before.
--
-- The app's tables exist only in the app's database. This migration also runs
-- in the hackathon showroom, which has none of them, so they are read through
-- dynamic SQL behind to_regclass, and as whole rows (to_jsonb) so that a
-- column the app renames tomorrow makes a field null rather than this
-- function fail. Anything unforeseen there returns no prefill and is logged:
-- she is then asked the questions, which is the old behaviour, never an error.

create function private.diary_from_app(p_uid uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user jsonb;
  v_business jsonb;
  v_sector text;
  v_state text;
  v_declared_at timestamptz;
begin
  if p_uid is null or to_regclass('public.users') is null then
    return null;
  end if;
  begin
    execute 'select to_jsonb(u) from public.users u where u.id = $1' into v_user using p_uid;
    if v_user is null or coalesce(v_user ->> 'status', 'active') = 'deleted' then
      return null;
    end if;
    if to_regclass('public.businesses') is not null then
      execute 'select to_jsonb(b) from public.businesses b where b.user_id = $1 limit 1' into v_business using p_uid;
    end if;
    if v_business ->> 'category_id' is not null and to_regclass('public.categories') is not null then
      execute 'select to_jsonb(c) ->> ''label_pt'' from public.categories c where c.id = $1'
        into v_sector using (v_business ->> 'category_id')::uuid;
    end if;
  exception when others then
    raise warning 'diary_from_app: the app''s tables could not be read (%): asking the questions instead', sqlerrm;
    return null;
  end;

  v_state := upper(btrim(v_user ->> 'state'));
  -- The app's declaration counts for an empresária only: a contratante
  -- account was never asked it.
  if coalesce(v_user ->> 'role', 'empresaria') = 'empresaria'
     and (v_user ->> 'self_declared_woman') = 'true' then
    v_declared_at := coalesce((v_user ->> 'self_declared_at')::timestamptz, (v_user ->> 'created_at')::timestamptz, now());
  end if;

  return jsonb_build_object(
    'name', left(nullif(btrim(v_user ->> 'display_name'), ''), 80),
    'city', left(nullif(btrim(v_user ->> 'city'), ''), 80),
    'state_uf', case when v_state ~ '^[A-Z]{2}$' then v_state end,
    'business_name', left(nullif(btrim(v_business ->> 'name'), ''), 120),
    'sector', left(nullif(btrim(v_sector), ''), 80),
    'declared_at', v_declared_at
  );
end $$;

revoke execute on function private.diary_from_app(uuid) from public, anon, authenticated;

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
  values (v_id, 1, p_text_version, true, false, false, false, 'app');

  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_id, now());
  return v_id;
end $$;

-- As before, and while she is not enrolled, what the app already knows about
-- her (from_app, null when she has no app account). The date of her
-- declaration stays in the database; the browser needs only that it exists.
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
                 where entrepreneur_id = v_e.id and disabled_at is null)
  );
end $$;
