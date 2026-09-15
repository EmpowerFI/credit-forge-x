-- Loans disbursed, and instalments paid, before settlement was recorded get
-- their mock Pix legs, dated when they happened. No real leg is backfilled:
-- releases and payouts move USDC, and happen only from here on.
insert into public.settlement_legs (kind, loan_id, amount_cents, status, pix_e2e, done_at)
select 'pix_payout', l.id, l.principal_cents, 'mock', private.mock_pix_e2e(e.at), e.at
from public.loans l
join (select loan_id, min(created_at) at from public.loan_events where to_status = 'DISBURSED' group by loan_id) e on e.loan_id = l.id
on conflict (loan_id) where kind = 'pix_payout' do nothing;

insert into public.settlement_legs (kind, loan_id, payment_id, amount_cents, status, pix_e2e, done_at)
select 'pix_in', p.loan_id, p.id, p.amount_cents, 'mock', private.mock_pix_e2e(p.paid_at), p.paid_at
from public.payments p
on conflict (payment_id) where kind = 'pix_in' do nothing;
