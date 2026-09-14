import { Badge } from "@/components/ui/badge";
import type { CommunityStatus } from "../lib/platform";

const STYLE: Record<CommunityStatus, { label: string; className: string }> = {
  pending_verification: { label: "Pending verification", className: "tone-caution" },
  verified: { label: "Verified", className: "tone-positive" },
  rejected: { label: "Rejected", className: "tone-alert" },
};

export default function StatusBadge({ status }: { status: CommunityStatus }) {
  const s = STYLE[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
