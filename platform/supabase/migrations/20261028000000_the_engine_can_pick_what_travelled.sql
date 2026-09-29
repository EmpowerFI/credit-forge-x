-- The engine page can follow a request only if it can pick one that travelled.
--
-- engine_opportunities() is the desk's work queue: what still needs a decision.
-- It excludes every request that became a loan, which is right for a queue and
-- exactly wrong for the engine page's third act, where the whole point is the
-- capital after the decision — the crossing into reais, the disbursal, what
-- circulated, what came back. On this deployment every request that reached any
-- of that is a loan, so the picker could offer nothing with a story to follow.
--
-- The queue keeps its meaning and its default. A caller that asks for settled
-- requests gets them too, flagged and sorted after the queue rather than mixed
-- into it, so the desk still opens on work and the engine page can still show
-- a loop. The zero-argument function is dropped rather than overloaded: two
-- candidates with the same empty call are ambiguous.

drop function if exists public.engine_opportunities();

create function public.engine_opportunities(p_include_settled boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := private.my_role();
  v_partner uuid := private.my_partner_id();
  v_overseer boolean := coalesce(v_role in ('auditor', 'admin'), false);
begin
  if not (private.is_investor_or_overseer() or v_partner is not null or v_role = 'sponsor') then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(row order by
             (row ->> 'settled')::boolean,
             -- Inside the queue: the desk's order, untouched.
             row ->> 'queued',
             -- Inside the settled group: furthest first, so the option that can
             -- show a whole loop is the one at the top rather than whichever
             -- was created last.
             case when (row ->> 'settled')::boolean
                  then array_position(array['looped', 'rail', 'disbursed', 'funded', 'raising', 'waiting'],
                                      row ->> 'reached')
                  else 0 end,
             row ->> 'created_at', row ->> 'opportunity_id'), '[]')
    from (
      select jsonb_build_object(
        'opportunity_id', o.id,
        'code', case when v_partner is not null then private.partner_code(o.entrepreneur_id) else private.opportunity_code(o.id) end,
        -- Queued demand first, in order; held requests after it.
        'queued', case when o.allocation is not null then '0' else '1' end,
        -- Whether this request already became a loan. The desk's queue is what
        -- still needs a decision; a request that was lent is no longer work,
        -- but it is the only kind whose capital can be followed anywhere.
        'settled', exists (select 1 from public.loans l where l.opportunity_id = o.id),
        -- How far the capital got, read the same way journey_opportunities()
        -- reads it. Said on the option itself: a picker that hides this invites
        -- someone to follow a request that never left the first movement.
        'reached', rch.reached,
        'created_at', private.iso(o.created_at),
        'status', o.status,
        'purpose', o.purpose,
        'business_sector', en.business_sector,
        'community', c.name,
        'community_city', c.city,
        'community_state', c.state,
        -- What an operator has already stated she has on file, so the capital
        -- network's run starts from the record instead of from five empty
        -- checkboxes. Only for the people who run the engine: an investor and a
        -- sponsor read this queue too, and which papers a business is missing
        -- is not theirs to know.
        'documents', case when v_partner is not null or v_overseer
                     then to_jsonb(o.documents_on_file) end,
        'amount_cents', o.amount_cents,
        'term_months', o.term_months,
        'instalment_cents', o.instalment_cents,
        'risk_band', o.risk_band,
        'confidence', o.confidence,
        'impact_eligible', c.name is not null,
        'funding_status', coalesce(o.funding_status::text, case when o.allocation is not null then 'waiting' end),
        'funding_pool', o.funding_pool,
        'allocation', o.allocation,
        'allocation_reason_codes', to_jsonb(o.allocation_reason_codes),
        'allocation_model_version', o.allocation_model_version,
        'allocated_at', private.iso(o.allocated_at),
        -- What a global allocation raised, and the rate it locked when it did:
        -- the settlement comparator prices its two routes from these.
        'funding_target_micro_usdc', o.funding_target_micro_usdc,
        'fx_brl_per_usdc_milli', o.fx_brl_per_usdc_milli,
        'readiness', jsonb_build_object(
          'status', r.status, 'score', r.score, 'band', r.band, 'model_version', r.model_version,
          'as_of_period', r.as_of_period, 'assessed_at', private.iso(r.created_at),
          'months_reported', (r.features ->> 'months_reported')::integer,
          'consecutive_months', (r.features ->> 'consecutive_months')::integer,
          'records_kept_bps', (r.features ->> 'records_kept_bps')::integer,
          'positive_months_last3', (r.features ->> 'positive_months_last3')::integer,
          'core_modules_completed', (r.features ->> 'core_modules_completed')::integer,
          'core_modules_total', (r.features ->> 'core_modules_total')::integer,
          'community_verified', (r.features ->> 'community_verified')::boolean
        ),
        'eligibility', jsonb_build_object(
          'decision', e.decision, 'model_version', e.model_version, 'assessed_at', private.iso(e.created_at),
          'requested_cents', e.requested_amount_cents, 'proposed_cents', e.proposed_amount_cents,
          'affordability_bps', e.affordability_bps, 'risk_band', e.risk_band, 'confidence', e.confidence,
          'reason_codes', to_jsonb(e.reason_codes)
        ),
        'proofs', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'kind', a.kind, 'status', a.status, 'signature', a.signature, 'account', a.account_address,
              'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile, 'confirmed_at', private.iso(a.confirmed_at)
            ) order by a.id), '[]')
          from public.chain_anchors a
          where (a.kind = 'readiness' and a.entity_id = r.id)
             or (a.kind = 'eligibility' and a.entity_id = e.id)
             or (a.kind = 'opportunity' and a.entity_id = o.id)
        )
      ) as row
      from public.qualified_credit_opportunities o
      join public.eligibility_assessments e on e.id = o.eligibility_id
      join public.readiness_assessments r on r.id = e.readiness_assessment_id
      join public.entrepreneurs en on en.id = o.entrepreneur_id
      left join lateral (
        select co.name, co.city, co.state from public.community_memberships m join public.communities co on co.id = m.community_id
        where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified' order by m.joined_at limit 1
      ) c on true
      left join lateral (
        select l.id, l.status from public.loans l where l.opportunity_id = o.id
        order by l.created_at desc limit 1
      ) ln on true
      cross join lateral (
        select case
          when exists (select 1 from public.local_conversions lc
                       where lc.loan_id = ln.id and lc.direction = 'redeem') then 'looped'
          when exists (select 1 from public.local_conversions lc
                       where lc.loan_id = ln.id and lc.direction = 'issue') then 'rail'
          when ln.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') then 'disbursed'
          when o.funding_status = 'funded' then 'funded'
          when o.funding_status in ('open', 'partially_funded') then 'raising'
          else 'waiting'
        end as reached
      ) rch
      where (p_include_settled
             or not exists (select 1 from public.loans l where l.opportunity_id = o.id
                            and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED')))
        and (
          -- The queue capital_overview() replays.
          (o.allocation is not null
            and o.status in ('open', 'referred', 'partner_approved')
            and coalesce(o.funding_status::text, 'waiting') in ('waiting', 'open', 'partially_funded', 'funded'))
          -- Held for a person to review: only those who review.
          or (v_overseer and o.status = 'in_review')
          -- Already lent. Not part of the desk's queue and never ordered into
          -- it: only a caller that asked for settled requests sees these.
          or (p_include_settled and exists (select 1 from public.loans l where l.opportunity_id = o.id))
        )
        and (
          v_overseer
          or (v_partner is not null and private.has_consent(o.entrepreneur_id, 'partner'))
          or (v_role = 'capital_provider' and private.has_consent(o.entrepreneur_id, 'investors'))
          or (v_role = 'sponsor' and private.sponsor_reaches(o.entrepreneur_id) and private.has_consent(o.entrepreneur_id, 'investors'))
        )
    ) t
  );
end;
$$;

revoke all on function public.engine_opportunities(boolean) from public, anon;
grant execute on function public.engine_opportunities(boolean) to authenticated, service_role;
