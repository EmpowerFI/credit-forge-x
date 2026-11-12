-- Her week, read as advice.
--
-- Founder's request, 12/11/2026: the weekly reading becomes advice in the
-- manner of a small-business adviser (as Sebrae gives it): it weighs what she
-- sells and the week's figures, praises what she did well, says where she can
-- improve, and gives one tip -- short, warm and plain. To do that the model now
-- also sees where the week's money came from (sales by how she was paid) and
-- where it went (expenses by category), and how many days she recorded. Only
-- figures; nothing about who she is.

create or replace function public.journal_reading_inputs(p_entrepreneur_id uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_e public.entrepreneurs%rowtype;
  v_cur jsonb;
  v_prev jsonb;
  -- A week is compared with the one before when each kept all but one of its open days.
  v_full integer;
begin
  select * into v_e from public.entrepreneurs where id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;
  v_full := greatest(1, cardinality(v_e.open_days) - 1);
  v_cur := private.journal_week_figures(p_entrepreneur_id, p_week_start);
  v_prev := private.journal_week_figures(p_entrepreneur_id, p_week_start - 7);
  return jsonb_build_object(
    'first_name', split_part(coalesce(v_e.display_name, ''), ' ', 1),
    'sector', v_e.business_sector,
    -- Off: the fixed-sentence reading, and nothing sent to the model.
    'ai_reading', v_e.ai_reading,
    'current', v_cur - 'days_filled',
    -- How closely she kept the journal: days kept in the thirty ending on
    -- the week's Sunday, out of the days she opened in them -- or since she
    -- started, if that is fewer. Said to her by code, never by the model.
    'coverage', (
      select jsonb_build_object(
        'kept', (select count(*) from public.journal_days j
                  where j.entrepreneur_id = p_entrepreneur_id
                    and j.day between greatest(p_week_start + 6 - 29, s.first) and p_week_start + 6),
        'days', (select count(*) from generate_series(greatest(p_week_start + 6 - 29, s.first), p_week_start + 6, interval '1 day') g
                  where private.opens_on(v_e.open_days, g::date)))
        from (select min(j.day) as first from public.journal_days j
               where j.entrepreneur_id = p_entrepreneur_id and j.day <= p_week_start + 6) s
       where s.first is not null),
    -- Where the week's money came from and went, for the advice: sales by how
    -- she was paid, expenses by category (withdrawals apart), and the days she
    -- recorded. Counted as the diary counts money (journal_cash).
    'detail', jsonb_build_object(
      'days_recorded', (select count(*) from public.journal_days j
                         where j.entrepreneur_id = p_entrepreneur_id and j.day between p_week_start and p_week_start + 6),
      'sales_by_method', coalesce((
        select jsonb_object_agg(x.payment_method, x.cents)
          from (select e.payment_method, sum(c.amount) as cents
                  from (select e.id, e.amount_cents as amount from public.journal_entries e
                         where e.entrepreneur_id = p_entrepreneur_id and e.voided_at is null and e.kind = 'sale'
                           and e.due_on is null and e.occurred_on between p_week_start and p_week_start + 6
                        union all
                        select e.id, i.amount_cents from public.journal_entries e
                         cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
                         where e.entrepreneur_id = p_entrepreneur_id and e.voided_at is null and e.kind = 'sale'
                           and e.due_on is not null and i.due_on between p_week_start and p_week_start + 6) c
                  join public.journal_entries e on e.id = c.id
                 group by e.payment_method) x), '{}'::jsonb),
      'expenses_by_category', coalesce((
        select jsonb_agg(jsonb_build_object('category', x.category, 'cents', x.cents) order by x.cents desc)
          from (select c.category, sum(c.amount_cents) as cents
                  from private.journal_cash(p_entrepreneur_id, p_week_start, p_week_start + 6) c
                 where c.kind = 'expense' and c.category is distinct from 'withdrawal'
                 group by c.category) x), '[]'::jsonb)
    ),
    'previous', case when (v_prev ->> 'days_filled')::integer >= v_full and (v_cur ->> 'days_filled')::integer >= v_full
                     then v_prev - 'days_filled' end
  );
end;
$$;
