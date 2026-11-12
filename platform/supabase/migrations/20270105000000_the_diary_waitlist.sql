-- The diary's waitlist.
--
-- Founder's request, 12/11/2026: the diary opens to a group of entrepreneurs
-- at a time, so the site no longer links to it and asks her to join a
-- waitlist instead: her name, e-mail, what she sells, city and state, and
-- her consent to be contacted. EmpowerFI reads the list in
-- empowerfi-dashboard and marks who was invited.
--
-- The site writes through diary_waitlist_join, open to anyone; nothing else
-- of the table is reachable but through the dashboard's gated functions.

create table public.diary_waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  email      text not null check (char_length(email) between 3 and 255),
  sells      text not null check (char_length(sells) between 1 and 120),
  city       text not null check (char_length(city) between 1 and 80),
  state      text not null check (state ~ '^[A-Z]{2}$'),
  language   text not null default 'pt' check (language in ('pt', 'en')),
  source     text check (source is null or char_length(source) <= 60),
  invited_at timestamptz,
  created_at timestamptz not null default now()
);
-- One row per person, case-insensitive.
create unique index diary_waitlist_email on public.diary_waitlist (lower(email));
alter table public.diary_waitlist enable row level security;
revoke all on public.diary_waitlist from anon, authenticated;

/** From the site: joins the list once; 'joined', or 'already' when the e-mail was on it. */
create function public.diary_waitlist_join(
  p_name text, p_email text, p_sells text, p_city text, p_state text,
  p_consent boolean, p_language text default 'pt', p_source text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_consent is not true then
    raise exception 'waitlist_needs_consent' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 255 then
    raise exception 'waitlist_email_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_sells, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_city, ''))) not between 1 and 80
     or coalesce(p_state, '') !~ '^[A-Z]{2}$' then
    raise exception 'waitlist_fields_invalid' using errcode = '22023';
  end if;
  insert into public.diary_waitlist (name, email, sells, city, state, language, source)
  values (btrim(p_name), v_email, btrim(p_sells), btrim(p_city), p_state,
          case when p_language = 'en' then 'en' else 'pt' end, left(nullif(btrim(p_source), ''), 60))
  on conflict ((lower(email))) do nothing;
  return case when found then 'joined' else 'already' end;
end $$;

/** For the dashboard: everyone on the list, newest first, and whether she already has a diary. */
create function public.diary_waitlist_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id, 'name', w.name, 'email', w.email, 'sells', w.sells, 'city', w.city, 'state', w.state,
             'language', w.language, 'source', w.source, 'invited_at', w.invited_at, 'created_at', w.created_at,
             'has_diary', exists (select 1 from auth.users u join public.entrepreneurs e on e.profile_id = u.id
                                   where lower(u.email) = w.email))
           order by w.created_at desc)
      from public.diary_waitlist w
  ), '[]'::jsonb);
end $$;

/** Marks one person invited (or not); returns when. */
create function public.diary_waitlist_set_invited(p_id uuid, p_invited boolean)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  perform private.require_campaign_manager();
  update public.diary_waitlist set invited_at = case when p_invited then coalesce(invited_at, now()) end
   where id = p_id
  returning invited_at into v_at;
  if not found then
    raise exception 'no_such_waitlist_entry' using errcode = 'P0002';
  end if;
  return v_at;
end $$;

/** Takes someone off the list (she asked, or it was a mistake). */
create function public.diary_waitlist_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  delete from public.diary_waitlist where id = p_id;
  if not found then
    raise exception 'no_such_waitlist_entry' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.diary_waitlist_join(text, text, text, text, text, boolean, text, text) from public;
grant execute on function public.diary_waitlist_join(text, text, text, text, text, boolean, text, text) to anon, authenticated;
revoke execute on function public.diary_waitlist_list(), public.diary_waitlist_set_invited(uuid, boolean),
  public.diary_waitlist_delete(uuid) from public, anon;
grant execute on function public.diary_waitlist_list(), public.diary_waitlist_set_invited(uuid, boolean),
  public.diary_waitlist_delete(uuid) to authenticated;
