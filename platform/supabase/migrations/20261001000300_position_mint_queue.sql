-- Minting a position, once
--
-- The queue is the same shape as the settlement one: claim with a lease, do
-- the slow thing on Devnet, come back and record it. What is different here
-- is that the mint's own key is derived from the position rather than
-- generated, so a retry after a timeout recreates the *same* mint address and
-- the chain refuses it as already created. A position can therefore be minted
-- twice in this queue and still exist once on Devnet.
--
-- Admission comes first. Only a wallet on `eligible_wallets` is ever minted
-- to, which is what makes the control real rather than described: the token
-- account is frozen the moment it exists, and the platform thaws it in the
-- same transaction because that wallet was admitted beforehand.

alter table public.credit_positions add column mint_claimed_at timestamptz;
alter table public.credit_positions add column mint_error text;

-- Positions waiting for a token: funded, owned by an admitted wallet, not
-- minted, and not already in someone else's hands for the next two minutes.
create function public.position_mint_claim(p_limit integer default 5)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  with picked as (
    select p.id from public.credit_positions p
    join public.eligible_wallets w on w.wallet = p.owner_wallet and w.active
    where p.mint_address is null
      and p.owner_wallet is not null
      and (p.mint_claimed_at is null or p.mint_claimed_at < now() - interval '2 minutes')
    order by p.asset_no
    limit greatest(1, least(coalesce(p_limit, 5), 25))
    for update of p skip locked
  ),
  claimed as (
    update public.credit_positions p set mint_claimed_at = now(), mint_error = null
    where p.id in (select id from picked)
    returning p.id, p.asset_no, p.owner_wallet
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'position_id', id, 'asset_no', asset_no, 'owner_wallet', owner_wallet) order by asset_no), '[]')
  into v from claimed;
  return v;
end;
$$;

create function public.position_mint_record(
  p_position_id uuid,
  p_mint text,
  p_token_account text,
  p_signature text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.credit_positions;
begin
  update public.credit_positions set
    mint_address = p_mint, token_account = p_token_account, mint_signature = p_signature,
    minted_at = coalesce(minted_at, now()), mint_claimed_at = null, mint_error = null
  where id = p_position_id and mint_address is null
  returning * into v;
  if v.id is null then
    return;  -- already minted; the derived key means it is the same token
  end if;
  insert into public.position_events (position_id, kind, to_wallet, signature, detail)
  values (p_position_id, 'minted', v.owner_wallet, p_signature,
    jsonb_build_object('mint', p_mint, 'token_account', p_token_account, 'token_program', 'token-2022'))
  on conflict do nothing;
end;
$$;

create function public.position_mint_failed(p_position_id uuid, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.credit_positions
  set mint_claimed_at = null, mint_error = left(coalesce(p_error, 'unknown'), 500)
  where id = p_position_id and mint_address is null;
end;
$$;

-- Who may run these is a grant, not an `if` inside them: the settlement queue
-- is guarded the same way.
revoke all on function public.position_mint_claim(integer) from public, anon, authenticated;
revoke all on function public.position_mint_record(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.position_mint_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.position_mint_claim(integer) to service_role;
grant execute on function public.position_mint_record(uuid, text, text, text) to service_role;
grant execute on function public.position_mint_failed(uuid, text) to service_role;

-- ------------------------------------------------------------------ the cron
-- Every minute is often enough: a position is minted once, and nothing waits
-- on it but a screen.

create function private.dispatch_position_mint()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.credit_positions p
    join public.eligible_wallets w on w.wallet = p.owner_wallet and w.active
    where p.mint_address is null
      and (p.mint_claimed_at is null or p.mint_claimed_at < now() - interval '2 minutes')
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_position_mint: vault secrets are not set';
    return;
  end if;
  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/position-mint'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_position_mint() from public, anon, authenticated;
select cron.schedule('position-mint', '* * * * *', 'select private.dispatch_position_mint()');
