-- What a wallet used to hold
--
-- Handing an asset on ends the claim, and the reader is right to refuse her
-- afterwards: she is not party to that credit any more, and a console that
-- went on showing her its outstanding balance would be saying otherwise.
--
-- But losing the claim is not the same as losing the record. She held it, she
-- chose where it went, and both facts are on Solana under her own signature.
-- This is that record and nothing else: the asset, her share of it, when it
-- came to her, when it left and to whom — frozen at the moment she handed it
-- on. No loan balance, no payments, no evidence, nothing that has moved on
-- without her.

create function public.position_history()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_wallet text := private.my_wallet();
begin
  if private.my_role() is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- An account with no wallet has held nothing.
  if v_wallet is null then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'asset', 'EF-CREDIT-' || p.asset_no,
      'share_bps', p.share_bps,
      -- The asset's face, which does not move. Its loan's balance does, and
      -- that is exactly why none of it is here.
      'principal_micro_usdc', p.principal_micro_usdc,
      'mint_address', p.mint_address,
      'received_at', private.iso(g.received_at),
      'received_signature', g.received_signature,
      'handed_on_at', private.iso(g.left_at),
      'handed_on_to', g.to_wallet,
      'handed_on_signature', g.signature,
      'is_simulated', p.is_simulated) order by g.left_at desc), '[]'::jsonb)
    from public.credit_positions p
    -- The last time she sent it away, and how it had reached her.
    join lateral (
      select e.occurred_at as left_at, e.to_wallet, e.signature,
        r.occurred_at as received_at, r.signature as received_signature
      from public.position_events e
      left join lateral (
        select e2.occurred_at, e2.signature from public.position_events e2
        where e2.position_id = p.id and e2.to_wallet = v_wallet and e2.occurred_at <= e.occurred_at
        order by e2.occurred_at desc limit 1
      ) r on true
      where e.position_id = p.id and e.kind = 'transferred' and e.from_wallet = v_wallet
      order by e.occurred_at desc limit 1
    ) g on true
    -- Only what she can no longer read live: anything still hers is not history.
    where p.investor_id is distinct from (select auth.uid())
      and p.owner_wallet is distinct from v_wallet);
end;
$$;

revoke all on function public.position_history() from public, anon;
grant execute on function public.position_history() to authenticated;
