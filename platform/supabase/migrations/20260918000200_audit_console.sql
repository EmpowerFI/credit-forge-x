-- M15 · the audit console
--
-- Phase 3 of PLAN_REDESIGN.md: what an auditor needs to check the platform
-- without taking anyone's word for it. Five readers, auditors and admins only:
--
--   audit_attestations  every proof: state, commitment, transaction, when,
--                       which model and schema, and what reconciliation found
--   audit_events        what happened, who did it (by role), and its proof
--   audit_models        the engines in use, and a sample to re-run in the browser
--   audit_consents      consent as recorded, and whether it was enforced
--   audit_system        the queues and jobs that keep the proofs moving
--
-- Participants appear by code (P-…), never by name: an auditor checks facts,
-- not identities. What the facts contain stays behind audit_record, one
-- proof at a time.

create function private.participant_code(p_entrepreneur_id uuid)
returns text
language sql immutable set search_path = ''
as $$ select 'P-' || upper(left(replace(p_entrepreneur_id::text, '-', ''), 6)) $$;

create function private.actor_role(p_profile_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select role::text from public.profiles where id = p_profile_id), 'system') $$;

create function private.require_auditor()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_auditor_or_admin() then
    raise exception 'not_an_auditor' using errcode = '42501';
  end if;
end;
$$;

-- ----------------------------------------------------------- attestations

create function public.audit_attestations(
  p_kind public.anchor_kind default null,
  p_state text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.require_auditor();
  with f as (
    select a.* from public.chain_anchors a
    where (p_kind is null or a.kind = p_kind)
      and (p_state is null
        or (p_state = 'queued' and a.status in ('pending', 'submitted'))
        or (p_state = 'failed' and a.status = 'failed')
        or (p_state = 'verified' and a.status = 'confirmed' and a.reconcile = 'verified')
        or (p_state = 'unchecked' and a.status = 'confirmed' and a.reconcile = 'unchecked')
        or (p_state = 'flagged' and a.reconcile in ('missing', 'mismatch')))
  ),
  page as (
    select * from f order by id desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'entity_id', a.entity_id, 'status', a.status,
        'reconcile', a.reconcile, 'reconcile_note', a.reconcile_note,
        'commitment', encode(a.commitment, 'hex'), 'account', a.account_address,
        'signature', a.signature, 'slot', a.slot, 'attempts', a.attempts, 'last_error', a.last_error,
        'created_at', private.iso(a.created_at), 'confirmed_at', private.iso(a.confirmed_at),
        'reconciled_at', private.iso(a.reconciled_at),
        'participant', case when private.anchor_entrepreneur(a.kind, a.entity_id) is not null
          then private.participant_code(private.anchor_entrepreneur(a.kind, a.entity_id)) end,
        'model_version', case a.kind
          when 'readiness' then (select r.model_version from public.readiness_assessments r where r.id = a.entity_id)
          when 'eligibility' then (select e.model_version from public.eligibility_assessments e where e.id = a.entity_id)
          when 'outcome' then (select po.model_version from public.productive_outcomes po where po.id = a.entity_id)
          when 'consent' then (select k.text_version from public.consents k where k.id = a.entity_id)
        end
      ) order by a.id desc)
      from page a
    ), '[]'),
    'by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}') from (
      select kind, count(*) as n from public.chain_anchors group by kind) k),
    'by_state', (select jsonb_build_object(
        'queued', count(*) filter (where status in ('pending', 'submitted')),
        'failed', count(*) filter (where status = 'failed'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'verified', count(*) filter (where status = 'confirmed' and reconcile = 'verified'),
        'unchecked', count(*) filter (where status = 'confirmed' and reconcile = 'unchecked'),
        'flagged', count(*) filter (where reconcile in ('missing', 'mismatch')))
      from public.chain_anchors)
  ) into v;
  return v;
end;
$$;

-- ----------------------------------------------------------------- events

-- The platform's event log, newest first: every fact, the role of whoever
-- caused it (or the system), the participant's code, and its proof.
create function public.audit_events(p_kind text default null, p_limit integer default 150)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.require_auditor();
  with ev as (
    select c.created_at as at, 'community_registered' as kind, null::uuid as entrepreneur_id, c.id as community_id,
      private.actor_role(c.leader_id) as actor, null::text as label, private.proof_brief('community', c.id) as proof
    from public.communities c
    union all
    select c.verified_at, 'community_verified', null, c.id, private.actor_role(c.verified_by), null,
      private.proof_brief('community_verification', c.id)
    from public.communities c where c.verified_at is not null
    union all
    select m.joined_at, 'enrolled', m.entrepreneur_id, m.community_id, 'community_leader', null,
      private.proof_brief('enrollment', m.entrepreneur_id)
    from public.community_memberships m
    union all
    select k.created_at, 'consent', k.entrepreneur_id, null,
      case k.channel when 'app' then 'entrepreneur' else private.actor_role(k.recorded_by) end,
      '#' || k.consent_no || ' · ' || concat_ws(', ',
        case when k.assessment then 'assessment' end, case when k.partner then 'partner' end,
        case when k.investors then 'investors' end, case when k.impact then 'impact' end),
      private.proof_brief('consent', k.id)
    from public.consents k
    union all
    select ck.created_at, 'checkin', ck.entrepreneur_id, null, private.actor_role(ck.submitted_by), ck.period,
      private.proof_brief('checkin', ck.id)
    from public.checkins ck
    union all
    select ra.created_at, 'readiness', ra.entrepreneur_id, null, 'system', ra.status::text || ' · ' || ra.model_version,
      private.proof_brief('readiness', ra.id)
    from public.readiness_assessments ra
    union all
    select ci.created_at, 'credit_intent', ci.entrepreneur_id, null, private.actor_role(ci.declared_by), ci.purpose::text, null
    from public.credit_intents ci
    union all
    select ea.created_at, 'eligibility', ea.entrepreneur_id, null, 'system', ea.decision::text || ' · ' || ea.model_version,
      private.proof_brief('eligibility', ea.id)
    from public.eligibility_assessments ea
    union all
    select q.referred_at, 'referred', q.entrepreneur_id, null, 'system', q.purpose::text, private.proof_brief('opportunity', q.id)
    from public.qualified_credit_opportunities q where q.referred_at is not null
    union all
    select pd.created_at, 'partner_decision', q.entrepreneur_id, null, private.actor_role(pd.decided_by), pd.verdict::text, null
    from public.partner_decisions pd join public.qualified_credit_opportunities q on q.id = pd.opportunity_id
    union all
    select le.created_at, 'loan', l.entrepreneur_id, null, private.actor_role(le.actor), le.to_status::text,
      private.proof_brief('loan_transition', le.id)
    from public.loan_events le join public.loans l on l.id = le.loan_id
    union all
    select p.paid_at, 'payment', l.entrepreneur_id, null, private.actor_role(p.recorded_by), '#' || p.instalment_no,
      private.proof_brief('payment', p.id)
    from public.payments p join public.loans l on l.id = p.loan_id
    union all
    select po.measured_at, 'outcome', po.entrepreneur_id, null, 'system', po.capital_use::text,
      private.proof_brief('outcome', po.id)
    from public.productive_outcomes po
    union all
    select i.created_at, 'investment', null, null, 'capital_provider', i.mode::text || ' · ' || private.opportunity_code(i.opportunity_id),
      private.proof_brief('allocation', i.id)
    from public.investments i
    union all
    select i.refunded_at, 'refund', null, null, 'system', private.opportunity_code(i.opportunity_id), null
    from public.investments i where i.refunded_at is not null
    union all
    select oe.created_at, 'outreach', oe.entrepreneur_id, oe.community_id, private.actor_role(oe.created_by), oe.action::text, null
    from public.outreach_events oe
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'at', private.iso(e.at), 'kind', e.kind, 'actor', e.actor, 'label', e.label,
      'participant', case when e.entrepreneur_id is not null then private.participant_code(e.entrepreneur_id) end,
      'community', coalesce(
        (select co.name from public.communities co where co.id = e.community_id),
        (select co.name from public.community_memberships m join public.communities co on co.id = m.community_id
         where m.entrepreneur_id = e.entrepreneur_id order by m.joined_at limit 1)),
      'proof', e.proof
    ) order by e.at desc), '[]')
  into v
  from (
    select * from ev
    where ev.at is not null and (p_kind is null or ev.kind = p_kind)
    order by ev.at desc
    limit greatest(1, least(coalesce(p_limit, 150), 500))
  ) e;
  return v;
end;
$$;

-- ----------------------------------------------------------------- models

-- The engines behind every decision: each version, how often it ran, when
-- first and last, and what it concluded.
create function public.audit_models()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  return jsonb_build_object(
    'readiness', (select coalesce(jsonb_agg(jsonb_build_object(
        'version', x.model_version, 'runs', x.n, 'first_at', private.iso(x.first_at), 'last_at', private.iso(x.last_at),
        'outcomes', (select jsonb_object_agg(status, n) from (
          select r2.status, count(*) as n from public.readiness_assessments r2
          where r2.model_version = x.model_version group by 1) s),
        'anchored', (select count(*) from public.readiness_assessments r3
          join public.chain_anchors a on a.kind = 'readiness' and a.entity_id = r3.id and a.status = 'confirmed'
          where r3.model_version = x.model_version)
      ) order by x.last_at desc), '[]')
      from (select model_version, count(*) as n, min(created_at) as first_at, max(created_at) as last_at
            from public.readiness_assessments group by 1) x),
    'eligibility', (select coalesce(jsonb_agg(jsonb_build_object(
        'version', x.model_version, 'runs', x.n, 'first_at', private.iso(x.first_at), 'last_at', private.iso(x.last_at),
        'outcomes', (select jsonb_object_agg(decision, n) from (
          select e2.decision, count(*) as n from public.eligibility_assessments e2
          where e2.model_version = x.model_version group by 1) s),
        'anchored', (select count(*) from public.eligibility_assessments e3
          join public.chain_anchors a on a.kind = 'eligibility' and a.entity_id = e3.id and a.status = 'confirmed'
          where e3.model_version = x.model_version)
      ) order by x.last_at desc), '[]')
      from (select model_version, count(*) as n, min(created_at) as first_at, max(created_at) as last_at
            from public.eligibility_assessments group by 1) x),
    'outcome', (select coalesce(jsonb_agg(jsonb_build_object(
        'version', x.model_version, 'runs', x.n, 'first_at', private.iso(x.first_at), 'last_at', private.iso(x.last_at),
        'outcomes', (select jsonb_object_agg(capital_use, n) from (
          select po2.capital_use, count(*) as n from public.productive_outcomes po2
          where po2.model_version = x.model_version group by 1) s),
        'anchored', (select count(*) from public.productive_outcomes po3
          join public.chain_anchors a on a.kind = 'outcome' and a.entity_id = po3.id and a.status = 'confirmed'
          where po3.model_version = x.model_version)
      ) order by x.last_at desc), '[]')
      from (select model_version, count(*) as n, min(measured_at) as first_at, max(measured_at) as last_at
            from public.productive_outcomes group by 1) x)
  );
end;
$$;

-- The latest assessments, exactly as committed, for the browser to re-run
-- through the same engines: determinism is checked, not claimed.
create function public.audit_model_sample(p_limit integer default 12)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
begin
  perform private.require_auditor();
  return jsonb_build_object(
    'readiness', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'payload', private.anchor_payload('readiness', r.id))), '[]')
      from (select id from public.readiness_assessments order by created_at desc limit v_limit) r),
    'eligibility', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'payload', private.anchor_payload('eligibility', e.id))), '[]')
      from (select id from public.eligibility_assessments order by created_at desc limit v_limit) e)
  );
end;
$$;

-- --------------------------------------------------------------- consents

-- Consent as recorded, and whether every assessment, referral and listing
-- happened with the consent in force at the time. Each check should read 0.
create function public.audit_consents()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  return (
    with enrolled as (select distinct entrepreneur_id from public.community_memberships),
    latest as (
      select distinct on (k.entrepreneur_id) k.* from public.consents k order by k.entrepreneur_id, k.consent_no desc
    )
    select jsonb_build_object(
      'enrolled', (select count(*) from enrolled),
      'with_record', (select count(*) from latest),
      'without_record', (select count(*) from enrolled en where not exists (
        select 1 from public.consents k where k.entrepreneur_id = en.entrepreneur_id)),
      'records', (select count(*) from public.consents),
      'changes', (select count(*) from public.consents where consent_no > 1),
      'by_scope', (select jsonb_build_object(
        'assessment', count(*) filter (where assessment), 'partner', count(*) filter (where partner),
        'investors', count(*) filter (where investors), 'impact', count(*) filter (where impact)) from latest),
      'by_channel', (select jsonb_build_object(
        'app', count(*) filter (where channel = 'app'), 'community', count(*) filter (where channel = 'community'))
        from public.consents),
      'anchored', (select count(*) from public.chain_anchors where kind = 'consent' and status = 'confirmed'),
      'checks', jsonb_build_object(
        'assessed_without_consent', (select count(*) from public.readiness_assessments r
          where not private.had_consent(r.entrepreneur_id, 'assessment', r.created_at)),
        'eligibility_without_consent', (select count(*) from public.eligibility_assessments e
          where not private.had_consent(e.entrepreneur_id, 'assessment', e.created_at)),
        'referred_without_consent', (select count(*) from public.qualified_credit_opportunities q
          where q.referred_at is not null and not private.had_consent(q.entrepreneur_id, 'partner', q.referred_at)),
        'listed_without_consent', (select count(*) from public.qualified_credit_opportunities q
          where q.funding_status in ('open', 'partially_funded') and not private.has_consent(q.entrepreneur_id, 'investors'))
      ),
      'recent', (select coalesce(jsonb_agg(r order by r ->> 'at' desc), '[]') from (
        select jsonb_build_object(
          'id', k.id, 'at', private.iso(k.created_at), 'participant', private.participant_code(k.entrepreneur_id),
          'community', (select co.name from public.community_memberships m join public.communities co on co.id = m.community_id
                        where m.entrepreneur_id = k.entrepreneur_id order by m.joined_at limit 1),
          'consent_no', k.consent_no, 'text_version', k.text_version,
          'assessment', k.assessment, 'partner', k.partner, 'investors', k.investors, 'impact', k.impact,
          'channel', k.channel, 'proof', private.proof_brief('consent', k.id)
        ) as r
        from public.consents k order by k.created_at desc limit 30) x)
    )
  );
end;
$$;

-- ----------------------------------------------------------------- system

-- The machinery: the anchor queue, reconciliation, refunds out of the vault,
-- what the vault should hold, and the scheduled jobs that drive them.
create function public.audit_system()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_jobs jsonb;
begin
  perform private.require_auditor();
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', j.jobname, 'schedule', j.schedule, 'active', j.active)
      order by j.jobname), '[]')
    into v_jobs from cron.job j;
  exception when others then
    v_jobs := null;
  end;

  return jsonb_build_object(
    'anchors', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'submitted', count(*) filter (where status = 'submitted'),
        'failed', count(*) filter (where status = 'failed'),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'oldest_queued_at', private.iso(min(created_at) filter (where status in ('pending', 'submitted'))),
        'last_confirmed_at', private.iso(max(confirmed_at)),
        'last_error', (select a.last_error from public.chain_anchors a
          where a.status = 'failed' order by a.id desc limit 1))
      from public.chain_anchors),
    'reconcile', (select jsonb_build_object(
        'verified', count(*) filter (where reconcile = 'verified'),
        'missing', count(*) filter (where reconcile = 'missing'),
        'mismatch', count(*) filter (where reconcile = 'mismatch'),
        'unchecked', count(*) filter (where reconcile = 'unchecked'),
        'last_at', private.iso(max(reconciled_at)),
        'oldest_at', private.iso(min(reconciled_at)))
      from public.chain_anchors where status = 'confirmed'),
    'refunds', (select jsonb_build_object(
        'due', count(*) filter (where status = 'refund_due' and refund_signature is null),
        'sending', count(*) filter (where status = 'refund_due' and refund_signature is not null),
        'refunded', count(*) filter (where status = 'refunded'),
        'last_at', private.iso(max(refunded_at)),
        'last_error', (select i.refund_error from public.investments i
          where i.refund_error is not null order by i.created_at desc limit 1))
      from public.investments where mode = 'wallet'),
    -- Real deposits still in the vault: allocated, or owed back and not yet sent.
    'vault', (select jsonb_build_object(
        'expected_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where status in ('allocated', 'refund_due')), 0),
        'deposited_micro_usdc', coalesce(sum(amount_micro_usdc), 0),
        'refunded_micro_usdc', coalesce(sum(amount_micro_usdc) filter (where status = 'refunded'), 0),
        'deposits', count(*))
      from public.investments where mode = 'wallet'),
    'jobs', v_jobs
  );
end;
$$;

revoke all on function private.participant_code(uuid), private.actor_role(uuid), private.require_auditor() from public;
grant execute on function private.participant_code(uuid), private.actor_role(uuid), private.require_auditor()
  to authenticated, service_role;
revoke all on function public.audit_attestations(public.anchor_kind, text, integer, integer),
  public.audit_events(text, integer), public.audit_models(), public.audit_model_sample(integer),
  public.audit_consents(), public.audit_system() from public, anon;
grant execute on function public.audit_attestations(public.anchor_kind, text, integer, integer),
  public.audit_events(text, integer), public.audit_models(), public.audit_model_sample(integer),
  public.audit_consents(), public.audit_system() to authenticated;
