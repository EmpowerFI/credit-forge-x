-- Shareable audit reports.
--
-- An auditor freezes what the audit console shows into a report and shares
-- it by link: a judge, a partner's risk team or a regulator opens it without
-- an account and checks it against Solana from their own browser.
--
-- What a report holds is chosen here, field by field, never copied wholesale
-- from the console: counts and states, the vault's ledger, the models in use,
-- whether consent was enforced, the Zcash treasury's received notes (by
-- transaction, never their memos), the vault's transfers, and the latest
-- proofs with their commitments and transactions. No name, no participant
-- code, no record's content, no viewing key, no error text (an RPC error can
-- carry a provider's key). The auditor's own browser checks — decisions
-- re-run, the vault read on chain, proofs looked up — go in beside it,
-- labelled as theirs.
--
-- The link's token is the only credential: 24 random bytes. Revoking a report
-- closes its link.

create table public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  title text not null check (char_length(title) between 1 and 120),
  snapshot jsonb not null,
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object' and pg_column_size(checks) < 65536),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.audit_reports enable row level security;
revoke all on public.audit_reports from anon, authenticated;
grant select on public.audit_reports to authenticated;
create policy audit_reports_read on public.audit_reports for select to authenticated
  using ((select private.is_auditor_or_admin()));

-- The program and the token it holds, for a reader who checks on chain.
create function private.chain_constants()
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'cluster', 'devnet',
    'program_id', '4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR',
    'usdc_mint', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
  )
$$;

create function private.audit_snapshot(p_proofs integer default 120)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_ledger jsonb := private.vault_ledger();
  v_consents jsonb := public.audit_consents();
begin
  perform private.require_auditor();
  return jsonb_build_object(
    'generated_at', private.iso(now()),
    'chain', private.chain_constants(),

    'anchors', (select jsonb_build_object(
        'total', count(*),
        'confirmed', count(*) filter (where status = 'confirmed'),
        'queued', count(*) filter (where status in ('pending', 'submitted')),
        'failed', count(*) filter (where status = 'failed'),
        'verified', count(*) filter (where status = 'confirmed' and reconcile = 'verified'),
        'mismatch', count(*) filter (where status = 'confirmed' and reconcile = 'mismatch'),
        'missing', count(*) filter (where status = 'confirmed' and reconcile = 'missing'),
        'unchecked', count(*) filter (where status = 'confirmed' and reconcile = 'unchecked'),
        'first_confirmed_at', private.iso(min(confirmed_at)),
        'last_confirmed_at', private.iso(max(confirmed_at)),
        'last_reconciled_at', private.iso(max(reconciled_at)),
        'by_kind', (select coalesce(jsonb_object_agg(k.kind, jsonb_build_object(
            'total', k.total, 'confirmed', k.confirmed, 'verified', k.verified)), '{}')
          from (select kind, count(*) total, count(*) filter (where status = 'confirmed') confirmed,
                  count(*) filter (where reconcile = 'verified') verified
                from public.chain_anchors group by kind) k))
      from public.chain_anchors),

    'models', public.audit_models(),

    -- Consent as audit_consents reads it, without its list of recent records.
    'consent', v_consents - 'recent',

    'credit', jsonb_build_object(
      'communities', (select count(*) from public.communities where status = 'verified'),
      'participants', (select count(distinct entrepreneur_id) from public.community_memberships),
      'credit_ready', (select count(*) from (
          select distinct on (entrepreneur_id) status from public.readiness_assessments
          order by entrepreneur_id, assessment_no desc) r where r.status = 'CREDIT_READY'),
      'eligibility', (select coalesce(jsonb_object_agg(decision, n), '{}') from (
          select decision, count(*) n from public.eligibility_assessments group by decision) e),
      'referred', (select count(*) from public.qualified_credit_opportunities where referred_at is not null),
      'decisions', (select coalesce(jsonb_object_agg(verdict, n), '{}') from (
          select verdict, count(*) n from public.partner_decisions group by verdict) d),
      'loans', (select coalesce(jsonb_object_agg(status, n), '{}') from (
          select status, count(*) n from public.loans group by status) l),
      'lent_cents', (select coalesce(sum(principal_cents), 0) from public.loans
          where status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')),
      'instalments', (select count(*) from public.payments),
      'repaid_cents', (select coalesce(sum(amount_cents), 0) from public.payments),
      'outcomes', (select count(*) from public.productive_outcomes)
    ),

    'vault', jsonb_build_object(
      'expected_micro_usdc', (v_ledger ->> 'in_vault_micro_usdc')::bigint,
      'deposits_micro_usdc', (v_ledger ->> 'deposits_micro_usdc')::bigint,
      'released_micro_usdc', (v_ledger ->> 'released_micro_usdc')::bigint,
      'repaid_in_micro_usdc', (v_ledger ->> 'repaid_in_micro_usdc')::bigint,
      'paid_out_micro_usdc', (v_ledger ->> 'paid_out_micro_usdc')::bigint,
      'deposits', (select count(*) from public.investments where mode in ('wallet', 'zcash') and not is_simulated),
      'zcash_micro_usdc', (select coalesce(sum(amount_micro_usdc), 0) from public.investments
          where mode = 'zcash' and not is_simulated and status in ('allocated', 'refund_due')),
      'refunded', (select count(*) from public.investments where mode in ('wallet', 'zcash') and not is_simulated and status = 'refunded'),
      'refunded_micro_usdc', (select coalesce(sum(amount_micro_usdc), 0) from public.investments
          where mode in ('wallet', 'zcash') and not is_simulated and status = 'refunded'),
      'simulated_positions', (select count(*) from public.investments where is_simulated or mode = 'simulated')
    ),

    'settlement', jsonb_build_object(
      'legs', (select coalesce(jsonb_object_agg(k, n), '{}') from (
          select kind::text || ':' || status::text k, count(*) n from public.settlement_legs group by kind, status) s),
      'transfers', (select coalesce(jsonb_agg(jsonb_build_object(
          'kind', t.kind, 'signature', t.signature, 'inflow_micro_usdc', t.inflow_micro_usdc,
          'outflow_micro_usdc', t.outflow_micro_usdc, 'at', private.iso(t.confirmed_at)) order by t.id), '[]')
        from public.vault_transfers t where t.status = 'confirmed'),
      -- Every real deposit into the vault by wallet, by its transaction: public
      -- on Solana already, and never with the opportunity it funds.
      'deposits', (select coalesce(jsonb_agg(jsonb_build_object(
          'signature', i.deposit_signature, 'amount_micro_usdc', i.amount_micro_usdc, 'at', private.iso(i.created_at))
          order by i.created_at), '[]')
        from public.investments i where i.mode = 'wallet' and not i.is_simulated),
      'refunds', (select coalesce(jsonb_agg(jsonb_build_object(
          'signature', i.refund_signature, 'amount_micro_usdc', i.amount_micro_usdc, 'at', private.iso(i.refunded_at))
          order by i.refunded_at), '[]')
        from public.investments i where i.status = 'refunded' and i.refund_signature is not null)
    ),

    'zcash', (select jsonb_build_object(
        'network', t.network, 'address', t.address, 'birthday_height', t.birthday_height,
        'scanned_height', t.scanned_height, 'confirmations_needed', private.zcash_confirmations(),
        'received_zat', (select coalesce(sum(value_zat), 0) from public.zcash_receipts),
        'receipts', (select coalesce(jsonb_agg(jsonb_build_object(
            'txid', r.txid, 'pool', r.pool, 'value_zat', r.value_zat, 'height', r.mined_height,
            'credited', z.credit_signature is not null, 'credit_signature', z.credit_signature) order by r.mined_height), '[]')
          from public.zcash_receipts r left join public.zcash_payment_requests z on z.id = r.request_id),
        -- What it paid back, in shielded ZEC: by transaction, never by address.
        'returns', (select coalesce(jsonb_agg(jsonb_build_object(
            'kind', x.kind, 'txid', x.txid, 'amount_zat', x.amount_zat, 'amount_micro_usdc', x.amount_micro_usdc,
            'sent_at', private.iso(x.sent_at)) order by x.sent_at), '[]')
          from public.zcash_returns x where x.status = 'sent'))
      from private.zcash_treasury t where t.id),

    -- The latest proofs: enough for anyone to look up on chain themselves.
    'proofs', (select coalesce(jsonb_agg(jsonb_build_object(
        'kind', a.kind, 'commitment', encode(a.commitment, 'hex'), 'account', a.account_address,
        'signature', a.signature, 'slot', a.slot, 'confirmed_at', private.iso(a.confirmed_at), 'reconcile', a.reconcile)
        order by a.confirmed_at desc), '[]')
      from (select * from public.chain_anchors where status = 'confirmed' and signature is not null
            order by confirmed_at desc limit greatest(1, least(p_proofs, 500))) a)
  );
end;
$$;

create function public.create_audit_report(p_title text, p_checks jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v public.audit_reports;
begin
  perform private.require_auditor();
  insert into public.audit_reports (title, snapshot, checks, created_by)
  values (coalesce(nullif(trim(p_title), ''), 'EmpowerFI audit report'), private.audit_snapshot(), coalesce(p_checks, '{}'::jsonb), auth.uid())
  returning * into v;
  return jsonb_build_object('id', v.id, 'token', v.token, 'created_at', private.iso(v.created_at));
end;
$$;

-- The checks the auditor's browser ran against the report's own snapshot, once
-- it exists: proofs and transfers looked up on Solana. Merged in; the figures
-- themselves never change after the report is made.
create function public.record_audit_report_checks(p_id uuid, p_checks jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  if jsonb_typeof(p_checks) is distinct from 'object' then
    raise exception 'invalid_checks' using errcode = '22023';
  end if;
  update public.audit_reports set checks = checks || p_checks
  where id = p_id and revoked_at is null and created_by = auth.uid();
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.audit_reports()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'token', r.token, 'title', r.title, 'created_at', private.iso(r.created_at),
      'revoked_at', private.iso(r.revoked_at), 'created_by', p.display_name,
      'proofs', (r.snapshot -> 'anchors' ->> 'confirmed')::integer,
      'checks', r.checks) order by r.created_at desc), '[]')
    from public.audit_reports r left join public.profiles p on p.id = r.created_by);
end;
$$;

create function public.revoke_audit_report(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.require_auditor();
  update public.audit_reports set revoked_at = now() where id = p_id and revoked_at is null;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- The shared link: anyone with the token, signed in or not.
create function public.shared_audit_report(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v public.audit_reports;
begin
  select * into v from public.audit_reports where token = p_token and revoked_at is null;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('title', v.title, 'created_at', private.iso(v.created_at),
    'snapshot', v.snapshot, 'checks', v.checks);
end;
$$;

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

  -- Reports describe data that is about to go: their links close with it.
  delete from public.audit_reports where true;
  delete from public.cost_events where true;
  delete from public.capital_commitments where true;
  delete from public.zcash_returns where true;
  delete from public.settlement_legs where true;
  delete from public.vault_transfers where true;
  -- Receipts stay: they are the treasury's, read from Zcash. Only their link to a request goes.
  delete from public.zcash_payment_requests where true;
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

revoke all on function private.chain_constants(), private.audit_snapshot(integer) from public;
grant execute on function private.chain_constants() to authenticated, service_role;
grant execute on function private.audit_snapshot(integer) to authenticated;
revoke all on function public.create_audit_report(text, jsonb), public.record_audit_report_checks(uuid, jsonb), public.audit_reports(),
  public.revoke_audit_report(uuid) from public, anon;
grant execute on function public.create_audit_report(text, jsonb), public.record_audit_report_checks(uuid, jsonb), public.audit_reports(),
  public.revoke_audit_report(uuid) to authenticated;
revoke all on function public.shared_audit_report(text) from public;
grant execute on function public.shared_audit_report(text) to anon, authenticated;
