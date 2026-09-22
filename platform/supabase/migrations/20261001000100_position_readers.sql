-- Reading a credit position
--
-- Every money figure here is hers. The loan's own numbers appear beside them,
-- named as the loan's, because a position that owns twelve per cent of a
-- R$ 6.700 loan must never print R$ 6.700 as what it is worth.
--
-- The state is derived from the loan every time it is read. `transferred` is
-- not among the states: a position that changed hands is still active or
-- still late, and saying "transferred" where the state belongs would hide
-- whether the loan is being paid. Who owns it is a separate field, and the
-- changes of owner are events.
--
-- Nothing personal crosses this boundary. The entrepreneur is not named, her
-- figures are not returned, and the freshness of her evidence is a date.

create function private.position_row(p public.credit_positions) returns jsonb
language sql stable security definer set search_path = ''
as $$
  with loan as (
    select l.* from public.loans l where l.opportunity_id = p.opportunity_id
    order by l.created_at desc limit 1
  ),
  progress as (
    select
      (select count(*) from public.payments pm where pm.loan_id = l.id)::integer as paid,
      (select coalesce(sum(pm.amount_cents), 0) from public.payments pm where pm.loan_id = l.id) as repaid_cents,
      l.term_months * l.instalment_cents as owed_cents,
      l.principal_cents, l.term_months, l.instalment_cents, l.status, l.disbursed_at
    from loan l
  )
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
    'loan', jsonb_build_object(
      'principal_cents', g.principal_cents,
      'outstanding_cents', greatest(0, g.owed_cents - g.repaid_cents),
      'term_months', g.term_months,
      'instalment_cents', g.instalment_cents,
      'payments_made', g.paid,
      'status', g.status,
      'disbursed_at', private.iso(g.disbursed_at)),
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
  from progress g;
$$;

-- Her positions, newest first; an auditor's, all of them.
create function public.tokenized_positions()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.my_role() is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(private.position_row(p) order by p.created_at desc, p.asset_no desc), '[]'::jsonb)
    from public.credit_positions p
    where p.investor_id = (select auth.uid()) or private.is_auditor_or_admin());
end;
$$;

-- One position, with what the addendum's field table asks for and the history
-- behind it.
create function public.tokenized_position(p_position_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.credit_positions;
  v_entrepreneur uuid;
begin
  select * into p from public.credit_positions where id = p_position_id;
  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;
  if not (p.investor_id = (select auth.uid()) or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  select o.entrepreneur_id into v_entrepreneur
    from public.qualified_credit_opportunities o where o.id = p.opportunity_id;

  return private.position_row(p) || jsonb_build_object(
    -- How old the evidence behind this credit is, as a date. Not what it says.
    'evidence', jsonb_build_object(
      'latest_checkin_at', private.iso((
        select max(c.created_at) from public.checkins c where c.entrepreneur_id = v_entrepreneur)),
      'checkins', (select count(*) from public.checkins c where c.entrepreneur_id = v_entrepreneur),
      'readiness_band', (select r.band from public.readiness_assessments r
        where r.entrepreneur_id = v_entrepreneur order by r.created_at desc limit 1),
      'readiness_model', (select r.model_version from public.readiness_assessments r
        where r.entrepreneur_id = v_entrepreneur order by r.created_at desc limit 1),
      'data_quality', (select (r.components ->> 'data_quality')::integer from public.readiness_assessments r
        where r.entrepreneur_id = v_entrepreneur order by r.created_at desc limit 1),
      'outcomes_measured', (select count(*) from public.productive_outcomes po
        where po.entrepreneur_id = v_entrepreneur)),
    -- When the community behind it belongs to a sponsored programme.
    'mandate', (
      select jsonb_build_object('program', pr.name, 'sponsor', s.name)
      from public.community_memberships cm
      join public.program_communities pc on pc.community_id = cm.community_id
      join public.programs pr on pr.id = pc.program_id
      join public.sponsors s on s.id = pr.sponsor_id
      where cm.entrepreneur_id = v_entrepreneur
      order by cm.joined_at limit 1),
    -- The proofs that already exist for the credit behind it, and the mint.
    'proof', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'kind', a.kind, 'status', a.status, 'signature', a.signature,
          'account', a.account_address, 'confirmed_at', private.iso(a.confirmed_at))
        order by a.created_at), '[]')
      from public.chain_anchors a
      where (a.kind = 'opportunity' and a.entity_id = p.opportunity_id)
         or (a.kind = 'allocation' and a.entity_id = p.investment_id)),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'kind', e.kind, 'from_wallet', e.from_wallet, 'to_wallet', e.to_wallet,
          'signature', e.signature, 'detail', e.detail, 'occurred_at', private.iso(e.occurred_at))
        order by e.occurred_at, e.id), '[]')
      from public.position_events e where e.position_id = p.id));
end;
$$;

revoke all on function private.position_row(public.credit_positions) from public, anon, authenticated;
revoke all on function public.tokenized_positions() from public, anon;
revoke all on function public.tokenized_position(uuid) from public, anon;
grant execute on function public.tokenized_positions() to authenticated;
grant execute on function public.tokenized_position(uuid) to authenticated;
