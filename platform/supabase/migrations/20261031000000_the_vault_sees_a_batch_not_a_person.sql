-- The vault sees a batch, not a person.
--
-- A shielded payment is unreadable on Zcash, and then the operator credited
-- the vault with that investor's exact amount, one minute later. The envelope
-- was sealed and its shadow gave away the contents: anyone watching the vault
-- read the size of every ZEC-paid position, and a distinctive amount is an
-- identifier even when no name is attached to it.
--
-- So credits are now made in batches, rounded DOWN to whole units, and what is
-- left over waits for the next batch. The chain sees one round number that is
-- the sum of nobody: rounding down means the operator never moves money it has
-- not received, and the shortfall it creates can never exceed one unit, because
-- the remainder is carried forward and credited in the batch after. Rounding up
-- would have been the mirror image and the dangerous one — it commits money
-- that has not arrived, and applied per batch it accumulates without bound.
--
-- The three rules of that arithmetic are constraints here rather than care in
-- the edge function: the carry stays under one unit, a credit is always whole
-- units, and the arithmetic closes. A batch that breaks any of them cannot be
-- written at all.
--
-- What this costs, stated rather than hidden: the vault holds less than the
-- book, by less than one unit, between batches. That difference belongs to no
-- single investor — attributing it would rebuild the very link the batch
-- exists to break — so it is a pool-level timing difference, and the audit read
-- shows it as the queue it is.
--
-- The schema defended the leak with two constraints, which is why this file is
-- not a small change: `investments.deposit_signature unique` plus
-- `real_money_has_a_deposit` together say that every real position owns a
-- Solana transfer of its own. That invariant becomes "every real position owns
-- a batch", and uniqueness stays exactly where it still protects — a direct
-- deposit from an investor's own wallet, which must never be counted twice.
--
-- Deploy pairing: this migration drops zcash_credit_claim / _sending / _done,
-- so platform/supabase/functions/zcash-watch must be deployed with it.
--
-- record_investment is rebuilt from 20261029000300_admission_is_earned_by_the_
-- transfer.sql, which is where it was last defined.

create type public.zcash_batch_status as enum ('open', 'sending', 'credited', 'failed');

create table public.zcash_credit_batches (
  id uuid primary key default gen_random_uuid(),
  -- The operator's single USDC transfer into the vault: signed and recorded
  -- before it is sent, as refunds and per-request credits already were. Null
  -- while the batch is forming, and null for good on a batch that rounded down
  -- to nothing — under one unit there is no whole unit to move.
  signature text unique,
  valid_until bigint,
  status public.zcash_batch_status not null default 'open',
  unit_micro_usdc bigint not null check (unit_micro_usdc > 0),
  -- The arithmetic, kept so the audit read can show the queue instead of
  -- asserting it.
  carried_in_micro_usdc bigint not null check (carried_in_micro_usdc >= 0),
  target_micro_usdc bigint not null check (target_micro_usdc > 0),
  credited_micro_usdc bigint not null check (credited_micro_usdc >= 0),
  carried_out_micro_usdc bigint not null check (carried_out_micro_usdc >= 0),
  claimed_at timestamptz,
  confirmed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint the_arithmetic_closes
    check (target_micro_usdc = credited_micro_usdc + carried_out_micro_usdc),
  constraint the_carry_stays_under_one_unit
    check (carried_out_micro_usdc < unit_micro_usdc),
  constraint a_credit_is_whole_units
    check (credited_micro_usdc % unit_micro_usdc = 0)
);

create index zcash_credit_batches_status_idx on public.zcash_credit_batches (status, created_at);

-- Service-role and security-definer functions only: nothing here is a screen's
-- business, and the audit read below is what the product sees. Row level
-- security alone would have been enough to block a reader, but the schema's
-- default privileges hand every new table to anon and authenticated, and the
-- rule here is that no table is reachable directly at all.
alter table public.zcash_credit_batches enable row level security;
revoke all on table public.zcash_credit_batches from anon, authenticated;

alter table public.zcash_payment_requests
  add column credit_batch_id uuid references public.zcash_credit_batches (id) on delete set null;
create index zcash_requests_batch_idx on public.zcash_payment_requests (credit_batch_id);

comment on column public.zcash_payment_requests.credit_batch_id is
  'The batch whose single USDC transfer credited this payment. Set once, by zcash_batch_claim.';

alter table public.investments
  add column credit_batch_id uuid references public.zcash_credit_batches (id) on delete set null;
create index investments_credit_batch_idx on public.investments (credit_batch_id);

comment on column public.investments.credit_batch_id is
  'For a ZEC-paid position: the batch that carried its capital into the vault. Its amount is not readable on Solana, which is the point.';

-- Real money still has to arrive, but it may arrive inside a batch. The
-- uniqueness of deposit_signature is untouched: a direct transfer from an
-- investor's own wallet still cannot be counted twice.
alter table public.investments drop constraint real_money_has_a_deposit;
alter table public.investments add constraint real_money_has_a_deposit
  check (mode = 'simulated' or deposit_signature is not null or credit_batch_id is not null);

-- ------------------------------------------------------------ record_investment

-- A ninth parameter with a default would create an overload rather than replace
-- the function, and every existing eight-argument call would stop resolving.
drop function public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz);

create function public.record_investment(
  p_investor_id uuid,
  p_opportunity_id uuid,
  p_amount_micro_usdc bigint,
  p_mode public.investment_mode,
  p_wallet_address text default null,
  p_deposit_signature text default null,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now(),
  p_credit_batch_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_existing public.investments;
  v_id uuid;
  v_funded bigint;
  v_admits text;
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
    investor_id, opportunity_id, wallet_address, amount_micro_usdc, deposit_signature,
    mode, is_simulated, created_at, credit_batch_id
  ) values (
    p_investor_id, p_opportunity_id, p_wallet_address, p_amount_micro_usdc, p_deposit_signature,
    p_mode, p_is_simulated, p_created_at, p_credit_batch_id
  ) returning id into v_id;

  -- Admitted by the transfer. A batch-credited position is admitted by its
  -- batch: the capital arrived, and it would be a poor reward for choosing the
  -- private road to have the position stay unminted because the transfer that
  -- carried it was shared with others. The length test is not a base58 check;
  -- it is the table's own constraint, applied here so that a profile holding
  -- something that is not a Solana address cannot cost the investor her
  -- allocation.
  v_admits := coalesce(
    p_deposit_signature,
    (select b.signature from public.zcash_credit_batches b where b.id = p_credit_batch_id));
  if p_wallet_address is not null
     and (p_deposit_signature is not null or p_credit_batch_id is not null)
     and length(p_wallet_address) between 32 and 44
  then
    insert into public.eligible_wallets (wallet, label, note, admitted_by, active, is_simulated)
    values (
      p_wallet_address,
      coalesce((select display_name from public.profiles where id = p_investor_id), 'Investidora'),
      case when v_admits is null
        then 'Admitted by a batch that rounded down to nothing'
        else 'Admitted by the deposit ' || v_admits end,
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

comment on function public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz, uuid) is
  'Books an allocation. A wallet that arrives with a verified deposit signature is admitted to eligible_wallets, so the position it paid for can mint to it without anyone being handed an address in advance. A ZEC-paid position is admitted by its batch instead, whose single transfer carried several positions and reveals none of their amounts.';

-- ------------------------------------------------------------ the batch

drop function public.zcash_credit_claim(integer);
drop function public.zcash_credit_sending(uuid, text, bigint);
drop function public.zcash_credit_done(uuid, text);

-- Forms the next batch, or hands back the one still in flight so it can be
-- finished rather than duplicated. Two things make a second credit impossible:
-- the lock, which serialises the claim, and the in-flight check, because the
-- carry of a batch that has not reached 'credited' has not been consumed yet
-- and a second batch reading the same carry would credit it twice.
create function public.zcash_batch_claim(
  p_unit_micro_usdc bigint default 1000000000,
  p_limit integer default 20
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.zcash_credit_batches;
  v_ids uuid[];
  v_sum bigint;
  v_carry bigint;
  v_credited bigint;
begin
  perform pg_advisory_xact_lock(hashtext('zcash_credit_batch'));

  select * into v_batch from public.zcash_credit_batches
  where status in ('open', 'sending')
  order by created_at
  limit 1;
  if found then
    return jsonb_build_object(
      'id', v_batch.id, 'status', v_batch.status, 'resumed', true,
      'unit_micro_usdc', v_batch.unit_micro_usdc,
      'target_micro_usdc', v_batch.target_micro_usdc,
      'credited_micro_usdc', v_batch.credited_micro_usdc,
      'carried_in_micro_usdc', v_batch.carried_in_micro_usdc,
      'carried_out_micro_usdc', v_batch.carried_out_micro_usdc,
      'signature', v_batch.signature, 'valid_until', v_batch.valid_until,
      'requests', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = v_batch.id));
  end if;

  -- The same pre-fail as the per-request credit: a payment whose opportunity
  -- closed or filled while it confirmed never reaches a batch at all.
  update public.zcash_payment_requests r
  set status = 'failed', updated_at = now(),
      error = 'the opportunity closed or filled before the payment confirmed'
  from public.qualified_credit_opportunities o
  where r.opportunity_id = o.id and r.status = 'confirmed' and r.credit_batch_id is null
    and (o.funding_status not in ('open', 'partially_funded')
      or o.funded_micro_usdc + r.amount_micro_usdc > o.funding_target_micro_usdc);

  -- The rows are locked here and attached below, so the set that was summed is
  -- the set that is credited.
  select array_agg(q.id), coalesce(sum(q.amount_micro_usdc), 0)
  into v_ids, v_sum
  from (
    select r.id, r.amount_micro_usdc
    from public.zcash_payment_requests r
    where r.status = 'confirmed' and r.credit_batch_id is null
    order by r.confirmed_at
    limit p_limit
    for update skip locked
  ) q;
  if v_ids is null then
    return null;
  end if;

  v_carry := coalesce((
    select b.carried_out_micro_usdc from public.zcash_credit_batches b
    where b.status = 'credited' order by b.created_at desc limit 1), 0);
  -- Down, never up: integer division is the rounding, and what it drops is
  -- carried to the next batch rather than fronted by the operator.
  v_credited := ((v_carry + v_sum) / p_unit_micro_usdc) * p_unit_micro_usdc;

  insert into public.zcash_credit_batches (
    unit_micro_usdc, carried_in_micro_usdc, target_micro_usdc,
    credited_micro_usdc, carried_out_micro_usdc, claimed_at
  ) values (
    p_unit_micro_usdc, v_carry, v_carry + v_sum,
    v_credited, v_carry + v_sum - v_credited, now()
  ) returning * into v_batch;

  update public.zcash_payment_requests
  set credit_batch_id = v_batch.id, updated_at = now()
  where id = any(v_ids);

  return jsonb_build_object(
    'id', v_batch.id, 'status', v_batch.status, 'resumed', false,
    'unit_micro_usdc', v_batch.unit_micro_usdc,
    'target_micro_usdc', v_batch.target_micro_usdc,
    'credited_micro_usdc', v_batch.credited_micro_usdc,
    'carried_in_micro_usdc', v_batch.carried_in_micro_usdc,
    'carried_out_micro_usdc', v_batch.carried_out_micro_usdc,
    'signature', null, 'valid_until', null,
    'requests', array_length(v_ids, 1));
end;
$$;

-- Signed and recorded before it is sent, which is the discipline that makes a
-- lost acknowledgement cost a lookup instead of a second transfer.
create function public.zcash_batch_sending(p_id uuid, p_signature text, p_valid_until bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.zcash_credit_batches
  set signature = p_signature, valid_until = p_valid_until, status = 'sending', updated_at = now()
  where id = p_id and status in ('open', 'sending');
$$;

-- The USDC is in the vault — or there was no whole unit to move, and the batch
-- closes having moved nothing. Either way the positions are booked, because the
-- ZEC arrived: the book records what we received and the vault records what has
-- been carried across, and the difference between them is the queue.
--
-- One request that cannot be booked fails alone. The transfer has already
-- landed, so letting it roll back the batch would lose the record of money
-- that is provably in the vault.
create function public.zcash_batch_done(p_id uuid, p_signature text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.zcash_credit_batches;
  v_r public.zcash_payment_requests;
  v_result jsonb;
  v_booked integer := 0;
  v_failed integer := 0;
begin
  select * into v_batch from public.zcash_credit_batches where id = p_id for update;
  if not found then
    raise exception 'batch_not_found' using errcode = 'P0002';
  end if;
  if v_batch.status = 'credited' then
    return jsonb_build_object('id', v_batch.id, 'already', true);
  end if;
  if v_batch.status <> 'open' and v_batch.status <> 'sending' then
    raise exception 'batch_not_pending' using errcode = 'P0001';
  end if;
  if v_batch.signature is distinct from p_signature then
    raise exception 'batch_signature_mismatch' using errcode = 'P0001';
  end if;
  if v_batch.credited_micro_usdc > 0 and p_signature is null then
    raise exception 'batch_needs_a_signature' using errcode = 'P0001';
  end if;

  for v_r in
    select * from public.zcash_payment_requests
    where credit_batch_id = p_id and status = 'confirmed' and investment_id is null
    order by confirmed_at
    for update
  loop
    begin
      v_result := public.record_investment(
        v_r.investor_id, v_r.opportunity_id, v_r.amount_micro_usdc, 'zcash',
        (select wallet_address from public.profiles where id = v_r.investor_id),
        null, false, now(), p_id
      );
      update public.zcash_payment_requests
      set status = 'credited', investment_id = (v_result->>'id')::uuid,
          credit_claimed_at = null, updated_at = now()
      where id = v_r.id;
      v_booked := v_booked + 1;
    exception when others then
      update public.zcash_payment_requests
      set status = 'failed', error = left(sqlerrm, 500), credit_claimed_at = null, updated_at = now()
      where id = v_r.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  update public.zcash_credit_batches
  set status = 'credited', confirmed_at = now(), updated_at = now()
  where id = p_id;

  return jsonb_build_object(
    'id', p_id, 'already', false, 'booked', v_booked, 'failed', v_failed,
    'credited_micro_usdc', v_batch.credited_micro_usdc,
    'carried_out_micro_usdc', v_batch.carried_out_micro_usdc);
end;
$$;

-- The transfer failed for good. The payments go back to the pool of confirmed
-- ones so a later batch carries them, and this batch's carry is never consumed
-- because only a 'credited' batch is read for it.
create function public.zcash_batch_failed(p_id uuid, p_error text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.zcash_payment_requests
  set credit_batch_id = null, credit_claimed_at = null, updated_at = now()
  where credit_batch_id = p_id and status = 'confirmed';
  update public.zcash_credit_batches
  set status = 'failed', error = left(p_error, 500), updated_at = now()
  where id = p_id and status in ('open', 'sending');
end;
$$;

-- ------------------------------------------------------------ the queue, in the open

-- What the vault holds against what the book says, and the batches behind the
-- difference. Published because a privacy mechanism that hides its own float is
-- not privacy, it is bookkeeping with the lights off. `members` is the number of
-- positions a batch carried: it is the anonymity set, and a batch of one hides
-- nothing, which the screen has to say rather than imply.
create function public.zcash_batch_queue(p_limit integer default 12)
returns jsonb
language sql security definer set search_path = ''
as $$
  select jsonb_build_object(
    'booked_micro_usdc', coalesce((
      select sum(i.amount_micro_usdc) from public.investments i where i.credit_batch_id is not null), 0),
    'credited_micro_usdc', coalesce((
      select sum(b.credited_micro_usdc) from public.zcash_credit_batches b where b.status = 'credited'), 0),
    'queued_micro_usdc', coalesce((
      select b.carried_out_micro_usdc from public.zcash_credit_batches b
      where b.status = 'credited' order by b.created_at desc limit 1), 0),
    'awaiting_micro_usdc', coalesce((
      select sum(r.amount_micro_usdc) from public.zcash_payment_requests r
      where r.status = 'confirmed' and r.credit_batch_id is null), 0),
    'batches', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
          'id', b.id, 'status', b.status, 'signature', b.signature,
          'unit_micro_usdc', b.unit_micro_usdc,
          'credited_micro_usdc', b.credited_micro_usdc,
          'carried_in_micro_usdc', b.carried_in_micro_usdc,
          'carried_out_micro_usdc', b.carried_out_micro_usdc,
          'members', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = b.id),
          'created_at', private.iso(b.created_at),
          'confirmed_at', private.iso(b.confirmed_at)) as x
        from public.zcash_credit_batches b
        order by b.created_at desc
        limit p_limit) s), '[]'::jsonb));
$$;

-- ------------------------------------------------------------------ grants

-- Forming, signing and closing a batch is the operator's business alone: left
-- at the default, execute belongs to public, and any signed-in reader could
-- have claimed one.
revoke all on function public.zcash_batch_claim(bigint, integer),
  public.zcash_batch_sending(uuid, text, bigint),
  public.zcash_batch_done(uuid, text),
  public.zcash_batch_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.zcash_batch_claim(bigint, integer),
  public.zcash_batch_sending(uuid, text, bigint),
  public.zcash_batch_done(uuid, text),
  public.zcash_batch_failed(uuid, text) to service_role;

revoke all on function public.zcash_batch_queue(integer) from public, anon;
grant execute on function public.zcash_batch_queue(integer) to authenticated, service_role;

-- Dropping and recreating record_investment reset its grants to the default,
-- which is execute for PUBLIC. Booking an allocation is the operator's act, and
-- for a moment it was anyone's: restored to what it was, service_role alone.
revoke all on function public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.record_investment(uuid, uuid, bigint, public.investment_mode, text, text, boolean, timestamptz, uuid)
  to service_role;

-- ------------------------------------------------- what the investor is told

-- Her request now reports the batch that carried it: how many positions shared
-- that single transfer, and what the chain was shown. `credit_signature` falls
-- back to the batch's own, because for her it is still the answer to "where did
-- my capital enter" — it is simply no longer a transfer that is only hers.
--
-- Rebuilt from 20260919000100_zcash.sql.
create or replace function public.zcash_request(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_r public.zcash_payment_requests;
  v_t private.zcash_treasury;
  v_b public.zcash_credit_batches;
begin
  select * into v_r from public.zcash_payment_requests where id = p_id;
  if not found or not (v_r.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_request' using errcode = '42501';
  end if;
  select * into v_t from private.zcash_treasury where id;
  select * into v_b from public.zcash_credit_batches where id = v_r.credit_batch_id;
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
    'credit_signature', coalesce(v_r.credit_signature, v_b.signature),
    'investment_id', v_r.investment_id,
    'batch', case when v_b.id is null then null else jsonb_build_object(
      'status', v_b.status,
      'members', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = v_b.id),
      'credited_micro_usdc', v_b.credited_micro_usdc,
      'unit_micro_usdc', v_b.unit_micro_usdc,
      'signature', v_b.signature) end,
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_r.investment_id),
    'error', v_r.error,
    'expires_at', private.iso(v_r.expires_at), 'created_at', private.iso(v_r.created_at)
  );
end;
$$;

-- ---------------------------------------------- the float, where an auditor reads

-- The auditor's Zcash read gains the batches and the queue behind them. The
-- vault holds less than the book between batches, by less than one unit, and
-- that difference belongs to no single investor: attributing it would rebuild
-- the link the batch exists to break. So it is published as a pool-level
-- figure, because a privacy mechanism that hides its own float is not privacy.
--
-- `credit_signature` falls back to the batch's, so a receipt still points at
-- the Solana transfer that carried it.
--
-- Rebuilt from 20260919000100_zcash.sql.
create or replace function public.audit_zcash()
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
    'batches', public.zcash_batch_queue(12),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'txid', rc.txid, 'pool', rc.pool, 'index', rc.output_index, 'value_zat', rc.value_zat,
        'memo', rc.memo, 'height', rc.mined_height, 'seen_at', private.iso(rc.seen_at),
        'ref', r.ref, 'status', r.status, 'amount_micro_usdc', r.amount_micro_usdc,
        'opportunity_code', case when r.id is not null then private.opportunity_code(r.opportunity_id) end,
        'credit_signature', coalesce(r.credit_signature, b.signature),
        'batch_members', case when b.id is null then null else
          (select count(*) from public.zcash_payment_requests q where q.credit_batch_id = b.id) end,
        'allocation_signature', (select a.signature from public.chain_anchors a
          where a.kind = 'allocation' and a.entity_id = r.investment_id)
      ) order by rc.mined_height desc, rc.txid)
      from public.zcash_receipts rc
      left join public.zcash_payment_requests r on r.id = rc.request_id
      left join public.zcash_credit_batches b on b.id = r.credit_batch_id
    ), '[]')
  );
end;
$$;
