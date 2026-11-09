-- Her sponsors, in a tab of their own; and which campaigns are real.
--
-- A campaign can now have more than one sponsor (20261228), so one logo in
-- the diary's header no longer fits: the diary gets a Sponsors tab, each
-- sponsor's logo opening the page the sponsor named. Only REAL campaigns'
-- sponsors show there. programs.is_real says which are: a campaign made in
-- empowerfi-dashboard is real unless EmpowerFI says otherwise; a vault
-- campaign of the Missions page is devnet when it is recorded. EmpowerFI
-- changes it from the dashboard (campaign_set_real); EmpowerFI's own
-- campaign has none to change.

alter table public.programs add column is_real boolean not null default true;

-- The Missions page's campaigns run on Solana devnet with test tokens.
update public.programs set is_real = false where id in (select program_id from public.campaign_vaults);

create function private.a_vault_campaign_is_devnet()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.programs set is_real = false where id = new.program_id;
  return new;
end $$;
create trigger a_vault_campaign_is_devnet after insert on public.campaign_vaults
  for each row execute function private.a_vault_campaign_is_devnet();
revoke execute on function private.a_vault_campaign_is_devnet() from public, anon, authenticated;

/** EmpowerFI marks a campaign real or devnet, from empowerfi-dashboard. */
create function public.campaign_set_real(p_id uuid, p_real boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  if p_real is null then
    raise exception 'campaign_real_needs_an_answer' using errcode = '22023';
  end if;
  if exists (select 1 from public.programs where id = p_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  update public.programs set is_real = p_real, updated_at = now() where id = p_id and not is_simulated;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', p_id, 'is_real', p_real);
end $$;
revoke execute on function public.campaign_set_real(uuid, boolean) from public, anon;
grant execute on function public.campaign_set_real(uuid, boolean) to authenticated, service_role;

-- As 20261208's, with whether the campaign is real and whether it is a vault on chain.
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
                                   where v.sponsor_id = s.id), '[]'::jsonb)
           ) order by g.is_default, g.period_start desc, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where not g.is_simulated
  ), '[]'::jsonb);
end;
$$;


/**
 * Her sponsors: of the real campaigns running today that she is in -- named
 * in it from the dashboard, or, for a published vault campaign, sharing her
 * impact figures -- one row per sponsor, with the logo and link of its latest
 * campaign that has them. EmpowerFI's own campaign has no sponsor to show.
 */
create function public.diary_sponsors()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_today date := private.sp_today();
  v_email text := private.email_of(v_me);
begin
  return coalesce((
    with mine as (
      select g.id, g.name, g.sponsor_id, g.logo_path, g.link_url, g.period_start
        from public.programs g
       where g.is_real and not g.is_default and not g.is_simulated
         and g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today
         and (exists (select 1 from public.program_participants p
                       where p.program_id = g.id and p.email = v_email and p.starts_on <= v_today
                         and coalesce(private.participation_end(p.ends_on, p.program_id), v_today) >= v_today)
              or (private.shares_impact(v_me) and exists (
                    select 1 from public.campaign_vaults v
                     where v.program_id = g.id and v.listed_at is not null
                       and (v.joins is null or exists (select 1 from public.campaign_vaults l
                                                        where l.program_id = v.joins and l.listed_at is not null)))))
    )
    select jsonb_agg(jsonb_build_object(
             'name', s.name,
             'logo_path', (select m.logo_path from mine m where m.sponsor_id = s.id and m.logo_path is not null
                            order by m.period_start desc limit 1),
             'link_url', (select m.link_url from mine m where m.sponsor_id = s.id and m.link_url is not null
                           order by m.period_start desc limit 1),
             'campaigns', (select jsonb_agg(distinct m.name) from mine m where m.sponsor_id = s.id)
           ) order by s.name)
      from public.sponsors s
     where s.id in (select sponsor_id from mine) and not s.is_house
  ), '[]'::jsonb);
end $$;
revoke execute on function public.diary_sponsors() from public, anon;
grant execute on function public.diary_sponsors() to authenticated;
