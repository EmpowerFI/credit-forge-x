-- Strategic partners, beside her sponsors.
--
-- Founder's request, 12/11/2026: EmpowerFI has strategic partners (the first
-- is conta.vc) that are not a campaign's sponsor. She adds them from
-- empowerfi-dashboard, and every entrepreneur sees them in the diary's
-- Sponsors tab, below the sponsors of her campaigns, with or without a
-- campaign of her own.
--
-- A partner has a name, a short description, a logo and a link. The logo
-- lives in the public sponsor-logos bucket (20261207) under the same rules:
-- PNG, JPEG or WebP up to 512 KB, never SVG; only https links. A partner can
-- be hidden without being deleted, and the dashboard sets the order.

create table public.strategic_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 200),
  logo_path text check (logo_path is null or logo_path ~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$'),
  link_url text check (link_url is null or (link_url ~ '^https://[^[:space:]]+$' and char_length(link_url) <= 500)),
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.strategic_partners enable row level security;
revoke all on public.strategic_partners from anon, authenticated;

-- ------------------------------------------------------------------ for empowerfi-dashboard

create function public.partner_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'description', p.description,
             'logo_path', p.logo_path, 'link_url', p.link_url,
             'position', p.position, 'is_visible', p.is_visible
           ) order by p.position, p.name)
      from public.strategic_partners p
  ), '[]'::jsonb);
end $$;

/** Creates (p_id null) or edits a partner; returns its id. */
create function public.partner_save(
  p_id uuid,
  p_name text,
  p_description text default null,
  p_logo_path text default null,
  p_link_url text default null,
  p_position integer default 0,
  p_is_visible boolean default true
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(p_description), '');
  v_logo text := nullif(btrim(p_logo_path), '');
  v_link text := nullif(btrim(p_link_url), '');
begin
  perform private.require_campaign_manager();
  if char_length(v_name) not between 1 and 80 then
    raise exception 'partner_name_invalid' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 200 then
    raise exception 'partner_description_too_long' using errcode = '22023';
  end if;
  if v_logo is not null and v_logo !~ '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}\.(png|jpg|jpeg|webp)$' then
    raise exception 'logo_path_invalid' using errcode = '22023';
  end if;
  if v_link is not null and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then
    raise exception 'link_url_invalid' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.strategic_partners (name, description, logo_path, link_url, position, is_visible)
    values (v_name, v_description, v_logo, v_link, coalesce(p_position, 0), coalesce(p_is_visible, true))
    returning id into v_id;
  else
    update public.strategic_partners
       set name = v_name, description = v_description, logo_path = v_logo, link_url = v_link,
           position = coalesce(p_position, 0), is_visible = coalesce(p_is_visible, true), updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'no_such_partner' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

create function public.partner_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  delete from public.strategic_partners where id = p_id;
  if not found then
    raise exception 'no_such_partner' using errcode = 'P0002';
  end if;
end $$;

-- ------------------------------------------------------------------ for the diary

/** Every visible partner, in the dashboard's order. */
create function public.diary_partners()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.diary_me();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'name', p.name, 'description', p.description,
             'logo_path', p.logo_path, 'link_url', p.link_url
           ) order by p.position, p.name)
      from public.strategic_partners p
     where p.is_visible
  ), '[]'::jsonb);
end $$;

revoke execute on function
  public.partner_list(), public.partner_save(uuid, text, text, text, text, integer, boolean),
  public.partner_delete(uuid), public.diary_partners()
from public, anon;
grant execute on function
  public.partner_list(), public.partner_save(uuid, text, text, text, text, integer, boolean),
  public.partner_delete(uuid), public.diary_partners()
to authenticated;
