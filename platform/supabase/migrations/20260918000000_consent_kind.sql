-- A new proof kind: one consent record of an entrepreneur. On its own: a
-- value added to an enum cannot be used in the transaction that adds it.

alter type public.anchor_kind add value 'consent';   -- anchor_consent
