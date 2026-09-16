import { ArrowDown, ArrowRight, Check, X } from "lucide-react";
import type { AllocationResult, PoolAssessment } from "@empowerfi/capital-allocation";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { bpsPercent, POOL, poolOf, REASON, type AllocationReason, type PoolId } from "../../lib/capital";
import type { MarketRow } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { REALITY, type Reality } from "../../lib/settlement";

const STEPS: Record<PoolId, { label: string; reality: Reality }[]> = {
  domestic: [
    { label: "Brazilian investors' BRL pool", reality: "simulated" },
    { label: "P2P structure, serviced by EmpowerFI", reality: "simulated" },
    { label: "Pix to her business", reality: "mock" },
  ],
  global: [
    { label: "Investors' test USDC, from a wallet", reality: "real" },
    { label: "Program vault on Solana", reality: "real" },
    { label: "Regulated off-ramp to reais", reality: "simulated" },
    { label: "Pix to her business", reality: "mock" },
  ],
};

function Route({ pool }: { pool: PoolId }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {STEPS[pool].map((s, i) => (
        <li key={s.label} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {i > 0 && <><ArrowRight size={14} className="hidden text-muted-foreground sm:block" aria-hidden /><ArrowDown size={14} className="text-muted-foreground sm:hidden" aria-hidden /></>}
          <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs text-foreground">
            {s.label} <StatusPill tone={REALITY[s.reality].tone} dot={false}>{REALITY[s.reality].label}</StatusPill>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Assessment({ a, chosen }: { a: PoolAssessment; chosen: boolean }) {
  return (
    <div className={`space-y-2 rounded-xl border p-3 ${chosen ? "border-primary/60 bg-primary/5" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{POOL[a.pool].name}</span>
        {chosen ? <StatusPill tone="positive" dot={false}>Selected</StatusPill> : null}
      </div>
      <p className={`flex items-center gap-1.5 text-xs ${a.feasible ? "text-positive" : "text-caution"}`}>
        {a.feasible ? <Check size={13} /> : <X size={13} />}
        {a.feasible ? "Available and eligible" : (a.blocks as AllocationReason[]).map((b) => REASON[b].label).join(" · ")}
      </p>
      <dl className="num space-y-1 text-xs">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Her all-in cost, a year</dt><dd className="text-foreground">{bpsPercent(a.all_in_bps)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">FX hedge, a year</dt><dd className="text-foreground">{bpsPercent(a.fx_hedge_bps)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Ramp in and out, a year</dt><dd className="text-foreground">{bpsPercent(a.ramp_bps_year)}</dd></div>
      </dl>
    </div>
  );
}

/** The funding route the Capital Allocation Engine chose for this opportunity, and why. */
export default function FundingRoute({ row }: { row: MarketRow }) {
  const pool = poolOf(row.funding_pool);
  const a = row.allocation as unknown as AllocationResult | null;
  if (!a) return null;
  const reasons = (row.allocation_reason_codes ?? []) as AllocationReason[];
  return (
    <Panel title="Funding route" description="Chosen by the Capital Allocation Engine: feasibility first — liquidity, risk appetite, ticket and mandate — then what it costs her."
      actions={<PoolPill pool={pool} />}>
      {pool && <Route pool={pool} />}

      <div className="space-y-2">
        <h3 className="font-heading text-base font-bold text-foreground">Why this pool?</h3>
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-3">
              <span className="shrink-0"><StatusPill tone={REASON[r].tone} dot={false}>{REASON[r].label}</StatusPill></span>
              <span className="text-muted-foreground">{REASON[r].says}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Assessment a={a.domestic} chosen={pool === "domestic"} />
        <Assessment a={a.global} chosen={pool === "global"} />
      </div>

      {pool && a.borrower_rate_bps_month !== null && (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Her side</p>
            <p className="num text-sm text-foreground">{bpsPercent(a.borrower_rate_bps_month)} a month · {row.term_months} × {money(a.instalment_cents)}</p>
            <p className="text-xs text-muted-foreground">In reais, by Pix, whichever pool funds it.</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Investors' side · simulated</p>
            <p className="num text-sm text-foreground">{bpsPercent(a.investor_return_bps ?? 0)} asked · {bpsPercent(a.investor_net_return_bps ?? 0)} after expected loss</p>
            <p className="text-xs text-muted-foreground">{POOL[pool].investors}, in {POOL[pool].asset.toLowerCase()}.</p>
          </div>
        </div>
      )}
      <p className="font-mono text-[11px] text-muted-foreground">{a.model_version}</p>
    </Panel>
  );
}
