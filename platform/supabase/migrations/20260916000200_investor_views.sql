-- The investor console's reads: one position in full, the activity across
-- all of them, and every proof behind them. All scoped to the caller's own
-- allocations; nothing here names or points to a person.

-- A share of a loan in USDC, at the opportunity's quote.
create function private.share_usdc(p_cents numeric, p_share numeric, p_fx_milli integer)
returns bigint
language sql immutable set search_path = ''
as $$ select round(p_cents * p_share * 10000 / p_fx_milli)::bigint $$;

-- One position: the deposit, the allocation's proof, the opportunity as the
-- investor saw it, the loan's schedule and servicing, and the outcome.
create function public.investor_position(p_investment_id uuid)
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
      'id', v_inv.id, 'amount_micro_usdc', v_inv.amount_micro_usdc, 'share_bps', round(v_share * 10000),
      'mode', v_inv.mode, 'status', v_inv.status, 'deposit_signature', v_inv.deposit_signature,
      'wallet_address', v_inv.wallet_address, 'invested_at', private.iso(v_inv.created_at), 'is_simulated', v_inv.is_simulated
    ),
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_inv.id),
    'opportunity', jsonb_build_object(
      'id', v_opp.id, 'code', private.opportunity_code(v_opp.id), 'purpose', v_opp.purpose,
      'business_sector', (select business_sector from public.entrepreneurs where id = v_opp.entrepreneur_id),
      'amount_cents', v_opp.amount_cents, 'term_months', v_opp.term_months, 'risk_band', v_opp.risk_band,
      'funding_status', v_opp.funding_status, 'funding_target_micro_usdc', v_opp.funding_target_micro_usdc,
      'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli
    ),
    'loan', case when v_loan.id is null then null else jsonb_build_object(
      'id', v_loan.id, 'status', v_loan.status, 'principal_cents', v_loan.principal_cents,
      'rate_bps', v_loan.rate_bps, 'term_months', v_loan.term_months, 'instalment_cents', v_loan.instalment_cents,
      'disbursed_at', private.iso(v_loan.disbursed_at), 'active_since', private.iso(v_active),
      'instalment_share_micro_usdc', private.share_usdc(v_loan.instalment_cents, v_share, v_opp.fx_brl_per_usdc_milli)
    ) end,
    -- Every instalment, due monthly from the start of repayment, with what came in.
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instalment_no', n,
        'due_at', case when v_active is not null then private.iso(v_active + make_interval(months => n)) end,
        'paid_at', private.iso(p.paid_at),
        'payment_id', p.id,
        'share_micro_usdc', case when p.id is not null then private.share_usdc(p.amount_cents, v_share, v_opp.fx_brl_per_usdc_milli) end
      ) order by n)
      from generate_series(1, coalesce(v_loan.term_months, 0)) n
      left join public.payments p on p.loan_id = v_loan.id and p.instalment_no = n
    ), '[]'),
    -- What the partner recorded, as the investor may read it.
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

-- What happened across the caller's positions, newest first: allocations,
-- disbursements, instalments (its share), outcomes, refunds.
create function public.investor_activity(p_limit integer default 50)
returns table (
  at timestamptz,
  kind text,
  investment_id uuid,
  code text,
  purpose public.credit_purpose,
  micro_usdc bigint,
  signature text,
  entity_kind public.anchor_kind,
  entity_id uuid
)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select i.*, o.funding_target_micro_usdc, o.fx_brl_per_usdc_milli, o.purpose,
      i.amount_micro_usdc::numeric / o.funding_target_micro_usdc as share,
      l.id as loan_id
    from public.investments i
    join public.qualified_credit_opportunities o on o.id = i.opportunity_id
    left join public.loans l on l.opportunity_id = o.id
    where i.investor_id = auth.uid()
  )
  select * from (
    select m.created_at, 'invested', m.id, private.opportunity_code(m.opportunity_id), m.purpose, m.amount_micro_usdc,
      m.deposit_signature, 'allocation'::public.anchor_kind, m.id
    from mine m
    union all
    select e.created_at, 'disbursed', m.id, private.opportunity_code(m.opportunity_id), m.purpose, m.amount_micro_usdc,
      null, 'loan_transition'::public.anchor_kind, e.id
    from mine m join public.loan_events e on e.loan_id = m.loan_id and e.to_status = 'DISBURSED'
    union all
    select p.paid_at, 'repayment', m.id, private.opportunity_code(m.opportunity_id), m.purpose,
      private.share_usdc(p.amount_cents, m.share, m.fx_brl_per_usdc_milli), null, 'payment'::public.anchor_kind, p.id
    from mine m join public.payments p on p.loan_id = m.loan_id
    union all
    select e.created_at, 'paid_off', m.id, private.opportunity_code(m.opportunity_id), m.purpose, null::bigint,
      null, 'loan_transition'::public.anchor_kind, e.id
    from mine m join public.loan_events e on e.loan_id = m.loan_id and e.to_status = 'PAID'
    union all
    select po.measured_at, 'outcome', m.id, private.opportunity_code(m.opportunity_id), m.purpose, null::bigint,
      null, 'outcome'::public.anchor_kind, po.id
    from mine m join public.productive_outcomes po on po.loan_id = m.loan_id
    union all
    select m.created_at, 'refund_due', m.id, private.opportunity_code(m.opportunity_id), m.purpose, m.amount_micro_usdc,
      null, null::public.anchor_kind, null::uuid
    from mine m where m.status in ('refund_due', 'refunded')
  ) x (at, kind, investment_id, code, purpose, micro_usdc, signature, entity_kind, entity_id)
  where private.my_role() = 'capital_provider' or private.is_auditor_or_admin()
  order by at desc
  limit least(greatest(p_limit, 1), 200)
$$;

-- Every proof behind the caller's positions: its own allocations, and the
-- loans they fund — terms, status changes, payments. Not the outcome's
-- record, which holds her figures; its proof's status is in the position.
create function public.investor_proofs()
returns table (
  kind public.anchor_kind,
  entity_id uuid,
  code text,
  status public.anchor_status,
  signature text,
  account_address text,
  reconcile public.reconcile_status,
  confirmed_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select i.id, i.opportunity_id, l.id as loan_id
    from public.investments i
    left join public.loans l on l.opportunity_id = i.opportunity_id
    where i.investor_id = auth.uid()
  ),
  facts as (
    select 'allocation'::public.anchor_kind as kind, m.id as entity_id, m.opportunity_id from mine m
    union select 'loan', m.loan_id, m.opportunity_id from mine m where m.loan_id is not null
    union select 'loan_transition', e.id, m.opportunity_id from mine m join public.loan_events e on e.loan_id = m.loan_id
    union select 'payment', p.id, m.opportunity_id from mine m join public.payments p on p.loan_id = m.loan_id
  )
  select f.kind, f.entity_id, private.opportunity_code(f.opportunity_id), a.status, a.signature, a.account_address,
    a.reconcile, a.confirmed_at
  from facts f join public.chain_anchors a on a.kind = f.kind and a.entity_id = f.entity_id
  where private.my_role() = 'capital_provider'
  order by a.confirmed_at desc nulls first
$$;

revoke all on function public.investor_position(uuid), public.investor_activity(integer), public.investor_proofs(),
  private.share_usdc(numeric, numeric, integer) from public, anon;
grant execute on function public.investor_position(uuid), public.investor_activity(integer), public.investor_proofs()
  to authenticated;
grant execute on function private.share_usdc(numeric, numeric, integer) to authenticated, service_role;
