-- The fortnight check-in is retired. The daily journal replaced it.
--
-- 20261106 built a form that asked her to remember fifteen days at once, and
-- assembled a month from two of its halves. The credit adviser's point was
-- that nobody remembers fifteen days, and the journal (20261112 onwards) asks
-- about one day, on the day. 20261112 left the fortnight tables in place
-- "until that form replaces theirs; nothing real was ever written to them".
-- The journal's form is the one the webhook reads now, so they go.
--
-- Gone: the halves, the single-use flow tokens that said which woman, month
-- and half a reply was about, and the two functions that wrote them.
--
-- Kept, because the journal uses them: whatsapp_inbound_events (every
-- delivery, once), public.checkins (the journal closes its months into it),
-- and the month reading in ai_analyses, which reads a checkins row however
-- it was assembled.
--
-- The guard: if either table holds a single row, this stops before dropping
-- anything. A row there would be a real answer from a real woman, and that is
-- a conversation to have before deleting it, not after.

do $$
begin
  if exists (select 1 from public.whatsapp_checkin_halves)
     or exists (select 1 from public.whatsapp_flow_tokens) then
    raise exception 'the fortnight tables are not empty: % halves, % tokens -- not dropped',
      (select count(*) from public.whatsapp_checkin_halves),
      (select count(*) from public.whatsapp_flow_tokens);
  end if;
end $$;

drop function public.whatsapp_record_half(text, text, bigint, bigint, bigint, bigint, boolean, smallint);
drop function private.whatsapp_issue_flow_token(uuid, text, smallint, interval);
drop table public.whatsapp_checkin_halves;
drop table public.whatsapp_flow_tokens;
