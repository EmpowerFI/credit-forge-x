-- The daily journal: what she sold and spent, written on the day.
--
-- The fortnightly check-in asked her to remember fifteen days at once, and the
-- credit adviser's point is that nobody does. This is its replacement, as
-- specified in docs/whatsapp/diario.pt-BR.md: one line per sale or expense --
-- or one line per day's total by payment method, which is just as good --
-- written today or, at the latest, tomorrow.
--
-- Three things are built on the lines and none of them is stored twice:
--
--   journal_dre          a simple income statement for any range of days,
--                        with what she is owed and what she owes beside it
--   journal_month_status whether a month was kept closely enough to count
--   journal_close_month  the month, assembled into public.checkins, so the
--                        readiness engine reads it exactly as it reads any
--                        other month and does not change
--
-- A month counts when no calendar week inside it is missing more than one
-- day -- the same one-day-a-week tolerance the streak will use. A day counts
-- when it has at least one line, or when she said there was no activity: a
-- woman who sold nothing must never have to choose between breaking her
-- streak and inventing a sale.
--
-- Not here yet, on purpose: the streak and the rewards, the weekly reading,
-- and the WhatsApp form that writes these lines. The fortnight tables stay in
-- place until that form replaces theirs; nothing real was ever written to
-- them.

-- ------------------------------------------------------------- the day, in São Paulo

create function private.sp_today()
returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ------------------------------------------------------- what a gasto is, in the DRE
--
-- The words she sees are in the Flow; these are the keys. The group is what
-- the income statement does with each one, and three of them are outside the
-- result on purpose: a R$ 1.500 machine counted as an expense would make the
-- month she bought it look like a loss, and a loan instalment is debt, not a
-- cost of the business. Her withdrawals for the house sit below the result.

create function private.journal_group(p_category text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_category
    when 'stock'          then 'cogs'        -- mercadoria ou matéria-prima
    when 'packaging'      then 'cogs'        -- embalagem
    when 'rent_utilities' then 'opex'        -- aluguel, água, luz, internet, telefone
    when 'transport'      then 'opex'        -- transporte e entrega
    when 'fees'           then 'opex'        -- taxas: maquininha, aplicativo, marketplace
    when 'marketing'      then 'opex'        -- divulgação
    when 'staff'          then 'staff'       -- ajudante ou funcionário
    when 'other'          then 'opex'        -- outro gasto do negócio
    when 'withdrawal'     then 'withdrawal'  -- retirada para casa (pró-labore)
    when 'equipment'      then 'investment'  -- equipamento
    when 'debt'           then 'financing'   -- parcela de empréstimo ou dívida
  end
$$;

-- ----------------------------------------------------------------- the lines

create table public.journal_entries (
  id               uuid primary key default gen_random_uuid(),
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  -- The day it happened, in São Paulo. Not when it arrived: that is recorded_at.
  occurred_on      date not null,
  kind             text not null check (kind in ('sale', 'expense')),
  amount_cents     bigint not null check (amount_cents between 1 and 10000000000),
  payment_method   text not null check (payment_method in ('pix', 'cash', 'debit_card', 'credit_card', 'fiado')),
  -- Null is à vista. A date is a prazo: when she will receive (a sale) or pay
  -- (an expense). This is what turns a diary into a credit signal -- what she
  -- is owed and what she owes.
  due_on           date check (due_on is null or due_on > occurred_on),
  category         text check (category is null or private.journal_group(category) is not null),
  message_id       text not null,
  recorded_at      timestamptz not null default now(),
  is_simulated     boolean not null default false,
  constraint a_sale_has_no_category_and_an_expense_has_one
    check ((kind = 'sale') = (category is null))
);

create index journal_entries_by_day on public.journal_entries (entrepreneur_id, occurred_on);
create index journal_entries_due on public.journal_entries (entrepreneur_id, due_on) where due_on is not null;

-- A day she kept: at least one line, or her word that nothing happened.
create table public.journal_days (
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  day              date not null,
  no_activity      boolean not null default false,
  first_recorded_at timestamptz not null default now(),
  is_simulated     boolean not null default false,
  primary key (entrepreneur_id, day)
);

alter table public.journal_entries enable row level security;
alter table public.journal_days enable row level security;
revoke all on public.journal_entries, public.journal_days from anon, authenticated;

-- Where a month came from. Existing rows were typed into the form.
alter table public.checkins
  add column source text not null default 'form' check (source in ('form', 'fortnights', 'journal'));

-- ------------------------------------------------------------- writing a day

/**
 * Records one message's worth of a day: its lines, or that there were none.
 *
 * One call per message, so recognising Meta's retry, checking the day and
 * writing the lines are one transaction. The day is today or yesterday in
 * São Paulo and nothing else -- "ontem basta" -- because a figure remembered
 * from last week is exactly what this replaced.
 *
 * p_entries is an array of
 *   { kind, amount_cents, payment_method, due_on?, category? }
 * and every line is checked before any is written.
 */
create function public.journal_record(
  p_entrepreneur_id uuid,
  p_message_id text,
  p_day date,
  p_entries jsonb,
  p_no_activity boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_sim boolean;
  v_line jsonb;
  v_n integer := 0;
  v_has_lines boolean;
begin
  if p_message_id is null or btrim(p_message_id) = '' then
    raise exception 'a journal line needs the message it came in' using errcode = '22023';
  end if;

  insert into public.whatsapp_inbound_events (message_id, outcome)
  values (p_message_id, 'journal')
  on conflict (message_id) do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate', 'message_id', p_message_id);
  end if;

  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;

  if p_day is null or p_day not in (v_today, v_today - 1) then
    raise exception 'a day is written on the day or the day after, not on %', p_day using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'entries must be a list' using errcode = '22023';
  end if;
  v_has_lines := jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) > 0;

  if p_no_activity and v_has_lines then
    raise exception 'a day with lines is not a day without activity' using errcode = '22023';
  end if;
  if not p_no_activity and not v_has_lines then
    raise exception 'nothing to record' using errcode = '22023';
  end if;

  if p_no_activity then
    if exists (select 1 from public.journal_entries where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day) then
      raise exception 'this day already has lines' using errcode = '22023';
    end if;
    insert into public.journal_days (entrepreneur_id, day, no_activity, is_simulated)
    values (p_entrepreneur_id, p_day, true, v_sim)
    on conflict (entrepreneur_id, day) do nothing;
  else
    for v_line in select * from jsonb_array_elements(p_entries) loop
      insert into public.journal_entries (
        entrepreneur_id, occurred_on, kind, amount_cents, payment_method, due_on, category, message_id, is_simulated
      ) values (
        p_entrepreneur_id, p_day,
        v_line ->> 'kind',
        (v_line ->> 'amount_cents')::bigint,
        v_line ->> 'payment_method',
        (v_line ->> 'due_on')::date,
        v_line ->> 'category',
        p_message_id, v_sim
      );
      v_n := v_n + 1;
    end loop;
    -- A day she first said was quiet and then sold something was not quiet.
    insert into public.journal_days (entrepreneur_id, day, no_activity, is_simulated)
    values (p_entrepreneur_id, p_day, false, v_sim)
    on conflict (entrepreneur_id, day) do update set no_activity = false;
  end if;

  return jsonb_build_object(
    'status', case when p_no_activity then 'no_activity' else 'recorded' end,
    'day', p_day,
    'lines', v_n
  );
end;
$$;

-- --------------------------------------------------------- the income statement

/**
 * The DRE of any range of days, from her lines and nothing else.
 *
 * Sales count on the day they happened, whenever the money arrives; what is
 * still to arrive is reported beside it as receivable, and what she still has
 * to pay as payable, both as of the last day of the range. Card sales and the
 * fees she declared are reported together so the fee can be checked against
 * the sales it was charged on.
 */
create function public.journal_dre(p_entrepreneur_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with lines as (
    select e.*, private.journal_group(e.category) as grp
      from public.journal_entries e
     where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on between p_from and p_to
  ),
  sums as (
    select
      coalesce(sum(amount_cents) filter (where kind = 'sale'), 0)                         as revenue,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'pix'), 0)         as rev_pix,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'cash'), 0)        as rev_cash,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'debit_card'), 0)  as rev_debit,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'credit_card'), 0) as rev_credit,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'fiado'), 0)       as rev_fiado,
      coalesce(sum(amount_cents) filter (where grp = 'cogs'), 0)       as cogs,
      coalesce(sum(amount_cents) filter (where grp = 'opex'), 0)       as opex,
      coalesce(sum(amount_cents) filter (where grp = 'staff'), 0)      as staff,
      coalesce(sum(amount_cents) filter (where grp = 'withdrawal'), 0) as withdrawals,
      coalesce(sum(amount_cents) filter (where grp = 'investment'), 0) as investment,
      coalesce(sum(amount_cents) filter (where grp = 'financing'), 0)  as financing,
      coalesce(sum(amount_cents) filter (where category = 'fees'), 0)  as fees,
      count(distinct occurred_on) filter (where kind = 'sale')         as selling_days
    from lines
  ),
  days as (
    select count(*) as filled, count(*) filter (where no_activity) as quiet
      from public.journal_days
     where entrepreneur_id = p_entrepreneur_id and day between p_from and p_to
  ),
  open_items as (
    select
      coalesce(sum(amount_cents) filter (where kind = 'sale'), 0)    as receivable,
      coalesce(sum(amount_cents) filter (where kind = 'expense'), 0) as payable
    from public.journal_entries
    where entrepreneur_id = p_entrepreneur_id and occurred_on <= p_to and due_on > p_to
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'days', p_to - p_from + 1,
    'days_filled', d.filled,
    'days_no_activity', d.quiet,
    'selling_days', s.selling_days,
    'revenue_cents', s.revenue,
    'revenue_by_method', jsonb_build_object(
      'pix', s.rev_pix, 'cash', s.rev_cash, 'debit_card', s.rev_debit,
      'credit_card', s.rev_credit, 'fiado', s.rev_fiado),
    'cogs_cents', s.cogs,
    'gross_result_cents', s.revenue - s.cogs,
    'opex_cents', s.opex,
    'staff_cents', s.staff,
    'result_cents', s.revenue - s.cogs - s.opex - s.staff,
    'withdrawals_cents', s.withdrawals,
    'retained_cents', s.revenue - s.cogs - s.opex - s.staff - s.withdrawals,
    'investment_cents', s.investment,
    'financing_cents', s.financing,
    'receivable_cents', o.receivable,
    'payable_cents', o.payable,
    'card_sales_cents', s.rev_debit + s.rev_credit,
    'card_fees_cents', s.fees
  )
  from sums s, days d, open_items o
$$;

-- ------------------------------------------------------------------ the month

/**
 * Whether a month was kept closely enough to count for credit.
 *
 * Every calendar week inside the month may be missing at most one day. A
 * month she began halfway through is missing its first half, and does not
 * count: it is the next one that will. A month still open -- or its last day,
 * which she may still write tomorrow -- is never final.
 */
create function public.journal_month_status(p_entrepreneur_id uuid, p_period text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with bounds as (
    select to_date(p_period || '-01', 'YYYY-MM-DD') as first_day,
           (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date as last_day
  ),
  calendar as (
    select d::date as day, date_trunc('week', d)::date as week
      from bounds, generate_series(bounds.first_day, bounds.last_day, interval '1 day') d
  ),
  kept as (
    select c.day, c.week, (j.day is not null) as filled
      from calendar c
      left join public.journal_days j on j.entrepreneur_id = p_entrepreneur_id and j.day = c.day
  ),
  weeks as (
    select week, count(*) filter (where not filled) as missing from kept group by week
  )
  select jsonb_build_object(
    'period', p_period,
    'days', (select count(*) from kept),
    'filled', (select count(*) from kept where filled),
    'missing', (select count(*) from kept where not filled),
    'worst_week_missing', (select coalesce(max(missing), 0) from weeks),
    -- Final once she can no longer write its last day: two days after it.
    'final', private.sp_today() > (select last_day from bounds) + 1,
    'counts', (select coalesce(max(missing), 0) from weeks) <= 1
  )
$$;

/**
 * Assembles a finished, well-kept month into public.checkins.
 *
 * The readiness engine then reads it like any other month. Nothing is
 * overwritten: a month that already exists stays as it is.
 */
create function public.journal_close_month(p_entrepreneur_id uuid, p_period text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_status jsonb := public.journal_month_status(p_entrepreneur_id, p_period);
  v_from date := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_to date := (to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  v_dre jsonb;
  v_id uuid;
begin
  if not (v_status ->> 'final')::boolean then
    return jsonb_build_object('status', 'not_final') || v_status;
  end if;
  if not (v_status ->> 'counts')::boolean then
    return jsonb_build_object('status', 'does_not_count') || v_status;
  end if;
  if exists (select 1 from public.checkins where entrepreneur_id = p_entrepreneur_id and period = p_period) then
    return jsonb_build_object('status', 'exists') || v_status;
  end if;

  v_dre := public.journal_dre(p_entrepreneur_id, v_from, v_to);

  insert into public.checkins (
    entrepreneur_id, period, revenue_cents, cogs_cents, opex_cents, household_cents,
    keeps_records, active_days, is_simulated, source
  )
  select p_entrepreneur_id, p_period,
         (v_dre ->> 'revenue_cents')::bigint,
         (v_dre ->> 'cogs_cents')::bigint,
         -- The engine has one operating-cost figure; staff is one of them.
         (v_dre ->> 'opex_cents')::bigint + (v_dre ->> 'staff_cents')::bigint,
         (v_dre ->> 'withdrawals_cents')::bigint,
         -- A month kept day by day is a month of records.
         true,
         (v_dre ->> 'selling_days')::smallint,
         e.is_simulated,
         'journal'
    from public.entrepreneurs e where e.id = p_entrepreneur_id
  returning id into v_id;

  return jsonb_build_object('status', 'assembled', 'checkin_id', v_id) || v_status;
end;
$$;

-- Last month, closed every day. On the 1st it is not final yet -- she may
-- still write its last day -- and from the 2nd on it is; running again
-- changes nothing, because a month assembled is a month that exists, and a
-- missed run is made up by the next one.
create function private.journal_close_due()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_period text := to_char(date_trunc('month', private.sp_today()) - interval '1 day', 'YYYY-MM');
  v_e uuid;
  v_n integer := 0;
begin
  for v_e in
    select distinct entrepreneur_id from public.journal_days
     where to_char(day, 'YYYY-MM') = v_period
  loop
    if public.journal_close_month(v_e, v_period) ->> 'status' = 'assembled' then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

select cron.schedule('journal-close-month', '0 7 * * *', 'select private.journal_close_due()');

revoke execute on function public.journal_record(uuid, text, date, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.journal_dre(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.journal_month_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.journal_close_month(uuid, text) from public, anon, authenticated;
revoke execute on function private.journal_close_due() from public, anon, authenticated;
grant execute on function public.journal_record(uuid, text, date, jsonb, boolean) to service_role;
grant execute on function public.journal_dre(uuid, date, date) to service_role;
grant execute on function public.journal_month_status(uuid, text) to service_role;
grant execute on function public.journal_close_month(uuid, text) to service_role;
