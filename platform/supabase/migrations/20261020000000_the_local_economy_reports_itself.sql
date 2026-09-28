-- The Local Economy Dashboard, derived from the ledger and from nothing else.
--
-- The rail moves units and the addendum asks four questions of it (v3 §7.2,
-- §8): how much more activity did each unit of capital produce, how much of it
-- stayed inside the territory, how fast did it move, and how much of it came
-- from abroad at all. Every one of those is arithmetic over local_transactions.
-- §12 forbids a presentation value, so there is no constant in this file: if
-- the seed recorded a shorter loop the numbers come out smaller, and the screen
-- reports the smaller numbers.
--
-- What each figure counts, and why the boundaries are drawn where they are:
--
--   Capital injected. The principal of the loans that landed here, as units.
--   The denominator of everything else.
--
--   Local circulation. Purchases, payments between merchants, and sales back to
--   her — movements between participants inside the territory. It deliberately
--   excludes redemption, which is capital leaving the rail, and repayment,
--   which returns it to the issuer. Counting a redemption as circulation would
--   inflate the multiplier with the exact movement that is leakage, which is
--   the easiest number to flatter and the first one a reader should distrust.
--
--   The multiplier is circulation over injection. Under 1.0 means the capital
--   has not finished moving, which is an ordinary state and not a failure; the
--   screen says so rather than hiding a number below a target.
--
--   Retention is what has not been taken off the rail for reais, over what was
--   put on it. Redemption is the only way out, so this is one minus leakage.
--
--   Velocity is circulation over the units still in circulation — the ordinary
--   V = T / M, with M read at this instant rather than averaged over a period,
--   because the demo's ledger is hours old and an average over hours would be
--   a more complicated way of saying the same thing. The screen states it.
--
--   Additionality is the share of the injected capital whose loan was funded
--   from abroad (v3 §8). It is the one figure here that reaches outside the
--   rail, because the question it answers — would this capital have arrived
--   without the global route — cannot be read from local movements alone.
--
-- Conservation travels with the numbers. Every balance in an economy sums to
-- zero by construction, and the payload carries that check so a reader does not
-- have to take the arithmetic on trust.

-- Who may read an economy. The same reach as the row-level policy on
-- local_economies: a reader who could list the rows may total them.
create function private.may_read_local_economy(p_economy_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.local_economies e
    where e.id = p_economy_id
      and (private.is_auditor_or_admin()
           or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
           or (e.community_id is not null
               and (private.leads_community(e.community_id) or private.is_member(e.community_id)))))
$$;

-- The economies this caller may open, oldest first. A territory with no rail
-- simply is not here, which is the honest shape: four communities are seeded
-- and one has an economy, so a reader can put a territory with a rail beside a
-- territory without one.
create function public.local_economies_listed()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'code', e.code,
    'name', e.name,
    'territory', e.territory,
    'uf', e.uf,
    'community_id', e.community_id,
    'currency_code', e.currency_code,
    'parity_bps', e.parity_bps,
    'parity_reference', e.parity_reference,
    'is_simulated', e.is_simulated,
    'movements', (select count(*)::int from public.local_transactions t where t.economy_id = e.id))
    order by e.created_at), '[]'::jsonb)
  from public.local_economies e
  where private.may_read_local_economy(e.id)
$$;

create function public.local_economy_dashboard(p_economy_id uuid default null)
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
  -- No rail anywhere, or none the caller may open. Not an error: most
  -- territories in this product have no local economy, and the screen says that
  -- rather than failing.
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
        coalesce(sum(amount_units) filter (where tx_type = 'capital_injection'), 0)::bigint as injected,
        -- Movements between participants inside the territory. Redemption and
        -- repayment are both exits, in opposite directions, and neither is
        -- local activity.
        coalesce(sum(amount_units) filter (
          where tx_type in ('productive_purchase', 'merchant_payment', 'transfer')), 0)::bigint as circulated,
        coalesce(sum(amount_units) filter (where tx_type = 'repayment'), 0)::bigint as repaid,
        coalesce(sum(amount_units) filter (where tx_type = 'redemption'), 0)::bigint as redeemed,
        count(*)::int as movements,
        min(occurred_at) as first_at,
        max(occurred_at) as last_at
      from mv
    ),
    -- Units still on the rail: what was injected, less what left through a
    -- redemption and what returned to the treasury as a repayment. pgTAP holds
    -- this equal to the sum of every balance the accounts actually carry.
    money_supply as (
      select s.injected - s.redeemed - s.repaid as circulating from sums s
    ),
    -- Where the capital came from, for the loans that landed here (v3 §8).
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
        -- A merchant that both took units in and sent them on. The second hop
        -- is what makes a multiplier more than an accounting identity.
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
    -- Every movement the ledger knows, by kind. Zero rows for a kind that has
    -- not happened stay absent rather than being invented as a zero: a reader
    -- should see which of the six the demo has actually exercised.
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
        -- Merchants are named: they are businesses in a network and the table
        -- carries no person. The other side is a business on the rail and is
        -- not named here, because a movement is not the place to publish whose.
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
      -- An aggregate is only as strong as its weakest row, so one simulated
      -- movement makes the whole total a simulated assumption (v3 §9).
      'evidence_status', (
        select case when count(*) filter (where evidence_status = 'simulated_assumption') > 0
                      or count(*) = 0
                    then 'simulated_assumption'
                    when count(distinct evidence_status) = 1
                    then min(evidence_status::text)
                    else 'simulated_assumption' end
        from mv),
      'injected_units', (select injected from sums),
      'injected_brl_cents', private.local_units_brl_cents((select injected from sums), v_economy.parity_bps),
      'circulated_units', (select circulated from sums),
      'circulated_brl_cents', private.local_units_brl_cents((select circulated from sums), v_economy.parity_bps),
      'repaid_units', (select repaid from sums),
      'redeemed_units', (select redeemed from sums),
      'redeemed_brl_cents', private.local_units_brl_cents((select redeemed from sums), v_economy.parity_bps),
      'circulating_units', (select circulating from money_supply),
      'movements', (select movements from sums),
      'first_movement_at', (select first_at from sums),
      'last_movement_at', (select last_at from sums),
      -- Local Capital Multiplier: circulation produced per unit injected.
      'multiplier_bps', (select case when s.injected > 0
                                then round(s.circulated * 10000.0 / s.injected)::integer else 0 end from sums s),
      -- What has not been taken off the rail for reais.
      'retention_bps', (select case when s.injected > 0
                                then greatest(0, round((s.injected - s.redeemed) * 10000.0 / s.injected))::integer
                                else 0 end from sums s),
      -- Turns of the units still in circulation.
      'velocity_bps', (select case when m.circulating > 0
                               then round(s.circulated * 10000.0 / m.circulating)::integer else 0 end
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
      -- The ledger proving itself: every balance sums to zero, and what the
      -- treasury is short by is exactly what is circulating.
      'conserved', (select total = 0 from balances),
      'supply_matches_balances', (select b.held = m.circulating from balances b, money_supply m),
      'by_type', (select rows from by_type),
      'recent', (select rows from recent)));
end;
$$;

comment on function public.local_economy_dashboard(uuid) is
  'Multiplier, retention, velocity and additionality for one local economy, derived from local_transactions and from no stored figure (addendum v3 §7.2, §8, §12).';

revoke all on function private.may_read_local_economy(uuid) from public, anon, authenticated;
grant execute on function private.may_read_local_economy(uuid) to service_role;

revoke all on function public.local_economies_listed(), public.local_economy_dashboard(uuid) from public, anon;
grant execute on function public.local_economies_listed(), public.local_economy_dashboard(uuid) to authenticated, service_role;
