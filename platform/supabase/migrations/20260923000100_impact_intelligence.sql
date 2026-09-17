-- Impact Intelligence (refactor spec §4, 16 Sep).
--
-- A sponsor (a company's ESG programme, a foundation, an impact fund) funds a
-- programme that communities execute. What the sponsor buys is evidence: what
-- happened to the businesses it reached, and that it can be verified. The same
-- longitudinal data qualifies credit, so the sponsor also sees the capital its
-- programme mobilised and what that capital did.
--
-- impact_intelligence() reads it for one programme, over the communities that
-- execute it, from the same per-member state the community workspace reads:
--   * aggregates only: never a name, a business, a figure she reported or a
--     person's id;
--   * breakdowns (segments) hide any group under five, so a small group cannot
--     single a business out;
--   * outcomes count only businesses that consented to impact reporting; the
--     rest are reported as withheld;
--   * opportunities are listed by Q- code only when she consented to show
--     investors, and can be opened in the Credit & Capital Engine;
--   * evidence counts the proofs behind the programme on Solana, by kind.
--
-- Programme funding is what the sponsor reports; in the demo it is simulated.

create type public.sponsor_kind as enum ('company', 'foundation', 'impact_fund');

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  kind public.sponsor_kind not null,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column sponsor_id uuid references public.sponsors (id);
-- A sponsor user always acts for one sponsor; nobody else acts for any.
alter table public.profiles add constraint sponsor_users_have_a_sponsor
  check ((role = 'sponsor') = (sponsor_id is not null));

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 500),
  period_start date not null,
  period_end date not null,
  funding_committed_cents bigint not null check (funding_committed_cents >= 0),
  funding_deployed_cents bigint not null default 0,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sponsor_id, name),
  constraint program_period_is_ordered check (period_end >= period_start),
  constraint program_deploys_what_it_commits check (funding_deployed_cents between 0 and funding_committed_cents)
);

create table public.program_communities (
  program_id uuid not null references public.programs (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  primary key (program_id, community_id)
);

create index program_communities_community_idx on public.program_communities (community_id);

create function private.my_sponsor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select sponsor_id from public.profiles where id = auth.uid() $$;

-- The programme's sponsor, the leaders of the communities executing it, auditors and admins.
create function private.can_see_program(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.is_auditor_or_admin(), false)
    or exists (select 1 from public.programs p where p.id = p_program_id and p.sponsor_id = private.my_sponsor_id())
    or exists (select 1 from public.program_communities pc where pc.program_id = p_program_id and private.leads_community(pc.community_id))
$$;

-- The sponsor itself, or a sponsor whose programme one can see.
create function private.can_see_sponsor(p_sponsor_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_sponsor_id = private.my_sponsor_id()
    or exists (select 1 from public.programs p where p.sponsor_id = p_sponsor_id and private.can_see_program(p.id))
$$;

-- An entrepreneur a programme of my sponsor reaches.
create function private.sponsor_reaches(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.community_memberships m
    join public.program_communities pc on pc.community_id = m.community_id
    join public.programs p on p.id = pc.program_id
    where m.entrepreneur_id = p_entrepreneur_id and m.status = 'active' and p.sponsor_id = private.my_sponsor_id()
  )
$$;

alter table public.sponsors enable row level security;
alter table public.programs enable row level security;
alter table public.program_communities enable row level security;
revoke all on public.sponsors, public.programs, public.program_communities from anon, authenticated;
grant select on public.sponsors, public.programs, public.program_communities to authenticated;

create policy sponsors_read on public.sponsors for select to authenticated using ((select private.can_see_sponsor(id)));
create policy programs_read on public.programs for select to authenticated using ((select private.can_see_program(id)));
create policy program_communities_read on public.program_communities for select to authenticated using ((select private.can_see_program(program_id)));

revoke all on function private.my_sponsor_id(), private.can_see_program(uuid), private.can_see_sponsor(uuid), private.sponsor_reaches(uuid) from public;
grant execute on function private.my_sponsor_id(), private.can_see_program(uuid), private.can_see_sponsor(uuid), private.sponsor_reaches(uuid)
  to authenticated, service_role;

-- One breakdown: each group's count and share, or hidden when under five.
create function private.segment(p_groups jsonb, p_total bigint)
returns jsonb
language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case when (g ->> 'n')::bigint >= 5 then g || jsonb_build_object(
           'share_bps', case when p_total > 0 then floor((g ->> 'n')::numeric * 10000 / p_total) end, 'suppressed', false)
         else jsonb_build_object('key', g -> 'key', 'n', null, 'share_bps', null, 'cents', null, 'suppressed', true) end
    order by (g ->> 'n')::bigint desc, g ->> 'key'), '[]')
  from jsonb_array_elements(p_groups) g
$$;

revoke all on function private.segment(jsonb, bigint) from public;

create function public.impact_intelligence(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_program public.programs;
  v_sponsor public.sponsors;
begin
  if not (coalesce(private.is_auditor_or_admin(), false)
          or exists (select 1 from public.programs p where p.id = p_program_id and p.sponsor_id = private.my_sponsor_id())) then
    raise exception 'not_allowed_to_see_program' using errcode = '42501';
  end if;
  select * into v_program from public.programs where id = p_program_id;
  if not found then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;
  select * into v_sponsor from public.sponsors where id = v_program.sponsor_id;

  return (
    with cs as materialized (
      -- A member of two of its communities counts once.
      select distinct on (s.entrepreneur_id) pc.community_id, co.name as community_name, co.city, co.state, s.*
      from public.program_communities pc
      join public.communities co on co.id = pc.community_id
      cross join lateral private.community_state(pc.community_id) s
      where pc.program_id = p_program_id
      order by s.entrepreneur_id, s.joined_at
    ),
    judged as materialized (
      select cs.*,
        -- The sponsor's funnel, cumulative: each level has reached every one before it.
        case
          when stage_no = 7 and loan_status in ('DISBURSED', 'ACTIVE', 'PAID') and not coalesce(late, false) then 7
          when stage_no = 7 then 6
          when stage_no >= 4 then 5
          when stage_no = 3 then 4
          when stage_no = 2 then 3
          when checkins > 0 then 2
          when core_done > 0 then 1
          else 0
        end as level,
        case
          when data_quality is null then 'not_assessed'
          when data_quality >= 20 then 'high'
          when data_quality >= 12 then 'medium'
          else 'low'
        end as quality
      from cs
    ),
    measured as materialized (
      select distinct on (po.loan_id) po.entrepreneur_id, po.evc_cents, po.capital_use,
        po.avg_revenue_before_cents, po.avg_revenue_after_cents,
        private.has_consent(po.entrepreneur_id, 'impact') as counted
      from public.productive_outcomes po
      where po.entrepreneur_id in (select entrepreneur_id from cs)
      order by po.loan_id, po.outcome_no desc
    ),
    proofs as materialized (
      select a.kind, a.status, a.reconcile, a.signature, a.account_address, a.commitment, a.confirmed_at, a.entity_id, a.id
      from public.chain_anchors a
      where (a.kind in ('community', 'community_verification')
             and a.entity_id in (select community_id from public.program_communities where program_id = p_program_id))
         or (a.kind = 'allocation' and exists (
               select 1 from public.investments i join public.qualified_credit_opportunities o on o.id = i.opportunity_id
               where i.id = a.entity_id and o.entrepreneur_id in (select entrepreneur_id from cs)))
         or (a.kind not in ('community', 'community_verification', 'allocation')
             and private.anchor_entrepreneur(a.kind, a.entity_id) in (select entrepreneur_id from cs))
    ),
    opportunities as (
      select o.id, o.entrepreneur_id, o.amount_cents, o.term_months, o.purpose, o.risk_band, o.status, o.funding_pool,
        o.funding_status, o.allocation, j.loan_status, j.late, j.community_name
      from judged j
      join lateral (
        select * from public.qualified_credit_opportunities q where q.entrepreneur_id = j.entrepreneur_id
        order by q.created_at desc limit 1
      ) o on true
      where j.stage_no >= 6 and private.has_consent(j.entrepreneur_id, 'investors')
    )
    select jsonb_build_object(
      'program', jsonb_build_object(
        'id', v_program.id, 'name', v_program.name, 'description', v_program.description,
        'period_start', v_program.period_start, 'period_end', v_program.period_end,
        'funding_committed_cents', v_program.funding_committed_cents, 'funding_deployed_cents', v_program.funding_deployed_cents,
        'is_simulated', v_program.is_simulated),
      'sponsor', jsonb_build_object('id', v_sponsor.id, 'name', v_sponsor.name, 'kind', v_sponsor.kind, 'is_simulated', v_sponsor.is_simulated),
      'as_of_period', (select max(last_period) from cs),
      'communities', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', co.id, 'name', co.name, 'kind', co.kind, 'city', co.city, 'state', co.state, 'status', co.status,
            'participants', (select count(*) from judged j where j.community_id = co.id),
            'credit_ready', (select count(*) from judged j where j.community_id = co.id and j.level >= 4),
            'funded_cents', (select coalesce(sum(j.funded_cents), 0) from judged j where j.community_id = co.id and j.stage_no >= 6)
          ) order by co.name), '[]')
        from public.program_communities pc join public.communities co on co.id = pc.community_id
        where pc.program_id = p_program_id),
      'hero', (select jsonb_build_object(
        'reached', count(*),
        'reporting', count(*) filter (where reported_latest),
        'credit_ready', count(*) filter (where level >= 4),
        'requested', count(*) filter (where level >= 5),
        'capital_requested_cents', coalesce(sum(coalesce(opportunity_cents, intent_cents)) filter (where level >= 5), 0),
        'capital_mobilized_cents', coalesce(sum(funded_cents) filter (where stage_no >= 6), 0),
        'loans_disbursed', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')),
        'outcomes_measured', (select count(*) from measured where counted),
        'outcomes_withheld', (select count(*) from measured where not counted)) from judged),
      'funnel', (
        select jsonb_agg(jsonb_build_object('stage', st.stage, 'n', (select count(*) from judged where level >= st.ord - 1)) order by st.ord)
        from unnest(array['sponsored', 'engaged', 'reporting', 'prepared', 'credit_ready', 'requested_capital', 'funded', 'performing'])
          with ordinality as st(stage, ord)),
      'segments', jsonb_build_object(
        'readiness', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n)), '[]'), (select count(*) from judged))
                      from (select coalesce(readiness_status::text, 'not_assessed') as k, count(*) as n from judged group by 1) x),
        'data_quality', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n)), '[]'), (select count(*) from judged))
                      from (select quality as k, count(*) as n from judged group by 1) x),
        'sector', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n)), '[]'), (select count(*) from judged))
                      from (select coalesce(business_sector, 'other') as k, count(*) as n from judged group by 1) x),
        'geography', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n)), '[]'), (select count(*) from judged))
                      from (select concat_ws(', ', city, state) as k, count(*) as n from judged group by 1) x),
        'credit_intent', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n)), '[]'), (select count(*) from judged))
                      from (select case when level >= 5 then 'requested' when level = 4 then 'ready_not_asking' else 'not_ready' end as k,
                                   count(*) as n from judged group by 1) x),
        'purpose', (select private.segment(coalesce(jsonb_agg(jsonb_build_object('key', k, 'n', n, 'cents', cents)), '[]'),
                                           (select count(*) from judged where intent_purpose is not null))
                      from (select intent_purpose::text as k, count(*) as n, sum(intent_cents) as cents
                            from judged where intent_purpose is not null group by 1) x)
      ),
      'capital', (select private.capital_totals(
          coalesce(sum(opportunity_cents) filter (where stage_no >= 6), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'domestic'), 0),
          coalesce(sum(funded_cents) filter (where stage_no >= 6 and funding_pool = 'global'), 0))
        || jsonb_build_object('waiting_for_capital', count(*) filter (where stage_no = 6 and funding_status is null))
        from judged),
      'portfolio', (select jsonb_build_object(
          'financed_cents', coalesce(sum(principal_cents) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')), 0),
          'repaid_cents', coalesce(sum(repaid_cents), 0),
          'instalments_paid', coalesce(sum(instalments_paid) filter (where loan_status in ('ACTIVE', 'PAID', 'DEFAULTED')), 0),
          'instalments_due', coalesce(sum(instalments_due), 0),
          'loans_repaying', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE') and not late),
          'loans_late', count(*) filter (where late and loan_status = 'ACTIVE'),
          'loans_paid', count(*) filter (where loan_status = 'PAID'),
          'loans_defaulted', count(*) filter (where loan_status = 'DEFAULTED'))
        from judged),
      'outcomes', (select jsonb_build_object(
          'measured', count(*) filter (where counted),
          'withheld', count(*) filter (where not counted),
          'revenue_up', count(*) filter (where counted and avg_revenue_after_cents > avg_revenue_before_cents),
          'revenue_change_bps', case when coalesce(sum(avg_revenue_before_cents) filter (where counted), 0) > 0
            then floor((sum(avg_revenue_after_cents) filter (where counted) - sum(avg_revenue_before_cents) filter (where counted)) * 10000.0
                       / sum(avg_revenue_before_cents) filter (where counted)) end,
          'as_declared', count(*) filter (where counted and capital_use = 'as_declared'),
          'partly_as_declared', count(*) filter (where counted and capital_use = 'partly_as_declared'),
          'other_use', count(*) filter (where counted and capital_use = 'other_use'),
          'not_reported', count(*) filter (where counted and capital_use = 'not_reported'),
          'evc_cents', coalesce(sum(evc_cents) filter (where counted), 0),
          'evc_positive', count(*) filter (where counted and evc_cents > 0))
        from measured),
      'evidence', jsonb_build_object(
        'total', (select count(*) from proofs),
        'confirmed', (select count(*) from proofs where status = 'confirmed'),
        'pending', (select count(*) from proofs where status in ('pending', 'submitted')),
        'failed', (select count(*) from proofs where status = 'failed'),
        'mismatches', (select count(*) from proofs where reconcile in ('missing', 'mismatch')),
        'last_confirmed_at', (select private.iso(max(confirmed_at)) from proofs),
        'by_kind', (
          select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'total', total, 'confirmed', confirmed) order by kind), '[]')
          from (select kind, count(*) as total, count(*) filter (where status = 'confirmed') as confirmed from proofs group by kind) k),
        'latest', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'kind', p.kind, 'entity_id', p.entity_id, 'status', p.status, 'signature', p.signature, 'account', p.account_address,
              'commitment', encode(p.commitment, 'hex'), 'confirmed_at', private.iso(p.confirmed_at)
            ) order by p.confirmed_at desc), '[]')
          from (select * from proofs where status = 'confirmed' and kind not in ('checkin', 'consent', 'enrollment')
                order by confirmed_at desc, id desc limit 8) p)
      ),
      'opportunities', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'opportunity_id', o.id, 'code', private.opportunity_code(o.id), 'community', o.community_name,
            'purpose', o.purpose, 'amount_cents', o.amount_cents, 'term_months', o.term_months, 'risk_band', o.risk_band,
            'funding_pool', o.funding_pool,
            'funding_status', coalesce(o.funding_status::text, case when o.allocation is not null then 'waiting' end),
            'loan_status', o.loan_status, 'late', o.late,
            -- In the engine's queue: qualified, not yet lent.
            'in_engine', o.allocation is not null and o.loan_status is null and o.status in ('open', 'referred', 'partner_approved')
          ) order by o.loan_status is null, o.amount_cents desc), '[]')
        from opportunities o)
    )
  );
end;
$$;

revoke all on function public.impact_intelligence(uuid) from public, anon;
grant execute on function public.impact_intelligence(uuid) to authenticated, service_role;

-- The engine page for a sponsor: the queue of its programmes' communities, by Q- code,
-- only for businesses that consented to show investors.
create or replace function public.engine_opportunities()
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
    select coalesce(jsonb_agg(row order by row ->> 'queued', row ->> 'created_at', row ->> 'opportunity_id'), '[]')
    from (
      select jsonb_build_object(
        'opportunity_id', o.id,
        'code', case when v_partner is not null then private.partner_code(o.entrepreneur_id) else private.opportunity_code(o.id) end,
        -- Queued demand first, in order; held requests after it.
        'queued', case when o.allocation is not null then '0' else '1' end,
        'created_at', private.iso(o.created_at),
        'status', o.status,
        'purpose', o.purpose,
        'business_sector', en.business_sector,
        'community', c.name,
        'community_city', c.city,
        'community_state', c.state,
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
      where not exists (select 1 from public.loans l where l.opportunity_id = o.id
                        and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED', 'CANCELLED'))
        and (
          -- The queue capital_overview() replays.
          (o.allocation is not null
            and o.status in ('open', 'referred', 'partner_approved')
            and coalesce(o.funding_status::text, 'waiting') in ('waiting', 'open', 'partially_funded', 'funded'))
          -- Held for a person to review: only those who review.
          or (v_overseer and o.status = 'in_review')
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
