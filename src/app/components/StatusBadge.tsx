import { Badge } from "@/components/ui/badge";
import type { CommunityStatus } from "../lib/platform";
import { localized } from "../i18n";

const STYLE: Record<CommunityStatus, { label: string; className: string }> = localized({
  pending_verification: { label: { en: "Pending verification", pt: "Aguardando verificação" }, className: "tone-caution" },
  verified: { label: { en: "Verified", pt: "Verificada" }, className: "tone-positive" },
  rejected: { label: { en: "Rejected", pt: "Rejeitada" }, className: "tone-alert" },
});

export default function StatusBadge({ status }: { status: CommunityStatus }) {
  const s = STYLE[status];
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
}
