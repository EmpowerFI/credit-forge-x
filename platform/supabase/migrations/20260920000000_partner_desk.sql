-- The partner's desk: funding states, formalisation, servicing.
--
-- Founder decision R1: investors fund an opportunity right after eligibility;
-- the partner, lender of record, decides, formalises and disburses. If the
-- partner declines — before approving, or at formalisation, once the contract
-- is to be signed — the investors are refunded.
--
-- Until now, cancelling an approved loan left its investors' capital
-- allocated to a loan that would never exist. A cancellation is now a decline
-- at formalisation: it needs a reason, the opportunity becomes declined, and
-- open_for_funding and refund_on_close return what investors put in.
--
-- partner_desk() is everything the desk shows, in one read: the opportunities
-- referred to this partner with their funding, the partner's decisions, and
-- each loan with its schedule, what is overdue, where the money went and every
-- proof. Participants appear under the partner's P- code, never by name.

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
  -- The partner disburses only capital that is there: while investors are
  -- still funding, it waits. An opportunity never listed, or taken off the
  -- market, is lent from the partner's own capital.
  if p_to = 'DISBURSED' and (select funding_status from public.qualified_credit_opportunities where id = v_loan.opportunity_id)
       in ('open', 'partially_funded') then
    raise exception 'not_fully_funded' using errcode = 'P0001';
  end if;
  if p_to = 'PAID' and (select count(*) from public.payments where loan_id = p_loan_id) < v_loan.term_months then
    raise exception 'instalments_outstanding' using errcode = 'P0001';
  end if;
  if p_to = 'CANCELLED' and nullif(trim(p_note), '') is null then
    raise exception 'reason_required' using errcode = '22023';
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

  -- Declined at formalisation: the opportunity closes and its investors are
  -- owed their capital back (open_for_funding, then refund_on_close).
  if p_to = 'CANCELLED' then
    update public.qualified_credit_opportunities set status = 'partner_declined'
    where id = v_loan.opportunity_id and status = 'partner_approved';
  end if;
end;
$$;

-- An opportunity's funding as the partner sees it: how much, from how many,
-- and how much of it is real devnet USDC. Never who.
create function private.partner_funding(p_opportunity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'status', o.funding_status,
    'target_micro_usdc', o.funding_target_micro_usdc,
    'funded_micro_usdc', o.funded_micro_usdc,
    'fx_brl_per_usdc_milli', o.fx_brl_per_usdc_milli,
    'investors', (select count(distinct i.investor_id) from public.investments i where i.opportunity_id = o.id),
    'real_micro_usdc', (select coalesce(sum(i.amount_micro_usdc), 0) from public.investments i
      where i.opportunity_id = o.id and not i.is_simulated and i.mode in ('wallet', 'zcash')),
    'refund_due', (select count(*) from public.investments i where i.opportunity_id = o.id and i.status = 'refund_due'),
    'refunded', (select count(*) from public.investments i where i.opportunity_id = o.id and i.status = 'refunded')
  )
  from public.qualified_credit_opportunities o where o.id = p_opportunity_id
$$;

create function private.partner_code(p_entrepreneur_id uuid)
returns text
language sql immutable set search_path = ''
as $$ select 'P-' || upper(left(replace(p_entrepreneur_id::text, '-', ''), 6)) $$;

create function private.anchor_brief(p_kind public.anchor_kind, p_entity_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('kind', a.kind, 'entity_id', a.entity_id, 'status', a.status, 'signature', a.signature,
    'account', a.account_address, 'reconcile', a.reconcile, 'confirmed_at', private.iso(a.confirmed_at))
  from public.chain_anchors a where a.kind = p_kind and a.entity_id = p_entity_id
$$;

-- Instalments due by now on an active loan: one a month from when repayment started.
create function private.instalments_due(p_active_since timestamptz, p_term integer)
returns integer
language sql stable set search_path = ''
as $$
  select case when p_active_since is null then 0 else least(p_term, greatest(0,
    (extract(year from age(now(), p_active_since)) * 12 + extract(month from age(now(), p_active_since)))::integer)) end
$$;

create function public.partner_desk()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_partner uuid := private.my_partner_id();
begin
  if v_partner is null and not private.is_auditor_or_admin() then
    raise exception 'not_a_partner' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'partner', (select jsonb_build_object('name', p.name, 'kind', p.kind,
        'min_ticket_cents', p.min_ticket_cents, 'max_ticket_cents', p.max_ticket_cents)
      from public.partners p where p.id = v_partner),
    'fx_brl_per_usdc_milli', private.demo_brl_per_usdc_milli(),
    'ramp_bps', private.ramp_bps(),

    -- Every opportunity referred to this partner.
    'opportunities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'opportunity_id', o.id,
        'participant', private.partner_code(o.entrepreneur_id),
        'status', o.status,
        'amount_cents', o.amount_cents,
        'requested_amount_cents', e.requested_amount_cents,
        'term_months', o.term_months,
        'instalment_cents', o.instalment_cents,
        'purpose', o.purpose,
        'risk_band', o.risk_band,
        'confidence', o.confidence,
        'eligibility_decision', e.decision,
        'eligibility_model', e.model_version,
        'max_instalment_cents', e.max_instalment_cents,
        'affordability_bps', e.affordability_bps,
        'suggested_min_cents', e.suggested_min_cents,
        'suggested_max_cents', e.suggested_max_cents,
        'eligibility_reasons', to_jsonb(e.reason_codes),
        'readiness_band', r.band,
        'readiness_model', r.model_version,
        'months_reported', (r.features ->> 'months_reported')::integer,
        -- Rounded to R$ 100: enough to judge, not a ledger.
        'avg_revenue_cents', round((r.features ->> 'avg_revenue_cents')::numeric, -4)::bigint,
        'avg_net_business_cents', round((r.features ->> 'avg_net_business_cents')::numeric, -4)::bigint,
        'revenue_cv_bps', (r.features ->> 'revenue_cv_bps')::integer,
        'business_sector', en.business_sector,
        'community_name', c.name, 'community_city', c.city, 'community_state', c.state,
        'referred_at', private.iso(o.referred_at),
        'is_simulated', o.is_simulated,
        'funding', private.partner_funding(o.id),
        'decision', (select jsonb_build_object('id', d.id, 'verdict', d.verdict,
            'approved_amount_cents', d.approved_amount_cents, 'rate_bps', d.rate_bps, 'term_months', d.term_months,
            'reason', d.reason, 'decided_at', private.iso(d.created_at), 'decided_by', pr.display_name)
          from public.partner_decisions d left join public.profiles pr on pr.id = d.decided_by
          where d.opportunity_id = o.id order by d.created_at desc limit 1),
        'loan', (select jsonb_build_object('id', l.id, 'status', l.status) from public.loans l where l.opportunity_id = o.id),
        'proof', private.anchor_brief('opportunity', o.id)
      ) order by o.referred_at desc)
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
      where o.partner_id is not null and (o.partner_id = v_partner or v_partner is null)
    ), '[]'),

    -- Every loan, with its servicing.
    'loans', coalesce((
      select jsonb_agg(x.loan order by x.created_at desc) from (
        select l.created_at, jsonb_build_object(
          'id', l.id,
          'opportunity_id', l.opportunity_id,
          'participant', private.partner_code(l.entrepreneur_id),
          'status', l.status,
          'principal_cents', l.principal_cents,
          'rate_bps', l.rate_bps,
          'term_months', l.term_months,
          'instalment_cents', l.instalment_cents,
          'purpose', o.purpose,
          'risk_band', o.risk_band,
          'business_sector', en.business_sector,
          'created_at', private.iso(l.created_at),
          'disbursed_at', private.iso(l.disbursed_at),
          'active_since', private.iso(s.active_since),
          'paid', s.paid,
          'received_cents', s.received,
          'due_now', private.instalments_due(s.active_since, l.term_months),
          'overdue', case when l.status = 'ACTIVE'
            then greatest(0, private.instalments_due(s.active_since, l.term_months) - s.paid) else 0 end,
          'next_due_at', case when l.status = 'ACTIVE' and s.active_since is not null then
            private.iso(s.active_since + make_interval(months => (
              select min(n) from generate_series(1, l.term_months) n
              where not exists (select 1 from public.payments p where p.loan_id = l.id and p.instalment_no = n)))) end,
          'funding', private.partner_funding(l.opportunity_id),
          'proof', private.anchor_brief('loan', l.id),
          -- Investor capital leaves the vault for the ramp, which pays her in reais.
          'release', (select jsonb_build_object('status', g.status, 'amount_micro_usdc', g.amount_micro_usdc,
              'signature', t.signature, 'at', private.iso(t.confirmed_at))
            from public.settlement_legs g left join public.vault_transfers t on t.id = g.transfer_id
            where g.kind = 'release' and g.loan_id = l.id),
          'pix_payout', (select jsonb_build_object('e2e', g.pix_e2e, 'amount_cents', g.amount_cents, 'at', private.iso(g.done_at))
            from public.settlement_legs g where g.kind = 'pix_payout' and g.loan_id = l.id),
          'schedule', coalesce((
            select jsonb_agg(jsonb_build_object(
              'instalment_no', n,
              'due_at', case when s.active_since is not null then private.iso(s.active_since + make_interval(months => n)) end,
              'amount_cents', coalesce(p.amount_cents, l.instalment_cents),
              'payment_id', p.id,
              'paid_at', private.iso(p.paid_at),
              'late', case
                when p.id is not null then s.active_since is not null and p.paid_at > s.active_since + make_interval(months => n)
                else l.status = 'ACTIVE' and s.active_since is not null and now() > s.active_since + make_interval(months => n) end,
              'pix_e2e', (select g.pix_e2e from public.settlement_legs g where g.kind = 'pix_in' and g.payment_id = p.id),
              'proof', case when p.id is not null then private.anchor_brief('payment', p.id) end,
              -- The investors' shares of it, back through the ramp: how much, and where each stands.
              'to_investors', (select jsonb_build_object(
                  'amount_micro_usdc', coalesce(sum(g.amount_micro_usdc), 0),
                  'done', count(*) filter (where g.status = 'done'),
                  'pending', count(*) filter (where g.status in ('due', 'sending')),
                  'held', count(*) filter (where g.status = 'held'),
                  'failed', count(*) filter (where g.status = 'failed'),
                  'signatures', coalesce(jsonb_agg(distinct t.signature) filter (where t.signature is not null), '[]'))
                from public.settlement_legs g left join public.vault_transfers t on t.id = g.transfer_id
                where g.kind = 'payout' and g.payment_id = p.id)
            ) order by n)
            from generate_series(1, l.term_months) n
            left join public.payments p on p.loan_id = l.id and p.instalment_no = n
          ), '[]'),
          'events', coalesce((
            select jsonb_agg(jsonb_build_object('id', ev.id, 'from_status', ev.from_status, 'to_status', ev.to_status,
                'note', ev.note, 'at', private.iso(ev.created_at), 'proof', private.anchor_brief('loan_transition', ev.id))
              order by ev.created_at, ev.to_status)
            from public.loan_events ev where ev.loan_id = l.id
          ), '[]'),
          'outcome', (select jsonb_build_object('id', po.id, 'avg_revenue_before_cents', po.avg_revenue_before_cents,
              'avg_revenue_after_cents', po.avg_revenue_after_cents, 'evc_cents', po.evc_cents,
              'capital_use', po.capital_use, 'confidence', po.confidence, 'measured_at', private.iso(po.measured_at),
              'proof', private.anchor_brief('outcome', po.id))
            from public.productive_outcomes po where po.loan_id = l.id order by po.outcome_no desc limit 1)
        ) as loan
        from public.loans l
        join public.qualified_credit_opportunities o on o.id = l.opportunity_id
        join public.entrepreneurs en on en.id = l.entrepreneur_id
        cross join lateral (
          select
            (select min(ev.created_at) from public.loan_events ev where ev.loan_id = l.id and ev.to_status = 'ACTIVE') as active_since,
            (select count(*)::integer from public.payments p where p.loan_id = l.id) as paid,
            (select coalesce(sum(p.amount_cents), 0)::bigint from public.payments p where p.loan_id = l.id) as received
        ) s
        where l.partner_id = v_partner or v_partner is null
      ) x
    ), '[]')
  );
end;
$$;

revoke all on function private.partner_funding(uuid), private.partner_code(uuid),
  private.anchor_brief(public.anchor_kind, uuid), private.instalments_due(timestamptz, integer) from public;
grant execute on function private.partner_funding(uuid), private.partner_code(uuid),
  private.anchor_brief(public.anchor_kind, uuid), private.instalments_due(timestamptz, integer) to authenticated, service_role;
revoke all on function public.partner_desk() from public, anon;
grant execute on function public.partner_desk() to authenticated;

-- A simulated position has no USDC in the vault to send back: when its
-- opportunity closes it is refunded at once, instead of waiting forever as
-- due. Real ones stay due until the vault's transfer confirms.
create or replace function private.refund_on_close() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.funding_status = 'refunded' and old.funding_status is distinct from 'refunded' then
    update public.investments
    set status = (case when is_simulated or mode = 'simulated' then 'refunded' else 'refund_due' end)::public.investment_status,
        refunded_at = case when is_simulated or mode = 'simulated' then now() else refunded_at end
    where opportunity_id = new.id and status = 'allocated';
  end if;
  return new;
end;
$$;

update public.investments set status = 'refunded', refunded_at = coalesce(refunded_at, now())
where status = 'refund_due' and (is_simulated or mode = 'simulated');
