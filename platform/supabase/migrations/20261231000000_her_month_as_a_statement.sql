-- Her month as a statement.
--
-- Founder's request, 10/11/2026: at the end of each month the entrepreneur
-- sees her sales and expenses laid out like a DRE (a simple income
-- statement), in a tab of its own, so she understands where the money came
-- from and what each kind of expense took.
--
-- It counts money as the rest of the diary does (20261221): a line paid on
-- the spot on its day, a line paid later on each instalment's due date. So
-- its sales, expenses and profit are the "Seu mês" card's, line by line:
--
--   sales, by how she was paid
--   - cost of goods (stock, packaging)          = gross profit
--   - running costs (rent and bills, transport, fees, advertising, other)
--   - staff
--   - equipment and loan instalments            = the business's result
--   - her monthly salary, whole, as the card subtracts it
--                                               = profit
--
-- What she took home (withdrawal) is shown apart, never subtracted: it is
-- not a cost, as on the card. What is still to receive or to pay after the
-- month, from instalments, is shown beside it.
--
-- A month that has not ended is shown up to today. Her salary is the one set
-- now; the diary keeps no history of it.

create function public.diary_month_statement(p_period text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_today date := private.sp_today();
  v_first date;
  v_last date;
  v_to date;
  v_first_kept date;
begin
  if p_period is null then
    v_first := date_trunc('month', v_today)::date;
  elsif p_period ~ '^\d{4}-(0[1-9]|1[0-2])$' then
    v_first := to_date(p_period || '-01', 'YYYY-MM-DD');
  else
    raise exception 'period_invalid' using errcode = '22023';
  end if;
  if v_first > v_today then
    raise exception 'period_in_the_future' using errcode = '22023';
  end if;
  v_last := (v_first + interval '1 month - 1 day')::date;
  v_to := least(v_last, v_today);

  select min(d.day) into v_first_kept from public.journal_days d where d.entrepreneur_id = v_me;

  return (
    with lines as (
      -- As private.journal_cash, with how each sale was paid.
      select e.kind, e.category, e.payment_method, e.amount_cents
        from public.journal_entries e
       where e.entrepreneur_id = v_me and e.voided_at is null
         and e.due_on is null and e.occurred_on between v_first and v_to
      union all
      select e.kind, e.category, e.payment_method, i.amount_cents
        from public.journal_entries e
       cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
       where e.entrepreneur_id = v_me and e.voided_at is null
         and e.due_on is not null and e.due_on <= v_to
         and i.due_on between v_first and v_to
    ),
    later as (
      select coalesce(sum(i.amount_cents) filter (where e.kind = 'sale'), 0) as receivable,
             coalesce(sum(i.amount_cents) filter (where e.kind = 'expense'), 0) as payable
        from public.journal_entries e
       cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
       where e.entrepreneur_id = v_me and e.voided_at is null
         and e.due_on is not null and e.occurred_on <= v_to and i.due_on > v_to
    ),
    s as (
      select coalesce(sum(amount_cents) filter (where kind = 'sale'), 0) as sales,
             coalesce(sum(amount_cents) filter (where kind = 'expense' and category is distinct from 'withdrawal'), 0) as expenses,
             coalesce(sum(amount_cents) filter (where kind = 'expense' and category = 'withdrawal'), 0) as taken_home
        from lines
    ),
    pay as (select (select e.monthly_need_cents from public.entrepreneurs e where e.id = v_me) as cents)
    select jsonb_build_object(
      'period', to_char(v_first, 'YYYY-MM'),
      'first_day', v_first,
      'last_day', v_last,
      'to', v_to,
      'complete', v_today > v_last,
      'days_kept', (select count(*) from public.journal_days d
                     where d.entrepreneur_id = v_me and d.day between v_first and v_to),
      'sales_cents', s.sales,
      'sales_by_method', coalesce((
        select jsonb_object_agg(m.payment_method, m.cents)
          from (select payment_method, sum(amount_cents) as cents from lines
                 where kind = 'sale' group by payment_method) m), '{}'::jsonb),
      'expenses_by_category', coalesce((
        select jsonb_agg(jsonb_build_object('category', c.category, 'group', private.journal_group(c.category), 'cents', c.cents)
                         order by c.cents desc)
          from (select category, sum(amount_cents) as cents from lines
                 where kind = 'expense' and category is distinct from 'withdrawal'
                 group by category) c), '[]'::jsonb),
      'expenses_cents', s.expenses,
      'result_cents', s.sales - s.expenses,
      'salary_cents', pay.cents,
      'profit_cents', case when pay.cents is null then null else s.sales - s.expenses - pay.cents end,
      'taken_home_cents', s.taken_home,
      'receivable_cents', later.receivable,
      'payable_cents', later.payable,
      -- Every month she can open: from her first recorded day's month to this one, newest first.
      'months', coalesce((
        select jsonb_agg(to_char(m, 'YYYY-MM') order by m desc)
          from generate_series(date_trunc('month', coalesce(v_first_kept, v_today)),
                               date_trunc('month', v_today), interval '1 month') m), '[]'::jsonb)
    )
    from s, later, pay
  );
end $$;

revoke execute on function public.diary_month_statement(text) from public, anon;
grant execute on function public.diary_month_statement(text) to authenticated;
