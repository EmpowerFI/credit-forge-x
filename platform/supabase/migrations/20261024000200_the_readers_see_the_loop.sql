-- The readers see the loop close.
--
-- The crossings exist; these are the screens that have to show them, or the
-- rail goes on reading as a ledger beside the money rather than the path the
-- money takes. The Local Economy gains the backing — what the units are a claim
-- on, and whether they are covered — and the crossings themselves.

create or replace function public.local_economy_dashboard(p_economy_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_economy public.local_economies;
begin
  if p_economy_id is not null then
    select * into v_economy from public.local_economies where id = p_economy_id;
  else
    -- The oldest rail this caller may open, not the oldest rail: a reader who
    -- may see one economy and not another should land on the one that is hers.
    select * into v_economy from public.local_economies
     where private.may_read_local_economy(id) order by created_at limit 1;
  end if;
  if v_economy.id is null then return null; end if;
  if not private.may_read_local_economy(v_economy.id) then
    raise exception 'not_allowed_to_see_this_local_economy' using errcode = '42501';
  end if;

  return (
    with mv as (
      select * from public.local_transactions where economy_id = v_economy.id
    ),
    sums as (
      select
        -- LM3's three rounds. Round one is the capital that entered the
        -- territory; round two is what she spent inside it; round three is what
        -- those merchants spent locally in turn, including back to her.
        coalesce(sum(amount_units) filter (where tx_type = 'capital_injection'), 0)::bigint as r1,
        coalesce(sum(amount_units) filter (where tx_type = 'productive_purchase'), 0)::bigint as r2,
        coalesce(sum(amount_units) filter (where tx_type in ('merchant_payment', 'transfer')), 0)::bigint as r3,
        coalesce(sum(amount_units) filter (where tx_type = 'repayment'), 0)::bigint as repaid,
        coalesce(sum(amount_units) filter (where tx_type = 'redemption'), 0)::bigint as redeemed,
        count(*)::int as movements,
        min(occurred_at) as first_at,
        max(occurred_at) as last_at
      from mv
    ),
    money_supply as (
      select s.r1 - s.redeemed - s.repaid as circulating from sums s
    ),
    additionality as (
      select
        coalesce(sum(t.amount_units) filter (where o.funding_pool = 'global'), 0)::bigint as global_units,
        coalesce(sum(t.amount_units), 0)::bigint as traced_units,
        count(*)::int as loans
      from mv t
      join public.loans l on l.id = t.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where t.tx_type = 'capital_injection'
    ),
    reach as (
      select
        (select count(distinct a.owner_id)::int
           from mv t join public.local_accounts a on a.id = t.to_account_id
          where a.owner_type = 'merchant') as merchants_paid,
        (select count(*)::int from (
           select a.owner_id from mv t join public.local_accounts a on a.id = t.from_account_id
            where a.owner_type = 'merchant'
              and t.tx_type in ('merchant_payment', 'transfer')
            group by a.owner_id) x) as merchants_spent_onward,
        (select count(distinct a.owner_id)::int
           from mv t join public.local_accounts a on a.id = t.to_account_id
          where a.owner_type = 'entrepreneur' and t.tx_type = 'capital_injection') as businesses_funded
    ),
    balances as (
      select
        coalesce(sum(balance_units), 0)::bigint as total,
        coalesce(sum(balance_units) filter (where owner_type <> 'treasury' and balance_units > 0), 0)::bigint as held,
        count(*)::int as accounts
      from public.local_accounts where economy_id = v_economy.id
    ),
    by_type as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tx_type', x.tx_type, 'movements', x.movements, 'units', x.units)
        order by x.units desc), '[]'::jsonb) as rows
      from (select tx_type::text as tx_type, count(*)::int as movements, sum(amount_units)::bigint as units
              from mv group by tx_type) x
    ),
    recent as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'transaction_no', r.transaction_no, 'tx_type', r.tx_type,
        'amount_units', r.amount_units, 'occurred_at', r.occurred_at,
        'from_owner_type', r.from_owner_type, 'to_owner_type', r.to_owner_type,
        'from_name', r.from_name, 'to_name', r.to_name, 'note', r.note)
        order by r.transaction_no desc), '[]'::jsonb) as rows
      from (
        select t.id, t.transaction_no, t.tx_type::text as tx_type, t.amount_units, t.occurred_at, t.note,
               fa.owner_type::text as from_owner_type, ta.owner_type::text as to_owner_type,
               fm.name as from_name, tm.name as to_name
        from mv t
        join public.local_accounts fa on fa.id = t.from_account_id
        join public.local_accounts ta on ta.id = t.to_account_id
        left join public.local_merchants fm on fm.id = fa.owner_id and fa.owner_type = 'merchant'
        left join public.local_merchants tm on tm.id = ta.owner_id and ta.owner_type = 'merchant'
        order by t.transaction_no desc limit 12) r
    )
    select jsonb_build_object(
      'economy', jsonb_build_object(
        'id', v_economy.id, 'code', v_economy.code, 'name', v_economy.name,
        'territory', v_economy.territory, 'uf', v_economy.uf,
        'community_id', v_economy.community_id,
        'currency_code', v_economy.currency_code,
        'parity_bps', v_economy.parity_bps, 'parity_reference', v_economy.parity_reference,
        'is_simulated', v_economy.is_simulated),
      'model_version', private.local_rail_model_version(),
      'measure', 'LM3 (New Economics Foundation)',
      'evidence_status', (
        select case when count(*) filter (where evidence_status = 'simulated_assumption') > 0
                      or count(*) = 0
                    then 'simulated_assumption'
                    when count(distinct evidence_status) = 1
                    then min(evidence_status::text)
                    else 'simulated_assumption' end
        from mv),
      -- The three rounds, published beside the ratio they make, so the division
      -- can be done by hand against the ledger below it.
      'round_1_units', (select r1 from sums),
      'round_2_units', (select r2 from sums),
      'round_3_units', (select r3 from sums),
      'injected_units', (select r1 from sums),
      'injected_brl_cents', private.local_units_brl_cents((select r1 from sums), v_economy.parity_bps),
      'circulated_units', (select r2 + r3 from sums),
      'circulated_brl_cents', private.local_units_brl_cents((select r2 + r3 from sums), v_economy.parity_bps),
      'repaid_units', (select repaid from sums),
      'redeemed_units', (select redeemed from sums),
      'redeemed_brl_cents', private.local_units_brl_cents((select redeemed from sums), v_economy.parity_bps),
      'circulating_units', (select circulating from money_supply),
      'movements', (select movements from sums),
      'first_movement_at', (select first_at from sums),
      'last_movement_at', (select last_at from sums),
      -- LM3: all three rounds over the first. One when nothing has moved, and
      -- three at the ceiling the method itself imposes.
      'lm3_bps', (select case when s.r1 > 0
                          then round((s.r1 + s.r2 + s.r3) * 10000.0 / s.r1)::integer else 0 end from sums s),
      'retention_bps', (select case when s.r1 > 0
                                then greatest(0, round((s.r1 - s.redeemed) * 10000.0 / s.r1))::integer
                                else 0 end from sums s),
      'velocity_bps', (select case when m.circulating > 0
                               then round((s.r2 + s.r3) * 10000.0 / m.circulating)::integer else 0 end
                         from sums s, money_supply m),
      'additionality_bps', (select case when a.traced_units > 0
                                   then round(a.global_units * 10000.0 / a.traced_units)::integer else 0 end
                              from additionality a),
      'global_injected_units', (select global_units from additionality),
      'loans_landed', (select loans from additionality),
      'merchants_total', (select count(*)::int from public.local_merchants where economy_id = v_economy.id),
      'merchants_eligible', (select count(*)::int from public.local_merchants
                              where economy_id = v_economy.id and eligible),
      'merchants_paid', (select merchants_paid from reach),
      'merchants_spent_onward', (select merchants_spent_onward from reach),
      'businesses_funded', (select businesses_funded from reach),
      'redemptions', (select count(*)::int from public.local_redemptions where economy_id = v_economy.id),
      'accounts', (select accounts from balances),
      'units_held', (select held from balances),
      'conserved', (select total = 0 from balances),
      'supply_matches_balances', (select b.held = m.circulating from balances b, money_supply m),
      -- What this is being compared against, carried with the figures so a
      -- screen cannot show the flattering number alone.
      'benchmarks', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', r.key, 'label', r.label, 'value_bps', r.value_bps,
          'value_cents', r.value_cents, 'value_count', r.value_count,
          'source', r.source, 'source_url', r.source_url,
          'observed_period', r.observed_period, 'note', r.note,
          'evidence_status', r.evidence_status) order by r.key), '[]'::jsonb)
        from public.reference_points r
        where r.key in ('mumbuca_retention', 'mumbuca_users', 'lm3_ceiling')),
      -- What the units are a claim on. Issue put reais in, a repayment released
      -- them to the investor, a merchant cashing out took them for itself — and
      -- whether what is left covers what is circulating is the answer to the
      -- accusation any local currency has to face, done by subtraction.
      'backing', private.local_backing(v_economy.id),
      -- The two crossings of the border, in the order they happened.
      'crossings', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'direction', c.direction, 'units', c.units, 'brl_cents', c.brl_cents,
          'parity_bps', c.parity_bps, 'note', c.note, 'occurred_at', c.occurred_at,
          'evidence_status', c.evidence_status) order by c.occurred_at desc, c.id), '[]'::jsonb)
        from public.local_conversions c where c.economy_id = v_economy.id),
      'by_type', (select rows from by_type),
      'recent', (select rows from recent)));
end;
$$;


comment on function public.local_economy_dashboard(uuid) is
  'LM3, retention, velocity, additionality and the reais the units are a claim on, all derived from the rail''s own rows (addendum v3 §7.2, §8, §12).';
