import { tr } from "../../i18n";
import { positionReais, type PoolId } from "../../lib/capital";
import { fundedPercent } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";

/**
 * How much of an opportunity is raised: a bar and the numbers behind it. A
 * domestic opportunity reads in reais, a global one in USDC.
 */
export default function FundingBar({ funded, target, investors, compact = false, pool = "global", fxMilli = null, amountCents = null }: {
  funded: number;
  target: number | null;
  investors?: number;
  compact?: boolean;
  pool?: PoolId | null;
  fxMilli?: number | null;
  amountCents?: number | null;
}) {
  const pct = fundedPercent(funded, target);
  const reais = pool === "domestic" && fxMilli;
  return (
    <div className="space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label={tr({ en: "Funded", pt: "Captada" })}>
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-positive" : "bg-gold"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="num flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        {reais ? (
          <span>
            <span className="text-foreground">{money(target && funded >= target && amountCents ? amountCents : positionReais(null, funded, fxMilli))}</span> {tr({ en: "of", pt: "de" })} {money(amountCents ?? positionReais(null, target ?? 0, fxMilli))} · {pct}%
          </span>
        ) : (
          <span><span className="text-foreground">{usdc(funded, 0)}</span> {tr({ en: "of", pt: "de" })} {usdc(target, 0)} · {pct}%</span>
        )}
        {!compact && investors !== undefined && <span>{investors} {investors === 1 ? tr({ en: "investor", pt: "investidor" }) : tr({ en: "investors", pt: "investidores" })}</span>}
      </div>
    </div>
  );
}
