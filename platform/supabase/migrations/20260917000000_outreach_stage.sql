-- A new cost stage: a community reaching out to a participant — a check-in
-- reminder, an education follow-up, a human conversation. On its own: a value
-- added to an enum cannot be used in the transaction that adds it.

alter type public.cost_stage add value 'outreach';
