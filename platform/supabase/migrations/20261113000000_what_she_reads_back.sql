-- What she reads back the moment a day is in.
--
-- The confirmation is fixed text, not a model, and its sums must be the
-- database's: the day's sales and expenses as now recorded -- every form sent
-- that day added together, not just the last one -- and how many days of the
-- current calendar week she has kept. The streak and the rewards will read
-- the same days when they are built; this is only the count she sees today.

create function public.journal_day_summary(p_entrepreneur_id uuid, p_day date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'day', p_day,
    'quiet', coalesce((select no_activity from public.journal_days
                        where entrepreneur_id = p_entrepreneur_id and day = p_day), false),
    'sales_cents', coalesce((select sum(amount_cents) from public.journal_entries
                              where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day and kind = 'sale'), 0),
    'expenses_cents', coalesce((select sum(amount_cents) from public.journal_entries
                                 where entrepreneur_id = p_entrepreneur_id and occurred_on = p_day and kind = 'expense'), 0),
    'week_kept', (select count(*) from public.journal_days
                   where entrepreneur_id = p_entrepreneur_id
                     and day between date_trunc('week', p_day)::date and p_day),
    'week_days', p_day - date_trunc('week', p_day)::date + 1
  )
$$;

revoke execute on function public.journal_day_summary(uuid, date) from public, anon, authenticated;
grant execute on function public.journal_day_summary(uuid, date) to service_role;
