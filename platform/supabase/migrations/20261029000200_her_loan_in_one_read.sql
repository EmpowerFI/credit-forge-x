-- Her loan, as she needs to see it.
--
-- Everything on this screen is already readable by her — RLS lets a borrower
-- see her own loan, her own payments and her own local account — but only as
-- four joins she would have to make in a browser, and three of the figures that
-- matter are arithmetic rather than columns: what she still owes, what an
-- instalment is worth in local units at this economy's parity, and what those
-- reais become in dollars at the rate her own request struck.
--
-- One read, one shape. The screen then has nothing to compute and nothing to
-- get wrong, and the parity and the rate are applied in the one place that
-- knows them.
--
-- Null when she has no loan, which is most participants most of the time.

create function public.my_loan()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with l as (
    select loans.*, o.fx_brl_per_usdc_milli, o.purpose
    from public.loans
    join public.qualified_credit_opportunities o on o.id = loans.opportunity_id
    where loans.entrepreneur_id = private.my_entrepreneur_id()
    order by loans.created_at desc limit 1
  ),
  -- The economy this loan landed on, if it landed on one at all. Read from the
  -- injection rather than from her community: a loan disbursed before a rail
  -- existed did not travel on it, and saying otherwise would draw a hop the
  -- ledger never made.
  e as (
    select ec.* from l
    join public.local_transactions t on t.loan_id = l.id and t.tx_type = 'capital_injection'
    join public.local_economies ec on ec.id = t.economy_id
    limit 1
  ),
  paid as (select count(*)::integer as n from public.payments p, l where p.loan_id = l.id)
  select case when l.id is null then null else jsonb_build_object(
    'loan_id', l.id,
    'status', l.status,
    'purpose', l.purpose,
    'principal_cents', l.principal_cents,
    'term_months', l.term_months,
    'instalment_cents', l.instalment_cents,
    'paid', paid.n,
    'next_no', case when paid.n < l.term_months then paid.n + 1 end,
    'left_cents', (l.term_months - paid.n)::bigint * l.instalment_cents,
    'disbursed_at', private.iso(l.disbursed_at),
    -- What one instalment is on the way out: reais, and the dollars they buy
    -- back at the rate this request struck rather than the book's average.
    'fx_brl_per_usdc_milli', l.fx_brl_per_usdc_milli,
    'instalment_micro_usdc', case when coalesce(l.fx_brl_per_usdc_milli, 0) > 0
      then (l.instalment_cents::numeric * 10000000 / l.fx_brl_per_usdc_milli)::bigint end,
    'local', case when e.id is null then null else jsonb_build_object(
      'economy', e.name,
      'currency', e.currency_code,
      'balance_units', coalesce((select a.balance_units from public.local_accounts a
        where a.economy_id = e.id and a.owner_type = 'entrepreneur'
          and a.owner_id = private.my_entrepreneur_id()), 0),
      'instalment_units', private.local_units_from_brl_cents(l.instalment_cents, e.parity_bps)) end,
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'no', p.instalment_no, 'amount_cents', p.amount_cents, 'paid_at', private.iso(p.paid_at),
        -- Whether that instalment travelled the rail. The two she paid before
        -- the rail existed did not, and the screen says so rather than
        -- implying every instalment took the same road.
        'on_the_rail', exists (select 1 from public.local_transactions t
          where t.loan_id = l.id and t.tx_type = 'repayment'
            and t.occurred_at between p.paid_at - interval '1 minute' and p.paid_at + interval '1 minute'))
        order by p.instalment_no)
      from public.payments p where p.loan_id = l.id), '[]'))
  end
  from l right join paid on true left join e on true;
$$;

revoke all on function public.my_loan() from public, anon;
grant execute on function public.my_loan() to authenticated;
