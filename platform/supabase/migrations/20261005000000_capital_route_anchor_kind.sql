-- A capital plan becomes a proof kind. A new enum value cannot be used in the
-- transaction that adds it, so it ships alone, as `settlement_route` did.
--
-- Nothing queues one yet, and the next migration says why: a proof kind needs
-- its own instruction in programs/empowerfi-audit and an upgrade on devnet, and
-- queueing an anchor no program can accept would leave every plan carrying a
-- job that fails for good. The payload, its readers and its domain tag ship
-- here so that what a plan *would* commit to is settled and reviewable, and the
-- program work is the only thing left when it is wanted.
alter type public.anchor_kind add value if not exists 'capital_route';   -- anchor_capital_route
