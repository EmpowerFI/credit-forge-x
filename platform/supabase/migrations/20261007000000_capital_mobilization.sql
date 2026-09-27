-- Cost to Mobilize Capital (CTM) — addendum v2 §7, §8.
--
-- What it costs to bring international capital into reais, itemised, beside what
-- it costs to serve the loan. §8 states the purpose plainly: the demo must never
-- imply that cheap blockchain settlement eliminates the operational cost of
-- small loans. Two measured numbers next to each other do that; one number does
-- not.
--
--   public.capital_mobilization_rates          the operational side, versioned
--   private.mobilization_quote(opp, cents)     the market side, already priced
--   private.capital_mobilization(opp, cents)   CTM itemised, and the hedge beside it
--   public.capital_mobilization_summary(prog)  the portfolio, from the snapshots
--   public.opportunity_economics(opp)          now carries CTM next to CTS
--
-- Three decisions written into this, from PLAN_CAPITAL_NETWORK_V2 §6.1:
--
--   CTM is what is paid to move the money — ramp, network, compliance, wallet,
--   settlement. The FX hedge is a required return on currency risk, not a fee
--   paid to a rail, so it is reported *beside* CTM under cost of capital. §7
--   itself says to keep investor required return out of CTM, and summing a
--   per-operation cost with a per-year one produces a rate whose unit is half of
--   each and means nothing.
--
--   The ramp's cost is included even while the ramp is a sandbox, marked as
--   sandbox, and never blended with a simulated assumption. Every line of CTM
--   carries its own provenance.
--
--   No FX is computed here. The market side arrives from private.settle_route(),
--   which is the one place in this database allowed to price a conversion.
--
-- And one deviation from the plan, which said to put the mobilisation stages on
-- cost_stage with phase = 'mobilization'. On inspection `cost_rates.phase` is a
-- reporting label, not a boundary: public.operating_economics() lists *every*
-- stage the card prices, including stages nothing has reached yet, and
-- public.cost_sensitivity() models every rate on the card. A mobilisation rate
-- placed there would appear inside cost to serve by default, and every future
-- reader would have to remember to exclude it. §7's rule deserves better than a
-- convention, so CTM's rates live in their own table, versioned by the same rate
-- card. Cost to serve cannot absorb them because it cannot see them.

-- --------------------------------------------------------- the operational side

create table public.capital_mobilization_rates (
  card_version text not null references public.cost_rate_cards (version),
  -- The stages of §7, as text rather than on cost_stage: a value on that enum
  -- would be recordable against a person, and mobilising capital is an operation
  -- on capital, not a step in anybody's journey.
  stage text not null check (stage in ('compliance_kyb', 'wallet_infrastructure', 'capital_mobilization')),
  staff_minutes integer not null check (staff_minutes >= 0),
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  fixed_cents integer not null check (fixed_cents >= 0),
  note text not null,
  primary key (card_version, stage)
);

comment on table public.capital_mobilization_rates is
  'What one mobilisation of capital costs to operate, by rate card. Deliberately not cost_rates: cost to serve must not be able to sum these (addendum v2 §7).';

alter table public.capital_mobilization_rates enable row level security;
revoke all on public.capital_mobilization_rates from anon, authenticated;
grant select on public.capital_mobilization_rates to authenticated;
create policy capital_mobilization_rates_read on public.capital_mobilization_rates
  for select to authenticated using (true);

-- The pilot card's assumptions, per mobilisation of one slice. Amortising them
-- over a fund's lifetime would be a claim this project cannot support, so each
-- is stated per operation and the note says so.
insert into public.capital_mobilization_rates (card_version, stage, staff_minutes, hourly_rate_cents, fixed_cents, note) values
  ('pilot-2026.09', 'compliance_kyb', 45, 4500, 0,
   'KYB and sanctions checks on the provider and the counterparty, once per mobilisation. Desk rate.'),
  ('pilot-2026.09', 'wallet_infrastructure', 0, 4500, 300,
   'Custody, account and network operations for one mobilisation, stated even where a provider sponsors them.'),
  ('pilot-2026.09', 'capital_mobilization', 20, 4500, 0,
   'Reconciling the tranche: the vault release, the legs and the confirmation. Desk rate.');

-- ------------------------------------------------------------------ provenance

-- The third question of v2 §12. REALITY answers "is this rail real?" and the
-- data legend answers "who may see this, and is it proven?". This answers "was
-- this measured, given to us, assumed, or quoted from a paper?" — and the four
-- values are kept apart from both, as PLAN_CAPITAL_NETWORK_V2 §3.5 argues.
create function private.provenance_values()
returns text[] language sql immutable set search_path = ''
as $$ select array['observed', 'partner_provided', 'simulated', 'benchmark'] $$;

-- A rate card says whether its numbers are assumptions or measurements.
create function private.cost_provenance(p_card_source text)
returns text language sql immutable set search_path = ''
as $$ select case when p_card_source = 'observed' then 'observed' else 'simulated' end $$;

-- A quote a provider's sandbox actually returned was given to us; a seeded rate
-- card was not. Never the same mark.
create function private.quote_provenance(p_reality text)
returns text language sql immutable set search_path = ''
as $$ select case when p_reality in ('sandbox', 'devnet', 'test') then 'partner_provided' else 'simulated' end $$;

-- -------------------------------------------------------------- the market side

-- The quote that delivers `p_cents` in reais, from the comparator that already
-- prices it. The route the comparator chose, or the direct one to report a cost
-- with when it chose none: an expired quote still says what a conversion costs,
-- it just cannot be executed, and CTM is a cost question.
create function private.mobilization_quote(p_opportunity_id uuid, p_cents bigint, p_now timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fx integer := private.demo_brl_per_usdc_milli();
  v_gross bigint;
  v_result jsonb;
  v_quote jsonb;
begin
  if p_cents is null or p_cents <= 0 then return null; end if;
  -- The gross whose net is the amount asked for, priced off the direct card, and
  -- the gross both routes are then compared at — as settle_route takes one.
  v_gross := private.settlement_gross_for_cents(p_cents, v_fx, private.settlement_card('direct_usdc_pix'));
  if v_gross is null then return null; end if;
  v_result := private.settle_route(v_gross, p_cents, p_now,
                private.settlement_requests(p_opportunity_id, p_now));
  select q into v_quote from jsonb_array_elements(v_result -> 'quotes') as t(q)
   where q ->> 'route' = coalesce(v_result ->> 'selected', 'direct_usdc_pix');
  if v_quote is null then return null; end if;
  return v_quote || jsonb_build_object('selected', v_result ->> 'selected' is not null);
end;
$$;

-- Day 1's reader, now derived from the one above so the decision engine and the
-- cost model can never disagree about a conversion.
create or replace function private.global_mobilization_quote(p_opportunity_id uuid, p_gap_cents bigint, p_now timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_quote jsonb := private.mobilization_quote(p_opportunity_id, p_gap_cents, p_now);
begin
  if v_quote is null then
    return jsonb_build_object('quoted_mobilization_bps', 0, 'settlement_feasible', false,
                              'settlement_reality', 'simulated', 'settlement_route', null);
  end if;
  return jsonb_build_object(
    'quoted_mobilization_bps', coalesce((v_quote ->> 'cost_bps')::integer, 0),
    'settlement_feasible', (v_quote ->> 'selected')::boolean,
    'settlement_reality', coalesce(v_quote ->> 'reality', 'simulated'),
    'settlement_route', case when (v_quote ->> 'selected')::boolean then v_quote ->> 'route' end);
end;
$$;

-- ------------------------------------------------------------------------- CTM

-- CTM for one opportunity, itemised: what was paid to operate the mobilisation,
-- what was paid to the rails, and the hedge beside them rather than inside them.
--
-- p_cents overrides what was mobilised, so a screen can price a gap that has not
-- been funded yet. Left null it is what actually funds her: the global pool's
-- whole ticket where that is what funds her, otherwise what the network's last
-- plan asked a global route to take.
create function private.capital_mobilization(p_opportunity_id uuid, p_cents bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_card public.cost_rate_cards;
  v_pool public.funding_pools;
  v_cents bigint;
  v_at timestamptz;
  v_quote jsonb;
  v_ops jsonb;
  v_ops_total bigint := 0;
  v_market_total bigint := 0;
begin
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  v_cents := coalesce(
    p_cents,
    case when v_opp.funding_pool = 'global' then v_opp.amount_cents end,
    (select d.global_coverage_cents from public.capital_route_decisions d
      where d.opportunity_id = p_opportunity_id order by d.decision_no desc limit 1),
    0);
  v_at := coalesce(v_opp.allocated_at, v_opp.created_at, now());
  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(v_at);
  select * into v_pool from public.funding_pools where pool = 'global';

  -- Nothing mobilised, nothing spent mobilising it. Listing the card's stages
  -- here would put a cost beside a ticket that never crossed a border.
  if v_cents <= 0 then
    v_ops := '[]'::jsonb;
    v_ops_total := 0;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
             'stage', r.stage,
             'staff_minutes', r.staff_minutes,
             'cents', round(r.staff_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents,
             'note', r.note,
             'provenance', private.cost_provenance(v_card.source)) order by r.stage), '[]'::jsonb),
           coalesce(sum(round(r.staff_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents), 0)::bigint
      into v_ops, v_ops_total
      from public.capital_mobilization_rates r where r.card_version = v_card.version;
  end if;

  v_quote := private.mobilization_quote(p_opportunity_id, v_cents, v_at);
  if v_quote is not null then
    v_market_total := (v_quote ->> 'total_cost_cents')::bigint;
  end if;

  return jsonb_build_object(
    'model_version', 'capital-mobilization-v1.0.0',
    'mobilized_cents', v_cents,
    -- Operating one mobilisation: assumptions until the pilot measures them.
    'operating', jsonb_build_object(
      'stages', v_ops,
      'total_cents', v_ops_total,
      'provenance', private.cost_provenance(v_card.source)),
    -- Paid to the rails, from the comparator. Null where no rail could price it.
    'market', case when v_quote is null then null else jsonb_build_object(
      'route', v_quote ->> 'route',
      'provider', v_quote ->> 'provider',
      'executable', (v_quote ->> 'selected')::boolean,
      'fx_cost_cents', (v_quote ->> 'fx_cost_cents')::bigint,
      'provider_fee_cents', (v_quote ->> 'provider_fee_cents')::bigint,
      'network_fee_cents', (v_quote ->> 'network_fee_cents')::bigint,
      'total_cents', (v_quote ->> 'total_cost_cents')::bigint,
      'cost_bps', (v_quote ->> 'cost_bps')::integer,
      'reality', v_quote ->> 'reality',
      'provenance', private.quote_provenance(v_quote ->> 'reality')) end,
    'total_cents', v_ops_total + v_market_total,
    -- §10's CTM Rate: what was paid to move the money, over the money moved.
    -- One unit, because nothing per-year was added to it. Reported once: basis
    -- points of the principal and centavos per R$ 100 are the same integer, and
    -- two keys holding it would invite a screen to show it as two facts.
    'rate_bps', case when v_cents > 0 then round((v_ops_total + v_market_total) * 10000.0 / v_cents)::integer end,
    -- Beside CTM, never inside it. A hedge is a required return on currency
    -- risk, and §7 keeps required return out of CTM.
    'cost_of_capital', jsonb_build_object(
      'fx_hedge_bps_year', coalesce(v_pool.fx_hedge_bps, 0),
      'in_ctm', false,
      'note', 'A hedge is a required return on currency risk carried over the loan''s life, not a fee paid to a rail. It is priced into her rate by the pool engine and reported here beside CTM, never summed into it.'),
    'rate_card', jsonb_build_object('version', v_card.version, 'source', v_card.source));
end;
$$;

-- ------------------------------------------------------- what the snapshot keeps

-- CTM at the moment the opportunity opened for funding, so the portfolio is a
-- sum of integers rather than a call per opportunity. Null for a domestic
-- opportunity: nothing was mobilised, which is not the same as nothing costing.
alter table public.operating_economics_snapshots
  add column mobilization_cents bigint check (mobilization_cents >= 0),
  add column mobilization_rate_bps integer check (mobilization_rate_bps >= 0),
  add column mobilized_cents bigint check (mobilized_cents >= 0);

comment on column public.operating_economics_snapshots.mobilization_cents is
  'What mobilising this ticket cost, at the instant it opened for funding: operations plus rails, hedge excluded. Null where the ticket is funded domestically.';

create or replace function private.snapshot_opportunity_economics() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v jsonb;
  v_ctm jsonb;
begin
  if new.allocated_at is not null and (tg_op = 'INSERT' or old.allocated_at is null) then
    v := private.journey_costs(new.entrepreneur_id, new.allocated_at);
    -- Cost to serve and cost to mobilize, in one row and never added together.
    v_ctm := case when new.funding_pool = 'global'
      then private.capital_mobilization(new.id, new.amount_cents) end;
    insert into public.operating_economics_snapshots (
      opportunity_id, taken_at, ticket_cents, cost_total_cents, staff_minutes, events,
      by_phase, by_stage, per_100_of_ticket_cents, rate_card_version, allocation_model_version,
      mobilization_cents, mobilization_rate_bps, mobilized_cents
    ) values (
      new.id, new.allocated_at, new.amount_cents,
      (v ->> 'total_cents')::bigint, (v ->> 'staff_minutes')::integer, (v ->> 'events')::integer,
      v -> 'by_phase', v -> 'by_stage',
      case when new.amount_cents > 0 then round((v ->> 'total_cents')::numeric * 10000 / new.amount_cents) end,
      private.rate_card_at(new.allocated_at), new.allocation_model_version,
      (v_ctm ->> 'total_cents')::bigint, (v_ctm ->> 'rate_bps')::integer, (v_ctm ->> 'mobilized_cents')::bigint
    )
    on conflict (opportunity_id) do nothing;
  end if;
  return new;
end;
$$;

-- The opportunities already funded globally get the same three numbers the
-- trigger would have written.
update public.operating_economics_snapshots s
set mobilization_cents = (m.j ->> 'total_cents')::bigint,
    mobilization_rate_bps = (m.j ->> 'rate_bps')::integer,
    mobilized_cents = (m.j ->> 'mobilized_cents')::bigint
from public.qualified_credit_opportunities o
cross join lateral (select private.capital_mobilization(o.id, o.amount_cents) as j) m
where o.id = s.opportunity_id and o.funding_pool = 'global';

-- ------------------------------------------------------------------- reading it

-- The portfolio, from the snapshots: what was mobilised, what mobilising it
-- cost, and the rate. Cost to serve is public.operating_economics() and stays
-- exactly where it was — the page shows both, and §8's whole point is that
-- neither hides the other.
create function public.capital_mobilization_summary(p_program_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_card public.cost_rate_cards;
  v_pool public.funding_pools;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());
  select * into v_pool from public.funding_pools where pool = 'global';

  return (
    with communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    people as materialized (
      select distinct m.entrepreneur_id from public.community_memberships m
      where m.community_id in (select id from communities)
    ),
    mobilised as (
      select s.* from public.operating_economics_snapshots s
      join public.qualified_credit_opportunities o on o.id = s.opportunity_id
      where s.mobilization_cents is not null
        and (p_program_id is null or o.entrepreneur_id in (select entrepreneur_id from people))
    ),
    -- The gaps the global question found eligible but nothing has funded yet:
    -- §10's Eligible External Capital Gap, over the same scope.
    gaps as (
      select coalesce(sum(d.eligible_gap_cents), 0)::bigint as cents, count(*)::int as decisions
      from public.capital_route_decisions d
      join public.qualified_credit_opportunities o on o.id = d.opportunity_id
      where d.eligible_gap_cents > 0
        and (p_program_id is null or o.entrepreneur_id in (select entrepreneur_id from people))
        and d.decision_no = (select max(x.decision_no) from public.capital_route_decisions x
                             where x.opportunity_id = d.opportunity_id)
    )
    select jsonb_build_object(
      'model_version', 'capital-mobilization-v1.0.0',
      'scope', jsonb_build_object('program_id', p_program_id),
      'tickets', (select count(*)::int from mobilised),
      'mobilized_cents', (select coalesce(sum(mobilized_cents), 0)::bigint from mobilised),
      'cost_cents', (select coalesce(sum(mobilization_cents), 0)::bigint from mobilised),
      -- CTM over capital actually mobilised. One unit: nothing per-year is in it.
      'rate_bps', (select case when coalesce(sum(mobilized_cents), 0) > 0
                    then round(sum(mobilization_cents) * 10000.0 / sum(mobilized_cents))::integer end from mobilised),
      'eligible_gap_cents', (select cents from gaps),
      'eligible_gap_decisions', (select decisions from gaps),
      'cost_of_capital', jsonb_build_object(
        'fx_hedge_bps_year', coalesce(v_pool.fx_hedge_bps, 0),
        'in_ctm', false),
      'rate_card', jsonb_build_object('version', v_card.version, 'source', v_card.source),
      'provenance', private.cost_provenance(v_card.source))
  );
end;
$$;

-- One opportunity: cost to serve as it was, and CTM beside it. §8's purpose in
-- one payload, so no screen can show one without the other.
create or replace function public.opportunity_economics(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  o public.qualified_credit_opportunities;
  v_role text := coalesce(private.my_role()::text, '');
  v_program uuid;
  v_prog jsonb;
  v_now jsonb;
begin
  select * into o from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  if v_role not in ('partner', 'admin', 'auditor') then
    select p.id into v_program
    from public.programs p
    join public.program_communities pc on pc.program_id = p.id
    where p.sponsor_id = private.my_sponsor_id()
      and pc.community_id in (select community_id from public.community_memberships where entrepreneur_id = o.entrepreneur_id)
    limit 1;
    if v_program is null then
      raise exception 'not_allowed_to_see_costs' using errcode = '42501';
    end if;
  end if;

  v_now := private.journey_costs(o.entrepreneur_id, now());
  v_prog := public.operating_economics(v_program);

  return jsonb_build_object(
    'opportunity', jsonb_build_object(
      'id', o.id,
      'ticket_cents', o.amount_cents,
      'allocated_at', private.iso(o.allocated_at),
      'allocation_model_version', o.allocation_model_version),
    'so_far', v_now || jsonb_build_object(
      'per_100_of_ticket_cents',
      case when o.amount_cents > 0 then round((v_now ->> 'total_cents')::numeric * 10000 / o.amount_cents) end),
    'at_allocation', (
      select to_jsonb(s) - 'opportunity_id' - 'created_at'
      from public.operating_economics_snapshots s where s.opportunity_id = o.id),
    -- What it costs to bring the money in, never added to what it costs to
    -- serve the loan. Null where nothing crosses a border.
    'mobilization', case when o.funding_pool = 'global'
      then private.capital_mobilization(o.id) end,
    'programme', jsonb_build_object(
      'program_id', v_program,
      'per_100_disbursed_cents', v_prog #> '{cost,per_100_disbursed_cents}',
      'credit_per_100_disbursed_cents', v_prog #> '{cost,credit_per_100_disbursed_cents}',
      'participants', v_prog #> '{scope,participants}',
      'loans', v_prog #> '{cost,loans}',
      'disbursed_cents', v_prog #> '{cost,disbursed_cents}',
      'rate_card', v_prog #> '{cost,rate_card}')
  );
end;
$$;

-- ---------------------------------------------------------------------- grants

revoke all on function
  private.provenance_values(), private.cost_provenance(text), private.quote_provenance(text),
  private.mobilization_quote(uuid, bigint, timestamptz),
  private.capital_mobilization(uuid, bigint)
  from public, anon, authenticated;
grant execute on function
  private.provenance_values(), private.cost_provenance(text), private.quote_provenance(text),
  private.mobilization_quote(uuid, bigint, timestamptz),
  private.capital_mobilization(uuid, bigint)
  to service_role;

revoke all on function public.capital_mobilization_summary(uuid) from public, anon;
grant execute on function public.capital_mobilization_summary(uuid) to authenticated;
