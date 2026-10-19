-- A purchase in instalments.
--
-- "R$ 600 em 3x no cartão": one purchase, paid in three. It stays one line of
-- the journal -- one thing she bought, listed and struck through as one --
-- with the number of instalments and the date the first falls due. The
-- business result counts the whole purchase on the day she made it, as for
-- any purchase on credit; what is still to pay ("a pagar") follows the
-- instalments: an instalment falls due each month on the first one's day,
-- and the cents that do not divide evenly go to the first.
--
-- Expenses only, as the founder asked; a sale in instalments is a later
-- question.

alter table public.journal_entries
  add column installments smallint not null default 1 check (installments between 1 and 12),
  add constraint only_a_later_expense_is_in_instalments
    check (installments = 1 or (kind = 'expense' and due_on is not null));

/**
 * The instalments of a purchase: k = 1..n, each due a month after the one
 * before, starting on p_first_due; the remainder of the division in the first.
 */
create function private.journal_instalments(p_amount_cents bigint, p_n smallint, p_first_due date)
returns table (k integer, due_on date, amount_cents bigint)
language sql immutable set search_path = ''
as $$
  select g.k,
         (p_first_due + make_interval(months => g.k - 1))::date,
         p_amount_cents / p_n + case when g.k = 1 then p_amount_cents % p_n else 0 end
    from generate_series(1, greatest(p_n, 1)) g (k)
$$;

create or replace function public.journal_record(
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
        entrepreneur_id, occurred_on, kind, amount_cents, payment_method, due_on, installments, category,
        message_id, is_simulated
      ) values (
        p_entrepreneur_id, p_day,
        v_line ->> 'kind',
        (v_line ->> 'amount_cents')::bigint,
        v_line ->> 'payment_method',
        (v_line ->> 'due_on')::date,
        coalesce((v_line ->> 'installments')::smallint, 1),
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
      coalesce((select sum(e.amount_cents) from public.journal_entries e
                 where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on <= p_to and e.due_on > p_to
                   and e.voided_at is null and e.kind = 'sale'), 0) as receivable,
      -- An expense in instalments is owed instalment by instalment: what
      -- falls due after the end of the range is still to pay.
      coalesce((select sum(i.amount_cents) from public.journal_entries e
                 cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
                 where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on <= p_to and e.due_on is not null
                   and e.voided_at is null and e.kind = 'expense' and i.due_on > p_to), 0) as payable
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

create or replace function public.journal_list(p_entrepreneur_id uuid)
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
           'payment_method', x.payment_method, 'category', x.category, 'due_on', x.due_on,
           'installments', x.installments) order by x.n), '[]'::jsonb),
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

revoke execute on function private.journal_instalments(bigint, smallint, date) from public, anon, authenticated;
