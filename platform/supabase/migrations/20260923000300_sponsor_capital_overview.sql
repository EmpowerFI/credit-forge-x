-- The Credit & Capital Engine for a sponsor (refactor spec §5, 16 Sep): a
-- sponsor drills from its programme into an opportunity and runs both engines,
-- so it reads the pools as investors do. Pool totals and the queue by Q- code:
-- the same pseudonymous figures investors see, never an investor or a position.

create or replace function public.capital_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fx integer := private.demo_brl_per_usdc_milli();
  v_d jsonb := private.pool_book('domestic');
  v_g jsonb := private.pool_book('global');
  v_d_cents bigint;
  v_g_cents bigint;
begin
  if not (private.is_investor_or_overseer() or private.my_partner_id() is not null or private.my_role() = 'sponsor') then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;
  v_d_cents := (v_d ->> 'capital')::bigint - (v_d ->> 'lent')::bigint;
  v_g_cents := private.usdc_cents((v_g ->> 'capital')::bigint - (v_g ->> 'lent')::bigint, v_fx);
  return jsonb_build_object(
    'model_version', private.allocation_model_version(),
    'fx_brl_per_usdc_milli', v_fx,
    'expected_loss_bps', jsonb_build_object('LOW', 300, 'MEDIUM', 700, 'HIGH', 1500),
    'cost_to_serve_bps', private.allocation_cost_to_serve_bps(),
    'pools', (
      select jsonb_agg(jsonb_build_object(
        'pool', p.pool, 'name', p.name, 'is_simulated', p.is_simulated,
        'policy', private.pool_policy(p.pool, 0) - 'available_cents',
        'capital_cents', case p.pool when 'domestic' then p.capital_cents else private.usdc_cents(p.capital_micro_usdc, v_fx) end,
        'capital_micro_usdc', p.capital_micro_usdc,
        'lent', b.book -> 'lent', 'claimed', b.book -> 'claimed',
        -- Not lent: what this demand can draw on.
        'liquidity_cents', case p.pool when 'domestic' then v_d_cents else v_g_cents end,
        'liquidity_micro_usdc', case p.pool when 'global' then (v_g ->> 'capital')::bigint - (v_g ->> 'lent')::bigint end
      ) order by p.pool)
      from public.funding_pools p
      cross join lateral (select case p.pool when 'domestic' then v_d else v_g end as book) b
    ),
    'coverage', private.capital_coverage(v_d_cents, v_g_cents),
    'demand', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'opportunity_id', q.id, 'code', private.opportunity_code(q.id),
        'amount_cents', q.amount_cents, 'term_months', q.term_months, 'risk_band', q.risk_band, 'purpose', q.purpose,
        'impact_eligible', true, 'funding_pool', q.funding_pool, 'funding_status', q.funding_status,
        'reason_codes', to_jsonb(q.allocation_reason_codes)
      ) order by q.created_at, q.id), '[]')
      from public.qualified_credit_opportunities q
      where q.allocation is not null
        and q.status in ('open', 'referred', 'partner_approved')
        and coalesce(q.funding_status::text, 'waiting') in ('waiting', 'open', 'partially_funded', 'funded')
        and not exists (select 1 from public.loans l where l.opportunity_id = q.id and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED'))
    )
  );
end;
$$;
