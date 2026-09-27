-- The capital plan, where the people it concerns can read it.
--
-- Day 4 gave the operator a screen. This is everyone else's: the woman whose
-- request it is, the leader of her community, the desk that would refer it, the
-- investor deciding whether to fund what local capital could not, the sponsor
-- and the auditor.
--
-- It cannot be a table read. capital_route_decisions holds instrument *codes*,
-- and an entrepreneur may not read capital_instruments — the registry is the
-- policy of every provider in the network, and she is shown the routes
-- recommended for her, not that. A snapshot nobody is allowed to resolve is a
-- broken snapshot, so public.capital_plan() resolves exactly the instruments
-- that appear in her decision, and nothing else about the network.

-- ------------------------------------------- what policy the decision ran under

-- The decision already recorded its engine version and the need it ran against.
-- It did not record the policy version of each instrument it evaluated, so a
-- recommendation read six weeks later could not be told apart from one made
-- under a ticket range that has since moved. That is exactly what
-- capital_instruments.policy_version exists for.
alter table public.capital_route_decisions
  add column instrument_policy jsonb not null default '{}'::jsonb;

comment on column public.capital_route_decisions.instrument_policy is
  'code → policy_version of every instrument this run evaluated.';

-- ---------------------------------------------------------- running it, again

-- Third revision, and the only changes are the policy snapshot and its place in
-- the idempotency test. Re-running under a policy that has moved records a new
-- decision even when the answer is unchanged: "re-confirmed under policy 2" is
-- a different fact from "decided under policy 1", and a row that claimed the
-- second while holding the first would be the kind of quiet drift this table
-- exists to prevent.
create or replace function public.run_capital_engine(p_opportunity_id uuid, p_documents text[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_need jsonb;
  v_instruments jsonb;
  v_policy jsonb;
  v_plan jsonb;
  v_last public.capital_route_decisions;
  v_found boolean;
  v_id uuid;
  v_no integer;
begin
  if not private.capital_network_enabled() then
    raise exception 'capital_network_disabled' using errcode = 'P0001';
  end if;
  if not (select private.is_capital_operator()) then
    raise exception 'not_a_capital_operator' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if not private.has_consent(v_opp.entrepreneur_id, 'partner') then
    raise exception 'partner_consent_missing' using errcode = '42501';
  end if;

  if p_documents is not null then
    update public.qualified_credit_opportunities
      set documents_on_file = p_documents where id = p_opportunity_id;
  end if;

  v_need := private.capital_need(p_opportunity_id);
  v_instruments := private.capital_network_instruments(p_opportunity_id);
  v_plan := private.match_capital(v_need, v_instruments);

  select coalesce(jsonb_object_agg(i.code, i.policy_version), '{}'::jsonb) into v_policy
  from public.capital_instruments i
  where i.code in (select jsonb_array_elements(v_instruments) ->> 'id');

  select * into v_last from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  v_found := found;
  if v_found
     and v_last.engine_version = v_plan ->> 'model_version'
     and v_last.need = v_need
     and v_last.instrument_policy = v_policy
     and v_last.evaluated = v_plan -> 'evaluated'
     and v_last.allocations = v_plan -> 'allocations' then
    return jsonb_build_object('decision_id', v_last.id, 'decision_no', v_last.decision_no,
                              'recorded', false, 'plan', v_plan);
  end if;

  v_no := case when v_found then v_last.decision_no + 1 else 1 end;
  insert into public.capital_route_decisions (
    opportunity_id, decision_no, engine_version, requested_cents, need, instrument_policy,
    evaluated, allocations, reason_codes, domestic_coverage_cents, global_coverage_cents,
    unfunded_cents, status, is_simulated)
  values (
    p_opportunity_id, v_no, v_plan ->> 'model_version', (v_plan ->> 'requested_cents')::bigint,
    v_need, v_policy, v_plan -> 'evaluated', v_plan -> 'allocations',
    array(select jsonb_array_elements_text(v_plan -> 'reason_codes')),
    (v_plan ->> 'domestic_coverage_cents')::bigint,
    (v_plan ->> 'global_coverage_cents')::bigint,
    (v_plan ->> 'unfunded_cents')::bigint,
    (v_plan ->> 'status')::public.capital_route_status,
    true)
  returning id into v_id;
  return jsonb_build_object('decision_id', v_id, 'decision_no', v_no, 'recorded', true, 'plan', v_plan);
end;
$$;

-- --------------------------------------------------------------- reading it

-- The latest plan for one opportunity, with the routes in it named, for anyone
-- the decision's own row-level policy lets read it. Returns null where the
-- engine has not run.
create function public.capital_plan(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_d public.capital_route_decisions;
  v_allowed boolean;
begin
  -- The same answer capital_route_decisions_read gives, asked before the
  -- definer's rights take row-level security out of the way.
  select
    (select private.is_auditor_or_admin())
    or coalesce((select private.my_role()::text), '') in ('partner', 'sponsor', 'capital_provider')
    or exists (
      select 1 from public.qualified_credit_opportunities o
      where o.id = p_opportunity_id
        and (o.entrepreneur_id = (select private.my_entrepreneur_id())
             or (select private.leads_entrepreneur(o.entrepreneur_id))))
  into v_allowed;
  if not coalesce(v_allowed, false) then
    raise exception 'not_allowed_to_see_this_plan' using errcode = '42501';
  end if;

  select * into v_d from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  if not found then return null; end if;

  return jsonb_build_object(
    'decision_id', v_d.id,
    'decision_no', v_d.decision_no,
    'decided_at', private.iso(v_d.decided_at),
    'is_simulated', v_d.is_simulated,
    'instrument_policy', v_d.instrument_policy,
    -- The plan in the engine's own CapitalPlan shape, so the browser renders a
    -- stored decision and a fresh run with one component.
    'plan', jsonb_build_object(
      'model_version', v_d.engine_version,
      'evaluated', v_d.evaluated,
      'allocations', v_d.allocations,
      'reason_codes', to_jsonb(v_d.reason_codes),
      'requested_cents', v_d.requested_cents,
      'domestic_coverage_cents', v_d.domestic_coverage_cents,
      'global_coverage_cents', v_d.global_coverage_cents,
      'unfunded_cents', v_d.unfunded_cents,
      'external_capital_gap_cents', v_d.external_capital_gap_cents,
      'status', v_d.status),
    -- Only the instruments this decision names, and only what a route card
    -- shows. Never the policy behind them.
    'instruments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', i.code, 'name', i.name, 'instrument_type', i.instrument_type,
        'is_domestic', i.is_domestic, 'is_credit', i.is_credit,
        'provider', p.display_name) order by i.code), '[]'::jsonb)
      from public.capital_instruments i
      join public.capital_providers p on p.id = i.provider_id
      where i.code in (select e ->> 'instrument_id' from jsonb_array_elements(v_d.evaluated) as t(e))));
end;
$$;

revoke all on function public.capital_plan(uuid) from public, anon;
grant execute on function public.capital_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- the payload

-- What a capital plan would commit to on chain.
--
-- It ships defined and readable, and nothing queues it. A proof kind needs its
-- own instruction in programs/empowerfi-audit and an upgrade of the devnet
-- program; queueing an anchor no program can accept would put a job that fails
-- for good behind every plan. So this is the payload alone, reviewable now, and
-- the program work is the only thing left when the proof is wanted — at which
-- point private.anchor_payload() delegates to it, private.anchor_entrepreneur()
-- and private.anchor_partner() gain their branch, and a trigger queues it off
-- the opportunity's own anchor.
--
-- Until then a plan is auditable the way it already is, and not weakly: a
-- versioned decision holding the need, the engine version, the policy version
-- of every instrument it evaluated and the whole evaluated trace — enough for
-- anyone allowed to see it to re-run the engine and get the same answer.
create function private.capital_route_payload(p_decision_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  -- The decision as the engine wrote it: need, allocations and coverage
  -- verbatim rather than re-read, so a commitment recomputed in the browser
  -- matches the one that was sent. The evaluated trace is left out and the
  -- policy versions are in, because the need, the engine version and those
  -- versions are what reproduce the trace.
  select jsonb_build_object(
    'decision_id', d.id, 'opportunity_id', d.opportunity_id, 'opportunity_no', o.opportunity_no,
    'decision_no', d.decision_no, 'engine_version', d.engine_version,
    'instrument_policy', d.instrument_policy, 'need', d.need,
    'requested_cents', d.requested_cents, 'allocations', d.allocations,
    'reason_codes', to_jsonb(d.reason_codes),
    'domestic_coverage_cents', d.domestic_coverage_cents,
    'global_coverage_cents', d.global_coverage_cents,
    'unfunded_cents', d.unfunded_cents,
    'external_capital_gap_cents', d.external_capital_gap_cents,
    'status', d.status, 'decided_at', private.iso(d.decided_at))
  from public.capital_route_decisions d
  join public.qualified_credit_opportunities o on o.id = d.opportunity_id
  where d.id = p_decision_id
$$;

revoke all on function private.capital_route_payload(uuid) from public, anon, authenticated;
grant execute on function private.capital_route_payload(uuid) to service_role;
