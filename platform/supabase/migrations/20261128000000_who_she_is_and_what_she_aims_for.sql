-- Who she is, and what she aims for this week.
--
-- Two things the founder asked for on 26/10/2026.
--
-- THE SIGN-UP asks what the app already asks, and one thing more:
--
--   self_declared_at   when she declared, on WhatsApp, that she is a woman of
--                      18 or over -- the app's gate ("Eu me declaro mulher";
--                      18+ in its terms). Null for anyone enrolled elsewhere.
--                      whatsapp_enrol refuses a draft without it.
--   formalization      'mei', 'cnpj' (any other CNPJ) or 'none' -- finer than
--                      the app's has_cnpj, because MEI and a company are not
--                      the same thing to a lender.
--   finance_control    how she keeps track of the money today: 'notebook',
--                      'spreadsheet', 'app', 'memory' or 'none'. A baseline
--                      the journal is meant to move.
--
-- THE WEEKLY GOAL (journal_goals), the co-founder's suggestion: once a week
-- she chooses a goal for the week, Monday to Sunday --
--
--   'days'   how many days she will record, 3 to 7; or
--   'sales'  how much she wants to sell, in reais;
--
-- or 'Agora não', which is respected until next week. She is asked after the
-- first day she records in a week, told how the last week's goal went, and
-- reminded of what she did last week so the number she picks is hers and
-- realistic. Every confirmation shows the progress; the first time it is
-- met she is congratulated once. It earns recognition -- weeks met in a row
-- -- not a reward: the published rewards programme is unchanged.

alter table public.entrepreneurs
  add column self_declared_at timestamptz,
  add column formalization text check (formalization in ('mei', 'cnpj', 'none')),
  add column finance_control text
    check (finance_control in ('notebook', 'spreadsheet', 'app', 'memory', 'none'));

alter table public.whatsapp_conversations drop constraint whatsapp_conversations_step_check;
alter table public.whatsapp_conversations add constraint whatsapp_conversations_step_check
  check (step in ('adult', 'name', 'city', 'sector', 'since', 'cnpj', 'finance'));

create or replace function public.whatsapp_enrol(p_e164 text, p_draft jsonb, p_text_version text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_index bytea := private.phone_index(p_e164);
  v_existing uuid;
  v_id uuid;
  v_name text;
  v_months smallint;
begin
  select entrepreneur_id into v_existing
    from public.whatsapp_conversations where phone_index = v_index;
  if not found then
    raise exception 'no conversation for this number; call whatsapp_conversation_for first'
      using errcode = 'P0002';
  end if;
  if v_existing is not null then
    return v_existing;
  end if;

  v_name := nullif(trim(p_draft ->> 'name'), '');
  if v_name is null then
    raise exception 'cannot enrol without a name' using errcode = '22023';
  end if;
  if coalesce((p_draft ->> 'consented')::boolean, false) is not true then
    raise exception 'cannot enrol without a consent' using errcode = '22023';
  end if;
  if coalesce((p_draft ->> 'adult_woman')::boolean, false) is not true then
    raise exception 'cannot enrol without her declaration as a woman of 18 or over' using errcode = '22023';
  end if;
  v_months := nullif(p_draft ->> 'months_operating', '')::smallint;

  insert into public.entrepreneurs
    (display_name, business_sector, city, state, months_operating, self_declared_at, formalization, finance_control)
  values (left(v_name, 80), nullif(trim(p_draft ->> 'sector'), ''),
          nullif(trim(p_draft ->> 'city'), ''), nullif(trim(p_draft ->> 'state_uf'), ''), v_months,
          now(), nullif(p_draft ->> 'formalization', ''), nullif(p_draft ->> 'finance_control', ''))
  returning id into v_id;

  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values (v_id, 1, p_text_version, true, false, false, false, 'whatsapp');

  perform public.whatsapp_link_phone(p_e164, v_id);
  perform public.whatsapp_mark_verified(p_e164);

  update public.whatsapp_conversations
     set entrepreneur_id = v_id, updated_at = now()
   where phone_index = v_index;

  return v_id;
end;
$$;

-- -------------------------------------------------------------- the goal

create table public.journal_goals (
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  -- The Monday of the week, in São Paulo.
  week_start       date not null check (extract(isodow from week_start) = 1),
  -- 'asked' while she has the question; 'sales_pending' while she is typing the amount.
  status           text not null check (status in ('asked', 'sales_pending', 'set', 'skipped')),
  kind             text check (kind in ('days', 'sales')),
  -- Days (3 to 7) or cents.
  target           bigint,
  met_at           timestamptz,
  -- When she was told how this week went, so it is told once.
  result_told_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (entrepreneur_id, week_start),
  constraint a_set_goal_says_what
    check ((status = 'set') = (kind is not null and target is not null)),
  constraint a_goal_is_reachable
    check (kind is null or (kind = 'days' and target between 3 and 7)
                        or (kind = 'sales' and target between 100 and 10000000000))
);

alter table public.journal_goals enable row level security;
revoke all on public.journal_goals from anon, authenticated;

-- Days kept and sales in a week: what a goal is measured against.
create function private.journal_goal_figures(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'days_kept', (select count(*) from public.journal_days d
                   where d.entrepreneur_id = p_entrepreneur_id
                     and d.day between p_week_start and p_week_start + 6),
    'sales_cents', (select coalesce(sum(e.amount_cents), 0) from public.journal_entries e
                     where e.entrepreneur_id = p_entrepreneur_id and e.kind = 'sale' and e.voided_at is null
                       and e.occurred_on between p_week_start and p_week_start + 6)
  )
$$;

-- Whether a week's goal is met by its figures.
create function private.journal_goal_met(p_goal public.journal_goals, p_figures jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_goal.status = 'set' and case p_goal.kind
    when 'days'  then (p_figures ->> 'days_kept')::bigint >= p_goal.target
    when 'sales' then (p_figures ->> 'sales_cents')::bigint >= p_goal.target
    else false end
$$;

-- Weeks in a row, ending with the one before p_week_start, whose goal was met.
create function private.journal_goal_run(p_entrepreneur_id uuid, p_week_start date)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_week date := p_week_start - 7;
  v_run integer := 0;
begin
  loop
    exit when not exists (select 1 from public.journal_goals g
                           where g.entrepreneur_id = p_entrepreneur_id and g.week_start = v_week
                             and g.met_at is not null);
    v_run := v_run + 1;
    v_week := v_week - 7;
  end loop;
  return v_run;
end $$;

/*
 * Everything a recorded day needs to say about the goal, and the bookkeeping
 * that goes with it, in one call after journal_record:
 *
 *   goal        this week's goal and its progress, if one is set
 *   just_met    true the first time this week's goal is met (recorded now)
 *   last_week   last week's goal and how it went, once, if there was one
 *   ask         true when she should be asked for this week's goal now --
 *               there is no row for the week yet; the row is created as
 *               'asked', so she is asked once
 *   reference   what she did last week, to choose a realistic number
 *   max_days    the most days she can still keep this week
 */
create function public.journal_goal_after_record(p_entrepreneur_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_week date := v_today - (extract(isodow from v_today)::integer - 1);
  v_goal public.journal_goals%rowtype;
  v_last public.journal_goals%rowtype;
  v_figures jsonb := private.journal_goal_figures(p_entrepreneur_id, v_week);
  v_last_figures jsonb := private.journal_goal_figures(p_entrepreneur_id, v_week - 7);
  v_just_met boolean := false;
  v_ask boolean := false;
  v_last_out jsonb;
  v_max_days integer;
begin
  -- Last week: settle whether it was met, and tell her once.
  select * into v_last from public.journal_goals
   where entrepreneur_id = p_entrepreneur_id and week_start = v_week - 7 for update;
  if found and v_last.status = 'set' and v_last.result_told_at is null then
    if v_last.met_at is null and private.journal_goal_met(v_last, v_last_figures) then
      update public.journal_goals set met_at = now(), updated_at = now()
       where entrepreneur_id = p_entrepreneur_id and week_start = v_week - 7;
      v_last.met_at := now();
    end if;
    update public.journal_goals set result_told_at = now(), updated_at = now()
     where entrepreneur_id = p_entrepreneur_id and week_start = v_week - 7;
    v_last_out := jsonb_build_object(
      'kind', v_last.kind, 'target', v_last.target, 'met', v_last.met_at is not null,
      'days_kept', v_last_figures -> 'days_kept', 'sales_cents', v_last_figures -> 'sales_cents',
      'run', private.journal_goal_run(p_entrepreneur_id, v_week));
  end if;

  -- This week.
  select * into v_goal from public.journal_goals
   where entrepreneur_id = p_entrepreneur_id and week_start = v_week for update;
  if not found then
    insert into public.journal_goals (entrepreneur_id, week_start, status)
    values (p_entrepreneur_id, v_week, 'asked');
    v_ask := true;
  elsif v_goal.status = 'set' and v_goal.met_at is null and private.journal_goal_met(v_goal, v_figures) then
    update public.journal_goals set met_at = now(), updated_at = now()
     where entrepreneur_id = p_entrepreneur_id and week_start = v_week;
    v_goal.met_at := now();
    v_just_met := true;
  end if;

  -- Days she can still keep: those already kept, plus yesterday and today
  -- and the rest of the week if they are in it and not kept yet.
  select count(*) into v_max_days
    from generate_series(v_week, v_week + 6, interval '1 day') as g(d)
   where g.d::date >= v_today - 1
      or exists (select 1 from public.journal_days j
                  where j.entrepreneur_id = p_entrepreneur_id and j.day = g.d::date);

  return jsonb_build_object(
    'week_start', v_week,
    'goal', case when v_goal.status = 'set' then jsonb_build_object(
              'kind', v_goal.kind, 'target', v_goal.target, 'met', v_goal.met_at is not null,
              'days_kept', v_figures -> 'days_kept', 'sales_cents', v_figures -> 'sales_cents') end,
    'just_met', v_just_met,
    'run', case when v_just_met then private.journal_goal_run(p_entrepreneur_id, v_week) + 1 end,
    'last_week', v_last_out,
    'ask', v_ask,
    'reference', jsonb_build_object('days_kept', v_last_figures -> 'days_kept',
                                    'sales_cents', v_last_figures -> 'sales_cents'),
    'max_days', v_max_days
  );
end $$;

/*
 * Her answer to the goal question, for the current week:
 *   'skip'           Agora não
 *   'sales_pending'  she chose sales and the amount comes next
 *   'days' / 'sales' the goal, with its target
 * A goal already set for the week is not replaced: 'already_set'.
 */
create function public.journal_goal_answer(p_entrepreneur_id uuid, p_choice text, p_target bigint default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_week date := v_today - (extract(isodow from v_today)::integer - 1);
  v_goal public.journal_goals%rowtype;
begin
  select * into v_goal from public.journal_goals
   where entrepreneur_id = p_entrepreneur_id and week_start = v_week for update;
  if found and v_goal.status = 'set' then
    return jsonb_build_object('status', 'already_set', 'kind', v_goal.kind, 'target', v_goal.target);
  end if;
  if p_choice not in ('skip', 'sales_pending', 'days', 'sales') then
    raise exception 'not a goal answer: %', p_choice using errcode = '22023';
  end if;

  insert into public.journal_goals (entrepreneur_id, week_start, status, kind, target)
  values (p_entrepreneur_id, v_week,
          case p_choice when 'skip' then 'skipped' when 'sales_pending' then 'sales_pending' else 'set' end,
          case when p_choice in ('days', 'sales') then p_choice end,
          case when p_choice in ('days', 'sales') then p_target end)
  on conflict (entrepreneur_id, week_start) do update
     set status = excluded.status, kind = excluded.kind, target = excluded.target, updated_at = now();

  return jsonb_build_object('status', case p_choice when 'skip' then 'skipped' when 'sales_pending' then 'sales_pending' else 'set' end,
                            'kind', case when p_choice in ('days', 'sales') then p_choice end,
                            'target', p_target,
                            'figures', private.journal_goal_figures(p_entrepreneur_id, v_week));
end $$;

-- Whether the next thing she types is the sales amount she was asked for.
create function public.journal_goal_awaiting_amount(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.journal_goals g
                  where g.entrepreneur_id = p_entrepreneur_id and g.status = 'sales_pending'
                    and g.week_start = private.sp_today() - (extract(isodow from private.sp_today())::integer - 1))
$$;

-- META: this week's goal and progress, or nothing; and opens the question again if there is none.
create function public.journal_goal_now(p_entrepreneur_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_week date := v_today - (extract(isodow from v_today)::integer - 1);
  v_goal public.journal_goals%rowtype;
  v_figures jsonb := private.journal_goal_figures(p_entrepreneur_id, v_week);
  v_max_days integer;
begin
  select * into v_goal from public.journal_goals
   where entrepreneur_id = p_entrepreneur_id and week_start = v_week;
  select count(*) into v_max_days
    from generate_series(v_week, v_week + 6, interval '1 day') as g(d)
   where g.d::date >= v_today - 1
      or exists (select 1 from public.journal_days j
                  where j.entrepreneur_id = p_entrepreneur_id and j.day = g.d::date);
  if found and v_goal.status = 'set' then
    return jsonb_build_object('goal', jsonb_build_object(
      'kind', v_goal.kind, 'target', v_goal.target, 'met', v_goal.met_at is not null,
      'days_kept', v_figures -> 'days_kept', 'sales_cents', v_figures -> 'sales_cents'));
  end if;
  return jsonb_build_object(
    'goal', null,
    'reference', private.journal_goal_figures(p_entrepreneur_id, v_week - 7),
    'max_days', v_max_days);
end $$;

revoke execute on function private.journal_goal_figures(uuid, date) from public, anon, authenticated;
revoke execute on function private.journal_goal_run(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_goal_after_record(uuid) from public, anon, authenticated;
revoke execute on function public.journal_goal_answer(uuid, text, bigint) from public, anon, authenticated;
revoke execute on function public.journal_goal_awaiting_amount(uuid) from public, anon, authenticated;
revoke execute on function public.journal_goal_now(uuid) from public, anon, authenticated;
grant execute on function public.journal_goal_after_record(uuid) to service_role;
grant execute on function public.journal_goal_answer(uuid, text, bigint) to service_role;
grant execute on function public.journal_goal_awaiting_amount(uuid) to service_role;
grant execute on function public.journal_goal_now(uuid) to service_role;
