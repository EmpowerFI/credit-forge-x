-- An investor's mandate (refactor spec §6, 16 Sep): an impact fund is an
-- investor with a mandate, not a generic wallet. What it funds (purposes,
-- sectors, states), how much per opportunity, which risk it accepts, through
-- which pool, and whether it funds only businesses in verified communities.
--
-- Matching runs in the browser (src/app/lib/mandate.ts) against what every
-- investor already sees of an opportunity: nothing about a business is added.
-- An empty list means any.

create type public.investor_kind as enum ('individual', 'impact_fund');

create table public.investor_mandates (
  investor_id uuid primary key references public.profiles (id) on delete cascade,
  kind public.investor_kind not null default 'individual',
  label text check (char_length(label) between 1 and 80),
  impact_mandate boolean not null default false,
  states text[] not null default '{}',
  purposes public.credit_purpose[] not null default '{}',
  sectors text[] not null default '{}',
  risk_bands public.grade[] not null default '{}',
  pools public.funding_pool[] not null default '{}',
  min_ticket_cents bigint check (min_ticket_cents >= 0),
  max_ticket_cents bigint check (max_ticket_cents > 0),
  is_simulated boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint mandate_ticket_is_ordered check (max_ticket_cents is null or min_ticket_cents is null or max_ticket_cents >= min_ticket_cents),
  constraint mandate_states_are_ufs check (array_to_string(states, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$')
);

alter table public.investor_mandates enable row level security;
revoke all on public.investor_mandates from anon, authenticated;
grant select on public.investor_mandates to authenticated;

create policy investor_mandates_read on public.investor_mandates for select to authenticated using (
  investor_id = (select auth.uid()) or (select private.is_auditor_or_admin())
);

-- Her own mandate, set by the investor; nobody sets another's.
create function public.set_mandate(
  p_kind public.investor_kind,
  p_label text default null,
  p_impact_mandate boolean default false,
  p_states text[] default '{}',
  p_purposes public.credit_purpose[] default '{}',
  p_sectors text[] default '{}',
  p_risk_bands public.grade[] default '{}',
  p_pools public.funding_pool[] default '{}',
  p_min_ticket_cents bigint default null,
  p_max_ticket_cents bigint default null
)
returns public.investor_mandates
language plpgsql security definer set search_path = ''
as $$
declare
  v public.investor_mandates;
begin
  if private.my_role() is distinct from 'capital_provider' then
    raise exception 'only_investors_set_a_mandate' using errcode = '42501';
  end if;
  insert into public.investor_mandates as m (
    investor_id, kind, label, impact_mandate, states, purposes, sectors, risk_bands, pools, min_ticket_cents, max_ticket_cents, updated_at
  ) values (
    auth.uid(), p_kind, nullif(trim(p_label), ''), coalesce(p_impact_mandate, false),
    coalesce(p_states, '{}'), coalesce(p_purposes, '{}'), coalesce(p_sectors, '{}'), coalesce(p_risk_bands, '{}'),
    coalesce(p_pools, '{}'), p_min_ticket_cents, p_max_ticket_cents, now()
  )
  on conflict (investor_id) do update set
    kind = excluded.kind, label = excluded.label, impact_mandate = excluded.impact_mandate, states = excluded.states,
    purposes = excluded.purposes, sectors = excluded.sectors, risk_bands = excluded.risk_bands, pools = excluded.pools,
    min_ticket_cents = excluded.min_ticket_cents, max_ticket_cents = excluded.max_ticket_cents, updated_at = now()
  returning * into v;
  return v;
end;
$$;

revoke all on function public.set_mandate(public.investor_kind, text, boolean, text[], public.credit_purpose[], text[], public.grade[], public.funding_pool[], bigint, bigint) from public, anon;
grant execute on function public.set_mandate(public.investor_kind, text, boolean, text[], public.credit_purpose[], text[], public.grade[], public.funding_pool[], bigint, bigint) to authenticated, service_role;
