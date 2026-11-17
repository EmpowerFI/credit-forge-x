-- A campaign has seats, and a reward for whoever completes it.
--
-- Founder's request, 17/11/2026, creating the 30-day challenge in
-- empowerfi-dashboard: a campaign made there said nothing of how many women
-- can take part or what each one receives. Seats and a price per woman
-- existed only for campaigns paid into a vault on Solana.
--
--   * SEATS. A campaign may cap how many women take part (programs.seats).
--     Every way in -- named by EmpowerFI or joining an open campaign with a
--     tap -- stops once the seats are taken: a participation is a seat, even
--     if she later leaves. Null: no cap.
--   * A REWARD PER WOMAN. programs.reward_cents is what each woman who
--     completes receives, in reais. Today EmpowerFI pays it by hand (into her
--     conta.vc account); the diary shows the amount and how far along she is.
--   * WHO COMPLETES. The rule of 20261230, for a campaign made in the
--     dashboard: she has recorded every day her business opens
--     (entrepreneurs.open_days) between the day her participation started and
--     the campaign's last day, and she did not leave it.
--   * PAID. The dashboard lists who completed and what is owed, and EmpowerFI
--     marks each woman paid once the money is sent (program_reward_payments).

alter table public.programs
  add column seats integer check (seats is null or seats between 1 and 100000),
  add column reward_cents bigint check (reward_cents is null or reward_cents between 1 and 100000000);

-- ------------------------------------------------------------------ seats

/** Sets a campaign's seats and reward per woman (null clears either). */
create function public.campaign_terms_set(p_id uuid, p_seats integer, p_reward_cents bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_taken integer;
begin
  perform private.require_campaign_manager();
  if exists (select 1 from public.programs where id = p_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.programs where id = p_id and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if p_seats is not null and p_seats not between 1 and 100000 then
    raise exception 'seats_invalid' using errcode = '22023';
  end if;
  if p_reward_cents is not null and p_reward_cents not between 1 and 100000000 then
    raise exception 'reward_invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('program_seats:' || p_id::text));
  select count(*) into v_taken from public.program_participants where program_id = p_id;
  if p_seats is not null and p_seats < v_taken then
    raise exception 'seats_below_participants' using errcode = '22023', detail = v_taken::text;
  end if;
  update public.programs set seats = p_seats, reward_cents = p_reward_cents, updated_at = now() where id = p_id;
end $$;

/** No participation beyond the seats, whichever way she comes in. */
create function private.a_campaign_keeps_to_its_seats()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_seats integer;
begin
  select seats into v_seats from public.programs where id = new.program_id;
  if v_seats is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('program_seats:' || new.program_id::text));
  if (select count(*) from public.program_participants where program_id = new.program_id) >= v_seats then
    raise exception 'campaign_full' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function private.a_campaign_keeps_to_its_seats() from public, anon, authenticated;
create trigger a_campaign_keeps_to_its_seats before insert on public.program_participants
  for each row execute function private.a_campaign_keeps_to_its_seats();

-- ------------------------------------------------------------------ who completes

/**
 * Everyone in a campaign made in the dashboard, as of p_day: her window (the
 * day she started to the campaign's last), the days she opens in it, how many
 * of them she has recorded, and whether she has completed it (every day she
 * opens recorded, the window over, and she did not leave).
 */
create function private.campaign_progress(p_program_id uuid, p_day date)
returns table (participant_id uuid, email text, entrepreneur_id uuid, starts_on date, ends_on date,
               left_early boolean, open_days integer, kept integer, ended boolean, done boolean)
language sql stable security definer set search_path = ''
as $$
  with people as (
    select p.id, p.email, p.starts_on, p.ends_on is not null as left_early,
           coalesce(private.participation_end(p.ends_on, p.program_id), p_day) as last_day,
           e.id as eid, e.open_days as week
      from public.program_participants p
      left join auth.users u on lower(btrim(u.email)) = p.email
      left join public.entrepreneurs e on e.profile_id = u.id
     where p.program_id = p_program_id
  ),
  owed as (
    select x.id, s.day::date as day,
           exists (select 1 from public.journal_days d where d.entrepreneur_id = x.eid and d.day = s.day::date) as recorded
      from people x
      cross join lateral generate_series(x.starts_on, x.last_day, interval '1 day') s(day)
     where x.eid is not null and private.opens_on(x.week, s.day::date)
  )
  select x.id, x.email, x.eid, x.starts_on, x.last_day, x.left_early,
         (select count(*)::integer from owed o where o.id = x.id),
         (select count(*)::integer from owed o where o.id = x.id and o.recorded and o.day <= p_day),
         x.last_day < p_day,
         x.eid is not null and not x.left_early and x.last_day < p_day
           and exists (select 1 from owed o where o.id = x.id)
           and not exists (select 1 from owed o where o.id = x.id and not o.recorded)
    from people x
$$;
revoke execute on function private.campaign_progress(uuid, date) from public, anon, authenticated;

-- ------------------------------------------------------------------ paid

create table public.program_reward_payments (
  participant_id uuid primary key references public.program_participants (id) on delete restrict,
  program_id     uuid not null references public.programs (id) on delete restrict,
  amount_cents   bigint not null check (amount_cents > 0),
  note           text check (note is null or char_length(note) <= 300),
  paid_at        timestamptz not null default now(),
  paid_by        uuid
);
alter table public.program_reward_payments enable row level security;
revoke all on public.program_reward_payments from anon, authenticated;

/** For the dashboard: who completed, what each is owed, and who was paid. */
create function public.campaign_rewards_due(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
  v_today date := private.sp_today();
begin
  perform private.require_campaign_manager();
  select * into v_g from public.programs where id = p_program_id and not is_simulated;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return (
    with prog as (select * from private.campaign_progress(p_program_id, v_today))
    select jsonb_build_object(
      'seats', v_g.seats,
      'taken', (select count(*) from public.program_participants where program_id = p_program_id),
      'reward_cents', v_g.reward_cents,
      'completed', (select count(*) from prog where done),
      'paid', (select count(*) from public.program_reward_payments where program_id = p_program_id),
      'paid_cents', (select coalesce(sum(amount_cents), 0) from public.program_reward_payments where program_id = p_program_id),
      'to_pay_cents', coalesce(v_g.reward_cents, 0) * (select count(*) from prog
                                                         where done and not exists (select 1 from public.program_reward_payments r
                                                                                     where r.participant_id = prog.participant_id)),
      'people', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'participant_id', x.participant_id, 'email', x.email,
                 'name', e.display_name, 'city', e.city, 'state', e.state,
                 'enrolled', x.entrepreneur_id is not null,
                 'starts_on', x.starts_on, 'ends_on', x.ends_on, 'left_early', x.left_early,
                 'open_days', x.open_days, 'kept', x.kept, 'ended', x.ended, 'completed', x.done,
                 'paid_at', r.paid_at, 'paid_cents', r.amount_cents, 'paid_note', r.note
               ) order by x.done desc, r.paid_at nulls first, x.kept desc, x.email)
          from prog x
          left join public.entrepreneurs e on e.id = x.entrepreneur_id
          left join public.program_reward_payments r on r.participant_id = x.participant_id), '[]'::jsonb)
    ));
end $$;

/** Marks a woman who completed as paid (p_paid) or takes the mark back. */
create function public.campaign_reward_mark_paid(p_participant_id uuid, p_paid boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_p public.program_participants%rowtype;
  v_reward bigint;
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_campaign_manager();
  select * into v_p from public.program_participants where id = p_participant_id;
  if not found then
    raise exception 'no_such_participant' using errcode = 'P0002';
  end if;
  if not p_paid then
    delete from public.program_reward_payments where participant_id = p_participant_id;
    return;
  end if;
  select reward_cents into v_reward from public.programs where id = v_p.program_id;
  if v_reward is null then
    raise exception 'campaign_has_no_reward' using errcode = '22023';
  end if;
  if not exists (select 1 from private.campaign_progress(v_p.program_id, private.sp_today()) c
                  where c.participant_id = p_participant_id and c.done) then
    raise exception 'not_completed' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  insert into public.program_reward_payments (participant_id, program_id, amount_cents, note, paid_by)
  values (p_participant_id, v_p.program_id, v_reward, v_note, auth.uid())
  on conflict (participant_id) do update set note = excluded.note;
end $$;

-- ------------------------------------------------------------------ the diary

/** Her campaign's reward today, and how far along she is; null when it offers none. */
create function public.diary_campaign_reward()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_today date := private.sp_today();
  v_program uuid := private.program_on(v_me, v_today);
  v_g public.programs%rowtype;
begin
  select * into v_g from public.programs where id = v_program and not is_default and not is_simulated;
  if not found or v_g.reward_cents is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
             'campaign', v_g.name, 'reward_cents', v_g.reward_cents, 'until', c.ends_on,
             'open_days', c.open_days, 'kept', c.kept, 'completed', c.done,
             'paid_at', (select r.paid_at from public.program_reward_payments r where r.participant_id = c.participant_id))
      from private.campaign_progress(v_program, v_today) c
     where c.entrepreneur_id = v_me
     limit 1);
end $$;

/** As 20261208's, with the reward per woman, and without a campaign whose seats are taken. */
create or replace function public.diary_campaigns()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_email text := private.my_email();
  v_today date := private.sp_today();
begin
  if private.program_on(v_me, v_today) <> private.house_program() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'name', g.name, 'description', g.description, 'sponsor_name', s.name,
             'period_end', g.period_end, 'logo_path', g.logo_path, 'link_url', g.link_url,
             'offers_rewards', g.offers_rewards, 'reward_cents', g.reward_cents,
             'blocked_by', private.overlapping_campaign(v_email, v_today, g.period_end, null)
           ) order by g.period_end, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where g.enrolment = 'open' and not g.is_default and not g.is_simulated
       and v_today between g.period_start and g.period_end
       and not exists (select 1 from public.program_participants p where p.program_id = g.id and p.email = v_email)
       and (g.seats is null or (select count(*) from public.program_participants p where p.program_id = g.id) < g.seats)
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ the dashboard's list

/** As 20261229's, with the co-sponsors: each with its own logo and link. */
create or replace function public.diary_sponsors()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  return coalesce((
    with mine as (
      select g.id, g.name, g.period_start from public.programs g where g.id in (select private.diary_my_programs(v_me))
    ),
    backing as (
      -- The lead wears the campaign's logo and link; a co-sponsor its own.
      select g.sponsor_id, m.name as campaign, g.logo_path, g.link_url, m.period_start
        from mine m join public.programs g on g.id = m.id
      union all
      select c.sponsor_id, m.name, c.logo_path, c.link_url, m.period_start
        from mine m join public.program_cosponsors c on c.program_id = m.id
    )
    select jsonb_agg(jsonb_build_object(
             'name', s.name,
             'logo_path', (select b.logo_path from backing b where b.sponsor_id = s.id and b.logo_path is not null
                            order by b.period_start desc limit 1),
             'link_url', (select b.link_url from backing b where b.sponsor_id = s.id and b.link_url is not null
                           order by b.period_start desc limit 1),
             'campaigns', (select jsonb_agg(distinct b.campaign) from backing b where b.sponsor_id = s.id)
           ) order by s.name)
      from public.sponsors s
     where s.id in (select sponsor_id from backing) and not s.is_house
  ), '[]'::jsonb);
end $$;

/**
 * As 20270103's: every visible partner tied to no campaign, and those tied to
 * a campaign she is in, with the campaigns' names.
 */
create or replace function public.diary_partners()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  return coalesce((
    with mine as (select private.diary_my_programs(v_me) as id)
    select jsonb_agg(jsonb_build_object(
             'name', p.name, 'description', p.description,
             'logo_path', p.logo_path, 'link_url', p.link_url,
             'campaigns', coalesce((select jsonb_agg(g.name order by g.name)
                                      from public.program_partners pp join public.programs g on g.id = pp.program_id
                                     where pp.partner_id = p.id and pp.program_id in (select id from mine)), '[]'::jsonb)
           ) order by p.position, p.name)
      from public.strategic_partners p
     where p.is_visible
       and (not exists (select 1 from public.program_partners pp where pp.partner_id = p.id)
            or exists (select 1 from public.program_partners pp where pp.partner_id = p.id and pp.program_id in (select id from mine)))
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------------ the dashboard's list

/** As 20270106's, with the seats and the reward per woman. */
create or replace function public.campaign_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'name', g.name,
             'description', g.description,
             'sponsor_id', s.id,
             'sponsor_name', s.name,
             'is_default', g.is_default,
             'enrolment', g.enrolment,
             'offers_rewards', g.offers_rewards,
             'reward_version', (select max(v.version) from public.reward_programme_versions v where v.program_id = g.id),
             'logo_path', g.logo_path,
             'is_real', g.is_real,
             'on_chain', exists (select 1 from public.campaign_vaults v where v.program_id = g.id),
             'link_url', g.link_url,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'authorised', (select count(*) from public.program_participants p where p.program_id = g.id),
             'joined_herself', (select count(*) from public.program_participants p
                                 where p.program_id = g.id and p.joined_herself),
             'enrolled', (select count(*) from public.program_participants p
                           join auth.users u on lower(btrim(u.email)) = p.email
                           join public.entrepreneurs e on e.profile_id = u.id
                          where p.program_id = g.id),
             'viewers', coalesce((select jsonb_agg(v.email order by v.email) from public.sponsor_viewers v
                                   where v.sponsor_id = s.id), '[]'::jsonb),
             'cosponsors', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'sponsor_id', cs.id, 'name', cs.name, 'logo_path', c.logo_path, 'link_url', c.link_url,
                        'position', c.position,
                        'viewers', coalesce((select jsonb_agg(v.email order by v.email) from public.sponsor_viewers v
                                              where v.sponsor_id = cs.id), '[]'::jsonb)
                      ) order by c.position, cs.name)
                 from public.program_cosponsors c join public.sponsors cs on cs.id = c.sponsor_id
                where c.program_id = g.id), '[]'::jsonb),
             'partner_ids', coalesce((select jsonb_agg(pp.partner_id) from public.program_partners pp
                                       where pp.program_id = g.id), '[]'::jsonb),
             'seats', g.seats,
             'reward_cents', g.reward_cents
           ) order by g.is_default, g.period_start desc, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where not g.is_simulated
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ who may call what

revoke execute on function
  public.campaign_terms_set(uuid, integer, bigint),
  public.campaign_rewards_due(uuid),
  public.campaign_reward_mark_paid(uuid, boolean, text),
  public.diary_campaign_reward()
from public, anon;
grant execute on function
  public.campaign_terms_set(uuid, integer, bigint),
  public.campaign_rewards_due(uuid),
  public.campaign_reward_mark_paid(uuid, boolean, text)
to authenticated, service_role;
grant execute on function public.diary_campaign_reward() to authenticated;
