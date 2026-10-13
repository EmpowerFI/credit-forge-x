-- The entry conversation, as a row rather than a session.
--
-- She answers over four days, from the bus, with the app closed in between.
-- Nothing may depend on a process staying alive, so every reply is decided
-- from this row alone -- the machine that decides is pure and lives in
-- platform/supabase/functions/_shared/conversation.ts, and this is only where
-- its state rests between messages.
--
-- Keyed by the number and not by the entrepreneur, because for most of this
-- conversation there is no entrepreneur yet: she becomes one on the last
-- answer, and until then the only thing that identifies her is the number she
-- is writing from -- stored as the same keyed HMAC as everywhere else, never
-- in the clear.

create table public.whatsapp_conversations (
  phone_index      bytea primary key check (octet_length(phone_index) = 32),
  -- Set when the conversation ends in an account. Null for everyone still
  -- answering, and for anyone who left before finishing.
  entrepreneur_id  uuid references public.entrepreneurs (id) on delete set null,
  state            text not null check (state in ('NEW', 'CONSENT', 'PROFILE', 'ACTIVE', 'OPTED_OUT')),
  step             text check (step in ('name', 'city', 'sector', 'since')),
  -- Her answers so far. Written only when an answer was understood, so this
  -- never holds a value nobody could read.
  draft            jsonb not null default '{}'::jsonb,
  is_simulated     boolean not null default false,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table public.whatsapp_conversations enable row level security;
revoke all on public.whatsapp_conversations from anon, authenticated;

-- How long she has been at it. Nullable on purpose: "I do not know" is an
-- answer, and it must not be stored as zero months in business.
alter table public.entrepreneurs add column months_operating smallint
  check (months_operating is null or months_operating between 1 and 720);

/**
 * Picks up the conversation for a number, creating it on first contact.
 *
 * Returns the row as the state machine wants it. The caller never invents a
 * starting state: a number nobody has written from gets NEW here, once.
 */
create function public.whatsapp_conversation_for(p_e164 text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_index bytea := private.phone_index(p_e164);
  v_row public.whatsapp_conversations%rowtype;
begin
  insert into public.whatsapp_conversations (phone_index, state)
  values (v_index, 'NEW')
  on conflict (phone_index) do nothing;

  select * into v_row from public.whatsapp_conversations where phone_index = v_index;
  return jsonb_build_object(
    'state', v_row.state, 'step', v_row.step, 'draft', v_row.draft,
    'entrepreneur_id', v_row.entrepreneur_id
  );
end;
$$;

/** Stores what the machine decided. Nothing here judges it. */
create function public.whatsapp_conversation_save(p_e164 text, p_state text, p_step text, p_draft jsonb)
returns void
language sql security definer set search_path = ''
as $$
  update public.whatsapp_conversations
     set state = p_state, step = p_step, draft = p_draft, updated_at = now()
   where phone_index = private.phone_index(p_e164)
$$;

/**
 * The last answer: she becomes an entrepreneur, the number becomes hers, and
 * the consent is written with the wording she was shown.
 *
 * One transaction, because a woman who exists without a consent record is
 * worse than one who does not exist: the record is what says she was asked.
 *
 * Idempotent on the conversation, not on the person. A second call for a
 * number already enrolled returns the same entrepreneur and writes nothing --
 * Meta retries, and a retry must not create a second woman.
 */
create function public.whatsapp_enrol(p_e164 text, p_draft jsonb, p_text_version text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_index bytea := private.phone_index(p_e164);
  v_existing uuid;
  v_id uuid;
  v_name text;
  v_months smallint;
begin
  -- The conversation row is the idempotency key, so it has to be there. It
  -- is not the identity row: a recycled number belongs to whoever is
  -- answering now, and whatsapp_link_phone is what moves it. Enrolling with
  -- no conversation would quietly make the retry guard do nothing, so a
  -- caller that skipped the first step is told rather than obeyed.
  select entrepreneur_id into v_existing
    from public.whatsapp_conversations where phone_index = v_index;
  if not found then
    raise exception 'no conversation for this number; call whatsapp_conversation_for first'
      using errcode = 'P0002';
  end if;
  if v_existing is not null then
    return v_existing;
  end if;

  v_name := nullif(trim(p_draft ->> 'name'), '');
  if v_name is null then
    raise exception 'cannot enrol without a name' using errcode = '22023';
  end if;
  if coalesce((p_draft ->> 'consented')::boolean, false) is not true then
    raise exception 'cannot enrol without a consent' using errcode = '22023';
  end if;
  v_months := nullif(p_draft ->> 'months_operating', '')::smallint;

  insert into public.entrepreneurs (display_name, business_sector, city, state, months_operating)
  values (left(v_name, 80), nullif(trim(p_draft ->> 'sector'), ''),
          nullif(trim(p_draft ->> 'city'), ''), nullif(trim(p_draft ->> 'state_uf'), ''), v_months)
  returning id into v_id;

  -- Assessment only. The wording she was shown promises a reading of her own
  -- month and says nobody sees her figures without her say-so; it does not
  -- ask for a partner, an investor or an impact report, so none of those is
  -- recorded as agreed. Widening is a new consent, never a default.
  insert into public.consents
    (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel)
  values (v_id, 1, p_text_version, true, false, false, false, 'whatsapp');

  perform public.whatsapp_link_phone(p_e164, v_id);
  perform public.whatsapp_mark_verified(p_e164);

  update public.whatsapp_conversations
     set entrepreneur_id = v_id, updated_at = now()
   where phone_index = v_index;

  return v_id;
end;
$$;

/**
 * True when this delivery has not been handled before, and false on a retry.
 *
 * Meta retries anything it did not see a 200 for, and a retried answer run
 * through the machine twice advances the conversation two questions: she is
 * asked for her city, never sees the question about what she sells, and the
 * sector lands as her answer to something else. The check-in path has the
 * same guard inside whatsapp_record_half; this is the one for plain messages.
 *
 * Named for what it returns rather than for what it does. A guard whose name
 * and whose answer disagree gets read backwards by whoever calls it next,
 * and reading this one backwards treats every new message as a repeat.
 */
create function public.whatsapp_message_is_new(p_message_id text, p_outcome text default 'conversation')
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.whatsapp_inbound_events (message_id, outcome)
  values (p_message_id, p_outcome)
  on conflict (message_id) do nothing;
  -- FOUND is true when the insert put a row in, which is exactly when the
  -- message is one we have not handled.
  return found;
end;
$$;

revoke execute on function public.whatsapp_message_is_new(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_message_is_new(text, text) to service_role;

revoke execute on function public.whatsapp_conversation_for(text) from public, anon, authenticated;
revoke execute on function public.whatsapp_conversation_save(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.whatsapp_enrol(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.whatsapp_conversation_for(text) to service_role;
grant execute on function public.whatsapp_conversation_save(text, text, text, jsonb) to service_role;
grant execute on function public.whatsapp_enrol(text, jsonb, text) to service_role;
