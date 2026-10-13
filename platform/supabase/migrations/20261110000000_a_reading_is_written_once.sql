-- The monthly reading, written once per month and kept for audit.
--
-- When a month is assembled from its two fortnights, she receives a short
-- reading of it: figures computed by checkin-insights, prose written by a
-- language model over those figures, or -- whenever the model fails or says
-- anything it may not -- a reading built from fixed sentences. This table is
-- the record of every one of those, and it is what makes two of the product's
-- acceptance criteria true rather than hoped for:
--
--   AC-03  The same delivery received twice does not produce a second
--          analysis. checkin_id is unique, and a month already read returns
--          the stored reading without calling the model.
--   AC-09  A model failure produces a safe message and no duplicate charge.
--          The fallback is recorded as the month's reading and nothing calls
--          the model for that month again; retries are capped before that.
--
-- And the audit requirement: the prompt version, the model, the formula
-- version of the figures, the tokens and the cost of every reading, plus --
-- when the model's text was refused -- the reasons it was refused. Those
-- reasons are the sample a human reviews to see whether the prompt is
-- drifting, which is how "revisão humana amostral" stops being a phrase.
--
-- What is NOT stored: the message as sent. It carries her first name, and it
-- can be rendered again from the reading at any time. The reading itself
-- carries no name, no phone and no city, because the model never saw them.
--
-- Nobody reads this through the API. Service role only.

create table public.ai_analyses (
  id               uuid primary key default gen_random_uuid(),
  checkin_id       uuid not null unique references public.checkins (id) on delete cascade,
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  status           text not null check (status in ('pending', 'done', 'failed')),
  -- Which wrote the reading she received.
  source           text check (source in ('model', 'fallback')),
  model            text,
  prompt_version   text,
  formula_version  text,
  insights         jsonb,
  report           jsonb,
  -- Why the model's reading was refused, when it was. Empty when it was not,
  -- or when the model was never called.
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
  constraint a_done_reading_says_who_wrote_it check (status <> 'done' or (source is not null and report is not null))
);

create index ai_analyses_entrepreneur on public.ai_analyses (entrepreneur_id, created_at desc);

alter table public.ai_analyses enable row level security;
revoke all on public.ai_analyses from anon, authenticated;

/**
 * Everything the reading is computed from, in one read.
 *
 * The month, the one immediately before it if she reported it, what she
 * sells, and her first name -- the name goes to the message and never to the
 * model; the caller is the one place that keeps them apart.
 */
create function public.report_inputs(p_checkin_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_c public.checkins%rowtype;
  v_prev public.checkins%rowtype;
  v_e public.entrepreneurs%rowtype;
  v_prev_period text;
begin
  select * into v_c from public.checkins where id = p_checkin_id;
  if not found then
    raise exception 'no such check-in: %', p_checkin_id using errcode = 'P0002';
  end if;
  select * into v_e from public.entrepreneurs where id = v_c.entrepreneur_id;

  v_prev_period := to_char(to_date(v_c.period || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM');
  select * into v_prev from public.checkins
   where entrepreneur_id = v_c.entrepreneur_id and period = v_prev_period;

  return jsonb_build_object(
    'entrepreneur_id', v_c.entrepreneur_id,
    'is_simulated', v_c.is_simulated,
    'first_name', split_part(coalesce(v_e.display_name, ''), ' ', 1),
    'sector', v_e.business_sector,
    'current', jsonb_build_object(
      'period', v_c.period, 'revenue_cents', v_c.revenue_cents, 'cogs_cents', v_c.cogs_cents,
      'opex_cents', v_c.opex_cents, 'household_cents', v_c.household_cents,
      'keeps_records', v_c.keeps_records, 'active_days', v_c.active_days),
    'previous', case when v_prev.id is null then null else jsonb_build_object(
      'period', v_prev.period, 'revenue_cents', v_prev.revenue_cents, 'cogs_cents', v_prev.cogs_cents,
      'opex_cents', v_prev.opex_cents, 'household_cents', v_prev.household_cents,
      'keeps_records', v_prev.keeps_records, 'active_days', v_prev.active_days) end
  );
end;
$$;

/**
 * Decides, atomically, what to do about a month's reading.
 *
 *   run           nobody has read this month yet -- call the model
 *   run_fallback  the model has been tried enough; write the fixed reading
 *   done          already read; here is the reading, call nothing
 *   busy          another call is reading it right now
 *
 * The row lock is the whole point: two deliveries of the same assembled month
 * arriving together must not both call the model, or she is read twice and
 * billed twice.
 */
create function public.report_claim(p_checkin_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.ai_analyses%rowtype;
  v_c public.checkins%rowtype;
begin
  select * into v_c from public.checkins where id = p_checkin_id;
  if not found then
    raise exception 'no such check-in: %', p_checkin_id using errcode = 'P0002';
  end if;

  insert into public.ai_analyses (checkin_id, entrepreneur_id, status, attempts, claimed_at, is_simulated)
  values (p_checkin_id, v_c.entrepreneur_id, 'pending', 1, now(), v_c.is_simulated)
  on conflict (checkin_id) do nothing;
  if found then
    return jsonb_build_object('action', 'run');
  end if;

  select * into v_row from public.ai_analyses where checkin_id = p_checkin_id for update;

  if v_row.status = 'done' then
    return jsonb_build_object('action', 'done', 'report', v_row.report, 'source', v_row.source);
  end if;
  -- Two minutes is far longer than a reading takes; a claim older than that
  -- belongs to a call that died.
  if v_row.status = 'pending' and v_row.claimed_at > now() - interval '2 minutes' then
    return jsonb_build_object('action', 'busy');
  end if;

  update public.ai_analyses
     set attempts = attempts + 1, status = 'pending', claimed_at = now()
   where checkin_id = p_checkin_id;
  -- Three tries at the model and then no more: past that, the cost of trying
  -- again is paid for a reading the fallback already gives her.
  return jsonb_build_object('action', case when v_row.attempts >= 3 then 'run_fallback' else 'run' end);
end;
$$;

/** Records the reading she received and who wrote it. */
create function public.report_complete(
  p_checkin_id uuid,
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
  update public.ai_analyses set
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
  where checkin_id = p_checkin_id
$$;

/** The reading could not even be recorded; the next call will retry it. */
create function public.report_fail(p_checkin_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.ai_analyses set status = 'failed', error = left(p_error, 2000)
   where checkin_id = p_checkin_id and status <> 'done'
$$;

revoke execute on function public.report_inputs(uuid) from public, anon, authenticated;
revoke execute on function public.report_claim(uuid) from public, anon, authenticated;
revoke execute on function public.report_complete(uuid, text, text, text, text, jsonb, jsonb, text[], integer, integer, bigint, text) from public, anon, authenticated;
revoke execute on function public.report_fail(uuid, text) from public, anon, authenticated;
grant execute on function public.report_inputs(uuid) to service_role;
grant execute on function public.report_claim(uuid) to service_role;
grant execute on function public.report_complete(uuid, text, text, text, text, jsonb, jsonb, text[], integer, integer, bigint, text) to service_role;
grant execute on function public.report_fail(uuid, text) to service_role;
