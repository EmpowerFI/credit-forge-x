# Backend deploy — self-hosted email stack (Path B)

Target Supabase project: **EmpowerFI** — `tfjxvliinkhlimxfrkpr`
(`https://tfjxvliinkhlimxfrkpr.supabase.co`)

This moves the contact-form email pipeline off Lovable's managed API onto your
own Supabase project, sending through **Resend**. Run every command yourself so
your DB password and keys never leave your machine. The CLI is invoked as
`npx supabase` (no global install needed).

## What you'll need (from dashboards)

| Value | Where |
| ----- | ----- |
| **DB password** | Supabase → Project Settings → Database |
| **service_role key** | Supabase → Project Settings → API → `service_role` (secret) |
| **anon / publishable key** | Supabase → Project Settings → API → `anon` (public) |
| **Resend API key** | resend.com → API Keys (`re_…`) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge
Functions by Supabase — you do **not** set those. Only `RESEND_API_KEY` is set
manually.

---

## 1. Verify your sending domain in Resend

In Resend → Domains, add **`empowerfi.io`** and create the DNS records it gives
you (SPF `TXT`, DKIM, and a DMARC record). Emails send from
`noreply@empowerfi.io` (set in `send-transactional-email`). Until the domain
shows **Verified**, sends will fail with 403/422.

> Prefer a subdomain? Verify e.g. `mail.empowerfi.io` instead and change
> `FROM_DOMAIN` in `supabase/functions/send-transactional-email/index.ts`.

## 2. Link the CLI to the project

```bash
npx supabase link --project-ref tfjxvliinkhlimxfrkpr
# prompts for your DB password
```

## 3. Push the database migrations

Creates the pgmq queues, tables, RPCs, and the dispatcher cron (pg_cron + pg_net).

```bash
npx supabase db push
```

## 4. Store the service_role key in Vault (enables the cron)

The cron authenticates to the dispatcher with a Vault-stored key. Run this once
in **Supabase → SQL Editor** (keeps the key off your shell history):

```sql
select vault.create_secret(
  '<YOUR_SERVICE_ROLE_KEY>',
  'email_queue_service_role_key'
);
```

Rotating later:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'email_queue_service_role_key'),
  '<NEW_SERVICE_ROLE_KEY>'
);
```

## 5. Set the Resend API key as a function secret

```bash
npx supabase secrets set RESEND_API_KEY=re_your_key_here
```

## 6. Deploy the Edge Functions

Deploy the **three** functions the contact form needs:

```bash
npx supabase functions deploy send-transactional-email
npx supabase functions deploy process-email-queue
npx supabase functions deploy handle-email-unsubscribe
```

`verify_jwt` per function comes from `supabase/config.toml` (send / process =
true; unsubscribe = false).

> **Skip `handle-email-suppression` and `preview-transactional-email`** — both
> are Lovable-specific (a bounce/complaint webhook and a preview tool) and
> depend on `LOVABLE_API_KEY`, so they won't function in this self-hosted setup.
> Deploy them later only if you wire up Resend bounce webhooks. The contact form
> works without them; the suppression list simply won't auto-populate.

## 7. Point the frontend at this project

**Local** `.env` (gitignored — copy from `.env.example`):

```
VITE_SUPABASE_URL="https://tfjxvliinkhlimxfrkpr.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon key for tfjxvliinkhlimxfrkpr>"
VITE_SUPABASE_PROJECT_ID="tfjxvliinkhlimxfrkpr"
```

**Vercel** → Project → Settings → Environment Variables: set the same three for
Production + Preview, then redeploy.

## 8. Test end-to-end

1. Submit the investor contact form (locally or on the deployed site).
2. In **SQL Editor**, watch the pipeline:
   ```sql
   select status, template_name, recipient_email, created_at
   from public.email_send_log order by created_at desc limit 10;
   ```
   You should see `pending` → `sent` within a few seconds (the cron runs every 5s).
3. Confirm delivery in the Resend dashboard (Emails) and your inbox
   (`daniele@empowerfi.io` receives the founder notification).

### If it stays `pending`
- Cron not firing / not authed → confirm step 4 ran and `RESEND_API_KEY` is set.
- Manually kick the dispatcher (replace the key):
  ```bash
  curl -X POST https://tfjxvliinkhlimxfrkpr.supabase.co/functions/v1/process-email-queue \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
  ```
- Inspect cron runs:
  ```sql
  select * from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'process-email-queue')
  order by start_time desc limit 10;
  ```
- `failed`/`dlq` rows in `email_send_log` carry the provider error in
  `error_message` (usually domain-not-verified or a bad key).

---

## Notes

- `SENDER_DOMAIN` / `sender_domain` in the payload are legacy Lovable fields and
  are now unused by the Resend dispatcher — left in place to avoid touching the
  queue payload shape.
- The dispatcher keeps all the original retry / rate-limit (429) / DLQ behavior;
  only the transport (Lovable API → Resend) changed.
