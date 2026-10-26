-- A reminder that knows when to stop.
--
-- Founder's decision, 26/10/2026. A woman who has not recorded anything for
-- seven days in a row is not reminded an eighth time. On the seventh morning
-- she gets a different template, lembrete_pausa, which says, kindly, that the
-- reminders are pausing and how to bring them back. After that nothing is
-- sent until she records a day or writes anything at all, and then the daily
-- reminder resumes by itself.
--
-- Every reminder is billed, and a daily message nobody answers is how a
-- number gets reported as spam. Pausing protects her patience and the number.
--
-- The count: the days up to yesterday since the latest of
--   * the last day she kept (a line, or her word that it was quiet),
--   * the day before her last message of any kind (a message on Tuesday
--     makes Wednesday's reminder, about Tuesday, the first of a new run),
--   * the day before she enrolled.
-- Days 1 to 6 get lembrete_diario; day 7 gets lembrete_pausa; from day 8 on,
-- nothing.
--
-- "Any message" is whatsapp_conversations.last_inbound_at, which the webhook
-- stamps through whatsapp_heard for every message it receives.

alter table public.whatsapp_conversations add column last_inbound_at timestamptz;

create function public.whatsapp_heard(p_e164 text)
returns void
language sql security definer set search_path = ''
as $$
  update public.whatsapp_conversations
     set last_inbound_at = now()
   where phone_index = private.phone_index(p_e164);
$$;

alter table public.journal_reminders
  add column kind text not null default 'daily' check (kind in ('daily', 'pause'));

-- Days without a record up to yesterday, as above.
create function private.journal_days_unrecorded(p_entrepreneur_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select ((private.sp_today() - 1) - greatest(
            (select max(d.day) from public.journal_days d where d.entrepreneur_id = p_entrepreneur_id),
            (select (c.last_inbound_at at time zone 'America/Sao_Paulo')::date - 1
               from public.whatsapp_conversations c where c.entrepreneur_id = p_entrepreneur_id),
            (select (e.created_at at time zone 'America/Sao_Paulo')::date - 1
               from public.entrepreneurs e where e.id = p_entrepreneur_id)
          ))::integer
$$;

create or replace function public.journal_reminders_claim(p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_claimed jsonb;
begin
  with active as (
    select e.id, e.display_name, private.journal_days_unrecorded(e.id) as gap
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
  ),
  due as (
    select id, display_name, case when gap >= 7 then 'pause' else 'daily' end as kind
      from active
     where gap between 1 and 7
     order by id
     limit greatest(p_limit, 0)
  ),
  claimed as (
    insert into public.journal_reminders (entrepreneur_id, day, kind)
    select id, v_today - 1, kind from due
    on conflict do nothing
    returning entrepreneur_id, day, kind
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'entrepreneur_id', c.entrepreneur_id,
           'day', c.day,
           'kind', c.kind,
           'phone', public.whatsapp_phone_of(c.entrepreneur_id),
           'name', coalesce(nullif(btrim(d.display_name), ''), 'empreendedora')
         )), '[]'::jsonb)
    into v_claimed
    from claimed c join due d on d.id = c.entrepreneur_id;
  return v_claimed;
end $$;

revoke execute on function public.whatsapp_heard(text) from public, anon, authenticated;
revoke execute on function private.journal_days_unrecorded(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_heard(text) to service_role;
