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
  not_allowed_to_measure: "Only EmpowerFI or the loan's partner measures its outcome.",
  loan_not_disbursed: "An outcome is measured once the loan has reached the business.",
  not_enough_history: "An outcome needs two reported months on each side of the loan.",
  no_consent_to_assess: "She has not allowed her data to be used for an assessment. Her consent comes first.",
  no_consent_to_share_with_partner: "Asking for credit means a partner sees the request. Allow that in your consent first.",
  consent_scope_needs_the_one_before: "Each use builds on the one before: nothing is shared that is not assessed.",
  every_scope_needs_an_answer: "Answer each of the four uses.",
  not_allowed_to_record_consent: "Only she, or a leader of her community, can record her consent.",
  not_an_auditor: "The audit console is for auditors and EmpowerFI admins.",
  not_fully_funded: "Investors are still funding this opportunity: disburse once it is funded.",
  zcash_not_configured: "EmpowerFI's Zcash treasury is not set up yet.",
  amount_too_small: "The smallest allocation is 1 USDC.",
  exceeds_remaining: "That is more than is still open to fund, counting payments on their way.",
  opportunity_not_open: "This opportunity is no longer raising.",
  not_an_investor: "Investing is for capital providers.",
  not_your_request: "This payment request is not yours.",
  not_a_partner: "The partner desk is for credit partners, auditors and EmpowerFI.",
  report_not_found: "This report is not available: the link is wrong, or it was closed.",
  invalid_checks: "Those checks could not be recorded.",
  invalid_zcash_address: "That is not a shielded Zcash testnet address. Use a unified (utest1…) or Sapling (ztestsapling1…) address: returns stay shielded.",
  not_a_zcash_position: "Only a position paid in shielded ZEC is returned in ZEC.",
  not_your_position: "This position is not yours.",
  reason_required: "Say why. Investors and the audit trail will see the reason.",
};

export function describeError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (MESSAGES[message]) return MESSAGES[message];
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return "Cannot reach the platform right now. Check the connection and try again.";
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(message)) return "Your session has expired. Sign in again.";
  return message;
}
