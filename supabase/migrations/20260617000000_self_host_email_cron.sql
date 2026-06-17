-- ============================================================
-- Self-hosted email dispatcher cron.
--
-- Replaces the dynamic "POST-MIGRATION STEPS" that Lovable applied via its
-- Management API (see 20260428212516_email_infra.sql). On a self-hosted
-- Supabase project we schedule the dispatcher ourselves with pg_cron + pg_net.
--
-- The job runs every 5s but only POSTs to the process-email-queue Edge Function
-- when a queue actually has messages and we're not in a rate-limit cooldown,
-- so it's cheap when idle.
--
-- PREREQUISITE (run once, NOT in version control — contains a secret):
--   select vault.create_secret(
--     '<YOUR_SERVICE_ROLE_KEY>', 'email_queue_service_role_key');
--   -- if it already exists, rotate with:
--   -- select vault.update_secret(
--   --   (select id from vault.secrets where name = 'email_queue_service_role_key'),
--   --   '<YOUR_SERVICE_ROLE_KEY>');
-- ============================================================

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
    url := 'https://tfjxvliinkhlimxfrkpr.supabase.co/functions/v1/process-email-queue',
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
