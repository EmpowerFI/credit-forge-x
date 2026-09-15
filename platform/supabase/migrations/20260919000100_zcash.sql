-- Invest with shielded ZEC (R5).
--
-- An investor asks to fund an opportunity with ZEC. EmpowerFI answers with a
-- ZIP 321 payment request to its shielded treasury on Zcash testnet: the
-- amount at a quote, and a memo carrying a random reference. Only the payer
-- and the holder of the treasury's viewing key can read the amount, the memo
-- or who paid.
--
-- The zcash-watch function holds that viewing key. It scans each new block,
-- records every note the treasury received, and matches memos to requests.
-- After two confirmations the operator credits the vault with the same value
-- in devnet USDC (NEAR Intents converts ZEC to USDC on Solana in production;
-- it has no testnet, so this leg is the operator's, and labelled so). That
-- credit is recorded as an allocation like any other, proven on Solana.
--
-- The auditor gets the viewing key, so the treasury's receipts can be checked
-- in any Zcash wallet without asking anyone: disclosure is selective, not public.

-- ------------------------------------------------------------ the treasury

-- One row. The viewing key never leaves the database except to the watcher
-- and to auditors; it is set by scripts/platform/zcash-treasury.mts, not by a
-- migration, so it is not in the repository.
create table private.zcash_treasury (
  id boolean primary key default true check (id),
  network text not null check (network in ('test', 'main')),
  address text not null,
  ufvk text not null,
  birthday_height bigint not null check (birthday_height > 0),
  scanned_height bigint,
  scanned_hash text,
  tip_height bigint,
  scanned_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Confirmations before a payment is credited. Testnet blocks are ~75 s apart.
create function private.zcash_confirmations()
returns integer
language sql immutable set search_path = ''
as $$ select 2 $$;

-- Minutes an unpaid request holds its share of the opportunity.
create function private.zcash_request_minutes()
returns integer
language sql immutable set search_path = ''
as $$ select 30 $$;

create function public.zcash_configure_treasury(p_network text, p_address text, p_ufvk text, p_birthday_height bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_network not in ('test', 'main') then
    raise exception 'invalid_network' using errcode = '22023';
  end if;
  if p_address !~ (case p_network when 'test' then '^utest1[0-9a-z]+$' else '^u1[0-9a-z]+$' end) then
    raise exception 'not_a_unified_address' using errcode = '22023';
  end if;
  if p_ufvk !~ (case p_network when 'test' then '^uviewtest1[0-9a-z]+$' else '^uview1[0-9a-z]+$' end) then
    raise exception 'not_a_viewing_key' using errcode = '22023';
  end if;

  insert into private.zcash_treasury (id, network, address, ufvk, birthday_height)
  values (true, p_network, p_address, p_ufvk, p_birthday_height)
  on conflict (id) do update
  set network = excluded.network, address = excluded.address, ufvk = excluded.ufvk,
      birthday_height = excluded.birthday_height,
      -- A different key starts over from its birthday.
      scanned_height = case when private.zcash_treasury.ufvk = excluded.ufvk then private.zcash_treasury.scanned_height end,
      scanned_hash = case when private.zcash_treasury.ufvk = excluded.ufvk then private.zcash_treasury.scanned_hash end,
      updated_at = now();
  return jsonb_build_object('network', p_network, 'address', p_address, 'birthday_height', p_birthday_height);
end;
$$;

-- --------------------------------------------------------------- requests

create type public.zcash_request_status as enum (
  'awaiting',   -- shown to the investor, not paid yet
  'seen',       -- paid, in a block, waiting for confirmations
  'confirmed',  -- confirmed; the operator credits the vault next
  'credited',   -- the vault holds the USDC and the allocation is recorded
  'underpaid',  -- paid less than asked: nothing allocated, for a human to settle
  'expired',    -- never paid
  'failed'      -- paid, but could not be allocated (see error)
);

create table public.zcash_payment_requests (
  id uuid primary key default gen_random_uuid(),
  -- In the memo. Random, so it says nothing about the investor or the opportunity.
  ref text not null unique check (ref ~ '^EFI-[A-Z0-9]{10}$'),
  investor_id uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.qualified_credit_opportunities (id) on delete cascade,
  amount_micro_usdc bigint not null check (amount_micro_usdc > 0),
  usd_per_zec_cents integer not null check (usd_per_zec_cents > 0),
  quote_source text not null check (quote_source in ('coingecko', 'demo')),
  amount_zat bigint not null check (amount_zat > 0),
  status public.zcash_request_status not null default 'awaiting',
  txid text,
  pool text check (pool in ('sapling', 'orchard', 'ironwood')),
  received_zat bigint,
  mined_height bigint,
  confirmed_at timestamptz,
  -- The operator's USDC transfer into the vault: signed and recorded before it is sent.
  credit_signature text unique,
  credit_valid_until bigint,
  credit_claimed_at timestamptz,
  investment_id uuid references public.investments (id) on delete set null,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index zcash_requests_investor_idx on public.zcash_payment_requests (investor_id, created_at desc);
create index zcash_requests_open_idx on public.zcash_payment_requests (opportunity_id) where status in ('awaiting', 'seen', 'confirmed');

alter table public.zcash_payment_requests enable row level security;
revoke all on public.zcash_payment_requests from anon, authenticated;
grant select on public.zcash_payment_requests to authenticated;
create policy zcash_requests_read on public.zcash_payment_requests for select to authenticated using (
  investor_id = (select auth.uid()) or (select private.is_auditor_or_admin())
);

-- Every note the treasury received, as its viewing key reads them. Kept even
-- when no request matches: the auditor sees everything the key sees.
create table public.zcash_receipts (
  txid text not null,
  pool text not null check (pool in ('sapling', 'orchard', 'ironwood')),
  output_index integer not null check (output_index >= 0),
  value_zat bigint not null check (value_zat >= 0),
  memo text,
  mined_height bigint not null,
  request_id uuid references public.zcash_payment_requests (id) on delete set null,
  seen_at timestamptz not null default now(),
  primary key (txid, pool, output_index)
);

alter table public.zcash_receipts enable row level security;
revoke all on public.zcash_receipts from anon, authenticated;
grant select on public.zcash_receipts to authenticated;
create policy zcash_receipts_read on public.zcash_receipts for select to authenticated using (
  (select private.is_auditor_or_admin())
);

-- 10 characters from an alphabet with no look-alikes.
create function private.zcash_ref()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_ref text := 'EFI-';
begin
  for i in 0..9 loop
    v_ref := v_ref || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 30, 1);
  end loop;
  return v_ref;
end;
$$;

-- USDC still open to new requests: the target, less what is funded, less
-- what live ZEC requests are holding.
create function private.zcash_room(p_opportunity_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select o.funding_target_micro_usdc - o.funded_micro_usdc - coalesce((
    select sum(r.amount_micro_usdc) from public.zcash_payment_requests r
    where r.opportunity_id = o.id
      and (r.status in ('seen', 'confirmed') or (r.status = 'awaiting' and r.expires_at > now()))
  ), 0)
  from public.qualified_credit_opportunities o where o.id = p_opportunity_id;
$$;

-- Called by the zcash-request function, which knows who is asking and fetched the quote.
create function public.create_zcash_request(
  p_investor_id uuid,
  p_opportunity_id uuid,
  p_amount_micro_usdc bigint,
  p_usd_per_zec_cents integer,
  p_quote_source text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_treasury private.zcash_treasury;
  v_opp public.qualified_credit_opportunities;
  v_zat bigint;
  v_request public.zcash_payment_requests;
begin
  select * into v_treasury from private.zcash_treasury where id;
  if not found then
    raise exception 'zcash_not_configured' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_investor_id and role = 'capital_provider') then
    raise exception 'not_an_investor' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.funding_status is distinct from 'open' and v_opp.funding_status is distinct from 'partially_funded' then
    raise exception 'opportunity_not_open' using errcode = 'P0001';
  end if;
  if p_amount_micro_usdc < 1000000 then
    raise exception 'amount_too_small' using errcode = '22023';
  end if;
  if p_amount_micro_usdc > private.zcash_room(p_opportunity_id) then
    raise exception 'exceeds_remaining' using errcode = '22023';
  end if;
  if p_usd_per_zec_cents <= 0 then
    raise exception 'invalid_quote' using errcode = '22023';
  end if;

  -- USDC is taken at one US dollar. zat = micro-USDC × 10⁸ / (10⁶ × dollars
  -- per ZEC), rounded up to a thousand zatoshis so the amount reads cleanly.
  v_zat := ceil(p_amount_micro_usdc * 10000.0 / p_usd_per_zec_cents / 1000) * 1000;

  insert into public.zcash_payment_requests (
    ref, investor_id, opportunity_id, amount_micro_usdc, usd_per_zec_cents, quote_source, amount_zat, expires_at
  ) values (
    private.zcash_ref(), p_investor_id, p_opportunity_id, p_amount_micro_usdc, p_usd_per_zec_cents, p_quote_source,
    v_zat, now() + make_interval(mins => private.zcash_request_minutes())
  ) returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id, 'ref', v_request.ref, 'address', v_treasury.address, 'network', v_treasury.network,
    'amount_zat', v_request.amount_zat, 'amount_micro_usdc', v_request.amount_micro_usdc,
    'usd_per_zec_cents', v_request.usd_per_zec_cents, 'quote_source', v_request.quote_source,
    'memo', 'EmpowerFI allocation ' || v_request.ref,
    'expires_at', private.iso(v_request.expires_at)
  );
end;
$$;

-- What the investor's screen shows while it waits, with the chain's progress.
create function public.zcash_request(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_r public.zcash_payment_requests;
  v_t private.zcash_treasury;
begin
  select * into v_r from public.zcash_payment_requests where id = p_id;
  if not found or not (v_r.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_request' using errcode = '42501';
  end if;
  select * into v_t from private.zcash_treasury where id;
  return jsonb_build_object(
    'id', v_r.id, 'ref', v_r.ref, 'status', v_r.status, 'address', v_t.address, 'network', v_t.network,
    'opportunity_id', v_r.opportunity_id, 'opportunity_code', private.opportunity_code(v_r.opportunity_id),
    'amount_zat', v_r.amount_zat, 'amount_micro_usdc', v_r.amount_micro_usdc,
    'usd_per_zec_cents', v_r.usd_per_zec_cents, 'quote_source', v_r.quote_source,
    'memo', 'EmpowerFI allocation ' || v_r.ref,
    'txid', v_r.txid, 'pool', v_r.pool, 'received_zat', v_r.received_zat, 'mined_height', v_r.mined_height,
    'confirmations', case when v_r.mined_height is not null and v_t.tip_height is not null
      then greatest(0, v_t.tip_height - v_r.mined_height + 1) end,
    'confirmations_needed', private.zcash_confirmations(),
    'scanned_height', v_t.scanned_height, 'scanned_at', private.iso(v_t.scanned_at),
    'credit_signature', v_r.credit_signature, 'investment_id', v_r.investment_id,
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_r.investment_id),
    'error', v_r.error,
    'expires_at', private.iso(v_r.expires_at), 'created_at', private.iso(v_r.created_at)
  );
end;
$$;

-- ---------------------------------------------------------------- watcher

-- Where the next scan starts, and the key to scan with.
create function public.zcash_watch_state()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'network', t.network, 'ufvk', t.ufvk,
    'from_height', coalesce(t.scanned_height + 1, t.birthday_height),
    'scanned_hash', t.scanned_hash,
    'awaiting', (select count(*) from public.zcash_payment_requests where status in ('awaiting', 'seen', 'confirmed'))
  )
  from private.zcash_treasury t where t.id;
$$;

-- One scan's results: the blocks it covered, the chain tip, and every output
-- the viewing key decrypted, as [{ txid, pool, index, value_zat, memo, height }].
-- Returns how many requests now wait for the operator's credit.
create function public.zcash_watch_record(p_tip bigint, p_to bigint, p_to_hash text, p_outputs jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_out jsonb;
  v_ref text;
  v_request public.zcash_payment_requests;
  v_seen integer := 0;
  v_confirmed integer;
begin
  for v_out in select * from jsonb_array_elements(coalesce(p_outputs, '[]'::jsonb)) loop
    v_ref := substring(v_out->>'memo' from 'EFI-[A-Z0-9]{10}');
    v_request := null;
    if v_ref is not null then
      select * into v_request from public.zcash_payment_requests where ref = v_ref for update;
    end if;

    insert into public.zcash_receipts (txid, pool, output_index, value_zat, memo, mined_height, request_id)
    values (v_out->>'txid', v_out->>'pool', (v_out->>'index')::integer, (v_out->>'value_zat')::bigint,
      left(v_out->>'memo', 512), (v_out->>'height')::bigint, v_request.id)
    on conflict (txid, pool, output_index) do nothing;

    -- The first payment for a request is the one that counts; a late one
    -- still counts while the opportunity has room, checked at credit time.
    if v_request.id is not null and v_request.status in ('awaiting', 'expired') then
      update public.zcash_payment_requests
      set status = 'seen', txid = v_out->>'txid', pool = v_out->>'pool',
          received_zat = (v_out->>'value_zat')::bigint, mined_height = (v_out->>'height')::bigint,
          updated_at = now()
      where id = v_request.id;
      v_seen := v_seen + 1;
    end if;
  end loop;

  -- Enough confirmations: credit, or hold if it paid less than asked (half a percent of slack).
  update public.zcash_payment_requests
  set status = (case when received_zat * 1000 >= amount_zat * 995 then 'confirmed' else 'underpaid' end)::public.zcash_request_status,
      confirmed_at = now(), updated_at = now(),
      error = case when received_zat * 1000 < amount_zat * 995 then 'paid less than requested' end
  where status = 'seen' and p_tip - mined_height + 1 >= private.zcash_confirmations();

  update public.zcash_payment_requests set status = 'expired', updated_at = now()
  where status = 'awaiting' and expires_at < now();

  update private.zcash_treasury
  set scanned_height = greatest(coalesce(scanned_height, 0), p_to),
      scanned_hash = case when p_to >= coalesce(scanned_height, 0) then p_to_hash else scanned_hash end,
      tip_height = p_tip, scanned_at = now()
  where id;

  select count(*) into v_confirmed from public.zcash_payment_requests where status = 'confirmed';
  return jsonb_build_object('seen', v_seen, 'to_credit', v_confirmed);
end;
$$;

-- ---------------------------------------------------------------- credit

-- The same never-twice discipline as refunds: claim, sign and record, send,
-- then look up before ever signing again. A request whose opportunity has
-- closed or filled meanwhile is failed here, before any USDC moves.
create function public.zcash_credit_claim(p_limit integer default 5)
returns table (id uuid, amount_micro_usdc bigint, credit_signature text, credit_valid_until bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  update public.zcash_payment_requests r
  set status = 'failed', updated_at = now(), error = 'the opportunity closed or filled before the payment confirmed'
  from public.qualified_credit_opportunities o
  where r.opportunity_id = o.id and r.status = 'confirmed' and r.credit_signature is null
    and (o.funding_status not in ('open', 'partially_funded')
      or o.funded_micro_usdc + r.amount_micro_usdc > o.funding_target_micro_usdc);

  return query
  update public.zcash_payment_requests r
  set credit_claimed_at = now()
  where r.id in (
    select c.id from public.zcash_payment_requests c
    where c.status = 'confirmed'
      and (c.credit_claimed_at is null or c.credit_claimed_at < now() - interval '2 minutes')
    order by c.confirmed_at
    limit p_limit
    for update skip locked
  )
  returning r.id, r.amount_micro_usdc, r.credit_signature, r.credit_valid_until;
end;
$$;

create function public.zcash_credit_sending(p_id uuid, p_signature text, p_valid_until bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_payment_requests
  set credit_signature = p_signature, credit_valid_until = p_valid_until, updated_at = now()
  where id = p_id and status = 'confirmed';
$$;

-- The USDC is in the vault: record the allocation, anchored like any other.
create function public.zcash_credit_done(p_id uuid, p_signature text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_r public.zcash_payment_requests;
  v_result jsonb;
begin
  select * into v_r from public.zcash_payment_requests where id = p_id for update;
  if not found or v_r.status <> 'confirmed' or v_r.credit_signature is distinct from p_signature then
    raise exception 'credit_not_pending' using errcode = 'P0001';
  end if;
  v_result := public.record_investment(
    v_r.investor_id, v_r.opportunity_id, v_r.amount_micro_usdc, 'zcash',
    (select wallet_address from public.profiles where id = v_r.investor_id), p_signature
  );
  update public.zcash_payment_requests
  set status = 'credited', investment_id = (v_result->>'id')::uuid, credit_claimed_at = null, updated_at = now()
  where id = p_id;
  return v_result;
end;
$$;

create function public.zcash_credit_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_payment_requests
  set status = 'failed', error = left(p_error, 500), credit_claimed_at = null, updated_at = now()
  where id = p_id and status = 'confirmed';
$$;

-- Every minute; the function scans whatever blocks are new. Same secret as anchor-submit.
create function private.dispatch_zcash_watch()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from private.zcash_treasury) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_zcash_watch: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/zcash-watch'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('zcash-watch', '* * * * *', 'select private.dispatch_zcash_watch()');

-- --------------------------------------------------- refunds and the vault

-- A ZEC allocation owed back returns as USDC to the investor's wallet, when
-- they have one. Without a wallet it stays due: in production it would go back
-- as ZEC to a shielded address, through the same conversion.
create or replace function public.refund_claim(p_limit integer default 5)
returns table (id uuid, wallet_address text, amount_micro_usdc bigint, refund_signature text, refund_valid_until bigint)
language sql security definer set search_path = ''
as $$
  update public.investments i
  set refund_claimed_at = now()
  where i.id in (
    select c.id from public.investments c
    where c.status = 'refund_due' and c.mode in ('wallet', 'zcash') and c.wallet_address is not null
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
    select 1 from public.investments
    where status = 'refund_due' and mode in ('wallet', 'zcash') and wallet_address is not null
      and not is_simulated and refund_error is null
      and (refund_claimed_at is null or refund_claimed_at < now() - interval '2 minutes')
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

-- ---------------------------------------------------------------- auditor

-- The treasury as its viewing key sees it: the key itself, how far the
-- watcher has read, every note received, and what each paid for.
create function public.audit_zcash()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_t private.zcash_treasury;
begin
  perform private.require_auditor();
  select * into v_t from private.zcash_treasury where id;
  if not found then
    return jsonb_build_object('configured', false);
  end if;
  return jsonb_build_object(
    'configured', true,
    'network', v_t.network, 'address', v_t.address, 'ufvk', v_t.ufvk, 'birthday_height', v_t.birthday_height,
    'scanned_height', v_t.scanned_height, 'tip_height', v_t.tip_height, 'scanned_at', private.iso(v_t.scanned_at),
    'confirmations_needed', private.zcash_confirmations(),
    'received_zat', (select coalesce(sum(value_zat), 0) from public.zcash_receipts),
    'requests', (select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.zcash_payment_requests group by status) s),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'txid', rc.txid, 'pool', rc.pool, 'index', rc.output_index, 'value_zat', rc.value_zat,
        'memo', rc.memo, 'height', rc.mined_height, 'seen_at', private.iso(rc.seen_at),
        'ref', r.ref, 'status', r.status, 'amount_micro_usdc', r.amount_micro_usdc,
        'opportunity_code', case when r.id is not null then private.opportunity_code(r.opportunity_id) end,
        'credit_signature', r.credit_signature,
        'allocation_signature', (select a.signature from public.chain_anchors a
          where a.kind = 'allocation' and a.entity_id = r.investment_id)
      ) order by rc.mined_height desc, rc.txid)
      from public.zcash_receipts rc left join public.zcash_payment_requests r on r.id = rc.request_id
    ), '[]')
  );
end;
$$;

-- The vault now holds ZEC credits too: expected is every real deposit, by
-- wallet or by the operator for a ZEC payment.
create or replace function public.audit_system()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_jobs jsonb;
begin
  perform private.require_auditor();
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active)
      order by j.jobname), '[]')
    into v_jobs from cron.job j;
  exception when others then
    v_jobs := null;
  end;

  return jsonb_build_object(
    'anchors', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'submitted', count(*) filter (where status = 'submitted'),
        'failed', count(*) filter (where status = 'failed'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'oldest_queued_at', private.iso(min(created_at) filter (where status in ('pending', 'submitted'))),
        'last_confirmed_at', private.iso(max(confirmed_at)),
        'last_error', (select a.last_error from public.chain_anchors a
          where a.status = 'failed' order by a.id desc limit 1))
      from public.chain_anchors),
    'reconcile', (select jsonb_build_object(
        'verified', count(*) filter (where reconcile = 'verified'),
        'missing', count(*) filter (where reconcile = 'missing'),
        'mismatch', count(*) filter (where reconcile = 'mismatch'),
        'unchecked', count(*) filter (where reconcile = 'unchecked'),
        'last_at', private.iso(max(reconciled_at)),
        'oldest_at', private.iso(min(reconciled_at)))
      from public.chain_anchors where status = 'confirmed'),
    'refunds', (select jsonb_build_object(
        'due', count(*) filter (where status = 'refund_due' and refund_signature is null),
        'sending', count(*) filter (where status = 'refund_due' and refund_signature is not null),
        'refunded', count(*) filter (where status = 'refunded'),
        'last_at', private.iso(max(refunded_at)),
        'last_error', (select i.refund_error from public.investments i
          where i.refund_error is not null order by i.created_at desc limit 1))
      from public.investments where mode in ('wallet', 'zcash')),
    -- Real deposits still in the vault: allocated, or owed back and not yet sent.
    'vault', (select jsonb_build_object(
        'expected_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where status in ('allocated', 'refund_due')), 0),
        'deposited_micro_usdc', coalesce(sum(amount_micro_usdc), 0),
        'refunded_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where status = 'refunded'), 0),
        'deposits', count(*),
        'zcash_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where mode = 'zcash' and status in ('allocated', 'refund_due')), 0))
      from public.investments where mode in ('wallet', 'zcash')),
    'zcash', (select jsonb_build_object(
        'scanned_height', t.scanned_height, 'tip_height', t.tip_height, 'scanned_at', private.iso(t.scanned_at))
      from private.zcash_treasury t where t.id),
    'jobs', v_jobs
  );
end;
$$;

-- -------------------------------------------------------------- demo reset

create or replace function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;

  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  -- Receipts stay: they are the treasury's, read from Zcash. Only their link to a request goes.
  delete from public.zcash_payment_requests where true;
  delete from public.investments where true;
  delete from public.productive_outcomes where true;
  delete from public.payments where true;
  delete from public.loan_events where true;
  delete from public.loans where true;
  delete from public.partner_decisions where true;
  delete from public.qualified_credit_opportunities where true;
  delete from public.eligibility_assessments where true;
  delete from public.credit_intents where true;
  delete from public.readiness_assessments where true;
  delete from public.checkins where true;
  delete from public.consents where true;
  delete from public.education_progress where true;
  delete from public.education_programs where true;

  delete from public.communities where true;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32) where true;
  -- Deleting facts left their triggers' costs behind: clear them after too.
  delete from public.cost_events where true;

  return jsonb_build_object('anchors', v_anchors, 'communities', v_communities, 'entrepreneurs', v_entrepreneurs);
end;
$$;

-- ------------------------------------------------------------------ grants

revoke all on function private.zcash_confirmations(), private.zcash_request_minutes(), private.zcash_ref(),
  private.zcash_room(uuid), private.dispatch_zcash_watch() from public;
grant execute on function private.zcash_confirmations(), private.zcash_request_minutes(), private.zcash_room(uuid)
  to authenticated, service_role;

revoke all on function public.zcash_configure_treasury(text, text, text, bigint),
  public.create_zcash_request(uuid, uuid, bigint, integer, text),
  public.zcash_watch_state(), public.zcash_watch_record(bigint, bigint, text, jsonb),
  public.zcash_credit_claim(integer), public.zcash_credit_sending(uuid, text, bigint),
  public.zcash_credit_done(uuid, text), public.zcash_credit_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.zcash_configure_treasury(text, text, text, bigint),
  public.create_zcash_request(uuid, uuid, bigint, integer, text),
  public.zcash_watch_state(), public.zcash_watch_record(bigint, bigint, text, jsonb),
  public.zcash_credit_claim(integer), public.zcash_credit_sending(uuid, text, bigint),
  public.zcash_credit_done(uuid, text), public.zcash_credit_failed(uuid, text) to service_role;

revoke all on function public.zcash_request(uuid), public.audit_zcash() from public, anon;
grant execute on function public.zcash_request(uuid), public.audit_zcash() to authenticated;
