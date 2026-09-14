-- New kinds of fact to anchor: a month of the business, and a readiness
-- assessment. Alone in its own migration: Postgres will not use an enum value
-- in the transaction that added it.
alter type public.anchor_kind add value if not exists 'checkin';   -- anchor_checkin
alter type public.anchor_kind add value if not exists 'readiness'; -- attest_readiness
