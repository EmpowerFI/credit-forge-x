-- M8 · anchoring pipeline
--
--   fact written (RPC) → chain_anchors row, pending
--     → pg_cron every 10s → private.dispatch_anchor_jobs()
--         → only if a job is due → pg_net POST anchor-submit Edge Function
--     → anchor-submit: claim_anchor_jobs → commit → send → confirm
--         → complete_anchor_job | fail_anchor_job (backoff, then 'failed')
--
-- The Edge Function URL and the shared secret come from Vault, never from this
-- file: the website's email cron hardcoded its project URL and silently posted
-- to the wrong project after a move. Set them once per environment (see
-- platform/README.md):
--   select vault.create_secret('<functions url>/anchor-submit', 'anchor_submit_url');
--   select vault.create_secret('<random secret>', 'anchor_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Jobs that can run now: due, and whose dependency (if any) has confirmed.
create function private.due_anchor_jobs()
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select a.id
  from public.chain_anchors a
  left join public.chain_anchors d on d.id = a.depends_on
  where a.status in ('pending', 'submitted')
    and a.next_attempt_at <= now()
    and (a.depends_on is null or d.status = 'confirmed')
  order by a.id
$$;

-- Claims up to p_limit due jobs for one worker. SKIP LOCKED plus a two-minute
-- lease on next_attempt_at: a second worker never takes the same job, and a
-- worker that dies mid-job releases it when the lease runs out.
--
-- Returns what the worker needs to build the transaction: the payload as the
-- database builds it now, the community's chain ref and, for an enrollment,
-- the borrower ref it hashes into the account seed.
create function public.claim_anchor_jobs(p_limit integer default 5)
returns table (
  id bigint,
  kind public.anchor_kind,
  entity_id uuid,
  attempts integer,
  payload jsonb,
  community_ref text,
  borrower_ref text
)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.chain_anchors a
    set attempts = a.attempts + 1,
        next_attempt_at = now() + interval '2 minutes'
    where a.id in (
      select j.id from public.chain_anchors j
      where j.id in (select private.due_anchor_jobs())
      order by j.id
      limit p_limit
      for update skip locked
    )
    returning a.id, a.kind, a.entity_id, a.attempts
  )
  select
    c.id,
    c.kind,
    c.entity_id,
    c.attempts,
    private.anchor_payload(c.kind, c.entity_id),
    case
      when c.kind in ('community', 'community_verification') then
        (select encode(co.chain_ref, 'hex') from public.communities co where co.id = c.entity_id)
      else
        (select encode(co.chain_ref, 'hex')
         from public.community_memberships m
         join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = c.entity_id
         order by m.joined_at, m.community_id
         limit 1)
    end,
    case
      when c.kind = 'enrollment' then
        (select encode(e.borrower_ref, 'hex') from public.entrepreneurs e where e.id = c.entity_id)
    end
  from claimed c
  order by c.id;
end;
$$;

create function public.complete_anchor_job(
  p_id bigint,
  p_commitment text,
  p_payload jsonb,
  p_account_address text,
  p_signature text,
  p_slot bigint
)
returns void
language sql security definer set search_path = ''
as $$
  update public.chain_anchors
  set status = 'confirmed',
      commitment = decode(p_commitment, 'hex'),
      payload = p_payload,
      account_address = p_account_address,
      signature = p_signature,
      slot = p_slot,
      submitted_at = coalesce(submitted_at, now()),
      confirmed_at = now(),
      last_error = null
  where id = p_id
$$;

-- Retries with exponential backoff (15s, 30s, 1m … capped at 30m); gives up
-- after eight attempts, or at once when the error cannot be fixed by retrying
-- (for instance the chain already holds a different commitment).
create function public.fail_anchor_job(p_id bigint, p_error text, p_retryable boolean default true)
returns void
language sql security definer set search_path = ''
as $$
  update public.chain_anchors
  set last_error = left(p_error, 2000),
      status = case when not p_retryable or attempts >= 8 then 'failed' else 'pending' end::public.anchor_status,
      next_attempt_at = now() + least(
        interval '30 minutes',
        interval '15 seconds' * power(2, greatest(attempts - 1, 0))
      )
  where id = p_id
$$;

revoke all on function
  public.claim_anchor_jobs(integer),
  public.complete_anchor_job(bigint, text, jsonb, text, text, bigint),
  public.fail_anchor_job(bigint, text, boolean)
from public, anon, authenticated;

grant execute on function
  public.claim_anchor_jobs(integer),
  public.complete_anchor_job(bigint, text, jsonb, text, text, bigint),
  public.fail_anchor_job(bigint, text, boolean)
to service_role;

revoke all on function private.due_anchor_jobs() from public;

-- --------------------------------------------------------------- dispatcher

create function private.dispatch_anchor_jobs()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select private.due_anchor_jobs()) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_anchor_jobs: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_anchor_jobs() from public;

-- Idempotent: drop any previous schedule before creating it.
do $$
begin
  perform cron.unschedule('dispatch-anchor-jobs');
exception when others then
  null;
end $$;

select cron.schedule('dispatch-anchor-jobs', '10 seconds', 'select private.dispatch_anchor_jobs()');
