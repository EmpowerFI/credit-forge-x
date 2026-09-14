import { Badge } from "@/components/ui/badge";
import type { CommunityStatus } from "../lib/platform";

const STYLE: Record<CommunityStatus, { label: string; className: string }> = {
  pending_verification: { label: "Pending verification", className: "border-amber-300 bg-amber-50 text-amber-800" },
  verified: { label: "Verified", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Rejected", className: "border-red-300 bg-red-50 text-red-800" },
};

export default function StatusBadge({ status }: { status: CommunityStatus }) {
  const s = STYLE[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
