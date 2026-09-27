-- Gate 1 was reading one decision where the credit engine reads two.
--
-- private.capital_need() set readiness_ok from `decision = 'ELIGIBLE'`, so every
-- opportunity qualified at a smaller amount than she asked for —
-- ELIGIBLE_REDUCED, which is most of them — came back "for a person to review"
-- instead of getting a plan. The credit engine's own QUALIFYING_DECISIONS has
-- said otherwise since it was written: a reduced amount is a qualified
-- opportunity, it is simply a smaller one, and the opportunity carries the
-- reduced amount already.
--
-- MANUAL_REVIEW stays outside. A request a person is still looking at gets a
-- review, not a recommendation, and manual_review_allowed stays false: the
-- engine has the flag, and turning it on would put route cards in front of a
-- request that has not qualified yet — which is the one thing addendum §12 is
-- most careful about.
create or replace function private.capital_need(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'amount_cents', o.amount_cents,
    'term_months', o.term_months,
    'purpose', o.purpose::text,
    'uf', coalesce(e.state, ''),
    -- No incorporation date is recorded anywhere in this product, so the age of
    -- the business is the span of the history she has actually reported: her
    -- first check-in to this month, inclusive. A proxy, and named as one
    -- wherever it is shown.
    'business_age_months', coalesce((
      select (substr(private.current_period(), 1, 4)::integer * 12 + substr(private.current_period(), 6, 2)::integer)
             - min(substr(c.period, 1, 4)::integer * 12 + substr(c.period, 6, 2)::integer) + 1
      from public.checkins c where c.entrepreneur_id = o.entrepreneur_id), 0),
    'documents', to_jsonb(o.documents_on_file),
    'max_instalment_cents', el.max_instalment_cents,
    -- Women-led, in a verified community: the impact mandate's test, as the
    -- pool engine already asks it.
    'impact_eligible', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = o.entrepreneur_id and c.status = 'verified'),
    -- Gate 1, recorded rather than assumed, and reading the same decisions the
    -- credit engine qualifies on.
    'readiness_ok', el.decision in ('ELIGIBLE', 'ELIGIBLE_REDUCED'),
    'manual_review_allowed', false)
  from public.qualified_credit_opportunities o
  join public.eligibility_assessments el on el.id = o.eligibility_id
  join public.entrepreneurs e on e.id = o.entrepreneur_id
  where o.id = p_opportunity_id
$$;
