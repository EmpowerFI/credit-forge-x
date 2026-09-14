-- M9 · capital
--
-- A capital provider commits capital to a lending partner and follows the
-- portfolio that capital finances: in aggregate, and loan by loan under a
-- code of the loan's own, never by person. The code is not the one the
-- partner sees, so the two views cannot be joined on it.
--
-- A provider follows the whole portfolio of the partners it funds; a share
-- per provider arrives with the capital rail, not before. For the hackathon
-- the capital is simulated and every figure built on it says so.

create table public.capital_commitments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  partner_id uuid not null references public.partners (id) on delete cascade,
  committed_cents bigint not null check (committed_cents > 0),
  -- What the provider asks of the capital, a year.
  target_return_bps integer not null check (target_return_bps between 0 and 10000),
  currency text not null default 'BRL' check (currency = 'BRL'),
  is_simulated boolean not null default true,
  created_at timestamptz not null default now()
);

create index capital_commitments_provider_idx on public.capital_commitments (provider_id);

alter table public.capital_commitments enable row level security;
revoke all on public.capital_commitments from anon, authenticated;
grant select on public.capital_commitments to authenticated;

create policy capital_commitments_read on public.capital_commitments for select to authenticated using (
  provider_id = (select auth.uid()) or (select private.is_auditor_or_admin())
);

-- The partners the current user funds, if a capital provider.
create function private.my_capital_partners()
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct c.partner_id), '{}')
  from public.capital_commitments c
  where c.provider_id = auth.uid() and private.my_role() = 'capital_provider'
$$;

revoke all on function private.my_capital_partners() from public;
grant execute on function private.my_capital_partners() to authenticated, service_role;

-- Capital providers can audit the loans they finance — terms, status changes
-- and payments — and nothing upstream of the loan: no check-ins, readiness,
-- eligibility or opportunity, which are about the person.
create or replace function private.can_see_anchor(p_kind public.anchor_kind, p_entity_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid;
begin
  if private.is_auditor_or_admin() then
    return true;
  end if;
  if p_kind in ('community', 'community_verification') then
    return coalesce(private.leads_community(p_entity_id) or private.is_member(p_entity_id), false);
  end if;
  if private.my_partner_id() is not null then
    return coalesce(private.anchor_partner(p_kind, p_entity_id) = private.my_partner_id(), false);
  end if;
  if private.my_role() = 'capital_provider' then
    return coalesce(
      p_kind in ('loan', 'loan_transition', 'payment')
        and private.anchor_partner(p_kind, p_entity_id) = any (private.my_capital_partners()),
      false
    );
  end if;
  v_entrepreneur := private.anchor_entrepreneur(p_kind, p_entity_id);
  return coalesce(
    v_entrepreneur = private.my_entrepreneur_id() or private.leads_entrepreneur(v_entrepreneur),
    false
  );
end;
$$;

-- --------------------------------------------------------------- portfolio

-- Expected loss by risk band, a pilot assumption until there is a history to
-- estimate it from.
create function private.expected_loss_bps(p_band public.grade)
returns integer
language sql immutable set search_path = ''
as $$ select case p_band when 'LOW' then 300 when 'MEDIUM' then 700 else 1500 end $$;

create function public.capital_portfolio()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_partners uuid[];
  v_committed bigint;
  v_target integer;
  v_simulated boolean;
  v jsonb;
begin
  if private.is_auditor_or_admin() then
    select array_agg(distinct partner_id), sum(committed_cents),
           round(sum(committed_cents::numeric * target_return_bps) / nullif(sum(committed_cents), 0)),
           coalesce(bool_or(is_simulated), false)
      into v_partners, v_committed, v_target, v_simulated
      from public.capital_commitments;
  elsif private.my_role() = 'capital_provider' then
    select array_agg(distinct partner_id), sum(committed_cents),
           round(sum(committed_cents::numeric * target_return_bps) / nullif(sum(committed_cents), 0)),
           coalesce(bool_or(is_simulated), false)
      into v_partners, v_committed, v_target, v_simulated
      from public.capital_commitments where provider_id = auth.uid();
  else
    raise exception 'not_allowed_to_see_portfolio' using errcode = '42501';
  end if;
  v_partners := coalesce(v_partners, '{}');
  v_committed := coalesce(v_committed, 0);

  with book as (
    select
      l.*, o.risk_band, o.purpose, o.confidence,
      (select count(*) from public.payments p where p.loan_id = l.id)::integer as paid,
      (select coalesce(sum(p.amount_cents), 0) from public.payments p where p.loan_id = l.id) as received_cents,
      (select min(e.created_at) from public.loan_events e where e.loan_id = l.id and e.to_status = 'ACTIVE') as active_since,
      (select m.community_id from public.community_memberships m
        where m.entrepreneur_id = l.entrepreneur_id order by m.joined_at, m.community_id limit 1) as community_id,
      l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') as deployed
    from public.loans l
    join public.qualified_credit_opportunities o on o.id = l.opportunity_id
    where l.partner_id = any (v_partners)
  ),
  priced as (
    select b.*,
      -- A flat instalment repays principal evenly; the rest is interest.
      case when b.deployed then round(b.principal_cents::numeric * least(b.paid, b.term_months) / b.term_months) else 0 end as principal_repaid,
      -- Instalments fall due monthly from the start of repayment.
      case when b.active_since is null then 0
        else least(b.term_months, (
          select count(*) from generate_series(1, b.term_months) n
          where b.active_since + make_interval(months => n) <= now()))::integer
      end as due,
      case when b.active_since is null or b.status <> 'ACTIVE' then false
        else exists (
          select 1 from generate_series(b.paid + 1, b.term_months) n
          where b.active_since + make_interval(months => n) + interval '30 days' < now())
      end as over_30
    from book b
  ),
  sums as (
    select
      count(*) filter (where deployed) as loans,
      coalesce(sum(principal_cents) filter (where deployed), 0) as deployed_cents,
      coalesce(sum(principal_cents) filter (where status = 'PARTNER_APPROVED'), 0) as approved_cents,
      count(*) filter (where status = 'PARTNER_APPROVED') as approved,
      coalesce(sum(received_cents), 0) as received_cents,
      coalesce(sum(principal_repaid), 0) as principal_repaid_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where status in ('DISBURSED', 'ACTIVE')), 0) as outstanding_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where status = 'DEFAULTED'), 0) as defaulted_cents,
      coalesce(sum(principal_cents - principal_repaid) filter (where over_30), 0) as par30_cents,
      coalesce(sum(due), 0) as instalments_due,
      coalesce(sum(least(paid, due)), 0) as instalments_paid_of_due,
      coalesce(sum(paid), 0) as instalments_received,
      coalesce(sum(instalment_cents * term_months - principal_cents) filter (where deployed), 0) as scheduled_interest_cents,
      coalesce(sum(round(principal_cents::numeric * private.expected_loss_bps(risk_band) / 10000)) filter (where deployed), 0) as expected_loss_cents,
      coalesce(sum(principal_cents::numeric * term_months) filter (where deployed), 0) as principal_months
    from priced
  ),
  scope as (
    -- Everyone in the communities the portfolio lends in: the cost of
    -- preparing those who never borrowed belongs to the loans too.
    select distinct m.entrepreneur_id
    from public.community_memberships m
    where m.community_id in (
      select m2.community_id from public.community_memberships m2
      where m2.entrepreneur_id in (select entrepreneur_id from book where deployed))
  ),
  cost as (
    select
      coalesce(sum(ce.amount_cents), 0) as total_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'preparation'), 0) as preparation_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'origination'), 0) as origination_cents,
      coalesce(sum(ce.amount_cents) filter (where ce.phase = 'servicing'), 0) as servicing_cents
    from public.cost_events ce
    where ce.entrepreneur_id in (select entrepreneur_id from scope)
       or ce.community_id in (select m.community_id from public.community_memberships m where m.entrepreneur_id in (select entrepreneur_id from scope))
  ),
  facts as (
    select 'loan'::public.anchor_kind as kind, id from book
    union all select 'loan_transition', e.id from public.loan_events e where e.loan_id in (select id from book)
    union all select 'payment', p.id from public.payments p where p.loan_id in (select id from book)
  ),
  audit as (
    select
      count(*) as facts,
      count(a.id) filter (where a.status = 'confirmed') as confirmed,
      count(a.id) filter (where a.reconcile = 'verified') as reconciled,
      count(a.id) filter (where a.reconcile in ('missing', 'mismatch')) as discrepancies
    from facts f
    left join public.chain_anchors a on a.kind = f.kind and a.entity_id = f.id
  )
  select jsonb_build_object(
    'is_simulated', v_simulated,
    'committed_cents', v_committed,
    'target_return_bps', v_target,
    'deployed_cents', s.deployed_cents,
    'available_cents', greatest(0, v_committed - s.deployed_cents + s.principal_repaid_cents),
    'approved_not_disbursed_cents', s.approved_cents,
    'approved_not_disbursed', s.approved,
    'received_cents', s.received_cents,
    'principal_repaid_cents', s.principal_repaid_cents,
    'outstanding_cents', s.outstanding_cents,
    'defaulted_cents', s.defaulted_cents,
    'loans', s.loans,
    'average_ticket_cents', case when s.loans > 0 then round(s.deployed_cents::numeric / s.loans) end,
    'repayment', jsonb_build_object(
      'instalments_received', s.instalments_received,
      'instalments_due', s.instalments_due,
      'on_time_bps', case when s.instalments_due > 0 then round(s.instalments_paid_of_due * 10000.0 / s.instalments_due) end,
      'par30_cents', s.par30_cents,
      'par30_bps', case when s.outstanding_cents > 0 then round(s.par30_cents * 10000.0 / s.outstanding_cents) else 0 end
    ),
    'expected', jsonb_build_object(
      'interest_cents', s.scheduled_interest_cents,
      'loss_cents', s.expected_loss_cents,
      'net_cents', s.scheduled_interest_cents - s.expected_loss_cents,
      -- Net return a year on the capital deployed, over the loans' terms.
      'net_return_bps_year', case when s.principal_months > 0
        then round((s.scheduled_interest_cents - s.expected_loss_cents) * 120000.0 / s.principal_months) end,
      'loss_bps_by_band', jsonb_build_object('LOW', private.expected_loss_bps('LOW'), 'MEDIUM', private.expected_loss_bps('MEDIUM'), 'HIGH', private.expected_loss_bps('HIGH'))
    ),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from book group by status) x),
    'by_risk', (
      select coalesce(jsonb_object_agg(risk_band, jsonb_build_object('loans', n, 'principal_cents', cents)), '{}')
      from (select risk_band, count(*) n, sum(principal_cents) cents from book where deployed group by risk_band) x
    ),
    'by_purpose', (
      select coalesce(jsonb_object_agg(purpose, jsonb_build_object('loans', n, 'principal_cents', cents)), '{}')
      from (select purpose, count(*) n, sum(principal_cents) cents from book where deployed group by purpose) x
    ),
    'by_community', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'city', c.city, 'state', c.state,
        'verified', c.status = 'verified', 'loans', x.n, 'principal_cents', x.cents) order by x.cents desc), '[]')
      from (select community_id, count(*) n, sum(principal_cents) cents from book where deployed group by community_id) x
      join public.communities c on c.id = x.community_id
    ),
    'cost', jsonb_build_object(
      'total_cents', c.total_cents,
      'by_phase', jsonb_build_object('preparation', c.preparation_cents, 'origination', c.origination_cents, 'servicing', c.servicing_cents),
      'per_loan_cents', case when s.loans > 0 then round(c.total_cents::numeric / s.loans) end,
      'per_1000_deployed_cents', case when s.deployed_cents > 0 then round(c.total_cents * 100000.0 / s.deployed_cents) end
    ),
    'audit', jsonb_build_object('facts', a.facts, 'confirmed', a.confirmed, 'reconciled', a.reconciled, 'discrepancies', a.discrepancies),
    'book', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'loan_id', p.id,
        'code', 'L-' || upper(substr(encode(extensions.digest('loan:' || p.id::text, 'sha256'), 'hex'), 1, 6)),
        'status', p.status, 'principal_cents', p.principal_cents, 'term_months', p.term_months,
        'rate_bps', p.rate_bps, 'instalment_cents', p.instalment_cents, 'paid', p.paid,
        'risk_band', p.risk_band, 'purpose', p.purpose,
        'community_name', (select c.name from public.communities c where c.id = p.community_id),
        'disbursed_at', private.iso(p.disbursed_at), 'over_30', p.over_30
      ) order by p.created_at desc), '[]')
      from priced p
    )
  ) into v
  from sums s, cost c, audit a;

  return v;
end;
$$;

revoke all on function public.capital_portfolio() from public, anon;
grant execute on function public.capital_portfolio() to authenticated;

-- ------------------------------------------------------------- demo reset

create or replace function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;

  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  delete from public.payments where true;
  delete from public.loan_events where true;
  delete from public.loans where true;
  delete from public.partner_decisions where true;
  delete from public.qualified_credit_opportunities where true;
  delete from public.eligibility_assessments where true;
  delete from public.credit_intents where true;
  delete from public.readiness_assessments where true;
  delete from public.checkins where true;
  delete from public.education_progress where true;
  delete from public.education_programs where true;

  delete from public.communities where true;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32) where true;
  -- Deleting facts left their triggers' costs behind: clear them after too.
  delete from public.cost_events where true;

  return jsonb_build_object('anchors', v_anchors, 'communities', v_communities, 'entrepreneurs', v_entrepreneurs);
end;
$$;
