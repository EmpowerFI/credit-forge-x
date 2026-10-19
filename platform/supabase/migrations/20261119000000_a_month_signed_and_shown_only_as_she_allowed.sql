-- A month, signed, and shown only as she allowed.
--
-- Step 4 of the Business Passport plan. Each monthly snapshot version gets a
-- credential: a W3C Verifiable Credential secured with SD-JWT
-- (packages/passport), signed by the `passport` Edge Function with a key
-- that lives in that function's secrets and never in this database. What is
-- kept here is the signed result, which anyone may hold: it proves nothing
-- the signature does not.
--
-- A credential is issued the first time a share needs it, not before: a month
-- nobody is ever shown is never signed. Its indicators are disclosable one by
-- one, and a share shows the recipient only those she authorised.
--
-- Revocation is a Bitstring Status List. Each credential takes a random,
-- never-reused position in it at issuance. A credential is revoked when its
-- month is corrected (a new version supersedes the snapshot) or when she is
-- erased: her rows go, but the positions they held are kept as tombstones, so
-- a copy someone saved still shows as revoked rather than as valid.
--
-- The recipient reaches it through a link: a random token, of which only the
-- hash is stored, created by staff for a live share and closed with it. Every
-- opening is recorded, and AUTORIZAÇÕES tells her how many times and when.

-- ---------------------------------------------------------------- credentials

create table public.passport_credentials (
  id                 uuid primary key default gen_random_uuid(),
  snapshot_id        uuid not null unique references public.metric_snapshots (id) on delete cascade,
  entrepreneur_id    uuid not null references public.entrepreneurs (id) on delete cascade,
  status_index       integer not null unique check (status_index between 0 and 131071),
  reserved_at        timestamptz not null default now(),
  -- Set once, when the Edge Function returns it signed.
  kid                text,
  sd_jwt             text,
  issued_at          timestamptz,
  valid_from         timestamptz,
  valid_until        timestamptz,
  revoked_at         timestamptz,
  revocation_reason  text check (revocation_reason in ('superseded')),
  constraint a_credential_is_issued_whole check (
    (sd_jwt is null) = (kid is null) and (sd_jwt is null) = (issued_at is null)
    and (sd_jwt is null) = (valid_from is null) and (sd_jwt is null) = (valid_until is null)),
  constraint a_revocation_says_why check ((revoked_at is null) = (revocation_reason is null))
);

alter table public.passport_credentials enable row level security;
revoke all on public.passport_credentials from anon, authenticated;

-- Positions once held by an erased woman's credentials: revoked for ever, never handed out again.
create table public.passport_status_tombstones (
  status_index  integer primary key check (status_index between 0 and 131071),
  at            timestamptz not null default now()
);

alter table public.passport_status_tombstones enable row level security;
revoke all on public.passport_status_tombstones from anon, authenticated;

/**
 * A credential is written once and revoked at most once. Deleting is erasure
 * only, and leaves its position behind as a tombstone.
 */
create function private.passport_credentials_are_issued_once()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.entrepreneurs where id = old.entrepreneur_id) then
      raise exception 'a credential is never deleted; it is revoked' using errcode = '42501';
    end if;
    insert into public.passport_status_tombstones (status_index) values (old.status_index)
    on conflict (status_index) do nothing;
    return old;
  end if;
  if new.id <> old.id or new.snapshot_id <> old.snapshot_id or new.entrepreneur_id <> old.entrepreneur_id
     or new.status_index <> old.status_index or new.reserved_at <> old.reserved_at then
    raise exception 'a credential keeps its month and its position' using errcode = '42501';
  end if;
  if old.sd_jwt is not null and (new.sd_jwt, new.kid, new.issued_at, new.valid_from, new.valid_until)
       is distinct from (old.sd_jwt, old.kid, old.issued_at, old.valid_from, old.valid_until) then
    raise exception 'a credential is signed once' using errcode = '42501';
  end if;
  if old.revoked_at is not null and (new.revoked_at, new.revocation_reason)
       is distinct from (old.revoked_at, old.revocation_reason) then
    raise exception 'a revoked credential stays revoked' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger passport_credentials_are_issued_once
before update or delete on public.passport_credentials
for each row execute function private.passport_credentials_are_issued_once();

/** A corrected month revokes the credential of the version it supersedes. */
create function private.snapshot_supersedes_credential()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.supersedes_id is not null then
    update public.passport_credentials
       set revoked_at = now(), revocation_reason = 'superseded'
     where snapshot_id = new.supersedes_id and revoked_at is null;
  end if;
  return new;
end;
$$;

create trigger snapshot_supersedes_credential
after insert on public.metric_snapshots
for each row execute function private.snapshot_supersedes_credential();

/**
 * The credential of a snapshot version, for the Edge Function to sign.
 *
 * Signed already: {status: 'issued', id, sd_jwt}. Otherwise its position is
 * reserved -- random, never one in use or once used -- and what the
 * credential will say is returned: {status: 'to_sign', id, status_index, …}.
 * Asked again before it is signed, the same reservation comes back.
 */
create function public.passport_credential_begin(p_snapshot_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_snap public.metric_snapshots%rowtype;
  v_cred public.passport_credentials%rowtype;
  v_index integer;
  v_bytes bytea;
begin
  select * into v_snap from public.metric_snapshots where id = p_snapshot_id;
  if not found then
    raise exception 'no_such_snapshot' using errcode = 'P0002';
  end if;

  select * into v_cred from public.passport_credentials where snapshot_id = p_snapshot_id;
  if not found then
    loop
      v_bytes := extensions.gen_random_bytes(3);
      v_index := ((get_byte(v_bytes, 0) << 16) | (get_byte(v_bytes, 1) << 8) | get_byte(v_bytes, 2)) % 131072;
      continue when exists (select 1 from public.passport_status_tombstones where status_index = v_index);
      begin
        insert into public.passport_credentials (snapshot_id, entrepreneur_id, status_index)
        values (p_snapshot_id, v_snap.entrepreneur_id, v_index)
        returning * into v_cred;
        exit;
      exception when unique_violation then
        -- The position is taken, or another call reserved this month first.
        select * into v_cred from public.passport_credentials where snapshot_id = p_snapshot_id;
        exit when found;
      end;
    end loop;
  end if;

  if v_cred.sd_jwt is not null then
    return jsonb_build_object('status', 'issued', 'id', v_cred.id, 'sd_jwt', v_cred.sd_jwt);
  end if;
  return jsonb_build_object(
    'status', 'to_sign',
    'id', v_cred.id,
    'status_index', v_cred.status_index,
    'subject_ref', v_snap.subject_ref,
    'period', v_snap.period,
    'version', v_snap.version,
    'methodology', v_snap.methodology_version,
    'evidence_level', v_snap.evidence_level,
    'data_origin', v_snap.data_origin,
    'days_in_period', (v_snap.indicators ->> 'days_in_period')::integer,
    'indicators', (select jsonb_object_agg(v.key, v_snap.indicators -> v.key)
                     from private.share_indicators() v where v_snap.indicators ? v.key)
  );
end;
$$;

/** Stores the signed credential. Signed twice by racing calls, the first one stays and is returned. */
create function public.passport_credential_complete(
  p_id uuid,
  p_sd_jwt text,
  p_kid text,
  p_valid_from timestamptz,
  p_valid_until timestamptz
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_sd_jwt text;
begin
  update public.passport_credentials
     set sd_jwt = p_sd_jwt, kid = p_kid, issued_at = now(), valid_from = p_valid_from, valid_until = p_valid_until
   where id = p_id and sd_jwt is null;
  select sd_jwt into v_sd_jwt from public.passport_credentials where id = p_id;
  if v_sd_jwt is null then
    raise exception 'no_such_credential' using errcode = 'P0002';
  end if;
  return v_sd_jwt;
end;
$$;

/** Every revoked position: revoked credentials, superseded months, erased women. */
create function public.passport_status_revoked()
returns integer[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(i order by i), '{}')
    from (select c.status_index as i from public.passport_credentials c
           where c.revoked_at is not null
              or exists (select 1 from public.metric_snapshots n where n.supersedes_id = c.snapshot_id)
          union
          select t.status_index from public.passport_status_tombstones t) x
$$;

-- ---------------------------------------------------------------------- links

create table public.share_links (
  id             uuid primary key default gen_random_uuid(),
  share_id       uuid not null references public.share_authorisations (id) on delete cascade,
  token_sha256   text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  closed_at      timestamptz
);

create unique index share_links_one_open on public.share_links (share_id) where closed_at is null;

create table public.share_accesses (
  id           uuid primary key default gen_random_uuid(),
  share_id     uuid not null references public.share_authorisations (id) on delete cascade,
  link_id      uuid not null references public.share_links (id) on delete cascade,
  accessed_at  timestamptz not null default now()
);

create index share_accesses_by_share on public.share_accesses (share_id, accessed_at desc);

alter table public.share_links enable row level security;
alter table public.share_accesses enable row level security;
revoke all on public.share_links, public.share_accesses from anon, authenticated;

/**
 * Staff create the link a recipient opens, for a share that is live. The
 * token is returned once and only its hash is kept; a new link closes the
 * one before it.
 */
create function public.share_link_create(p_share_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
  v_expires timestamptz;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_create_links' using errcode = '42501';
  end if;
  if not private.share_is_live(p_share_id) then
    raise exception 'share_not_live' using errcode = 'P0001';
  end if;
  select expires_at into v_expires from public.share_authorisations where id = p_share_id;
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  update public.share_links set closed_at = now() where share_id = p_share_id and closed_at is null;
  insert into public.share_links (share_id, token_sha256, created_by)
  values (p_share_id, encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), auth.uid());
  -- The page on the site that opens it: <site>/app/passport/<token>.
  return jsonb_build_object('token', v_token, 'path', '/app/passport/' || v_token, 'expires_at', v_expires);
end;
$$;

/**
 * What a link opens, for the Edge Function that serves it. Live: records the
 * opening and returns the share and its months, with each month's credential
 * if it has one yet. Otherwise only why not: not_found, expired or ended --
 * never what the share was.
 */
create function public.passport_link_open(p_token text)
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
                   'sd_jwt', c.sd_jwt) order by s.period)
                 from unnest(v_share.snapshot_ids) u (id)
                 join public.metric_snapshots s on s.id = u.id
                 left join public.passport_credentials c on c.snapshot_id = s.id)
  );
end;
$$;

-- ------------------------------------------------ what she reads back, again

/** As before, with how many times each share was opened, and when last. */
create or replace function public.whatsapp_share_list(p_entrepreneur_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', x.n, 'recipient', x.name, 'purpose', private.share_purpose_text(x.purpose),
           'periods', to_jsonb(x.periods),
           'expires_on', to_char(x.expires_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
           'opened', x.opened,
           'last_opened_on', to_char(x.last_opened at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
           order by x.n), '[]'::jsonb)
    from (select row_number() over (order by s.answered_at, s.id)::integer as n, r.name, s.purpose, s.periods, s.expires_at,
                 (select count(*) from public.share_accesses a where a.share_id = s.id)::integer as opened,
                 (select max(a.accessed_at) from public.share_accesses a where a.share_id = s.id) as last_opened
            from public.share_authorisations s join public.passport_recipients r on r.id = s.recipient_id
           where s.entrepreneur_id = p_entrepreneur_id and s.status = 'authorised' and s.expires_at > now()) x
$$;

-- -------------------------------------------------------------------- grants

revoke execute on function private.passport_credentials_are_issued_once() from public, anon, authenticated;
revoke execute on function private.snapshot_supersedes_credential() from public, anon, authenticated;
revoke execute on function public.passport_credential_begin(uuid) from public, anon, authenticated;
revoke execute on function public.passport_credential_complete(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.passport_status_revoked() from public, anon, authenticated;
revoke execute on function public.passport_link_open(text) from public, anon, authenticated;
grant execute on function public.passport_credential_begin(uuid) to service_role;
grant execute on function public.passport_credential_complete(uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.passport_status_revoked() to service_role;
grant execute on function public.passport_link_open(text) to service_role;

-- Signed-in callers reach the staff RPC; the gate inside decides.
revoke execute on function public.share_link_create(uuid) from public, anon;
grant execute on function public.share_link_create(uuid) to authenticated, service_role;
