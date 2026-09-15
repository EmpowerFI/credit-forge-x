-- A new proof kind: an investor's capital allocated to an opportunity. On its
-- own: a value added to an enum cannot be used in the transaction that adds it.

alter type public.anchor_kind add value 'allocation';   -- anchor_allocation
