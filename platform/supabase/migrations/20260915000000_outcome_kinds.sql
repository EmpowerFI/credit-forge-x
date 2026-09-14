-- New enum values for productive outcomes. On their own: a value added to an
-- enum cannot be used in the transaction that adds it.

alter type public.anchor_kind add value 'outcome';          -- anchor_outcome
alter type public.cost_stage add value 'outcome_measurement';
