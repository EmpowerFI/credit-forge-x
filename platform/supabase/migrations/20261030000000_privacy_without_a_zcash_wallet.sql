-- Privacy without a Zcash wallet.
--
-- The question this answers: I want to pay with my Solana wallet only, and I
-- want privacy. The first half of the answer is that a devnet transfer is
-- public by construction — the sender, the amount and the moment are on the
-- explorer, and nothing Zcash does afterwards unpublishes them. So the deposit
-- stays public and the screens say so.
--
-- The second half is that everything coming *back* can be shielded, and that is
-- the half that is about her. A public payout tells anyone watching how large
-- her position is and how it is performing, instalment by instalment. Paid out
-- of the shielded treasury instead, the amount, the memo and her address are
-- unreadable on either chain.
--
-- What this hides and from whom, stated once so no screen has to guess: it
-- hides her returns from the public, not from EmpowerFI. The treasury makes the
-- payment, so EmpowerFI knows every figure, and so does the auditor its viewing
-- key is disclosed to. That is what a regulated desk is, and claiming otherwise
-- would be the lie.
--
-- The mechanism needed almost nothing new, because the shape was already right:
-- a payout leg is born `held` when there is no wallet to send USDC to, and the
-- only thing that ever closes a held leg is the ZEC sender. So a position whose
-- returns are shielded is one whose legs are born held *although* it has a
-- wallet — and double payment is impossible by construction rather than by a
-- check someone has to remember. `settle_claim` only ever touches `due`.
--
-- A refund follows the same road: the vault returns its USDC to the ramp (the
-- operator on devnet) rather than to her wallet, and the treasury pays the ZEC.
-- `refund_claim` therefore reports no wallet for a shielded position, which is
-- the signal `vault-refund` already reads.

-- Where a wallet investor's shielded address lives. A ZEC investor's stays on
-- the payment request that created the position, which is where it was already.
alter table public.investments add column shielded_return_address text;

comment on column public.investments.shielded_return_address is
  'Set by the investor: returns on this position leave the shielded treasury on Zcash instead of the vault on Solana. Validated by private.zcash_address_ok in set_zcash_return_address.';

-- Either place, one answer. Everything downstream asks this and nothing asks
-- about the mode any more: an address is the whole condition.
create or replace function private.zcash_return_address(p_investment_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select i.shielded_return_address from public.investments i where i.id = p_investment_id),
    (select r.return_address from public.zcash_payment_requests r where r.investment_id = p_investment_id))
$$;

-- --------------------------------------------------------------- the payout

-- Rebuilt from 20260919000300_settlement.sql. One clause changes: a leg is held
-- when there is nowhere on Solana to send it *or* when its returns are shielded.
create or replace function private.settle_on_payment() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.settlement_legs (kind, loan_id, payment_id, amount_cents, status, pix_e2e, done_at)
  values ('pix_in', new.loan_id, new.id, new.amount_cents, 'mock', private.mock_pix_e2e(new.paid_at), new.paid_at)
  on conflict (payment_id) where kind = 'pix_in' do nothing;

  insert into public.settlement_legs (kind, loan_id, payment_id, investment_id, amount_micro_usdc, destination, status)
  select 'payout', new.loan_id, new.id, s.investment_id, s.share, s.wallet_address,
    (case when s.wallet_address is null or s.shielded then 'held' else 'due' end)::public.settlement_leg_status
  from (
    select i.id as investment_id, i.wallet_address,
      private.zcash_return_address(i.id) is not null as shielded,
      private.share_usdc(new.amount_cents, i.amount_micro_usdc::numeric / o.funding_target_micro_usdc, o.fx_brl_per_usdc_milli) as share
    from public.loans l
    join public.qualified_credit_opportunities o on o.id = l.opportunity_id
    join public.investments i on i.opportunity_id = o.id
    where l.id = new.loan_id and i.status = 'allocated' and not i.is_simulated and i.mode in ('wallet', 'zcash')
  ) s
  where s.share > 0
  on conflict (payment_id, investment_id) where kind = 'payout' do nothing;
  return new;
end;
$$;

-- Rebuilt from 20260920000200_zcash_returns.sql. The mode and the absence of a
-- wallet stop being the condition; the address is.
create or replace function private.queue_zcash_payouts(p_investment_id uuid)
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
    and i.mode in ('wallet', 'zcash') and not i.is_simulated
  on conflict (leg_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- --------------------------------------------------------------- the refund

-- The trigger's own condition drops the mode and the wallet: the function
-- already returns without doing anything when there is no address.
drop trigger if exists zcash_refund_on_refunded on public.investments;
create trigger zcash_refund_on_refunded after update of status on public.investments
  for each row when (new.status = 'refunded' and old.status is distinct from 'refunded'
    and new.mode in ('wallet', 'zcash') and not new.is_simulated)
  execute function private.zcash_refund_on_refunded();

-- Rebuilt from 20260920000200_zcash_returns.sql. A shielded position reports no
-- wallet, which is how vault-refund already knows to send to the ramp instead.
create or replace function public.refund_claim(p_limit integer default 5)
returns table (id uuid, wallet_address text, amount_micro_usdc bigint, refund_signature text, refund_valid_until bigint)
language sql security definer set search_path = ''
as $$
  update public.investments i
  set refund_claimed_at = now()
  where i.id in (
    select c.id from public.investments c
    where c.status = 'refund_due' and c.mode in ('wallet', 'zcash')
      and (c.wallet_address is not null or private.zcash_return_address(c.id) is not null)
      and not c.is_simulated and c.refund_error is null
      and (c.refund_claimed_at is null or c.refund_claimed_at < now() - interval '2 minutes')
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning i.id,
    case when private.zcash_return_address(i.id) is not null then null else i.wallet_address end,
    i.amount_micro_usdc, i.refund_signature, i.refund_valid_until;
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
      and (c.wallet_address is not null or private.zcash_return_address(c.id) is not null)
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
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
end;
$$;

-- ------------------------------------------------------------- her choice

-- Rebuilt from 20260920000200_zcash_returns.sql: a wallet position may choose
-- this too, and its address goes on the investment because it has no payment
-- request to carry one.
create or replace function public.set_zcash_return_address(p_investment_id uuid, p_address text)
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
  if v_inv.mode not in ('wallet', 'zcash') then
    raise exception 'not_a_shielded_position' using errcode = 'P0001';
  end if;
  if v_inv.is_simulated then
    raise exception 'not_a_shielded_position' using errcode = 'P0001';
  end if;
  if not private.zcash_address_ok(v_address) then
    raise exception 'invalid_zcash_address' using errcode = '22023';
  end if;
  if v_inv.mode = 'zcash' then
    update public.zcash_payment_requests set return_address = v_address where investment_id = p_investment_id;
  else
    update public.investments set shielded_return_address = v_address where id = p_investment_id;
  end if;
  -- What is still owed goes to the new address; what was sent stays sent.
  update public.zcash_returns set address = v_address where investment_id = p_investment_id and status = 'due';
  v_queued := private.queue_zcash_payouts(p_investment_id);
  -- Already refunded before there was an address: owed now.
  if v_inv.status = 'refunded' then
    insert into public.zcash_returns (kind, investment_id, amount_micro_usdc, address)
    values ('refund', v_inv.id, v_inv.amount_micro_usdc, v_address)
    on conflict (investment_id) where kind = 'refund' do nothing;
  end if;
  return jsonb_build_object('return_address', v_address, 'payouts_queued', v_queued);
end;
$$;
