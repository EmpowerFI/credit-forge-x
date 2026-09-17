import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "../../i18n";
import { type ProofTarget, useProofDrawer } from "./context";

/** "Verify" beside a proven event: opens the proof drawer, or the audit page where there is no drawer. */
export default function VerifyButton({ proof, label, className, icon = false }: {
  proof: ProofTarget;
  label?: string;
  className?: string;
  icon?: boolean;
}) {
  const openProof = useProofDrawer();
  const text = label ?? tr({ en: "Verify", pt: "Verificar" });
  const style = cn("inline-flex items-center gap-1 text-info hover:underline", className);
  const content = <>{icon && <BadgeCheck size={13} aria-hidden />}{text}</>;
  if (!openProof) {
    return proof.entity_id ? <Link to={`/app/audit/${proof.kind}/${proof.entity_id}`} className={style}>{content}</Link> : null;
  }
  return <button type="button" onClick={() => openProof(proof)} className={style}>{content}</button>;
}
