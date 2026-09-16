import { useState } from "react";
import { BadgeCheck, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeError } from "../../lib/errors";
import { type ProofToVerify, type ProofVerification, verifyProofs } from "../../lib/report";

/**
 * Verify on Solana, from this browser: each commitment looked up in the
 * program's accounts or the transaction that wrote it. It needs no access to
 * the record behind a commitment, so an investor can check proofs of facts
 * whose content stays private.
 */
export default function VerifyOnSolana({ proofs, size = "sm" }: { proofs: ProofToVerify[]; size?: "sm" | "default" }) {
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<ProofVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkable = proofs.filter((p) => p.signature && p.commitment);

  const run = async () => {
    setResult(null);
    setError(null);
    setStep("Starting");
    try {
      setResult(await verifyProofs(checkable, setStep));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setStep(null);
    }
  };

  if (checkable.length === 0) return null;
  const ok = result && result.problems.length === 0 && result.commitment_found === result.checked;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <Button type="button" variant="outline" size={size} className="gap-1.5" disabled={step !== null} onClick={run}>
        {step ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />} Verify on Solana
      </Button>
      {step && <p className="text-xs text-muted-foreground">{step}…</p>}
      {result && (
        <p className={`flex items-center gap-1.5 text-xs ${ok ? "text-positive" : result.problems.length ? "text-alert" : "text-caution"}`}>
          {result.problems.length ? <ShieldAlert size={13} /> : <BadgeCheck size={13} />}
          {result.commitment_found} of {result.checked} commitments found on Solana devnet
          {result.unreadable > 0 && `, ${result.unreadable} not readable right now`}
          {result.problems.length > 0 && ` · ${result.problems.map((p) => `${p.kind}: ${p.issue}`).join("; ")}`}
        </p>
      )}
      {error && <p className="text-xs text-alert">{error}</p>}
    </div>
  );
}
