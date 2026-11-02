-- Her diary, in the browser.
--
-- Founder's decision, 02/11/2026: the daily journal leaves WhatsApp for the
-- web app at /app/diario, installable as a PWA, with standard Web Push for
-- the reminder. Nothing here is taken away: the journal itself -- entries,
-- days, goals, milestones, the weekly reading, the drafts read from her
-- words -- stays exactly as it is, and the WhatsApp functions stay in place,
-- unused. What is added is the door she opens herself:
--
--   * Every function a browser calls finds her through auth.uid(): she signs
--     in (an e-mailed code), and her entrepreneur row is the one whose
--     profile_id is her account. No function here takes an entrepreneur id
--     from the client.
--   * She enrols herself, with the same questions WhatsApp asked, and her
--     consent is written on the 'app' channel.
--   * A write from the browser carries a request id the browser makes up;
--     journal_record keeps it (as 'web:<id>') in the same once-only ledger the
--     WhatsApp messages used, so a double tap or a retried request records once.
--   * The reminder is hers to set: on or off, and at what time (19h by
--     default, about today). Seven days without a record get one notice that
--     the reminders pause, and nothing after it until she comes back -- the
--     rule WhatsApp had, measured from her last visit instead of her last
--     message.
--   * Push subscriptions are kept per device, several per woman, and dropped
--     when the push service says they are gone. Every send is written down:
--     claimed, then what each push service answered, then -- if she taps it --
--     the moment she opened it. Accepted by the push service is not delivered,
--     and delivered is not read: the columns say only what was observed.
--
-- Tables are reached only through these functions: RLS on, nothing granted
-- to anon or authenticated directly.

-- ------------------------------------------------------------------ who she is

-- Her entrepreneur row, from her session. Raises when she is not signed in
-- or has not enrolled yet; the browser tells the two apart by the message.
create function private.diary_me()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select id into v_id from public.entrepreneurs where profile_id = v_uid;
  if v_id is null then
    raise exception 'not_enrolled' using errcode = 'P0002';
  end if;
  return v_id;
end $$;

-- ------------------------------------------------------------------ the tables

create table public.diary_reminder_settings (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  enabled         boolean not null default true,
  -- On the quarter hour: the sender runs every fifteen minutes.
  remind_at       time not null default '19:00'
                  check (extract(second from remind_at) = 0 and extract(minute from remind_at)::int % 15 = 0),
  time_zone       text not null default 'America/Sao_Paulo' check (char_length(time_zone) <= 64),
  -- The last time she opened the app: coming back resumes paused reminders.
  last_seen_at    timestamptz,
  updated_at      timestamptz not null default now()
);

create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  -- The push service's URL for this browser. Whoever holds it can address the
  -- device (with the keys), so it never leaves the database except to the sender.
  endpoint         text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh           text not null check (char_length(p256dh) between 40 and 200),
  auth             text not null check (char_length(auth) between 10 and 100),
  user_agent       text check (char_length(user_agent) <= 300),
  created_at       timestamptz not null default now(),
  last_accepted_at timestamptz,
  failures         integer not null default 0,
  disabled_at      timestamptz,
  disabled_reason  text check (disabled_reason in ('gone', 'failing', 'she_turned_it_off'))
);
create index push_subscriptions_live on public.push_subscriptions (entrepreneur_id) where disabled_at is null;

-- One reminder per woman per day, whatever happens to the sender: the row is
-- claimed before anything is sent, so a restart or a second run sends nothing twice.
create table public.diary_reminders (
  id              uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  day             date not null,
  kind            text not null check (kind in ('daily', 'pause')),
  claimed_at      timestamptz not null default now(),
  finished_at     timestamptz,
  -- accepted: at least one push service took it. failed: none did.
  outcome         text check (outcome in ('accepted', 'failed')),
  -- She opened the app from it. Observed, not presumed.
  opened_at       timestamptz,
  is_simulated    boolean not null default false,
  unique (entrepreneur_id, day)
);

create table public.diary_reminder_attempts (
  id              uuid primary key default gen_random_uuid(),
  reminder_id     uuid not null references public.diary_reminders (id) on delete cascade,
  subscription_id uuid references public.push_subscriptions (id) on delete set null,
  status          text not null check (status in ('accepted', 'failed', 'gone')),
  http_status     integer,
  error           text check (char_length(error) <= 300),
  attempted_at    timestamptz not null default now()
);
create index diary_reminder_attempts_by_reminder on public.diary_reminder_attempts (reminder_id);

-- Each record made from the app: where it came from and how long it took her,
-- for the pilot's "minutes to check in". The lines themselves are the journal's.
create table public.diary_checkins (
  request_id      uuid primary key,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  day             date not null,
  source          text not null check (source in ('form', 'voice', 'text')),
  seconds         integer check (seconds between 0 and 3600),
  created_at      timestamptz not null default now(),
  is_simulated    boolean not null default false
);
create index diary_checkins_by_day on public.diary_checkins (created_at);

alter table public.diary_reminder_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.diary_reminders enable row level security;
alter table public.diary_reminder_attempts enable row level security;
alter table public.diary_checkins enable row level security;
revoke all on public.diary_reminder_settings, public.push_subscriptions, public.diary_reminders,
              public.diary_reminder_attempts, public.diary_checkins from anon, authenticated;

-- ------------------------------------------------------------------ enrolling

-- She enrols herself. Idempotent: an account that already has a row gets it back.
-- p_profile: name, adult_woman, consented, city, state_uf, sector,
-- months_operating, formalization, finance_control.
create function public.diary_enrol(p_profile jsonb, p_text_version text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := nullif(btrim(p_profile ->> 'name'), '');
  v_state text := upper(nullif(btrim(p_profile ->> 'state_uf'), ''));
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select id into v_id from public.entrepreneurs where profile_id = v_uid;
  if v_id is not null then
    return v_id;
  end if;

  if v_name is null then
    raise exception 'cannot enrol without a name' using errcode = '22023';
  end if;
  if coalesce((p_profile ->> 'consented')::boolean, false) is not true then
    raise exception 'cannot enrol without a consent' using errcode = '22023';
  end if;
  if coalesce((p_profile ->> 'adult_woman')::boolean, false) is not true then
    raise exception 'cannot enrol without her declaration as a woman of 18 or over' using errcode = '22023';
  end if;
  if nullif(btrim(p_text_version), '') is null then
    raise exception 'a consent needs the version of the text she read' using errcode = '22023';
  end if;

  insert into public.entrepreneurs
    (profile_id, display_name, business_sector, city, state, months_operating,
     self_declared_at, formalization, finance_control)
  values (v_uid, left(v_name, 80),
          left(nullif(btrim(p_profile ->> 'sector'), ''), 80),
          left(nullif(btrim(p_profile ->> 'city'), ''), 80),
          case when v_state ~ '^[A-Z]{2}$' then v_state end,
          nullif(p_profile ->> 'months_operating', '')::smallint,
          now(),
          nullif(p_profile ->> 'formalization', ''),
          nullif(p_profile ->> 'finance_control', ''))
  returning id into v_id;

  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values (v_id, 1, p_text_version, true, false, false, false, 'app');

  insert into public.diary_reminder_settings (entrepreneur_id, last_seen_at) values (v_id, now());
  return v_id;
end $$;

-- What the app needs on opening: is she enrolled, her name, her reminder
-- settings, how many devices get reminders. Opening counts as a visit.
create function public.diary_profile()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_e public.entrepreneurs%rowtype;
  v_s public.diary_reminder_settings%rowtype;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select * into v_e from public.entrepreneurs where profile_id = v_uid;
  if not found then
    return jsonb_build_object('enrolled', false, 'today', private.sp_today());
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

-- ------------------------------------------------------------------ recording

-- What follows a recorded day, for the confirmation screen: the day's sums,
-- the streak and what it earned, and the week's goal (which marks what it
-- tells as told, so it is asked once, after the record).
create function private.diary_after_record(p_entrepreneur_id uuid, p_day date)
returns jsonb
language sql security definer set search_path = ''
as $$
  select jsonb_build_object(
    'summary', public.journal_day_summary(p_entrepreneur_id, p_day),
    'progress', public.journal_progress(p_entrepreneur_id, p_day),
    'goal', public.journal_goal_after_record(p_entrepreneur_id)
  )
$$;

-- A day, from the form. p_entries as journal_record takes them; or
-- p_no_activity, with 'closed' / 'no_sales' / null as the reason.
create function public.diary_record(
  p_request_id uuid,
  p_day date,
  p_entries jsonb default '[]'::jsonb,
  p_no_activity boolean default false,
  p_quiet_reason text default null,
  p_seconds integer default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_recorded jsonb;
begin
  if p_request_id is null then
    raise exception 'a record needs a request id' using errcode = '22023';
  end if;
  v_recorded := public.journal_record(v_me, 'web:' || p_request_id::text, p_day,
                                      coalesce(p_entries, '[]'::jsonb), p_no_activity, p_quiet_reason);
  if v_recorded ->> 'status' = 'duplicate' then
    return jsonb_build_object('recorded', v_recorded,
                              'summary', public.journal_day_summary(v_me, p_day));
  end if;
  insert into public.diary_checkins (request_id, entrepreneur_id, day, source, seconds, is_simulated)
  select p_request_id, v_me, p_day, 'form',
         case when p_seconds between 0 and 3600 then p_seconds end, e.is_simulated
    from public.entrepreneurs e where e.id = v_me
  on conflict (request_id) do nothing;
  return jsonb_build_object('recorded', v_recorded) || private.diary_after_record(v_me, p_day);
end $$;

-- A draft read from her voice or her words (made by the diary-speak
-- function), confirmed or discarded by her.
create function public.diary_draft_decide(p_draft_id uuid, p_confirm boolean, p_seconds integer default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_out jsonb;
  v_day date;
  v_source text;
begin
  select source into v_source from public.journal_drafts where id = p_draft_id and entrepreneur_id = v_me;
  v_out := public.journal_draft_decide(p_draft_id, v_me, p_confirm);
  if v_out ->> 'status' <> 'confirmed' then
    return v_out;
  end if;
  v_day := (v_out ->> 'day')::date;
  if v_out #>> '{recorded,status}' = 'duplicate' then
    return v_out || jsonb_build_object('summary', public.journal_day_summary(v_me, v_day));
  end if;
  insert into public.diary_checkins (request_id, entrepreneur_id, day, source, seconds, is_simulated)
  select p_draft_id, v_me, v_day, case when v_source = 'voice' then 'voice' else 'text' end,
         case when p_seconds between 0 and 3600 then p_seconds end, e.is_simulated
    from public.entrepreneurs e where e.id = v_me
  on conflict (request_id) do nothing;
  return v_out || private.diary_after_record(v_me, v_day);
end $$;

-- Her last p_days days: each kept day with its lines (voided ones flagged,
-- never hidden from the record itself), newest first.
create function public.diary_history(p_days integer default 31)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select private.diary_me() as id),
  span as (select private.sp_today() - least(greatest(coalesce(p_days, 31), 1), 400) + 1 as since),
  days as (
    select d.day, d.no_activity, d.quiet_reason
      from public.journal_days d, me, span
     where d.entrepreneur_id = me.id and d.day >= span.since
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', days.day,
           'no_activity', days.no_activity,
           'quiet_reason', days.quiet_reason,
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', e.id, 'kind', e.kind, 'amount_cents', e.amount_cents,
                      'payment_method', e.payment_method, 'due_on', e.due_on,
                      'installments', e.installments, 'category', e.category,
                      'voided', e.voided_at is not null)
                    order by e.recorded_at)
               from public.journal_entries e, me
              where e.entrepreneur_id = me.id and e.occurred_on = days.day), '[]'::jsonb)
         ) order by days.day desc), '[]'::jsonb)
    from days
$$;

-- Takes one line back, by its id: today's or yesterday's, in a month not yet
-- closed. The line stays, marked void, for the record.
create function public.diary_void_entry(p_entry_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_line public.journal_entries%rowtype;
  v_today date := private.sp_today();
begin
  select * into v_line from public.journal_entries
   where id = p_entry_id and entrepreneur_id = v_me for update;
  if not found then
    raise exception 'no_such_line' using errcode = 'P0001';
  end if;
  if v_line.voided_at is not null then
    return jsonb_build_object('status', 'already_voided');
  end if;
  if v_line.occurred_on not in (v_today - 1, v_today) then
    raise exception 'too_old_to_correct' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.checkins
              where entrepreneur_id = v_me and period = to_char(v_line.occurred_on, 'YYYY-MM')) then
    raise exception 'month_closed' using errcode = 'P0001';
  end if;
  update public.journal_entries set voided_at = now(), voided_by_message = 'web:void' where id = v_line.id;
  return jsonb_build_object('status', 'voided', 'day', v_line.occurred_on,
                            'summary', public.journal_day_summary(v_me, v_line.occurred_on));
end $$;

-- ------------------------------------------------------------------ the week's goal

create function public.diary_goal_now()
returns jsonb
language sql security definer set search_path = ''
as $$ select public.journal_goal_now(private.diary_me()) $$;

create function public.diary_goal_answer(p_choice text, p_target bigint default null)
returns jsonb
language sql security definer set search_path = ''
as $$ select public.journal_goal_answer(private.diary_me(), p_choice, p_target) $$;

-- ------------------------------------------------------------------ reminders and devices

create function public.diary_reminders_set(p_enabled boolean, p_remind_at time default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_s public.diary_reminder_settings%rowtype;
begin
  insert into public.diary_reminder_settings (entrepreneur_id, enabled, remind_at)
  values (v_me, coalesce(p_enabled, true), coalesce(p_remind_at, '19:00'))
  on conflict (entrepreneur_id) do update
    set enabled = coalesce(p_enabled, public.diary_reminder_settings.enabled),
        remind_at = coalesce(p_remind_at, public.diary_reminder_settings.remind_at),
        updated_at = now()
  returning * into v_s;
  return jsonb_build_object('enabled', v_s.enabled, 'remind_at', to_char(v_s.remind_at, 'HH24:MI'));
end $$;

-- This browser can receive her reminders. An endpoint already known moves to
-- her (a shared phone, a new account) and comes back to life.
create function public.diary_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  if (select count(*) from public.push_subscriptions
       where entrepreneur_id = v_me and disabled_at is null and endpoint <> p_endpoint) >= 10 then
    raise exception 'too_many_devices' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (entrepreneur_id, endpoint, p256dh, auth, user_agent)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set entrepreneur_id = v_me, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, failures = 0, disabled_at = null, disabled_reason = null;
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions
                                         where entrepreneur_id = v_me and disabled_at is null));
end $$;

create function public.diary_push_unsubscribe(p_endpoint text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  update public.push_subscriptions
     set disabled_at = now(), disabled_reason = 'she_turned_it_off'
   where endpoint = p_endpoint and entrepreneur_id = v_me and disabled_at is null;
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions
                                         where entrepreneur_id = v_me and disabled_at is null));
end $$;

-- She opened the app from a reminder. Only her own, only the first time.
create function public.diary_reminder_opened(p_reminder_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.diary_reminders
     set opened_at = now()
   where id = p_reminder_id and entrepreneur_id = private.diary_me() and opened_at is null
$$;

-- ------------------------------------------------------------------ the sender's side

-- Days without a record up to today, from the latest of: the last day she
-- kept, the day before her last visit, the day before she enrolled.
create function private.diary_days_unrecorded(p_entrepreneur_id uuid, p_today date, p_time_zone text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select (p_today - greatest(
            (select max(d.day) from public.journal_days d where d.entrepreneur_id = p_entrepreneur_id),
            (select (s.last_seen_at at time zone p_time_zone)::date - 1
               from public.diary_reminder_settings s where s.entrepreneur_id = p_entrepreneur_id),
            (select (e.created_at at time zone p_time_zone)::date - 1
               from public.entrepreneurs e where e.id = p_entrepreneur_id)
          ))::integer
$$;

-- Everyone due now: reminders on, the hour reached in her time zone, enrolled
-- before it, today not kept, not reminded today, and fewer than eight days
-- without a record (the seventh gets the pause notice). Each is claimed --
-- written down -- before it is returned, with her live subscriptions.
create function public.diary_push_claim(p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_claimed jsonb;
begin
  with candidates as (
    select e.id, e.is_simulated, s.time_zone,
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
     where not exists (select 1 from public.journal_days d where d.entrepreneur_id = c.id and d.day = c.local_today)
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

-- What each push service answered. p_results: [{subscription_id, status
-- ('accepted'|'failed'|'gone'), http_status, error}]. A subscription the
-- service calls gone (404/410) is dropped; five failures in a row, likewise.
create function public.diary_push_finished(p_reminder_id uuid, p_results jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_r jsonb;
  v_sub uuid;
  v_status text;
  v_any boolean := false;
begin
  for v_r in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    v_sub := (v_r ->> 'subscription_id')::uuid;
    v_status := v_r ->> 'status';
    insert into public.diary_reminder_attempts (reminder_id, subscription_id, status, http_status, error)
    values (p_reminder_id, v_sub, v_status, (v_r ->> 'http_status')::integer, left(v_r ->> 'error', 300));
    if v_status = 'accepted' then
      v_any := true;
      update public.push_subscriptions set last_accepted_at = now(), failures = 0 where id = v_sub;
    elsif v_status = 'gone' then
      update public.push_subscriptions set disabled_at = now(), disabled_reason = 'gone'
       where id = v_sub and disabled_at is null;
    else
      update public.push_subscriptions
         set failures = failures + 1,
             disabled_at = case when failures + 1 >= 5 then now() else disabled_at end,
             disabled_reason = case when failures + 1 >= 5 then 'failing' else disabled_reason end
       where id = v_sub;
    end if;
  end loop;
  update public.diary_reminders
     set finished_at = now(), outcome = case when v_any then 'accepted' else 'failed' end
   where id = p_reminder_id;
end $$;

-- ------------------------------------------------------------------ grants

revoke execute on function private.diary_me(), private.diary_after_record(uuid, date),
  private.diary_days_unrecorded(uuid, date, text) from public, anon, authenticated;

revoke execute on function
  public.diary_enrol(jsonb, text), public.diary_profile(),
  public.diary_record(uuid, date, jsonb, boolean, text, integer),
  public.diary_draft_decide(uuid, boolean, integer), public.diary_history(integer),
  public.diary_void_entry(uuid), public.diary_goal_now(), public.diary_goal_answer(text, bigint),
  public.diary_reminders_set(boolean, time), public.diary_push_subscribe(text, text, text, text),
  public.diary_push_unsubscribe(text), public.diary_reminder_opened(uuid),
  public.diary_push_claim(integer), public.diary_push_finished(uuid, jsonb)
from public, anon;

grant execute on function
  public.diary_enrol(jsonb, text), public.diary_profile(),
  public.diary_record(uuid, date, jsonb, boolean, text, integer),
  public.diary_draft_decide(uuid, boolean, integer), public.diary_history(integer),
  public.diary_void_entry(uuid), public.diary_goal_now(), public.diary_goal_answer(text, bigint),
  public.diary_reminders_set(boolean, time), public.diary_push_subscribe(text, text, text, text),
  public.diary_push_unsubscribe(text), public.diary_reminder_opened(uuid)
to authenticated;

revoke execute on function public.diary_push_claim(integer), public.diary_push_finished(uuid, jsonb)
from authenticated;
grant execute on function public.diary_push_claim(integer), public.diary_push_finished(uuid, jsonb) to service_role;
