-- The community flow: create → verify (or reject) → enroll entrepreneurs.
--
-- The only way clients write these tables. Each function checks the caller's
-- role itself, and schedules the on-chain anchor for the fact it just created,
-- in the same transaction — so a fact can never exist without its anchor
-- being queued.
--
-- Errors are raised with a stable snake_case message key (e.g.
-- 'community_not_verified') that the app maps to user-facing text.

create function public.create_community(
  p_name text,
  p_kind public.community_kind,
  p_city text,
  p_state text,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(private.my_role() in ('community_leader', 'admin'), false) is false then
    raise exception 'only_leaders_create_communities' using errcode = '42501';
  end if;

  insert into public.communities (name, kind, city, state, description, leader_id)
  values (
    trim(p_name), p_kind, trim(p_city), upper(trim(p_state)),
    nullif(trim(p_description), ''), auth.uid()
  )
  returning id into v_id;

  insert into public.chain_anchors (kind, entity_id) values ('community', v_id);
  return v_id;
end;
$$;

create function public.verify_community(p_community_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_community public.communities;
begin
  if not private.is_admin() then
    raise exception 'only_admins_verify_communities' using errcode = '42501';
  end if;

  select * into v_community from public.communities where id = p_community_id for update;
  if not found then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;
  if v_community.leader_id = auth.uid() then
    raise exception 'cannot_verify_own_community' using errcode = '42501';
  end if;
  if v_community.status <> 'pending_verification' then
    raise exception 'community_already_reviewed' using errcode = 'P0001';
  end if;

  update public.communities
  set status = 'verified', verified_at = now(), verified_by = auth.uid(),
      review_note = nullif(trim(p_note), '')
  where id = p_community_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  select 'community_verification', p_community_id, a.id
  from public.chain_anchors a
  where a.kind = 'community' and a.entity_id = p_community_id;
end;
$$;

-- Rejection stays off-chain: there is nothing to prove about a community that
-- never entered the programme.
create function public.reject_community(p_community_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'only_admins_verify_communities' using errcode = '42501';
  end if;
  if nullif(trim(p_note), '') is null then
    raise exception 'rejection_needs_a_reason' using errcode = '22023';
  end if;

  update public.communities
  set status = 'rejected', review_note = trim(p_note)
  where id = p_community_id and status = 'pending_verification';

  if not found then
    raise exception 'community_not_pending' using errcode = 'P0001';
  end if;
end;
$$;

-- Registers an entrepreneur in a verified community: a new one when
-- p_entrepreneur_id is null, otherwise an existing one. Her first enrollment
-- also queues her on-chain registration; later ones do not, since the chain
-- knows each borrower once.
create function public.enroll_entrepreneur(
  p_community_id uuid,
  p_display_name text default null,
  p_business_name text default null,
  p_business_sector text default null,
  p_city text default null,
  p_state text default null,
  p_entrepreneur_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.community_status;
  v_entrepreneur_id uuid := p_entrepreneur_id;
  v_verification_anchor bigint;
begin
  if not (private.leads_community(p_community_id) or private.is_admin()) then
    raise exception 'only_the_leader_enrolls' using errcode = '42501';
  end if;

  select status into v_status from public.communities where id = p_community_id;
  if v_status is distinct from 'verified' then
    raise exception 'community_not_verified' using errcode = 'P0001';
  end if;

  if v_entrepreneur_id is null then
    if nullif(trim(p_display_name), '') is null then
      raise exception 'entrepreneur_needs_a_name' using errcode = '22023';
    end if;
    insert into public.entrepreneurs (display_name, business_name, business_sector, city, state)
    values (
      trim(p_display_name), nullif(trim(p_business_name), ''), nullif(trim(p_business_sector), ''),
      nullif(trim(p_city), ''), nullif(upper(trim(p_state)), '')
    )
    returning id into v_entrepreneur_id;
  elsif not exists (select 1 from public.entrepreneurs where id = v_entrepreneur_id) then
    raise exception 'entrepreneur_not_found' using errcode = 'P0002';
  end if;

  insert into public.community_memberships (community_id, entrepreneur_id)
  values (p_community_id, v_entrepreneur_id)
  on conflict do nothing;
  if not found then
    raise exception 'already_a_member' using errcode = '23505';
  end if;

  select id into v_verification_anchor
  from public.chain_anchors
  where kind = 'community_verification' and entity_id = p_community_id;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('enrollment', v_entrepreneur_id, v_verification_anchor)
  on conflict (kind, entity_id) do nothing;

  return v_entrepreneur_id;
end;
$$;

-- What the audit screen needs to check one fact end to end: the anchor as
-- recorded, and the payload as the database would build it *now*. The browser
-- hashes the payload itself and compares it with the recorded commitment and
-- with the account on-chain. The raw borrower_ref is released to auditors and
-- admins only, so they can recompute the hash the borrower's account is keyed by.
create function public.audit_record(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_anchor public.chain_anchors;
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
      'confirmed_at', private.iso(v_anchor.confirmed_at)
    ),
    'payload', private.anchor_payload(p_kind, p_entity_id),
    'borrower_ref', case
      when p_kind = 'enrollment' and private.is_auditor_or_admin() then
        (select encode(borrower_ref, 'hex') from public.entrepreneurs where id = p_entity_id)
    end
  );
end;
$$;

revoke all on function
  public.create_community(text, public.community_kind, text, text, text),
  public.verify_community(uuid, text),
  public.reject_community(uuid, text),
  public.enroll_entrepreneur(uuid, text, text, text, text, text, uuid),
  public.audit_record(public.anchor_kind, uuid)
from public, anon;

grant execute on function
  public.create_community(text, public.community_kind, text, text, text),
  public.verify_community(uuid, text),
  public.reject_community(uuid, text),
  public.enroll_entrepreneur(uuid, text, text, text, text, text, uuid),
  public.audit_record(public.anchor_kind, uuid)
to authenticated;
