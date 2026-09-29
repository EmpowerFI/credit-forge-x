-- A wallet that funded an opportunity is admitted to hold what it funded.
--
-- A position mints only to a wallet on `eligible_wallets` — the token account
-- is frozen when it is created and only an admitted wallet gets thawed. Until
-- now the only thing that ever wrote to that list was a seeding script run by
-- hand, with the investor's address passed on the command line. That made the
-- live path unreproducible: anyone else running this demo would have to be
-- given an address out of band, and the address of whoever demonstrated it
-- last would be sitting in the repository.
--
-- The deposit already proves what the list is trying to assert. By the time
-- record_investment is called with a wallet and a signature, the transfer has
-- been read back from chain and checked: for USDC, that it succeeded and moved
-- Circle devnet USDC from an account that wallet controls into the vault; for
-- shielded ZEC, that the request confirmed against the treasury's viewing key.
-- A wallet that did that is exactly the wallet the position belongs to.
--
-- So admission is earned here, by the transfer, rather than granted beside it.
-- Nobody has to be told an address in advance, and the eligibility this stands
-- in for — the investor eligibility a regulated structure would define — is at
-- least asserted by something that happened rather than by a list someone
-- wrote before the demo.
--
-- Two deliberate limits:
--
--   A simulated allocation admits nothing. It carries no wallet and no
--   signature, and it moved no money; there is nothing to have earned.
--
--   An existing row is left alone, including an inactive one. Deactivating a
--   wallet is an act by an operator, and a later deposit is not an argument
--   against it. The position then waits, unminted, which is the visible
--   outcome rather than the silent one.
--
-- Rebuilt from 20260921000000_capital_allocation.sql, which is where this
-- function was last defined.

create or replace function public.record_investment(
  p_investor_id uuid,
  p_opportunity_id uuid,
  p_amount_micro_usdc bigint,
  p_mode public.investment_mode,
  p_wallet_address text default null,
  p_deposit_signature text default null,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_existing public.investments;
  v_id uuid;
  v_funded bigint;
begin
  if p_deposit_signature is not null then
    select * into v_existing from public.investments where deposit_signature = p_deposit_signature;
    if found then
      return jsonb_build_object('id', v_existing.id, 'reused', true);
    end if;
  end if;
  if not exists (select 1 from public.profiles where id = p_investor_id and role = 'capital_provider') then
    raise exception 'not_an_investor' using errcode = '42501';
  end if;

  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.funding_status not in ('open', 'partially_funded') then
    raise exception 'opportunity_not_open' using errcode = 'P0001';
  end if;
  if v_opp.funding_pool = 'domestic' and p_mode <> 'simulated' then
    raise exception 'domestic_pool_is_simulated' using errcode = 'P0001';
  end if;
  if p_amount_micro_usdc <= 0 or v_opp.funded_micro_usdc + p_amount_micro_usdc > v_opp.funding_target_micro_usdc then
    raise exception 'exceeds_remaining' using errcode = '22023';
  end if;

  insert into public.investments (
    investor_id, opportunity_id, wallet_address, amount_micro_usdc, deposit_signature, mode, is_simulated, created_at
  ) values (
    p_investor_id, p_opportunity_id, p_wallet_address, p_amount_micro_usdc, p_deposit_signature, p_mode, p_is_simulated, p_created_at
  ) returning id into v_id;

  -- Admitted by the transfer. The length test is not a base58 check; it is the
  -- table's own constraint, applied here so that a profile holding something
  -- that is not a Solana address cannot cost the investor her allocation. The
  -- position simply stays unminted, which is what it would have been anyway.
  if p_wallet_address is not null
     and p_deposit_signature is not null
     and length(p_wallet_address) between 32 and 44
  then
    insert into public.eligible_wallets (wallet, label, note, admitted_by, active, is_simulated)
    values (
      p_wallet_address,
      coalesce((select display_name from public.profiles where id = p_investor_id), 'Investidora'),
      'Admitted by the deposit ' || p_deposit_signature,
      p_investor_id,
      true,
      true
    )
    on conflict (wallet) do nothing;
  end if;

  v_funded := v_opp.funded_micro_usdc + p_amount_micro_usdc;
  update public.qualified_credit_opportunities
  set funded_micro_usdc = v_funded,
      funding_status = (case when v_funded >= funding_target_micro_usdc then 'funded' else 'partially_funded' end)::public.funding_status
  where id = p_opportunity_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('allocation', v_id, private.anchor_of('opportunity', p_opportunity_id));
  return jsonb_build_object('id', v_id, 'reused', false, 'funded_micro_usdc', v_funded);
end;
$$;

comment on function public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz) is
  'Books an allocation. A wallet that arrives with a verified deposit signature is admitted to eligible_wallets, so the position it paid for can mint to it without anyone being handed an address in advance.';
