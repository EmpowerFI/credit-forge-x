-- Who may change a capital policy, and which parts of one.
--
-- This is the first place in the product where a person writes capital policy to
-- the database. funding_pools is edited by migration, and the Assumptions sheet
-- on /app/capital says so in its own header — "Simulated; nothing is saved". So
-- the question of what an operator may change is worth answering in the schema
-- rather than in a screen (PLAN_CAPITAL_NETWORK §6.4).
--
-- The answer is: commercial terms, yes; what kind of thing a route is, no.
--
--   An operator may move a ticket range, a capacity, a cost, a mandate, the
--   states and purposes served, the papers asked for, the instalment share and
--   whether the route is open at all.
--
--   An operator may not change instrument_type, pool, currency, is_domestic,
--   is_global, requires_partner_approval, is_credit, is_simulated, the provider
--   it belongs to, its code, or its name. Those are what addendum §12 protects:
--   a route that must never be called a loan stays not-credit, a route whose
--   owner must say yes keeps saying so, and the name a woman reads on a route
--   card is not a field an operator can reword into "quick credit".
--
-- Creating an instrument declares every one of those things at once, so nothing
-- here grants insert. A new provider or a new instrument arrives by migration,
-- exactly as a funding pool does.

-- A credit route must always state what share of her affordable instalment it
-- may take. Leaving it null is how the affordability gate gets skipped, and only
-- a route with no repayment at all is allowed to skip it.
alter table public.capital_instruments
  add constraint a_credit_route_states_its_share
  check (not is_credit or max_instalment_share_bps is not null);

-- Every edit bumps the policy version and stamps the time, so a stored decision
-- can be read against the policy that produced it rather than against today's.
create function private.capital_instrument_edited() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if to_jsonb(new) - 'updated_at' - 'policy_version' is distinct from to_jsonb(old) - 'updated_at' - 'policy_version' then
    new.policy_version := old.policy_version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger capital_instrument_edited before update on public.capital_instruments
  for each row execute function private.capital_instrument_edited();

-- Commercial terms only. The columns left out of this grant are the ones a
-- migration owns.
grant update (
  ticket_min_cents, ticket_max_cents, eligible_uf, purposes, business_age_min_months,
  required_documents, max_instalment_share_bps, estimated_cost_bps, closed_network_rules,
  capacity_cents, impact_mandate, active, effective_to
) on public.capital_instruments to authenticated;

-- Reading the registry is wider than writing it: a sponsor and an auditor both
-- see these policies, and neither sets one.
create policy capital_instruments_write on public.capital_instruments for update to authenticated
using (
  coalesce(private.my_role()::text, '') in ('capital_provider', 'admin')
)
with check (
  coalesce(private.my_role()::text, '') in ('capital_provider', 'admin')
  -- A pool's existence is decided by funding_pools, not here. An operator may
  -- close a partner route; closing a P2P route from this screen would hide it
  -- from the network while open_for_funding kept allocating to it.
  and (pool is null or active)
);

revoke all on function private.capital_instrument_edited() from public, anon, authenticated;
