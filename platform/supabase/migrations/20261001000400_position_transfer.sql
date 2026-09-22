-- Changing hands
--
-- The investor signs the transfer herself, in her own wallet. The platform
-- does not hold her asset and cannot move it — what it holds is the freeze
-- authority, which is a veto over *where* it may go, not a power to send it.
--
-- So admission happens first and separately: before she can sign anything,
-- the destination's token account has to exist and be thawed, and only the
-- platform can thaw it. That ordering is the whole control. It also happens
-- to be how the real thing works — an eligible buyer is admitted before a
-- trade, not during one.
--
-- These two functions are the ends of that: what the browser is allowed to
-- build, and what the chain says happened afterwards.

create function public.position_transfer_check(p_position_id uuid, p_to_wallet text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.credit_positions;
  v_to text := nullif(trim(coalesce(p_to_wallet, '')), '');
begin
  select * into p from public.credit_positions where id = p_position_id;
  if not found then
    raise exception 'position_not_found' using errcode = 'P0002';
  end if;
  if p.investor_id is distinct from (select auth.uid()) then
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

create function public.position_transferred(
  p_position_id uuid,
  p_from text,
  p_to text,
  p_token_account text,
  p_signature text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.credit_positions;
begin
  update public.credit_positions
  set owner_wallet = p_to, token_account = p_token_account
  where id = p_position_id and owner_wallet is not distinct from p_from
  returning * into v;
  if v.id is null then
    return;  -- already recorded, or it moved on: the chain is the record
  end if;
  insert into public.position_events (position_id, kind, from_wallet, to_wallet, signature, detail)
  values (p_position_id, 'transferred', p_from, p_to, p_signature,
    jsonb_build_object('token_account', p_token_account))
  on conflict do nothing;
end;
$$;

revoke all on function public.position_transfer_check(uuid, text) from public, anon;
grant execute on function public.position_transfer_check(uuid, text) to authenticated;
revoke all on function public.position_transferred(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.position_transferred(uuid, text, text, text, text) to service_role;
