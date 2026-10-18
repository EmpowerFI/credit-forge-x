-- The weekly reading of the daily journal, written once per week.
--
-- The same promise as the monthly reading (20261110000000), for a week:
-- figures computed by code, prose by a model over those figures or a fixed
-- fallback, one reading per week whatever is delivered twice, and every
-- reading kept for audit with its prompt, model, tokens and cost.
--
-- When: the week is Monday to Sunday. The reminder at nine asks about the day
-- before, so the usual moment is Monday morning, when she records Sunday: the
-- reading follows her confirmation. If she does not record Sunday, the next
-- day she records -- any day of the following week -- brings the reading of
-- the week before. A business-initiated message would need an approved
-- template and is billed; a reply inside the window she just opened is
-- neither.
--
-- A week is read only if she kept at least three of its days. Fewer is too
-- little to say anything true about, and a reading of one day is a reading of
-- noise.

create table public.journal_readings (
  id               uuid primary key default gen_random_uuid(),
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  week_start       date not null check (extract(isodow from week_start) = 1),
  status           text not null check (status in ('pending', 'done', 'failed')),
  source           text check (source in ('model', 'fallback')),
  model            text,
  prompt_version   text,
  formula_version  text,
  insights         jsonb,
  report           jsonb,
  refusal_reasons  text[] not null default '{}',
  input_tokens     integer check (input_tokens is null or input_tokens >= 0),
  output_tokens    integer check (output_tokens is null or output_tokens >= 0),
  cost_micro_usd   bigint check (cost_micro_usd is null or cost_micro_usd >= 0),
  attempts         smallint not null default 0 check (attempts >= 0),
  claimed_at       timestamptz,
  error            text check (error is null or char_length(error) <= 2000),
  is_simulated     boolean not null default false,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (entrepreneur_id, week_start),
  constraint a_done_reading_says_who_wrote_it check (status <> 'done' or (source is not null and report is not null))
);

alter table public.journal_readings enable row level security;
revoke all on public.journal_readings from anon, authenticated;

/** One week of the journal, in the shape the figures engine reads a month in. */
create function private.journal_week_figures(p_entrepreneur_id uuid, p_week_start date)
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
    'days_filled', (d ->> 'days_filled')::integer
  )
  from (select public.journal_dre(p_entrepreneur_id, p_week_start, p_week_start + 6) as d) x
$$;

/**
 * Whether a week should be read now: it has ended (its Sunday is today or
 * earlier), she kept at least three of its days, and it has no finished
 * reading yet.
 */
create function public.journal_reading_due(p_entrepreneur_id uuid, p_week_start date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select extract(isodow from p_week_start) = 1
     and private.sp_today() >= p_week_start + 6
     and (select count(*) from public.journal_days
           where entrepreneur_id = p_entrepreneur_id and day between p_week_start and p_week_start + 6) >= 3
     and not exists (select 1 from public.journal_readings
                      where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start and status = 'done')
$$;

/**
 * Everything a week's reading is computed from.
 *
 * The previous week is the comparison only when both weeks were kept fully --
 * at least six days each, the streak's own measure of a kept week. Otherwise
 * the change in sales would mostly be the change in days recorded: a week
 * written down on three days against one written on six "grew" by half
 * without selling a thing more.
 */
create function public.journal_reading_inputs(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_e public.entrepreneurs%rowtype;
  v_cur jsonb;
  v_prev jsonb;
begin
  select * into v_e from public.entrepreneurs where id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;
  v_cur := private.journal_week_figures(p_entrepreneur_id, p_week_start);
  v_prev := private.journal_week_figures(p_entrepreneur_id, p_week_start - 7);
  return jsonb_build_object(
    'first_name', split_part(coalesce(v_e.display_name, ''), ' ', 1),
    'sector', v_e.business_sector,
    'current', v_cur - 'days_filled',
    'previous', case when (v_prev ->> 'days_filled')::integer >= 6 and (v_cur ->> 'days_filled')::integer >= 6
                     then v_prev - 'days_filled' end
  );
end;
$$;

/** As report_claim, for a week: run, run_fallback, done or busy, under a row lock. */
create function public.journal_reading_claim(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.journal_readings%rowtype;
  v_sim boolean;
begin
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;

  insert into public.journal_readings (entrepreneur_id, week_start, status, attempts, claimed_at, is_simulated)
  values (p_entrepreneur_id, p_week_start, 'pending', 1, now(), v_sim)
  on conflict (entrepreneur_id, week_start) do nothing;
  if found then
    return jsonb_build_object('action', 'run');
  end if;

  select * into v_row from public.journal_readings
   where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start for update;

  if v_row.status = 'done' then
    return jsonb_build_object('action', 'done', 'report', v_row.report, 'source', v_row.source);
  end if;
  if v_row.status = 'pending' and v_row.claimed_at > now() - interval '2 minutes' then
    return jsonb_build_object('action', 'busy');
  end if;

  update public.journal_readings
     set attempts = attempts + 1, status = 'pending', claimed_at = now()
   where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start;
  return jsonb_build_object('action', case when v_row.attempts >= 3 then 'run_fallback' else 'run' end);
end;
$$;

create function public.journal_reading_complete(
  p_entrepreneur_id uuid,
  p_week_start date,
  p_source text,
  p_model text,
  p_prompt_version text,
  p_formula_version text,
  p_insights jsonb,
  p_report jsonb,
  p_refusal_reasons text[],
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_micro_usd bigint,
  p_error text
)
returns void
language sql security definer set search_path = ''
as $$
  update public.journal_readings set
    status = 'done',
    source = p_source,
    model = p_model,
    prompt_version = p_prompt_version,
    formula_version = p_formula_version,
    insights = p_insights,
    report = p_report,
    refusal_reasons = coalesce(p_refusal_reasons, '{}'),
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    cost_micro_usd = p_cost_micro_usd,
    error = left(p_error, 2000),
    completed_at = now()
  where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start
$$;

create function public.journal_reading_fail(p_entrepreneur_id uuid, p_week_start date, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.journal_readings set status = 'failed', error = left(p_error, 2000)
   where entrepreneur_id = p_entrepreneur_id and week_start = p_week_start and status <> 'done'
$$;

revoke execute on function private.journal_week_figures(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_reading_due(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_reading_inputs(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_reading_claim(uuid, date) from public, anon, authenticated;
revoke execute on function public.journal_reading_complete(uuid, date, text, text, text, text, jsonb, jsonb, text[], integer, integer, bigint, text) from public, anon, authenticated;
revoke execute on function public.journal_reading_fail(uuid, date, text) from public, anon, authenticated;
grant execute on function public.journal_reading_due(uuid, date) to service_role;
grant execute on function public.journal_reading_inputs(uuid, date) to service_role;
grant execute on function public.journal_reading_claim(uuid, date) to service_role;
grant execute on function public.journal_reading_complete(uuid, date, text, text, text, text, jsonb, jsonb, text[], integer, integer, bigint, text) to service_role;
grant execute on function public.journal_reading_fail(uuid, date, text) to service_role;
