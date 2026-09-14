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
  anchor_not_found: "There is no proof recorded for this yet.",
};

export function describeError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return MESSAGES[message] ?? message;
}
