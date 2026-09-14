-- M7 (rest) · reconciliation
--
-- Every confirmed proof is checked again, periodically, by anchor-reconcile:
-- the commitment is recomputed from the record as it stands now and compared
-- with the one recorded at anchoring and the one in the account on chain.
--
--   verified  all three agree
--   missing   the account is not on chain, or not the program's
--   mismatch  the record changed after it was proven, or the chain holds
--             something else — either way, for a person to look at
--
-- The audit screen does the same check in a viewer's browser, on demand; this
-- is the same check with nobody asking, so a change is found even if no one
-- opens that record.

alter table public.chain_anchors add column reconcile_note text;

create index chain_anchors_reconcile_idx on public.chain_anchors (reconciled_at nulls first, id)
  where status = 'confirmed';

-- Confirmed proofs never checked, or not checked for a day, with the record's
-- payload as it is now. Checking twice is harmless, so there is no lease.
create function public.claim_reconcile_batch(p_limit integer default 200)
returns table (
  id bigint,
  kind public.anchor_kind,
  entity_id uuid,
  commitment text,
  account_address text,
  signature text,
  payload jsonb
)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.kind, a.entity_id, encode(a.commitment, 'hex'), a.account_address, a.signature,
         private.anchor_payload(a.kind, a.entity_id)
  from public.chain_anchors a
  where a.status = 'confirmed'
    and (a.reconciled_at is null or a.reconciled_at < now() - interval '1 day')
  order by a.reconciled_at nulls first, a.id
  limit least(greatest(p_limit, 1), 500)
$$;

-- Results: [{ "id": 1, "result": "verified" | "missing" | "mismatch", "note": "..." }].
create function public.record_reconciliation(p_results jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.chain_anchors a
  set reconcile = (r ->> 'result')::public.reconcile_status,
      reconcile_note = left(r ->> 'note', 500),
      reconciled_at = now()
  from jsonb_array_elements(p_results) r
  where a.id = (r ->> 'id')::bigint
    and a.status = 'confirmed'
    and r ->> 'result' in ('verified', 'missing', 'mismatch');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_reconcile_batch(integer), public.record_reconciliation(jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_reconcile_batch(integer), public.record_reconciliation(jsonb)
  to service_role;

-- Called every minute. Same secret as anchor-submit; the function lives next to it.
create function private.dispatch_reconcile()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.chain_anchors
    where status = 'confirmed' and (reconciled_at is null or reconciled_at < now() - interval '1 day')
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_reconcile: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;

  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/anchor-reconcile'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_reconcile() from public;

select cron.schedule('reconcile-anchors', '* * * * *', 'select private.dispatch_reconcile()');

-- The audit screen shows when the proof was last re-checked, and how it went.
create or replace function public.audit_record(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_anchor public.chain_anchors;
  v_entrepreneur uuid := private.anchor_entrepreneur(p_kind, p_entity_id);
begin
  if not private.can_see_anchor(p_kind, p_entity_id) then
    raise exception 'not_allowed_to_audit' using errcode = '42501';
  end if;

  select * into v_anchor from public.chain_anchors where kind = p_kind and entity_id = p_entity_id;
  if not found then
    raise exception 'anchor_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'anchor', jsonb_build_object(
      'kind', v_anchor.kind,
      'entity_id', v_anchor.entity_id,
      'status', v_anchor.status,
      'commitment', encode(v_anchor.commitment, 'hex'),
      'account_address', v_anchor.account_address,
      'signature', v_anchor.signature,
      'slot', v_anchor.slot,
      'program_id', v_anchor.program_id,
      'reconcile', v_anchor.reconcile,
      'reconciled_at', private.iso(v_anchor.reconciled_at),
      'reconcile_note', v_anchor.reconcile_note,
      'confirmed_at', private.iso(v_anchor.confirmed_at)
    ),
    'payload', private.anchor_payload(p_kind, p_entity_id),
    'community_ref', case
      when p_kind = 'enrollment' then
        (select encode(co.chain_ref, 'hex')
         from public.community_memberships m
         join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = p_entity_id
         order by m.joined_at, m.community_id
         limit 1)
      when p_kind in ('community', 'community_verification') then
        (select encode(co.chain_ref, 'hex') from public.communities co where co.id = p_entity_id)
    end,
    'borrower_ref', case
      when v_entrepreneur is not null and private.is_auditor_or_admin() then
        (select encode(borrower_ref, 'hex') from public.entrepreneurs where id = v_entrepreneur)
    end
  );
end;
$$;
