-- New kinds of fact to anchor, alone in their own migration (an enum value
-- cannot be used in the transaction that added it).
alter type public.anchor_kind add value if not exists 'eligibility';     -- attest_eligibility
alter type public.anchor_kind add value if not exists 'opportunity';     -- anchor_opportunity
alter type public.anchor_kind add value if not exists 'loan';            -- create_loan
alter type public.anchor_kind add value if not exists 'loan_transition'; -- transition_loan
alter type public.anchor_kind add value if not exists 'payment';         -- anchor_payment
