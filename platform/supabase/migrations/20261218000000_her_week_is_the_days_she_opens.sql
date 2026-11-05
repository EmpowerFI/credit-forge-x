-- Her week is the days she opens.
--
-- A business that opens Tuesday to Saturday did not miss Sunday and Monday:
-- it was closed. She marks the days her business opens (ISO weekdays, 1 =
-- Monday ... 7 = Sunday; every day until she says otherwise), and those
-- days, not the calendar's seven, are the base of everything that counts her
-- days:
--
--   * the weekly reading is due after least(3, days she opens) days kept,
--     the week is compared with the one before when each kept all but one
--     of its open days, and the reading is told how many days she opens;
--   * the streak skips a closed day she did not record, instead of counting
--     it as missed;
--   * no reminder is sent on a day she does not open.
--
-- A day she records on a closed day still counts: she sold, so it was open.
-- The setting is today's and applies to past weeks read from now on; a week
-- already read keeps its reading.
--
-- And the reading's AI is hers to refuse. The consent now says a model
-- (Anthropic) writes the weekly reading from her figures and her business
-- sector, never her name, e-mail or city. With ai_reading off, the reading
-- is the fixed-sentence one, built from the same figures, and nothing is
-- sent to the model.

alter table public.entrepreneurs
  add column open_days smallint[] not null default '{1,2,3,4,5,6,7}'
    constraint open_days_are_weekdays
      check (cardinality(open_days) between 1 and 7 and open_days <@ '{1,2,3,4,5,6,7}'::smallint[]);

alter table public.entrepreneurs
  add column ai_reading boolean not null default true;

create function public.diary_ai_reading_set(p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  if p_on is null then
    raise exception 'ai_reading_needs_an_answer' using errcode = '22023';
  end if;
  update public.entrepreneurs set ai_reading = p_on where id = v_me;
  return p_on;
end $$;

/** Whether the business opens on that day. */
create function private.opens_on(p_open_days smallint[], p_day date)
returns boolean
language sql immutable set search_path = ''
as $$ select extract(isodow from p_day)::smallint = any(p_open_days) $$;

/** How many days a week she opens. */
create function private.open_days_count(p_entrepreneur_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$ select coalesce((select cardinality(open_days) from public.entrepreneurs where id = p_entrepreneur_id), 7) $$;

-- Her choice, from the diary: sorted, without repeats, at least one day.
create function public.diary_open_days_set(p_days integer[])
returns smallint[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_days smallint[];
begin
  select array_agg(distinct d::smallint order by d::smallint) into v_days
    from unnest(coalesce(p_days, '{}')) d;
  if v_days is null or not (v_days <@ '{1,2,3,4,5,6,7}'::smallint[]) then
    raise exception 'open_days_invalid' using errcode = '22023';
  end if;
  update public.entrepreneurs set open_days = v_days where id = v_me;
  return v_days;
end $$;

-- ------------------------------------------------------------------ the reading

create or replace function private.journal_week_figures(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'period', to_char(p_week_start, 'YYYY-MM-DD'),
    'revenue_cents', (d ->> 'revenue_cents')::bigint,
    'cogs_cents', (d ->> 'cogs_cents')::bigint,
    -- One operating-cost figure, staff included, as for a month.
    'opex_cents', (d ->> 'opex_cents')::bigint + (d ->> 'staff_cents')::bigint,
    'household_cents', (d ->> 'withdrawals_cents')::bigint,
    -- A week kept day by day is a week of records.
    'keeps_records', true,
    'active_days', (d ->> 'selling_days')::integer,
    -- The days a week her business opens: the week's base, not seven.
    'open_days', private.open_days_count(p_entrepreneur_id),
    'days_filled', (d ->> 'days_filled')::integer
  )
  from (select public.journal_dre(p_entrepreneur_id, p_week_start, p_week_start + 6) as d) x
$$;

create or replace function public.journal_reading_due(p_entrepreneur_id uuid, p_week_start date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select extract(isodow from p_week_start) = 1
     and private.sp_today() >= p_week_start + 6
     and (select count(*) from public.journal_days
           where entrepreneur_id = p_entrepreneur_id and day between p_week_start and p_week_start + 6)
         >= least(3, private.open_days_count(p_entrepreneur_id))
     and not exists (select 1 from public.journal_readings
                      where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start and status = 'done')
$$;

create or replace function public.journal_reading_inputs(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_e public.entrepreneurs%rowtype;
  v_cur jsonb;
  v_prev jsonb;
  -- A week is compared with the one before when each kept all but one of its open days.
  v_full integer;
begin
  select * into v_e from public.entrepreneurs where id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;
  v_full := greatest(1, cardinality(v_e.open_days) - 1);
  v_cur := private.journal_week_figures(p_entrepreneur_id, p_week_start);
  v_prev := private.journal_week_figures(p_entrepreneur_id, p_week_start - 7);
  return jsonb_build_object(
    'first_name', split_part(coalesce(v_e.display_name, ''), ' ', 1),
    'sector', v_e.business_sector,
    -- Off: the fixed-sentence reading, and nothing sent to the model.
    'ai_reading', v_e.ai_reading,
    'current', v_cur - 'days_filled',
    -- How closely she kept the journal: days kept in the thirty ending on
    -- the week's Sunday, out of the days she opened in them -- or since she
    -- started, if that is fewer. Said to her by code, never by the model.
    'coverage', (
      select jsonb_build_object(
        'kept', (select count(*) from public.journal_days j
                  where j.entrepreneur_id = p_entrepreneur_id
                    and j.day between greatest(p_week_start + 6 - 29, s.first) and p_week_start + 6),
        'days', (select count(*) from generate_series(greatest(p_week_start + 6 - 29, s.first), p_week_start + 6, interval '1 day') g
                  where private.opens_on(v_e.open_days, g::date)))
        from (select min(j.day) as first from public.journal_days j
               where j.entrepreneur_id = p_entrepreneur_id and j.day <= p_week_start + 6) s
       where s.first is not null),
    'previous', case when (v_prev ->> 'days_filled')::integer >= v_full and (v_cur ->> 'days_filled')::integer >= v_full
                     then v_prev - 'days_filled' end
  );
end;
$$;

-- ------------------------------------------------------------------ the streak

create or replace function private.journal_streak(p_entrepreneur_id uuid, p_as_of date)
returns table (started_on date, kept_days integer)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_first date;
  v_day date;
  v_week date := null;
  v_missed integer := 0;
  v_open smallint[];
begin
  started_on := null;
  kept_days := 0;
  select min(day) into v_first from public.journal_days where entrepreneur_id = p_entrepreneur_id;
  if v_first is null or v_first > p_as_of then
    return next;
    return;
  end if;
  select open_days into v_open from public.entrepreneurs where id = p_entrepreneur_id;
  v_open := coalesce(v_open, '{1,2,3,4,5,6,7}');

  v_day := p_as_of;
  while v_day >= v_first loop
    if v_week is distinct from date_trunc('week', v_day)::date then
      v_week := date_trunc('week', v_day)::date;
      v_missed := 0;
    end if;
    if exists (select 1 from public.journal_days where entrepreneur_id = p_entrepreneur_id and day = v_day) then
      kept_days := kept_days + 1;
      started_on := v_day;
    elsif private.opens_on(v_open, v_day) then
      -- A closed day she did not record is not a missed one.
      v_missed := v_missed + 1;
      exit when v_missed >= 2;
    end if;
    v_day := v_day - 1;
  end loop;
  return next;
end;
$$;

-- ------------------------------------------------------------------ the reminder

create or replace function public.diary_push_claim(p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_claimed jsonb;
begin
  with candidates as (
    select e.id, e.is_simulated, s.time_zone, e.open_days,
           (now() at time zone s.time_zone)::date as local_today,
           s.remind_at
      from public.diary_reminder_settings s
      join public.entrepreneurs e on e.id = s.entrepreneur_id
     where s.enabled
       and exists (select 1 from public.push_subscriptions p
                    where p.entrepreneur_id = e.id and p.disabled_at is null)
       and (now() at time zone s.time_zone)::time >= s.remind_at
       and e.created_at < (((now() at time zone s.time_zone)::date + s.remind_at) at time zone s.time_zone)
  ),
  due as (
    select c.id, c.is_simulated, c.local_today,
           private.diary_days_unrecorded(c.id, c.local_today, c.time_zone) as gap
      from candidates c
     -- No reminder on a day her business does not open.
     where private.opens_on(c.open_days, c.local_today)
       and not exists (select 1 from public.journal_days d where d.entrepreneur_id = c.id and d.day = c.local_today)
       and not exists (select 1 from public.diary_reminders r where r.entrepreneur_id = c.id and r.day = c.local_today)
  ),
  chosen as (
    select id, is_simulated, local_today, case when gap >= 7 then 'pause' else 'daily' end as kind
      from due
     where gap between 1 and 7
     order by id
     limit greatest(p_limit, 0)
  ),
  claimed as (
    insert into public.diary_reminders (entrepreneur_id, day, kind, is_simulated)
    select id, local_today, kind, is_simulated from chosen
    on conflict (entrepreneur_id, day) do nothing
    returning id, entrepreneur_id, kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'reminder_id', c.id,
           'kind', c.kind,
           'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object(
                                      'id', p.id, 'endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth)), '[]'::jsonb)
                               from public.push_subscriptions p
                              where p.entrepreneur_id = c.entrepreneur_id and p.disabled_at is null)
         )), '[]'::jsonb)
    into v_claimed
    from claimed c;
  return v_claimed;
end $$;

-- ------------------------------------------------------------------ the diary

-- As 20261210's, with the days she opens.
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
        join public.reward_milestones m on m.programme_id = r.programme_id and m.code = r.code
        join public.programs g on g.id = r.program_id
        join public.sponsors s on s.id = g.sponsor_id
       where r.entrepreneur_id = v_e.id), '[]'::jsonb)
  );
end $$;

-- As 20261217's, with the days she opens beside the days she kept.
create or replace function public.diary_readings(p_limit integer default 12)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select private.diary_me() as id)
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', r.week_start,
           'source', r.source,
           'report', r.report,
           'days_kept', (select count(*) from public.journal_days d
                          where d.entrepreneur_id = r.entrepreneur_id
                            and d.day between r.week_start and r.week_start + 6),
           'open_days', coalesce((r.insights ->> 'open_days')::integer, private.open_days_count(r.entrepreneur_id)),
           'completed_at', r.completed_at
         ) order by r.week_start desc), '[]'::jsonb)
    from (select r.* from public.journal_readings r, me
           where r.entrepreneur_id = me.id and r.status = 'done'
           order by r.week_start desc
           limit least(greatest(coalesce(p_limit, 12), 1), 52)) r
$$;

revoke execute on function private.opens_on(smallint[], date), private.open_days_count(uuid) from public, anon, authenticated;
revoke execute on function public.diary_open_days_set(integer[]), public.diary_ai_reading_set(boolean) from public, anon;
grant execute on function public.diary_open_days_set(integer[]), public.diary_ai_reading_set(boolean) to authenticated, service_role;
