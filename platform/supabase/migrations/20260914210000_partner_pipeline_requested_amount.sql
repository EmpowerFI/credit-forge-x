-- partner_pipeline also returns what she asked for.
--
-- When eligibility reduced the amount, the opportunity carries the proposed
-- figure; a partner deciding on it should see both. The return type changes,
-- so the function is dropped and created again.

drop function public.partner_pipeline();

create function public.partner_pipeline()
returns table (
  opportunity_id uuid,
  participant text,
  status public.opportunity_status,
  amount_cents bigint,
  requested_amount_cents bigint,
  term_months smallint,
  instalment_cents bigint,
  purpose public.credit_purpose,
  risk_band public.grade,
  confidence public.grade,
  eligibility_decision public.eligibility_decision,
  max_instalment_cents bigint,
  affordability_bps integer,
  suggested_min_cents bigint,
  suggested_max_cents bigint,
  eligibility_reasons text[],
  readiness_band public.readiness_band,
  months_reported integer,
  avg_revenue_cents bigint,
  avg_net_business_cents bigint,
  revenue_cv_bps integer,
  business_sector text,
  community_name text,
  community_city text,
  community_state text,
  referred_at timestamptz,
  is_simulated boolean
)
language sql stable security definer set search_path = ''
as $$
  select
    o.id,
    'P-' || upper(left(replace(o.entrepreneur_id::text, '-', ''), 6)),
    o.status, o.amount_cents, e.requested_amount_cents, o.term_months, o.instalment_cents, o.purpose, o.risk_band, o.confidence,
    e.decision, e.max_instalment_cents, e.affordability_bps, e.suggested_min_cents, e.suggested_max_cents,
    e.reason_codes,
    r.band,
    (r.features ->> 'months_reported')::integer,
    -- Rounded to R$ 100: enough to judge, not a ledger.
    round((r.features ->> 'avg_revenue_cents')::numeric, -4)::bigint,
    round((r.features ->> 'avg_net_business_cents')::numeric, -4)::bigint,
    (r.features ->> 'revenue_cv_bps')::integer,
    en.business_sector,
    c.name, c.city, c.state,
    o.referred_at, o.is_simulated
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments e on e.id = o.eligibility_id
  join public.readiness_assessments r on r.id = e.readiness_assessment_id
  join public.entrepreneurs en on en.id = o.entrepreneur_id
  left join lateral (
    select co.name, co.city, co.state from public.community_memberships m
    join public.communities co on co.id = m.community_id
    where m.entrepreneur_id = o.entrepreneur_id and co.status = 'verified'
    order by m.joined_at limit 1
  ) c on true
  where o.partner_id is not null
    and (o.partner_id = private.my_partner_id() or private.is_auditor_or_admin())
  order by o.referred_at desc
$$;

revoke all on function public.partner_pipeline() from public, anon;
grant execute on function public.partner_pipeline() to authenticated;
