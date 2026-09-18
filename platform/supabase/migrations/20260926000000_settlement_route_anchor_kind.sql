-- The settlement route becomes a proof kind. A new enum value cannot be used
-- in the transaction that adds it, so it ships alone, as `sponsor` and the
-- outcome kinds did before it.
alter type public.anchor_kind add value if not exists 'settlement_route';   -- anchor_settlement_route
