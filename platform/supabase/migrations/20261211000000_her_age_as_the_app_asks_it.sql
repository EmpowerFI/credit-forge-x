-- Her age, as the app asks it.
--
-- Founder's request, 04/11/2026: a new sign-up in the diary answers the age
-- range the app asks (public.users.age_range), with the app's own buckets --
-- '18_24' to '65_plus', or 'prefere_nao_declarar' -- so the two read the
-- same. An app account that already answered it is not asked again. It is a
-- required answer, and "I prefer not to say" is one.

alter table public.entrepreneurs
  add column age_range text
    check (age_range is null or age_range in ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefere_nao_declarar'));

-- As 20261201's, with her age range when the app has one.
create or replace function private.diary_from_app(p_uid uuid)
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
    'age_range', case when v_user ->> 'age_range' in ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefere_nao_declarar')
                      then v_user ->> 'age_range' end,
    'declared_at', v_declared_at
  );
end $$;

-- As 20261210's, with her age range.
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
  v_age text;
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

  -- Her age range: the app's buckets, the one she picks or the app's.
  v_age := coalesce(nullif(btrim(p_profile ->> 'age_range'), ''), v_app ->> 'age_range');
  if v_age is null or v_age not in ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefere_nao_declarar') then
    raise exception 'age_range_required' using errcode = '22023';
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
     self_declared_at, formalization, finance_control, age_range)
  values (v_uid, left(v_name, 80),
          v_app ->> 'business_name',
          v_sector,
          left(coalesce(nullif(btrim(p_profile ->> 'city'), ''), v_app ->> 'city'), 80),
          case when v_state ~ '^[A-Z]{2}$' then v_state end,
          nullif(p_profile ->> 'months_operating', '')::smallint,
          v_declared_at,
          nullif(p_profile ->> 'formalization', ''),
          nullif(p_profile ->> 'finance_control', ''),
          v_age)
  returning id into v_id;

  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values (v_id, 1, p_text_version, true, false, false, coalesce((p_profile ->> 'share_impact')::boolean, false), 'app');

  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_id, now());
  return v_id;
end $$;
