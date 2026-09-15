-- Refunds leave the vault for real. When a partner declines an opportunity,
-- its wallet allocations become refund_due (private.refund_on_close); the
-- vault-refund function then sends each one back with the program's
-- vault_transfer, signed by the operator. Simulated allocations have no
-- deposit to return and stay refund_due, as the demo shows them.
--
-- A refund is never sent twice. The function signs first and records the
-- signature with the last block height its blockhash is valid for, then sends.
-- A later run that finds a signature looks it up on chain instead of sending:
-- confirmed means done; not found once that height has passed means the
-- transaction can no longer land, and only then is a new one signed.

alter table public.investments
  add column refund_signature text unique,
  add column refund_valid_until bigint,
  add column refund_claimed_at timestamptz,
  add column refunded_at timestamptz,
  add column refund_error text;

-- Up to p_limit refunds for this run. A claim lasts two minutes, so two runs
-- never work the same refund, and a run that died frees it soon after.
create function public.refund_claim(p_limit integer default 5)
returns table (id uuid, wallet_address text, amount_micro_usdc bigint, refund_signature text, refund_valid_until bigint)
language sql security definer set search_path = ''
as $$
  update public.investments i
  set refund_claimed_at = now()
  where i.id in (
    select c.id from public.investments c
    where c.status = 'refund_due' and c.mode = 'wallet' and not c.is_simulated
      and c.refund_error is null
      and (c.refund_claimed_at is null or c.refund_claimed_at < now() - interval '2 minutes')
    order by c.created_at
    limit p_limit
    for update skip locked
  )
  returning i.id, i.wallet_address, i.amount_micro_usdc, i.refund_signature, i.refund_valid_until;
$$;

-- Written before the transaction is sent (or cleared, with nulls, once an
-- unconfirmed one has expired).
create function public.refund_sending(p_id uuid, p_signature text, p_valid_until bigint)
returns void
language sql security definer set search_path = ''
as $$
  update public.investments
  set refund_signature = p_signature, refund_valid_until = p_valid_until
  where id = p_id and status = 'refund_due';
$$;

create function public.refund_done(p_id uuid, p_signature text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.investments
  set status = 'refunded', refunded_at = now(), refund_claimed_at = null
  where id = p_id and status = 'refund_due' and refund_signature = p_signature;
  if not found then
    raise exception 'refund_not_pending' using errcode = 'P0001';
  end if;
end;
$$;

-- A transaction that landed and failed is for a human to look at.
create function public.refund_failed(p_id uuid, p_error text)
returns void
language sql security definer set search_path = ''
as $$
  update public.investments set refund_error = left(p_error, 500), refund_claimed_at = null
  where id = p_id and status = 'refund_due';
$$;

revoke all on function public.refund_claim(integer), public.refund_sending(uuid, text, bigint),
  public.refund_done(uuid, text), public.refund_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_claim(integer), public.refund_sending(uuid, text, bigint),
  public.refund_done(uuid, text), public.refund_failed(uuid, text) to service_role;

-- Every 15 seconds, only when a wallet refund is waiting. Same secret as
-- anchor-submit; the function lives next to it.
create function private.dispatch_refunds()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.investments
    where status = 'refund_due' and mode = 'wallet' and not is_simulated and refund_error is null
      and (refund_claimed_at is null or refund_claimed_at < now() - interval '2 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'anchor_submit_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'anchor_cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'dispatch_refunds: vault secrets anchor_submit_url / anchor_cron_secret are not set';
    return;
  end if;

  perform net.http_post(
    url := replace(v_url, '/anchor-submit', '/vault-refund'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-anchor-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_refunds() from public;

select cron.schedule('vault-refunds', '15 seconds', 'select private.dispatch_refunds()');

-- The position shows the refund once it has landed, with its transaction.
create or replace function public.investor_position(p_investment_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_inv public.investments;
  v_opp public.qualified_credit_opportunities;
  v_loan public.loans;
  v_share numeric;
  v_active timestamptz;
begin
  select * into v_inv from public.investments where id = p_investment_id;
  if not found or not (v_inv.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_position' using errcode = '42501';
  end if;
  select * into v_opp from public.qualified_credit_opportunities where id = v_inv.opportunity_id;
  select * into v_loan from public.loans where opportunity_id = v_opp.id;
  v_share := v_inv.amount_micro_usdc::numeric / v_opp.funding_target_micro_usdc;
  select min(created_at) into v_active from public.loan_events where loan_id = v_loan.id and to_status = 'ACTIVE';

  return jsonb_build_object(
    'investment', jsonb_build_object(
      'id', v_inv.id, 'amount_micro_usdc', v_inv.amount_micro_usdc, 'share_bps', round(v_share * 10000),
      'mode', v_inv.mode, 'status', v_inv.status, 'deposit_signature', v_inv.deposit_signature,
      'wallet_address', v_inv.wallet_address, 'invested_at', private.iso(v_inv.created_at), 'is_simulated', v_inv.is_simulated,
      'refund_signature', case when v_inv.status = 'refunded' then v_inv.refund_signature end, 'refunded_at', private.iso(v_inv.refunded_at)
    ),
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature, 'account', a.account_address,
        'commitment', encode(a.commitment, 'hex'), 'reconcile', a.reconcile)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_inv.id),
    'opportunity', jsonb_build_object(
      'id', v_opp.id, 'code', private.opportunity_code(v_opp.id), 'purpose', v_opp.purpose,
      'business_sector', (select business_sector from public.entrepreneurs where id = v_opp.entrepreneur_id),
      'amount_cents', v_opp.amount_cents, 'term_months', v_opp.term_months, 'risk_band', v_opp.risk_band,
      'funding_status', v_opp.funding_status, 'funding_target_micro_usdc', v_opp.funding_target_micro_usdc,
      'fx_brl_per_usdc_milli', v_opp.fx_brl_per_usdc_milli
    ),
    'loan', case when v_loan.id is null then null else jsonb_build_object(
      'id', v_loan.id, 'status', v_loan.status, 'principal_cents', v_loan.principal_cents,
      'rate_bps', v_loan.rate_bps, 'term_months', v_loan.term_months, 'instalment_cents', v_loan.instalment_cents,
      'disbursed_at', private.iso(v_loan.disbursed_at), 'active_since', private.iso(v_active),
      'instalment_share_micro_usdc', private.share_usdc(v_loan.instalment_cents, v_share, v_opp.fx_brl_per_usdc_milli)
    ) end,
    -- Every instalment, due monthly from the start of repayment, with what came in.
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'instalment_no', n,
        'due_at', case when v_active is not null then private.iso(v_active + make_interval(months => n)) end,
        'paid_at', private.iso(p.paid_at),
        'payment_id', p.id,
        'share_micro_usdc', case when p.id is not null then private.share_usdc(p.amount_cents, v_share, v_opp.fx_brl_per_usdc_milli) end
      ) order by n)
      from generate_series(1, coalesce(v_loan.term_months, 0)) n
      left join public.payments p on p.loan_id = v_loan.id and p.instalment_no = n
    ), '[]'),
    -- What the partner recorded, as the investor may read it.
    'servicing', coalesce((
      select jsonb_agg(jsonb_build_object('event_id', e.id, 'to_status', e.to_status, 'note', e.note, 'at', private.iso(e.created_at)) order by e.created_at)
      from public.loan_events e where e.loan_id = v_loan.id
    ), '[]'),
    'outcome', (
      select jsonb_build_object('id', po.id, 'avg_revenue_before_cents', po.avg_revenue_before_cents,
        'avg_revenue_after_cents', po.avg_revenue_after_cents, 'evc_cents', po.evc_cents, 'capital_use', po.capital_use,
        'confidence', po.confidence, 'measured_at', private.iso(po.measured_at))
      from public.productive_outcomes po where po.loan_id = v_loan.id order by po.outcome_no desc limit 1
    )
  );
end;
$$;
