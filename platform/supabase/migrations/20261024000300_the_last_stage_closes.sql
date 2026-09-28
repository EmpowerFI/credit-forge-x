-- The journey's last stage stops saying "instalments paid".
--
-- It said how much came back and left the reader to assume where it went. Now
-- it says what the instalment crossed back as: units returned to the treasury
-- release exactly the reais behind them, and those reais are what the investor
-- is paid out of. Without that figure the rail takes capital in and never gives
-- it back, and a local currency that only runs one way is a spending
-- restriction with extra steps rather than a loop.

create or replace function public.capital_journey(p_opportunity_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := private.my_role();
  v_partner uuid := private.my_partner_id();
  v_fx integer := private.demo_brl_per_usdc_milli();
  v_focus boolean := p_opportunity_id is not null;
  v_opp public.qualified_credit_opportunities;
  v_opps uuid[];
  v_loans uuid[];
  v_investments uuid[];
  v_positions uuid[];
  v_accounts uuid[];
  v_economies uuid[];
  v_committed bigint;
  v_disbursed bigint;
  v_circulated bigint;
begin
  if not (private.is_investor_or_overseer() or v_partner is not null or v_role = 'sponsor') then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;

  if v_focus then
    select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
    if not found then raise exception 'opportunity_not_found' using errcode = 'P0002'; end if;
    v_opps := array[v_opp.id];
  else
    select coalesce(array_agg(id), '{}') into v_opps from public.qualified_credit_opportunities;
  end if;
  select coalesce(array_agg(id), '{}') into v_loans from public.loans where opportunity_id = any (v_opps);
  select coalesce(array_agg(id), '{}') into v_investments from public.investments where opportunity_id = any (v_opps);
  select coalesce(array_agg(id), '{}') into v_positions from public.credit_positions where opportunity_id = any (v_opps);
  -- The accounts the rail credited for these loans. A purchase she makes is
  -- traceable to the capital that landed in her account; a payment between two
  -- merchants afterwards is not traceable to any one loan, because a merchant's
  -- balance is commingled the moment a second customer pays it. The stage below
  -- keeps those two apart rather than attributing the second to her.
  select coalesce(array_agg(distinct t.to_account_id), '{}') into v_accounts
    from public.local_transactions t
   where t.tx_type = 'capital_injection'
     and (not v_focus or t.opportunity_id = any (v_opps) or t.loan_id = any (v_loans));
  select coalesce(array_agg(distinct a.economy_id), '{}') into v_economies
    from public.local_accounts a where a.id = any (v_accounts);

  -- The three figures the whole screen exists to put beside each other.
  select coalesce(sum(committed_cents), 0) into v_committed from public.capital_commitments;
  select coalesce(sum(principal_cents), 0) into v_disbursed from public.loans
   where id = any (v_loans) and status in ('DISBURSED', 'ACTIVE', 'PAID');
  select coalesce(sum(private.local_units_brl_cents(t.amount_units, e.parity_bps)), 0)::bigint into v_circulated
    from public.local_transactions t join public.local_economies e on e.id = t.economy_id
   where t.tx_type in ('productive_purchase', 'merchant_payment', 'transfer')
     and (not v_focus
          or t.from_account_id = any (v_accounts) or t.to_account_id = any (v_accounts));

  return jsonb_build_object(
    'focus', case when v_focus then jsonb_build_object(
      'opportunity_id', v_opp.id,
      'code', case when v_partner is not null then private.partner_code(v_opp.entrepreneur_id)
                   else private.opportunity_code(v_opp.id) end,
      'amount_cents', v_opp.amount_cents,
      'purpose', v_opp.purpose::text,
      'status', v_opp.status::text,
      'funding_pool', v_opp.funding_pool::text) end,
    'fx_brl_per_usdc_milli', v_fx,
    -- The arc in three numbers: committed, landed, stayed. A reader who stops
    -- after the first line of this screen should still have the argument.
    'committed_cents', v_committed,
    'disbursed_cents', v_disbursed,
    'circulated_cents', v_circulated,
    'stages', jsonb_build_array(

      -- 1. The book exists. In focus, the routes this request's plan named.
      (select jsonb_build_object(
        'no', 1, 'key', 'capital_exists',
        'happened', coalesce(sum(x.capacity), 0)::bigint > 0,
        'amount_cents', coalesce(sum(x.capacity), 0)::bigint,
        'count', count(*)::int,
        'evidence', 'simulated_assumption',
        'anchors', private.anchor_tally('capital_route', null))
       from (
         select case when i.pool is null then i.capacity_cents
                     when i.pool = 'domestic' then (private.pool_book(i.pool) ->> 'capital')::bigint
                     else private.usdc_cents((private.pool_book(i.pool) ->> 'capital')::bigint, v_fx)
                end as capacity
         from public.capital_instruments i
         where i.active
           and (not v_focus or i.code in (
             select a ->> 'instrument_id'
             from (select distinct on (opportunity_id) allocations from public.capital_route_decisions
                    where opportunity_id = any (v_opps) order by opportunity_id, decision_no desc) d
             cross join lateral jsonb_array_elements(d.allocations) as t(a)))) x),

      -- 2. A business asks, and the request is qualified rather than merely made.
      (select jsonb_build_object(
        'no', 2, 'key', 'she_asks',
        'happened', count(*) > 0,
        'amount_cents', coalesce(sum(o.amount_cents), 0)::bigint,
        'count', count(*)::int,
        'evidence', 'simulated_assumption',
        'anchors', private.anchor_tally('opportunity', v_opps))
       from public.qualified_credit_opportunities o where o.id = any (v_opps)),

      -- 3. The engine routes it, domestic first and global for the residual.
      (select jsonb_build_object(
        'no', 3, 'key', 'engine_routes',
        'happened', coalesce(sum(r.cents), 0) > 0,
        'amount_cents', coalesce(sum(r.cents), 0)::bigint,
        'domestic_cents', coalesce(sum(r.cents) filter (where r.is_domestic), 0)::bigint,
        'global_cents', coalesce(sum(r.cents) filter (where not r.is_domestic), 0)::bigint,
        'count', (select count(distinct opportunity_id)::int from public.capital_route_decisions
                   where opportunity_id = any (v_opps)),
        'evidence', 'simulated_assumption',
        'anchors', private.anchor_tally('capital_route', v_opps))
       from (
         select (a ->> 'amount_cents')::bigint as cents, i.is_domestic
         from (select distinct on (opportunity_id) opportunity_id, allocations
                 from public.capital_route_decisions where opportunity_id = any (v_opps)
                order by opportunity_id, decision_no desc) d
         cross join lateral jsonb_array_elements(d.allocations) as t(a)
         join public.capital_instruments i on i.code = a ->> 'instrument_id') r),

      -- 4. Investors put up the money, each a share of one loan.
      (select jsonb_build_object(
        'no', 4, 'key', 'investors_fund',
        'happened', count(*) filter (where v.status = 'allocated') > 0,
        'amount_cents', private.usdc_cents(
          coalesce(sum(v.amount_micro_usdc) filter (where v.status = 'allocated'), 0)::bigint, v_fx),
        'micro_usdc', coalesce(sum(v.amount_micro_usdc) filter (where v.status = 'allocated'), 0)::bigint,
        'count', count(distinct v.investor_id) filter (where v.status = 'allocated')::int,
        -- A refund is not a failure of the arc; it is the arc refusing to
        -- pretend. Money that went back is reported beside money that stayed.
        'refunded_cents', private.usdc_cents(
          coalesce(sum(v.amount_micro_usdc) filter (where v.status <> 'allocated'), 0)::bigint, v_fx),
        -- coalesce, because bool_and over no rows is null and a stage with
        -- nothing in it must not fall through to the strongest label there is.
        'evidence', case when coalesce(bool_and(v.is_simulated), true) then 'simulated_assumption'
                         else 'observed_pilot_data' end,
        'anchors', private.anchor_tally('allocation', v_investments))
       from public.investments v where v.id = any (v_investments)),

      -- 5. The share becomes an asset the investor holds, on Solana.
      (select jsonb_build_object(
        'no', 5, 'key', 'position_minted',
        'happened', count(*) > 0,
        'amount_cents', private.usdc_cents(coalesce(sum(p.principal_micro_usdc), 0)::bigint, v_fx),
        'count', count(*)::int,
        -- Minting runs against devnet, so a seeded book has positions recorded
        -- and none minted. The difference is reported rather than smoothed.
        'minted', count(p.minted_at)::int,
        'evidence', case when coalesce(bool_and(p.is_simulated), true) then 'simulated_assumption'
                         else 'observed_pilot_data' end,
        'anchors', jsonb_build_object(
          'total', count(*)::int, 'confirmed', count(p.mint_signature)::int,
          'pending', (count(*) - count(p.mint_signature))::int, 'failed', count(p.mint_error)::int))
       from public.credit_positions p where p.id = any (v_positions)),

      -- 6. Dollars become reais, by the cheaper of two routes.
      (select jsonb_build_object(
        'no', 6, 'key', 'dollars_become_reais',
        'happened', count(*) > 0,
        'amount_cents', coalesce(sum(s.principal_cents), 0)::bigint,
        'count', count(*)::int,
        -- What choosing the cheaper route was worth, against the other one.
        'saved_cents', coalesce(sum(s.net_brl_delta_cents), 0)::bigint,
        'routes', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
          select selected_route::text as k, count(*)::int as n from public.settlement_decisions
           where loan_id = any (v_loans) group by 1) y),
        'evidence', 'simulated_assumption',
        'anchors', private.anchor_tally('settlement_route', v_loans))
       from public.settlement_decisions s where s.loan_id = any (v_loans)),

      -- 7. The desk formalises and pays her, by Pix.
      (select jsonb_build_object(
        'no', 7, 'key', 'disbursed',
        'happened', count(*) > 0,
        'amount_cents', coalesce(sum(l.principal_cents), 0)::bigint,
        'count', count(*)::int,
        'evidence', case when coalesce(bool_and(l.is_simulated), true) then 'simulated_assumption'
                         else 'observed_pilot_data' end,
        'anchors', private.anchor_tally('loan', v_loans))
       from public.loans l
       where l.id = any (v_loans) and l.status in ('DISBURSED', 'ACTIVE', 'PAID')),

      -- 8. And then what. The stage the rest of this product did not have.
      --
      -- Two figures, never added together into one. What she traded is the
      -- capital that landed in her account leaving it for a supplier, and
      -- coming back when a merchant buys from her: both touch the account the
      -- disbursal credited, so both are traceable to this loan. What her
      -- suppliers traded onward is not. A merchant's balance is commingled with
      -- every other customer's the moment it receives a second payment, and
      -- calling the next hop "her capital" would be the kind of attribution
      -- this product refuses everywhere else.
      (select jsonb_build_object(
        'no', 8, 'key', 'circulates',
        'happened', coalesce(sum(t.amount_units) filter (
          where t.tx_type in ('productive_purchase', 'transfer')), 0) > 0,
        'amount_cents', coalesce(sum(private.local_units_brl_cents(t.amount_units, e.parity_bps))
          filter (where t.tx_type in ('productive_purchase', 'transfer')), 0)::bigint,
        'onward_cents', coalesce(sum(private.local_units_brl_cents(t.amount_units, e.parity_bps))
          filter (where t.tx_type = 'merchant_payment'), 0)::bigint,
        'injected_cents', coalesce(sum(private.local_units_brl_cents(t.amount_units, e.parity_bps))
          filter (where t.tx_type = 'capital_injection'), 0)::bigint,
        'count', (select count(distinct a.owner_id)::int
                    from public.local_transactions t2
                    join public.local_accounts a on a.id = t2.to_account_id
                   where a.owner_type = 'merchant'
                     and (not v_focus or t2.from_account_id = any (v_accounts))),
        -- Nothing on the rail is anchored. Saying so is the point: a proof
        -- tally that quietly omitted this stage would read better and mean less.
        'evidence', (select case when count(*) filter (where evidence_status <> 'simulated_assumption') = count(*)
                                   and count(*) > 0
                                 then min(evidence_status::text) else 'simulated_assumption' end
                       from public.local_transactions),
        'anchors', jsonb_build_object('total', 0, 'confirmed', 0, 'pending', 0, 'failed', 0))
       from public.local_transactions t
       join public.local_economies e on e.id = t.economy_id
       -- Her movements, and the onward trade of the territory they happened in.
       -- The second is here to be shown beside hers, never inside her figure.
       where (not v_focus
              or t.from_account_id = any (v_accounts) or t.to_account_id = any (v_accounts)
              or (t.tx_type = 'merchant_payment' and t.economy_id = any (v_economies)))),

      -- 9. It comes back, in instalments, and the investor is repaid.
      (select jsonb_build_object(
        'no', 9, 'key', 'comes_back',
        'happened', count(*) > 0,
        'amount_cents', coalesce(sum(pm.amount_cents), 0)::bigint,
        'count', count(*)::int,
        -- Of the instalments, the ones that travelled the local rail rather
        -- than reais, which only happens where she still held the units.
        'on_the_rail', (select count(*)::int from public.local_transactions
                         where tx_type = 'repayment' and (not v_focus or loan_id = any (v_loans))),
        -- And what those instalments crossed back as: units returned to the
        -- treasury release exactly the reais behind them, and those reais are
        -- what the investor is paid out of. This is where the loop closes —
        -- without it the rail would take capital in and never give it back, and
        -- the local currency would be a spending restriction with extra steps.
        'from_the_rail_cents', (select coalesce(sum(brl_cents), 0)::bigint
                                  from public.local_conversions
                                 where direction = 'redeem'
                                   and (not v_focus or loan_id = any (v_loans))),
        'evidence', case when coalesce(bool_and(pm.is_simulated), true) then 'simulated_assumption'
                         else 'observed_pilot_data' end,
        'anchors', private.anchor_tally('payment', (
          select coalesce(array_agg(id), '{}') from public.payments where loan_id = any (v_loans))))
       from public.payments pm where pm.loan_id = any (v_loans))));
end;
$$;


comment on function public.capital_journey(uuid) is
  'The nine stages between capital committed abroad and capital circulating in a territory, and back, each read from the records that stage wrote (addendum v3 §7.3).';
