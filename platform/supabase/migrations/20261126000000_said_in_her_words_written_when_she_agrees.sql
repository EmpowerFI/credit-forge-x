-- A day said in her own words, written only when she agrees.
--
-- She can send a voice note or a plain message instead of the form. OpenAI
-- transcribes the voice note, Claude proposes the lines, code checks every
-- figure against her words (_shared/spoken.ts), and she sees the result with
-- two buttons: Confirmar and Corrigir. This is where the proposal waits.
--
--   journal_drafts       one proposal per message. Nothing in it counts for
--                        anything until she confirms; confirming writes it
--                        through journal_record, in the same transaction, so
--                        a refusal there leaves the draft as it was.
--   journal_spoken_uses  one row per message sent to the services, so one
--                        number cannot run up their bill.
--
-- What she said is kept as short as it can be: the audio is never stored
-- anywhere; the transcript is cleared the moment she decides; and every row
-- of both tables is deleted 23 hours after it was written, by a job that runs
-- every quarter of an hour -- inside the 24 hours the consent text promises.
-- A draft can be confirmed for 23 hours, and only the latest one: a new
-- message supersedes the one before.

create table public.journal_drafts (
  id               uuid primary key default gen_random_uuid(),
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  -- The message it was read from: one draft per message, whatever Meta retries.
  message_id       text not null unique,
  source           text not null check (source in ('voice', 'text')),
  -- What she said, as transcribed or as written. Cleared once she decides.
  transcript       text check (char_length(transcript) <= 5000),
  day              date not null,
  -- As journal_record takes them; checked again there on confirmation.
  lines            jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 20),
  status           text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'discarded', 'superseded')),
  model            text not null,
  prompt_version   text not null,
  transcriber      text,
  -- What the checks refused in the model's answer, for review while the row lives.
  refusals         text[] not null default '{}',
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  constraint a_draft_is_decided_once check ((status = 'pending') = (decided_at is null)),
  constraint a_decided_draft_keeps_no_words check (status = 'pending' or transcript is null)
);

create index journal_drafts_hers on public.journal_drafts (entrepreneur_id, created_at desc);

create table public.journal_spoken_uses (
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  used_at          timestamptz not null default now()
);

create index journal_spoken_uses_hers on public.journal_spoken_uses (entrepreneur_id, used_at);

alter table public.journal_drafts enable row level security;
alter table public.journal_spoken_uses enable row level security;
revoke all on public.journal_drafts, public.journal_spoken_uses from anon, authenticated;

-- ---------------------------------------------------------------- the limit

-- Whether one more message of hers may go to the services today; counts it if so.
create function public.journal_spoken_allow(p_entrepreneur_id uuid, p_limit integer default 20)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  -- One at a time per woman, so two deliveries at once cannot both pass at the limit.
  perform pg_advisory_xact_lock(hashtextextended('journal_spoken:' || p_entrepreneur_id::text, 0));
  if (select count(*) from public.journal_spoken_uses
       where entrepreneur_id = p_entrepreneur_id and used_at > now() - interval '24 hours') >= p_limit then
    return false;
  end if;
  insert into public.journal_spoken_uses (entrepreneur_id) values (p_entrepreneur_id);
  return true;
end $$;

-- ---------------------------------------------------------------- the draft

create function public.journal_draft_create(
  p_entrepreneur_id uuid,
  p_message_id text,
  p_source text,
  p_transcript text,
  p_day date,
  p_lines jsonb,
  p_model text,
  p_prompt_version text,
  p_transcriber text default null,
  p_refusals text[] default '{}'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.journal_drafts where message_id = p_message_id;
  if found then
    return v_id;
  end if;

  update public.journal_drafts
     set status = 'superseded', decided_at = now(), transcript = null
   where entrepreneur_id = p_entrepreneur_id and status = 'pending';

  insert into public.journal_drafts
    (entrepreneur_id, message_id, source, transcript, day, lines, model, prompt_version, transcriber, refusals)
  values
    (p_entrepreneur_id, p_message_id, p_source, p_transcript, p_day, p_lines, p_model, p_prompt_version,
     p_transcriber, coalesce(p_refusals, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- Her answer to a draft. Confirmed, the lines go through journal_record in
-- this transaction, under the draft's own message id -- so a second tap is a
-- duplicate there, and a refusal there rolls this back and leaves the draft
-- pending. Anything not hers, not pending, or older than 23 hours is 'stale'.
create function public.journal_draft_decide(p_draft_id uuid, p_entrepreneur_id uuid, p_confirm boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_draft public.journal_drafts%rowtype;
  v_recorded jsonb;
begin
  select * into v_draft from public.journal_drafts
   where id = p_draft_id and entrepreneur_id = p_entrepreneur_id
   for update;
  if not found or v_draft.status <> 'pending' or v_draft.created_at < now() - interval '23 hours' then
    return jsonb_build_object('status', 'stale');
  end if;

  update public.journal_drafts
     set status = case when p_confirm then 'confirmed' else 'discarded' end,
         decided_at = now(),
         transcript = null
   where id = p_draft_id;

  if not p_confirm then
    return jsonb_build_object('status', 'discarded');
  end if;

  v_recorded := public.journal_record(p_entrepreneur_id, 'draft:' || p_draft_id::text, v_draft.day, v_draft.lines);
  return jsonb_build_object('status', 'confirmed', 'day', v_draft.day, 'recorded', v_recorded);
end $$;

-- ---------------------------------------------------------------- forgetting

create function private.journal_spoken_forget()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.journal_drafts where created_at < now() - interval '23 hours';
  delete from public.journal_spoken_uses where used_at < now() - interval '24 hours';
$$;

select cron.schedule('journal-spoken-forget', '*/15 * * * *', 'select private.journal_spoken_forget()');

revoke execute on function public.journal_spoken_allow(uuid, integer) from public, anon, authenticated;
revoke execute on function public.journal_draft_create(uuid, text, text, text, date, jsonb, text, text, text, text[])
  from public, anon, authenticated;
revoke execute on function public.journal_draft_decide(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function private.journal_spoken_forget() from public, anon, authenticated;
grant execute on function public.journal_spoken_allow(uuid, integer) to service_role;
grant execute on function public.journal_draft_create(uuid, text, text, text, date, jsonb, text, text, text, text[])
  to service_role;
grant execute on function public.journal_draft_decide(uuid, uuid, boolean) to service_role;
