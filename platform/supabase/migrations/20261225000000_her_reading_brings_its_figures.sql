-- Her reading brings its figures.
--
-- The diary colours the reading's money as it colours Seu mês: sales blue,
-- expenses orange, profit green and a loss red. To know which amount in the
-- text is which, it needs the figures the reading was written from. They are
-- already kept beside it (journal_readings.insights): diary_readings, as
-- 20261218's, now returns them too. Hers only, as before.

create or replace function public.diary_readings(p_limit integer default 12)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select private.diary_me() as id)
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_start', r.week_start,
           'source', r.source,
           'report', r.report,
           'days_kept', (select count(*) from public.journal_days d
                          where d.entrepreneur_id = r.entrepreneur_id
                            and d.day between r.week_start and r.week_start + 6),
           'open_days', coalesce((r.insights ->> 'open_days')::integer, private.open_days_count(r.entrepreneur_id)),
           'figures', jsonb_build_object(
             'sales_cents', (r.insights ->> 'revenue_cents')::bigint,
             'expenses_cents', (r.insights ->> 'business_cost_cents')::bigint,
             'result_cents', (r.insights ->> 'result_cents')::bigint,
             'pay_cents', (r.insights ->> 'pay_cents')::bigint,
             'profit_cents', (r.insights ->> 'profit_cents')::bigint),
           'completed_at', r.completed_at
         ) order by r.week_start desc), '[]'::jsonb)
    from (select r.* from public.journal_readings r, me
           where r.entrepreneur_id = me.id and r.status = 'done'
           order by r.week_start desc
           limit least(greatest(coalesce(p_limit, 12), 1), 52)) r
$$;
