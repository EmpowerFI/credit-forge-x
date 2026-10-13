-- "Não sei" is an answer, and it is not zero.
--
-- A woman asked what she spent on stock this fortnight may not know, and the
-- honest record of that is an empty cost -- not a zero, which would invent a
-- better month than she had, and not a refusal, which would lose the sales
-- figure she did know. So the two business costs become nullable, in the
-- fortnights and in the assembled month.
--
-- What reads a month changes in exactly two places, both where a cost is
-- arithmetic about her credit:
--
--   readiness_inputs  a month with an unknown cost is not handed to the
--                     readiness engine at all. It does not count as a
--                     complete month; the engine itself is unchanged and
--                     never sees a null.
--   measure_outcome   the before/after averages of a loan's outcome use only
--                     months whose result can be computed.
--
-- Everything else that reads checkins counts months or reads their dates --
-- she did report that month, and it stays a check-in. checkin_cash_flow
-- already yields a null result for a null cost, which is the truth.
--
-- A month is assembled with an unknown cost if either fortnight did not know
-- it: sum() would otherwise skip the null and report half a month of costs
-- as the whole month.

alter table public.checkins
  alter column cogs_cents drop not null,
  alter column opex_cents drop not null;

alter table public.whatsapp_checkin_halves
  alter column cogs_cents drop not null,
  alter column opex_cents drop not null;

create or replace function public.whatsapp_record_half(
  p_message_id text,
  p_token text,
  p_revenue_cents bigint,
  p_cogs_cents bigint,
  p_opex_cents bigint,
  p_household_cents bigint,
  p_keeps_records boolean,
  p_active_days smallint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tok    public.whatsapp_flow_tokens%rowtype;
  v_sim    boolean;
  v_halves integer;
  v_checkin_id uuid;
  v_complete boolean := false;
begin
  -- A retry Meta sent because it never saw the 200 for the first one.
  insert into public.whatsapp_inbound_events (message_id, outcome)
  values (p_message_id, 'recording')
  on conflict (message_id) do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate', 'message_id', p_message_id);
  end if;

  select * into v_tok from public.whatsapp_flow_tokens where token = p_token for update;
  if not found then
    raise exception 'unknown flow token' using errcode = '28000';
  end if;
  if v_tok.used_at is not null then
    raise exception 'this flow token was already used' using errcode = '28000';
  end if;
  if v_tok.expires_at <= now() then
    raise exception 'this flow token expired on %', v_tok.expires_at using errcode = '28000';
  end if;

  -- Once the month is assembled it stops being an open form. Redoing a
  -- fortnight after that is a correction, which is a different act with a
  -- different record, and it is not this function.
  if exists (select 1 from public.checkins where entrepreneur_id = v_tok.entrepreneur_id and period = v_tok.period) then
    raise exception 'the month % is already closed for this entrepreneur', v_tok.period using errcode = '23505';
  end if;

  update public.whatsapp_flow_tokens set used_at = now() where token = p_token;

  -- A simulated woman's fortnight is simulated, whatever arrived. Without
  -- this the assembled month defaults to real, and reset_demo_data then
  -- refuses to clear a showroom it is supposed to clear -- the guard added in
  -- 20261104000000 reads exactly this column.
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = v_tok.entrepreneur_id;

  -- While the month is still open she may redo a fortnight: the later answer
  -- is the one she means, and it needed a fresh token to get here.
  insert into public.whatsapp_checkin_halves (
    entrepreneur_id, period, half, revenue_cents, cogs_cents, opex_cents,
    household_cents, keeps_records, active_days, token, is_simulated
  ) values (
    v_tok.entrepreneur_id, v_tok.period, v_tok.half, p_revenue_cents, p_cogs_cents, p_opex_cents,
    p_household_cents, p_keeps_records, p_active_days, p_token, v_sim
  )
  on conflict (entrepreneur_id, period, half) do update set
    revenue_cents = excluded.revenue_cents,
    cogs_cents = excluded.cogs_cents,
    opex_cents = excluded.opex_cents,
    household_cents = excluded.household_cents,
    keeps_records = excluded.keeps_records,
    active_days = excluded.active_days,
    token = excluded.token,
    is_simulated = excluded.is_simulated,
    received_at = now();

  select count(*) into v_halves
    from public.whatsapp_checkin_halves
   where entrepreneur_id = v_tok.entrepreneur_id and period = v_tok.period;

  if v_halves = 2 then
    insert into public.checkins (
      entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents,
      household_cents, keeps_records, active_days, is_simulated
    )
    select h.entrepreneur_id, h.period,
           sum(h.revenue_cents),
           -- Unknown in either fortnight is unknown for the month.
           case when bool_and(h.cogs_cents is not null) then sum(h.cogs_cents) end,
           case when bool_and(h.opex_cents is not null) then sum(h.opex_cents) end,
           sum(h.household_cents),
           -- She kept records this month only if she kept them both fortnights.
           bool_and(h.keeps_records),
           sum(h.active_days)::smallint,
           bool_and(h.is_simulated)
      from public.whatsapp_checkin_halves h
     where h.entrepreneur_id = v_tok.entrepreneur_id and h.period = v_tok.period
     group by h.entrepreneur_id, h.period
    returning id into v_checkin_id;
    v_complete := true;
  end if;

  update public.whatsapp_inbound_events
     set outcome = case when v_complete then 'month_assembled' else 'half_recorded' end
   where message_id = p_message_id;

  return jsonb_build_object(
    'status', case when v_complete then 'month_assembled' else 'half_recorded' end,
    'entrepreneur_id', v_tok.entrepreneur_id,
    'period', v_tok.period,
    'half', v_tok.half,
    'checkin_id', v_checkin_id
  );
end;
$$;

create or replace function public.readiness_inputs(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_act_for(p_entrepreneur_id) then
    raise exception 'not_allowed_to_assess' using errcode = '42501';
  end if;
  if not private.has_consent(p_entrepreneur_id, 'assessment') then
    raise exception 'no_consent_to_assess' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'as_of_period', private.current_period(),
    'community_verified', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = p_entrepreneur_id and m.status = 'active' and c.status = 'verified'
    ),
    -- The core programme is EmpowerFI's own: programmes with no community.
    'core_modules_total', (
      select count(*) from public.education_modules em
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null
    ),
    'core_modules_completed', (
      select count(*) from public.education_progress pr
      join public.education_modules em on em.id = pr.module_id
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null and pr.entrepreneur_id = p_entrepreneur_id and pr.status = 'completed'
    ),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_cents', revenue_cents,
        'cogs_cents', cogs_cents,
        'opex_cents', opex_cents,
        'household_cents', household_cents,
        'keeps_records', keeps_records,
        'active_days', active_days
      ) order by period)
      from public.checkins where entrepreneur_id = p_entrepreneur_id
        -- A month whose costs she did not know is not a complete month.
        and cogs_cents is not null and opex_cents is not null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.measure_outcome(
  p_loan_id uuid,
  p_capital_use public.capital_use default 'not_reported'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_month text;
  v_before record;
  v_after record;
  v_paid integer;
  v_no smallint;
  v_id uuid;
  v_incremental bigint;
  v_cost bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'loan_not_found' using errcode = 'P0002';
  end if;
  if not (coalesce(auth.role(), '') = 'service_role' or private.is_admin()
          or v_loan.partner_id = private.my_partner_id()) then
    raise exception 'not_allowed_to_measure' using errcode = '42501';
  end if;
  if v_loan.status not in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') or v_loan.disbursed_at is null then
    raise exception 'loan_not_disbursed' using errcode = 'P0001';
  end if;

  v_month := private.month_of(v_loan.disbursed_at);
  select count(*)::int as n,
         round(avg(revenue_cents))::bigint as revenue,
         round(avg(revenue_cents - cogs_cents - opex_cents))::bigint as net,
         bool_and(keeps_records) as records,
         bool_or(is_simulated) as simulated
    into v_before
    from (select * from public.checkins where entrepreneur_id = v_loan.entrepreneur_id and period < v_month
            and cogs_cents is not null and opex_cents is not null
          order by period desc limit 3) c;
  select count(*)::int as n,
         round(avg(revenue_cents))::bigint as revenue,
         round(avg(revenue_cents - cogs_cents - opex_cents))::bigint as net,
         bool_and(keeps_records) as records,
         bool_or(is_simulated) as simulated
    into v_after
    from public.checkins where entrepreneur_id = v_loan.entrepreneur_id and period > v_month
     and cogs_cents is not null and opex_cents is not null;
  if v_before.n < 2 or v_after.n < 2 then
    raise exception 'not_enough_history' using errcode = 'P0001';
  end if;

  -- Interest is what an instalment carries beyond its even share of principal.
  select count(*)::int into v_paid from public.payments where loan_id = p_loan_id;
  v_cost := v_paid * (v_loan.instalment_cents - round(v_loan.principal_cents::numeric / v_loan.term_months)::bigint);
  v_incremental := (v_after.net - v_before.net) * v_after.n;
  select coalesce(max(outcome_no), 0) + 1 into v_no from public.productive_outcomes where loan_id = p_loan_id;

  insert into public.productive_outcomes (
    loan_id, entrepreneur_id, outcome_no, model_version, disbursement_period, months_before, months_after,
    avg_revenue_before_cents, avg_revenue_after_cents, avg_net_before_cents, avg_net_after_cents,
    incremental_profit_cents, cost_of_credit_cents, evc_cents, capital_use, confidence, is_simulated, measured_by
  ) values (
    p_loan_id, v_loan.entrepreneur_id, v_no, 'outcome-v0.1.0', v_month, v_before.n, v_after.n,
    v_before.revenue, v_after.revenue, v_before.net, v_after.net,
    v_incremental, v_cost, v_incremental - v_cost, p_capital_use,
    case when v_before.n >= 3 and v_after.n >= 3 and v_before.records and v_after.records then 'HIGH'
         when v_before.records or v_after.records then 'MEDIUM'
         else 'LOW' end::public.grade,
    coalesce(v_loan.is_simulated or v_before.simulated or v_after.simulated, false),
    auth.uid()
  ) returning id into v_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('outcome', v_id, private.latest_loan_anchor(p_loan_id));
  return v_id;
end;
$$;
