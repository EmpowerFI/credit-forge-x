-- A recorded day stays open to her.
--
-- She records the day and then remembers a sale she left out, or sees she
-- typed R$ 50 for R$ 500. Adding a line to a recorded day already works
-- (journal_record adds to the day), and taking one back already works
-- (diary_void_entry strikes it through). What was missing is changing one:
-- here the old line is struck through and the corrected one recorded in the
-- same transaction, so the day is never left with neither or with both.
--
-- Same limits as taking a line back: only her own, only today's and
-- yesterday's, never in a closed month. The corrected line stays on the
-- day of the one it replaces. A retry with the same request id changes
-- nothing twice.

create function public.diary_correct_entry(p_entry_id uuid, p_entry jsonb, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_line public.journal_entries%rowtype;
  v_today date := private.sp_today();
  v_message text;
begin
  if p_request_id is null then
    raise exception 'a correction needs a request id' using errcode = '22023';
  end if;
  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception 'a correction is one line' using errcode = '22023';
  end if;
  v_message := 'web:' || p_request_id::text;

  select * into v_line from public.journal_entries
   where id = p_entry_id and entrepreneur_id = v_me for update;
  if not found then
    raise exception 'no_such_line' using errcode = 'P0001';
  end if;

  -- Already done: the same request came back.
  if exists (select 1 from public.whatsapp_inbound_events where message_id = v_message) then
    return jsonb_build_object('status', 'duplicate', 'day', v_line.occurred_on,
                              'summary', public.journal_day_summary(v_me, v_line.occurred_on));
  end if;

  if v_line.voided_at is not null then
    raise exception 'already_voided' using errcode = 'P0001';
  end if;
  if v_line.occurred_on not in (v_today - 1, v_today) then
    raise exception 'too_old_to_correct' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.checkins
              where entrepreneur_id = v_me and period = to_char(v_line.occurred_on, 'YYYY-MM')) then
    raise exception 'month_closed' using errcode = 'P0001';
  end if;

  update public.journal_entries set voided_at = now(), voided_by_message = v_message where id = v_line.id;
  perform public.journal_record(v_me, v_message, v_line.occurred_on, jsonb_build_array(p_entry));

  return jsonb_build_object('status', 'corrected', 'day', v_line.occurred_on,
                            'summary', public.journal_day_summary(v_me, v_line.occurred_on));
end $$;

revoke execute on function public.diary_correct_entry(uuid, jsonb, uuid) from public, anon;
grant execute on function public.diary_correct_entry(uuid, jsonb, uuid) to authenticated, service_role;
