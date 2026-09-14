-- M2 · education
--
-- Preparation before credit, made measurable: programmes, their modules, and
-- each entrepreneur's progress through them. Completed modules are one of the
-- readiness engine's inputs (week 2), as a preparation signal — never as
-- engagement telemetry: opens, clicks and time-on-page do not exist here.
--
-- Programmes with no community are EmpowerFI's and open to everyone; a
-- community's own programme is for its members. Progress is recorded by the
-- entrepreneur herself or by a leader of one of her communities — in-person
-- programmes are marked by the person who ran the session.

create type public.education_status as enum ('in_progress', 'completed');

create table public.education_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 1000),
  -- Null: an EmpowerFI programme, open to every community.
  community_id uuid references public.communities (id) on delete cascade,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.education_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.education_programs (id) on delete cascade,
  position smallint not null check (position > 0),
  title text not null check (char_length(title) between 3 and 120),
  estimated_minutes smallint not null check (estimated_minutes between 5 and 600),
  created_at timestamptz not null default now(),
  unique (program_id, position)
);

create table public.education_progress (
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  module_id uuid not null references public.education_modules (id) on delete cascade,
  status public.education_status not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Who recorded it: herself, or the leader who ran the session.
  recorded_by uuid references public.profiles (id),
  primary key (entrepreneur_id, module_id),
  constraint completion_is_dated check ((status = 'completed') = (completed_at is not null))
);

create index education_progress_module_idx on public.education_progress (module_id);

alter table public.education_programs enable row level security;
alter table public.education_modules enable row level security;
alter table public.education_progress enable row level security;

revoke all on public.education_programs, public.education_modules, public.education_progress
  from anon, authenticated;
grant select on public.education_programs, public.education_modules, public.education_progress
  to authenticated;

-- Programme content is not sensitive.
create policy education_programs_read on public.education_programs
  for select to authenticated using (true);
create policy education_modules_read on public.education_modules
  for select to authenticated using (true);

-- Progress: herself, the leaders of her communities, auditors and admins.
create policy education_progress_read on public.education_progress
  for select to authenticated
  using (
    entrepreneur_id = (select private.my_entrepreneur_id())
    or (select private.leads_entrepreneur(entrepreneur_id))
    or (select private.is_auditor_or_admin())
  );

-- Records progress on one module. Completing is final: a completed module is
-- not reopened by a later "in progress".
create function public.record_education_progress(
  p_entrepreneur_id uuid,
  p_module_id uuid,
  p_status public.education_status
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_program_community uuid;
begin
  if not coalesce(
    p_entrepreneur_id = private.my_entrepreneur_id()
    or private.leads_entrepreneur(p_entrepreneur_id)
    or private.is_admin(),
    false
  ) then
    raise exception 'not_allowed_to_record_progress' using errcode = '42501';
  end if;

  select p.community_id into v_program_community
  from public.education_modules m
  join public.education_programs p on p.id = m.program_id
  where m.id = p_module_id;
  if not found then
    raise exception 'module_not_found' using errcode = 'P0002';
  end if;

  -- A community's own programme is for its members.
  if v_program_community is not null and not exists (
    select 1 from public.community_memberships
    where community_id = v_program_community and entrepreneur_id = p_entrepreneur_id
  ) then
    raise exception 'programme_not_open_to_her' using errcode = 'P0001';
  end if;

  insert into public.education_progress (entrepreneur_id, module_id, status, completed_at, recorded_by)
  values (
    p_entrepreneur_id, p_module_id, p_status,
    case when p_status = 'completed' then now() end,
    auth.uid()
  )
  on conflict (entrepreneur_id, module_id) do update
  set status = excluded.status,
      completed_at = excluded.completed_at,
      recorded_by = excluded.recorded_by
  where public.education_progress.status <> 'completed';
end;
$$;

revoke all on function public.record_education_progress(uuid, uuid, public.education_status) from public, anon;
grant execute on function public.record_education_progress(uuid, uuid, public.education_status) to authenticated;
