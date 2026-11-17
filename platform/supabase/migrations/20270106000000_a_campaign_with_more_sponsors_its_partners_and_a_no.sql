-- A campaign with more sponsors, its partners, and a no.
--
-- Founder's requests, 17/11/2026, creating a campaign in empowerfi-dashboard:
--
-- 1. More than one sponsor. A campaign made in the dashboard had one sponsor
--    (programs.sponsor_id); co-sponsoring existed only for campaigns paid
--    into a vault on Solana (20261228). Now a campaign keeps its sponsor (the
--    lead) and any number of co-sponsors, each with its own logo and link.
--    Each shows in the diary's Sponsors tab to the women in the campaign, and
--    each has its own readers in the impact area: the people a sponsor names
--    (sponsor_viewers) see every campaign it leads or co-sponsors. Rewards
--    stay the lead's to edit.
--
-- 2. Strategic partners for a campaign. A partner (20270103) showed to every
--    entrepreneur. It can now be tied to campaigns (conta.vc, in the 30-day
--    challenge, receives the rewards): a partner tied to campaigns shows only
--    to the women in one of them, with the campaign's name; a partner tied to
--    none still shows to everyone.
--
-- 3. Rejecting a campaign paid on Solana. EmpowerFI could only publish one or
--    leave it waiting. Now it can reject it, with a reason: it leaves the
--    review queue, never shows on the Missions page, and can be taken back.
--    The money stays in its vault on devnet; the program has no refund.

-- ------------------------------------------------------------------ 1 · co-sponsors

create table public.program_cosponsors (
  program_id uuid not null references public.programs (id) on delete cascade,
  sponsor_id uuid not null references public.sponsors (id) on delete restrict,
  logo_path  text check (logo_path is null or logo_path ~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$'),
  link_url   text check (link_url is null or (link_url ~ '^https://[^[:space:]]+$' and char_length(link_url) <= 500)),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (program_id, sponsor_id)
);
create index program_cosponsors_sponsor on public.program_cosponsors (sponsor_id);
alter table public.program_cosponsors enable row level security;
revoke all on public.program_cosponsors from anon, authenticated;

/** A co-sponsor that becomes the lead is no longer a co-sponsor. */
create function private.lead_is_not_a_cosponsor()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.program_cosponsors where program_id = new.id and sponsor_id = new.sponsor_id;
  return new;
end $$;
revoke execute on function private.lead_is_not_a_cosponsor() from public, anon, authenticated;
create trigger lead_is_not_a_cosponsor after update of sponsor_id on public.programs
  for each row when (old.sponsor_id is distinct from new.sponsor_id)
  execute function private.lead_is_not_a_cosponsor();

/**
 * Adds a co-sponsor to a campaign, or changes its logo, link and place.
 * The sponsor is found by name (case-insensitive) or created, as campaign_save does.
 */
create function public.campaign_cosponsor_save(
  p_program_id uuid,
  p_sponsor_name text,
  p_logo_path text default null,
  p_link_url text default null,
  p_position integer default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_sponsor_name, ''));
  v_logo text := nullif(btrim(p_logo_path), '');
  v_link text := nullif(btrim(p_link_url), '');
  v_program public.programs%rowtype;
  v_sponsor uuid;
begin
  perform private.require_campaign_manager();
  select * into v_program from public.programs where id = p_program_id and not is_simulated;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if v_program.is_default then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'sponsor_name_length' using errcode = '22023';
  end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then
    raise exception 'link_must_be_https' using errcode = '22023';
  end if;
  if v_logo is not null and v_logo !~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$' then
    raise exception 'logo_path_invalid' using errcode = '22023';
  end if;

  select id into v_sponsor from public.sponsors where lower(name) = lower(v_name);
  if v_sponsor is null then
    insert into public.sponsors (name, kind) values (v_name, 'company') returning id into v_sponsor;
  elsif exists (select 1 from public.sponsors where id = v_sponsor and (is_house or is_simulated)) then
    raise exception 'house_sponsor_is_fixed' using errcode = '22023';
  end if;
  if v_sponsor = v_program.sponsor_id then
    raise exception 'cosponsor_is_the_lead' using errcode = '22023';
  end if;

  insert into public.program_cosponsors as c (program_id, sponsor_id, logo_path, link_url, position)
  values (p_program_id, v_sponsor, v_logo, v_link,
          coalesce(p_position, (select coalesce(max(position), 0) + 10 from public.program_cosponsors where program_id = p_program_id)))
  on conflict (program_id, sponsor_id) do update
     set logo_path = excluded.logo_path, link_url = excluded.link_url,
         position = coalesce(p_position, c.position);
  return v_sponsor;
end $$;

create function public.campaign_cosponsor_remove(p_program_id uuid, p_sponsor_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  delete from public.program_cosponsors where program_id = p_program_id and sponsor_id = p_sponsor_id;
  if not found then
    raise exception 'no_such_cosponsor' using errcode = 'P0002';
  end if;
end $$;

/** As 20261204's, the lead or a co-sponsor: whoever a sponsor names sees what it supports. */
create or replace function private.can_see_campaign(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_impact_staff()
    or exists (select 1 from public.programs g
                 join public.sponsor_viewers v on v.sponsor_id = g.sponsor_id
                where g.id = p_program_id and not g.is_simulated and v.email = private.my_email())
    or exists (select 1 from public.programs g
                 join public.program_cosponsors c on c.program_id = g.id
                 join public.sponsor_viewers v on v.sponsor_id = c.sponsor_id
                where g.id = p_program_id and not g.is_simulated and v.email = private.my_email())
$$;

/** As 20261208's, with the co-sponsors' names. */
create or replace function public.impact_campaigns()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'name', g.name, 'sponsor_name', s.name, 'is_default', g.is_default,
           'period_start', g.period_start, 'period_end', g.period_end,
           'logo_path', g.logo_path, 'link_url', g.link_url,
           'enrolment', g.enrolment, 'offers_rewards', g.offers_rewards,
           'can_edit_rewards', coalesce(private.can_edit_rewards(g.id), false),
           'cosponsors', coalesce((select jsonb_agg(cs.name order by c.position, cs.name)
                                     from public.program_cosponsors c join public.sponsors cs on cs.id = c.sponsor_id
                                    where c.program_id = g.id), '[]'::jsonb)
         ) order by g.is_default, g.period_start desc, g.name), '[]'::jsonb)
    from public.programs g join public.sponsors s on s.id = g.sponsor_id
   where not g.is_simulated and private.can_see_campaign(g.id)
$$;

-- ------------------------------------------------------------------ 2 · partners of a campaign

create table public.program_partners (
  program_id uuid not null references public.programs (id) on delete cascade,
  partner_id uuid not null references public.strategic_partners (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (program_id, partner_id)
);
create index program_partners_partner on public.program_partners (partner_id);
alter table public.program_partners enable row level security;
revoke all on public.program_partners from anon, authenticated;

/** The campaign's partners become exactly p_partner_ids (an empty list unties them all). */
create function public.campaign_partners_set(p_program_id uuid, p_partner_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  if not exists (select 1 from public.programs where id = p_program_id and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if exists (select 1 from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as t(id)
              where not exists (select 1 from public.strategic_partners p where p.id = t.id)) then
    raise exception 'no_such_partner' using errcode = 'P0002';
  end if;
  delete from public.program_partners
   where program_id = p_program_id and partner_id <> all (coalesce(p_partner_ids, '{}'::uuid[]));
  insert into public.program_partners (program_id, partner_id)
  select distinct p_program_id, t.id from unnest(coalesce(p_partner_ids, '{}'::uuid[])) as t(id)
  on conflict do nothing;
end $$;

/** As 20270103's, with the campaigns each partner is tied to. */
create or replace function public.partner_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'description', p.description,
             'logo_path', p.logo_path, 'link_url', p.link_url,
             'position', p.position, 'is_visible', p.is_visible,
             'campaigns', coalesce((select jsonb_agg(g.name order by g.name)
                                      from public.program_partners pp join public.programs g on g.id = pp.program_id
                                     where pp.partner_id = p.id), '[]'::jsonb)
           ) order by p.position, p.name)
      from public.strategic_partners p
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------------ the diary: her campaigns, her sponsors, her partners

/**
 * The real campaigns she is in today (20261229's rule, now shared): named for
 * one, or sharing her impact figures in a published vault campaign.
 */
create function private.diary_my_programs(p_me uuid)
returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_email text := private.email_of(p_me);
begin
  return query
    select g.id
      from public.programs g
     where g.is_real and not g.is_default and not g.is_simulated
       and g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today
       and (exists (select 1 from public.program_participants p
                     where p.program_id = g.id and p.email = v_email and p.starts_on <= v_today
                       and coalesce(private.participation_end(p.ends_on, p.program_id), v_today) >= v_today)
            or (private.shares_impact(p_me) and exists (
                  select 1 from public.campaign_vaults v
                   where v.program_id = g.id and v.listed_at is not null
                     and (v.joins is null or exists (select 1 from public.campaign_vaults l
                                                      where l.program_id = v.joins and l.listed_at is not null)))));
end $$;
revoke execute on function private.diary_my_programs(uuid) from public, anon, authenticated;

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

/** As 20261229's, with the co-sponsors (and who reads for each) and the partners' ids. */
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
                                       where pp.program_id = g.id), '[]'::jsonb)
           ) order by g.is_default, g.period_start desc, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where not g.is_simulated
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ 3 · a no to a campaign paid on Solana

alter table public.campaign_vaults
  add column rejected_at timestamptz,
  add column rejected_by uuid,
  add column rejected_reason text check (rejected_reason is null or char_length(rejected_reason) between 3 and 500),
  add constraint campaign_vaults_rejected_is_not_listed check (rejected_at is null or listed_at is null),
  add constraint campaign_vaults_rejected_has_a_reason check ((rejected_at is null) = (rejected_reason is null));

/** Rejects a campaign still waiting (p_reason) or takes the rejection back (p_reason null). */
create function public.campaign_vault_reject(p_program_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_vault public.campaign_vaults%rowtype;
begin
  perform private.require_campaign_manager();
  select * into v_vault from public.campaign_vaults where program_id = p_program_id for update;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if v_reason is null then
    update public.campaign_vaults set rejected_at = null, rejected_by = null, rejected_reason = null
     where program_id = p_program_id;
    return;
  end if;
  if v_vault.listed_at is not null then
    raise exception 'campaign_is_published' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'reject_reason_length' using errcode = '22023';
  end if;
  update public.campaign_vaults set rejected_at = now(), rejected_by = auth.uid(), rejected_reason = v_reason
   where program_id = p_program_id;
end $$;

/** As 20261226's: a rejected campaign is not published until the rejection is taken back. */
create or replace function public.campaign_vault_list(p_program_id uuid, p_listed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if session_user = 'authenticator' and not private.can_manage_rewards() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_listed and exists (select 1 from public.campaign_vaults where program_id = p_program_id and rejected_at is not null) then
    raise exception 'campaign_rejected' using errcode = '22023';
  end if;
  update public.campaign_vaults
     set listed_at = case when p_listed then coalesce(listed_at, now()) end,
         listed_by = case when p_listed then coalesce(listed_by, auth.uid()) end
   where program_id = p_program_id;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return jsonb_build_object('program_id', p_program_id, 'listed', p_listed);
end $$;

/** As 20261228's, with the rejection: waiting ones first, then published, then rejected. */
create or replace function public.campaign_vault_review()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'program_id', v.program_id,
             'name', g.name,
             'description', g.description,
             'sponsor', s.name,
             'sponsor_wallet', v.sponsor_wallet,
             'cluster', v.cluster,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'seats', v.seats,
             'funded_units', v.funded_units,
             'mint_decimals', v.mint_decimals,
             'campaign_address', v.campaign_address,
             'funded_signature', v.funded_signature,
             'funded_at', v.funded_at,
             'listed_at', v.listed_at,
             'rejected_at', v.rejected_at,
             'rejected_reason', v.rejected_reason,
             'joins', v.joins,
             'joins_listed', (select l.listed_at is not null from public.campaign_vaults l where l.program_id = v.joins)
           ) order by case when v.rejected_at is not null then 2 when v.listed_at is not null then 1 else 0 end, v.funded_at desc)
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
  ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------ who may call what

revoke execute on function
  public.campaign_cosponsor_save(uuid, text, text, text, integer),
  public.campaign_cosponsor_remove(uuid, uuid),
  public.campaign_partners_set(uuid, uuid[]),
  public.campaign_vault_reject(uuid, text)
from public, anon;
grant execute on function
  public.campaign_cosponsor_save(uuid, text, text, text, integer),
  public.campaign_cosponsor_remove(uuid, uuid),
  public.campaign_partners_set(uuid, uuid[]),
  public.campaign_vault_reject(uuid, text)
to authenticated, service_role;
