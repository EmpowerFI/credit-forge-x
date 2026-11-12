-- Her rewards, paid out.
--
-- Founder's request, 12/11/2026: the entrepreneur sees on Today what she has
-- in rewards so far and, with one button, sends it to her account at a
-- partner (conta.vc). EmpowerFI takes its half of each campaign the same way.
-- All of it on Solana devnet for now; the last leg -- the partner giving the
-- address of her account there -- is to come, so on devnet she gives the
-- address herself.
--
-- The program (programs/empowerfi-rewards) gained three instructions:
--   set_payout       where her reward wallet pays out. A new destination
--                    waits a day (PAYOUT_DELAY) before anything goes there.
--   withdraw_reward  everything her wallet holds, to that destination.
--   withdraw_house   what is left of EmpowerFI's half of a campaign, only to
--                    the campaign's house wallet.
--
-- Each is an operation in public.payout_ops, a queue the Edge Function
-- reward-payout works through one transaction at a time, as campaign-attest
-- does with payments: the signature is written before the transaction is
-- sent. The diary and the dashboard ask; the function runs right after, and
-- pg_cron runs it every ten minutes for anything left.
--
-- Her balance is what was paid into her wallet, less what has gone out or is
-- on its way. Rewards of real campaigns, which EmpowerFI pays by hand today,
-- are not in it.

-- ------------------------------------------------------------ where she is paid out

create table private.reward_payouts (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  destination     text not null check (destination ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  -- Set when the program confirms it: a day after.
  active_from     timestamptz,
  updated_at      timestamptz not null default now()
);
alter table private.reward_payouts enable row level security;

-- ------------------------------------------------------------ the queue

create table public.payout_ops (
  id                      uuid primary key default gen_random_uuid(),
  kind                    text not null check (kind in ('set_payout', 'withdraw_reward', 'withdraw_house')),
  entrepreneur_id         uuid references public.entrepreneurs (id) on delete cascade,
  program_id              uuid references public.campaign_vaults (program_id) on delete restrict,
  destination             text not null check (destination ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  -- What went out, read from the chain when it was sent.
  amount_units            bigint check (amount_units is null or amount_units > 0),
  status                  text not null default 'pending' check (status in ('pending', 'sent', 'confirmed', 'failed')),
  signature               text,
  last_valid_block_height bigint,
  slot                    bigint,
  block_time              timestamptz,
  attempts                integer not null default 0,
  last_error              text check (last_error is null or char_length(last_error) <= 2000),
  requested_by            uuid,
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  constraint an_op_is_hers_or_a_campaigns check (
    (kind in ('set_payout', 'withdraw_reward') and entrepreneur_id is not null and program_id is null)
    or (kind = 'withdraw_house' and program_id is not null and entrepreneur_id is null)),
  constraint a_confirmed_op_says_where check ((status = 'confirmed') = (slot is not null))
);
-- One operation in flight per woman, and per campaign.
create unique index one_payout_op_in_flight_per_woman on public.payout_ops (entrepreneur_id)
  where status in ('pending', 'sent') and entrepreneur_id is not null;
create unique index one_payout_op_in_flight_per_campaign on public.payout_ops (program_id)
  where status in ('pending', 'sent') and program_id is not null;
alter table public.payout_ops enable row level security;
revoke all on public.payout_ops from anon, authenticated;

-- ------------------------------------------------------------ her figures

/** In her wallet's token units: paid in, less what went out or is on its way. */
create function private.reward_balance(p_entrepreneur_id uuid)
returns table (paid bigint, withdrawn bigint, balance bigint)
language sql stable security definer set search_path = ''
as $$
  with p as (
    select coalesce(sum(cp.amount_units), 0)::bigint as paid
      from public.campaign_payments cp
      join private.reward_wallets w on w.ref = cp.wallet_ref
     where w.entrepreneur_id = p_entrepreneur_id and cp.status = 'confirmed'
  ), o as (
    select coalesce(sum(o.amount_units) filter (where o.status = 'confirmed'), 0)::bigint as out_confirmed,
           bool_or(o.status in ('pending', 'sent')) as in_flight
      from public.payout_ops o
     where o.entrepreneur_id = p_entrepreneur_id and o.kind = 'withdraw_reward'
  )
  -- A withdrawal on its way takes everything there is.
  select p.paid, o.out_confirmed,
         case when coalesce(o.in_flight, false) then 0 else greatest(p.paid - o.out_confirmed, 0) end
    from p, o
$$;

/**
 * Her rewards on Today: the balance, where it goes, and what went out.
 * Decimals are the mint's (devnet USDC, 6).
 */
create function public.diary_rewards()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  b record;
  v_payout private.reward_payouts%rowtype;
begin
  select * into b from private.reward_balance(v_me);
  select * into v_payout from private.reward_payouts where entrepreneur_id = v_me;
  return jsonb_build_object(
    'network', 'devnet',
    'decimals', 6,
    'paid_units', b.paid,
    'withdrawn_units', b.withdrawn,
    'balance_units', b.balance,
    'destination', v_payout.destination,
    'destination_active_from', v_payout.active_from,
    'in_flight', (select jsonb_build_object('kind', o.kind, 'status', o.status, 'destination', o.destination,
                                            'amount_units', o.amount_units, 'created_at', o.created_at,
                                            'last_error', o.last_error)
                    from public.payout_ops o
                   where o.entrepreneur_id = v_me and o.status in ('pending', 'sent')
                   order by o.created_at limit 1),
    'last_failed', (select jsonb_build_object('kind', o.kind, 'created_at', o.created_at)
                      from public.payout_ops o
                     where o.entrepreneur_id = v_me and o.status = 'failed'
                       and o.created_at > coalesce((select max(x.created_at) from public.payout_ops x
                                                     where x.entrepreneur_id = v_me and x.status = 'confirmed'), '-infinity')
                     order by o.created_at desc limit 1),
    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object('amount_units', o.amount_units, 'destination', o.destination,
                                          'confirmed_at', o.confirmed_at, 'signature', o.signature)
                       order by o.confirmed_at desc)
        from (select * from public.payout_ops o
               where o.entrepreneur_id = v_me and o.kind = 'withdraw_reward' and o.status = 'confirmed'
               order by o.confirmed_at desc limit 20) o), '[]'::jsonb)
  );
end $$;

/**
 * Where her rewards go: on devnet, an address she gives; later, her account
 * at the partner. It waits a day once the program has it.
 */
create function public.diary_payout_set(p_destination text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_dest text := btrim(coalesce(p_destination, ''));
  v_wallet text;
begin
  if v_dest !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'payout_destination_invalid' using errcode = '22023';
  end if;
  select address into v_wallet from private.reward_wallets where entrepreneur_id = v_me;
  if v_dest = v_wallet then
    raise exception 'payout_destination_invalid' using errcode = '22023';
  end if;
  -- The program lets only the operator of a campaign that paid her write it.
  if (select paid from private.reward_balance(v_me)) = 0 then
    raise exception 'no_reward_yet' using errcode = '22023';
  end if;
  if exists (select 1 from private.reward_payouts where entrepreneur_id = v_me and destination = v_dest) then
    return public.diary_rewards();
  end if;
  if exists (select 1 from public.payout_ops where entrepreneur_id = v_me and status in ('pending', 'sent')) then
    raise exception 'payout_in_flight' using errcode = '55000';
  end if;
  insert into public.payout_ops (kind, entrepreneur_id, destination, requested_by)
  values ('set_payout', v_me, v_dest, auth.uid());
  return public.diary_rewards();
end $$;

/** Sends everything she has to her destination, once it is active. */
create function public.diary_reward_withdraw()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_payout private.reward_payouts%rowtype;
begin
  select * into v_payout from private.reward_payouts where entrepreneur_id = v_me;
  if v_payout.entrepreneur_id is null or v_payout.active_from is null then
    raise exception 'payout_destination_missing' using errcode = '55000';
  end if;
  if v_payout.active_from > now() then
    raise exception 'payout_destination_not_active' using errcode = '55000';
  end if;
  if exists (select 1 from public.payout_ops where entrepreneur_id = v_me and status in ('pending', 'sent')) then
    raise exception 'payout_in_flight' using errcode = '55000';
  end if;
  if (select balance from private.reward_balance(v_me)) <= 0 then
    raise exception 'nothing_to_withdraw' using errcode = '22023';
  end if;
  insert into public.payout_ops (kind, entrepreneur_id, destination, requested_by)
  values ('withdraw_reward', v_me, v_payout.destination, auth.uid());
  return public.diary_rewards();
end $$;

-- ------------------------------------------------------------ EmpowerFI's half

/** Each vault campaign: EmpowerFI's half, what it took, what is left. For the dashboard. */
create function public.house_withdrawals()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'program_id', v.program_id, 'name', g.name, 'house_wallet', v.house_wallet,
             'decimals', v.mint_decimals,
             'house_share_units', v.funded_units * v.house_share_bps / 10000,
             'withdrawn_units', w.withdrawn,
             'left_units', v.funded_units * v.house_share_bps / 10000 - w.withdrawn,
             'in_flight', exists (select 1 from public.payout_ops o where o.program_id = v.program_id
                                   and o.status in ('pending', 'sent')),
             'last_signature', (select o.signature from public.payout_ops o where o.program_id = v.program_id
                                  and o.status = 'confirmed' order by o.confirmed_at desc limit 1)
           ) order by g.period_start desc, g.name)
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      cross join lateral (select coalesce(sum(o.amount_units), 0)::bigint as withdrawn from public.payout_ops o
                           where o.program_id = v.program_id and o.status = 'confirmed') w
  ), '[]'::jsonb);
end $$;

create function public.house_withdraw(p_program_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.campaign_vaults%rowtype;
begin
  perform private.require_campaign_manager();
  select * into v from public.campaign_vaults where program_id = p_program_id;
  if v.program_id is null then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.payout_ops where program_id = p_program_id and status in ('pending', 'sent')) then
    raise exception 'payout_in_flight' using errcode = '55000';
  end if;
  if v.funded_units * v.house_share_bps / 10000 <= (select coalesce(sum(amount_units), 0) from public.payout_ops
                                                     where program_id = p_program_id and status = 'confirmed') then
    raise exception 'nothing_to_withdraw' using errcode = '22023';
  end if;
  insert into public.payout_ops (kind, program_id, destination, requested_by)
  values ('withdraw_house', p_program_id, v.house_wallet, auth.uid());
  return public.house_withdrawals();
end $$;

-- ------------------------------------------------------------ for reward-payout

/**
 * The operation in flight, else the next pending, with what its transaction
 * needs: her wallet ref and a campaign that paid her (its receipt lets the
 * operator act for her), or the campaign whose half is taken.
 */
create function public.payout_op_next()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
           'id', o.id, 'kind', o.kind, 'status', o.status, 'destination', o.destination,
           'signature', o.signature, 'last_valid_block_height', o.last_valid_block_height,
           'wallet_ref', w.ref, 'wallet_address', w.address,
           'program_address', cv.program_address, 'campaign_address', cv.campaign_address,
           'vault_address', cv.vault_address, 'mint', cv.mint, 'operator_wallet', cv.operator_wallet,
           'house_wallet', cv.house_wallet,
           -- What the program will send of EmpowerFI's half: all it has not taken yet.
           'house_left_units', case when o.kind = 'withdraw_house' then
             cv.funded_units * cv.house_share_bps / 10000
             - (select coalesce(sum(x.amount_units), 0) from public.payout_ops x
                 where x.program_id = o.program_id and x.status = 'confirmed') end)
    from public.payout_ops o
    left join private.reward_wallets w on w.entrepreneur_id = o.entrepreneur_id
    left join lateral (
      select v.* from public.campaign_vaults v
       where (o.program_id is not null and v.program_id = o.program_id)
          or (o.program_id is null and exists (
                select 1 from public.campaign_payments p
                 where p.program_id = v.program_id and p.wallet_ref = w.ref and p.status = 'confirmed'))
       order by v.funded_at desc limit 1) cv on true
   where o.status in ('pending', 'sent')
   order by (o.status = 'sent') desc, o.created_at
   limit 1
$$;

create function public.payout_op_sent(p_id uuid, p_signature text, p_last_valid_block_height bigint, p_amount_units bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.payout_ops
     set status = 'sent', signature = p_signature, last_valid_block_height = p_last_valid_block_height,
         amount_units = p_amount_units, attempts = attempts + 1
   where id = p_id and status = 'pending'
$$;

create function public.payout_op_confirmed(p_id uuid, p_slot bigint, p_block_time timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  o public.payout_ops%rowtype;
begin
  update public.payout_ops
     set status = 'confirmed', slot = p_slot, block_time = p_block_time, confirmed_at = now(), last_error = null
   where id = p_id and status = 'sent'
  returning * into o;
  if o.kind = 'set_payout' then
    -- The program waits a day from the block that wrote it.
    insert into private.reward_payouts (entrepreneur_id, destination, active_from, updated_at)
    values (o.entrepreneur_id, o.destination, coalesce(p_block_time, now()) + interval '1 day', now())
    on conflict (entrepreneur_id) do update
      set destination = excluded.destination, active_from = excluded.active_from, updated_at = now();
  end if;
end $$;

/** Expired without landing: send again. */
create function public.payout_op_retry(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payout_ops
     set status = 'pending', signature = null, last_valid_block_height = null, last_error = left(p_error, 2000)
   where id = p_id and status in ('pending', 'sent')
$$;

create function public.payout_op_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payout_ops set status = 'failed', last_error = left(p_error, 2000)
   where id = p_id and status <> 'confirmed'
$$;

create function public.payout_op_note(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payout_ops set last_error = left(p_error, 2000) where id = p_id
$$;

-- ------------------------------------------------------------ every ten minutes

/** Runs reward-payout when something waits; its address is campaign-attest's, renamed. */
create function private.dispatch_reward_payout()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.payout_ops where status in ('pending', 'sent')) then
    return;
  end if;
  select replace(decrypted_secret, 'campaign-attest', 'reward-payout') into v_url
    from vault.decrypted_secrets where name = 'campaign_attest_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'campaign_attest_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_reward_payout: vault secrets campaign_attest_url / campaign_attest_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-attest-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('reward-payout', '*/10 * * * *', $$select private.dispatch_reward_payout()$$);

-- ------------------------------------------------------------ grants

revoke execute on function private.reward_balance(uuid), private.dispatch_reward_payout() from public, anon, authenticated;

revoke execute on function public.diary_rewards(), public.diary_payout_set(text), public.diary_reward_withdraw(),
  public.house_withdrawals(), public.house_withdraw(uuid) from public, anon;
grant execute on function public.diary_rewards(), public.diary_payout_set(text), public.diary_reward_withdraw(),
  public.house_withdrawals(), public.house_withdraw(uuid) to authenticated;

revoke execute on function public.payout_op_next(), public.payout_op_sent(uuid, text, bigint, bigint),
  public.payout_op_confirmed(uuid, bigint, timestamptz), public.payout_op_retry(uuid, text),
  public.payout_op_failed(uuid, text), public.payout_op_note(uuid, text) from public, anon, authenticated;
grant execute on function public.payout_op_next(), public.payout_op_sent(uuid, text, bigint, bigint),
  public.payout_op_confirmed(uuid, bigint, timestamptz), public.payout_op_retry(uuid, text),
  public.payout_op_failed(uuid, text), public.payout_op_note(uuid, text) to service_role;
