-- An instalment that falls due says how it was paid.
--
-- Founder, 19/11/2026: in Today's summary, each instalment from another day
-- should say what it is, in small letters under its amount, the same way for
-- a sale and an expense: "Parcela 1/3 · venda no cartão de crédito de 20/10".
-- So falling_due carries the line's payment method too.
--
-- As 20270113's diary_history, with only that field added. It also carries
-- everything 20270113 added, so applying this one alone is enough.

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
                      'kind', e.kind, 'category', e.category, 'payment_method', e.payment_method,
                      'amount_cents', i.amount_cents,
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
