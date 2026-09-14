// The database RPCs raise stable snake_case keys (see the community-flow
// migration). This is where they become sentences.
const MESSAGES: Record<string, string> = {
  only_leaders_create_communities: "Only community leaders can create a community.",
  only_admins_verify_communities: "Only EmpowerFI admins review communities.",
  cannot_verify_own_community: "You cannot verify a community you lead.",
  community_already_reviewed: "This community has already been reviewed.",
  community_not_found: "Community not found.",
  community_not_pending: "This community is no longer pending review.",
  rejection_needs_a_reason: "Say why the community is being rejected.",
  only_the_leader_enrolls: "Only the leader of this community can enroll members.",
  community_not_verified: "Members can only be enrolled once the community is verified.",
  entrepreneur_needs_a_name: "Enter the entrepreneur's name.",
  entrepreneur_not_found: "Entrepreneur not found.",
  already_a_member: "She is already a member of this community.",
  not_allowed_to_audit: "You do not have access to this proof.",
  not_allowed_to_see_portfolio: "The portfolio is for capital providers, auditors and EmpowerFI.",
  anchor_not_found: "There is no proof recorded for this yet.",
  not_allowed_to_record_progress: "Only she, or a leader of her community, can record her progress.",
  module_not_found: "Module not found.",
  programme_not_open_to_her: "This programme belongs to another community.",
  not_allowed_to_report: "Only she, or a leader of her community, can report her months.",
  not_enrolled: "Check-ins start once you belong to a verified community.",
  invalid_period: "That month is not valid.",
  period_in_future: "That month has not happened yet.",
  period_too_old: "Only the last twelve months can be reported.",
  checkin_exists_for_period: "That month has already been reported.",
  not_allowed_to_assess: "You cannot request this assessment.",
  only_the_entrepreneur_declares_intent: "Only the entrepreneur herself can ask for credit.",
  not_credit_ready: "A credit request comes after the business is ready.",
  intent_already_active: "You already have an open request.",
  no_active_intent: "There is no open request to withdraw.",
  not_in_credit_pipeline: "Eligibility is assessed once the business is ready and a request is open.",
  only_admins_refer: "Only EmpowerFI admins refer opportunities.",
  opportunity_not_referable: "This opportunity cannot be referred now.",
  no_matching_partner: "No partner currently covers this amount and purpose.",
  not_your_opportunity: "This opportunity was not referred to you.",
  opportunity_not_awaiting_decision: "This opportunity is not waiting for a decision.",
  approval_above_opportunity: "The approved amount cannot exceed the opportunity.",
  not_your_loan: "This loan is not yours to manage.",
  approval_comes_from_the_partner_decision: "Approval is recorded through the partner's decision.",
  invalid_loan_transition: "That status change is not allowed.",
  instalments_outstanding: "Some instalments are still unpaid.",
  loan_not_repaying: "Payments start once the loan is disbursed.",
  invalid_instalment: "That instalment number is outside the term.",
  instalment_already_paid: "That instalment is already recorded.",
  not_allowed_to_see_costs: "You cannot see these costs.",
};

export function describeError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return MESSAGES[message] ?? message;
}
