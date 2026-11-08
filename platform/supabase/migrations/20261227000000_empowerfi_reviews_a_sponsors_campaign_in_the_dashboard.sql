-- EmpowerFI reviews a sponsor's campaign in the dashboard.
--
-- A campaign a sponsor funds from its own wallet (20261223) waits, hidden,
-- until EmpowerFI lists it. Until now the only way to list it was the SQL
-- editor. campaign_vault_review gives empowerfi-dashboard what a review needs
-- -- the sponsor's words, its wallet, what it paid, the transactions -- and
-- the dashboard publishes or hides it with the campaign_vault_list it
-- already has (20261226), under the same gate as every campaign RPC.

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
             'listed_at', v.listed_at
           ) order by v.listed_at is not null, v.funded_at desc)
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.campaign_vault_review() from public, anon;
grant execute on function public.campaign_vault_review() to authenticated, service_role;
