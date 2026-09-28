-- The investor console is a stablecoin console.

-- The thesis this product demonstrates is one movement: capital that exists
-- abroad as USDC becomes credit in a Brazilian woman's hands as local currency,
-- circulates in her territory, and comes back as USDC. An external investor
-- never sends reais and has no rail to send them on.
--
-- Domestic P2P stays in the product. The engine still routes to it, the capital
-- network still reports it, an operator still sets its policy — Brazilian
-- capital funding Brazilian entrepreneurs is a good thing and the engine should
-- prefer it when it is cheaper. It is simply not an offer that can be made to
-- this audience, and offering it here was the reason the console read as a
-- currency exchange rather than as a thesis.
--
-- So the market an investor browses is what an investor can fund. A request
-- routed to the domestic desk leaves the list, except where this investor
-- already holds a position in it, because a portfolio that cannot be opened is
-- worse than a route that cannot be taken. An overseer keeps the whole book:
-- oversight is the one job that needs to see what was routed away.
--
-- And what leaves is counted rather than hidden. market_funded_elsewhere()
-- exists so the market can say, in one line, how much qualified demand is
-- raising on a rail this console does not carry. An investor who sees eight
-- requests should be able to learn that the engine qualified ten.

create or replace function public.investor_opportunities()
returns table (
  opportunity_id uuid,
  code text,
  purpose public.credit_purpose,
  business_sector text,
  community_name text,
  community_city text,
  community_state text,
  amount_cents bigint,
  term_months smallint,
  instalment_cents bigint,
  funding_status public.funding_status,
  funding_target_micro_usdc bigint,
  funded_micro_usdc bigint,
  fx_brl_per_usdc_milli integer,
  investors integer,
  my_micro_usdc bigint,
  indicative_yield_bps integer,
  risk_band public.grade,
  confidence public.grade,
  eligibility_decision public.eligibility_decision,
  affordability_bps integer,
  eligibility_reasons text[],
  eligibility_model text,
  readiness_score integer,
  readiness_band public.readiness_band,
  readiness_model text,
  months_reported integer,
  records_kept_bps integer,
  loan_status public.loan_status,
  created_at timestamptz,
  proofs jsonb,
  funding_pool public.funding_pool,
  allocation jsonb,
  allocation_reason_codes text[]
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_investor_or_overseer() then
    raise exception 'not_allowed_to_see_opportunities' using errcode = '42501';
  end if;
  return query
  select
    o.id, private.opportunity_code(o.id), o.purpose, en.business_sector,
    c.name, c.city, c.state,
    o.amount_cents, o.term_months, o.instalment_cents,
    o.funding_status, o.funding_target_micro_usdc, o.funded_micro_usdc, o.fx_brl_per_usdc_milli,
    (select count(distinct i.investor_id)::integer from public.investments i where i.opportunity_id = o.id),
    (select coalesce(sum(i.amount_micro_usdc), 0)::bigint from public.investments i where i.opportunity_id = o.id and i.investor_id = auth.uid()),
    -- What the chosen pool's investors ask, net of expected loss.
    coalesce((o.allocation ->> 'investor_net_return_bps')::integer, private.indicative_yield_bps(o.risk_band)),
    o.risk_band, o.confidence, e.decision, e.affordability_bps, e.reason_codes, e.model_version,
    r.score::integer, r.band, r.model_version,
    (r.features ->> 'months_reported')::integer, (r.features ->> 'records_kept_bps')::integer,
    (select l.status from public.loans l where l.opportunity_id = o.id),
    o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile, 'confirmed_at', private.iso(a.confirmed_at)
      ) order by a.id), '[]')
     from public.chain_anchors a
     where (a.kind = 'readiness' and a.entity_id = e.readiness_assessment_id)
        or (a.kind = 'eligibility' and a.entity_id = e.id)
        or (a.kind = 'opportunity' and a.entity_id = o.id)
        or (a.kind = 'consent' and a.entity_id = (
              select k.id from public.consents k where k.entrepreneur_id = o.entrepreneur_id
              order by k.consent_no desc limit 1))),
    o.funding_pool, o.allocation, o.allocation_reason_codes
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments e on e.id = o.eligibility_id
  join public.readiness_assessments r on r.id = e.readiness_assessment_id
  join public.entrepreneurs en on en.id = o.entrepreneur_id
  left join lateral (
    select co.name, co.city, co.state from public.community_memberships m join public.communities co on co.id = m.community_id
    where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified' order by m.joined_at limit 1
  ) c on true
  where o.funding_status is not null
    and (private.has_consent(o.entrepreneur_id, 'investors')
         or exists (select 1 from public.investments i where i.opportunity_id = o.id and i.investor_id = auth.uid()))
    -- An external investor funds in USDC. A request the engine routed to the
    -- domestic desk is not an offer this console can make, so it leaves the
    -- market — unless this investor already holds a position in it, or is an
    -- overseer, whose job is exactly to see what was routed away.
    and (o.funding_pool is distinct from 'domestic'
         or private.my_role() is distinct from 'capital_provider'
         or exists (select 1 from public.investments i where i.opportunity_id = o.id and i.investor_id = auth.uid()))
  order by (o.funding_status in ('open', 'partially_funded')) desc, o.created_at desc;
end;
$$;


-- What the console does not carry, said rather than hidden.
--
-- Qualified demand still raising on the domestic desk: the count and the reais.
-- It is the market's footnote, not a second market — there is no id here and
-- nothing to click, because the point is the size of what is missing, not the
-- requests themselves.
create function public.market_funded_elsewhere()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not private.is_investor_or_overseer() then null else
    (select jsonb_build_object(
       'count', count(*)::integer,
       'amount_cents', coalesce(sum(o.amount_cents), 0)::bigint)
     from public.qualified_credit_opportunities o
     where o.funding_pool = 'domestic'
       and o.funding_status in ('open', 'partially_funded')
       and private.has_consent(o.entrepreneur_id, 'investors'))
  end;
$$;

revoke execute on function public.market_funded_elsewhere() from public, anon;
grant execute on function public.market_funded_elsewhere() to authenticated;
