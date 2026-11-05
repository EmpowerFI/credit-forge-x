-- Her week, read, in her diary.
--
-- The weekly reading used to go out only on WhatsApp, after a day recorded
-- there; the WhatsApp channel is gone, so the diary in the browser asks for
-- it (the diary-reading function, when she opens it) and shows it. This is
-- what it shows: her readings, newest first, with the days she kept in each
-- week. Only finished ones; nothing about tokens, cost or the model's
-- refusals, which are for review, not for her.

create function public.diary_readings(p_limit integer default 12)
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
           'completed_at', r.completed_at
         ) order by r.week_start desc), '[]'::jsonb)
    from (select r.* from public.journal_readings r, me
           where r.entrepreneur_id = me.id and r.status = 'done'
           order by r.week_start desc
           limit least(greatest(coalesce(p_limit, 12), 1), 52)) r
$$;

revoke execute on function public.diary_readings(integer) from public, anon;
grant execute on function public.diary_readings(integer) to authenticated, service_role;
