-- Repoint the email dispatcher cron at the current Supabase project.
--
-- 20260617000000_self_host_email_cron.sql hardcodes the project URL inside the
-- cron body, and the project moved (tfjxvliinkhlimxfrkpr -> xifczvaiedmokdpjevsf).
-- Left unfixed, the cron POSTs to the OLD project's Edge Function using THIS
-- project's service_role key, which it rejects — so every queued email would sit
-- at 'pending' forever with no obvious cause.
--
-- This is a new migration rather than an edit of the original because that one
-- is already applied on the old project; rewriting applied history would leave
-- the two environments disagreeing about what ran.
--
-- ⚠️ ON A FUTURE PROJECT MOVE: update the url below and add another migration.
-- See DEPLOY-BACKEND.md.

create extension if not exists pg_net;

-- Idempotent: drop any prior job before re-creating it.
do $$
begin
  perform cron.unschedule('process-email-queue');
exception when others then
  null;
end $$;

select cron.schedule(
  'process-email-queue',
  '5 seconds',
  $cron$
  select net.http_post(
    url := 'https://xifczvaiedmokdpjevsf.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  )
  where not exists (
    select 1 from public.email_send_state
    where retry_after_until is not null
      and retry_after_until > now()
  )
  and (
    (select queue_length from pgmq.metrics('transactional_emails')) > 0
    or (select queue_length from pgmq.metrics('auth_emails')) > 0
  );
  $cron$
);
