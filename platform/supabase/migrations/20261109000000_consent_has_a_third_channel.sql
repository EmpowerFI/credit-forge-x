-- WhatsApp is not a channel anyone has agreed to yet.
--
-- The enum has had 'app' and 'community' since consent existed, and a consent
-- given in a WhatsApp conversation is neither: she did not sign in, and no
-- leader vouched for her. Recording it as one of the existing two would make
-- the record say something that is not true about how it was obtained, which
-- is the one thing a consent record exists to get right.
--
-- Alone in its own migration because Postgres refuses to use an enum value in
-- the transaction that added it. scripts/platform/check-fresh-install.mts
-- fails the build when that rule is broken, so the next file is where the
-- value is first used.

alter type public.consent_channel add value if not exists 'whatsapp';
