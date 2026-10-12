-- The WhatsApp check-in arrives twice a month, and the engine reads months.
--
-- public.checkins holds one row per entrepreneur per month: period is
-- YYYY-MM, unique, and active_days is validated 0 to 31. The Flow in
-- docs/whatsapp/checkin-flow.pt-BR.json asks about a fortnight, because two
-- weeks is how far back a woman can remember what she sold without a
-- notebook, and a month is how far the engine needs to see.
--
-- So a half cannot be written into checkins. It lands here, and the month is
-- assembled when its second half arrives. A half that arrives alone is not a
-- report: it does not count towards months_reported, it does not reach the
-- readiness engine, and nothing is anchored for it. That is deliberate --
-- half a month of revenue beside a whole month of costs is a worse number
-- than no number.
--
-- What this does NOT do, on purpose:
--
--   * It stores no phone number. PLAN.md 2.2 puts phone numbers into the PII
--     scan's search set BEFORE the first real one is stored, and that has not
--     happened yet. Identity travels in the flow token instead, which is
--     opaque and says nothing about her to anyone who intercepts it.
--   * It issues no messages. Sending is business-initiated and billed, and it
--     waits on Meta's verification queue; receiving does not.

-- -------------------------------------------------------------- the token
--
-- A Flow with no data endpoint has exactly one place to carry which woman,
-- which month and which half: the flow token, echoed back in the completion
-- payload. It is therefore the only thing standing between a replayed payload
-- and a false check-in, so it is random, single-use and expiring.

create table public.whatsapp_flow_tokens (
  token            text primary key,
  entrepreneur_id  uuid not null references public.entrepreneurs(id) on delete cascade,
  period           text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  half             smallint not null check (half in (1, 2)),
  issued_at        timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz,
  check (expires_at > issued_at)
);

create index whatsapp_flow_tokens_open
  on public.whatsapp_flow_tokens (entrepreneur_id, period, half)
  where used_at is null;

-- ------------------------------------------------------------- the halves

create table public.whatsapp_checkin_halves (
  id               uuid primary key default gen_random_uuid(),
  entrepreneur_id  uuid not null references public.entrepreneurs(id) on delete cascade,
  period           text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  half             smallint not null check (half in (1, 2)),
  revenue_cents    bigint not null check (revenue_cents between 0 and 10000000000),
  cogs_cents       bigint not null check (cogs_cents between 0 and 10000000000),
  opex_cents       bigint not null check (opex_cents between 0 and 10000000000),
  household_cents  bigint not null check (household_cents between 0 and 10000000000),
  keeps_records    boolean not null,
  -- Fifteen, not thirty-one. A half claiming a month would make the sum a lie.
  active_days      smallint not null check (active_days between 0 and 15),
  token            text not null references public.whatsapp_flow_tokens(token) on delete restrict,
  received_at      timestamptz not null default now(),
  is_simulated     boolean not null default false,
  unique (entrepreneur_id, period, half)
);

-- ------------------------------------------------- what Meta already sent
--
-- Meta retries a delivery it did not see a 200 for, and a retried fortnight
-- recorded twice is a month that never happened. The message id is Meta's and
-- it is stable across retries, so it is the primary key.

create table public.whatsapp_inbound_events (
  message_id   text primary key,
  received_at  timestamptz not null default now(),
  outcome      text not null
);

-- ------------------------------------------------------------------ access
--
-- The halves are her figures and read like her check-ins: herself, the leaders
-- of her communities, auditors and admins. Tokens and delivery receipts are
-- nobody's to read -- no policy at all, which under RLS means no row is
-- visible to anon or authenticated, and the service role goes around it.

alter table public.whatsapp_checkin_halves enable row level security;
alter table public.whatsapp_flow_tokens    enable row level security;
alter table public.whatsapp_inbound_events enable row level security;

revoke all on public.whatsapp_checkin_halves, public.whatsapp_flow_tokens, public.whatsapp_inbound_events
  from anon, authenticated;
grant select on public.whatsapp_checkin_halves to authenticated;

create policy whatsapp_halves_read on public.whatsapp_checkin_halves for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);

-- ------------------------------------------------------------ issuing one

create function private.whatsapp_issue_flow_token(
  p_entrepreneur_id uuid,
  p_period text,
  p_half smallint,
  p_ttl interval default interval '14 days'
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  -- 32 bytes of urandom, base64url. Opaque: it says nothing about her, which
  -- matters because it travels through Meta.
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  -- Re-asking for a half she has not answered replaces the open invitation
  -- rather than leaving two tokens that both work.
  update public.whatsapp_flow_tokens
     set used_at = now()
   where entrepreneur_id = p_entrepreneur_id
     and period = p_period
     and half = p_half
     and used_at is null;

  insert into public.whatsapp_flow_tokens (token, entrepreneur_id, period, half, expires_at)
  values (v_token, p_entrepreneur_id, p_period, p_half, now() + p_ttl);

  return v_token;
end;
$$;

-- -------------------------------------------------------- recording a half
--
-- One call does the whole thing, because the parts must not be able to
-- interleave: recognising a retry, spending the token, writing the half and
-- assembling the month are one transaction or they are a race.

create function public.whatsapp_record_half(
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
           sum(h.revenue_cents), sum(h.cogs_cents), sum(h.opex_cents), sum(h.household_cents),
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

revoke execute on function public.whatsapp_record_half(text, text, bigint, bigint, bigint, bigint, boolean, smallint)
  from public, anon, authenticated;
grant execute on function public.whatsapp_record_half(text, text, bigint, bigint, bigint, bigint, boolean, smallint)
  to service_role;
grant execute on function private.whatsapp_issue_flow_token(uuid, text, smallint, interval) to service_role;
