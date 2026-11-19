-- A day shows what fell due on it.
--
-- Founder, 19/11/2026: she recorded one expense on the card, to pay on 10
-- December, and the day said she had sold something she never recorded.
-- Since 20261221 the diary counts each line when its money moves: a line paid
-- later counts on the day each instalment falls due, not on the day she made
-- it. So the day's "vendeu" held an instalment of a sale from another day,
-- falling due that day, and her card expense counted nowhere that day. The
-- figures were right, but nothing on the screen said where they came from.
--
-- diary_history now says it, per day, beside "money":
--   falling_due  the instalments of lines from other days that fell due that
--                day (kind, category, amount, which instalment of how many,
--                and the day the line was made);
--   later_cents  what the day's own lines leave for later, by kind: money
--                that is not in that day's figures.
-- Everything else is 20261221's.

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
           'falling_due', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'kind', e.kind, 'category', e.category, 'amount_cents', i.amount_cents,
                      'instalment', i.k, 'installments', e.installments, 'from_day', e.occurred_on)
                    order by e.occurred_on, e.recorded_at, i.k)
               from public.journal_entries e
              cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
              where e.entrepreneur_id = me.id and e.voided_at is null
                and e.due_on is not null and e.occurred_on <> days.day
                and i.due_on = days.day), '[]'::jsonb),
           'later_cents', (
             select jsonb_build_object(
                      'sales', coalesce(sum(e.amount_cents - coalesce(i.today, 0)) filter (where e.kind = 'sale'), 0),
                      'expenses', coalesce(sum(e.amount_cents - coalesce(i.today, 0)) filter (where e.kind = 'expense'), 0))
               from public.journal_entries e
               left join lateral (
                 select sum(x.amount_cents) as today
                   from private.journal_instalments(e.amount_cents, e.installments, e.due_on) x
                  where x.due_on = days.day) i on true
              where e.entrepreneur_id = me.id and e.occurred_on = days.day
                and e.voided_at is null and e.due_on is not null),
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
