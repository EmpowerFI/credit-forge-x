import type { AllocationResult, PoolId, PoolPolicy } from "@empowerfi/capital-allocation";
import { Banknote, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { bpsPercent, POOL, REASON } from "../../../lib/capital";
import { economics, orderedChecks } from "../../../lib/engine";
import { usdc } from "../../../lib/solana";
import { money } from "../../../lib/readiness";
import { CHECK_TITLE, checkDetail, nodeState } from "./labels";
import { StepNode } from "./parts";

const ROUTE = { domestic: "BRL / Pix", global: "USDC / Solana" } as const;

/**
 * One of Engine 2's two branches: the pool's feasibility checks in turn, the
 * branch stopping at the first that fails with the engine's reason code; then,
 * if it can take the opportunity, the economics, one component at a time.
 */
export default function PoolBranch({ pool, result, policy, tick, base, economicsBase, liquidityMicroUsdc, chosen, done, impactEligible }: {
  pool: PoolId;
  result: AllocationResult;
  policy: PoolPolicy;
  tick: number;
  /** The tick its first check evaluates on. */
  base: number;
  economicsBase: number;
  liquidityMicroUsdc: number | null;
  chosen: boolean;
  done: boolean;
  /** Women-led, in a verified community. */
  impactEligible: boolean;
}) {
  const a = result[pool];
  const checks = orderedChecks(a.checks);
  const failAt = checks.findIndex((c) => !c.passed);
  const stopped = failAt !== -1 && tick > base + failAt;
  const Icon = pool === "domestic" ? Banknote : Globe;
  const econ = economics(result, pool, policy);
  const rows: [string, number][] = [
    [tr({ en: "Required return", pt: "Retorno exigido" }), econ.required_return_bps],
    [tr({ en: "Expected loss + cost to serve", pt: "Perda esperada + custo de servir" }), econ.loss_and_serve_bps],
    [tr({ en: "FX hedge", pt: "Hedge cambial" }), econ.fx_hedge_bps],
    [tr({ en: "Ramp, over the term", pt: "Rampa, ao longo do prazo" }), econ.ramp_bps_year],
  ];
  const shownRows = Math.max(0, Math.min(rows.length, tick - economicsBase + 1));
  const totalShown = tick >= economicsBase + rows.length;

  return (
    <div className={cn("flex h-full flex-col gap-3 rounded-2xl border p-4 transition-colors duration-500",
      done && chosen ? "border-positive/50 bg-positive/[0.06]" : done && !a.feasible ? "border-caution/30" : "border-border bg-background/20")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", pool === "domestic" ? "bg-positive/15 text-positive" : "bg-info/15 text-info")}>
            <Icon size={20} aria-hidden />
          </span>
          <div>
            <p className="font-heading text-base font-bold text-foreground">{POOL[pool].name}</p>
            <p className="text-xs text-muted-foreground">{ROUTE[pool]} · {pool === "domestic"
              ? money(policy.available_cents)
              : `${usdc(liquidityMicroUsdc ?? 0, 0)} ≈ ${money(policy.available_cents)}`}</p>
          </div>
        </div>
        {done && (chosen
          ? <StatusPill tone="positive" dot={false}>{tr({ en: "Selected", pt: "Selecionado" })}</StatusPill>
          : !a.feasible
            ? <StatusPill tone="caution" dot={false}>{tr({ en: "Cannot fund", pt: "Não pode financiar" })}</StatusPill>
            : <StatusPill tone="neutral" dot={false}>{tr({ en: "Feasible, not chosen", pt: "Viável, não escolhido" })}</StatusPill>)}
      </div>

      <ol className="space-y-1.5">
        {checks.map((c, j) => (
          <li key={c.check}>
            <StepNode compact state={nodeState(base + j, tick, c.passed, failAt !== -1 && j > failAt && stopped)}
              title={c.check === "mandate" && pool === "global" && policy.impact_mandate
                ? tr({ en: "Mandate: purpose and impact", pt: "Mandato: finalidade e impacto" })
                : CHECK_TITLE[c.check]}
              detail={<>
                {checkDetail(c)}
                {c.check === "mandate" && pool === "global" && policy.impact_mandate && (
                  <span className="block">{impactEligible
                    ? tr({ en: "Impact mandate: women-led, verified community · match", pt: "Mandato de impacto: liderado por mulher, comunidade verificada · compatível" })
                    : tr({ en: "Impact mandate: not a match", pt: "Mandato de impacto: não compatível" })}</span>
                )}
              </>} />
          </li>
        ))}
      </ol>

      {stopped && (
        <div className="rounded-xl border tone-caution px-3 py-2 text-xs animate-in fade-in duration-300">
          <p className="font-mono font-semibold">{checks[failAt].reason}</p>
          <p className="mt-0.5">{REASON[checks[failAt].reason].says}</p>
          {a.blocks.length > 1 && (
            <p className="mt-1 font-mono text-[11px] opacity-80">{tr({ en: "Also:", pt: "Também:" })} {a.blocks.filter((b) => b !== checks[failAt].reason).join(" · ")}</p>
          )}
        </div>
      )}

      {a.feasible && tick >= economicsBase && (
        <div className="mt-auto space-y-1 rounded-xl border border-border bg-card/60 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Her all-in cost, a year", pt: "Custo total para ela, ao ano" })}</p>
          <dl className="num space-y-0.5 text-xs">
            {rows.slice(0, shownRows).map(([label, bps]) => (
              <div key={label} className="flex justify-between gap-3 animate-in fade-in slide-in-from-left-1 duration-200">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground">{bpsPercent(bps)}</dd>
              </div>
            ))}
            {totalShown && (
              <div className="mt-1 flex justify-between gap-3 border-t border-border pt-1 text-sm font-semibold animate-in fade-in duration-300">
                <dt className="text-foreground">{tr({ en: "All-in cost", pt: "Custo total" })}</dt>
                <dd className={chosen && done ? "text-positive" : "text-foreground"}>{bpsPercent(econ.all_in_bps)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
