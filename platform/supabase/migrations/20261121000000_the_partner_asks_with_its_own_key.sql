-- The partner asks with its own key.
--
-- Step 6 of the Business Passport plan: the minimum the first partner needs
-- to read, from its own systems, what a woman authorised it to see -- and the
-- staff screens to run it without SQL.
--
-- A recipient gets API keys. A key is shown once when staff create it; only
-- its hash is kept, with a short prefix to tell keys apart. With it the
-- partner can list the shares in force for it, read one -- the same signed
-- months and proofs its link opens -- and ask a share's status. A key reads
-- only its own recipient's shares, and only while they are live; a revoked
-- key, or a recipient made inactive, reads nothing. Every read of a share is
-- an access, told back to her in AUTORIZAÇÕES like an opening of the link.
--
-- For staff (the dashboard's Passport page): recipients and their keys, the
-- women waiting for a share to be proposed, every share with its status and
-- how often it was read, and the link for a live share.

-- ------------------------------------------------------------------- keys

create table public.passport_recipient_keys (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.passport_recipients (id) on delete cascade,
  key_sha256    text not null unique check (key_sha256 ~ '^[0-9a-f]{64}$'),
  prefix        text not null,
  label         text check (label is null or char_length(label) <= 80),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

alter table public.passport_recipient_keys enable row level security;
revoke all on public.passport_recipient_keys from anon, authenticated;

/** A new key for a recipient, returned once. */
create function public.passport_recipient_key_create(p_recipient_code text, p_label text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipient uuid;
  v_key text;
  v_id uuid;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_manage_recipients' using errcode = '42501';
  end if;
  select id into v_recipient from public.passport_recipients where code = p_recipient_code;
  if not found then
    raise exception 'no_such_recipient' using errcode = 'P0002';
  end if;
  v_key := 'efp_' || rtrim(translate(encode(extensions.gen_random_bytes(30), 'base64'), '+/', '-_'), '=');
  insert into public.passport_recipient_keys (recipient_id, key_sha256, prefix, label, created_by)
  values (v_recipient, encode(extensions.digest(convert_to(v_key, 'UTF8'), 'sha256'), 'hex'), left(v_key, 10),
          nullif(btrim(p_label), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', left(v_key, 10));
end;
$$;

create function public.passport_recipient_key_revoke(p_key_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_manage_recipients' using errcode = '42501';
  end if;
  update public.passport_recipient_keys set revoked_at = now() where id = p_key_id and revoked_at is null;
end;
$$;

/** Recipients with their keys (prefixes only), for the dashboard. */
create or replace function public.passport_recipients_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_manage_recipients' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', r.code, 'name', r.name, 'kind', r.kind, 'active', r.active,
      'keys', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', k.id, 'prefix', k.prefix, 'label', k.label, 'created_at', k.created_at,
                  'last_used_at', k.last_used_at, 'revoked_at', k.revoked_at) order by k.created_at desc)
                from public.passport_recipient_keys k where k.recipient_id = r.id), '[]'::jsonb))
      order by r.name)
      from public.passport_recipients r), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------- what is read

alter table public.share_accesses
  alter column link_id drop not null,
  add column key_id uuid references public.passport_recipient_keys (id) on delete set null,
  add column via text not null default 'link' check (via in ('link', 'api'));

/** A share as its recipient reads it, by link or by API: the share and its months. */
create function private.passport_share_payload(p_share_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'share', jsonb_build_object(
      'id', s.id,
      'recipient', r.name,
      'purpose', s.purpose,
      'purpose_text', private.share_purpose_text(s.purpose),
      'subject_ref', s.subject_ref,
      'indicators', to_jsonb(s.indicators),
      'authorised_at', s.answered_at,
      'expires_at', s.expires_at),
    'months', (select jsonb_agg(jsonb_build_object(
                   'snapshot_id', m.id, 'period', m.period, 'version', m.version,
                   'superseded', exists (select 1 from public.metric_snapshots n where n.supersedes_id = m.id),
                   'sd_jwt', c.sd_jwt,
                   'anchor', (select jsonb_build_object(
                                'batch_no', b.batch_no, 'size', b.size, 'index', l.position, 'root', b.root,
                                'proof', to_jsonb(l.proof), 'signature', b.signature, 'slot', b.slot,
                                'block_time', b.block_time, 'cluster', b.cluster, 'authority', b.authority)
                                from public.passport_anchor_leaves l
                                join public.passport_anchor_batches b on b.id = l.batch_id and b.status = 'confirmed'
                               where l.credential_id = c.id))
                 order by m.period)
                 from unnest(s.snapshot_ids) u (id)
                 join public.metric_snapshots m on m.id = u.id
                 left join public.passport_credentials c on c.snapshot_id = m.id))
  from public.share_authorisations s join public.passport_recipients r on r.id = s.recipient_id
  where s.id = p_share_id
$$;

create or replace function public.passport_link_open(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_link public.share_links%rowtype;
  v_share public.share_authorisations%rowtype;
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
  insert into public.share_accesses (share_id, link_id, via) values (v_share.id, v_link.id, 'link');
  return jsonb_build_object('status', 'live') || private.passport_share_payload(v_share.id);
end;
$$;

-- --------------------------------------------------------------- the API

/** The recipient a key belongs to, if the key is valid and the recipient active; marks the key used. */
create function private.passport_key_recipient(p_key text)
returns table (key_id uuid, recipient_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.passport_recipient_keys k set last_used_at = now()
    from public.passport_recipients r
   where k.key_sha256 = encode(extensions.digest(convert_to(coalesce(p_key, ''), 'UTF8'), 'sha256'), 'hex')
     and k.revoked_at is null and r.id = k.recipient_id and r.active
  returning k.id, k.recipient_id;
end;
$$;

/** GET /api/v1/shares: the shares in force for the key's recipient. */
create function public.passport_api_shares(p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipient uuid;
begin
  select recipient_id into v_recipient from private.passport_key_recipient(p_key);
  if v_recipient is null then
    return jsonb_build_object('status', 'unauthorised');
  end if;
  return jsonb_build_object('status', 'ok', 'shares', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'subject_ref', s.subject_ref, 'purpose', s.purpose, 'periods', to_jsonb(s.periods),
      'indicators', to_jsonb(s.indicators), 'authorised_at', s.answered_at, 'expires_at', s.expires_at)
      order by s.answered_at desc)
      from public.share_authorisations s
     where s.recipient_id = v_recipient and private.share_is_live(s.id)), '[]'::jsonb));
end;
$$;

/**
 * GET /api/v1/shares/{id}: one share, as its link shows it, and recorded as
 * an access. Another recipient's share, or one not live, is not_found or its
 * status -- never its content.
 */
create function public.passport_api_share(p_key text, p_share_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_key uuid;
  v_recipient uuid;
  v_share public.share_authorisations%rowtype;
begin
  select key_id, recipient_id into v_key, v_recipient from private.passport_key_recipient(p_key);
  if v_recipient is null then
    return jsonb_build_object('status', 'unauthorised');
  end if;
  select * into v_share from public.share_authorisations where id = p_share_id and recipient_id = v_recipient;
  if not found or v_share.status not in ('authorised', 'revoked') then
    return jsonb_build_object('status', 'not_found');
  end if;
  if not private.share_is_live(v_share.id) then
    return jsonb_build_object('status', case when v_share.status = 'revoked' then 'ended' else 'expired' end);
  end if;
  insert into public.share_accesses (share_id, key_id, via) values (v_share.id, v_key, 'api');
  return jsonb_build_object('status', 'live') || private.passport_share_payload(v_share.id);
end;
$$;

/** GET /api/v1/shares/{id}/status: live, expired or ended -- and until when. Not an access: it reads no figure. */
create function public.passport_api_share_status(p_key text, p_share_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipient uuid;
  v_share public.share_authorisations%rowtype;
begin
  select recipient_id into v_recipient from private.passport_key_recipient(p_key);
  if v_recipient is null then
    return jsonb_build_object('status', 'unauthorised');
  end if;
  select * into v_share from public.share_authorisations where id = p_share_id and recipient_id = v_recipient;
  if not found or v_share.status not in ('authorised', 'revoked') then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object(
    'status', case when private.share_is_live(v_share.id) then 'live'
                   when v_share.status = 'revoked' then 'ended' else 'expired' end,
    'id', v_share.id, 'expires_at', v_share.expires_at, 'ended_at', v_share.revoked_at);
end;
$$;

-- ------------------------------------------------------------- for staff

/** Every share, newest first, with how it stands and how often it was read. */
create function public.share_overview(p_limit integer default 200)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_shares' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x.row order by x.at desc)
      from (select s.proposed_at as at, jsonb_build_object(
              'id', s.id, 'entrepreneur_id', s.entrepreneur_id,
              'first_name', split_part(coalesce(e.display_name, ''), ' ', 1),
              'subject_ref', s.subject_ref, 'recipient', r.name, 'recipient_code', r.code, 'purpose', s.purpose,
              'periods', to_jsonb(s.periods), 'indicators', to_jsonb(s.indicators), 'valid_days', s.valid_days,
              'status', case when s.status = 'authorised' and not private.share_is_live(s.id) then 'expired'
                             when s.status = 'proposed' and s.delivered_at is null then 'waiting_delivery'
                             else s.status end,
              'proposed_at', s.proposed_at, 'delivered_at', s.delivered_at, 'answered_at', s.answered_at,
              'expires_at', s.expires_at, 'revoked_at', s.revoked_at,
              'reads', (select count(*) from public.share_accesses a where a.share_id = s.id),
              'last_read_at', (select max(a.accessed_at) from public.share_accesses a where a.share_id = s.id),
              'has_link', exists (select 1 from public.share_links l where l.share_id = s.id and l.closed_at is null)) as row
              from public.share_authorisations s
              join public.passport_recipients r on r.id = s.recipient_id
              join public.entrepreneurs e on e.id = s.entrepreneur_id
             order by s.proposed_at desc limit p_limit) x), '[]'::jsonb);
end;
$$;

/**
 * Women with a partner benefit waiting on a share that has none proposed or
 * in force: the ones staff can propose to by hand.
 */
create function public.share_candidates()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_shares' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'entrepreneur_id', g.entrepreneur_id,
      'first_name', split_part(coalesce(e.display_name, ''), ' ', 1),
      'grant_code', g.code, 'title', m.title, 'partner_name', m.partner_name, 'recipient_code', m.recipient_code,
      'kept_days', g.kept_days, 'earned_at', g.granted_at,
      'closed_months', (select count(distinct ms.period) from public.metric_snapshots ms where ms.entrepreneur_id = g.entrepreneur_id))
      order by g.granted_at)
      from public.reward_grants g
      join public.entrepreneurs e on e.id = g.entrepreneur_id
      join public.reward_milestones m on m.programme_id = g.programme_id and m.code = g.code
     where g.status = 'awaiting_consent'
       and not exists (select 1 from public.share_authorisations s
                        where s.grant_id = g.id and s.status in ('proposed', 'authorised'))), '[]'::jsonb);
end;
$$;

-- -------------------------------------------------------------------- grants

revoke execute on function private.passport_share_payload(uuid) from public, anon, authenticated;
revoke execute on function private.passport_key_recipient(text) from public, anon, authenticated;
revoke execute on function public.passport_api_shares(text) from public, anon, authenticated;
revoke execute on function public.passport_api_share(text, uuid) from public, anon, authenticated;
revoke execute on function public.passport_api_share_status(text, uuid) from public, anon, authenticated;
grant execute on function public.passport_api_shares(text) to service_role;
grant execute on function public.passport_api_share(text, uuid) to service_role;
grant execute on function public.passport_api_share_status(text, uuid) to service_role;

-- Signed-in callers reach the staff RPCs; the gate inside decides.
revoke execute on function public.passport_recipient_key_create(text, text) from public, anon;
revoke execute on function public.passport_recipient_key_revoke(uuid) from public, anon;
revoke execute on function public.share_overview(integer) from public, anon;
revoke execute on function public.share_candidates() from public, anon;
grant execute on function public.passport_recipient_key_create(text, text) to authenticated, service_role;
grant execute on function public.passport_recipient_key_revoke(uuid) to authenticated, service_role;
grant execute on function public.share_overview(integer) to authenticated, service_role;
grant execute on function public.share_candidates() to authenticated, service_role;
