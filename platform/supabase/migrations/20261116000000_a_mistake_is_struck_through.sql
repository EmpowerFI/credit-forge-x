-- A mistake is struck through, not erased; and a quiet day says why.
--
-- Three pieces that close the daily journal's first version (docs/whatsapp/
-- diario.pt-BR.md):
--
--   Correction. She can ask to see today's and yesterday's lines and remove
--   one that is wrong, then send the right one through the form. A removed
--   line is never deleted: it is marked voided, with the message that voided
--   it, and every sum ignores it. The window is the one she writes in --
--   today and yesterday -- and a line in a month already assembled for credit
--   cannot be voided here: that month is a record, and changing a record
--   is the versioned snapshot's job, not this one's.
--
--   Why a day was quiet. "Fechado" (she did not open) and "aberto sem
--   vendas" (she opened and sold nothing) are different facts about a
--   business, and the reminder can ask which. Both still keep the day.
--
--   Coverage. "Você registrou em 24 dos últimos 30 dias", computed for the
--   weekly reading and said by code.
--
-- The list she is shown is kept (journal_listings), so "APAGAR 2" removes the
-- line she saw as number 2 -- not whatever is second by the time she answers.

alter table public.journal_entries
  add column voided_at timestamptz,
  add column voided_by_message text,
  add constraint a_voided_line_says_by_what check ((voided_at is null) = (voided_by_message is null));

alter table public.journal_days
  add column quiet_reason text check (quiet_reason in ('closed', 'no_sales')),
  add constraint only_a_quiet_day_has_a_reason check (quiet_reason is null or no_activity);

create table public.journal_listings (
  entrepreneur_id  uuid primary key references public.entrepreneurs (id) on delete cascade,
  entry_ids        uuid[] not null,
  listed_at        timestamptz not null default now()
);
alter table public.journal_listings enable row level security;
revoke all on public.journal_listings from anon, authenticated;

-- ------------------------------------------------------------- writing a day

drop function public.journal_record(uuid, text, date, jsonb, boolean);

create function public.journal_record(
  p_entrepreneur_id uuid,
  p_message_id text,
  p_day date,
  p_entries jsonb,
  p_no_activity boolean default false,
  -- Why there was no activity, when she said: 'closed' (did not open) or
  -- 'no_sales' (opened, sold nothing). Null when she did not say which.
  p_quiet_reason text default null
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
  if p_quiet_reason is not null and not p_no_activity then
    raise exception 'a reason for no activity needs no activity' using errcode = '22023';
  end if;

  if p_no_activity then
    if exists (select 1 from public.journal_entries
                where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day and voided_at is null) then
      raise exception 'this day already has lines' using errcode = '22023';
    end if;
    -- Said twice, the later reason is the one she means.
    insert into public.journal_days (entrepreneur_id, day, no_activity, quiet_reason, is_simulated)
    values (p_entrepreneur_id, p_day, true, p_quiet_reason, v_sim)
    on conflict (entrepreneur_id, day) do update
      set no_activity = true, quiet_reason = coalesce(excluded.quiet_reason, public.journal_days.quiet_reason);
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
    on conflict (entrepreneur_id, day) do update set no_activity = false, quiet_reason = null;
  end if;

  return jsonb_build_object(
    'status', case when p_no_activity then 'no_activity' else 'recorded' end,
    'day', p_day,
    'lines', v_n
  );
end;
$$;


-- -------------------------------------------------------- what is counted

create or replace function public.journal_dre(p_entrepreneur_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with lines as (
    select e.*, private.journal_group(e.category) as grp
      from public.journal_entries e
     where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on between p_from and p_to
       and e.voided_at is null
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
    select count(*) as filled, count(*) filter (where no_activity) as quiet,
           count(*) filter (where no_activity and quiet_reason = 'closed') as closed
      from public.journal_days
     where entrepreneur_id = p_entrepreneur_id and day between p_from and p_to
  ),
  open_items as (
    select
      coalesce(sum(amount_cents) filter (where kind = 'sale'), 0)    as receivable,
      coalesce(sum(amount_cents) filter (where kind = 'expense'), 0) as payable
    from public.journal_entries
    where entrepreneur_id = p_entrepreneur_id and occurred_on <= p_to and due_on > p_to
      and voided_at is null
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'days', p_to - p_from + 1,
    'days_filled', d.filled,
    'days_no_activity', d.quiet,
    -- Of those, the days she said the business did not open.
    'days_closed', d.closed,
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


create or replace function public.journal_day_summary(p_entrepreneur_id uuid, p_day date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'day', p_day,
    'quiet', coalesce((select no_activity from public.journal_days
                        where entrepreneur_id = p_entrepreneur_id and day = p_day), false),
    'quiet_reason', (select quiet_reason from public.journal_days
                      where entrepreneur_id = p_entrepreneur_id and day = p_day),
    'sales_cents', coalesce((select sum(amount_cents) from public.journal_entries
                              where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day and kind = 'sale'
                                and voided_at is null), 0),
    'expenses_cents', coalesce((select sum(amount_cents) from public.journal_entries
                                 where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day and kind = 'expense'
                                 and voided_at is null), 0),
    'week_kept', (select count(*) from public.journal_days
                   where entrepreneur_id = p_entrepreneur_id
                     and day between date_trunc('week', p_day)::date and p_day),
    'week_days', p_day - date_trunc('week', p_day)::date + 1
  )
$$;


create or replace function public.journal_reading_inputs(p_entrepreneur_id uuid, p_week_start date)
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
    -- How closely she kept the journal: days kept in the thirty ending on
    -- the week's Sunday, out of thirty -- or out of the days since she
    -- started, if that is fewer. Said to her by code, never by the model.
    'coverage', (
      select jsonb_build_object(
        'kept', count(*) filter (where j.day between p_week_start + 6 - 29 and p_week_start + 6),
        'days', least(30, p_week_start + 6 - min(j.day) + 1))
        from public.journal_days j
       where j.entrepreneur_id = p_entrepreneur_id and j.day <= p_week_start + 6),
    'previous', case when (v_prev ->> 'days_filled')::integer >= 6 and (v_cur ->> 'days_filled')::integer >= 6
                     then v_prev - 'days_filled' end
  );
end;
$$;


-- ------------------------------------------------------------- correcting

/**
 * Today's and yesterday's lines that still count, numbered as she will see
 * them, and remembered so a removal can refer to what she saw.
 */
create function public.journal_list(p_entrepreneur_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_lines jsonb;
  v_ids uuid[];
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', x.n, 'id', x.id, 'day', x.occurred_on, 'kind', x.kind, 'amount_cents', x.amount_cents,
           'payment_method', x.payment_method, 'category', x.category, 'due_on', x.due_on) order by x.n), '[]'::jsonb),
         coalesce(array_agg(x.id order by x.n), '{}')
    into v_lines, v_ids
    from (select e.*, row_number() over (order by e.occurred_on, e.recorded_at, e.kind desc, e.id) as n
            from public.journal_entries e
           where e.entrepreneur_id = p_entrepreneur_id
             and e.occurred_on in (v_today - 1, v_today)
             and e.voided_at is null) x;

  insert into public.journal_listings (entrepreneur_id, entry_ids, listed_at)
  values (p_entrepreneur_id, v_ids, now())
  on conflict (entrepreneur_id) do update set entry_ids = excluded.entry_ids, listed_at = excluded.listed_at;

  return v_lines;
end;
$$;

/**
 * Voids line number p_n of the list she was last shown, if that list is
 * under an hour old and the line can still be corrected.
 */
create function public.journal_void(p_entrepreneur_id uuid, p_n integer, p_message_id text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_list public.journal_listings%rowtype;
  v_line public.journal_entries%rowtype;
  v_today date := private.sp_today();
begin
  select * into v_list from public.journal_listings where entrepreneur_id = p_entrepreneur_id;
  if not found or v_list.listed_at < now() - interval '1 hour' then
    raise exception 'no_recent_list' using errcode = 'P0001';
  end if;
  if p_n is null or p_n < 1 or p_n > coalesce(array_length(v_list.entry_ids, 1), 0) then
    raise exception 'no_such_line' using errcode = 'P0001';
  end if;

  select * into v_line from public.journal_entries
   where id = v_list.entry_ids[p_n] and entrepreneur_id = p_entrepreneur_id for update;
  if not found then
    raise exception 'no_such_line' using errcode = 'P0001';
  end if;
  if v_line.voided_at is not null then
    return jsonb_build_object('status', 'already_voided', 'n', p_n);
  end if;
  if v_line.occurred_on not in (v_today - 1, v_today) then
    raise exception 'too_old_to_correct' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.checkins
              where entrepreneur_id = p_entrepreneur_id and period = to_char(v_line.occurred_on, 'YYYY-MM')) then
    raise exception 'month_closed' using errcode = 'P0001';
  end if;

  update public.journal_entries set voided_at = now(), voided_by_message = p_message_id where id = v_line.id;
  return jsonb_build_object(
    'status', 'voided', 'n', p_n, 'day', v_line.occurred_on, 'kind', v_line.kind,
    'amount_cents', v_line.amount_cents, 'payment_method', v_line.payment_method, 'category', v_line.category);
end;
$$;

revoke execute on function public.journal_record(uuid, text, date, jsonb, boolean, text) from public, anon, authenticated;
revoke execute on function public.journal_list(uuid) from public, anon, authenticated;
revoke execute on function public.journal_void(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.journal_record(uuid, text, date, jsonb, boolean, text) to service_role;
grant execute on function public.journal_list(uuid) to service_role;
grant execute on function public.journal_void(uuid, integer, text) to service_role;
