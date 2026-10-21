-- A reminder at nine, about yesterday, only to whoever has not written it.
--
-- docs/whatsapp/diario.pt-BR.md §6: every day at 9h in São Paulo she is
-- reminded to record the day before, unless she already has. The reminder is
-- a template approved by Meta (it opens a conversation, so it is billed), and
-- its three quick replies are "Registrar ontem" (the form is sent back, free,
-- inside the window her tap opened), "Não abri ontem" and "Abri e não vendi".
--
-- pg_cron calls journal-reminder at 12:00 UTC -- 9h in São Paulo, which has
-- had no daylight saving since 2019 -- with a shared secret, as
-- passport-anchor is called. The function claims who is due here, sends, and
-- records each outcome.
--
-- One reminder per woman per day, ever: the claim is the row, and a failed
-- send is recorded and not retried, because a second message the same
-- morning costs twice and reads as nagging. Whoever is due:
--
--   * is enrolled and active on WhatsApp -- not mid-sign-up, not opted out;
--   * enrolled before today, so yesterday was a day she could have recorded;
--   * has nothing for yesterday: no line, and no word that it was quiet;
--   * is not simulated.
--
-- Secrets, not created here (a secret in a migration is a published secret):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/journal-reminder', 'journal_reminder_url');
--   select vault.create_secret('<the secret>', 'journal_reminder_secret');
-- written for each project by scripts/whatsapp/generate-reminder-secret.mts.

create table public.journal_reminders (
  entrepreneur_id  uuid not null references public.entrepreneurs (id) on delete cascade,
  -- The day she is reminded about: yesterday, at the time of sending.
  day              date not null,
  status           text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  -- Meta's id for the message sent, so its delivery status can be matched.
  message_id       text,
  error            text,
  claimed_at       timestamptz not null default now(),
  finished_at      timestamptz,
  primary key (entrepreneur_id, day),
  constraint a_sent_reminder_has_its_message check (status <> 'sent' or message_id is not null)
);

alter table public.journal_reminders enable row level security;
revoke all on public.journal_reminders from anon, authenticated;

-- Everyone due this morning, claimed in one statement, with what the
-- template needs: her number and the name she asked to be called by.
create function public.journal_reminders_claim(p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_claimed jsonb;
begin
  with due as (
    select e.id, e.display_name
      from public.whatsapp_conversations c
      join public.entrepreneurs e on e.id = c.entrepreneur_id
      join public.whatsapp_identities i on i.entrepreneur_id = e.id
     where c.state = 'ACTIVE'
       and not e.is_simulated
       and (e.created_at at time zone 'America/Sao_Paulo')::date < v_today
       and not exists (select 1 from public.journal_days d
                        where d.entrepreneur_id = e.id and d.day = v_today - 1)
       and not exists (select 1 from public.journal_reminders r
                        where r.entrepreneur_id = e.id and r.day = v_today - 1)
     order by e.id
     limit greatest(p_limit, 0)
  ),
  claimed as (
    insert into public.journal_reminders (entrepreneur_id, day)
    select id, v_today - 1 from due
    on conflict do nothing
    returning entrepreneur_id, day
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'entrepreneur_id', c.entrepreneur_id,
           'day', c.day,
           'phone', public.whatsapp_phone_of(c.entrepreneur_id),
           'name', coalesce(nullif(btrim(d.display_name), ''), 'empreendedora')
         )), '[]'::jsonb)
    into v_claimed
    from claimed c join due d on d.id = c.entrepreneur_id;
  return v_claimed;
end $$;

create function public.journal_reminder_finished(
  p_entrepreneur_id uuid,
  p_day date,
  p_message_id text,
  p_error text default null
)
returns void
language sql security definer set search_path = ''
as $$
  update public.journal_reminders
     set status = case when p_message_id is not null then 'sent' else 'failed' end,
         message_id = p_message_id,
         error = left(p_error, 500),
         finished_at = now()
   where entrepreneur_id = p_entrepreneur_id and day = p_day and status = 'claimed';
$$;

create function private.dispatch_journal_reminder()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'journal_reminder_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'journal_reminder_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_journal_reminder: vault secrets journal_reminder_url / journal_reminder_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-journal-reminder-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

select cron.schedule('journal-reminder', '0 12 * * *', $$select private.dispatch_journal_reminder()$$);

revoke execute on function public.journal_reminders_claim(integer) from public, anon, authenticated;
revoke execute on function public.journal_reminder_finished(uuid, date, text, text) from public, anon, authenticated;
revoke execute on function private.dispatch_journal_reminder() from public, anon, authenticated;
grant execute on function public.journal_reminders_claim(integer) to service_role;
grant execute on function public.journal_reminder_finished(uuid, date, text, text) to service_role;
