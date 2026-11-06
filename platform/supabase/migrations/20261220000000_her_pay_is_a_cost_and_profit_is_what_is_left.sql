-- Her pay is a cost, and profit is what is left.
--
-- She is an MEI, and "pró-labore" means nothing to her. What she knows is how
-- much she needs to get through the month (20261219), and that is her pay:
-- the business has to earn it like any other cost. So the month costs her
-- business expenses plus that amount, and there is profit only in what the
-- sales leave after both.
--
-- The diary shows it day by day: each open day carries its share of her pay
-- (what she needs, split over the days her business opens that month). This
-- migration gives the weekly reading the same share, and the same expenses
-- the diary counts (equipment and loan instalments included), so the
-- reading and the screen speak of one profit.

/**
 * Her pay over a span of days: on each day her business opens, the month's
 * need divided by that month's open days. Null when she has not said it.
 */
create function private.pay_share(p_entrepreneur_id uuid, p_from date, p_to date)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select case when e.monthly_need_cents is null then null else coalesce(round(sum(
           e.monthly_need_cents::numeric / (
             select count(*) from generate_series(date_trunc('month', g)::date,
                                                  (date_trunc('month', g) + interval '1 month - 1 day')::date,
                                                  interval '1 day') m
              where private.opens_on(e.open_days, m::date))
         ) filter (where private.opens_on(e.open_days, g::date)))::bigint, 0) end
    from public.entrepreneurs e
    cross join generate_series(p_from, p_to, interval '1 day') g
   where e.id = p_entrepreneur_id
   group by e.monthly_need_cents
$$;

create or replace function private.journal_week_figures(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'period', to_char(p_week_start, 'YYYY-MM-DD'),
    'revenue_cents', (d ->> 'revenue_cents')::bigint,
    'cogs_cents', (d ->> 'cogs_cents')::bigint,
    -- Every expense of the business, as the diary counts it: running costs,
    -- staff, equipment and loan instalments.
    'opex_cents', (d ->> 'opex_cents')::bigint + (d ->> 'staff_cents')::bigint
                  + (d ->> 'investment_cents')::bigint + (d ->> 'financing_cents')::bigint,
    'household_cents', (d ->> 'withdrawals_cents')::bigint,
    -- A week kept day by day is a week of records.
    'keeps_records', true,
    'active_days', (d ->> 'selling_days')::integer,
    -- The days a week her business opens: the week's base, not seven.
    'open_days', private.open_days_count(p_entrepreneur_id),
    -- Her pay for the week, a cost like the others. Null until she says what she needs.
    'pay_cents', private.pay_share(p_entrepreneur_id, p_week_start, p_week_start + 6),
    'days_filled', (d ->> 'days_filled')::integer
  )
  from (select public.journal_dre(p_entrepreneur_id, p_week_start, p_week_start + 6) as d) x
$$;

revoke execute on function private.pay_share(uuid, date, date) from public, anon, authenticated;
