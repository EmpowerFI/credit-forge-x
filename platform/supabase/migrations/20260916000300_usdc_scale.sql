-- Reais to USDC was off by a factor of 1,000 wherever a loan's reais were
-- turned into an investor's USDC: centavos x 10^4 / quote gives milli-USDC,
-- not micro-USDC. The funding target was right (it converts to whole USDC and
-- then scales); repayments, expected returns and every share of an instalment
-- were not. One helper now does the conversion, so it is written once.

-- Centavos to micro-USDC at a quote in milli-reais per USDC:
-- cents / 100 reais, / (quote / 1000) USDC, x 10^6 micro-USDC.
create function private.usdc_micro(p_cents numeric, p_fx_milli integer)
returns numeric
language sql immutable set search_path = ''
as $$ select p_cents * 10000000 / p_fx_milli $$;

revoke all on function private.usdc_micro(numeric, integer) from public, anon;
grant execute on function private.usdc_micro(numeric, integer) to authenticated, service_role;

create or replace function private.share_usdc(p_cents numeric, p_share numeric, p_fx_milli integer)
returns bigint
language sql immutable set search_path = ''
as $$ select round(private.usdc_micro(p_cents, p_fx_milli) * p_share)::bigint $$;

create or replace function public.investor_portfolio()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if private.my_role() is distinct from 'capital_provider' and not private.is_auditor_or_admin() then
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  with mine as (
    select i.*, o.funding_target_micro_usdc, o.funding_status, o.purpose, o.risk_band, o.term_months,
      o.amount_cents, o.fx_brl_per_usdc_milli, en.business_sector,
      i.amount_micro_usdc::numeric / o.funding_target_micro_usdc as share,
      l.id as loan_id, l.status as loan_status, l.principal_cents, l.instalment_cents, l.term_months as loan_term,
      l.disbursed_at,
      (select count(*) from public.payments p where p.loan_id = l.id)::integer as paid,
      (select coalesce(sum(p.amount_cents), 0) from public.payments p where p.loan_id = l.id) as repaid_cents,
      (select po.evc_cents from public.productive_outcomes po where po.loan_id = l.id order by po.outcome_no desc limit 1) as evc_cents,
      a.status as proof_status, a.signature as proof_signature, a.reconcile as proof_reconcile
    from public.investments i
    join public.qualified_credit_opportunities o on o.id = i.opportunity_id
    join public.entrepreneurs en on en.id = o.entrepreneur_id
    left join public.loans l on l.opportunity_id = o.id
    left join public.chain_anchors a on a.kind = 'allocation' and a.entity_id = i.id
    where i.investor_id = auth.uid()
  )
  select jsonb_build_object(
    'invested_micro_usdc', coalesce(sum(amount_micro_usdc), 0),
    'deployed_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')), 0),
    -- Its share of instalments received, in USDC at the opportunity's quote.
    'repaid_micro_usdc', coalesce(round(sum(share * private.usdc_micro(repaid_cents, fx_brl_per_usdc_milli))), 0),
    'expected_micro_usdc', coalesce(round(sum(share * private.usdc_micro(coalesce(instalment_cents * loan_term, amount_cents * (10000 + 250 * term_months) / 10000), fx_brl_per_usdc_milli))), 0),
    'positions', count(*),
    'by_risk', (select coalesce(jsonb_object_agg(risk_band, n), '{}') from (select risk_band, sum(amount_micro_usdc) n from mine group by risk_band) x),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'investment_id', id, 'opportunity_id', opportunity_id, 'code', private.opportunity_code(opportunity_id),
      'purpose', purpose, 'business_sector', business_sector, 'risk_band', risk_band,
      'amount_micro_usdc', amount_micro_usdc, 'share_bps', round(share * 10000), 'mode', mode, 'status', status,
      'deposit_signature', deposit_signature, 'invested_at', private.iso(created_at), 'is_simulated', is_simulated,
      'funding_status', funding_status, 'loan_status', loan_status, 'term_months', coalesce(loan_term, term_months),
      'paid', coalesce(paid, 0), 'disbursed_at', private.iso(disbursed_at),
      'repaid_micro_usdc', round(share * private.usdc_micro(coalesce(repaid_cents, 0), fx_brl_per_usdc_milli)),
      'evc_cents', evc_cents,
      'proof', jsonb_build_object('status', proof_status, 'signature', proof_signature, 'reconcile', proof_reconcile)
    ) order by created_at desc), '[]')
  ) into v
  from mine;
  return v;
end;
$$;
