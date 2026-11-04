-- Her age, and her cohort's sales, in the impact area.
--
-- Founder's request, 04/11/2026:
--
--   * AGE RANGE IS A BREAKDOWN of "who takes part", next to what she sells,
--     her state, formalisation and how she tracked money: the app's buckets
--     (20261211), with the same rule as every breakdown -- groups under 5
--     fold into "outros", or are left out.
--   * THE COHORT'S SALES: each month of well-recorded businesses (consent to
--     be counted, at least 12 days recorded) now carries the MEAN of their
--     sales beside the median. The page reads the trend -- up or down --
--     from the last two months shown. Months under 5 businesses stay hidden,
--     so neither figure ever describes fewer than five.
--
-- impact_live is 20261205's, with only those two additions.

drop function private.diary_members();

-- Women in the diary: enrolled in the browser, or with a day recorded.
create function private.diary_members()
returns table (id uuid, sector text, state text, formalization text, finance_control text, age_range text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.business_sector, e.state, e.formalization, e.finance_control, e.age_range
    from public.entrepreneurs e
   where not e.is_simulated
     and (exists (select 1 from public.diary_reminder_settings s where s.entrepreneur_id = e.id)
          or exists (select 1 from public.journal_days d where d.entrepreneur_id = e.id))
$$;
revoke execute on function private.diary_members() from public, anon, authenticated;

create or replace function public.impact_live(p_program_id uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
  v_sponsor text;
  v_today date := private.sp_today();
  v_from date;
  v_to date;
  v_out jsonb;
begin
  if p_program_id is null or not private.can_see_campaign(p_program_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_g from public.programs where id = p_program_id;
  select name into v_sponsor from public.sponsors where id = v_g.sponsor_id;
  v_from := greatest(coalesce(p_from, v_g.period_start), v_g.period_start);
  v_to := least(coalesce(p_to, v_today), coalesce(v_g.period_end, v_today), v_today);

  if v_from > v_to then
    return jsonb_build_object(
      'campaign', jsonb_build_object('id', v_g.id, 'name', v_g.name, 'sponsor_name', v_sponsor,
                                     'is_default', v_g.is_default, 'period_start', v_g.period_start,
                                     'period_end', v_g.period_end),
      'from', v_from, 'to', v_to, 'status', 'not_started', 'as_of', now());
  end if;

  with
  members as (select * from private.diary_members()),
  -- Who the campaign is about. A campaign: whoever was authorised in it and
  -- has signed up. EmpowerFI: whoever is EmpowerFI's on the last day.
  cohort as (
    select m.*
      from members m
     where case when v_g.is_default
                then private.program_on(m.id, v_to) = v_g.id
                else exists (select 1 from public.program_participants p
                              where p.program_id = v_g.id and p.email = private.email_of(m.id)
                                and p.starts_on <= v_to
                                and coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date) >= v_from)
           end
  ),
  days as (
    select d.entrepreneur_id, d.day, d.no_activity
      from public.journal_days d
      join members m on m.id = d.entrepreneur_id
     where d.day between v_from and v_to
       and private.program_on(d.entrepreneur_id, d.day) = v_g.id
  ),
  -- Everyone who recorded a day for this campaign, in or out of the cohort now.
  people as (
    select m.* from members m
     where m.id in (select id from cohort) or m.id in (select entrepreneur_id from days)
  ),
  started as (select distinct entrepreneur_id as id from days),
  kept as (select p.id, private.journal_days_kept(p.id) as n from people p),
  streaks as (
    select s.id, (select st.kept_days from private.journal_streak(s.id, v_to) st limit 1) as n from started s
  ),
  weeks as (
    select w::date as week_start
      from generate_series(date_trunc('week', v_from::timestamp), v_to::timestamp, interval '1 week') w
  ),
  goals as (
    select g.* from public.journal_goals g
     where g.entrepreneur_id in (select id from started)
       and g.week_start between date_trunc('week', v_from::timestamp)::date and v_to
  ),
  reminders as (
    select r.* from public.diary_reminders r
      join members m on m.id = r.entrepreneur_id
     where r.day between v_from and v_to and private.program_on(r.entrepreneur_id, r.day) = v_g.id
  ),
  checkins as (
    select c.* from public.diary_checkins c
      join members m on m.id = c.entrepreneur_id
     where c.day between v_from and v_to and private.program_on(c.entrepreneur_id, c.day) = v_g.id
  ),
  -- ---- business: only women who chose to be counted
  consenting as (select p.id from people p where private.has_consent(p.id, 'impact')),
  months as (
    select date_trunc('month', d.day)::date as month, d.entrepreneur_id, count(*) as recorded
      from days d where d.entrepreneur_id in (select id from consenting)
     group by 1, 2
  ),
  well as (select * from months where recorded >= 12),
  money as (
    select w.month, w.entrepreneur_id,
           coalesce(sum(j.amount_cents) filter (where j.kind = 'sale'), 0) as sales,
           coalesce(sum(j.amount_cents) filter (where j.kind = 'expense'), 0) as expenses
      from well w
      left join public.journal_entries j
        on j.entrepreneur_id = w.entrepreneur_id and j.voided_at is null
       and j.occurred_on >= w.month and j.occurred_on < (w.month + interval '1 month')::date
       and j.occurred_on between v_from and v_to
       and private.program_on(j.entrepreneur_id, j.occurred_on) = v_g.id
     group by 1, 2
  ),
  growth as (
    select cur.month, cur.entrepreneur_id, (cur.sales - prev.sales) * 10000.0 / prev.sales as bps
      from money cur join money prev
        on prev.entrepreneur_id = cur.entrepreneur_id and prev.month = (cur.month - interval '1 month')::date
     where prev.sales > 0
  ),
  mix as (
    select j.payment_method, sum(j.amount_cents) as cents, count(distinct j.entrepreneur_id) as women
      from public.journal_entries j
     where j.entrepreneur_id in (select id from consenting) and j.voided_at is null and j.kind = 'sale'
       and j.occurred_on between v_from and v_to
       and private.program_on(j.entrepreneur_id, j.occurred_on) = v_g.id
     group by 1
  )
  select jsonb_build_object(
    'campaign', jsonb_build_object('id', v_g.id, 'name', v_g.name, 'sponsor_name', v_sponsor,
                                   'is_default', v_g.is_default, 'period_start', v_g.period_start,
                                   'period_end', v_g.period_end),
    'from', v_from, 'to', v_to, 'status', 'live', 'as_of', now(),
    'min_group', 5,

    'participation', jsonb_build_object(
      'authorised', case when v_g.is_default then null else (
        select count(*) from public.program_participants p
         where p.program_id = v_g.id and p.starts_on <= v_to
           and coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date) >= v_from) end,
      'enrolled', (select count(*) from cohort),
      'started', (select count(*) from started),
      'active_7d', (select count(distinct entrepreneur_id) from days where day > v_to - 7),
      'days_recorded', (select count(*) from days),
      'quiet_days', (select count(*) from days where no_activity),
      -- An average or a median of fewer than five is one woman's habit: not shown.
      'days_per_week', (select case when (select count(*) from started) >= 5 then
                          round(count(*)::numeric / (select count(*) from started) / greatest((v_to - v_from + 1) / 7.0, 1), 1) end
                          from days),
      'median_streak', (select case when count(*) >= 5 then round(private.median(array_agg(n::numeric)), 1) end from streaks),
      'goals_set', (select count(*) from goals where status = 'set'),
      'goals_met', (select count(*) from goals where met_at is not null)
    ),

    'funnel', jsonb_build_array(
      jsonb_build_object('key', 'authorised', 'n', case when v_g.is_default then null else (
        select count(*) from public.program_participants p where p.program_id = v_g.id) end),
      jsonb_build_object('key', 'enrolled', 'n', (select count(*) from cohort)),
      jsonb_build_object('key', 'first_day', 'n', (select count(*) from started)),
      jsonb_build_object('key', 'kept_7', 'n', (select count(*) from kept where n >= 7)),
      jsonb_build_object('key', 'kept_30', 'n', (select count(*) from kept where n >= 30)),
      jsonb_build_object('key', 'kept_60', 'n', (select count(*) from kept where n >= 60))
    ),

    'weekly', (select coalesce(jsonb_agg(jsonb_build_object(
                 'week_start', w.week_start,
                 'days_recorded', (select count(*) from days d where d.day >= w.week_start and d.day < w.week_start + 7),
                 'women', (select count(distinct d.entrepreneur_id) from days d
                            where d.day >= w.week_start and d.day < w.week_start + 7)
               ) order by w.week_start), '[]'::jsonb) from weeks w),

    'reminders', jsonb_build_object(
      'sent', (select count(*) from reminders),
      'accepted', (select count(*) from reminders where outcome = 'accepted'),
      'opened', (select count(*) from reminders where opened_at is not null)
    ),

    'channels', jsonb_build_object(
      'form', (select count(*) from checkins where source = 'form'),
      'voice', (select count(*) from checkins where source = 'voice'),
      'text', (select count(*) from checkins where source = 'text'),
      'median_seconds', (select case when count(distinct entrepreneur_id) >= 5 then round(private.median(array_agg(seconds::numeric))) end
                           from checkins where seconds is not null)
    ),

    'business', jsonb_build_object(
      'consenting', (select count(*) from consenting),
      'of', (select count(*) from people),
      'well_recorded_days', 12,
      'months', (select coalesce(jsonb_agg(x order by x ->> 'month'), '[]'::jsonb) from (
        select case when count(*) >= 5 then jsonb_build_object(
                 'month', m.month, 'women', count(*), 'suppressed', false,
                 'median_sales_cents', round(private.median(array_agg(m.sales::numeric))),
                 'mean_sales_cents', round(avg(m.sales)),
                 'median_expenses_cents', round(private.median(array_agg(m.expenses::numeric))),
                 'total_sales_cents', sum(m.sales),
                 'positive_share_bps', round(count(*) filter (where m.sales > m.expenses) * 10000.0 / count(*)),
                 'median_growth_bps', (select case when count(*) >= 5 then round(private.median(array_agg(g.bps::numeric))) end
                                         from growth g where g.month = m.month),
                 'growth_women', (select count(*) from growth g where g.month = m.month))
               else jsonb_build_object('month', m.month, 'women', null, 'suppressed', true) end as x
          from money m group by m.month) months_out),
      'payment_mix', (select case when (select count(distinct j.entrepreneur_id) from public.journal_entries j
                                          where j.entrepreneur_id in (select id from consenting) and j.voided_at is null
                                            and j.kind = 'sale' and j.occurred_on between v_from and v_to
                                            and private.program_on(j.entrepreneur_id, j.occurred_on) = v_g.id) >= 5
                           then (select coalesce(jsonb_object_agg(x.payment_method, round(x.cents * 10000.0 / nullif(t.total, 0))), '{}'::jsonb)
                                   from mix x, (select sum(cents) as total from mix) t)
                      end)
    ),

    'segments', jsonb_build_object(
      'sector', private.impact_segment((select jsonb_agg(jsonb_build_object('key', coalesce(nullif(lower(btrim(p.sector)), ''), 'não informado'),
                                                                             'started', p.id in (select id from started)))
                                          from people p)),
      'state', private.impact_segment((select jsonb_agg(jsonb_build_object('key', coalesce(p.state, 'não informado'),
                                                                            'started', p.id in (select id from started)))
                                         from people p)),
      'formalization', private.impact_segment((select jsonb_agg(jsonb_build_object('key', coalesce(p.formalization, 'não informado'),
                                                                                    'started', p.id in (select id from started)))
                                                 from people p)),
      'finance_control', private.impact_segment((select jsonb_agg(jsonb_build_object('key', coalesce(p.finance_control, 'não informado'),
                                                                                      'started', p.id in (select id from started)))
                                                   from people p)),
      'age_range', private.impact_segment((select jsonb_agg(jsonb_build_object('key', coalesce(p.age_range, 'não informado'),
                                                                                'started', p.id in (select id from started)))
                                             from people p))
    )
  ) into v_out;
  return v_out;
end;
$$;
