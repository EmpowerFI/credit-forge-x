-- M1 · identity & community
--
-- Who someone is (profiles, with a role), the communities they belong to, the
-- entrepreneurs in them, and the credit partners. RLS is on for every table
-- from this first migration; nothing here is writable directly by a client —
-- writes go through the RPCs in the community-flow migration, which check the
-- caller's role and record what has to be anchored on-chain.

create extension if not exists pgcrypto with schema extensions;

-- Helper functions live here: callable from RLS policies, never exposed by the
-- REST API (only `public` is).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ------------------------------------------------------------------- types

create type public.app_role as enum (
  'entrepreneur',
  'community_leader',
  'partner',
  'capital_provider',
  'auditor',
  'admin'
);

create type public.community_kind as enum (
  'education_programme',
  'association',
  'cooperative',
  'collective',
  'other'
);

create type public.community_status as enum ('pending_verification', 'verified', 'rejected');

create type public.membership_status as enum ('active', 'left');

create type public.partner_kind as enum (
  'credit_union',
  'scd',
  'fintech',
  'bank',
  'impact_fund',
  'other'
);

-- ---------------------------------------------------------------- partners

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  kind public.partner_kind not null,
  min_ticket_cents bigint not null check (min_ticket_cents > 0),
  max_ticket_cents bigint not null,
  accepted_purposes text[] not null default '{}',
  decision_method text not null default 'manual'
    check (decision_method in ('manual', 'rules', 'hybrid')),
  active boolean not null default true,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ticket_range_is_ordered check (max_ticket_cents >= min_ticket_cents)
);

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'entrepreneur',
  display_name text not null check (char_length(display_name) between 1 and 80),
  partner_id uuid references public.partners (id),
  created_at timestamptz not null default now(),
  -- A partner user always acts for one partner; nobody else acts for any.
  constraint partner_users_have_a_partner check ((role = 'partner') = (partner_id is not null))
);

-- Every new auth user gets a profile, always as an entrepreneur. Any other role
-- is granted by the service role (seed, admin tooling) — never by the user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1),
      'Participant'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ------------------------------------------------------------- communities

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  -- What the chain knows the community by: 32 random bytes, never derived.
  chain_ref bytea not null unique default extensions.gen_random_bytes(32)
    check (octet_length(chain_ref) = 32),
  name text not null check (char_length(name) between 3 and 120),
  kind public.community_kind not null,
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (state ~ '^[A-Z]{2}$'),
  description text check (char_length(description) <= 1000),
  leader_id uuid not null references public.profiles (id),
  status public.community_status not null default 'pending_verification',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  review_note text check (char_length(review_note) <= 500),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint verification_is_recorded check (
    status <> 'verified' or (verified_at is not null and verified_by is not null)
  )
);

create index communities_leader_idx on public.communities (leader_id);

-- ------------------------------------------------------------ entrepreneurs

create table public.entrepreneurs (
  id uuid primary key default gen_random_uuid(),
  -- Null for participants a leader registered who have not logged in yet.
  profile_id uuid unique references public.profiles (id) on delete set null,
  -- 32 random bytes, generated here and never derived from anything: a hash of
  -- an email or document can be reversed by dictionary, random bytes cannot.
  -- The column is not granted to clients (see below); only its hash leaves
  -- the database.
  borrower_ref bytea not null unique default extensions.gen_random_bytes(32)
    check (octet_length(borrower_ref) = 32),
  display_name text not null check (char_length(display_name) between 1 and 80),
  business_name text check (char_length(business_name) <= 120),
  business_sector text check (char_length(business_sector) <= 80),
  city text check (char_length(city) <= 80),
  state text check (state ~ '^[A-Z]{2}$'),
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.community_memberships (
  community_id uuid not null references public.communities (id) on delete cascade,
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (community_id, entrepreneur_id)
);

create index memberships_entrepreneur_idx on public.community_memberships (entrepreneur_id);

-- ----------------------------------------------------------------- helpers
-- security definer so a policy can consult other tables without recursing
-- into their policies. Each takes the caller from auth.uid(), never from an
-- argument.

create function private.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.my_role() = 'admin', false) $$;

create function private.is_auditor_or_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.my_role() in ('auditor', 'admin'), false) $$;

create function private.leads_community(p_community_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.communities
    where id = p_community_id and leader_id = auth.uid()
  )
$$;

create function private.my_entrepreneur_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.entrepreneurs where profile_id = auth.uid() $$;

create function private.is_member(p_community_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.community_memberships m
    join public.entrepreneurs e on e.id = m.entrepreneur_id
    where m.community_id = p_community_id and e.profile_id = auth.uid()
  )
$$;

-- True when the caller leads any community the entrepreneur belongs to.
create function private.leads_entrepreneur(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.community_memberships m
    join public.communities c on c.id = m.community_id
    where m.entrepreneur_id = p_entrepreneur_id and c.leader_id = auth.uid()
  )
$$;

-- Timestamps enter commitments as text, and must render identically however
-- they are read: UTC, microseconds, a trailing Z.
create function private.iso(p_ts timestamptz)
returns text
language sql immutable set search_path = ''
as $$ select to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- --------------------------------------------------------------------- RLS

alter table public.partners enable row level security;
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.entrepreneurs enable row level security;
alter table public.community_memberships enable row level security;

-- Clients read through policies; they write only through the RPCs.
revoke all on public.partners, public.profiles, public.communities,
  public.entrepreneurs, public.community_memberships from anon, authenticated;

grant select on public.partners, public.profiles, public.communities,
  public.community_memberships to authenticated;

-- Every entrepreneurs column except borrower_ref.
grant select (
  id, profile_id, display_name, business_name, business_sector, city, state,
  is_simulated, created_at
) on public.entrepreneurs to authenticated;

-- A user may rename herself, and nothing else about her profile.
grant update (display_name) on public.profiles to authenticated;

-- Partners: the directory is not sensitive.
create policy partners_read on public.partners
  for select to authenticated using (true);

-- Profiles: your own, and everyone's for admins.
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy profiles_rename_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Communities: verified ones are a directory anyone signed in can browse;
-- leaders also see their own pending ones, members theirs, admins all.
create policy communities_read on public.communities
  for select to authenticated
  using (
    status = 'verified'
    or leader_id = (select auth.uid())
    or (select private.is_member(id))
    or (select private.is_auditor_or_admin())
  );

-- Entrepreneurs: herself, the leaders of her communities, admins and auditors.
create policy entrepreneurs_read on public.entrepreneurs
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.leads_entrepreneur(id))
    or (select private.is_auditor_or_admin())
  );

-- Memberships: your own, the ones in communities you lead, admins and auditors.
create policy memberships_read on public.community_memberships
  for select to authenticated
  using (
    entrepreneur_id = (select private.my_entrepreneur_id())
    or (select private.leads_community(community_id))
    or (select private.is_auditor_or_admin())
  );
