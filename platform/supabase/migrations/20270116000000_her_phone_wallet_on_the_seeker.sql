-- Her phone's wallet, on the Seeker app.
--
-- Hackathon, 27/11/2026 (PLAN_SEEKER.md §3.2, F3). In the Seeker app she
-- connects the wallet on her phone (Mobile Wallet Adapter) and proves it is
-- hers by signing a message; no transaction. The seeker-wallet function
-- checks the signature and records the wallet here, with her choice of the
-- automatic transfer (on). It then asks for that wallet as her payout
-- destination through diary_payout_set, as the web diary does when she pastes
-- an address -- or, before her first reward, keeps it until then.
--
-- Additive only: two new tables and four new functions. Nothing the web diary
-- calls changes.

create table private.seeker_wallets (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  address         text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  -- Each reward paid into her reward wallet goes on to this one (reward-payout).
  auto_transfer   boolean not null default true,
  verified_at     timestamptz not null default now()
);
alter table private.seeker_wallets enable row level security;

-- The message she is asked to sign: one at a time, for five minutes, used once.
create table private.seeker_wallet_challenges (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  address         text not null check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  message         text not null check (char_length(message) <= 1000),
  expires_at      timestamptz not null
);
alter table private.seeker_wallet_challenges enable row level security;

create function private.seeker_entrepreneur(p_user uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.entrepreneurs where profile_id = p_user;
  if v_id is null then
    raise exception 'not_enrolled' using errcode = 'P0002';
  end if;
  return v_id;
end $$;
revoke execute on function private.seeker_entrepreneur(uuid) from public, anon, authenticated;

/** seeker-wallet only: keeps the message it built for her to sign. */
create function public.seeker_wallet_challenge(p_user uuid, p_address text, p_message text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.seeker_wallet_challenges (entrepreneur_id, address, message, expires_at)
  values (private.seeker_entrepreneur(p_user), p_address, p_message, now() + interval '5 minutes')
  on conflict (entrepreneur_id) do update
    set address = excluded.address, message = excluded.message, expires_at = excluded.expires_at;
end $$;

/** seeker-wallet only: the message waiting for her signature, if it has not expired. */
create function public.seeker_wallet_pending(p_user uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('address', c.address, 'message', c.message)
    from private.seeker_wallet_challenges c
   where c.entrepreneur_id = private.seeker_entrepreneur(p_user)
     and c.expires_at > now()
$$;

/**
 * seeker-wallet only, once it has checked her signature of exactly that
 * message: the challenge is spent and the wallet is hers.
 */
create function public.seeker_wallet_verified(p_user uuid, p_message text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.seeker_entrepreneur(p_user);
  v_address text;
begin
  delete from private.seeker_wallet_challenges
   where entrepreneur_id = v_me and message = p_message and expires_at > now()
  returning address into v_address;
  if v_address is null then
    raise exception 'challenge_expired' using errcode = '22023';
  end if;
  insert into private.seeker_wallets (entrepreneur_id, address)
  values (v_me, v_address)
  on conflict (entrepreneur_id) do update set address = excluded.address, verified_at = now();
  return jsonb_build_object('address', v_address);
end $$;

revoke execute on function
  public.seeker_wallet_challenge(uuid, text, text), public.seeker_wallet_pending(uuid),
  public.seeker_wallet_verified(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.seeker_wallet_challenge(uuid, text, text), public.seeker_wallet_pending(uuid),
  public.seeker_wallet_verified(uuid, text)
to service_role;

/** The Seeker app: her phone's wallet, if she connected one. */
create function public.seeker_wallet_get()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('address', w.address, 'auto_transfer', w.auto_transfer, 'verified_at', w.verified_at)
    from private.seeker_wallets w
   where w.entrepreneur_id = private.diary_me()
$$;
revoke execute on function public.seeker_wallet_get() from public, anon;
grant execute on function public.seeker_wallet_get() to authenticated;
