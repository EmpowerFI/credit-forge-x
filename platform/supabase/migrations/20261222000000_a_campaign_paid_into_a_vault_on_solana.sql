-- A campaign paid into a vault on Solana.
--
-- A sponsor buys a 30-day campaign, priced per entrepreneur (at least 100).
-- The money goes into a vault that the campaign's own account owns on Solana
-- (programs/empowerfi-rewards), and the terms are written there: half for
-- EmpowerFI, half for the entrepreneurs, and her reward unlocks after 30 days
-- kept in the diary. Impact campaigns only, for now: what is not claimed goes
-- to EmpowerFI. Nothing is paid out yet; the vault only fills.
--
-- Once a day the diary attests, on that account, how many women are in the
-- campaign, how many have kept the 30 days, and the Merkle root of those who
-- have: each leaf is a salted commitment that names no one. And only once
-- the campaign has at least five women, the same floor as every figure a
-- sponsor sees (20261205): below it, nothing is written, here or on chain.
--
-- campaign_vaults_public() is what the open page reads: the terms, the
-- addresses and signatures anyone can check on the explorer, the
-- attestations, and the counts -- under the same floor.

-- One per campaign, written by scripts/rewards/create-campaign.mts once the
-- campaign is created and funded on chain. All of it is public on chain too.
create table public.campaign_vaults (
  program_id            uuid primary key references public.programs (id) on delete restrict,
  cluster               text not null default 'devnet' check (cluster in ('devnet')),
  reward_kind           text not null default 'impact' check (reward_kind in ('impact')),
  seats                 integer not null check (seats >= 100),
  price_per_seat_units  bigint not null check (price_per_seat_units > 0),
  mint_decimals         smallint not null default 6 check (mint_decimals between 0 and 12),
  house_share_bps       integer not null default 5000 check (house_share_bps = 5000),
  unlock_days           integer not null default 30 check (unlock_days = 30),
  program_address       text not null,
  campaign_address      text not null unique,
  vault_address         text not null unique,
  mint                  text not null,
  sponsor_wallet        text not null,
  house_wallet          text not null,
  operator_wallet       text not null,
  terms_commitment      text not null check (terms_commitment ~ '^[0-9a-f]{64}$'),
  created_signature     text not null,
  funded_signature      text not null,
  funded_units          bigint not null check (funded_units = seats * price_per_seat_units),
  funded_at             timestamptz not null,
  recorded_at           timestamptz not null default now()
);

-- Her leaf in a campaign's tree: a random salt, so the commitment cannot be
-- tested against a guess of who she is.
create table private.campaign_leaf_salts (
  program_id      uuid not null references public.programs (id) on delete cascade,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  salt            bytea not null default extensions.gen_random_bytes(32),
  primary key (program_id, entrepreneur_id)
);

create table public.campaign_attestations (
  id                      uuid primary key default gen_random_uuid(),
  program_id              uuid not null references public.campaign_vaults (program_id) on delete restrict,
  as_of                   date not null,
  enrolled                integer not null check (enrolled >= 5),
  engaged                 integer not null check (engaged between 0 and enrolled),
  root                    text not null check (root ~ '^[0-9a-f]{64}$'),
  -- The leaves, in tree order: commitments, never who they stand for.
  leaves                  text[] not null,
  status                  text not null default 'pending' check (status in ('pending', 'sent', 'confirmed')),
  signature               text,
  last_valid_block_height bigint,
  slot                    bigint,
  block_time              timestamptz,
  attempts                integer not null default 0,
  last_error              text check (last_error is null or char_length(last_error) <= 2000),
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  unique (program_id, as_of),
  constraint the_leaves_are_the_engaged check (cardinality(leaves) = engaged),
  constraint a_sent_attestation_has_its_signature check ((status = 'pending') = (signature is null)),
  constraint a_confirmed_attestation_says_where check ((status = 'confirmed') = (slot is not null))
);

alter table public.campaign_vaults enable row level security;
alter table private.campaign_leaf_salts enable row level security;
alter table public.campaign_attestations enable row level security;
revoke all on public.campaign_vaults, public.campaign_attestations from anon, authenticated;

-- ------------------------------------------------------------ who is in it

/**
 * The campaign's women on p_day: diary members authorised in it whose
 * participation covers the day, and for each, the days she kept for this
 * campaign (each day belongs to one campaign: private.program_on).
 */
create function private.campaign_cohort(p_program_id uuid, p_day date)
returns table (entrepreneur_id uuid, kept integer)
language sql stable security definer set search_path = ''
as $$
  select m.id,
         (select count(*)::integer from public.journal_days d
           where d.entrepreneur_id = m.id
             and d.day between g.period_start and least(p_day, coalesce(g.period_end, p_day))
             and private.program_on(m.id, d.day) = g.id)
    from private.diary_members() m
    join public.programs g on g.id = p_program_id
   where exists (select 1 from public.program_participants p
                  where p.program_id = g.id and p.email = private.email_of(m.id)
                    and p.starts_on <= p_day
                    and coalesce(private.participation_end(p.ends_on, p.program_id), 'infinity'::date) >= g.period_start)
$$;

-- The floor under every count the page shows and the chain carries.
create function private.campaign_min_group()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

-- ------------------------------------------------------------ the worker

/** The attestation in flight, if one is: finished before another opens. */
create function public.campaign_attestation_open()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(x) from (
    select a.id, a.program_id, v.program_address, v.campaign_address, v.operator_wallet, a.enrolled, a.engaged, a.root,
           a.status, a.signature, a.last_valid_block_height
      from public.campaign_attestations a join public.campaign_vaults v using (program_id)
     where a.status <> 'confirmed'
     order by a.created_at limit 1) x
$$;

/**
 * The next campaign due its daily attestation: running (or ended within the
 * last day), not attested today, with at least five women. Her leaf: the
 * hash of the campaign and her salt. Null when none is due.
 */
create function public.campaign_attestation_due()
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
     where g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today - 1
       and not exists (select 1 from public.campaign_attestations a
                        where a.program_id = v.program_id and a.as_of = v_today)
     order by g.period_start
  loop
    select count(*) into v_enrolled from private.campaign_cohort(v_g.program_id, v_today);
    continue when v_enrolled < private.campaign_min_group();

    insert into private.campaign_leaf_salts (program_id, entrepreneur_id)
    select v_g.program_id, c.entrepreneur_id from private.campaign_cohort(v_g.program_id, v_today) c
     where c.kept >= v_g.unlock_days
    on conflict do nothing;

    select coalesce(array_agg(l.leaf order by l.leaf), '{}') into v_leaves
      from (select encode(extensions.digest(
                     convert_to('EMPOWERFI:CAMPAIGN_LEAF:v1:' || v_g.program_id::text || ':', 'UTF8') || s.salt,
                     'sha256'), 'hex') as leaf
              from private.campaign_cohort(v_g.program_id, v_today) c
              join private.campaign_leaf_salts s on s.program_id = v_g.program_id and s.entrepreneur_id = c.entrepreneur_id
             where c.kept >= v_g.unlock_days) l;

    return jsonb_build_object('program_id', v_g.program_id, 'as_of', v_today,
                              'campaign_address', v_g.campaign_address, 'operator_wallet', v_g.operator_wallet,
                              'enrolled', v_enrolled, 'leaves', to_jsonb(v_leaves));
  end loop;
  return null;
end $$;

create function public.campaign_attestation_create(
  p_program_id uuid, p_as_of date, p_enrolled integer, p_root text, p_leaves text[]
)
returns jsonb
language sql security definer set search_path = ''
as $$
  insert into public.campaign_attestations (program_id, as_of, enrolled, engaged, root, leaves)
  values (p_program_id, p_as_of, p_enrolled, cardinality(p_leaves), p_root, p_leaves)
  returning jsonb_build_object('id', id, 'program_id', program_id,
    'program_address', (select program_address from public.campaign_vaults v where v.program_id = p_program_id),
    'campaign_address', (select campaign_address from public.campaign_vaults v where v.program_id = p_program_id),
    'operator_wallet', (select operator_wallet from public.campaign_vaults v where v.program_id = p_program_id),
    'enrolled', enrolled, 'engaged', engaged, 'root', root, 'status', status,
    'signature', signature, 'last_valid_block_height', last_valid_block_height)
$$;

create function public.campaign_attestation_sent(p_id uuid, p_signature text, p_last_valid_block_height bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_attestations
     set status = 'sent', signature = p_signature, last_valid_block_height = p_last_valid_block_height,
         attempts = attempts + 1
   where id = p_id and status = 'pending'
$$;

create function public.campaign_attestation_confirmed(p_id uuid, p_slot bigint, p_block_time timestamptz)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_attestations
     set status = 'confirmed', slot = p_slot, block_time = p_block_time, confirmed_at = now(), last_error = null
   where id = p_id and status = 'sent'
$$;

create function public.campaign_attestation_retry(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_attestations
     set status = 'pending', signature = null, last_valid_block_height = null, last_error = left(p_error, 2000)
   where id = p_id and status <> 'confirmed'
$$;

create function public.campaign_attestation_note(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_attestations set last_error = left(p_error, 2000) where id = p_id
$$;

-- pg_cron calls campaign-attest once a day, as passport-anchor is called
-- (20261120). The two Vault secrets come from scripts/rewards/generate-keys.mts:
--   select vault.create_secret('<url>', 'campaign_attest_url');
--   select vault.create_secret('<the secret>', 'campaign_attest_secret');
create function private.dispatch_campaign_attest()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.campaign_vaults) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'campaign_attest_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'campaign_attest_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_campaign_attest: vault secrets campaign_attest_url / campaign_attest_secret are not set';
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

-- 23:40 in São Paulo: the day's records are in.
select cron.schedule('campaign-attest', '40 2 * * *', $$select private.dispatch_campaign_attest()$$);

-- ------------------------------------------------------------ the open page

/**
 * Every campaign with a vault, for anyone: the terms, the addresses and
 * signatures to check on the explorer, the confirmed attestations, and how
 * many women are in it and have kept the 30 days -- only from five women up.
 */
create function public.campaign_vaults_public()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select v.*, g.name, g.description, g.period_start, g.period_end, s.name as sponsor_name, s.is_house,
           (select count(*) from private.campaign_cohort(v.program_id, private.sp_today()))::integer as enrolled,
           (select count(*) from private.campaign_cohort(v.program_id, private.sp_today()) k
             where k.kept >= v.unlock_days)::integer as engaged
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
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
    'enrolled', case when c.enrolled >= private.campaign_min_group() then c.enrolled end,
    'engaged', case when c.enrolled >= private.campaign_min_group() then c.engaged end,
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
  ) order by c.period_start desc), '[]'::jsonb)
  from c
$$;

-- ------------------------------------------------------------ grants

revoke execute on function private.campaign_cohort(uuid, date), private.campaign_min_group(),
  private.dispatch_campaign_attest() from public, anon, authenticated;
revoke execute on function public.campaign_attestation_open(), public.campaign_attestation_due(),
  public.campaign_attestation_create(uuid, date, integer, text, text[]),
  public.campaign_attestation_sent(uuid, text, bigint),
  public.campaign_attestation_confirmed(uuid, bigint, timestamptz),
  public.campaign_attestation_retry(uuid, text), public.campaign_attestation_note(uuid, text)
  from public, anon, authenticated;
grant execute on function public.campaign_attestation_open(), public.campaign_attestation_due(),
  public.campaign_attestation_create(uuid, date, integer, text, text[]),
  public.campaign_attestation_sent(uuid, text, bigint),
  public.campaign_attestation_confirmed(uuid, bigint, timestamptz),
  public.campaign_attestation_retry(uuid, text), public.campaign_attestation_note(uuid, text)
  to service_role;
revoke execute on function public.campaign_vaults_public() from public;
grant execute on function public.campaign_vaults_public() to anon, authenticated, service_role;
