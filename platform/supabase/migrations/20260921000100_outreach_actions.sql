-- Next actions for every step of the way to P2P funding: readiness, the
-- request itself and its funding, besides check-ins, education, eligibility,
-- servicing and a human conversation. Enum values are added on their own,
-- before anything uses them.
alter type public.outreach_action add value if not exists 'readiness_followup' before 'capital_need_check';
alter type public.outreach_action add value if not exists 'credit_intent_check' before 'capital_need_check';
alter type public.outreach_action add value if not exists 'funding_followup' after 'capital_need_check';
