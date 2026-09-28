-- Two kinds of capital from abroad, and they are not the same thing.
--
-- The registry called one of them "Capital global de impacto · USDC na Solana"
-- and the other "Capital de impacto internacional". Read side by side on a plan,
-- those name one idea twice. They are not one idea. One is many people and funds
-- each buying a share of a single loan, with nobody to approve it — the raise
-- closes when enough of them have said yes. The other is one fund lending from
-- its own balance sheet, on a mandate it wrote, which has to say yes and asks
-- for reports back.
--
-- That difference is the whole of what "capital from outside Brazil" means here,
-- and a screen that hides it under two similar names is not showing the network,
-- it is showing a blur. The names now carry it, and so do the type labels the
-- cards render in both languages.
--
-- Only the two routes EmpowerFI itself operates are renamed. The third-party
-- products keep the names their providers gave them: those are what they are
-- called, not what we would like them to be called.

-- A name is not a policy.
--
-- private.capital_instrument_edited() bumps policy_version on any column but
-- updated_at, which made the two renames below read as commercial terms moving.
-- The version exists so a recorded decision can be read against the policy that
-- produced it; what a route is called is not part of that policy, and nor is the
-- prose describing it. An operator who cannot change these columns at all
-- (there is no update grant on name) should not be able to age every stored
-- decision by fixing a label in a migration.
--
-- Everything else still bumps it, including every column the editor grant does
-- reach.
create or replace function private.capital_instrument_edited() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if to_jsonb(new) - 'updated_at' - 'policy_version' - 'name'
     is distinct from to_jsonb(old) - 'updated_at' - 'policy_version' - 'name' then
    new.policy_version := old.policy_version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

update public.capital_instruments
   set name = 'Pool global P2P · investidores no exterior'
 where code = 'pool_global_impacto';

update public.capital_instruments
   set name = 'Fundo de impacto internacional · capital próprio'
 where code = 'capital_impacto_global';
