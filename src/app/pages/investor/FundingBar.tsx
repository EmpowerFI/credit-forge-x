import { fundedPercent } from "../../lib/investor";
import { usdc } from "../../lib/solana";

/** How much of an opportunity is raised: a bar and the numbers behind it. */
export default function FundingBar({ funded, target, investors, compact = false }: {
  funded: number;
  target: number | null;
  investors?: number;
  compact?: boolean;
}) {
  const pct = fundedPercent(funded, target);
  return (
    <div className="space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label="Funded">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-positive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="num flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span><span className="text-foreground">{usdc(funded, 0)}</span> of {usdc(target, 0)} · {pct}%</span>
        {!compact && investors !== undefined && <span>{investors} {investors === 1 ? "investor" : "investors"}</span>}
      </div>
    </div>
  );
}
