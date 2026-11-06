-- What she needs to get through the month.
--
-- "Quanto você precisa para passar o mês?" is her pay -- the pró-labore --
-- and the business has to earn it: it is part of what the business costs.
-- She says the amount once (and changes it when she likes), and the diary
-- shows the month's profit against it, the break-even she is walking
-- towards.
--
-- Profit, as the diary says it to her, is her sales less the business's
-- expenses. What she takes home ("Retirada para casa") is not an expense of
-- the business: it is the pay that comes out of the profit, so it is
-- reported beside it, never subtracted from it. Equipment and loan
-- instalments are money the business paid, so here they count against the
-- profit: the question is whether the month pays for itself and for her.

alter table public.entrepreneurs
  add column monthly_need_cents bigint
    constraint monthly_need_is_sane check (monthly_need_cents is null or monthly_need_cents between 100 and 100000000);

-- Her answer, from the diary; null clears it.
create function public.diary_monthly_need_set(p_cents bigint)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  if p_cents is not null and p_cents not between 100 and 100000000 then
    raise exception 'monthly_need_out_of_range' using errcode = '22023';
  end if;
  update public.entrepreneurs set monthly_need_cents = p_cents where id = v_me;
  return p_cents;
end $$;

-- The month so far, from its first day to today: sales, the business's
-- expenses, what she took home, the profit, the days kept, and what she
-- needs. Struck-through lines do not count.
create function public.diary_month()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select private.diary_me() as id),
  span as (select date_trunc('month', private.sp_today())::date as first, private.sp_today() as today),
  lines as (
    select e.kind, e.category, e.amount_cents
      from public.journal_entries e, me, span
     where e.entrepreneur_id = me.id and e.voided_at is null
       and e.occurred_on between span.first and span.today
  ),
  sums as (
    select coalesce(sum(amount_cents) filter (where kind = 'sale'), 0) as sales,
           coalesce(sum(amount_cents) filter (where kind = 'expense' and category is distinct from 'withdrawal'), 0) as expenses,
           coalesce(sum(amount_cents) filter (where kind = 'expense' and category = 'withdrawal'), 0) as taken_home
      from lines
  )
  select jsonb_build_object(
    'period', to_char(span.first, 'YYYY-MM'),
    'first_day', span.first,
    'today', span.today,
    'sales_cents', s.sales,
    'expenses_cents', s.expenses,
    'profit_cents', s.sales - s.expenses,
    'taken_home_cents', s.taken_home,
    'days_kept', (select count(*) from public.journal_days d, me
                   where d.entrepreneur_id = me.id and d.day between span.first and span.today),
    'monthly_need_cents', (select e.monthly_need_cents from public.entrepreneurs e, me where e.id = me.id)
  )
  from sums s, span
$$;

revoke execute on function public.diary_monthly_need_set(bigint), public.diary_month() from public, anon;
grant execute on function public.diary_monthly_need_set(bigint), public.diary_month() to authenticated, service_role;
