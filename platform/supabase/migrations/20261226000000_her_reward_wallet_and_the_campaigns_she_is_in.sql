-- Her reward wallet, and the devnet campaigns she is in.
--
-- 1. Every entrepreneur of the diary has a reward wallet: the address of the
--    rewards program at ["recipient", her wallet ref] (programs/empowerfi-
--    rewards). No key exists for it, so nothing here or anywhere holds one;
--    only the program moves what it receives, and a later version will hand
--    it to the wallet she chooses. The ref is random: the address says
--    nothing of who she is. campaign-attest writes the address beside it.
--
-- 2. The campaigns' participants are the diary's own entrepreneurs: everyone
--    whose latest consent says yes to the impact figures, with the days she
--    recorded in the campaign's window. She no longer joins a vault campaign
--    from the diary; it no longer offers one.
--
-- 3. Each leaf of an attestation now commits to her wallet too
--    (EMPOWERFI:CAMPAIGN_LEAF:v2 | campaign | wallet ref | salt), so the
--    program pays a leaf only into that wallet (pay_reward). campaign-attest
--    pays each woman of the latest confirmed root once; campaign_payments
--    keeps each payment.
--
-- 4. The open page reads the engagement as it is: participants, active, who
--    completed the 30 days, the mean of days kept, what was paid -- each
--    count only from five women up, as before.

-- ------------------------------------------------------------ her wallet

create table private.reward_wallets (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  ref             uuid not null unique default gen_random_uuid(),
  address         text unique check (address is null or address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  created_at      timestamptz not null default now()
);
alter table private.reward_wallets enable row level security;

insert into private.reward_wallets (entrepreneur_id)
select m.id from private.diary_members() m
on conflict do nothing;

create function private.a_reward_wallet_for_her()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.is_simulated then
    insert into private.reward_wallets (entrepreneur_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;

create trigger an_entrepreneur_has_a_reward_wallet
  after insert on public.entrepreneurs
  for each row execute function private.a_reward_wallet_for_her();

/** A uuid as its 16 bytes, the way the program reads a campaign or a wallet ref. */
create function private.uuid_bytes(p uuid)
returns bytea language sql immutable set search_path = ''
as $$ select decode(replace(p::text, '-', ''), 'hex') $$;

/** Whether her latest consent counts her business in the impact figures. */
create function private.shares_impact(p_entrepreneur_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select c.impact from public.consents c
                    where c.entrepreneur_id = p_entrepreneur_id
                    order by c.consent_no desc limit 1), false)
$$;

-- ------------------------------------------------------------ who is in it

/**
 * A vault campaign's women on p_day: every diary entrepreneur who shares her
 * impact figures, and the days she recorded between the campaign's first day
 * and p_day (or its last).
 */
create function private.vault_cohort(p_program_id uuid, p_day date)
returns table (entrepreneur_id uuid, kept integer)
language sql stable security definer set search_path = ''
as $$
  select m.id,
         (select count(*)::integer from public.journal_days d
           where d.entrepreneur_id = m.id
             and d.day between g.period_start and least(p_day, coalesce(g.period_end, p_day)))
    from private.diary_members() m
    join public.programs g on g.id = p_program_id
   where private.shares_impact(m.id)
$$;

/** Her leaf: the campaign, her wallet and her salt, hashed as the program hashes them. */
create function private.vault_leaf(p_program_id uuid, p_wallet_ref uuid, p_salt bytea)
returns text language sql immutable set search_path = ''
as $$
  select encode(extensions.digest(
    convert_to('EMPOWERFI:CAMPAIGN_LEAF:v2', 'UTF8') || private.uuid_bytes(p_program_id)
      || private.uuid_bytes(p_wallet_ref) || p_salt, 'sha256'), 'hex')
$$;

-- The diary no longer offers a vault campaign to join: everyone who shares
-- her figures is in it already. Listing makes it public, nothing more.
update public.programs set enrolment = 'invited', updated_at = now()
 where id in (select program_id from public.campaign_vaults) and enrolment = 'open';

create or replace function public.campaign_vault_list(p_program_id uuid, p_listed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if session_user = 'authenticator' and not private.can_manage_rewards() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.campaign_vaults
     set listed_at = case when p_listed then coalesce(listed_at, now()) end,
         listed_by = case when p_listed then coalesce(listed_by, auth.uid()) end
   where program_id = p_program_id;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return jsonb_build_object('program_id', p_program_id, 'listed', p_listed);
end $$;

-- ------------------------------------------------------------ attesting

/**
 * As 20261222's, for listed campaigns, with the diary's women and v2 leaves.
 * Each woman in it gets her wallet and, once she has kept the days, her salt.
 */
create or replace function public.campaign_attestation_due()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_g record;
  v_enrolled integer;
  v_leaves text[];
begin
  for v_g in
    select v.program_id, v.campaign_address, v.operator_wallet, v.unlock_days, g.period_start, g.period_end
      from public.campaign_vaults v join public.programs g on g.id = v.program_id
     where v.listed_at is not null
       and g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today - 1
       and not exists (select 1 from public.campaign_attestations a
                        where a.program_id = v.program_id and a.as_of = v_today)
     order by g.period_start
  loop
    select count(*) into v_enrolled from private.vault_cohort(v_g.program_id, v_today);
    continue when v_enrolled < private.campaign_min_group();

    insert into private.reward_wallets (entrepreneur_id)
    select c.entrepreneur_id from private.vault_cohort(v_g.program_id, v_today) c
    on conflict do nothing;
    insert into private.campaign_leaf_salts (program_id, entrepreneur_id)
    select v_g.program_id, c.entrepreneur_id from private.vault_cohort(v_g.program_id, v_today) c
     where c.kept >= v_g.unlock_days
    on conflict do nothing;

    select coalesce(array_agg(l.leaf order by l.leaf), '{}') into v_leaves
      from (select private.vault_leaf(v_g.program_id, w.ref, s.salt) as leaf
              from private.vault_cohort(v_g.program_id, v_today) c
              join private.campaign_leaf_salts s on s.program_id = v_g.program_id and s.entrepreneur_id = c.entrepreneur_id
              join private.reward_wallets w on w.entrepreneur_id = c.entrepreneur_id
             where c.kept >= v_g.unlock_days) l;

    return jsonb_build_object('program_id', v_g.program_id, 'as_of', v_today,
                              'campaign_address', v_g.campaign_address, 'operator_wallet', v_g.operator_wallet,
                              'enrolled', v_enrolled, 'leaves', to_jsonb(v_leaves));
  end loop;
  return null;
end $$;

-- ------------------------------------------------------------ wallets' addresses

/** Wallets whose address campaign-attest has not written yet. */
create function public.reward_wallets_unaddressed(p_limit integer default 200)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(w.ref), '[]'::jsonb)
    from (select ref from private.reward_wallets where address is null
           order by created_at limit least(greatest(coalesce(p_limit, 200), 1), 1000)) w
$$;

create function public.reward_wallet_addressed(p_ref uuid, p_address text)
returns void
language sql security definer set search_path = ''
as $$
  update private.reward_wallets set address = p_address where ref = p_ref and address is null
$$;

-- ------------------------------------------------------------ paying

create table public.campaign_payments (
  id                      uuid primary key default gen_random_uuid(),
  program_id              uuid not null references public.campaign_vaults (program_id) on delete restrict,
  -- private.reward_wallets.ref: never shown; the address is what is public.
  wallet_ref              uuid not null,
  recipient_address       text not null,
  amount_units            bigint not null check (amount_units > 0),
  leaf                    text not null check (leaf ~ '^[0-9a-f]{64}$'),
  status                  text not null default 'pending' check (status in ('pending', 'sent', 'confirmed', 'failed')),
  signature               text,
  last_valid_block_height bigint,
  slot                    bigint,
  block_time              timestamptz,
  attempts                integer not null default 0,
  last_error              text check (last_error is null or char_length(last_error) <= 2000),
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  constraint a_sent_payment_has_its_signature check ((status in ('pending')) = (signature is null) or status = 'failed'),
  constraint a_confirmed_payment_says_where check ((status = 'confirmed') = (slot is not null))
);
-- Once per campaign and wallet, as the program's receipt; a failed try does not count.
create unique index a_wallet_is_paid_once_per_campaign
  on public.campaign_payments (program_id, wallet_ref) where status <> 'failed';
alter table public.campaign_payments enable row level security;

/** The payment in flight, if one is: finished before another opens. */
create function public.campaign_payment_open()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(x) from (
    select p.id, p.program_id, p.wallet_ref, p.recipient_address, p.amount_units, p.leaf, p.status,
           p.signature, p.last_valid_block_height
      from public.campaign_payments p
     where p.status in ('pending', 'sent')
     order by p.created_at limit 1) x
$$;

/**
 * The next woman to pay: in the latest confirmed attestation of a listed
 * campaign, with her wallet's address written, not paid yet. With what the
 * transaction needs: her ref and salt, her index in the tree, every leaf of
 * it (the proof is built from them), and the campaign's accounts.
 */
create function public.campaign_payment_due()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v record;
  v_next jsonb;
begin
  for v in
    select a.program_id, a.leaves, cv.program_address, cv.campaign_address, cv.vault_address, cv.mint,
           cv.mint_decimals, cv.operator_wallet, cv.seats, cv.funded_units, cv.house_share_bps
      from public.campaign_vaults cv
      join lateral (select * from public.campaign_attestations a
                     where a.program_id = cv.program_id and a.status = 'confirmed'
                     order by a.as_of desc limit 1) a on true
     where cv.listed_at is not null and a.engaged > 0
     order by a.as_of
  loop
    v_next := (
      select jsonb_build_object(
               'program_id', v.program_id, 'program_address', v.program_address,
               'campaign_address', v.campaign_address, 'vault_address', v.vault_address, 'mint', v.mint,
               'mint_decimals', v.mint_decimals, 'operator_wallet', v.operator_wallet,
               'wallet_ref', w.ref, 'recipient_address', w.address, 'salt', encode(s.salt, 'hex'),
               'leaf', l.leaf, 'index', array_position(v.leaves, l.leaf) - 1, 'leaves', to_jsonb(v.leaves),
               'amount_units', (v.funded_units - v.funded_units * v.house_share_bps / 10000) / v.seats)
        from private.campaign_leaf_salts s
        join private.reward_wallets w on w.entrepreneur_id = s.entrepreneur_id
        cross join lateral (select private.vault_leaf(v.program_id, w.ref, s.salt) as leaf) l
       where s.program_id = v.program_id
         and w.address is not null
         and l.leaf = any(v.leaves)
         and not exists (select 1 from public.campaign_payments p
                          where p.program_id = v.program_id and p.wallet_ref = w.ref and p.status <> 'failed')
       order by l.leaf limit 1);
    if v_next is not null then
      return v_next;
    end if;
  end loop;
  return null;
end $$;

create function public.campaign_payment_create(
  p_program_id uuid, p_wallet_ref uuid, p_recipient_address text, p_amount_units bigint, p_leaf text
)
returns jsonb
language sql security definer set search_path = ''
as $$
  insert into public.campaign_payments (program_id, wallet_ref, recipient_address, amount_units, leaf)
  values (p_program_id, p_wallet_ref, p_recipient_address, p_amount_units, p_leaf)
  returning jsonb_build_object('id', id, 'program_id', program_id, 'wallet_ref', wallet_ref,
    'recipient_address', recipient_address, 'amount_units', amount_units, 'leaf', leaf, 'status', status,
    'signature', signature, 'last_valid_block_height', last_valid_block_height)
$$;

create function public.campaign_payment_sent(p_id uuid, p_signature text, p_last_valid_block_height bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_payments
     set status = 'sent', signature = p_signature, last_valid_block_height = p_last_valid_block_height,
         attempts = attempts + 1
   where id = p_id and status = 'pending'
$$;

create function public.campaign_payment_confirmed(p_id uuid, p_slot bigint, p_block_time timestamptz)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_payments
     set status = 'confirmed', slot = p_slot, block_time = p_block_time, confirmed_at = now(), last_error = null
   where id = p_id and status = 'sent'
$$;

/** Expired without landing: send again. */
create function public.campaign_payment_retry(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_payments
     set status = 'pending', signature = null, last_valid_block_height = null, last_error = left(p_error, 2000)
   where id = p_id and status in ('pending', 'sent')
$$;

/** The program refused it (a newer root, say): given up; the next run works it out again. */
create function public.campaign_payment_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_payments set status = 'failed', last_error = left(p_error, 2000)
   where id = p_id and status <> 'confirmed'
$$;

create function public.campaign_payment_note(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_payments set last_error = left(p_error, 2000) where id = p_id
$$;

-- ------------------------------------------------------------ the open page

/**
 * As 20261223's, with the engagement read from the diary's women: how many
 * take part, how many recorded in the window, how many completed the 30 days,
 * the mean of days kept by those who recorded, and the rewards paid. Every
 * count and the mean only from five women up.
 */
create or replace function public.campaign_vaults_public()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select v.*, g.name, g.description, g.period_start, g.period_end, s.name as sponsor_name, s.is_house,
           k.participants, k.active, k.engaged, k.avg_days
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
      cross join lateral (
        select count(*)::integer as participants,
               count(*) filter (where x.kept >= 1)::integer as active,
               count(*) filter (where x.kept >= v.unlock_days)::integer as engaged,
               round(avg(x.kept) filter (where x.kept >= 1), 1) as avg_days
          from private.vault_cohort(v.program_id, private.sp_today()) x) k
     where v.listed_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'program_id', c.program_id,
    'name', c.name,
    'description', c.description,
    'sponsor', c.sponsor_name,
    'sponsor_is_house', c.is_house,
    'period_start', c.period_start,
    'period_end', c.period_end,
    'reward_kind', c.reward_kind,
    'seats', c.seats,
    'price_per_seat_units', c.price_per_seat_units,
    'mint_decimals', c.mint_decimals,
    'house_share_bps', c.house_share_bps,
    'unlock_days', c.unlock_days,
    'min_group', private.campaign_min_group(),
    'enrolled', case when c.participants >= private.campaign_min_group() then c.participants end,
    'active', case when c.participants >= private.campaign_min_group() then c.active end,
    'engaged', case when c.participants >= private.campaign_min_group() then c.engaged end,
    'avg_days', case when c.participants >= private.campaign_min_group() then c.avg_days end,
    'paid', (select jsonb_build_object('count', count(*), 'units', coalesce(sum(p.amount_units), 0))
               from public.campaign_payments p where p.program_id = c.program_id and p.status = 'confirmed'),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('recipient', p.recipient_address, 'amount_units', p.amount_units,
                                          'signature', p.signature, 'block_time', p.block_time)
                       order by p.confirmed_at desc)
        from (select * from public.campaign_payments p
               where p.program_id = c.program_id and p.status = 'confirmed'
               order by p.confirmed_at desc limit 20) p), '[]'::jsonb),
    'chain', jsonb_build_object(
      'cluster', c.cluster, 'program', c.program_address, 'campaign', c.campaign_address,
      'vault', c.vault_address, 'mint', c.mint, 'sponsor_wallet', c.sponsor_wallet,
      'house_wallet', c.house_wallet, 'operator_wallet', c.operator_wallet,
      'terms_commitment', c.terms_commitment, 'created_signature', c.created_signature,
      'funded_signature', c.funded_signature, 'funded_units', c.funded_units, 'funded_at', c.funded_at),
    'attestations', coalesce((
      select jsonb_agg(jsonb_build_object('as_of', a.as_of, 'enrolled', a.enrolled, 'engaged', a.engaged,
                                          'root', a.root, 'signature', a.signature, 'block_time', a.block_time)
                       order by a.as_of desc)
        from (select * from public.campaign_attestations a
               where a.program_id = c.program_id and a.status = 'confirmed'
               order by a.as_of desc limit 30) a), '[]'::jsonb)
  ) order by c.funded_at desc), '[]'::jsonb)
  from c
$$;

-- ------------------------------------------------------------ grants

revoke execute on function private.a_reward_wallet_for_her(), private.uuid_bytes(uuid), private.shares_impact(uuid),
  private.vault_cohort(uuid, date), private.vault_leaf(uuid, uuid, bytea) from public, anon, authenticated;

revoke execute on function public.reward_wallets_unaddressed(integer), public.reward_wallet_addressed(uuid, text),
  public.campaign_payment_open(), public.campaign_payment_due(),
  public.campaign_payment_create(uuid, uuid, text, bigint, text),
  public.campaign_payment_sent(uuid, text, bigint), public.campaign_payment_confirmed(uuid, bigint, timestamptz),
  public.campaign_payment_retry(uuid, text), public.campaign_payment_failed(uuid, text),
  public.campaign_payment_note(uuid, text) from public, anon, authenticated;
grant execute on function public.reward_wallets_unaddressed(integer), public.reward_wallet_addressed(uuid, text),
  public.campaign_payment_open(), public.campaign_payment_due(),
  public.campaign_payment_create(uuid, uuid, text, bigint, text),
  public.campaign_payment_sent(uuid, text, bigint), public.campaign_payment_confirmed(uuid, bigint, timestamptz),
  public.campaign_payment_retry(uuid, text), public.campaign_payment_failed(uuid, text),
  public.campaign_payment_note(uuid, text) to service_role;
