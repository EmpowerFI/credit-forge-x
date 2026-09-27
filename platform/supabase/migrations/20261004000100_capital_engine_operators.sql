-- Who routes capital, as one named answer.
--
-- The first cut of run_capital_engine() accepted capital_provider and admin.
-- That left out the role that actually does this work: `partner` is EmpowerFI's
-- own P2P desk (ROLE_LABEL calls it that in the product), and routing a
-- qualified opportunity to a third-party product is desk work. A demo operator
-- opening the Capital Network could read every policy and not run the engine.
--
-- Editing a policy stays narrower, and that is the distinction
-- PLAN_CAPITAL_NETWORK §6.4 was asking about: the desk routes, and capital
-- operators and EmpowerFI set the terms it routes under.

create function private.is_capital_operator()
returns boolean language sql stable set search_path = ''
as $$ select coalesce(private.my_role()::text, '') in ('partner', 'capital_provider', 'admin') $$;

create or replace function public.run_capital_engine(p_opportunity_id uuid, p_documents text[] default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_need jsonb;
  v_plan jsonb;
  v_last public.capital_route_decisions;
  v_found boolean;
  v_id uuid;
  v_no integer;
begin
  if not private.capital_network_enabled() then
    raise exception 'capital_network_disabled' using errcode = 'P0001';
  end if;
  -- Routing capital is an operator act. Reading the registry is wider than
  -- this: sponsors and auditors see it, and neither runs the engine.
  if not (select private.is_capital_operator()) then
    raise exception 'not_a_capital_operator' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  -- The network recommends third-party products, so it needs the consent scope
  -- that allows a partner to be involved at all.
  if not private.has_consent(v_opp.entrepreneur_id, 'partner') then
    raise exception 'partner_consent_missing' using errcode = '42501';
  end if;

  if p_documents is not null then
    update public.qualified_credit_opportunities
      set documents_on_file = p_documents where id = p_opportunity_id;
  end if;

  v_need := private.capital_need(p_opportunity_id);
  v_plan := private.match_capital(v_need, private.capital_network_instruments(p_opportunity_id));

  -- Idempotent: the same engine, over the same need, reaching the same answer,
  -- is the same decision. A second run records a row only when something moved.
  select * into v_last from public.capital_route_decisions
    where opportunity_id = p_opportunity_id order by decision_no desc limit 1;
  v_found := found;
  if v_found
     and v_last.engine_version = v_plan ->> 'model_version'
     and v_last.need = v_need
     and v_last.evaluated = v_plan -> 'evaluated'
     and v_last.allocations = v_plan -> 'allocations' then
    return jsonb_build_object('decision_id', v_last.id, 'decision_no', v_last.decision_no,
                              'recorded', false, 'plan', v_plan);
  end if;

  v_no := case when v_found then v_last.decision_no + 1 else 1 end;
  insert into public.capital_route_decisions (
    opportunity_id, decision_no, engine_version, requested_cents, need, evaluated, allocations,
    reason_codes, domestic_coverage_cents, global_coverage_cents, unfunded_cents, status, is_simulated)
  values (
    p_opportunity_id, v_no, v_plan ->> 'model_version', (v_plan ->> 'requested_cents')::bigint,
    v_need, v_plan -> 'evaluated', v_plan -> 'allocations',
    array(select jsonb_array_elements_text(v_plan -> 'reason_codes')),
    (v_plan ->> 'domestic_coverage_cents')::bigint,
    (v_plan ->> 'global_coverage_cents')::bigint,
    (v_plan ->> 'unfunded_cents')::bigint,
    (v_plan ->> 'status')::public.capital_route_status,
    -- Every instrument in this network is invented for the prototype, so every
    -- plan built out of it is simulated too.
    true)
  returning id into v_id;
  return jsonb_build_object('decision_id', v_id, 'decision_no', v_no, 'recorded', true, 'plan', v_plan);
end;
$$;

revoke all on function private.is_capital_operator() from public, anon, authenticated;
grant execute on function private.is_capital_operator() to authenticated, service_role;
