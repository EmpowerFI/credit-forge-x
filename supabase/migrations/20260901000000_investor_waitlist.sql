-- Investor waitlist
-- Backs the /investors page. Signing up is a statement of non-binding interest:
-- EmpowerFI is not offering securities or accepting funds through this form, so
-- nothing here is treated as a subscription or an investor account.
--
-- The site submits with the anon key, so the table is INSERT-only for anon and
-- has no SELECT policy at all — the list is readable exclusively by the service
-- role (edge functions, and the dashboard).

CREATE TABLE IF NOT EXISTS public.investor_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  country TEXT NOT NULL CHECK (char_length(country) BETWEEN 2 AND 80),
  investor_type TEXT NOT NULL CHECK (investor_type IN ('individual', 'institutional')),
  -- Indicative ticket only, in USD. '500_plus' and 'other' are open ended by design.
  ticket_range TEXT NOT NULL CHECK (ticket_range IN ('50', '100', '200', '500_plus', 'other')),
  motivation TEXT NOT NULL CHECK (motivation IN ('financial_return', 'economic_impact', 'both')),
  -- Optional: a wallet is never required to join the waitlist.
  wallet_address TEXT CHECK (wallet_address IS NULL OR char_length(wallet_address) BETWEEN 32 AND 64),
  -- Consent is the record that the person agreed to be contacted. A row without
  -- it is not a valid signup, so the check is enforced rather than defaulted.
  consent BOOLEAN NOT NULL CHECK (consent IS TRUE),
  -- Which surface the signup came from, e.g. 'investors-page'.
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per person: a repeat submission is an update of intent, not a second
-- entry. Case-insensitive so Ana@x.com and ana@x.com are the same signup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_waitlist_email
  ON public.investor_waitlist (lower(email));

ALTER TABLE public.investor_waitlist ENABLE ROW LEVEL SECURITY;

-- Public signup. WITH CHECK repeats the consent requirement so a client cannot
-- write a row that was never consented to, even if the column check changes.
DO $$ BEGIN
  CREATE POLICY "Anyone can join the investor waitlist"
    ON public.investor_waitlist FOR INSERT
    TO anon, authenticated
    WITH CHECK (consent IS TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deliberately no SELECT/UPDATE/DELETE policy for anon or authenticated: the
-- service role bypasses RLS and is the only way to read the list.
DO $$ BEGIN
  CREATE POLICY "Service role can read the investor waitlist"
    ON public.investor_waitlist FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT INSERT ON public.investor_waitlist TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_investor_waitlist_created_at
  ON public.investor_waitlist (created_at DESC);
