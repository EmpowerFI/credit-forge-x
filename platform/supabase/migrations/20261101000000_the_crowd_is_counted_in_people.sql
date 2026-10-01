-- The crowd is counted in people, not in payments.
--
-- A batch reported `members`, the number of payments it carried, and the screen
-- called that the anonymity set. It is the right number for one question and the
-- wrong one for another, and only saying so keeps the claim true:
--
--   · how many POSITIONS a batch carried is what blends the individual amounts.
--     Three positions in one movement mean no single position's size is
--     readable, and that holds even if one investor made all three.
--
--   · how many INVESTORS it carried is what blends the totals. If one investor
--     paid every position in a batch, the whole movement is hers: the split
--     between her positions is hidden, her total is not.
--
-- The seed for the demo is what exposed this — one demo investor account can pay
-- several times, which would have produced a batch of "three" that hid nothing
-- about whose money it was. So both numbers are published, and the screen makes
-- its claim on the stricter one.
--
-- Rebuilt from 20261031000000_the_vault_sees_a_batch_not_a_person.sql.

create or replace function public.zcash_batch_queue(p_limit integer default 12)
returns jsonb
language sql security definer set search_path = ''
as $$
  select jsonb_build_object(
    'booked_micro_usdc', coalesce((
      select sum(i.amount_micro_usdc) from public.investments i where i.credit_batch_id is not null), 0),
    'credited_micro_usdc', coalesce((
      select sum(b.credited_micro_usdc) from public.zcash_credit_batches b where b.status = 'credited'), 0),
    'queued_micro_usdc', coalesce((
      select b.carried_out_micro_usdc from public.zcash_credit_batches b
      where b.status = 'credited' order by b.created_at desc limit 1), 0),
    'awaiting_micro_usdc', coalesce((
      select sum(r.amount_micro_usdc) from public.zcash_payment_requests r
      where r.status = 'confirmed' and r.credit_batch_id is null), 0),
    'batches', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc, x->>'id' desc) from (
        select jsonb_build_object(
          'id', b.id, 'status', b.status, 'signature', b.signature,
          'unit_micro_usdc', b.unit_micro_usdc,
          'credited_micro_usdc', b.credited_micro_usdc,
          'carried_in_micro_usdc', b.carried_in_micro_usdc,
          'carried_out_micro_usdc', b.carried_out_micro_usdc,
          'members', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = b.id),
          'investors', (select count(distinct r.investor_id) from public.zcash_payment_requests r
                        where r.credit_batch_id = b.id),
          'created_at', private.iso(b.created_at),
          'confirmed_at', private.iso(b.confirmed_at)) as x
        from public.zcash_credit_batches b
        order by b.created_at desc, b.id desc
        limit p_limit) s), '[]'::jsonb));
$$;

create or replace function public.zcash_request(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_r public.zcash_payment_requests;
  v_t private.zcash_treasury;
  v_b public.zcash_credit_batches;
begin
  select * into v_r from public.zcash_payment_requests where id = p_id;
  if not found or not (v_r.investor_id = auth.uid() or private.is_auditor_or_admin()) then
    raise exception 'not_your_request' using errcode = '42501';
  end if;
  select * into v_t from private.zcash_treasury where id;
  select * into v_b from public.zcash_credit_batches where id = v_r.credit_batch_id;
  return jsonb_build_object(
    'id', v_r.id, 'ref', v_r.ref, 'status', v_r.status, 'address', v_t.address, 'network', v_t.network,
    'opportunity_id', v_r.opportunity_id, 'opportunity_code', private.opportunity_code(v_r.opportunity_id),
    'amount_zat', v_r.amount_zat, 'amount_micro_usdc', v_r.amount_micro_usdc,
    'usd_per_zec_cents', v_r.usd_per_zec_cents, 'quote_source', v_r.quote_source,
    'memo', 'EmpowerFI allocation ' || v_r.ref,
    'txid', v_r.txid, 'pool', v_r.pool, 'received_zat', v_r.received_zat, 'mined_height', v_r.mined_height,
    'confirmations', case when v_r.mined_height is not null and v_t.tip_height is not null
      then greatest(0, v_t.tip_height - v_r.mined_height + 1) end,
    'confirmations_needed', private.zcash_confirmations(),
    'scanned_height', v_t.scanned_height, 'scanned_at', private.iso(v_t.scanned_at),
    'credit_signature', coalesce(v_r.credit_signature, v_b.signature),
    'investment_id', v_r.investment_id,
    'batch', case when v_b.id is null then null else jsonb_build_object(
      'status', v_b.status,
      'members', (select count(*) from public.zcash_payment_requests r where r.credit_batch_id = v_b.id),
      'investors', (select count(distinct r.investor_id) from public.zcash_payment_requests r
                    where r.credit_batch_id = v_b.id),
      'credited_micro_usdc', v_b.credited_micro_usdc,
      'unit_micro_usdc', v_b.unit_micro_usdc,
      'signature', v_b.signature) end,
    'proof', (select jsonb_build_object('status', a.status, 'signature', a.signature)
      from public.chain_anchors a where a.kind = 'allocation' and a.entity_id = v_r.investment_id),
    'error', v_r.error,
    'expires_at', private.iso(v_r.expires_at), 'created_at', private.iso(v_r.created_at)
  );
end;
$$;
