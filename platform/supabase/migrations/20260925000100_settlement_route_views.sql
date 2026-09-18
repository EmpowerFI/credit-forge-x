-- What the settlement routing experiment adds to what was already read: the
-- route a position's capital took, with both quotes beside it, and how much
-- each route has settled. Read-only, and empty until a global loan is
-- disbursed with the experiment on.

create or replace function public.settlement_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_investor_or_overseer() then
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'fx_brl_per_usdc_milli', private.demo_brl_per_usdc_milli(),
    'ramp_bps', private.ramp_bps(),
    'vault', private.vault_ledger(),
    'pix', (select jsonb_build_object(
        'payouts', count(*) filter (where kind = 'pix_payout'),
        'payout_cents', coalesce(sum(amount_cents) filter (where kind = 'pix_payout'), 0),
        'ins', count(*) filter (where kind = 'pix_in'),
        'in_cents', coalesce(sum(amount_cents) filter (where kind = 'pix_in'), 0))
      from public.settlement_legs),
    'legs', (select jsonb_object_agg(k, n) from (
        select kind::text || ':' || status::text k, count(*) n from public.settlement_legs
        where kind in ('release', 'payout') group by kind, status) s),
    'transfers', coalesce((
      select jsonb_agg(x order by x->>'id' desc) from (
        select jsonb_build_object('id', t.id, 'kind', t.kind, 'status', t.status, 'signature', t.signature,
          'inflow_micro_usdc', t.inflow_micro_usdc, 'outflow_micro_usdc', t.outflow_micro_usdc,
          'legs', (select count(*) from public.settlement_legs l where l.transfer_id = t.id),
          'at', private.iso(coalesce(t.confirmed_at, t.created_at))) x
        from public.vault_transfers t order by t.id desc limit 10
      ) y
    ), '[]'),
    'experiment', private.settlement_experiment(),
    'routes', coalesce((
      select jsonb_agg(x order by x ->> 'route') from (
        select jsonb_build_object(
          'route', q.route, 'name', p.name, 'asset', p.asset, 'reality', q.reality,
          'loans', count(*), 'net_brl_cents', sum(q.net_brl_cents), 'cost_cents', sum(q.total_cost_cents),
          'cost_bps', round(avg(q.cost_bps))) x
        from public.settlement_decisions d
        join public.settlement_quotes q on q.id = d.selected_quote_id
        join public.settlement_providers p on p.provider = q.provider
        group by q.route, p.name, p.asset, q.reality
      ) y
    ), '[]'),
    'mine', (select jsonb_build_object(
        'paid_out_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status = 'done'), 0),
        'due_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status in ('due', 'sending')), 0),
        'held_micro_usdc', coalesce(sum(l.amount_micro_usdc) filter (where l.status = 'held'), 0),
        'payouts', count(*) filter (where l.status = 'done'))
      from public.settlement_legs l join public.investments i on i.id = l.investment_id
      where l.kind = 'payout' and i.investor_id = auth.uid())
  );
end;
$$;

create or replace function public.investor_position(p_investment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv public.investments;
  v_opp public.qualified_credit_opportunities;
  v_loan public.loans;
  v_share numeric;
  v_active timestamptz;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or not (v_inv.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_inv.opportunity_id;
  select * into v_loan from public.loans where opportunity_id = v_opp.id;
  v_share := v_inv.amount_micro_usdc::numeric / v_opp.funding_target_micro_usdc;
  select min(created_at) into v_active from public.loan_events where loan_id = v_loan.id and to_status = 'ACTIVE';

  return jsonb_build_object(
    'investment', jsonb_build_object(
      'id', v_inv.id, 'amount_micro_usdc', v_inv.amount_micro_usdc, 'amount_cents', v_inv.amount_cents, 'share_bps', round(v_share * 10000),
      'mode', v_inv.mode, 'status', v_inv.status, 'deposit_signature', v_inv.deposit_signature,
      'wallet_address', v_inv.wallet_address, 'invested_at', private.iso(v_inv.created_at), 'is_simulated', v_inv.is_simulated,
      'refund_signature', case when v_inv.status = 'refunded' then v_inv.refund_signature end, 'refunded_at', private.iso(v_inv.refunded_at)
    ),
    'zcash', (select jsonb_build_object(
        'ref', z.ref, 'txid', z.txid, 'pool', z.pool, 'amount_zat', z.amount_zat, 'received_zat', z.received_zat,
        'usd_per_zec_cents', z.usd_per_zec_cents, 'quote_source', z.quote_source, 'mined_height', z.mined_height,
        'confirmed_at', private.iso(z.confirmed_at), 'credit_signature', z.credit_signature)
      from public.zcash_payment_requests z where z.investment_id = v_inv.id),
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_inv.id),
    'opportunity', jsonb_build_object(
      'id', v_opp.id, 'code', private.opportunity_code(v_opp.id), 'purpose', v_opp.purpose,
      'business_sector', (select business_sector from public.entrepreneurs where id = v_opp.entrepreneur_id),
      'amount_cents', v_opp.amount_cents, 'term_months', v_opp.term_months, 'risk_band', v_opp.risk_band,
      'funding_status', v_opp.funding_status, 'funding_target_micro_usdc', v_opp.funding_target_micro_usdc,
      'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli,
      'funding_pool', v_opp.funding_pool, 'allocation_reason_codes', to_jsonb(v_opp.allocation_reason_codes)
    ),
    'loan', case when v_loan.id is null then null else jsonb_build_object(
      'id', v_loan.id, 'status', v_loan.status, 'principal_cents', v_loan.principal_cents,
      'rate_bps', v_loan.rate_bps, 'term_months', v_loan.term_months, 'instalment_cents', v_loan.instalment_cents,
      'disbursed_at', private.iso(v_loan.disbursed_at), 'active_since', private.iso(v_active),
      'instalment_share_micro_usdc', private.share_usdc(v_loan.instalment_cents, v_share, v_opp.fx_brl_per_usdc_milli)
    ) end,
    'settlement', case when v_loan.id is null then null else jsonb_build_object(
      'ramp_bps', private.ramp_bps(),
      'route', (select jsonb_build_object(
          'selected', d.selected_route, 'reason_codes', to_jsonb(d.reason_codes),
          'model_version', d.model_version, 'net_brl_delta_cents', d.net_brl_delta_cents,
          'compared_gross_micro_usdc', d.compared_gross_micro_usdc, 'decided_at', private.iso(d.decided_at),
          'quotes', (select jsonb_agg(jsonb_build_object(
              'route', q.route, 'provider', q.provider, 'name', p.name, 'asset', p.asset, 'source_url', p.source_url,
              'net_brl_cents', q.net_brl_cents, 'total_cost_cents', q.total_cost_cents, 'cost_bps', q.cost_bps,
              'fx_rate_milli', q.fx_rate_milli, 'fx_struck', q.fx_struck, 'fx_spread_bps', q.fx_spread_bps,
              'fx_cost_cents', q.fx_cost_cents, 'provider_fee_cents', q.provider_fee_cents,
              'network_fee_cents', q.network_fee_cents, 'gross_brl_cents', q.gross_brl_cents,
              'gross_for_principal_micro_usdc', q.gross_for_principal_micro_usdc,
              'execution_eta_sec', q.execution_eta_sec, 'quoted_at', private.iso(q.quoted_at),
              'expires_at', private.iso(q.expires_at), 'liquidity_ok', q.liquidity_ok, 'reality', q.reality,
              'hops', q.hops, 'feasible', q.feasible, 'blocks', to_jsonb(q.blocks)) order by q.hops)
            from public.settlement_quotes q join public.settlement_providers p on p.provider = q.provider
            where q.loan_id = v_loan.id))
        from public.settlement_decisions d where d.loan_id = v_loan.id),
      'release', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc,
          'signature', t.signature, 'transfer_micro_usdc', t.outflow_micro_usdc,
          'loans_in_transfer', (select count(*) from public.settlement_legs b where b.transfer_id = l.transfer_id),
          'at', private.iso(t.confirmed_at))
        from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
        where l.kind = 'release' and l.loan_id = v_loan.id),
      'pix', (select jsonb_build_object('e2e', l.pix_e2e, 'brl_cents', l.amount_cents,
          'at', private.iso((select min(e.created_at) from public.loan_events e where e.loan_id = v_loan.id and e.to_status = 'DISBURSED')))
        from public.settlement_legs l where l.kind = 'pix_payout' and l.loan_id = v_loan.id)
    ) end,
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instalment_no', n,
        'due_at', case when v_active is not null then private.iso(v_active + make_interval(months => n)) end,
        'paid_at', private.iso(p.paid_at),
        'payment_id', p.id,
        'share_micro_usdc', case when p.id is not null then private.share_usdc(p.amount_cents, v_share, v_opp.fx_brl_per_usdc_milli) end,
        'pix_e2e', (select l.pix_e2e from public.settlement_legs l where l.kind = 'pix_in' and l.payment_id = p.id),
        'payout', (select jsonb_build_object('status', l.status, 'amount_micro_usdc', l.amount_micro_usdc, 'signature', t.signature)
          from public.settlement_legs l left join public.vault_transfers t on t.id = l.transfer_id
          where l.kind = 'payout' and l.payment_id = p.id and l.investment_id = v_inv.id)
      ) order by n)
      from generate_series(1, coalesce(v_loan.term_months, 0)) n
      left join public.payments p on p.loan_id = v_loan.id and p.instalment_no = n
    ), '[]'),
    'servicing', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'to_status', e.to_status, 'note', e.note, 'at', private.iso(e.created_at)) order by e.created_at)
      from public.loan_events e where e.loan_id = v_loan.id
    ), '[]'),
    'outcome', (
      select jsonb_build_object('id', po.id, 'avg_revenue_before_cents', po.avg_revenue_before_cents,
        'avg_revenue_after_cents', po.avg_revenue_after_cents, 'evc_cents', po.evc_cents, 'capital_use', po.capital_use,
        'confidence', po.confidence, 'measured_at', private.iso(po.measured_at))
      from public.productive_outcomes po where po.loan_id = v_loan.id order by po.outcome_no desc limit 1
    )
  );
end;
$$;
