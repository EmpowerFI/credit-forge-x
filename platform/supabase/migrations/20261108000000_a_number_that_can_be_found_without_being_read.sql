-- Her phone number, which the product needs two incompatible things from.
--
-- It has to be FOUND: a message arrives carrying nothing but the number, and
-- the platform must know whose fortnight this is. That wants a deterministic
-- value to look up.
--
-- It has to be READ BACK: the fortnightly invitation is sent to it, and
-- Meta's address for a person is the number itself. That rules out storing
-- only a hash.
--
-- So both, and neither in the clear:
--
--   phone_index   HMAC-SHA256 of the canonical number under a key in the
--                 vault. Deterministic, so it can be looked up and made
--                 unique; keyed, so a stolen table is not a rainbow table --
--                 a bare SHA of a phone number is a phone number, since the
--                 whole space of Brazilian mobiles can be hashed in minutes.
--   phone_cipher  the same number, symmetrically encrypted under the same
--                 secret. Non-deterministic, read back only to send.
--
-- The key lives in vault.secrets as 'whatsapp_phone_key' and is NOT created
-- here: a key written in a migration is a key published in a public
-- repository. Every function below fails closed when it is absent, loudly,
-- rather than falling back to an unkeyed hash -- because the unkeyed fallback
-- is the version that looks like it works.
--
-- The canonical form is produced before it arrives here, by canonicalPhone()
-- in platform/supabase/functions/_shared/whatsapp.ts, which is where the
-- Brazilian ninth digit is restored -- Meta's wa_id often omits it, and the
-- same woman indexed twice is two women. These functions only check the
-- shape; they do not reshape.

create table public.whatsapp_identities (
  entrepreneur_id  uuid primary key references public.entrepreneurs (id) on delete cascade,
  phone_index      bytea not null unique check (octet_length(phone_index) = 32),
  phone_cipher     bytea not null,
  -- Set when she has answered on this number at least once. Until then the
  -- link is a claim somebody made about her, not something she confirmed.
  verified_at      timestamptz,
  is_simulated     boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Nobody reads this through the API. No policy at all, which under row-level
-- security means no row is visible to anon or authenticated; the service role
-- goes around it, and that is the only way in.
alter table public.whatsapp_identities enable row level security;
revoke all on public.whatsapp_identities from anon, authenticated;

create function private.phone_key()
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'whatsapp_phone_key';
  if v_key is null or length(v_key) < 32 then
    raise exception 'vault secret whatsapp_phone_key is not set, or is too short to be a key'
      using errcode = '28000';
  end if;
  return v_key;
end;
$$;

create function private.phone_index(p_e164 text)
returns bytea
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_e164 !~ '^\+[1-9]\d{7,14}$' then
    raise exception 'not a canonical E.164 number: %', p_e164 using errcode = '22023';
  end if;
  -- A distinct label per purpose, so the index key and the cipher key are
  -- never literally the same bytes even though one secret backs both.
  return extensions.hmac(p_e164, private.phone_key() || ':index', 'sha256');
end;
$$;

/**
 * Binds a number to an entrepreneur, or moves it to her.
 *
 * Numbers get recycled: a disconnected Brazilian number returns to the pool
 * and is reassigned, and a second woman signing up on a number a first one
 * used must not inherit the first one's history. So the number moves and the
 * old binding is deleted rather than kept alongside -- one number, one woman,
 * enforced by the unique index rather than by remembering to check.
 */
create function public.whatsapp_link_phone(p_e164 text, p_entrepreneur_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_index bytea := private.phone_index(p_e164);
  v_sim boolean;
begin
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;
  if not found then
    raise exception 'no such entrepreneur: %', p_entrepreneur_id using errcode = 'P0002';
  end if;

  delete from public.whatsapp_identities
   where phone_index = v_index and entrepreneur_id <> p_entrepreneur_id;

  insert into public.whatsapp_identities (entrepreneur_id, phone_index, phone_cipher, is_simulated)
  values (p_entrepreneur_id, v_index,
          extensions.pgp_sym_encrypt(p_e164, private.phone_key()), coalesce(v_sim, false))
  on conflict (entrepreneur_id) do update set
    phone_index = excluded.phone_index,
    phone_cipher = excluded.phone_cipher,
    is_simulated = excluded.is_simulated,
    verified_at = null;

  return p_entrepreneur_id;
end;
$$;

/** Whose fortnight this is. Null when the number is not bound to anyone. */
create function public.whatsapp_entrepreneur_for(p_e164 text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select entrepreneur_id from public.whatsapp_identities
   where phone_index = private.phone_index(p_e164)
$$;

/** She answered on it, so the binding is hers and not a claim about her. */
create function public.whatsapp_mark_verified(p_e164 text)
returns boolean
language sql security definer set search_path = ''
as $$
  update public.whatsapp_identities set verified_at = coalesce(verified_at, now())
   where phone_index = private.phone_index(p_e164)
  returning true
$$;

/** Read back only to address a message to her. */
create function public.whatsapp_phone_of(p_entrepreneur_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select extensions.pgp_sym_decrypt(phone_cipher, private.phone_key())
    from public.whatsapp_identities where entrepreneur_id = p_entrepreneur_id
$$;

/**
 * Every stored number, in the clear, for one purpose only.
 *
 * scripts/platform/scan-chain-pii.mts searches everything the audit program
 * holds on chain for values the database holds, and it cannot search for a
 * number it cannot read. The alternative is not scanning for phone numbers at
 * all, which is worse: the scan exists because the claim "nothing personal is
 * on chain" has to be checked rather than asserted.
 *
 * In public rather than private because the scanner reaches the database
 * through PostgREST, which serves no other schema. Execute is revoked from
 * everyone and granted to the service role alone, so being in public costs
 * nothing: a role that could call it could read the table anyway.
 */
create function public.whatsapp_phones_for_pii_scan()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select extensions.pgp_sym_decrypt(phone_cipher, private.phone_key()) from public.whatsapp_identities
$$;

revoke execute on function public.whatsapp_link_phone(text, uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_entrepreneur_for(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_mark_verified(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_phone_of(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_link_phone(text, uuid) to service_role;
grant execute on function public.whatsapp_entrepreneur_for(text) to service_role;
grant execute on function public.whatsapp_mark_verified(text) to service_role;
grant execute on function public.whatsapp_phone_of(uuid) to service_role;
grant execute on function private.phone_index(text) to service_role;
revoke execute on function public.whatsapp_phones_for_pii_scan() from public, anon, authenticated;
grant execute on function public.whatsapp_phones_for_pii_scan() to service_role;
