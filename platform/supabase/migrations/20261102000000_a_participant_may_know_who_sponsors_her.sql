-- A participant may know who sponsors her program.
--
-- `can_see_program` opens a programme to an auditor, to the sponsor itself and
-- to the leader of a community the programme reaches — deliberately not to the
-- entrepreneur, because `programs` carries the sponsor's committed and deployed
-- budget and she has no business reading a funder's balance sheet.
--
-- But "this journey is made possible by NOVA" is information she is owed rather
-- than branding done at her: a participant should be able to see who is paying
-- for the programme she is in, and to see it inside the product rather than
-- being told offline. So this is a narrow read instead of a wider policy: the
-- programme's name, the sponsor's name and kind, the period, and whether either
-- is simulated. No budget, no other community, no other participant, and
-- nothing about any programme that does not reach her own community.
--
-- Nothing flows the other way. This function tells the participant about the
-- sponsor; it tells the sponsor nothing about the participant, and no sponsor
-- gains a read on anyone through it.

create function public.my_program_sponsorship()
returns table (
  program_id uuid,
  program_name text,
  description text,
  period_start date,
  period_end date,
  sponsor_name text,
  sponsor_kind public.sponsor_kind,
  is_simulated boolean
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, p.description, p.period_start, p.period_end,
         s.name, s.kind, (p.is_simulated or s.is_simulated)
  from public.entrepreneurs e
  join public.community_memberships cm on cm.entrepreneur_id = e.id
  join public.program_communities pc on pc.community_id = cm.community_id
  join public.programs p on p.id = pc.program_id
  join public.sponsors s on s.id = p.sponsor_id
  where e.profile_id = (select auth.uid())
    and cm.status = 'active'
  order by p.period_start desc
  limit 1
$$;

comment on function public.my_program_sponsorship() is
  'The programme and sponsor behind the caller''s own community, name and period only — never a budget.';

revoke all on function public.my_program_sponsorship() from public, anon;
grant execute on function public.my_program_sponsorship() to authenticated;
