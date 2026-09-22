-- The wallet that holds it is a reader too
--
-- The first readers asked one question: did you buy this? That is the wrong
-- question the moment an asset can change hands. Transfer one, and the chain
-- says the destination holds it while the console still lists it under the
-- investor who funded it — and the wallet that actually holds it sees nothing
-- at all. Two answers to "whose is this?", and the honest one is off screen.
--
-- So a position is now readable by whoever bought it *and* by whoever holds
-- it, and the row says which of the two the reader is, because they are not
-- the same thing and the screen must not imply that they are.
--
-- Transfer is widened the same way and no further. Either party may ask us to
-- admit a destination — admitting only creates and thaws an account, it moves
-- nothing — and the chain still decides whether the asset goes, because only
-- the key that holds it can sign.

create function private.my_wallet() returns text
language sql stable security definer set search_path = ''
as $$ select p.wallet_address from public.profiles p where p.id = (select auth.uid()) $$;

revoke all on function private.my_wallet() from public, anon, authenticated;

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
    -- What the reader is to this position. `invested` covers the investor who
    -- funded it, whether or not she still holds it; `holding` is the wallet
    -- that received it from someone else.
    'relation', case
      when p.investor_id = (select auth.uid()) then 'invested'
      when p.owner_wallet is not null and p.owner_wallet = private.my_wallet() then 'holding'
      else 'oversight' end,
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

create or replace function public.tokenized_positions()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_wallet text := private.my_wallet();
begin
  if private.my_role() is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(private.position_row(p) order by p.created_at desc, p.asset_no desc), '[]'::jsonb)
    from public.credit_positions p
    where p.investor_id = (select auth.uid())
      or (v_wallet is not null and p.owner_wallet = v_wallet)
      or private.is_auditor_or_admin());
end;
$$;

-- The same widening on the one position, so a link to an asset she holds
-- opens instead of refusing.
create or replace function public.tokenized_position(p_position_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.credit_positions;
  v_entrepreneur uuid;
  v_wallet text := private.my_wallet();
begin
  select * into p from public.credit_positions where id = p_position_id;
  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;
  if not (p.investor_id = (select auth.uid())
    or (v_wallet is not null and p.owner_wallet = v_wallet)
    or private.is_auditor_or_admin()) then
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
        order by a.created_at), '[]'::jsonb)
      from public.chain_anchors a
      where (a.kind = 'opportunity' and a.entity_id = p.opportunity_id)
         or (a.kind = 'allocation' and a.entity_id = p.investment_id)),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', e.kind, 'from_wallet', e.from_wallet, 'to_wallet', e.to_wallet,
        'signature', e.signature, 'detail', e.detail, 'occurred_at', private.iso(e.occurred_at))
        order by e.occurred_at, e.id), '[]'::jsonb)
      from public.position_events e where e.position_id = p.id));
end;
$$;

-- Whoever holds it may move it on. Asking us to admit a destination creates
-- and thaws an account and nothing else; the signature still has to come from
-- the key that holds the asset, which is the only authority that matters.
create or replace function public.position_transfer_check(p_position_id uuid, p_to_wallet text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.credit_positions;
  v_to text := nullif(trim(coalesce(p_to_wallet, '')), '');
  v_wallet text := private.my_wallet();
begin
  select * into p from public.credit_positions where id = p_position_id;
  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;
  if p.investor_id is distinct from (select auth.uid())
    and (v_wallet is null or p.owner_wallet is distinct from v_wallet) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  if p.mint_address is null then
    raise exception 'not_minted_yet' using errcode = '22023';
  end if;
  if p.closed_at is not null then
    raise exception 'position_closed' using errcode = '22023';
  end if;
  if v_to is null then
    raise exception 'no_destination' using errcode = '22023';
  end if;
  if v_to = p.owner_wallet then
    raise exception 'same_wallet' using errcode = '22023';
  end if;
  -- The list is the point: a wallet nobody admitted cannot receive this, and
  -- the chain would refuse it even if this check were removed.
  if not exists (select 1 from public.eligible_wallets w where w.wallet = v_to and w.active) then
    raise exception 'wallet_not_admitted' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'position_id', p.id,
    'asset', 'EF-CREDIT-' || p.asset_no,
    'mint_address', p.mint_address,
    'from_wallet', p.owner_wallet,
    'from_token_account', p.token_account,
    'to_wallet', v_to);
end;
$$;
