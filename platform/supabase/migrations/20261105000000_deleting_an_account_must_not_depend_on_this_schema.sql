-- The mobile app and the credit platform now share a database, and the app
-- will not be changed. So anything that makes the app stop working is the
-- credit platform's problem to fix, on the credit platform's side.
--
-- The one it broke is deletion. Eleven foreign keys here point at profiles
-- with no delete rule, which is NO ACTION: the delete is refused. The app's
-- own account deletion removes the auth.users row, that cascades to profiles,
-- and these refuse it — so "delete my account" would start failing with a
-- foreign key violation for any woman who had used the credit side. There is
-- a deletion_log table in the app, so that flow is real, and erasure is a
-- right under the LGPD rather than a feature. A delete that errors is a
-- compliance problem, not a bug report.
--
-- All eleven are "who did this" columns and all eleven are already nullable,
-- so the fix is the rule they were missing: the record survives, the
-- attribution does not. That is what erasure means. It costs something real
-- and worth naming — an audit trail that can be erased is not fully an audit
-- trail — but the alternative is refusing her a right she has, and the
-- commitments on Solana carry no identity, so nothing already proven changes.
--
-- communities.leader_id is deliberately left refusing. It is NOT NULL, it is
-- current state rather than attribution, and a community with no leader is an
-- operational hole rather than a bookkeeping one. A leader who wants to erase
-- herself should hand the community over first, and being stopped is the
-- correct outcome.

alter table public.checkins
  drop constraint checkins_submitted_by_fkey,
  add constraint checkins_submitted_by_fkey
    foreign key (submitted_by) references public.profiles (id) on delete set null;

alter table public.communities
  drop constraint communities_verified_by_fkey,
  add constraint communities_verified_by_fkey
    foreign key (verified_by) references public.profiles (id) on delete set null;

alter table public.credit_intents
  drop constraint credit_intents_declared_by_fkey,
  add constraint credit_intents_declared_by_fkey
    foreign key (declared_by) references public.profiles (id) on delete set null;

alter table public.education_progress
  drop constraint education_progress_recorded_by_fkey,
  add constraint education_progress_recorded_by_fkey
    foreign key (recorded_by) references public.profiles (id) on delete set null;

alter table public.eligible_wallets
  drop constraint eligible_wallets_admitted_by_fkey,
  add constraint eligible_wallets_admitted_by_fkey
    foreign key (admitted_by) references public.profiles (id) on delete set null;

alter table public.loan_events
  drop constraint loan_events_actor_fkey,
  add constraint loan_events_actor_fkey
    foreign key (actor) references public.profiles (id) on delete set null;

alter table public.outreach_events
  drop constraint outreach_events_created_by_fkey,
  add constraint outreach_events_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.partner_decisions
  drop constraint partner_decisions_decided_by_fkey,
  add constraint partner_decisions_decided_by_fkey
    foreign key (decided_by) references public.profiles (id) on delete set null;

alter table public.payments
  drop constraint payments_recorded_by_fkey,
  add constraint payments_recorded_by_fkey
    foreign key (recorded_by) references public.profiles (id) on delete set null;

alter table public.productive_outcomes
  drop constraint productive_outcomes_measured_by_fkey,
  add constraint productive_outcomes_measured_by_fkey
    foreign key (measured_by) references public.profiles (id) on delete set null;

alter table public.readiness_assessments
  drop constraint readiness_assessments_requested_by_fkey,
  add constraint readiness_assessments_requested_by_fkey
    foreign key (requested_by) references public.profiles (id) on delete set null;
