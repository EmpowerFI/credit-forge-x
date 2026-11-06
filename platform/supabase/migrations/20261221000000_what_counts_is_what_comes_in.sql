-- What counts is what comes in, and what goes out.
--
-- A sale of R$ 600 in 3x on the card was counted whole on the day she made
-- it, and so was a purchase in instalments. That made a month look better (or
-- worse) than the money she actually had: she receives R$ 200 this month, not
-- R$ 600. So the diary now counts each line when its money moves: a line
-- paid on the spot on its day, and a line received or paid later on the day
-- each instalment falls due -- a sale "para receber dia 20" on the 20th.
--
-- This is what the diary shows her (her month, each day, and the weekly
-- reading). journal_dre keeps the sale on the day it was made, with what is
-- still to receive beside it, for the reports that need that view.

/**
 * Her lines as money that moved: each line on the day it was paid, a line
 * paid later split into its instalments, each on its own due date. Only
 * what moved between p_from and p_to; struck-through lines never count.
 */
create function private.journal_cash(p_entrepreneur_id uuid, p_from date, p_to date)
returns table (kind text, category text, on_day date, amount_cents bigint)
language sql stable security definer set search_path = ''
as $$
  select e.kind, e.category, e.occurred_on, e.amount_cents
    from public.journal_entries e
   where e.entrepreneur_id = p_entrepreneur_id and e.voided_at is null
     and e.due_on is null and e.occurred_on between p_from and p_to
  union all
  select e.kind, e.category, i.due_on, i.amount_cents
    from public.journal_entries e
   cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
   where e.entrepreneur_id = p_entrepreneur_id and e.voided_at is null
     and e.due_on is not null and e.due_on <= p_to
     and i.due_on between p_from and p_to
$$;

-- The money of a span, as the diary says it: what came in from sales, the
-- business's expenses, and what she took home (apart: it is not a cost).
create function private.journal_cash_sums(p_entrepreneur_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'sales_cents', coalesce(sum(c.amount_cents) filter (where c.kind = 'sale'), 0),
    'expenses_cents', coalesce(sum(c.amount_cents) filter (where c.kind = 'expense' and c.category is distinct from 'withdrawal'), 0),
    'taken_home_cents', coalesce(sum(c.amount_cents) filter (where c.kind = 'expense' and c.category = 'withdrawal'), 0))
    from private.journal_cash(p_entrepreneur_id, p_from, p_to) c
$$;

-- The month so far, as money that moved from its first day to today.
create or replace function public.diary_month()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select private.diary_me() as id),
  span as (select date_trunc('month', private.sp_today())::date as first, private.sp_today() as today),
  s as (select private.journal_cash_sums(me.id, span.first, span.today) as m from me, span)
  select jsonb_build_object(
    'period', to_char(span.first, 'YYYY-MM'),
    'first_day', span.first,
    'today', span.today,
    'sales_cents', (s.m ->> 'sales_cents')::bigint,
    'expenses_cents', (s.m ->> 'expenses_cents')::bigint,
    'profit_cents', (s.m ->> 'sales_cents')::bigint - (s.m ->> 'expenses_cents')::bigint,
    'taken_home_cents', (s.m ->> 'taken_home_cents')::bigint,
    'days_kept', (select count(*) from public.journal_days d, me
                   where d.entrepreneur_id = me.id and d.day between span.first and span.today),
    'monthly_need_cents', (select e.monthly_need_cents from public.entrepreneurs e, me where e.id = me.id)
  )
  from s, span
$$;

-- Her last p_days days, each with its lines and, in "money", what moved
-- that day: the lines paid on the spot, and the instalments falling due,
-- of that day's lines or of earlier ones.
create or replace function public.diary_history(p_days integer default 31)
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
           'money', private.journal_cash_sums(me.id, days.day, days.day),
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', e.id, 'kind', e.kind, 'amount_cents', e.amount_cents,
                      'payment_method', e.payment_method, 'due_on', e.due_on,
                      'installments', e.installments, 'category', e.category,
                      'voided', e.voided_at is not null)
                    order by e.recorded_at)
               from public.journal_entries e
              where e.entrepreneur_id = me.id and e.occurred_on = days.day), '[]'::jsonb)
         ) order by days.day desc), '[]'::jsonb)
    from days, me
$$;

-- The weekly reading counts the same money as the screen.
create or replace function private.journal_week_figures(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select c.kind, private.journal_group(c.category) as grp, c.amount_cents
      from private.journal_cash(p_entrepreneur_id, p_week_start, p_week_start + 6) c
  ),
  s as (
    select coalesce(sum(amount_cents) filter (where kind = 'sale'), 0) as revenue,
           coalesce(sum(amount_cents) filter (where kind = 'expense' and grp = 'cogs'), 0) as cogs,
           -- Every other expense of the business: running costs, staff,
           -- equipment and loan instalments.
           coalesce(sum(amount_cents) filter (where kind = 'expense' and grp is distinct from 'cogs' and grp is distinct from 'withdrawal'), 0) as opex,
           coalesce(sum(amount_cents) filter (where kind = 'expense' and grp = 'withdrawal'), 0) as household
      from c
  )
  select jsonb_build_object(
    'period', to_char(p_week_start, 'YYYY-MM-DD'),
    'revenue_cents', s.revenue,
    'cogs_cents', s.cogs,
    'opex_cents', s.opex,
    'household_cents', s.household,
    -- A week kept day by day is a week of records.
    'keeps_records', true,
    'active_days', (d ->> 'selling_days')::integer,
    -- The days a week her business opens: the week's base, not seven.
    'open_days', private.open_days_count(p_entrepreneur_id),
    -- Her pay for the week, a cost like the others. Null until she says what she needs.
    'pay_cents', private.pay_share(p_entrepreneur_id, p_week_start, p_week_start + 6),
    'days_filled', (d ->> 'days_filled')::integer
  )
  from s, (select public.journal_dre(p_entrepreneur_id, p_week_start, p_week_start + 6) as d) x
$$;

revoke execute on function private.journal_cash(uuid, date, date), private.journal_cash_sums(uuid, date, date)
  from public, anon, authenticated;
