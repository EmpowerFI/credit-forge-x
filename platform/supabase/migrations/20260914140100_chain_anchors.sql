-- M7 (part) · chain anchors
--
-- One row per fact that has to be proven on-chain, and everything about how
-- that went. The table is also the work queue: the anchor-submit Edge Function
-- takes rows that are due and whose dependency has confirmed, submits them,
-- and writes back signature, slot and account. A second process reconciles
-- confirmed rows against the chain.
--
-- The commitment itself is computed in TypeScript (packages/audit-commitments)
-- from the payload public.anchor_payload() builds here — payload selection in
-- one place, canonicalisation and hashing in one other, never a third.

create type public.anchor_kind as enum (
  'community',              -- register_community
  'community_verification', -- verify_community
  'enrollment'              -- register_borrower_ref
);

create type public.anchor_status as enum ('pending', 'submitted', 'confirmed', 'failed');

create type public.reconcile_status as enum ('unchecked', 'verified', 'missing', 'mismatch');

create table public.chain_anchors (
  id bigint generated always as identity primary key,
  kind public.anchor_kind not null,
  -- community id for community kinds; entrepreneur id for enrollment.
  entity_id uuid not null,
  -- Anchors that must confirm first: verification waits for registration,
  -- enrollment waits for verification. The program would reject them anyway.
  depends_on bigint references public.chain_anchors (id),
  status public.anchor_status not null default 'pending',
  -- Filled in by anchor-submit.
  commitment bytea check (commitment is null or octet_length(commitment) = 32),
  payload jsonb,
  account_address text,
  signature text,
  slot bigint,
  program_id text not null default '4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  -- Filled in by reconciliation.
  reconcile public.reconcile_status not null default 'unchecked',
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  -- Each fact is anchored once. Retrying the same row is safe: the program's
  -- PDA seed makes a second write fail, and anchor-submit reads that as done
  -- if the stored commitment matches.
  unique (kind, entity_id),
  constraint confirmed_has_proof check (
    status <> 'confirmed' or (signature is not null and slot is not null and commitment is not null)
  )
);

create index chain_anchors_due_idx on public.chain_anchors (next_attempt_at)
  where status in ('pending', 'submitted');

alter table public.chain_anchors enable row level security;
revoke all on public.chain_anchors from anon, authenticated;
grant select on public.chain_anchors to authenticated;

-- The people a fact is about can see its proof; auditors and admins see all.
-- Never returns null: a caller with no entrepreneur record makes the equality
-- below null, and `if not null` in PL/pgSQL lets the caller through.
create function private.can_see_anchor(p_kind public.anchor_kind, p_entity_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    private.is_auditor_or_admin()
    or case p_kind
      when 'enrollment' then
        p_entity_id = private.my_entrepreneur_id() or private.leads_entrepreneur(p_entity_id)
      else
        private.leads_community(p_entity_id) or private.is_member(p_entity_id)
    end,
    false
  )
$$;

revoke all on function private.can_see_anchor(public.anchor_kind, uuid) from public;
grant execute on function private.can_see_anchor(public.anchor_kind, uuid) to authenticated, service_role;

create policy chain_anchors_read on public.chain_anchors
  for select to authenticated
  using ((select private.can_see_anchor(kind, entity_id)));

-- ---------------------------------------------------------------- payloads
-- What each anchor commits to. Only identifiers, enums and timestamps that
-- belong to the fact — and for a community its public name and place. No
-- personal data, no borrower_ref (the chain gets its hash as the account seed).

create function private.anchor_payload(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  case p_kind
    when 'community' then
      select jsonb_build_object(
        'community_id', c.id,
        'community_ref', encode(c.chain_ref, 'hex'),
        'name', c.name,
        'kind', c.kind,
        'city', c.city,
        'state', c.state,
        'leader_id', c.leader_id,
        'created_at', private.iso(c.created_at)
      ) into v
      from public.communities c where c.id = p_entity_id;

    when 'community_verification' then
      select jsonb_build_object(
        'community_id', c.id,
        'status', c.status,
        'verified_by', c.verified_by,
        'verified_at', private.iso(c.verified_at)
      ) into v
      from public.communities c where c.id = p_entity_id and c.status = 'verified';

    when 'enrollment' then
      -- The first community she joined, which is the one she is registered
      -- through on-chain.
      select jsonb_build_object(
        'entrepreneur_id', m.entrepreneur_id,
        'community_id', m.community_id,
        'joined_at', private.iso(m.joined_at)
      ) into v
      from public.community_memberships m
      where m.entrepreneur_id = p_entity_id
      order by m.joined_at, m.community_id
      limit 1;
  end case;

  return v;
end;
$$;

revoke all on function private.anchor_payload(public.anchor_kind, uuid) from public;
grant execute on function private.anchor_payload(public.anchor_kind, uuid) to service_role;
