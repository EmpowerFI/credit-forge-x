-- What every number in this product is made of (addendum v3 §9).
--
-- The addendum asks that every figure carry one of four evidence labels. Taken
-- literally that means a pill beside two hundred tiles, and a label repeated on
-- every tile is wallpaper: a reader learns nothing from a word that never
-- varies. The information is in the exceptions — in which numbers are *not*
-- assumptions — so this reader states the label of each family of figures the
-- product holds, and derives every one of them from the rows themselves.
--
-- Deriving rather than declaring is the whole point. A hand-written list would
-- say "Solana transactions are observed" on a deployment that has never
-- confirmed one, and "settlement is sandboxed" on a deployment whose provider
-- rows say simulated. This reader answers for the deployment it is running in,
-- which is why the same page tells a different and still true story on the
-- local database and on the hackathon project.
--
-- Three vocabularies live in this product and they are not the same axis, which
-- is worth saying plainly because three sets of pills invite the assumption
-- that they are synonyms:
--
--   Private / Derived / Proven on Solana — who may see a number, and whether
--   its commitment is on chain. A confidentiality and proof axis.
--
--   Real / Sandbox / Simulated / Mock — whether a rail is actually running.
--   It describes machinery, not figures, and it is finer than the addendum's
--   four words on purpose: a devnet transaction and a MoneyGram sandbox quote
--   are both "not production" and are not the same kind of claim.
--
--   Observed / From a partner / Simulated / External benchmark — how strong a
--   claim a number makes. The addendum's vocabulary, and the one this reader
--   speaks. A figure can be Derived and a simulated assumption at once; the
--   axes do not collapse into each other and nothing here pretends they do.

-- An aggregate is only as strong as its weakest input (v3 §9), so a family with
-- one simulated row is a simulated family.
create or replace function private.evidence_of(p_all_real boolean)
returns public.evidence_label language sql immutable set search_path = ''
as $$ select case when coalesce(p_all_real, false) then 'observed_pilot_data'::public.evidence_label
                  else 'simulated_assumption'::public.evidence_label end $$;

-- A quote's rail, in the addendum's words. A sandbox is the institution's own
-- figure, which is what "from a partner" means; a devnet or testnet transaction
-- did happen and was recorded, which is the strongest thing a prototype has.
create or replace function private.evidence_from_quote_reality(p_reality public.quote_reality)
returns public.evidence_label language sql immutable set search_path = ''
as $$ select case p_reality
              when 'sandbox' then 'partner_provided'::public.evidence_label
              when 'devnet' then 'observed_pilot_data'::public.evidence_label
              when 'test' then 'observed_pilot_data'::public.evidence_label
              else 'simulated_assumption'::public.evidence_label end $$;

create or replace function public.evidence_ledger()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  -- The chain a figure inherits from. A score computed from a simulated month
  -- is a simulated score however carefully it was computed, and a loan written
  -- against a simulated score is a simulated loan — so these travel upwards and
  -- the families below read the chain rather than their own flag alone. Over an
  -- empty table bool_and is null, which falls to simulated: the safe direction.
  with chain as (
    select (select bool_and(not is_simulated) from public.checkins) as months,
           (select bool_and(not is_simulated) from public.readiness_assessments) as readiness,
           (select bool_and(not is_simulated) from public.loans) as loans
  ),
  families as (
    -- The months a business reports. Everything downstream of this is at most
    -- as strong as it is, which is why it comes first.
    select 1 as ord, 'business_months' as key,
           private.evidence_of((select months from chain)) as evidence,
           count(*)::int as rows,
           count(*) filter (where not is_simulated)::int as real_rows
      from public.checkins
    union all
    -- Scores the engines compute from those months. Derived, and never stronger
    -- than what went in.
    select 2, 'readiness_and_eligibility',
           private.evidence_of((select months and readiness from chain)), count(*)::int,
           count(*) filter (where not is_simulated)::int
      from public.readiness_assessments
    union all
    select 3, 'loans_and_instalments',
           private.evidence_of((select months and readiness and loans from chain)), count(*)::int,
           count(*) filter (where not is_simulated)::int
      from public.loans
    union all
    -- A pool's capital, its required return and its policy.
    select 4, 'pool_capital',
           private.evidence_of(bool_and(not is_simulated)), count(*)::int,
           count(*) filter (where not is_simulated)::int
      from public.funding_pools
    union all
    -- What a partner route states it has. A provider that is not simulated is
    -- stating its own figure, which is the addendum's "from a partner" and not
    -- something this product observed.
    select 5, 'partner_routes',
           case when count(*) filter (where not is_simulated) = count(*) and count(*) > 0
                then 'partner_provided'::public.evidence_label
                else 'simulated_assumption'::public.evidence_label end,
           count(*)::int, count(*) filter (where not is_simulated)::int
      from public.capital_providers
    union all
    -- The rails that turn dollars into reais, and what they quote.
    select 6, 'settlement_quotes',
           coalesce(min(private.evidence_from_quote_reality(reality)), 'simulated_assumption'),
           count(*)::int, count(*) filter (where reality <> 'simulated')::int
      from public.settlement_providers
    union all
    -- The rate a dollar is worth. Observed where something recorded one from a
    -- source; an assumption of this prototype until then.
    select 7, 'fx_rates',
           case when count(*) filter (where source is not null and source <> 'simulated') > 0
                then 'external_benchmark'::public.evidence_label
                else 'simulated_assumption'::public.evidence_label end,
           count(*)::int, count(*) filter (where source is not null and source <> 'simulated')::int
      from public.fx_rates
    union all
    -- What it costs to serve one business. The card names its own source.
    select 8, 'cost_rates',
           case when count(*) filter (where source <> 'simulated') > 0
                then 'external_benchmark'::public.evidence_label
                else 'simulated_assumption'::public.evidence_label end,
           count(*)::int, count(*) filter (where source <> 'simulated')::int
      from public.cost_rate_cards
    union all
    -- A confirmed anchor is a transaction that happened and can be checked by
    -- anyone, which is the strongest thing in here. Pending ones are not.
    select 9, 'solana_anchors',
           case when count(*) filter (where status = 'confirmed') > 0
                then 'observed_pilot_data'::public.evidence_label
                else 'simulated_assumption'::public.evidence_label end,
           count(*)::int, count(*) filter (where status = 'confirmed')::int
      from public.chain_anchors
    union all
    select 10, 'zcash_returns',
           case when count(*) filter (where status = 'sent') > 0
                then 'observed_pilot_data'::public.evidence_label
                else 'simulated_assumption'::public.evidence_label end,
           count(*)::int, count(*) filter (where status = 'sent')::int
      from public.zcash_returns
    union all
    -- The rail's own rows carry the label, so this family reads it rather than
    -- inferring it.
    select 11, 'local_rail',
           case when count(*) = 0 then 'simulated_assumption'::public.evidence_label
                else min(evidence_status) end,
           count(*)::int, 0
      from public.local_transactions
  )
  select jsonb_build_object(
    'families', coalesce(jsonb_agg(jsonb_build_object(
      'key', f.key, 'evidence', f.evidence, 'rows', f.rows, 'real_rows', f.real_rows)
      order by f.ord), '[]'::jsonb),
    -- What the whole product may claim, which is its weakest family. Stated
    -- once and loudly beats a pill on every tile.
    'weakest', (select case when bool_or(evidence = 'simulated_assumption') then 'simulated_assumption'
                            when bool_or(evidence = 'external_benchmark') then 'external_benchmark'
                            when bool_or(evidence = 'partner_provided') then 'partner_provided'
                            else 'observed_pilot_data' end
                  from families),
    'observed_families', (select count(*)::int from families where evidence = 'observed_pilot_data'),
    'families_total', (select count(*)::int from families))
  from families f
$$;

comment on function public.evidence_ledger() is
  'Which of the addendum''s four evidence labels each family of figures in this product carries, derived from the rows rather than declared (v3 §9).';

revoke all on function private.evidence_of(boolean), private.evidence_from_quote_reality(public.quote_reality)
  from public, anon, authenticated;
grant execute on function private.evidence_of(boolean), private.evidence_from_quote_reality(public.quote_reality)
  to service_role;

-- Counts only, and no figure about any person. Whoever may read a number in
-- this product may read what kind of claim it is.
revoke all on function public.evidence_ledger() from public, anon;
grant execute on function public.evidence_ledger() to authenticated, service_role;
