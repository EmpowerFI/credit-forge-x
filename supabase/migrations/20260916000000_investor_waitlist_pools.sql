-- Investor waitlist: pools, ticket currency and language
-- Backs /investors (English) and /pt/investidores (Portuguese). EmpowerFI's P2P
-- model has two pools of capital: Brazilian investors in reais (the domestic
-- pool) and international and impact investors in USDC on Solana (the global
-- pool). The waitlist now records which pool a person is interested in, the
-- currency of the indicative ticket that follows from it, and the language of
-- the page they signed up on (which picks the confirmation email).
--
-- Signing up is still a statement of non-binding interest: nothing here is an
-- offer, a subscription or an investor account.
--
-- Every row before this migration came from the English page, whose tickets
-- were in USD and whose pitch was global capital, so the defaults ('global',
-- 'USD', 'en') describe them exactly.
--
-- RLS, the insert policy and the grants are unchanged. The migration is
-- idempotent: it can be run again without error or change.

ALTER TABLE public.investor_waitlist
  ADD COLUMN IF NOT EXISTS pool_interest TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS ticket_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.investor_waitlist
  DROP CONSTRAINT IF EXISTS investor_waitlist_pool_interest_check;
ALTER TABLE public.investor_waitlist
  ADD CONSTRAINT investor_waitlist_pool_interest_check
  CHECK (pool_interest IN ('domestic', 'global', 'both'));

ALTER TABLE public.investor_waitlist
  DROP CONSTRAINT IF EXISTS investor_waitlist_ticket_currency_check;
ALTER TABLE public.investor_waitlist
  ADD CONSTRAINT investor_waitlist_ticket_currency_check
  CHECK (ticket_currency IN ('USD', 'BRL'));

ALTER TABLE public.investor_waitlist
  DROP CONSTRAINT IF EXISTS investor_waitlist_language_check;
ALTER TABLE public.investor_waitlist
  ADD CONSTRAINT investor_waitlist_language_check
  CHECK (language IN ('en', 'pt'));

-- The original inline check on ticket_range allowed USD tiers only. Postgres
-- named it investor_waitlist_ticket_range_check; it is replaced by one that also
-- allows the BRL tiers. Indicative tickets only: '500_plus', '10000_plus_brl'
-- and 'other' are open ended by design.
ALTER TABLE public.investor_waitlist
  DROP CONSTRAINT IF EXISTS investor_waitlist_ticket_range_check;
ALTER TABLE public.investor_waitlist
  ADD CONSTRAINT investor_waitlist_ticket_range_check
  CHECK (ticket_range IN (
    -- USD
    '50', '100', '200', '500_plus',
    -- BRL
    '500_brl', '1000_brl', '5000_brl', '10000_plus_brl',
    -- either currency
    'other'
  ));

-- A tier must be in the currency the row says it is in. 'other' fits both.
ALTER TABLE public.investor_waitlist
  DROP CONSTRAINT IF EXISTS investor_waitlist_ticket_matches_currency_check;
ALTER TABLE public.investor_waitlist
  ADD CONSTRAINT investor_waitlist_ticket_matches_currency_check
  CHECK (
    ticket_range = 'other'
    OR (ticket_currency = 'USD' AND ticket_range IN ('50', '100', '200', '500_plus'))
    OR (ticket_currency = 'BRL' AND ticket_range IN ('500_brl', '1000_brl', '5000_brl', '10000_plus_brl'))
  );

COMMENT ON TABLE public.investor_waitlist IS
  'Non-binding investor waitlist from /investors (en) and /pt/investidores (pt). Records interest in the domestic P2P pool (reais), the global P2P pool (USDC) or both, with an indicative ticket in the matching currency. Not an offer, a subscription or an investor account. Insert-only for anon; readable only by the service role.';
COMMENT ON COLUMN public.investor_waitlist.pool_interest IS
  'domestic = Brazilian investors in reais; global = international and impact investors in USDC on Solana; both. Rows before 2026-09-16 are global.';
COMMENT ON COLUMN public.investor_waitlist.ticket_currency IS
  'Currency of ticket_range: BRL for the domestic pool, USD for global or both.';
COMMENT ON COLUMN public.investor_waitlist.ticket_range IS
  'Indicative ticket tier. USD: 50, 100, 200, 500_plus. BRL: 500_brl, 1000_brl, 5000_brl, 10000_plus_brl. Either: other.';
COMMENT ON COLUMN public.investor_waitlist.language IS
  'Language of the page the signup came from (en or pt); selects the confirmation email.';
