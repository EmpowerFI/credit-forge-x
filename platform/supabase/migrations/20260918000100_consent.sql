-- M14 · consent, enforced
--
-- Phase 3 of PLAN_REDESIGN.md: privacy as product. An entrepreneur decides
-- what her data may be used for, in four scopes:
--
--   assessment  EmpowerFI assesses her readiness and, when she asks, her
--               request, from her check-ins and education.
--   partner     her request and its assessment go to a regulated credit
--               partner, who decides and lends. Asking for credit needs it.
--   investors   her request is shown to investors as an anonymised
--               opportunity: no name, no words, no figures of hers.
--   impact      her business is counted, in aggregate, in impact figures.
--
-- Each scope needs the one before it (impact stands alone): what is not
-- assessed cannot be shared, and investors fund only what a partner lends.
--
-- Every change is a new record, never an edit, and each record is proven on
-- Solana (ConsentCommitment): what she agreed to, and when, stays provable.
-- She records it herself in the app, or her community leader records it for
-- her from the signed form, which is how most participants give it.
--
-- Consent is enforced here, not only shown: no assessment, referral or
-- investor listing happens without the scope that allows it. Withdrawing
-- investor consent takes her opportunity off the market, and refunds anyone
-- who had funded it, unless the loan has already been disbursed.

create type public.consent_channel as enum ('app', 'community');

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  entrepreneur_id uuid not null references public.entrepreneurs (id) on delete cascade,
  consent_no integer not null check (consent_no > 0),
  -- The wording she agreed to (src/app/lib/consent.ts, docs/PRIVACY.md).
  text_version text not null,
  assessment boolean not null,
  partner boolean not null,
  investors boolean not null,
  impact boolean not null,
  channel public.consent_channel not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (entrepreneur_id, consent_no),
  constraint scopes_build_on_each_other check ((assessment or not partner) and (partner or not investors))
);

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;

create policy consents_read on public.consents for select to authenticated using (
  entrepreneur_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(entrepreneur_id))
  or (select private.is_auditor_or_admin())
);

create function private.consent_text_version()
returns text
language sql immutable set search_path = ''
as $$ select 'consent-v1' $$;

-- Whether her latest record allows a scope. No record allows nothing.
create function private.has_consent(p_entrepreneur_id uuid, p_scope text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case p_scope
      when 'assessment' then c.assessment
      when 'partner' then c.partner
      when 'investors' then c.investors
      when 'impact' then c.impact
    end
    from public.consents c
    where c.entrepreneur_id = p_entrepreneur_id
    order by c.consent_no desc
    limit 1
  ), false)
$$;

-- The same question, as it stood at a moment: for the audit's enforcement checks.
create function private.had_consent(p_entrepreneur_id uuid, p_scope text, p_at timestamptz)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case p_scope
      when 'assessment' then c.assessment
      when 'partner' then c.partner
      when 'investors' then c.investors
      when 'impact' then c.impact
    end
    from public.consents c
    where c.entrepreneur_id = p_entrepreneur_id and c.created_at <= p_at
    order by c.consent_no desc
    limit 1
  ), false)
$$;

-- Her latest record in brief, with its proof, for the screens that show it.
create function private.consent_brief(p_entrepreneur_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'consent_no', c.consent_no, 'text_version', c.text_version,
    'assessment', c.assessment, 'partner', c.partner, 'investors', c.investors, 'impact', c.impact,
    'channel', c.channel, 'at', private.iso(c.created_at),
    'proof', private.proof_brief('consent', c.id)
  )
  from public.consents c
  where c.entrepreneur_id = p_entrepreneur_id
  order by c.consent_no desc
  limit 1
$$;

-- Records her choices: herself in the app, or a leader of hers (or an
-- admin) from the signed form. The same choices again record nothing new.
create function public.record_consent(
  p_assessment boolean,
  p_partner boolean,
  p_investors boolean,
  p_impact boolean,
  p_entrepreneur_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid := coalesce(p_entrepreneur_id, private.my_entrepreneur_id());
  v_current public.consents;
  v_row public.consents;
  v_enrollment bigint;
begin
  if v_entrepreneur is null or not private.can_act_for(v_entrepreneur) then
    raise exception 'not_allowed_to_record_consent' using errcode = '42501';
  end if;
  if p_assessment is null or p_partner is null or p_investors is null or p_impact is null then
    raise exception 'every_scope_needs_an_answer' using errcode = '22023';
  end if;
  if (p_partner and not p_assessment) or (p_investors and not p_partner) then
    raise exception 'consent_scope_needs_the_one_before' using errcode = '22023';
  end if;

  -- One record at a time per person, so numbering has no gaps or twins.
  perform 1 from public.entrepreneurs where id = v_entrepreneur for update;

  select * into v_current from public.consents
  where entrepreneur_id = v_entrepreneur order by consent_no desc limit 1;
  if v_current.id is not null
     and (v_current.assessment, v_current.partner, v_current.investors, v_current.impact)
         = (p_assessment, p_partner, p_investors, p_impact) then
    return jsonb_build_object('id', v_current.id, 'consent_no', v_current.consent_no, 'reused', true);
  end if;

  insert into public.consents (
    entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel, recorded_by
  ) values (
    v_entrepreneur, coalesce(v_current.consent_no, 0) + 1, private.consent_text_version(),
    p_assessment, p_partner, p_investors, p_impact,
    (case when v_entrepreneur = private.my_entrepreneur_id() then 'app' else 'community' end)::public.consent_channel,
    auth.uid()
  )
  returning * into v_row;

  -- Proven once her registration is on chain: the record hangs off her borrower account.
  v_enrollment := private.enrollment_anchor(v_entrepreneur);
  if v_enrollment is not null then
    insert into public.chain_anchors (kind, entity_id, depends_on) values ('consent', v_row.id, v_enrollment);
  end if;

  return jsonb_build_object('id', v_row.id, 'consent_no', v_row.consent_no, 'reused', false);
end;
$$;

-- What a record changes at once. Withdrawing investor consent takes what is
-- still being funded off the market — refunding any capital already in it —
-- unless the loan has been disbursed. Giving it lists again what was never funded.
create function private.apply_consent() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.investors then
    update public.qualified_credit_opportunities o
    set funding_status = (case when o.funded_micro_usdc > 0 then 'refunded' end)::public.funding_status
    where o.entrepreneur_id = new.entrepreneur_id
      and o.funding_status in ('open', 'partially_funded', 'funded')
      and not exists (
        select 1 from public.loans l
        where l.opportunity_id = o.id and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
      );
  else
    -- Re-running the opening rule (open_for_funding, on update of status).
    update public.qualified_credit_opportunities o set status = o.status
    where o.entrepreneur_id = new.entrepreneur_id
      and o.funding_status is null
      and o.status in ('open', 'referred', 'partner_approved')
      and not exists (
        select 1 from public.loans l
        where l.opportunity_id = o.id and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
      );
  end if;
  return null;
end;
$$;

create trigger apply_consent after insert on public.consents
  for each row execute function private.apply_consent();

-- ------------------------------------------------------- enforcement points

-- Investors see an opportunity only with her consent.
create or replace function private.open_for_funding() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.funding_status is null and new.status in ('open', 'referred', 'partner_approved')
     and private.has_consent(new.entrepreneur_id, 'investors') then
    new.funding_status := 'open';
    new.fx_brl_per_usdc_milli := private.demo_brl_per_usdc_milli();
    -- centavos → reais → USDC → micro-USDC, rounded up to a whole USDC.
    new.funding_target_micro_usdc := ceil(new.amount_cents * 10.0 / new.fx_brl_per_usdc_milli) * 1000000;
  end if;
  if new.status in ('partner_declined', 'withdrawn') and new.funding_status in ('open', 'partially_funded', 'funded') then
    new.funding_status := (case when new.funded_micro_usdc > 0 then 'refunded' else 'closed' end)::public.funding_status;
  end if;
  return new;
end;
$$;

create or replace function public.readiness_inputs(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_act_for(p_entrepreneur_id) then
    raise exception 'not_allowed_to_assess' using errcode = '42501';
  end if;
  if not private.has_consent(p_entrepreneur_id, 'assessment') then
    raise exception 'no_consent_to_assess' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'as_of_period', private.current_period(),
    'community_verified', exists (
      select 1 from public.community_memberships m
      join public.communities c on c.id = m.community_id
      where m.entrepreneur_id = p_entrepreneur_id and m.status = 'active' and c.status = 'verified'
    ),
    -- The core programme is EmpowerFI's own: programmes with no community.
    'core_modules_total', (
      select count(*) from public.education_modules em
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null
    ),
    'core_modules_completed', (
      select count(*) from public.education_progress pr
      join public.education_modules em on em.id = pr.module_id
      join public.education_programs ep on ep.id = em.program_id
      where ep.community_id is null and pr.entrepreneur_id = p_entrepreneur_id and pr.status = 'completed'
    ),
    'checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_cents', revenue_cents,
        'cogs_cents', cogs_cents,
        'opex_cents', opex_cents,
        'household_cents', household_cents,
        'keeps_records', keeps_records,
        'active_days', active_days
      ) order by period)
      from public.checkins where entrepreneur_id = p_entrepreneur_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_readiness_assessment(
  p_entrepreneur_id uuid,
  p_features jsonb,
  p_result jsonb,
  p_requested_by uuid default null,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_latest public.readiness_assessments;
  v_row public.readiness_assessments;
  v_enrollment bigint;
begin
  -- Serialise assessments of one entrepreneur, so numbering has no gaps or twins.
  perform 1 from public.entrepreneurs where id = p_entrepreneur_id for update;
  if not found then
    raise exception 'entrepreneur_not_found' using errcode = 'P0002';
  end if;
  if not private.has_consent(p_entrepreneur_id, 'assessment') then
    raise exception 'no_consent_to_assess' using errcode = 'P0001';
  end if;

  select * into v_latest from public.readiness_assessments
  where entrepreneur_id = p_entrepreneur_id order by assessment_no desc limit 1;

  if v_latest.id is not null
     and v_latest.features = p_features
     and v_latest.model_version = p_result ->> 'model_version' then
    return jsonb_build_object('id', v_latest.id, 'assessment_no', v_latest.assessment_no, 'reused', true);
  end if;

  insert into public.readiness_assessments (
    entrepreneur_id, assessment_no, model_version, as_of_period, status, band, score,
    components, missing_requirements, reason_codes, features, requested_by, is_simulated, created_at
  ) values (
    p_entrepreneur_id,
    coalesce(v_latest.assessment_no, 0) + 1,
    p_result ->> 'model_version',
    p_features ->> 'as_of_period',
    (p_result ->> 'status')::public.readiness_status,
    (p_result ->> 'band')::public.readiness_band,
    (p_result ->> 'score')::smallint,
    p_result -> 'components',
    p_result -> 'missing_requirements',
    array(select jsonb_array_elements_text(p_result -> 'reason_codes')),
    p_features,
    p_requested_by,
    p_is_simulated,
    p_created_at
  )
  returning * into v_row;

  -- Attested once her registration is on chain; without one there is no
  -- borrower account to attest against, and nothing to queue.
  v_enrollment := private.enrollment_anchor(p_entrepreneur_id);
  if v_enrollment is not null then
    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('readiness', v_row.id, v_enrollment);
  end if;

  return jsonb_build_object('id', v_row.id, 'assessment_no', v_row.assessment_no, 'reused', false);
end;
$$;

-- Asking for credit means a partner will see the request: it needs that consent.
create or replace function public.declare_credit_intent(
  p_purpose public.credit_purpose,
  p_requested_amount_cents bigint,
  p_description text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_entrepreneur uuid := private.my_entrepreneur_id();
  v_status public.readiness_status;
  v_id uuid;
begin
  if v_entrepreneur is null then
    raise exception 'only_the_entrepreneur_declares_intent' using errcode = '42501';
  end if;
  if not private.has_consent(v_entrepreneur, 'partner') then
    raise exception 'no_consent_to_share_with_partner' using errcode = 'P0001';
  end if;

  select status into v_status from public.readiness_assessments
  where entrepreneur_id = v_entrepreneur order by assessment_no desc limit 1;
  if v_status is distinct from 'CREDIT_READY' then
    raise exception 'not_credit_ready' using errcode = 'P0001';
  end if;

  begin
    insert into public.credit_intents (entrepreneur_id, purpose, requested_amount_cents, description, declared_by)
    values (v_entrepreneur, p_purpose, p_requested_amount_cents, nullif(trim(p_description), ''), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'intent_already_active' using errcode = '23505';
  end;
  return v_id;
end;
$$;

create or replace function public.eligibility_inputs(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_intent public.credit_intents;
  v_ready public.readiness_assessments;
begin
  if not private.can_act_for(p_entrepreneur_id) then
    raise exception 'not_allowed_to_assess' using errcode = '42501';
  end if;
  if not private.has_consent(p_entrepreneur_id, 'assessment') then
    raise exception 'no_consent_to_assess' using errcode = 'P0001';
  end if;
  if not exists (select 1 from private.credit_pipeline() where entrepreneur_id = p_entrepreneur_id) then
    raise exception 'not_in_credit_pipeline' using errcode = 'P0001';
  end if;

  select * into v_intent from public.credit_intents where entrepreneur_id = p_entrepreneur_id and status = 'active';
  select * into v_ready from public.readiness_assessments
  where entrepreneur_id = p_entrepreneur_id order by assessment_no desc limit 1;

  return jsonb_build_object(
    'intent_id', v_intent.id,
    'readiness_assessment_id', v_ready.id,
    'input', jsonb_build_object(
      'readiness_status', v_ready.status,
      'readiness_band', v_ready.band,
      'requested_amount_cents', v_intent.requested_amount_cents,
      'purpose', v_intent.purpose,
      'months_reported', (v_ready.features ->> 'months_reported')::integer,
      'records_kept_bps', (v_ready.features ->> 'records_kept_bps')::integer,
      'inconsistencies', (v_ready.features ->> 'inconsistencies')::integer,
      'avg_revenue_cents', (v_ready.features ->> 'avg_revenue_cents')::bigint,
      'avg_net_business_cents', (v_ready.features ->> 'avg_net_business_cents')::bigint,
      'avg_household_cents', (v_ready.features ->> 'avg_household_cents')::bigint,
      'revenue_cv_bps', (v_ready.features ->> 'revenue_cv_bps')::integer,
      'revenue_trend_bps', (v_ready.features ->> 'revenue_trend_bps')::integer,
      'household_share_bps', (v_ready.features ->> 'household_share_bps')::integer
    )
  );
end;
$$;

-- As before, and: no assessment without her consent to it, and no referral
-- to a partner without her consent to share — the opportunity then waits.
create or replace function public.record_eligibility_assessment(
  p_entrepreneur_id uuid,
  p_intent_id uuid,
  p_readiness_assessment_id uuid,
  p_inputs jsonb,
  p_result jsonb,
  p_is_simulated boolean default false,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_existing public.eligibility_assessments;
  v_row public.eligibility_assessments;
  v_opportunity public.qualified_credit_opportunities;
  v_partner uuid;
  v_intent public.credit_intents;
begin
  perform 1 from public.entrepreneurs where id = p_entrepreneur_id for update;

  select * into v_existing from public.eligibility_assessments
  where intent_id = p_intent_id and readiness_assessment_id = p_readiness_assessment_id;
  if found then
    select * into v_opportunity from public.qualified_credit_opportunities where intent_id = p_intent_id;
    return jsonb_build_object('id', v_existing.id, 'eligibility_no', v_existing.eligibility_no,
      'opportunity_id', v_opportunity.id, 'reused', true);
  end if;

  if not private.has_consent(p_entrepreneur_id, 'assessment') then
    raise exception 'no_consent_to_assess' using errcode = 'P0001';
  end if;

  select * into v_intent from public.credit_intents where id = p_intent_id and entrepreneur_id = p_entrepreneur_id;
  if not found then
    raise exception 'intent_not_found' using errcode = 'P0002';
  end if;

  insert into public.eligibility_assessments (
    entrepreneur_id, intent_id, readiness_assessment_id, eligibility_no, model_version, decision,
    requested_amount_cents, proposed_amount_cents, term_months, instalment_cents, max_instalment_cents,
    affordability_bps, suggested_min_cents, suggested_max_cents, risk_band, risk_points, confidence,
    reason_codes, inputs, is_simulated, created_at
  ) values (
    p_entrepreneur_id, p_intent_id, p_readiness_assessment_id,
    coalesce((select max(eligibility_no) from public.eligibility_assessments where entrepreneur_id = p_entrepreneur_id), 0) + 1,
    p_result ->> 'model_version',
    (p_result ->> 'decision')::public.eligibility_decision,
    (p_result ->> 'requested_amount_cents')::bigint,
    (p_result ->> 'proposed_amount_cents')::bigint,
    (p_result ->> 'term_months')::smallint,
    (p_result ->> 'instalment_cents')::bigint,
    (p_result ->> 'max_instalment_cents')::bigint,
    (p_result ->> 'affordability_bps')::integer,
    (p_result ->> 'suggested_min_cents')::bigint,
    (p_result ->> 'suggested_max_cents')::bigint,
    (p_result ->> 'risk_band')::public.grade,
    (p_result ->> 'risk_points')::smallint,
    (p_result ->> 'confidence')::public.grade,
    array(select jsonb_array_elements_text(p_result -> 'reason_codes')),
    p_inputs, p_is_simulated, p_created_at
  )
  returning * into v_row;

  insert into public.chain_anchors (kind, entity_id, depends_on)
  values ('eligibility', v_row.id, private.anchor_of('readiness', p_readiness_assessment_id));

  if v_row.decision <> 'NOT_ELIGIBLE' and not exists (
    select 1 from public.qualified_credit_opportunities where intent_id = p_intent_id
  ) then
    v_partner := case when v_row.decision = 'MANUAL_REVIEW' or not private.has_consent(p_entrepreneur_id, 'partner') then null
                      else private.match_partner(v_row.proposed_amount_cents, v_intent.purpose) end;
    insert into public.qualified_credit_opportunities (
      entrepreneur_id, intent_id, eligibility_id, opportunity_no, amount_cents, term_months, instalment_cents,
      purpose, risk_band, confidence, status, partner_id, referred_at, is_simulated, created_at
    ) values (
      p_entrepreneur_id, p_intent_id, v_row.id,
      coalesce((select max(opportunity_no) from public.qualified_credit_opportunities where entrepreneur_id = p_entrepreneur_id), 0) + 1,
      v_row.proposed_amount_cents, v_row.term_months, v_row.instalment_cents, v_intent.purpose,
      v_row.risk_band, v_row.confidence,
      (case when v_row.decision = 'MANUAL_REVIEW' then 'in_review'
            when v_partner is null then 'open' else 'referred' end)::public.opportunity_status,
      v_partner, case when v_partner is not null then p_created_at end,
      p_is_simulated, p_created_at
    )
    returning * into v_opportunity;

    insert into public.chain_anchors (kind, entity_id, depends_on)
    values ('opportunity', v_opportunity.id, private.anchor_of('eligibility', v_row.id));
  end if;

  return jsonb_build_object('id', v_row.id, 'eligibility_no', v_row.eligibility_no,
    'opportunity_id', v_opportunity.id, 'partner_id', v_opportunity.partner_id, 'reused', false);
end;
$$;

create or replace function public.refer_opportunity(p_opportunity_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_opportunity public.qualified_credit_opportunities;
  v_partner uuid;
begin
  if not private.is_admin() then
    raise exception 'only_admins_refer' using errcode = '42501';
  end if;
  select * into v_opportunity from public.qualified_credit_opportunities where id = p_opportunity_id for update;
  if not found or v_opportunity.status not in ('in_review', 'open') then
    raise exception 'opportunity_not_referable' using errcode = 'P0001';
  end if;
  if not private.has_consent(v_opportunity.entrepreneur_id, 'partner') then
    raise exception 'no_consent_to_share_with_partner' using errcode = 'P0001';
  end if;
  v_partner := private.match_partner(v_opportunity.amount_cents, v_opportunity.purpose);
  if v_partner is null then
    raise exception 'no_matching_partner' using errcode = 'P0001';
  end if;
  update public.qualified_credit_opportunities
  set status = 'referred', partner_id = v_partner, referred_at = now()
  where id = p_opportunity_id;
  return v_partner;
end;
$$;

-- The partner disburses only capital that is there: while investors are still
-- funding, it waits. An opportunity never listed, or taken off the market
-- (her consent withdrawn, investors refunded), is lent from the partner's own capital.
create or replace function public.transition_loan(p_loan_id uuid, p_to public.loan_status, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_loan public.loans;
  v_event uuid;
  v_previous bigint;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found or not (v_loan.partner_id = private.my_partner_id() or private.is_admin()) then
    raise exception 'not_your_loan' using errcode = '42501';
  end if;
  if p_to = 'PARTNER_APPROVED' then
    raise exception 'approval_comes_from_the_partner_decision' using errcode = 'P0001';
  end if;
  if not private.loan_can_become(v_loan.status, p_to) then
    raise exception 'invalid_loan_transition' using errcode = 'P0001';
  end if;
  if p_to = 'DISBURSED' and (select funding_status from public.qualified_credit_opportunities where id = v_loan.opportunity_id)
       in ('open', 'partially_funded') then
    raise exception 'not_fully_funded' using errcode = 'P0001';
  end if;
  if p_to = 'PAID' and (select count(*) from public.payments where loan_id = p_loan_id) < v_loan.term_months then
    raise exception 'instalments_outstanding' using errcode = 'P0001';
  end if;

  v_previous := private.latest_loan_anchor(p_loan_id);
  insert into public.loan_events (loan_id, from_status, to_status, actor, note)
  values (p_loan_id, v_loan.status, p_to, auth.uid(), nullif(trim(p_note), ''))
  returning id into v_event;
  update public.loans
  set status = p_to, updated_at = now(),
      disbursed_at = case when p_to = 'DISBURSED' then now() else disbursed_at end
  where id = p_loan_id;
  insert into public.chain_anchors (kind, entity_id, depends_on) values ('loan_transition', v_event, v_previous);
end;
$$;

-- The market: only what she allowed to be shown, and — for an investor who
-- already holds a position — what it funded. The evidence now includes the
-- proof of her consent.
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
  proofs jsonb
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
    private.indicative_yield_bps(o.risk_band),
    o.risk_band, o.confidence, e.decision, e.affordability_bps, e.reason_codes, e.model_version,
    r.score::integer, r.band, r.model_version,
    (r.features ->> 'months_reported')::integer, (r.features ->> 'records_kept_bps')::integer,
    (select l.status from public.loans l where l.opportunity_id = o.id),
    o.created_at,
    -- The evidence: which proofs exist and where, never what they contain.
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
              order by k.consent_no desc limit 1)))
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
  order by (o.funding_status in ('open', 'partially_funded')) desc, o.created_at desc;
end;
$$;

-- --------------------------------------------------------------- the proofs

create or replace function private.anchor_entrepreneur(p_kind public.anchor_kind, p_entity_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_kind
    when 'enrollment' then p_entity_id
    when 'checkin' then (select entrepreneur_id from public.checkins where id = p_entity_id)
    when 'readiness' then (select entrepreneur_id from public.readiness_assessments where id = p_entity_id)
    when 'eligibility' then (select entrepreneur_id from public.eligibility_assessments where id = p_entity_id)
    when 'opportunity' then (select entrepreneur_id from public.qualified_credit_opportunities where id = p_entity_id)
    when 'loan' then (select entrepreneur_id from public.loans where id = p_entity_id)
    when 'loan_transition' then (
      select l.entrepreneur_id from public.loan_events e join public.loans l on l.id = e.loan_id where e.id = p_entity_id)
    when 'payment' then (
      select l.entrepreneur_id from public.payments p join public.loans l on l.id = p.loan_id where p.id = p_entity_id)
    when 'outcome' then (select entrepreneur_id from public.productive_outcomes where id = p_entity_id)
    -- An allocation is the investor's, not hers: no borrower account behind it.
    when 'allocation' then null
    when 'consent' then (select entrepreneur_id from public.consents where id = p_entity_id)
  end;
end;
$$;

create or replace function private.anchor_payload(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  case p_kind
    when 'community' then
      select jsonb_build_object(
        'community_id', c.id, 'community_ref', encode(c.chain_ref, 'hex'), 'name', c.name, 'kind', c.kind,
        'city', c.city, 'state', c.state, 'leader_id', c.leader_id, 'created_at', private.iso(c.created_at)
      ) into v from public.communities c where c.id = p_entity_id;

    when 'community_verification' then
      select jsonb_build_object(
        'community_id', c.id, 'status', c.status, 'verified_by', c.verified_by, 'verified_at', private.iso(c.verified_at)
      ) into v from public.communities c where c.id = p_entity_id and c.status = 'verified';

    when 'enrollment' then
      select jsonb_build_object(
        'entrepreneur_id', m.entrepreneur_id, 'community_id', m.community_id, 'joined_at', private.iso(m.joined_at)
      ) into v from public.community_memberships m
      where m.entrepreneur_id = p_entity_id order by m.joined_at, m.community_id limit 1;

    when 'checkin' then
      select jsonb_build_object(
        'checkin_id', c.id, 'entrepreneur_id', c.entrepreneur_id, 'period', c.period,
        'revenue_cents', c.revenue_cents, 'cogs_cents', c.cogs_cents, 'opex_cents', c.opex_cents,
        'household_cents', c.household_cents, 'keeps_records', c.keeps_records, 'active_days', c.active_days,
        'submitted_at', private.iso(c.created_at)
      ) into v from public.checkins c where c.id = p_entity_id;

    when 'readiness' then
      select jsonb_build_object(
        'assessment_id', r.id, 'entrepreneur_id', r.entrepreneur_id, 'assessment_no', r.assessment_no,
        'model_version', r.model_version, 'as_of_period', r.as_of_period, 'status', r.status, 'band', r.band,
        'score', r.score, 'components', r.components, 'missing_requirements', r.missing_requirements,
        'reason_codes', to_jsonb(r.reason_codes), 'features', r.features, 'assessed_at', private.iso(r.created_at)
      ) into v from public.readiness_assessments r where r.id = p_entity_id;

    -- The whole assessment, with its inputs, and the readiness it relied on.
    when 'eligibility' then
      select jsonb_build_object(
        'eligibility_id', e.id, 'entrepreneur_id', e.entrepreneur_id, 'intent_id', e.intent_id,
        'readiness_assessment_id', e.readiness_assessment_id, 'readiness_assessment_no', r.assessment_no,
        'eligibility_no', e.eligibility_no, 'model_version', e.model_version, 'decision', e.decision,
        'requested_amount_cents', e.requested_amount_cents, 'proposed_amount_cents', e.proposed_amount_cents,
        'term_months', e.term_months, 'instalment_cents', e.instalment_cents,
        'max_instalment_cents', e.max_instalment_cents, 'affordability_bps', e.affordability_bps,
        'suggested_min_cents', e.suggested_min_cents, 'suggested_max_cents', e.suggested_max_cents,
        'risk_band', e.risk_band, 'risk_points', e.risk_points, 'confidence', e.confidence,
        'reason_codes', to_jsonb(e.reason_codes), 'inputs', e.inputs, 'assessed_at', private.iso(e.created_at)
      ) into v
      from public.eligibility_assessments e join public.readiness_assessments r on r.id = e.readiness_assessment_id
      where e.id = p_entity_id;

    when 'opportunity' then
      select jsonb_build_object(
        'opportunity_id', o.id, 'entrepreneur_id', o.entrepreneur_id, 'intent_id', o.intent_id,
        'eligibility_id', o.eligibility_id, 'eligibility_no', e.eligibility_no, 'opportunity_no', o.opportunity_no,
        'amount_cents', o.amount_cents, 'term_months', o.term_months, 'instalment_cents', o.instalment_cents,
        'purpose', o.purpose, 'risk_band', o.risk_band, 'confidence', o.confidence,
        'created_at', private.iso(o.created_at)
      ) into v
      from public.qualified_credit_opportunities o join public.eligibility_assessments e on e.id = o.eligibility_id
      where o.id = p_entity_id;

    -- The loan's terms: principal, the partner's rate and term.
    when 'loan' then
      select jsonb_build_object(
        'loan_id', l.id, 'opportunity_id', l.opportunity_id, 'opportunity_no', o.opportunity_no,
        'partner_id', l.partner_id, 'decision_id', l.decision_id, 'principal_cents', l.principal_cents,
        'term_months', l.term_months, 'rate_bps', l.rate_bps, 'instalment_cents', l.instalment_cents,
        'created_at', private.iso(l.created_at)
      ) into v
      from public.loans l join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where l.id = p_entity_id;

    -- A status change, with the partner's decision when it is the approval.
    when 'loan_transition' then
      select jsonb_build_object(
        'loan_event_id', ev.id, 'loan_id', ev.loan_id, 'opportunity_no', o.opportunity_no,
        'from_status', ev.from_status, 'to_status', ev.to_status, 'actor', ev.actor,
        'at', private.iso(ev.created_at),
        'decision', case when ev.to_status = 'PARTNER_APPROVED' then jsonb_build_object(
          'decision_id', d.id, 'partner_id', d.partner_id, 'verdict', d.verdict,
          'approved_amount_cents', d.approved_amount_cents, 'rate_bps', d.rate_bps,
          'term_months', d.term_months, 'decided_by', d.decided_by, 'decided_at', private.iso(d.created_at)
        ) end
      ) into v
      from public.loan_events ev
      join public.loans l on l.id = ev.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      join public.partner_decisions d on d.id = l.decision_id
      where ev.id = p_entity_id;

    when 'payment' then
      select jsonb_build_object(
        'payment_id', p.id, 'loan_id', p.loan_id, 'opportunity_no', o.opportunity_no,
        'instalment_no', p.instalment_no, 'amount_cents', p.amount_cents, 'paid_at', private.iso(p.paid_at)
      ) into v
      from public.payments p
      join public.loans l on l.id = p.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where p.id = p_entity_id;
    -- A productive-outcome measurement: before and after the loan, in the
    -- business's own reported months.
    when 'outcome' then
      select jsonb_build_object(
        'outcome_id', po.id, 'loan_id', po.loan_id, 'opportunity_no', o.opportunity_no, 'outcome_no', po.outcome_no,
        'model_version', po.model_version, 'disbursement_period', po.disbursement_period,
        'months_before', po.months_before, 'months_after', po.months_after,
        'avg_revenue_before_cents', po.avg_revenue_before_cents, 'avg_revenue_after_cents', po.avg_revenue_after_cents,
        'avg_net_before_cents', po.avg_net_before_cents, 'avg_net_after_cents', po.avg_net_after_cents,
        'incremental_profit_cents', po.incremental_profit_cents, 'cost_of_credit_cents', po.cost_of_credit_cents,
        'evc_cents', po.evc_cents, 'capital_use', po.capital_use, 'confidence', po.confidence,
        'measured_at', private.iso(po.measured_at)
      ) into v
      from public.productive_outcomes po
      join public.loans l on l.id = po.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where po.id = p_entity_id;
    -- An investor's allocation: whose wallet, how much, to which
    -- opportunity, from which deposit. The reference whose hash keys the
    -- account on chain is part of it.
    when 'allocation' then
      select jsonb_build_object(
        'investment_id', i.id, 'opportunity_id', i.opportunity_id, 'investor_wallet', i.wallet_address,
        'amount_micro_usdc', i.amount_micro_usdc, 'deposit_signature', i.deposit_signature, 'mode', i.mode,
        'allocation_ref', encode(i.allocation_ref, 'hex'), 'allocated_at', private.iso(i.created_at)
      ) into v
      from public.investments i
      where i.id = p_entity_id;
    -- One consent record: each scope she allowed or refused, the wording's
    -- version, how it was given and by whom.
    when 'consent' then
      select jsonb_build_object(
        'consent_id', k.id, 'entrepreneur_id', k.entrepreneur_id, 'consent_no', k.consent_no,
        'text_version', k.text_version,
        'scopes', jsonb_build_object('assessment', k.assessment, 'partner', k.partner,
          'investors', k.investors, 'impact', k.impact),
        'channel', k.channel, 'recorded_by', k.recorded_by, 'recorded_at', private.iso(k.created_at)
      ) into v
      from public.consents k
      where k.id = p_entity_id;
  end case;

  return v;
end;
$$;

-- ------------------------------------------------------ Community Intelligence

create or replace function public.community_participants(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'entrepreneur_id', s.entrepreneur_id, 'display_name', s.display_name, 'business_name', s.business_name,
      'business_sector', s.business_sector, 'is_simulated', s.is_simulated,
      'joined_at', private.iso(s.joined_at), 'intake', s.intake,
      'core_total', s.core_total, 'core_done', s.core_done, 'checkins', s.checkins, 'last_period', s.last_period,
      'reported_latest', s.reported_latest,
      'readiness_status', s.readiness_status, 'readiness_band', s.readiness_band, 'readiness_score', s.readiness_score,
      'regularity', s.regularity, 'data_quality', s.data_quality, 'months_reported', s.months_reported,
      'missing_requirements', coalesce(s.missing_requirements, '[]'), 'readiness_reasons', coalesce(to_jsonb(s.readiness_reasons), '[]'),
      'intent_purpose', s.intent_purpose, 'intent_cents', s.intent_cents,
      'eligibility_decision', s.eligibility_decision, 'eligibility_reasons', coalesce(to_jsonb(s.eligibility_reasons), '[]'),
      'opportunity_status', s.opportunity_status, 'referred_at', private.iso(s.referred_at),
      'loan_status', s.loan_status, 'instalments_paid', s.instalments_paid, 'loan_term', s.loan_term, 'late', s.late,
      'stage', s.stage, 'stage_no', s.stage_no, 'next_action', s.next_action, 'contacted_at', private.iso(s.contacted_at),
      'consent', private.consent_brief(s.entrepreneur_id)
    ) order by s.display_name), '[]')
    from private.community_state(p_community_id) s
  );
end;
$$;

-- Outcomes count only businesses whose owners allowed their use in impact
-- figures; how many were left out is reported, never who.
create or replace function public.community_cohorts(p_community_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  return (
    with s as (select * from private.community_state(p_community_id)),
    measured as (
      select distinct on (po.loan_id) po.entrepreneur_id, po.evc_cents, po.capital_use,
        po.avg_revenue_after_cents > po.avg_revenue_before_cents as revenue_up,
        private.has_consent(po.entrepreneur_id, 'impact') as counted
      from public.productive_outcomes po
      where po.entrepreneur_id in (select entrepreneur_id from s)
      order by po.loan_id, po.outcome_no desc
    ),
    outcomes as (select * from measured where counted)
    select coalesce(jsonb_agg(c order by c ->> 'intake'), '[]')
    from (
      select jsonb_build_object(
        'intake', s.intake,
        'participants', count(*),
        'funnel', jsonb_build_object(
          'joined', count(*),
          'education', count(*) filter (where stage_no >= 1),
          'data_sufficient', count(*) filter (where stage_no >= 2),
          'credit_ready', count(*) filter (where stage_no >= 3),
          'credit_intent', count(*) filter (where stage_no >= 4),
          'eligible', count(*) filter (where stage_no >= 5),
          'referred', count(*) filter (where stage_no >= 6),
          'financed', count(*) filter (where stage_no >= 7)
        ),
        'days_to_ready', jsonb_build_object(
          'le_30', count(*) filter (where first_ready_at - joined_at <= interval '30 days'),
          'd31_60', count(*) filter (where first_ready_at - joined_at > interval '30 days' and first_ready_at - joined_at <= interval '60 days'),
          'd61_90', count(*) filter (where first_ready_at - joined_at > interval '60 days' and first_ready_at - joined_at <= interval '90 days'),
          'gt_90', count(*) filter (where first_ready_at - joined_at > interval '90 days'),
          'not_yet', count(*) filter (where first_ready_at is null),
          'median', percentile_cont(0.5) within group (order by extract(epoch from first_ready_at - joined_at) / 86400)
                      filter (where first_ready_at is not null)
        ),
        'not_ready_reasons', (
          select coalesce(jsonb_object_agg(code, n), '{}')
          from (
            select mr ->> 'code' as code, count(*) as n
            from s s2, jsonb_array_elements(coalesce(s2.missing_requirements, '[]')) mr
            where s2.intake = s.intake and s2.readiness_status in ('NEEDS_MORE_DATA', 'NEEDS_PREPARATION')
            group by 1
          ) x
        ),
        'manual_review', count(*) filter (where readiness_status = 'MANUAL_REVIEW' or eligibility_decision = 'MANUAL_REVIEW'),
        'need_by_purpose', (
          select coalesce(jsonb_object_agg(purpose, jsonb_build_object('n', n, 'cents', cents)), '{}')
          from (
            select s3.intent_purpose as purpose, count(*) as n, sum(s3.intent_cents) as cents
            from s s3 where s3.intake = s.intake and s3.intent_purpose is not null group by 1
          ) x
        ),
        'operations', jsonb_build_object(
          'referred', count(*) filter (where referred_at is not null),
          'approved', count(*) filter (where opportunity_status = 'partner_approved'),
          'disbursed', count(*) filter (where loan_status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED'))
        ),
        'outcomes', (
          select jsonb_build_object(
            'measured', count(*),
            'revenue_up', count(*) filter (where o.revenue_up),
            'as_declared', count(*) filter (where o.capital_use = 'as_declared'),
            'evc_cents', coalesce(sum(o.evc_cents), 0),
            'evc_positive', count(*) filter (where o.evc_cents > 0),
            'withheld', (select count(*) from measured m join s s5 on s5.entrepreneur_id = m.entrepreneur_id
                         where s5.intake = s.intake and not m.counted)
          )
          from outcomes o join s s4 on s4.entrepreneur_id = o.entrepreneur_id
          where s4.intake = s.intake
        )
      ) as c
      from s
      group by s.intake
    ) cohorts
  );
end;
$$;

create or replace function public.community_participant(p_community_id uuid, p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_state jsonb;
begin
  if not private.can_see_community(p_community_id) then
    raise exception 'not_allowed_to_see_community' using errcode = '42501';
  end if;
  select to_jsonb(s) into v_state from private.community_state(p_community_id) s where s.entrepreneur_id = p_entrepreneur_id;
  if v_state is null then
    raise exception 'not_a_member' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'state', v_state,
    'consent', private.consent_brief(p_entrepreneur_id),
    'education', (
      select coalesce(jsonb_agg(jsonb_build_object('module_id', md.id, 'title', md.title, 'position', md.position,
          'program', pr.title, 'core', pr.community_id is null, 'status', ep.status, 'completed_at', private.iso(ep.completed_at))
        order by pr.community_id nulls first, md.position), '[]')
      from public.education_modules md
      join public.education_programs pr on pr.id = md.program_id
      left join public.education_progress ep on ep.module_id = md.id and ep.entrepreneur_id = p_entrepreneur_id
      where pr.community_id is null or pr.community_id = p_community_id
    ),
    'timeline', (
      select coalesce(jsonb_agg(t order by t ->> 'at'), '[]') from (
        select jsonb_build_object('at', private.iso(m.joined_at), 'kind', 'joined', 'label', c.name,
          'proof', private.proof_brief('enrollment', p_entrepreneur_id)) as t
        from public.community_memberships m join public.communities c on c.id = m.community_id
        where m.entrepreneur_id = p_entrepreneur_id and m.community_id = p_community_id
        union all
        select jsonb_build_object('at', private.iso(k.created_at), 'kind', 'consent', 'label', k.consent_no::text,
          'detail', jsonb_build_object('assessment', k.assessment, 'partner', k.partner, 'investors', k.investors,
            'impact', k.impact, 'channel', k.channel),
          'proof', private.proof_brief('consent', k.id))
        from public.consents k where k.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ep.completed_at), 'kind', 'education', 'label', md.title)
        from public.education_progress ep join public.education_modules md on md.id = ep.module_id
        where ep.entrepreneur_id = p_entrepreneur_id and ep.status = 'completed'
        union all
        select jsonb_build_object('at', private.iso(ck.created_at), 'kind', 'checkin', 'label', ck.period,
          'detail', jsonb_build_object('keeps_records', ck.keeps_records), 'proof', private.proof_brief('checkin', ck.id))
        from public.checkins ck where ck.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ra.created_at), 'kind', 'readiness', 'label', ra.status,
          'detail', jsonb_build_object('score', ra.score, 'band', ra.band, 'model_version', ra.model_version,
            'missing', ra.missing_requirements, 'reasons', to_jsonb(ra.reason_codes)),
          'proof', private.proof_brief('readiness', ra.id))
        from public.readiness_assessments ra where ra.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ci.created_at), 'kind', 'intent', 'label', ci.purpose,
          'detail', jsonb_build_object('amount_cents', ci.requested_amount_cents, 'status', ci.status))
        from public.credit_intents ci where ci.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(ci.withdrawn_at), 'kind', 'intent_withdrawn', 'label', ci.purpose)
        from public.credit_intents ci where ci.entrepreneur_id = p_entrepreneur_id and ci.withdrawn_at is not null
        union all
        select jsonb_build_object('at', private.iso(ea.created_at), 'kind', 'eligibility', 'label', ea.decision,
          'detail', jsonb_build_object('reasons', to_jsonb(ea.reason_codes), 'model_version', ea.model_version),
          'proof', private.proof_brief('eligibility', ea.id))
        from public.eligibility_assessments ea where ea.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(q.referred_at), 'kind', 'referred', 'label', q.purpose,
          'proof', private.proof_brief('opportunity', q.id))
        from public.qualified_credit_opportunities q where q.entrepreneur_id = p_entrepreneur_id and q.referred_at is not null
        union all
        select jsonb_build_object('at', private.iso(pd.created_at), 'kind', 'partner_decision', 'label', pd.verdict)
        from public.partner_decisions pd join public.qualified_credit_opportunities q on q.id = pd.opportunity_id
        where q.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(le.created_at), 'kind', 'loan', 'label', le.to_status,
          'proof', private.proof_brief('loan_transition', le.id))
        from public.loan_events le join public.loans l on l.id = le.loan_id
        where l.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(p.paid_at), 'kind', 'payment', 'label', p.instalment_no::text,
          'proof', private.proof_brief('payment', p.id))
        from public.payments p join public.loans l on l.id = p.loan_id
        where l.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(po.measured_at), 'kind', 'outcome', 'label', po.capital_use,
          'proof', private.proof_brief('outcome', po.id))
        from public.productive_outcomes po where po.entrepreneur_id = p_entrepreneur_id
        union all
        select jsonb_build_object('at', private.iso(oe.created_at), 'kind', 'outreach', 'label', oe.action,
          'detail', jsonb_build_object('note', oe.note))
        from public.outreach_events oe
        where oe.entrepreneur_id = p_entrepreneur_id and oe.community_id = p_community_id
      ) x
    )
  );
end;
$$;

-- -------------------------------------------------------------- demo reset

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
  delete from public.investments where true;
  delete from public.productive_outcomes where true;
  delete from public.payments where true;
  delete from public.loan_events where true;
  delete from public.loans where true;
  delete from public.partner_decisions where true;
  delete from public.qualified_credit_opportunities where true;
  delete from public.eligibility_assessments where true;
  delete from public.credit_intents where true;
  delete from public.readiness_assessments where true;
  delete from public.checkins where true;
  delete from public.consents where true;
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

-- ------------------------------------------------------------------ grants

revoke all on function private.consent_text_version(), private.has_consent(uuid, text),
  private.had_consent(uuid, text, timestamptz), private.consent_brief(uuid), private.apply_consent() from public;
grant execute on function private.consent_text_version(), private.has_consent(uuid, text),
  private.had_consent(uuid, text, timestamptz), private.consent_brief(uuid) to authenticated, service_role;
revoke all on function public.record_consent(boolean, boolean, boolean, boolean, uuid) from public, anon;
grant execute on function public.record_consent(boolean, boolean, boolean, boolean, uuid) to authenticated;

-- ---------------------------------------------------------------- backfill

-- The demo's existing participants joined before consent was recorded here:
-- their communities collected it on paper at enrollment, all four scopes
-- given. Marked simulated, recorded as the community's, dated when they
-- joined, and proven on chain like any other record. The next reseed
-- replaces them.
insert into public.consents (
  entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel, recorded_by,
  is_simulated, created_at
)
select m.entrepreneur_id, 1, private.consent_text_version(), true, true, true, true, 'community', co.leader_id,
  true, m.joined_at
from (
  select distinct on (entrepreneur_id) entrepreneur_id, community_id, joined_at
  from public.community_memberships order by entrepreneur_id, joined_at
) m
join public.communities co on co.id = m.community_id
where not exists (select 1 from public.consents k where k.entrepreneur_id = m.entrepreneur_id);

insert into public.chain_anchors (kind, entity_id, depends_on)
select 'consent', k.id, private.enrollment_anchor(k.entrepreneur_id)
from public.consents k
where private.enrollment_anchor(k.entrepreneur_id) is not null
  and not exists (select 1 from public.chain_anchors a where a.kind = 'consent' and a.entity_id = k.id);
