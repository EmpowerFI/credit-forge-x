-- Diary waitlist
-- The diary opens to a group of entrepreneurs at a time (founder, 12 Nov 2026):
-- the site no longer links to it and asks her to join this list instead, with
-- her name, e-mail, what she sells and where, so EmpowerFI can choose who comes
-- in next by sector and region.
--
-- As investor_waitlist: the site submits with the anon key, so the table is
-- INSERT-only for anon and has no SELECT policy -- only the service role reads it.

CREATE TABLE IF NOT EXISTS public.diary_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  sells TEXT NOT NULL CHECK (char_length(btrim(sells)) BETWEEN 1 AND 120),
  city TEXT NOT NULL CHECK (char_length(btrim(city)) BETWEEN 1 AND 80),
  state TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  language TEXT NOT NULL DEFAULT 'pt' CHECK (language IN ('pt', 'en')),
  -- Consent is the record that she agreed to be contacted about access.
  consent BOOLEAN NOT NULL CHECK (consent IS TRUE),
  source TEXT CHECK (source IS NULL OR char_length(source) <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per person, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_diary_waitlist_email ON public.diary_waitlist (lower(email));
CREATE INDEX IF NOT EXISTS idx_diary_waitlist_created_at ON public.diary_waitlist (created_at DESC);

ALTER TABLE public.diary_waitlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can join the diary waitlist"
    ON public.diary_waitlist FOR INSERT
    TO anon, authenticated
    WITH CHECK (consent IS TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT INSERT ON public.diary_waitlist TO anon, authenticated;
