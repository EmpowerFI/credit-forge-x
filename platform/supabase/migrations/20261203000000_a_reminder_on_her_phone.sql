-- A reminder on her phone.
--
-- Step 4 of the diary in the browser: standard Web Push. The diary-push
-- function claims who is due (diary_push_claim, from 20261130000000), sends
-- each of her devices a notification through its browser's push service,
-- and records what every push service answered (diary_push_finished).
--
-- Two things here:
--
--   * pg_cron calls diary-push every fifteen minutes -- reminder times are on
--     the quarter hour -- with a shared secret from the Vault, the same way
--     journal-reminder was called. Without the Vault secrets it warns and
--     does nothing.
--
--   * A subscription's endpoint is a URL the browser hands over, and the
--     server will POST to it. Taken as it comes, anyone signed in could make
--     the server call any https address on a schedule. So the endpoint must
--     belong to a known push service: Google's (Chrome, Android, Samsung
--     Internet, Edge on Android), Apple's (Safari on iPhone, iPad and Mac),
--     Mozilla's (Firefox) or Microsoft's (Edge on Windows). A browser that
--     uses another service is refused with not_a_push_service, and the list
--     grows when one turns up.

create function private.is_push_service(p_endpoint text)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(substring(p_endpoint from '^https://([^/:?#]+)(?:[/?#]|$)'), '') ~
    '^(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$'
$$;

create or replace function public.diary_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  if not private.is_push_service(p_endpoint) then
    raise exception 'not_a_push_service' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subscriptions
       where entrepreneur_id = v_me and disabled_at is null and endpoint <> p_endpoint) >= 10 then
    raise exception 'too_many_devices' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (entrepreneur_id, endpoint, p256dh, auth, user_agent)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set entrepreneur_id = v_me, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, failures = 0, disabled_at = null, disabled_reason = null;
  return jsonb_build_object('devices', (select count(*) from public.push_subscriptions
                                         where entrepreneur_id = v_me and disabled_at is null));
end $$;

create function private.dispatch_diary_push()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'diary_push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'diary_push_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_diary_push: vault secrets diary_push_url / diary_push_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-diary-push-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

select cron.schedule('diary-push', '*/15 * * * *', $$select private.dispatch_diary_push()$$);

revoke execute on function private.is_push_service(text) from public, anon, authenticated;
revoke execute on function private.dispatch_diary_push() from public, anon, authenticated;
