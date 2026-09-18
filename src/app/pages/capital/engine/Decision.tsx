import type { AllocationResult, PoolId, PoolPolicy } from "@empowerfi/capital-allocation";
import { Check, Hourglass, Route, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PoolPill from "../../../components/product/PoolPill";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { bpsPercent, POOL, REASON } from "../../../lib/capital";
import { type CreditStep, type EngineOpportunity, orderedChecks } from "../../../lib/engine";
import type { SettlementRouteResult } from "../../../lib/settlementRoute";
import { money } from "../../../lib/readiness";
import { usdc } from "../../../lib/solana";
import CapitalPath from "./CapitalPath";
import SettlementRoute from "./SettlementRoute";
import { checkDetail, CHECK_TITLE, creditDetail, CREDIT_STEP_TITLE } from "./labels";

function Why({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-positive" aria-hidden /> : <X size={15} strokeWidth={3} className="mt-0.5 shrink-0 text-caution" aria-hidden />}
      <span className="text-foreground">{children}</span>
    </li>
  );
}

/** What the decision would draw from the pool: before, after, and the amount. Nothing is written. */
function Consumption({ pool, policy, amount, fxMilli }: { pool: PoolId; policy: PoolPolicy; amount: number; fxMilli: number }) {
  const before = policy.available_cents;
  const after = before - amount;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(before, 1)) * 100))}%`;
  const asUsdc = (cents: number) => usdc(Math.floor((cents * 10_000_000) / fxMilli / 10) * 10, 0);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {tr({ en: `${POOL[pool].name} liquidity`, pt: `Liquidez · ${POOL[pool].name}` })}
      </p>
      <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
        <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-35", POOL[pool].bar)} style={{ width: "100%" }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none", POOL[pool].bar)} style={{ width: pct(after) }} />
      </div>
      <p className="num text-sm text-foreground">
        {pool === "global" ? `${asUsdc(before)} → ${asUsdc(after)}` : `${money(before)} → ${money(after)}`}
      </p>
      <p className="num text-xs text-muted-foreground">
        {tr({
          en: `${pool === "global" ? `${asUsdc(amount)} (${money(amount)})` : money(amount)} would be allocated · analysis only, nothing is written`,
          pt: `${pool === "global" ? `${asUsdc(amount)} (${money(amount)})` : money(amount)} seriam alocados · só análise, nada é gravado`,
        })}
      </p>
    </div>
  );
}

/**
 * The branches converge here: the route selected, why, the reason codes as the
 * engine gave them, where the capital would go and what it would draw. Or
 * waiting for capital, which is a decision, not an error. Or Engine 1 stopping,
 * in which case no pool was asked.
 */
export default function Decision({ o, steps, result, policies, fxMilli, settlement }: {
  o: EngineOpportunity;
  steps: CreditStep[];
  result: AllocationResult | null;
  policies: { domestic: PoolPolicy; global: PoolPolicy };
  fxMilli: number;
  /** Priced here too, and only shown once global capital has won. */
  settlement: SettlementRouteResult | null;
}) {
  const failed = steps.find((s) => !s.passed);
  if (failed || !result) {
    return (
      <div className="space-y-3 rounded-2xl border tone-caution p-5 animate-in fade-in zoom-in-95 duration-300">
        <p className="flex items-center gap-2 font-heading text-lg font-bold"><X size={18} aria-hidden /> {tr({ en: "Not a qualified opportunity yet", pt: "Ainda não é uma oportunidade qualificada" })}</p>
        {failed && <p className="text-sm text-foreground">{CREDIT_STEP_TITLE[failed.id]}: {creditDetail(failed.id, o)}</p>}
        <p className="text-sm text-muted-foreground">{tr({
          en: "The credit engine stops here, so the capital allocation engine is not run: no pool is asked to fund a request that is not qualified.",
          pt: "O motor de crédito para aqui, então o motor de alocação não roda: nenhum pool é consultado para financiar um pedido que não está qualificado.",
        })}</p>
      </div>
    );
  }

  const pool = result.pool;
  const other: PoolId | null = pool === "domestic" ? "global" : pool === "global" ? "domestic" : null;
  const both = result.domestic.feasible && result.global.feasible;
  const listing = o.funding_pool ?? null;
  const matchesListing = o.allocation !== null && listing === pool;

  if (!pool) {
    return (
      <div className="space-y-4 rounded-2xl border border-caution/40 bg-caution/[0.06] p-5 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-heading text-xl font-bold text-caution"><Hourglass size={20} aria-hidden /> {tr({ en: "Waiting for capital", pt: "Aguardando capital" })}</p>
          <StatusPill tone="caution" dot={false}>NO_POOL_AVAILABLE</StatusPill>
        </div>
        <p className="text-sm text-muted-foreground">{tr({
          en: "A valid allocation decision, not an error: the opportunity is qualified, and neither pool can fund it today. It waits in the queue until one can.",
          pt: "Uma decisão de alocação válida, não um erro: a oportunidade está qualificada, e nenhum pool pode financiá-la hoje. Ela espera na fila até um poder.",
        })}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(["domestic", "global"] as PoolId[]).map((p) => (
            <div key={p} className="space-y-1.5 rounded-xl border border-border bg-card/60 p-3">
              <p className="text-sm font-semibold text-foreground">{POOL[p].name}</p>
              {orderedChecks(result[p].checks).filter((c) => !c.passed).map((c) => (
                <div key={c.check} className="text-xs">
                  <p className="font-mono font-semibold text-caution">{c.reason}</p>
                  <p className="text-muted-foreground">{CHECK_TITLE[c.check]}: {checkDetail(c)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const chosen = result[pool];
  const policy = policies[pool];
  const unlock = !both && pool === "global";
  return (
    <div className="space-y-5 rounded-2xl border border-positive/40 bg-positive/[0.05] p-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-positive"><Route size={14} aria-hidden /> {tr({ en: "Route selected", pt: "Rota escolhida" })}</p>
          <p className="font-heading text-2xl font-bold text-foreground">{POOL[pool].name} <span className="text-muted-foreground">/ {pool === "domestic" ? "Pix" : "USDC"}</span></p>
          {unlock && <p className="text-sm font-semibold uppercase tracking-wide text-info">{tr({ en: "Global capital unlocks this opportunity", pt: "O capital global viabiliza esta oportunidade" })}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{tr({ en: "Estimated all-in cost", pt: "Custo total estimado" })}</p>
          <p className="num font-heading text-3xl font-bold text-foreground">{bpsPercent(chosen.all_in_bps)} <span className="text-base font-medium text-muted-foreground">{tr({ en: "p.a.", pt: "a.a." })}</span></p>
          <p className="num text-xs text-muted-foreground">{tr({
            en: `${bpsPercent(result.borrower_rate_bps_month!)} a month · ${o.term_months} × ${money(result.instalment_cents)}`,
            pt: `${bpsPercent(result.borrower_rate_bps_month!)} ao mês · ${o.term_months} × ${money(result.instalment_cents)}`,
          })}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Why this route?", pt: "Por que esta rota?" })}</p>
          <ul className="space-y-1.5">
            <Why ok>{tr({ en: "Qualified by the credit engine", pt: "Qualificada pelo motor de crédito" })}</Why>
            <Why ok>{tr({ en: `Capital available: ${money(policy.available_cents)} ≥ ${money(o.amount_cents)}`, pt: `Capital disponível: ${money(policy.available_cents)} ≥ ${money(o.amount_cents)}` })}</Why>
            <Why ok>{tr({ en: "Ticket, risk appetite and mandate match", pt: "Ticket, apetite a risco e mandato compatíveis" })}</Why>
            {both
              ? <Why ok>{tr({
                en: `Lowest sustainable cost: ${bpsPercent(chosen.all_in_bps)} against ${bpsPercent(result[other!].all_in_bps)} through ${POOL[other!].name}`,
                pt: `Menor custo sustentável: ${bpsPercent(chosen.all_in_bps)} contra ${bpsPercent(result[other!].all_in_bps)} pelo ${POOL[other!].name}`,
              })}</Why>
              : <Why ok={false}>{tr({ en: `${POOL[other!].name} cannot fund it: ${result[other!].blocks.join(", ")}`, pt: `${POOL[other!].name} não pode financiar: ${result[other!].blocks.join(", ")}` })}</Why>}
          </ul>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Reason codes", pt: "Motivos" })}</p>
            <ul className="space-y-1.5">
              {result.reason_codes.map((r) => (
                <li key={r} className="space-y-0.5 text-xs">
                  <StatusPill tone={REASON[r].tone} dot={false}>{r}</StatusPill>
                  <p className="text-muted-foreground">{REASON[r].says}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <Consumption pool={pool} policy={policy} amount={o.amount_cents} fxMilli={fxMilli} />
          <div className={cn("rounded-xl border px-3 py-2 text-xs", matchesListing ? "tone-positive" : "tone-neutral")}>
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {tr({ en: "Recorded at listing:", pt: "Registrado na abertura:" })} <PoolPill pool={listing} />
            </p>
            <p className="mt-1">{matchesListing
              ? tr({ en: "Allocated: the database gave it the same pool when it opened to investors.", pt: "Alocada: o banco de dados deu a ela o mesmo pool quando abriu para investidores." })
              : tr({
                en: "The database allocated it when it opened to investors, against the liquidity of that moment. Today's run can answer differently; the recorded pool stands while investors hold positions.",
                pt: "O banco de dados alocou quando ela abriu para investidores, com a liquidez daquele momento. A execução de hoje pode responder diferente; o pool registrado vale enquanto houver investidores com posições.",
              })}</p>
          </div>
        </div>
      </div>

      <CapitalPath pool={pool} route={pool === "global" ? settlement?.selected ?? null : null} />

      {pool === "global" && settlement && <SettlementRoute result={settlement} />}
    </div>
  );
}
