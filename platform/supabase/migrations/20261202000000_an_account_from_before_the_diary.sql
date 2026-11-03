-- An account from before the diary.
--
-- Found by the founder on 03/11/2026, signing in to the diary with the
-- e-mail of her own app account: "Começar meu diário" failed.
--
-- An entrepreneur row points at public.profiles, and a profile is made by
-- private.handle_new_user() when an account is created. In the app's
-- database that trigger arrived with the credit platform, so every account
-- created before it -- every woman already using the app -- has no profile,
-- and diary_enrol's insert broke the foreign key. The tests missed it
-- because their accounts were created after the trigger, which made the
-- profile for them.
--
-- diary_enrol now makes the profile when it is missing, exactly as the
-- trigger would have (an entrepreneur, under her name), and leaves an
-- existing one alone. Nothing else changes.

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
  values (v_id, 1, p_text_version, true, false, false, false, 'app');

  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_id, now());
  return v_id;
end $$;
