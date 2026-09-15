-- Returns in shielded ZEC.
--
-- An investor who paid in shielded ZEC and has no Solana wallet had nowhere
-- to receive what came back: each instalment's share was held, and a refund
-- stayed due. Now they can give a shielded return address, and both go back
-- to them as ZEC from EmpowerFI's treasury:
--
--   payout   an instalment's share, held until then, paid in ZEC at the
--            quote of the day; no USDC moves (the ramp would convert the
--            instalment's reais straight to ZEC)
--   refund   a declined opportunity's allocation: the vault returns its USDC
--            to the ramp — the operator on devnet — as a real devnet
--            transfer, and the treasury pays the ZEC back
--
-- Sending ZEC takes the treasury's spending key, which never leaves the
-- operator's machine: scripts/platform/zcash-returns.mts claims what is due,
-- sends it with zcash-devtool and records the transaction. A return claimed
-- is marked sending before anything is sent, so it is never sent twice; one
-- left sending is for a human to check against the treasury's history.

alter table public.zcash_payment_requests add column return_address text;

-- A shielded address on the treasury's network: unified or Sapling.
create function private.zcash_address_ok(p_address text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case (select network from private.zcash_treasury where id)
    when 'test' then p_address ~ '^(utest1[02-9ac-hj-np-z]{60,}|ztestsapling1[02-9ac-hj-np-z]{60,})$'
    when 'main' then p_address ~ '^(u1[02-9ac-hj-np-z]{60,}|zs1[02-9ac-hj-np-z]{60,})$'
    else false
  end
$$;

create type public.zcash_return_status as enum ('due', 'sending', 'sent', 'failed');

create table public.zcash_returns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('payout', 'refund')),
  investment_id uuid not null references public.investments (id) on delete cascade,
  -- The instalment's payout leg it settles; none for a refund.
  leg_id uuid unique references public.settlement_legs (id) on delete cascade,
  amount_micro_usdc bigint not null check (amount_micro_usdc > 0),
  address text not null,
  status public.zcash_return_status not null default 'due',
  usd_per_zec_cents integer check (usd_per_zec_cents is null or usd_per_zec_cents > 0),
  amount_zat bigint check (amount_zat is null or amount_zat > 0),
  txid text unique check (txid is null or txid ~ '^[0-9a-f]{64}$'),
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  constraint payout_has_a_leg check ((kind = 'payout') = (leg_id is not null))
);
create unique index zcash_returns_refund_once on public.zcash_returns (investment_id) where kind = 'refund';

alter table public.zcash_returns enable row level security;
revoke all on public.zcash_returns from anon, authenticated;
grant select on public.zcash_returns to authenticated;
create policy zcash_returns_read on public.zcash_returns for select to authenticated using (
  (select private.is_auditor_or_admin())
  or exists (select 1 from public.investments i where i.id = investment_id and i.investor_id = (select auth.uid()))
);

create function private.zcash_return_address(p_investment_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select return_address from public.zcash_payment_requests where investment_id = p_investment_id $$;

-- Held payouts of an investment, owed as ZEC once it has a return address.
create function private.queue_zcash_payouts(p_investment_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_address text := private.zcash_return_address(p_investment_id);
  v_n integer;
begin
  if v_address is null then
    return 0;
  end if;
  insert into public.zcash_returns (kind, investment_id, leg_id, amount_micro_usdc, address)
  select 'payout', l.investment_id, l.id, l.amount_micro_usdc, v_address
  from public.settlement_legs l
  join public.investments i on i.id = l.investment_id
  where l.investment_id = p_investment_id and l.kind = 'payout' and l.status = 'held'
    and i.mode = 'zcash' and i.wallet_address is null
  on conflict (leg_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- An instalment's share held for a ZEC investor with an address: owed at once.
create function private.zcash_payout_on_leg() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.queue_zcash_payouts(new.investment_id);
  return null;
end;
$$;
create trigger zcash_payout_on_leg after insert on public.settlement_legs
  for each row when (new.kind = 'payout' and new.status = 'held')
  execute function private.zcash_payout_on_leg();

-- A ZEC allocation refunded to the ramp is owed back to the investor as ZEC.
create function private.zcash_refund_on_refunded() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_address text := private.zcash_return_address(new.id);
begin
  if v_address is not null then
    insert into public.zcash_returns (kind, investment_id, amount_micro_usdc, address)
    values ('refund', new.id, new.amount_micro_usdc, v_address)
    on conflict (investment_id) where kind = 'refund' do nothing;
  end if;
  return null;
end;
$$;
create trigger zcash_refund_on_refunded after update of status on public.investments
  for each row when (new.status = 'refunded' and old.status is distinct from 'refunded'
    and new.mode = 'zcash' and new.wallet_address is null and not new.is_simulated)
  execute function private.zcash_refund_on_refunded();

-- The investor's own choice of where ZEC comes back to.
create function public.set_zcash_return_address(p_investment_id uuid, p_address text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_inv public.investments;
  v_address text := lower(trim(p_address));
  v_queued integer;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or v_inv.investor_id is distinct from auth.uid() then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  if v_inv.mode <> 'zcash' then
    raise exception 'not_a_zcash_position' using errcode = 'P0001';
  end if;
  if not private.zcash_address_ok(v_address) then
    raise exception 'invalid_zcash_address' using errcode = '22023';
  end if;
  update public.zcash_payment_requests set return_address = v_address where investment_id = p_investment_id;
  -- What is still owed goes to the new address; what was sent stays sent.
  update public.zcash_returns set address = v_address where investment_id = p_investment_id and status = 'due';
  v_queued := private.queue_zcash_payouts(p_investment_id);
  -- Already refunded to the ramp, before there was an address: owed now.
  if v_inv.status = 'refunded' and v_inv.wallet_address is null then
    insert into public.zcash_returns (kind, investment_id, amount_micro_usdc, address)
    values ('refund', v_inv.id, v_inv.amount_micro_usdc, v_address)
    on conflict (investment_id) where kind = 'refund' do nothing;
  end if;
  return jsonb_build_object('return_address', v_address, 'payouts_queued', v_queued);
end;
$$;

-- The same, given with the payment request, before there is a position.
create function public.set_zcash_request_return_address(p_request_id uuid, p_address text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_req public.zcash_payment_requests;
  v_address text := lower(trim(p_address));
begin
  select * into v_req from public.zcash_payment_requests where id = p_request_id;
  if not found or v_req.investor_id is distinct from auth.uid() then
    raise exception 'not_your_request' using errcode = '42501';
  end if;
  if v_req.investment_id is not null then
    return public.set_zcash_return_address(v_req.investment_id, v_address);
  end if;
  if not private.zcash_address_ok(v_address) then
    raise exception 'invalid_zcash_address' using errcode = '22023';
  end if;
  update public.zcash_payment_requests set return_address = v_address where id = p_request_id;
  return jsonb_build_object('return_address', v_address, 'payouts_queued', 0);
end;
$$;

-- --------------------------------------------------------- refunds

-- A ZEC allocation owed back, with a return address and no wallet, is now
-- claimed too: its USDC goes from the vault to the ramp (the operator), which
-- vault-refund sends when the claim carries no wallet.
create or replace function public.refund_claim(p_limit integer default 5)
returns table (id uuid, wallet_address text, amount_micro_usdc bigint, refund_signature text, refund_valid_until bigint)
language sql security definer set search_path = ''
as $$
  update public.investments i
  set refund_claimed_at = now()
  where i.id in (
    select c.id from public.investments c
    where c.status = 'refund_due' and c.mode in ('wallet', 'zcash')
      and (c.wallet_address is not null or (c.mode = 'zcash' and private.zcash_return_address(c.id) is not null))
      and not c.is_simulated and c.refund_error is null
      and (c.refund_claimed_at is null or c.refund_claimed_at < now() - interval '2 minutes')
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning i.id, i.wallet_address, i.amount_micro_usdc, i.refund_signature, i.refund_valid_until;
$$;

create or replace function private.dispatch_refunds()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.investments c
    where c.status = 'refund_due' and c.mode in ('wallet', 'zcash')
      and (c.wallet_address is not null or (c.mode = 'zcash' and private.zcash_return_address(c.id) is not null))
      and not c.is_simulated and c.refund_error is null
      and (c.refund_claimed_at is null or c.refund_claimed_at < now() - interval '2 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_refunds: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;

  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/vault-refund'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

-- ------------------------------------------------------- the operator's side

create function public.zcash_returns_claim(p_limit integer default 5)
returns table (id uuid, kind text, amount_micro_usdc bigint, address text, ref text, instalment_no integer)
language sql security definer set search_path = ''
as $$
  update public.zcash_returns r
  set status = 'sending', claimed_at = now()
  where r.id in (
    select c.id from public.zcash_returns c where c.status = 'due' order by c.created_at
    limit greatest(1, least(p_limit, 20)) for update skip locked
  )
  returning r.id, r.kind, r.amount_micro_usdc, r.address,
    (select z.ref from public.zcash_payment_requests z where z.investment_id = r.investment_id),
    (select p.instalment_no from public.settlement_legs l join public.payments p on p.id = l.payment_id where l.id = r.leg_id);
$$;

create function public.zcash_return_sent(p_id uuid, p_txid text, p_amount_zat bigint, p_usd_per_zec_cents integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.zcash_returns;
begin
  update public.zcash_returns
  set status = 'sent', txid = lower(p_txid), amount_zat = p_amount_zat, usd_per_zec_cents = p_usd_per_zec_cents,
      sent_at = now(), error = null
  where id = p_id and status = 'sending'
  returning * into v;
  if not found then
    raise exception 'return_not_sending' using errcode = 'P0001';
  end if;
  if v.leg_id is not null then
    update public.settlement_legs set status = 'done', done_at = now() where id = v.leg_id and status = 'held';
  end if;
end;
$$;

-- Nothing was sent (no quote, not enough in the treasury): back in the queue.
create function public.zcash_return_release(p_id uuid, p_error text default null)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_returns set status = 'due', claimed_at = null, error = left(p_error, 500)
  where id = p_id and status = 'sending';
$$;

-- The send failed in a way a person should look at.
create function public.zcash_return_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_returns set status = 'failed', error = left(p_error, 500)
  where id = p_id and status = 'sending';
$$;

-- ------------------------------------------------------------------ readers

create function public.zcash_position_returns(p_investment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv public.investments;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or not (v_inv.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'return_address', private.zcash_return_address(p_investment_id),
    'network', (select network from private.zcash_treasury where id),
    'returns', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'leg_id', r.leg_id, 'amount_micro_usdc', r.amount_micro_usdc,
        'amount_zat', r.amount_zat, 'usd_per_zec_cents', r.usd_per_zec_cents, 'status', r.status, 'txid', r.txid,
        'instalment_no', (select p.instalment_no from public.settlement_legs l join public.payments p on p.id = l.payment_id where l.id = r.leg_id),
        'created_at', private.iso(r.created_at), 'sent_at', private.iso(r.sent_at)) order by r.created_at)
      from public.zcash_returns r where r.investment_id = p_investment_id), '[]')
  );
end;
$$;

-- What the treasury paid back, for the audit console: by transaction, never by address.
create function public.audit_zcash_returns()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  return jsonb_build_object(
    'counts', (select coalesce(jsonb_object_agg(status, n), '{}') from (
        select status, count(*) n from public.zcash_returns group by status) s),
    'sent_zat', (select coalesce(sum(amount_zat), 0) from public.zcash_returns where status = 'sent'),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'ref', z.ref, 'amount_micro_usdc', r.amount_micro_usdc, 'amount_zat', r.amount_zat,
        'usd_per_zec_cents', r.usd_per_zec_cents, 'status', r.status, 'txid', r.txid, 'error', r.error,
        'created_at', private.iso(r.created_at), 'sent_at', private.iso(r.sent_at)) order by r.created_at desc)
      from public.zcash_returns r left join public.zcash_payment_requests z on z.investment_id = r.investment_id), '[]')
  );
end;
$$;

revoke all on function private.zcash_address_ok(text), private.zcash_return_address(uuid), private.queue_zcash_payouts(uuid),
  private.zcash_payout_on_leg(), private.zcash_refund_on_refunded() from public;
grant execute on function private.zcash_address_ok(text), private.zcash_return_address(uuid) to authenticated, service_role;

revoke all on function public.set_zcash_return_address(uuid, text), public.set_zcash_request_return_address(uuid, text),
  public.zcash_position_returns(uuid), public.audit_zcash_returns() from public, anon;
grant execute on function public.set_zcash_return_address(uuid, text), public.set_zcash_request_return_address(uuid, text),
  public.zcash_position_returns(uuid), public.audit_zcash_returns() to authenticated;

revoke all on function public.zcash_returns_claim(integer), public.zcash_return_sent(uuid, text, bigint, integer),
  public.zcash_return_release(uuid, text), public.zcash_return_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.zcash_returns_claim(integer), public.zcash_return_sent(uuid, text, bigint, integer),
  public.zcash_return_release(uuid, text), public.zcash_return_failed(uuid, text) to service_role;
