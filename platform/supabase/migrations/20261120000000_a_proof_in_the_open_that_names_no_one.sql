-- A proof in the open that names no one.
--
-- Step 5 of the Business Passport plan. Every monthly snapshot and every
-- signed credential is committed to, the commitments are gathered into a
-- batch, and the batch's Merkle root (RFC 9162) is written to Solana devnet
-- in a Memo by the passport's anchoring key -- once a day, whatever the number
-- of women. On chain there is a batch number, a size and 32 bytes: no
-- account per woman, no pseudonym, no figure, nothing a guess about her could
-- be tested against (each commitment is salted). The cadence the chain shows
-- is EmpowerFI's, not hers.
--
-- What it proves: that a month, or a credential, existed exactly as it is
-- by the time of the block -- so a figure changed later, or a credential
-- back-dated, is caught. The proof of inclusion lives here and travels with
-- the credential; the partner checks it against the chain directly.
--
--   snapshot    commitment = SHA-256("EMPOWERFI:PASSPORT_SNAPSHOT:v1" 0x00
--               canonical JSON of passport_snapshot_payload), written once
--               into metric_snapshots.commitment.
--   credential  commitment = SHA-256("EMPOWERFI:PASSPORT_CREDENTIAL:v1" 0x00
--               the issuer-signed JWT).
--
-- The `passport-anchor` Edge Function does the work, called every hour by
-- pg_cron; it opens a new batch at most once a day and spends the other runs
-- finishing the one in flight. If Solana is down, nothing else waits: the
-- journal, the snapshots, the credentials and their signatures all work, and
-- the batch is sent when it can be.
--
-- The existing empowerfi_audit program keeps the credit lifecycle as it is.

-- ------------------------------------------------------------ the snapshot

/** Exactly what a snapshot's commitment is over. Changing it is a new domain tag. */
create function private.passport_snapshot_payload(p_snapshot_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'subject_ref', s.subject_ref,
    'period', s.period,
    'version', s.version,
    'supersedes_id', s.supersedes_id,
    'reason', s.reason,
    'methodology_version', s.methodology_version,
    'evidence_level', s.evidence_level,
    'data_origin', s.data_origin,
    'record_count', s.record_count,
    'indicators', s.indicators,
    'generated_at', to_char(s.generated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'salt', s.salt)
  from public.metric_snapshots s where s.id = p_snapshot_id
$$;

/** Snapshots not committed to yet, with what to commit to. */
create function public.passport_snapshots_uncommitted(p_limit integer default 200)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'payload', private.passport_snapshot_payload(x.id))), '[]'::jsonb)
    from (select s.id from public.metric_snapshots s where s.commitment is null
           order by s.generated_at, s.id limit p_limit) x
$$;

/** Writes a snapshot's commitment, once (the snapshot's own trigger allows nothing else). */
create function public.passport_snapshot_commit(p_snapshot_id uuid, p_commitment text)
returns void
language sql security definer set search_path = ''
as $$
  update public.metric_snapshots set commitment = p_commitment
   where id = p_snapshot_id and commitment is null
$$;

-- --------------------------------------------------------------- batches

create table public.passport_anchor_batches (
  id                      uuid primary key default gen_random_uuid(),
  batch_no                integer not null unique check (batch_no > 0),
  root                    text not null check (root ~ '^[0-9a-f]{64}$'),
  size                    integer not null check (size between 1 and 1000),
  memo                    text not null,
  status                  text not null default 'pending' check (status in ('pending', 'sent', 'confirmed')),
  cluster                 text not null default 'devnet' check (cluster in ('devnet')),
  authority               text,
  signature               text,
  last_valid_block_height bigint,
  slot                    bigint,
  block_time              timestamptz,
  attempts                integer not null default 0,
  last_error              text check (last_error is null or char_length(last_error) <= 2000),
  created_at              timestamptz not null default now(),
  sent_at                 timestamptz,
  confirmed_at            timestamptz,
  constraint a_sent_batch_has_its_signature check ((status = 'pending') = (signature is null)),
  constraint a_confirmed_batch_says_where check ((status = 'confirmed') = (slot is not null))
);

create table public.passport_anchor_leaves (
  batch_id       uuid not null references public.passport_anchor_batches (id) on delete restrict,
  position       integer not null check (position >= 0),
  kind           text not null check (kind in ('snapshot', 'credential')),
  -- Cleared when she is erased: the leaf, the commitment and the batch stay,
  -- which reveal nothing, and nothing points back to her.
  snapshot_id    uuid references public.metric_snapshots (id) on delete set null,
  credential_id  uuid references public.passport_credentials (id) on delete set null,
  commitment     text not null check (commitment ~ '^[0-9a-f]{64}$'),
  proof          text[] not null,
  primary key (batch_id, position)
);

create unique index passport_anchor_leaves_snapshot on public.passport_anchor_leaves (snapshot_id) where snapshot_id is not null;
create unique index passport_anchor_leaves_credential on public.passport_anchor_leaves (credential_id) where credential_id is not null;

alter table public.passport_anchor_batches enable row level security;
alter table public.passport_anchor_leaves enable row level security;
revoke all on public.passport_anchor_batches, public.passport_anchor_leaves from anon, authenticated;

/** The batch in flight, if any: created but not yet confirmed. */
create function public.passport_batch_open()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(b) from public.passport_anchor_batches b
   where b.status <> 'confirmed' order by b.batch_no limit 1
$$;

/**
 * What the next batch would hold: committed snapshots and signed credentials
 * not in a batch yet. Empty while a batch is in flight or one was opened in
 * the last twenty hours -- one batch a day.
 */
create function public.passport_unbatched(p_limit integer default 1000)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.passport_anchor_batches where status <> 'confirmed')
     or exists (select 1 from public.passport_anchor_batches where created_at > now() - interval '20 hours') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.leaf order by x.ord, x.at, x.id)
      from (
        (select 1 as ord, s.generated_at as at, s.id,
                jsonb_build_object('kind', 'snapshot', 'id', s.id, 'commitment', s.commitment) as leaf
           from public.metric_snapshots s
          where s.commitment is not null
            and not exists (select 1 from public.passport_anchor_leaves l where l.snapshot_id = s.id)
          order by s.generated_at, s.id limit p_limit)
        union all
        (select 2, c.issued_at, c.id,
                jsonb_build_object('kind', 'credential', 'id', c.id, 'jwt', split_part(c.sd_jwt, '~', 1))
           from public.passport_credentials c
          where c.sd_jwt is not null
            and not exists (select 1 from public.passport_anchor_leaves l where l.credential_id = c.id)
          order by c.issued_at, c.id limit p_limit)
      ) x), '[]'::jsonb);
end;
$$;

/**
 * Records a batch and its leaves in one go, as the Edge Function computed
 * them, and writes its memo. p_leaves: [{kind, id, commitment, proof: [hex…]}]
 * in tree order.
 */
create function public.passport_batch_create(p_root text, p_leaves jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_batch public.passport_anchor_batches;
  v_no integer;
begin
  if exists (select 1 from public.passport_anchor_batches where status <> 'confirmed') then
    raise exception 'a batch is already in flight' using errcode = 'P0001';
  end if;
  select coalesce(max(batch_no), 0) + 1 into v_no from public.passport_anchor_batches;
  -- The memo is written here, from the number this batch gets: what goes on
  -- chain cannot name another batch.
  insert into public.passport_anchor_batches (batch_no, root, size, memo)
  values (v_no, p_root, jsonb_array_length(p_leaves),
          format('EMPOWERFI:PASSPORT_BATCH:v1:%s:%s:%s', v_no, jsonb_array_length(p_leaves), p_root))
  returning * into v_batch;

  insert into public.passport_anchor_leaves (batch_id, position, kind, snapshot_id, credential_id, commitment, proof)
  select v_batch.id, (l.ord - 1)::integer, l.v ->> 'kind',
         case when l.v ->> 'kind' = 'snapshot' then (l.v ->> 'id')::uuid end,
         case when l.v ->> 'kind' = 'credential' then (l.v ->> 'id')::uuid end,
         l.v ->> 'commitment',
         array(select jsonb_array_elements_text(l.v -> 'proof'))
    from jsonb_array_elements(p_leaves) with ordinality l (v, ord);

  -- A snapshot's leaf must be the commitment it carries: the batch is over
  -- what the table says, not what the caller says.
  if exists (select 1 from public.passport_anchor_leaves l join public.metric_snapshots s on s.id = l.snapshot_id
              where l.batch_id = v_batch.id and l.commitment is distinct from s.commitment) then
    raise exception 'a snapshot leaf disagrees with its commitment' using errcode = '22023';
  end if;
  return to_jsonb(v_batch);
end;
$$;

/** Signed and about to be sent: the signature is kept before sending, so a crash in between is recovered, not repeated. */
create function public.passport_batch_sent(p_id uuid, p_signature text, p_last_valid_block_height bigint, p_authority text)
returns void
language sql security definer set search_path = ''
as $$
  update public.passport_anchor_batches
     set status = 'sent', signature = p_signature, last_valid_block_height = p_last_valid_block_height,
         authority = p_authority, sent_at = now(), attempts = attempts + 1, last_error = null
   where id = p_id and status <> 'confirmed'
$$;

create function public.passport_batch_confirmed(p_id uuid, p_slot bigint, p_block_time timestamptz)
returns void
language sql security definer set search_path = ''
as $$
  update public.passport_anchor_batches
     set status = 'confirmed', slot = p_slot, block_time = p_block_time, confirmed_at = now(), last_error = null
   where id = p_id and status = 'sent'
$$;

/** Back to pending, to be signed again: its transaction failed or expired unseen. */
create function public.passport_batch_retry(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.passport_anchor_batches
     set status = 'pending', signature = null, last_valid_block_height = null, last_error = left(p_error, 2000)
   where id = p_id and status <> 'confirmed'
$$;

create function public.passport_batch_note(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.passport_anchor_batches set last_error = left(p_error, 2000) where id = p_id and status <> 'confirmed'
$$;

-- ------------------------------------------------------------ in the link

/** As before, with each month's anchor: the confirmed batch its credential is in, and the path to the root. */
create or replace function public.passport_link_open(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_link public.share_links%rowtype;
  v_share public.share_authorisations%rowtype;
  v_recipient public.passport_recipients%rowtype;
begin
  select * into v_link from public.share_links
   where token_sha256 = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
     and closed_at is null;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_share from public.share_authorisations where id = v_link.share_id;
  if not private.share_is_live(v_share.id) then
    return jsonb_build_object('status', case when v_share.status = 'revoked' then 'ended' else 'expired' end);
  end if;
  select * into v_recipient from public.passport_recipients where id = v_share.recipient_id;

  insert into public.share_accesses (share_id, link_id) values (v_share.id, v_link.id);

  return jsonb_build_object(
    'status', 'live',
    'share', jsonb_build_object(
      'recipient', v_recipient.name,
      'purpose', v_share.purpose,
      'purpose_text', private.share_purpose_text(v_share.purpose),
      'subject_ref', v_share.subject_ref,
      'indicators', to_jsonb(v_share.indicators),
      'authorised_at', v_share.answered_at,
      'expires_at', v_share.expires_at),
    'months', (select jsonb_agg(jsonb_build_object(
                   'snapshot_id', s.id, 'period', s.period, 'version', s.version,
                   'superseded', exists (select 1 from public.metric_snapshots n where n.supersedes_id = s.id),
                   'sd_jwt', c.sd_jwt,
                   'anchor', (select jsonb_build_object(
                                'batch_no', b.batch_no, 'size', b.size, 'index', l.position, 'root', b.root,
                                'proof', to_jsonb(l.proof), 'signature', b.signature, 'slot', b.slot,
                                'block_time', b.block_time, 'cluster', b.cluster, 'authority', b.authority)
                                from public.passport_anchor_leaves l
                                join public.passport_anchor_batches b on b.id = l.batch_id and b.status = 'confirmed'
                               where l.credential_id = c.id))
                 order by s.period)
                 from unnest(v_share.snapshot_ids) u (id)
                 join public.metric_snapshots s on s.id = u.id
                 left join public.passport_credentials c on c.snapshot_id = s.id)
  );
end;
$$;

-- --------------------------------------------------------------- the clock
--
-- Every hour, at 17 minutes past. The URL and the shared secret come from
-- Vault, set once per environment (docs/PASSPORT.md):
--   select vault.create_secret('<functions url>/passport-anchor', 'passport_anchor_url');
--   select vault.create_secret('<the secret>', 'passport_anchor_secret');

create function private.dispatch_passport_anchor()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.metric_snapshots where commitment is null)
     and not exists (select 1 from public.passport_anchor_batches where status <> 'confirmed')
     and public.passport_unbatched(1) = '[]'::jsonb then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'passport_anchor_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'passport_anchor_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_passport_anchor: vault secrets passport_anchor_url / passport_anchor_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-passport-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.schedule('passport-anchor', '17 * * * *', $$select private.dispatch_passport_anchor()$$);

-- -------------------------------------------------------------------- grants

revoke execute on function private.passport_snapshot_payload(uuid) from public, anon, authenticated;
revoke execute on function private.dispatch_passport_anchor() from public, anon, authenticated;
revoke execute on function public.passport_snapshots_uncommitted(integer) from public, anon, authenticated;
revoke execute on function public.passport_snapshot_commit(uuid, text) from public, anon, authenticated;
revoke execute on function public.passport_batch_open() from public, anon, authenticated;
revoke execute on function public.passport_unbatched(integer) from public, anon, authenticated;
revoke execute on function public.passport_batch_create(text, jsonb) from public, anon, authenticated;
revoke execute on function public.passport_batch_sent(uuid, text, bigint, text) from public, anon, authenticated;
revoke execute on function public.passport_batch_confirmed(uuid, bigint, timestamptz) from public, anon, authenticated;
revoke execute on function public.passport_batch_retry(uuid, text) from public, anon, authenticated;
revoke execute on function public.passport_batch_note(uuid, text) from public, anon, authenticated;
grant execute on function public.passport_snapshots_uncommitted(integer) to service_role;
grant execute on function public.passport_snapshot_commit(uuid, text) to service_role;
grant execute on function public.passport_batch_open() to service_role;
grant execute on function public.passport_unbatched(integer) to service_role;
grant execute on function public.passport_batch_create(text, jsonb) to service_role;
grant execute on function public.passport_batch_sent(uuid, text, bigint, text) to service_role;
grant execute on function public.passport_batch_confirmed(uuid, bigint, timestamptz) to service_role;
grant execute on function public.passport_batch_retry(uuid, text) to service_role;
grant execute on function public.passport_batch_note(uuid, text) to service_role;
