-- audit_record also returns the community's chain ref.
--
-- The audit screen derives every account address itself instead of trusting
-- the one recorded. A verification's payload does not carry the community ref,
-- so without it the screen could not check that proof's address; and for an
-- enrollment it lets the screen check that the borrower was registered through
-- the community the database says she joined. The ref is not secret — the
-- community's own registration commits to it.

create or replace function public.audit_record(p_kind public.anchor_kind, p_entity_id uuid)
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
    'community_ref', case
      when p_kind = 'enrollment' then
        (select encode(co.chain_ref, 'hex')
         from public.community_memberships m
         join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = p_entity_id
         order by m.joined_at, m.community_id
         limit 1)
      else
        (select encode(co.chain_ref, 'hex') from public.communities co where co.id = p_entity_id)
    end,
    'borrower_ref', case
      when p_kind = 'enrollment' and private.is_auditor_or_admin() then
        (select encode(borrower_ref, 'hex') from public.entrepreneurs where id = p_entity_id)
    end
  );
end;
$$;
