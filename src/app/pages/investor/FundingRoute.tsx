import { ArrowDown, ArrowRight, Check, ChevronRight, X } from "lucide-react";
import type { AllocationResult, PoolAssessment } from "@empowerfi/capital-allocation";
import { cn } from "@/lib/utils";
import { localized, tr } from "../../i18n";
import { useRailReveal } from "../../lib/moneyRail";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { bpsPercent, POOL, poolOf, REASON, type AllocationReason, type PoolId } from "../../lib/capital";
import type { MarketRow } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { REALITY, type Reality } from "../../lib/settlement";

const STEPS: Record<PoolId, { label: string; reality: Reality }[]> = localized({
  domestic: [
    { label: { en: "Brazilian investors' BRL pool", pt: "Pool em reais de investidores brasileiros" }, reality: "simulated" },
    { label: { en: "P2P structure, serviced by EmpowerFI", pt: "Estrutura P2P, com acompanhamento de pagamentos pela EmpowerFI" }, reality: "simulated" },
    { label: { en: "Pix to her business", pt: "Pix para o negócio dela" }, reality: "mock" },
  ],
  global: [
    { label: { en: "Investors' test USDC, from a wallet", pt: "USDC de teste dos investidores, de uma carteira" }, reality: "real" },
    { label: { en: "Program vault on Solana", pt: "Cofre do programa na Solana" }, reality: "real" },
    { label: { en: "Regulated off-ramp to reais", pt: "Off-ramp regulado para reais" }, reality: "simulated" },
    { label: { en: "Pix to her business", pt: "Pix para o negócio dela" }, reality: "mock" },
  ],
});

/**
 * The route the engine chose, filling in the order the money moves — the same
 * rail as her page and as the engine's third act, so one movement does not get
 * three different animations in one product.
 */
function Route({ pool }: { pool: PoolId }) {
  const steps = STEPS[pool];
  const rail = useRailReveal(steps.length);
  return (
    <ol ref={rail.ref} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-2">
      {steps.map((s, i) => {
        const state = rail.state(i);
        const here = state !== "waiting";
        return (
          <li key={s.label} className="flex items-center gap-2">
            {i > 0 && (
              <span className={cn("transition-opacity duration-300 motion-reduce:transition-none motion-reduce:opacity-100",
                here ? "opacity-100" : "opacity-20")}>
                <ArrowRight size={14} className="hidden text-accent sm:block" aria-hidden />
                <ArrowDown size={14} className="ml-2 text-accent sm:hidden" aria-hidden />
              </span>
            )}
            <span className={cn(
              "inline-flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-foreground",
              "transition-[opacity,transform,border-color] duration-500 ease-out",
              "motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-x-0",
              state === "running" ? "border-accent/60 bg-accent/5 opacity-100 translate-x-0"
                : here ? "border-border bg-secondary/40 opacity-100 translate-x-0"
                  : "border-transparent bg-secondary/20 opacity-0 -translate-x-1")}>
              {s.label} <StatusPill tone={REALITY[s.reality].tone} dot={false}>{REALITY[s.reality].label}</StatusPill>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Assessment({ a, chosen }: { a: PoolAssessment; chosen: boolean }) {
  return (
    <div className={`space-y-2 rounded-xl border p-3 ${chosen ? "border-primary/60 bg-primary/5" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{POOL[a.pool].name}</span>
        {chosen ? <StatusPill tone="positive" dot={false}>{tr({ en: "Selected", pt: "Escolhido" })}</StatusPill> : null}
      </div>
      <p className={`flex items-center gap-1.5 text-xs ${a.feasible ? "text-positive" : "text-caution"}`}>
        {a.feasible ? <Check size={13} /> : <X size={13} />}
        {a.feasible ? tr({ en: "Available and eligible", pt: "Disponível e elegível" }) : (a.blocks as AllocationReason[]).map((b) => REASON[b].label).join(" · ")}
      </p>
      <dl className="num space-y-1 text-xs">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tr({ en: "Her all-in cost, a year", pt: "Custo total para ela, ao ano" })}</dt><dd className="text-foreground">{bpsPercent(a.all_in_bps)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tr({ en: "FX hedge, a year", pt: "Hedge cambial, ao ano" })}</dt><dd className="text-foreground">{bpsPercent(a.fx_hedge_bps)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{tr({ en: "Ramp in and out, a year", pt: "Rampa de entrada e saída, ao ano" })}</dt><dd className="text-foreground">{bpsPercent(a.ramp_bps_year)}</dd></div>
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
    <Panel title={tr({ en: "Funding route", pt: "Rota de captação" })}
      description={tr({
        en: "Chosen by the Capital Allocation Engine: feasibility first — liquidity, risk appetite, ticket and mandate — then what it costs her.",
        pt: "Escolhida pelo Motor de Alocação de Capital: primeiro a viabilidade (liquidez, apetite a risco, ticket e mandato), depois quanto custa para ela.",
      })}
      actions={<PoolPill pool={pool} />}>
      {pool && <Route pool={pool} />}

      <div className="space-y-2">
        <h3 className="font-heading text-base font-bold text-foreground">{tr({ en: "Why this pool?", pt: "Por que este pool?" })}</h3>
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-3">
              <span className="shrink-0"><StatusPill tone={REASON[r].tone} dot={false}>{REASON[r].label}</StatusPill></span>
              <span className="text-muted-foreground">{REASON[r].says}</span>
            </li>
          ))}
        </ul>
      </div>

      <details className="[&[open]>summary>svg]:rotate-90">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-accent hover:text-foreground">
          <ChevronRight size={13} className="transition-transform" aria-hidden />
          {tr({ en: "What each pool would have cost", pt: "Quanto cada pool custaria" })}
        </summary>
        <div className="space-y-4 pt-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Assessment a={a.domestic} chosen={pool === "domestic"} />
          <Assessment a={a.global} chosen={pool === "global"} />
        </div>

        {pool && a.borrower_rate_bps_month !== null && (
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{tr({ en: "Her side", pt: "Lado dela" })}</p>
              <p className="num text-sm text-foreground">
                {bpsPercent(a.borrower_rate_bps_month)} {tr({ en: "a month", pt: "ao mês" })} · {row.term_months} × {money(a.instalment_cents)}
              </p>
              <p className="text-xs text-muted-foreground">{tr({ en: "In reais, by Pix, whichever pool funds it.", pt: "Em reais, por Pix, seja qual for o pool que captar." })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{tr({ en: "Investors' side · simulated", pt: "Lado dos investidores · simulado" })}</p>
              <p className="num text-sm text-foreground">
                {tr({
                  en: `${bpsPercent(a.investor_return_bps ?? 0)} asked · ${bpsPercent(a.investor_net_return_bps ?? 0)} after expected loss`,
                  pt: `${bpsPercent(a.investor_return_bps ?? 0)} exigido · ${bpsPercent(a.investor_net_return_bps ?? 0)} após perda esperada`,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr({ en: `${POOL[pool].investors}, in ${POOL[pool].asset.toLowerCase()}.`, pt: `${POOL[pool].investors}, em ${POOL[pool].asset.toLowerCase()}.` })}
              </p>
            </div>
          </div>
        )}
        </div>
      </details>
      <p className="font-mono text-[11px] text-muted-foreground">{a.model_version}</p>
    </Panel>
  );
}
