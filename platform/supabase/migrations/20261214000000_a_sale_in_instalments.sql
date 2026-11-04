-- A sale in instalments.
--
-- "Vendi R$ 600 em 3x no cartão": the same as a purchase in instalments
-- (20261122), from the other side. One sale, one line, counted whole on the
-- day she made it; what is still to receive ("a receber") follows the
-- instalments, each due a month after the one before, the cents that do not
-- divide evenly in the first. A sale received later in one go stays as it
-- was: one instalment, due on its day.

alter table public.journal_entries
  drop constraint only_a_later_expense_is_in_instalments,
  add constraint only_a_later_line_is_in_instalments
    check (installments = 1 or due_on is not null);

create or replace function public.journal_dre(p_entrepreneur_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with lines as (
    select e.*, private.journal_group(e.category) as grp
      from public.journal_entries e
     where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on between p_from and p_to
       and e.voided_at is null
  ),
  sums as (
    select
      coalesce(sum(amount_cents) filter (where kind = 'sale'), 0)                         as revenue,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'pix'), 0)         as rev_pix,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'cash'), 0)        as rev_cash,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'debit_card'), 0)  as rev_debit,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'credit_card'), 0) as rev_credit,
      coalesce(sum(amount_cents) filter (where kind = 'sale' and payment_method = 'fiado'), 0)       as rev_fiado,
      coalesce(sum(amount_cents) filter (where grp = 'cogs'), 0)       as cogs,
      coalesce(sum(amount_cents) filter (where grp = 'opex'), 0)       as opex,
      coalesce(sum(amount_cents) filter (where grp = 'staff'), 0)      as staff,
      coalesce(sum(amount_cents) filter (where grp = 'withdrawal'), 0) as withdrawals,
      coalesce(sum(amount_cents) filter (where grp = 'investment'), 0) as investment,
      coalesce(sum(amount_cents) filter (where grp = 'financing'), 0)  as financing,
      coalesce(sum(amount_cents) filter (where category = 'fees'), 0)  as fees,
      count(distinct occurred_on) filter (where kind = 'sale')         as selling_days
    from lines
  ),
  days as (
    select count(*) as filled, count(*) filter (where no_activity) as quiet,
           count(*) filter (where no_activity and quiet_reason = 'closed') as closed
      from public.journal_days
     where entrepreneur_id = p_entrepreneur_id and day between p_from and p_to
  ),
  open_items as (
    select
      -- A sale or an expense in instalments is settled instalment by
      -- instalment: what falls due after the end of the range is still to
      -- receive, or to pay.
      coalesce((select sum(i.amount_cents) from public.journal_entries e
                 cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
                 where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on <= p_to and e.due_on is not null
                   and e.voided_at is null and e.kind = 'sale' and i.due_on > p_to), 0) as receivable,
      coalesce((select sum(i.amount_cents) from public.journal_entries e
                 cross join lateral private.journal_instalments(e.amount_cents, e.installments, e.due_on) i
                 where e.entrepreneur_id = p_entrepreneur_id and e.occurred_on <= p_to and e.due_on is not null
                   and e.voided_at is null and e.kind = 'expense' and i.due_on > p_to), 0) as payable
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'days', p_to - p_from + 1,
    'days_filled', d.filled,
    'days_no_activity', d.quiet,
    -- Of those, the days she said the business did not open.
    'days_closed', d.closed,
    'selling_days', s.selling_days,
    'revenue_cents', s.revenue,
    'revenue_by_method', jsonb_build_object(
      'pix', s.rev_pix, 'cash', s.rev_cash, 'debit_card', s.rev_debit,
      'credit_card', s.rev_credit, 'fiado', s.rev_fiado),
    'cogs_cents', s.cogs,
    'gross_result_cents', s.revenue - s.cogs,
    'opex_cents', s.opex,
    'staff_cents', s.staff,
    'result_cents', s.revenue - s.cogs - s.opex - s.staff,
    'withdrawals_cents', s.withdrawals,
    'retained_cents', s.revenue - s.cogs - s.opex - s.staff - s.withdrawals,
    'investment_cents', s.investment,
    'financing_cents', s.financing,
    'receivable_cents', o.receivable,
    'payable_cents', o.payable,
    'card_sales_cents', s.rev_debit + s.rev_credit,
    'card_fees_cents', s.fees
  )
  from sums s, days d, open_items o
$$;
