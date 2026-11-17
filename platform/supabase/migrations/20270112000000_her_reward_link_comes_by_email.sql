-- Her reward's link comes by e-mail.
--
-- Founder's request, 17/11/2026: the links to a campaign's lives can be sent
-- to the e-mail she signed up with. So:
--
--   * when she earns a milestone whose words have a link (redeem_url), one
--     e-mail is queued for her, automatically and once: its title, how to
--     redeem it and its link, in the latest words for its code
--     (private.reward_words, 20270111);
--   * EmpowerFI can e-mail the link again to everyone who earned a milestone
--     in a campaign -- after correcting a live's day or link, say -- from the
--     dashboard (reward_email_resend). Each resend is a new e-mail;
--   * every five minutes pg_cron calls the reward-email function, which claims
--     what is due (at most 50 a run), sends it through Resend and records what
--     came back. A failure is retried, at most three attempts in all.
--
-- Her address is read at the moment of sending (private.email_of), never
-- copied here; the words likewise, so a correction made before the send is
-- the one she reads. Nothing is sent for a simulated entrepreneur or
-- campaign, nor without an address. If she erases her diary, her grants go
-- and their e-mails with them (on delete cascade).

create table private.reward_emails (
  id           uuid primary key default gen_random_uuid(),
  grant_id     uuid not null references public.reward_grants (id) on delete cascade,
  reason       text not null check (reason in ('earned', 'resent')),
  status       text not null default 'queued' check (status in ('queued', 'claimed', 'sent', 'failed', 'skipped')),
  attempts     integer not null default 0 check (attempts between 0 and 3),
  provider_id  text check (provider_id is null or char_length(provider_id) <= 200),
  error        text check (error is null or char_length(error) <= 500),
  requested_by uuid,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  finished_at  timestamptz
);
-- Earning it is e-mailed once; resends are as many as EmpowerFI asks for.
create unique index reward_emails_earned_once on private.reward_emails (grant_id) where reason = 'earned';
create index reward_emails_due on private.reward_emails (status, created_at) where status in ('queued', 'claimed', 'failed');

/** Whether a grant is one to e-mail: a real woman, a real campaign, words with a link. */
create function private.reward_email_wanted(p_grant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.reward_grants r
      join public.entrepreneurs e on e.id = r.entrepreneur_id
      join public.programs g on g.id = r.program_id
      cross join lateral private.reward_words(r.program_id, r.programme_id, r.code) w
     where r.id = p_grant_id
       and r.status = 'granted'
       and not r.is_simulated and not e.is_simulated and not g.is_simulated
       and w.redeem_url is not null)
$$;

create function private.reward_email_on_grant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if private.reward_email_wanted(new.id) then
    insert into private.reward_emails (grant_id, reason) values (new.id, 'earned')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger her_reward_link_comes_by_email
  after insert or update of status on public.reward_grants
  for each row execute function private.reward_email_on_grant();

-- ------------------------------------------------------------------ for the function

/**
 * Claims up to p_limit e-mails due -- queued, failed with attempts left (not
 * sooner than ten minutes after), or claimed and stuck for fifteen -- and
 * returns what to send. One that can no longer be sent (no address, or no
 * link in the words any more) is marked skipped and not returned.
 * Service role only.
 */
create function public.reward_emails_claim(p_limit integer default 50)
returns table (id uuid, email text, name text, title text, how_to_redeem text, redeem_url text,
               campaign_name text, sponsor_name text, is_house boolean, threshold_days integer)
language plpgsql security definer set search_path = ''
as $$
begin
  update private.reward_emails q
     set status = 'skipped', finished_at = now(), error = 'not_sendable'
   where q.status in ('queued', 'failed')
     and q.attempts < 3
     and (private.email_of((select r.entrepreneur_id from public.reward_grants r where r.id = q.grant_id)) is null
          or not private.reward_email_wanted(q.grant_id));

  return query
  with due as (
    select q.id
      from private.reward_emails q
     where q.attempts < 3
       and (q.status = 'queued'
            or (q.status = 'failed' and q.finished_at < now() - interval '10 minutes')
            or (q.status = 'claimed' and q.claimed_at < now() - interval '15 minutes'))
     order by q.created_at
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
       for update skip locked
  ), claimed as (
    update private.reward_emails q
       set status = 'claimed', claimed_at = now(), attempts = q.attempts + 1
      from due where q.id = due.id
    returning q.id, q.grant_id
  )
  select c.id, private.email_of(r.entrepreneur_id), e.display_name, w.title, w.how_to_redeem, w.redeem_url,
         g.name, s.name, g.is_default, m.threshold_days
    from claimed c
    join public.reward_grants r on r.id = c.grant_id
    join public.entrepreneurs e on e.id = r.entrepreneur_id
    join public.programs g on g.id = r.program_id
    join public.sponsors s on s.id = g.sponsor_id
    join public.reward_milestones m on m.programme_id = r.programme_id and m.code = r.code
    cross join lateral private.reward_words(r.program_id, r.programme_id, r.code) w;
end $$;

/** What Resend answered: its id when sent, the error otherwise. Service role only. */
create function public.reward_email_finished(p_id uuid, p_provider_id text, p_error text default null)
returns void
language sql security definer set search_path = ''
as $$
  update private.reward_emails
     set status = case when p_provider_id is not null then 'sent' else 'failed' end,
         provider_id = left(p_provider_id, 200),
         error = case when p_provider_id is null then left(coalesce(p_error, 'unknown'), 500) end,
         finished_at = now()
   where id = p_id and status = 'claimed';
$$;

-- ------------------------------------------------------------------ for empowerfi-dashboard

/**
 * E-mails a milestone's link again to everyone who earned it in a campaign,
 * in its latest words. Returns how many e-mails were queued; whoever already
 * has one waiting is not queued twice. Campaign managers only.
 */
create function public.reward_email_resend(p_program_id uuid, p_code text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  perform private.require_campaign_manager();
  if not exists (
    select 1 from public.reward_milestones m
      join public.reward_programme_versions v on v.id = m.programme_id
     where v.program_id = p_program_id and m.code = p_code
       and v.version = (select max(v2.version) from public.reward_programme_versions v2 where v2.program_id = p_program_id)
       and m.redeem_url is not null) then
    raise exception 'reward_has_no_link' using errcode = '22023';
  end if;
  insert into private.reward_emails (grant_id, reason, requested_by)
  select r.id, 'resent', auth.uid()
    from public.reward_grants r
   where r.program_id = p_program_id and r.code = p_code
     and private.reward_email_wanted(r.id)
     and private.email_of(r.entrepreneur_id) is not null
     and not exists (select 1 from private.reward_emails q
                      where q.grant_id = r.id and q.status in ('queued', 'claimed'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** For the dashboard: per milestone of a campaign, how many e-mails were sent, are waiting, failed. */
create function public.reward_email_counts(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_object_agg(code, counts)
      from (select r.code, jsonb_build_object(
                     'sent', count(*) filter (where q.status = 'sent'),
                     'waiting', count(*) filter (where q.status in ('queued', 'claimed')
                                                   or (q.status = 'failed' and q.attempts < 3)),
                     'failed', count(*) filter (where q.status = 'failed' and q.attempts >= 3)) as counts
              from private.reward_emails q join public.reward_grants r on r.id = q.grant_id
             where r.program_id = p_program_id
             group by r.code) t), '{}'::jsonb);
end $$;

-- ------------------------------------------------------------------ the cron

create function private.dispatch_reward_email()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from private.reward_emails
                  where attempts < 3 and status in ('queued', 'claimed', 'failed')) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reward_email_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'reward_email_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_reward_email: vault secrets reward_email_url / reward_email_secret are not set';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reward-email-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

select cron.schedule('reward-email', '*/5 * * * *', $$select private.dispatch_reward_email()$$);

alter table private.reward_emails enable row level security;
revoke all on private.reward_emails from public, anon, authenticated;
revoke execute on function private.reward_email_wanted(uuid) from public, anon, authenticated;
revoke execute on function private.reward_email_on_grant() from public, anon, authenticated;
revoke execute on function private.dispatch_reward_email() from public, anon, authenticated;
revoke execute on function public.reward_emails_claim(integer), public.reward_email_finished(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.reward_emails_claim(integer), public.reward_email_finished(uuid, text, text) to service_role;
revoke execute on function public.reward_email_resend(uuid, text), public.reward_email_counts(uuid) from public, anon;
grant execute on function public.reward_email_resend(uuid, text), public.reward_email_counts(uuid) to authenticated, service_role;
