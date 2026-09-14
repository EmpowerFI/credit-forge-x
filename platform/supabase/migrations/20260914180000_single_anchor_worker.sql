-- One anchor-submit run at a time.
--
-- The cron fires every 10 seconds and a run lasts up to 40, so runs piled up
-- — and each hit the public devnet RPC in parallel. Seeding 108 anchors that
-- way drew 164 "429 Too Many Requests" responses: everything confirmed, but
-- through two or three attempts each. A single worker at a time sends the same
-- work through one client, well inside the rate limit.
--
-- A lease rather than a lock: a run that dies without releasing it frees the
-- worker when the lease expires.

create table private.anchor_worker (
  singleton boolean primary key default true check (singleton),
  busy_until timestamptz not null default '-infinity'
);
insert into private.anchor_worker default values;

-- True if the caller now holds the worker; false if another run does.
create function public.start_anchor_run(p_lease_seconds integer default 90)
returns boolean
language sql security definer set search_path = ''
as $$
  update private.anchor_worker
  set busy_until = now() + make_interval(secs => p_lease_seconds)
  where singleton and busy_until < now()
  returning true
$$;

create function public.finish_anchor_run()
returns void
language sql security definer set search_path = ''
as $$
  update private.anchor_worker set busy_until = '-infinity' where singleton
$$;

revoke all on function public.start_anchor_run(integer), public.finish_anchor_run()
  from public, anon, authenticated;
grant execute on function public.start_anchor_run(integer), public.finish_anchor_run()
  to service_role;

-- The dispatcher also stays quiet while a run is in progress, rather than
-- sending a request that would only be turned away.
create or replace function private.dispatch_anchor_jobs()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if exists (select 1 from private.anchor_worker where busy_until >= now()) then
    return;
  end if;
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

-- Hands back jobs a run claimed but never got to (it stopped on a rate limit),
-- so they wait seconds rather than the whole claim lease, and the unused
-- claim does not count as an attempt.
create function public.release_anchor_jobs(p_ids bigint[], p_delay_seconds integer default 15)
returns void
language sql security definer set search_path = ''
as $$
  update public.chain_anchors
  set next_attempt_at = now() + make_interval(secs => p_delay_seconds),
      attempts = greatest(attempts - 1, 0)
  where id = any (p_ids) and status in ('pending', 'submitted')
$$;

revoke all on function public.release_anchor_jobs(bigint[], integer) from public, anon, authenticated;
grant execute on function public.release_anchor_jobs(bigint[], integer) to service_role;
