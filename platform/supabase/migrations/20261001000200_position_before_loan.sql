-- A position exists before its loan does
--
-- An opportunity fills, and the position is hers from that moment. The loan
-- comes later, when the partner decides and disburses. The first reader joined
-- straight onto `loans` and so returned nothing at all during that window —
-- an investor who had just funded something would have seen her position
-- vanish until a partner acted.
--
-- The loan is now joined on the left, and a position without one reads as
-- pending with the loan's fields empty, which is what it is.

create or replace function private.position_row(p public.credit_positions) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    -- The asset id: a number with no meaning outside this platform.
    'asset', 'EF-CREDIT-' || p.asset_no,
    'state', case
      when p.closed_at is not null then 'closed'
      when g.status = 'PAID' then 'paid'
      when g.status = 'DEFAULTED' then 'delinquent'
      when g.status in ('ACTIVE', 'DISBURSED') then 'active'
      else 'pending' end,
    'owner_wallet', p.owner_wallet,
    'share_bps', p.share_bps,
    -- Hers.
    'principal_micro_usdc', p.principal_micro_usdc,
    'principal_cents', round(g.principal_cents * p.share_bps / 10000.0),
    'outstanding_cents', greatest(0, round((g.owed_cents - g.repaid_cents) * p.share_bps / 10000.0)),
    -- The loan's, and labelled as the loan's wherever it is shown.
    'loan', case when g.id is null then null else jsonb_build_object(
      'principal_cents', g.principal_cents,
      'outstanding_cents', greatest(0, g.owed_cents - g.repaid_cents),
      'term_months', g.term_months,
      'instalment_cents', g.instalment_cents,
      'payments_made', g.paid,
      'status', g.status,
      'disbursed_at', private.iso(g.disbursed_at)) end,
    'risk_band', (select o.risk_band from public.qualified_credit_opportunities o where o.id = p.opportunity_id),
    'opportunity_no', (select o.opportunity_no from public.qualified_credit_opportunities o where o.id = p.opportunity_id),
    -- The chain, or nothing at all when it is not there yet.
    'mint_address', p.mint_address,
    'token_account', p.token_account,
    'mint_signature', p.mint_signature,
    'minted_at', private.iso(p.minted_at),
    -- Hold until it is minted; transferable once it is and the owner is still
    -- admitted. Never "liquid": there is no buyer and no market.
    'liquidity', case
      when p.mint_address is null then 'hold'
      when exists (select 1 from public.eligible_wallets w where w.wallet = p.owner_wallet and w.active) then 'transferable'
      else 'hold' end,
    'is_simulated', p.is_simulated,
    'created_at', private.iso(p.created_at),
    'closed_at', private.iso(p.closed_at))
  from (select 1) base
  left join lateral (
    select l.id, l.principal_cents, l.term_months, l.instalment_cents, l.status, l.disbursed_at,
      (select count(*) from public.payments pm where pm.loan_id = l.id)::integer as paid,
      (select coalesce(sum(pm.amount_cents), 0) from public.payments pm where pm.loan_id = l.id) as repaid_cents,
      l.term_months * l.instalment_cents as owed_cents
    from public.loans l
    where l.opportunity_id = p.opportunity_id
    order by l.created_at desc limit 1
  ) g on true;
$$;
