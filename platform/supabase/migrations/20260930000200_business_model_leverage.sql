-- What a fixed block actually does to the unit economics
--
-- business_model's first answer put the same margin at a hundred participants
-- and at two thousand, because it apportioned the fixed monthly cost by seats:
-- a block divided by the people in it costs the same per person however few
-- they are. That is arithmetic, not leverage, and it flatters the early months
-- exactly when they should not be flattered.
--
-- What replaces it says two true things instead. How many participants, across
-- every programme, it takes for the licences to pay for the block; and what
-- this programme would cost if it were the only one carrying it.

CREATE OR REPLACE FUNCTION public.business_model(p_program_id uuid DEFAULT NULL::uuid, p_pricing_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_card public.cost_rate_cards;
  v_price public.pricing_cards;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());
  select * into v_price from public.pricing_cards
    where version = coalesce(p_pricing_version, (select version from public.pricing_cards where is_default limit 1));
  if v_price.version is null then
    raise exception 'pricing_card_not_found' using errcode = 'P0002';
  end if;

  return (
    with communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    state as materialized (
      select distinct on (s.entrepreneur_id) s.*
      from communities c cross join lateral private.community_state(c.id) s
      order by s.entrepreneur_id, s.joined_at
    ),
    people as materialized (select entrepreneur_id from state),
    costs as materialized (
      select ce.* from public.cost_events ce
      where p_program_id is null
         or ce.community_id in (select id from communities)
         or ce.entrepreneur_id in (select entrepreneur_id from people)
    ),
    -- Costs are a total over however long the programme has been running; a
    -- price is monthly. Everything below is brought to the month.
    span as (
      select greatest(1.0, coalesce(extract(epoch from (max(created_at) - min(created_at))) / 2629800.0, 0)) as months,
        min(created_at) as first_at, max(created_at) as last_at
      from costs
    ),
    borne as (
      select
        coalesce(sum(amount_cents) filter (where borne_by = 'empowerfi'), 0) as empowerfi_cents,
        coalesce(sum(amount_cents) filter (where borne_by = 'community'), 0) as community_cents,
        coalesce(sum(amount_cents) filter (where borne_by = 'partner'), 0) as partner_cents,
        count(*) filter (where stage = 'chain_anchoring') as proofs,
        count(distinct (stage, fact_id)) as facts
      from costs
    ),
    k as (select (select count(*) from state) as participants),
    money as (
      select
        k.participants,
        s.months,
        -- The seats, or the floor when the programme is too small to reach it.
        greatest(v_price.floor_cents, k.participants * v_price.seat_cents) as licence_cents,
        k.participants * v_price.seat_cents < v_price.floor_cents as floor_applied,
        -- What the platform itself spends: the events it bears, per month, and
        -- its share of the cost of existing.
        round(b.empowerfi_cents / s.months) as variable_cents,
        case when coalesce(v_card.fixed_monthly_capacity_participants, 0) > 0
          then round(v_card.fixed_monthly_cents::numeric * k.participants
                     / v_card.fixed_monthly_capacity_participants) else 0 end as fixed_share_cents,
        case when v_price.billing_model = 'bundled'
          then k.participants * v_price.community_share_cents else 0 end as passthrough_cents,
        b.*
      from k, span s, borne b
    )
    select jsonb_build_object(
      'pricing', jsonb_build_object(
        'version', v_price.version, 'billing_model', v_price.billing_model, 'source', v_price.source,
        'seat_cents', v_price.seat_cents, 'floor_cents', v_price.floor_cents,
        'community_share_cents', v_price.community_share_cents, 'note', v_price.note,
        'is_assumption', v_price.source = 'simulated',
        'others', (select coalesce(jsonb_agg(jsonb_build_object(
              'version', p.version, 'billing_model', p.billing_model,
              'seat_cents', p.seat_cents, 'floor_cents', p.floor_cents) order by p.version), '[]')
          from public.pricing_cards p where p.version <> v_price.version)),

      'scope', jsonb_build_object(
        'program_id', p_program_id,
        'participants', m.participants,
        'months_measured', round(m.months, 2),
        'first_at', s.first_at, 'last_at', s.last_at),

      -- Per month, at the size this programme is now.
      'monthly', jsonb_build_object(
        'licence_cents', m.licence_cents,
        'floor_applied', m.floor_applied,
        'variable_cents', m.variable_cents,
        'fixed_share_cents', m.fixed_share_cents,
        'passthrough_cents', m.passthrough_cents,
        'cost_cents', m.variable_cents + m.fixed_share_cents + m.passthrough_cents,
        'margin_cents', m.licence_cents - (m.variable_cents + m.fixed_share_cents + m.passthrough_cents),
        'margin_bps', case when m.licence_cents > 0
          then round((m.licence_cents - (m.variable_cents + m.fixed_share_cents + m.passthrough_cents))
                     * 10000.0 / m.licence_cents) end),

      'per_participant_month', jsonb_build_object(
        'licence_cents', case when m.participants > 0 then round(m.licence_cents::numeric / m.participants) end,
        'variable_cents', case when m.participants > 0 then round(m.variable_cents::numeric / m.participants) end,
        'fixed_share_cents', case when m.participants > 0 then round(m.fixed_share_cents::numeric / m.participants) end,
        'community_cents', case when m.participants > 0
          then round(m.community_cents / m.months / m.participants) end),

      -- One fixed block carries many programmes, so dividing it by seats makes
      -- every participant look equally cheap and hides the only question that
      -- matters early: how many of them there have to be. Two honest readings —
      -- how many seats across all programmes pay for the block, and what this
      -- programme would cost if it were carrying the block alone.
      'leverage', jsonb_build_object(
        'capacity_participants', v_card.fixed_monthly_capacity_participants,
        'breakeven_participants', (
          select case when contribution > 0
            then ceil(v_card.fixed_monthly_cents::numeric / contribution)::int end
          from (select v_price.seat_cents
                  - case when m.participants > 0 then round(m.variable_cents::numeric / m.participants) else 0 end
                  - case when v_price.billing_model = 'bundled' then v_price.community_share_cents else 0 end
                as contribution) c),
        'standalone_cost_cents', m.variable_cents + v_card.fixed_monthly_cents + m.passthrough_cents,
        'standalone_margin_bps', case when m.licence_cents > 0
          then round((m.licence_cents - (m.variable_cents + v_card.fixed_monthly_cents + m.passthrough_cents))
                     * 10000.0 / m.licence_cents) end),

      -- What the money buys the sponsor, which is the reason to pay for a tool
      -- rather than a spreadsheet: facts that can be checked by someone else.
      'evidence', jsonb_build_object(
        'facts', m.facts,
        'proofs', m.proofs,
        'proofs_per_participant', case when m.participants > 0
          then round(m.proofs::numeric / m.participants, 1) end,
        'cost_per_proof_cents', case when m.proofs > 0
          then round(m.empowerfi_cents::numeric / m.proofs) end),

      'borne_by', jsonb_build_object(
        'empowerfi_cents', m.empowerfi_cents,
        'community_cents', m.community_cents,
        'partner_cents', m.partner_cents),

      'rate_card', jsonb_build_object(
        'version', v_card.version, 'source', v_card.source,
        'fixed_monthly_cents', v_card.fixed_monthly_cents,
        'fixed_monthly_capacity_participants', v_card.fixed_monthly_capacity_participants,
        'fixed_monthly_note', v_card.fixed_monthly_note)
    )
    from money m, span s);
end;
$function$

