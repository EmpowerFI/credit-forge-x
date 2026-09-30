import { cloneElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Circle, Loader2 } from "lucide-react";
import LoadError from "../../components/LoadError";
import { RailMarker } from "../../components/product/MoneyRail";
import { railCard, type RailState, useRailReveal } from "../../lib/moneyRail";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import ZcashTx from "../../components/product/ZcashTx";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import PoolPill from "../../components/product/PoolPill";
import PrivacyBoundaries from "../../components/product/PrivacyBoundaries";
import StatusPill from "../../components/product/StatusPill";
import VerifyOnSolana from "../../components/product/VerifyOnSolana";
import { bpsPercent, poolOf, positionReais } from "../../lib/capital";
import { CAPITAL_USE_LABEL, LOAN_LABEL, type CapitalUse, type LoanStatus } from "../../lib/credit";
import { type FundingStatus, type Grade, positionState, RISK, title } from "../../lib/investor";
import { platform } from "../../lib/platform";
import { money, type CreditPurpose } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { fetchZecReturns, POOL_LABEL, usdPerZec, zec, type ZecReturn, zecReturnsKey } from "../../lib/zcash";
import { useAuth } from "../../auth/useAuth";
import ZecReturns from "./ZecReturns";
import { type PayoutStatus, reaisAtRamp, reaisRate, REALITY, type Reality } from "../../lib/settlement";
import { FX_STRUCK, ROUTE, ROUTE_REASON, type PositionRoute } from "../../lib/settlementRoute";
import Lifecycle, { type LifecycleStage, type StageState } from "./Lifecycle";
import { formatDate, formatNumber, tr } from "../../i18n";
import EvcLabel from "../../components/product/EvcLabel";
import VerifyButton from "../../components/proof/VerifyButton";

function RouteStep({ n, title, reality, children, state = "settled", last }: {
  n: number; title: string; reality: Reality | null; children: React.ReactNode;
  state?: RailState; last?: boolean;
}) {
  return (
    <li className="flex gap-3 text-sm">
      <RailMarker state={state} first={n === 1} last={last}><span className="num">{n}</span></RailMarker>
      <div className={`${railCard(state)} space-y-0.5 pb-4`}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-foreground">{title}</span>
          {reality && <StatusPill tone={REALITY[reality].tone}>{REALITY[reality].label}</StatusPill>}
        </span>
        <span className="block text-xs text-muted-foreground">{children}</span>
      </div>
    </li>
  );
}

/** The route's own list, settling leg by leg once it is scrolled to. */
function Route({ steps }: { steps: React.ReactElement[] }) {
  const rail = useRailReveal(steps.length);
  return (
    <ol ref={rail.ref}>
      {steps.map((step, i) => cloneElement(step, { key: i, state: rail.state(i), last: i === steps.length - 1 }))}
    </ol>
  );
}

function PayoutCell({ payout, simulated, zecReturn }: {
  payout: PositionData["schedule"][number]["payout"];
  simulated: boolean;
  /** For a shielded-ZEC position with no wallet: the share paid in ZEC instead. */
  zecReturn?: ZecReturn;
}) {
  if (simulated) return <span className="text-xs text-muted-foreground">{tr({ en: "simulated", pt: "simulado" })}</span>;
  if (!payout) return <span className="text-xs text-muted-foreground">—</span>;
  if (zecReturn?.status === "sent" && zecReturn.txid) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        ZEC <ZcashTx txid={zecReturn.txid} />
      </span>
    );
  }
  if (zecReturn?.status === "failed") return <span className="text-xs text-alert">{tr({ en: "ZEC send needs a look", pt: "envio em ZEC precisa de atenção" })}</span>;
  if (zecReturn) return <span className="text-xs text-muted-foreground">{tr({ en: "owed in ZEC", pt: "a pagar em ZEC" })}</span>;
  if (payout.status === "done" && payout.signature) return <ExplorerLink tx={payout.signature} />;
  if (payout.status === "held") return <span className="text-xs text-caution">{tr({ en: "held: no return address", pt: "retido: sem endereço de retorno" })}</span>;
  if (payout.status === "failed") return <span className="text-xs text-alert">{tr({ en: "failed", pt: "falhou" })}</span>;
  return <span className="text-xs text-muted-foreground">{tr({ en: "on its way", pt: "a caminho" })}</span>;
}

// One position as a financial position you can follow: the deposit, the
// proof of the allocation, the loan's schedule and servicing, and the outcome.

interface PositionData {
  investment: { id: string; amount_micro_usdc: number; amount_cents: number | null; share_bps: number; mode: string; status: "allocated" | "refund_due" | "refunded";
    deposit_signature: string | null; wallet_address: string | null; invested_at: string; is_simulated: boolean;
    refund_signature: string | null; refunded_at: string | null };
  zcash: { ref: string; txid: string | null; pool: string | null; amount_zat: number; received_zat: number | null; usd_per_zec_cents: number;
    quote_source: string; mined_height: number | null; confirmed_at: string | null; credit_signature: string | null } | null;
  proof: { status: string; signature: string | null; account: string | null; commitment: string | null; reconcile: string } | null;
  opportunity: { id: string; code: string; purpose: CreditPurpose; business_sector: string | null; amount_cents: number; term_months: number;
    risk_band: Grade; funding_status: FundingStatus; funding_target_micro_usdc: number; fx_brl_per_usdc_milli: number;
    funding_pool: "domestic" | "global" | null; allocation_reason_codes: string[] | null };
  loan: { id: string; status: LoanStatus; principal_cents: number; rate_bps: number; term_months: number; instalment_cents: number;
    disbursed_at: string | null; active_since: string | null; instalment_share_micro_usdc: number } | null;
  settlement: {
    ramp_bps: number;
    /** Null until a global loan is disbursed with the routing experiment on. */
    route: PositionRoute | null;
    release: { status: PayoutStatus; amount_micro_usdc: number; signature: string | null; transfer_micro_usdc: number | null;
      loans_in_transfer: number; at: string | null } | null;
    pix: { e2e: string; brl_cents: number; at: string | null } | null;
  } | null;
  schedule: { instalment_no: number; due_at: string | null; paid_at: string | null; payment_id: string | null; share_micro_usdc: number | null;
    pix_e2e: string | null; payout: { status: PayoutStatus; amount_micro_usdc: number; signature: string | null } | null }[];
  servicing: { event_id: string; to_status: LoanStatus; note: string | null; at: string }[];
  outcome: { id: string; avg_revenue_before_cents: number; avg_revenue_after_cents: number; evc_cents: number; capital_use: CapitalUse;
    confidence: Grade; measured_at: string } | null;
}

const date = (iso: string | null) => (iso ? formatDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "—");
/** A percentage: 12.5% or 12,5%. */
const pct = (value: number, digits: number) => `${formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const confidenceLabel = (grade: Grade) =>
  tr({ en: grade.toLowerCase(), pt: grade === "HIGH" ? "alta" : grade === "MEDIUM" ? "média" : "baixa" });

export default function Position() {
  const { id } = useParams();
  const { profile } = useAuth();
  const position = useQuery({
    queryKey: ["platform", "investor-position", id],
    queryFn: async () => {
      const { data, error } = await platform.rpc("investor_position", { p_investment_id: id! });
      if (error) throw error;
      return data as unknown as PositionData;
    },
  });
  // Paid in shielded ZEC with no Solana wallet: what comes back goes back as ZEC.
  const zecOnly = position.data?.investment.mode === "zcash" && !position.data.investment.wallet_address && !position.data.investment.is_simulated;
  const zecReturns = useQuery({ queryKey: zecReturnsKey(id ?? ""), queryFn: () => fetchZecReturns(id!), enabled: Boolean(id && zecOnly) });
  if (position.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  if (position.isError) return <LoadError error={position.error} onRetry={() => position.refetch()} />;
  const { investment: inv, zcash, proof, opportunity: opp, loan, settlement, schedule, servicing, outcome } = position.data;
  const state = positionState({ status: inv.status, loan_status: loan?.status ?? null, funding_status: opp.funding_status });
  const repaid = schedule.reduce((s, i) => s + (i.share_micro_usdc ?? 0), 0);
  const expected = loan ? loan.instalment_share_micro_usdc * loan.term_months : null;
  const now = Date.now();
  const domestic = poolOf(opp.funding_pool) === "domestic";
  const route = settlement?.route ?? null;
  const chosen = route?.quotes.find((q) => q.route === route.selected) ?? null;
  const other = route?.quotes.find((q) => q.route !== route.selected) ?? null;
  // Why this route and not the other one. A reason code reads as a comparison
  // when both could settle; when only one could, it is the other's own block,
  // and saying "the route is switched off" beside the route that paid her
  // would read as if that one had been.
  const why = other && !other.feasible && other.blocks[0]
    ? tr({
      en: `The ${ROUTE[other.route].short} route could not settle this one: ${ROUTE_REASON[other.blocks[0]].label.toLowerCase()}.`,
      pt: `A rota ${ROUTE[other.route].short} não pôde liquidar esta: ${ROUTE_REASON[other.blocks[0]].label.toLowerCase()}.`,
    })
    : route?.reason_codes[0] ? ROUTE_REASON[route.reason_codes[0]].says : "";
  // What she owes is written in reais on either pool, and the book is kept in
  // USDC at the quote this loan holds. On the global pool both are shown: the
  // reais bind, the dollars are what moved.
  const obligation = (micro: number | null | undefined, cents?: number | null) =>
    money(positionReais(cents ?? null, micro ?? 0, opp.fx_brl_per_usdc_milli));

  const paid = schedule.filter((i) => i.paid_at).length;
  const paidOut = schedule.filter((i) => i.payout?.status === "done").length;
  // The lifecycle the addendum names, filled in with what this position did.
  const stages: Record<LifecycleStage, StageState> = {
    funded: {
      done: true,
      reality: inv.is_simulated ? "simulated" : zcash ? "zcash" : "real",
      detail: inv.is_simulated
        ? tr({ en: `${usdc(inv.amount_micro_usdc)}, simulated: no USDC moved`, pt: `${usdc(inv.amount_micro_usdc)}, simulado: nenhum USDC se moveu` })
        : tr({ en: `Your ${usdc(inv.amount_micro_usdc)} into the program's vault`, pt: `Seus ${usdc(inv.amount_micro_usdc)} no cofre do programa` }),
    },
    locked: {
      done: Boolean(loan?.disbursed_at),
      reality: "simulated",
      detail: chosen
        ? tr({
          en: `${FX_STRUCK[chosen.fx_struck].label}, at ${reaisRate(chosen.fx_rate_milli, 3)}/USDC`,
          pt: `${FX_STRUCK[chosen.fx_struck].label}, a ${reaisRate(chosen.fx_rate_milli, 3)}/USDC`,
        })
        : loan?.disbursed_at
        ? tr({ en: `At this loan's quote, ${reaisRate(opp.fx_brl_per_usdc_milli, 3)}/USDC`, pt: `Pela cotação deste empréstimo, ${reaisRate(opp.fx_brl_per_usdc_milli, 3)}/USDC` })
        : tr({ en: "Struck when the desk settles the loan", pt: "Fechado quando a mesa liquidar o empréstimo" }),
    },
    disbursed: {
      done: Boolean(settlement?.pix),
      reality: "mock",
      detail: settlement?.pix
        ? tr({ en: `${money(settlement.pix.brl_cents)} to her account · ${date(settlement.pix.at)}`, pt: `${money(settlement.pix.brl_cents)} na conta da empreendedora · ${date(settlement.pix.at)}` })
        : tr({ en: "When EmpowerFI's P2P desk disburses", pt: "Quando a mesa P2P da EmpowerFI desembolsar" }),
    },
    repayments: {
      done: paid > 0,
      reality: "mock",
      detail: loan
        ? tr({ en: `${paid} of ${loan.term_months} instalments paid by Pix`, pt: `${paid} de ${loan.term_months} parcelas pagas por Pix` })
        : tr({ en: "Monthly, once repayment starts", pt: "Todo mês, depois que os pagamentos começarem" }),
    },
    settlement: {
      done: inv.is_simulated ? paid > 0 : paidOut > 0,
      reality: inv.is_simulated ? "simulated" : zecOnly ? "zcash" : "real",
      detail: inv.is_simulated
        ? tr({ en: "Your share is shown, not paid", pt: "Sua parte aparece, mas não é paga" })
        : zecOnly
        ? tr({ en: `${obligation(repaid)} owed back to you in shielded ZEC`, pt: `${obligation(repaid)} a voltar para você em ZEC blindado` })
        : tr({ en: `${usdc(repaid)} paid out to your wallet`, pt: `${usdc(repaid)} repassados para a sua carteira` }),
    },
  };

  return (
    <div className="space-y-6">
      <Link to="/app/investor/portfolio" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> {tr({ en: "Portfolio", pt: "Carteira" })}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title(opp.purpose, opp.business_sector)}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{opp.code}</span> · {tr({ en: "Risk", pt: "Risco" })} {RISK[opp.risk_band].grade} · {opp.term_months} {tr({ en: "months", pt: "meses" })} ·{" "}
            <Link to={`/app/investor/opportunities/${opp.id}`} className="text-info hover:underline">{tr({ en: "opportunity snapshot", pt: "resumo da oportunidade" })}</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PoolPill pool={poolOf(opp.funding_pool)} />
          {inv.is_simulated && <StatusPill tone="caution">{tr({ en: "Simulated position", pt: "Posição simulada" })}</StatusPill>}
          <StatusPill tone={state.tone}>{state.label}</StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={tr({ en: "Invested", pt: "Investido" })}
          value={domestic ? obligation(inv.amount_micro_usdc, inv.amount_cents) : usdc(inv.amount_micro_usdc)}
          hint={domestic ? date(inv.invested_at) : `${date(inv.invested_at)} · ≈ ${obligation(inv.amount_micro_usdc, inv.amount_cents)}`} />
        <StatTile label={tr({ en: "Your share of the loan", pt: "Sua parte do empréstimo" })} value={pct(inv.share_bps / 100, 1)} hint={money(opp.amount_cents)} />
        <StatTile label={tr({ en: "Repaid to you", pt: "Pago a você" })} value={obligation(repaid)} hintTone="positive"
          hint={loan
            ? tr({
              en: `${schedule.filter((s) => s.paid_at).length} of ${loan.term_months} instalments${domestic ? "" : ` · ${usdc(repaid)}`}`,
              pt: `${schedule.filter((s) => s.paid_at).length} de ${loan.term_months} parcelas${domestic ? "" : ` · ${usdc(repaid)}`}`,
            })
            : tr({ en: "not disbursed", pt: "não desembolsado" })} />
        <StatTile label={tr({ en: "Outstanding", pt: "A receber" })} value={expected !== null ? obligation(Math.max(0, expected - repaid)) : "—"}
          hint={expected !== null && loan
            ? tr({
              en: `of ${obligation(expected)} scheduled at ${pct(loan.rate_bps / 100, 2)}/month${domestic ? "" : ` · ${usdc(Math.max(0, expected - repaid))}`} · simulated`,
              pt: `de ${obligation(expected)} previstos a ${pct(loan.rate_bps / 100, 2)} ao mês${domestic ? "" : ` · ${usdc(Math.max(0, expected - repaid))}`} · simulado`,
            })
            : undefined} />
      </div>

      {!domestic && loan && (
        <Lifecycle principalCents={loan.principal_cents} instalmentCents={loan.instalment_cents} termMonths={loan.term_months}
          fxMilli={opp.fx_brl_per_usdc_milli} stages={stages}>
          {chosen && route && loan && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <DataTag kind="proven" withLabel />
              {tr({
                en: `Settled through ${ROUTE[chosen.route].label}, ${FX_STRUCK[chosen.fx_struck].label.toLowerCase()}. Her principal arrived whole either way; the route is what the vault had to release to deliver it.`,
                pt: `Liquidado pela rota ${ROUTE[chosen.route].label}, ${FX_STRUCK[chosen.fx_struck].label.toLowerCase()}. O principal da empreendedora chegou inteiro de qualquer forma; a rota é o que o cofre teve de liberar para entregá-lo.`,
              })}
              <span className="font-mono">{route.model_version}</span>
              <VerifyButton icon className="text-xs text-positive" label={tr({ en: "Open the proof", pt: "Abrir a prova" })} proof={{
                kind: "settlement_route", entity_id: loan.id,
                settlement: {
                  route: chosen.route, quoted_at: chosen.quoted_at, net_brl_cents: chosen.net_brl_cents,
                  source: chosen.provider, source_url: chosen.source_url, reason_code: route.reason_codes[0] ?? null,
                  reality: chosen.reality, model_version: route.model_version,
                },
              }} />
            </p>
          )}
        </Lifecycle>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Investment", pt: "Investimento" })}
          description={domestic
            ? tr({
              en: "Your allocation from the domestic P2P pool, in reais — simulated — and the proof of where it went.",
              pt: "Sua alocação pelo pool doméstico P2P, em reais — simulada — e a prova de para onde ela foi.",
            })
            : zcash
            ? tr({
              en: "Paid with shielded ZEC, credited to the program's vault in USDC, and the proof of where it went.",
              pt: "Paga com ZEC blindado, creditada em USDC no cofre do programa, e a prova de para onde ela foi.",
            })
            : tr({ en: "Your deposit into the program's vault, and the proof of where it went.", pt: "Seu depósito no cofre do programa, e a prova de para onde ele foi." })}>
          <dl className="space-y-3 text-sm">
            {zcash && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground"><DataTag kind="private" /> {tr({ en: "Shielded payment", pt: "Pagamento blindado" })}</dt>
                  <dd className="text-right">
                    <span className="num text-foreground">{zec(zcash.received_zat ?? zcash.amount_zat)}</span>
                    {zcash.pool && <span className="text-xs text-muted-foreground"> · {POOL_LABEL[zcash.pool]}</span>}
                    {zcash.txid && (
                      <span className="ml-2"><ZcashTx txid={zcash.txid} /></span>
                    )}
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr({
                    en: `On Zcash the amount, the memo (${zcash.ref}) and who paid are encrypted: the explorer shows only that a transaction happened. Converted at ${usdPerZec(zcash.usd_per_zec_cents)} per ZEC${zcash.quote_source === "demo" ? " (demo quote)" : ""}; the conversion itself is simulated on testnet.`,
                    pt: `Na Zcash, o valor, o memo (${zcash.ref}) e quem pagou ficam criptografados: o explorer mostra só que uma transação aconteceu. Convertido a ${usdPerZec(zcash.usd_per_zec_cents)} por ZEC${zcash.quote_source === "demo" ? " (cotação de demonstração)" : ""}; a conversão em si é simulada na testnet.`,
                  })}
                </p>
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                {domestic ? tr({ en: "Reais allocated", pt: "Reais alocados" })
                  : zcash ? tr({ en: "Credited to the vault", pt: "Creditado no cofre" })
                  : tr({ en: "Deposit transaction", pt: "Transação de depósito" })}
              </dt>
              <dd>{inv.deposit_signature ? <ExplorerLink tx={inv.deposit_signature} />
                : <span className="text-caution">
                  {domestic ? tr({ en: "simulated, no bank transfer", pt: "simulado, sem transferência bancária" }) : tr({ en: "simulated, no deposit", pt: "simulado, sem depósito" })}
                </span>}</dd>
            </div>
            {inv.status !== "allocated" && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{tr({ en: "Refund from the vault", pt: "Reembolso do cofre" })}</dt>
                <dd>
                  {inv.refund_signature ? <ExplorerLink tx={inv.refund_signature} />
                    : inv.is_simulated ? <span className="text-caution">{tr({ en: "simulated, nothing to return", pt: "simulado, nada a devolver" })}</span>
                    : <span className="text-caution">{tr({ en: "on its way", pt: "a caminho" })}</span>}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground"><DataTag kind="proven" /> {tr({ en: "Allocation commitment", pt: "Compromisso da alocação" })}</dt>
              <dd className="flex items-center gap-2">
                {proof?.signature && <ExplorerLink tx={proof.signature} />}
                <StatusPill tone={proof?.status === "confirmed" ? "positive" : "caution"}>
                  {proof?.reconcile === "verified" ? tr({ en: "Verified", pt: "Verificada" })
                    : proof?.status === "confirmed" ? tr({ en: "On-chain", pt: "Na blockchain" })
                    : tr({ en: "Queued", pt: "Na fila" })}
                </StatusPill>
              </dd>
            </div>
            <p className="text-xs text-muted-foreground">
              {domestic
                ? tr({
                  en: "The chain sees a commitment keyed by a random reference — not which loan it funds, and nothing about the entrepreneur.",
                  pt: "A blockchain vê um compromisso identificado por uma referência aleatória — não qual empréstimo ele financia, e nada sobre a empreendedora.",
                })
                : tr({
                  en: "The chain sees your deposit into the vault and a commitment keyed by a random reference — not which loan it funds, and nothing about the entrepreneur.",
                  pt: "A blockchain vê seu depósito no cofre e um compromisso identificado por uma referência aleatória — não qual empréstimo ele financia, e nada sobre a empreendedora.",
                })}
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <VerifyButton icon className="pt-1.5 text-sm text-positive" label={tr({ en: "Open the proof", pt: "Abrir a prova" })} proof={{
                kind: "allocation", entity_id: inv.id, signature: proof?.signature, account: proof?.account, commitment: proof?.commitment,
              }} />
              {proof?.signature && (
                <VerifyOnSolana proofs={[{ kind: "allocation", signature: proof.signature, account: proof.account, commitment: proof.commitment }]} />
              )}
            </div>
          </dl>
        </Panel>

        <Panel title={tr({ en: "Servicing", pt: "Acompanhamento de pagamentos" })}
          description={tr({ en: "What EmpowerFI's P2P desk recorded, as you may read it.", pt: "O que a mesa P2P da EmpowerFI registrou, na parte que você pode ver." })}>
          {servicing.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "EmpowerFI's P2P desk formalises the loan once the opportunity is fully funded, at the allocation engine's rate.",
                pt: "A mesa P2P da EmpowerFI formaliza o empréstimo quando a oportunidade está 100% captada, à taxa do Motor de Alocação de Capital.",
              })}
            </p>
          ) : (
            <ol className="space-y-3">
              {servicing.map((e) => (
                <li key={e.event_id} className="flex items-start gap-3 text-sm">
                  <Check size={16} className="mt-0.5 text-positive" />
                  <span className="flex-1">
                    <span className="text-foreground">{LOAN_LABEL[e.to_status]}</span>
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                    <span className="block text-xs text-muted-foreground">{date(e.at)}</span>
                  </span>
                  <VerifyButton className="text-xs text-positive" proof={{
                    kind: "loan_transition", entity_id: e.event_id,
                    settlement: e.to_status === "DISBURSED" && chosen && route
                      ? {
                        route: chosen.route, quoted_at: chosen.quoted_at, net_brl_cents: chosen.net_brl_cents,
                        source: chosen.provider, source_url: chosen.source_url, reason_code: route.reason_codes[0] ?? null,
                        reality: chosen.reality, model_version: route.model_version,
                      }
                      : null,
                  }} />
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {zecOnly && (
        <ZecReturns investmentId={inv.id} readOnly={profile?.role !== "capital_provider"}
          owed={inv.status === "refund_due" || schedule.some((s) => s.payout?.status === "held")} />
      )}

      <Panel title={tr({ en: "Where the money went", pt: "Para onde o dinheiro foi" })}
        description={tr({
          en: "Your capital's route to her business and back, leg by leg: which are transactions you can open, and which are simulated.",
          pt: "O caminho do seu capital até o negócio dela e de volta, etapa por etapa: quais são transações que você pode abrir e quais são simuladas.",
        })}>
        {domestic ? (
          <Route steps={[
            <RouteStep n={1} title={tr({ en: "Allocated from the domestic BRL pool", pt: "Alocado pelo pool doméstico em reais" })} reality="simulated">
              {tr({
                en: `${money(positionReais(inv.amount_cents, inv.amount_micro_usdc, opp.fx_brl_per_usdc_milli))} from Brazilian investors' pool. No bank transfer or wallet in this prototype.`,
                pt: `${money(positionReais(inv.amount_cents, inv.amount_micro_usdc, opp.fx_brl_per_usdc_milli))} do pool de investidores brasileiros. Sem transferência bancária nem carteira neste protótipo.`,
              })}
            </RouteStep>,
            <RouteStep n={2} title={tr({ en: "Held in the P2P structure", pt: "Mantido na estrutura P2P" })} reality={loan?.disbursed_at ? "simulated" : null}>
              {loan?.disbursed_at
                ? tr({ en: "Formalised by EmpowerFI's P2P desk at the allocation engine's rate.", pt: "Formalizado pela mesa P2P da EmpowerFI, à taxa do Motor de Alocação de Capital." })
                : tr({ en: "Until EmpowerFI's P2P desk formalises and disburses the loan.", pt: "Até a mesa P2P da EmpowerFI formalizar e desembolsar o empréstimo." })}
            </RouteStep>,
            <RouteStep n={3} title={tr({ en: "Paid to her business by Pix", pt: "Pago ao negócio dela por Pix" })} reality={settlement?.pix ? "mock" : null}>
              {settlement?.pix
                ? <>{money(settlement.pix.brl_cents)}, {tr({ en: "the whole loan", pt: "o empréstimo inteiro" })} · {date(settlement.pix.at)} · <span className="break-all font-mono">{settlement.pix.e2e}</span></>
                : tr({ en: "Paid when EmpowerFI's P2P desk disburses.", pt: "Pago quando a mesa P2P da EmpowerFI desembolsar." })}
            </RouteStep>,
            <RouteStep n={4} title={tr({ en: "Instalments come back to you, in reais", pt: "As parcelas voltam para você, em reais" })} reality={schedule.some((s) => s.payment_id) ? "simulated" : null}>
              {tr({
                en: "She pays each instalment by Pix (a mock); your share is shown in reais, and is not paid in this prototype. No currency conversion on this route.",
                pt: "Ela paga cada parcela por Pix (fictício); sua parte aparece em reais e não é paga neste protótipo. Não há conversão de moeda nesta rota.",
              })}
            </RouteStep>
          ]} />
        ) : (
          <Route steps={[
            <RouteStep n={1}
              title={zcash ? tr({ en: "Paid in shielded ZEC, credited to the vault", pt: "Pago em ZEC blindado, creditado no cofre" }) : tr({ en: "Into the program's vault", pt: "Para o cofre do programa" })}
              reality={inv.is_simulated ? "simulated" : "real"}>
              {inv.deposit_signature ? <>{usdc(inv.amount_micro_usdc)} · <ExplorerLink tx={inv.deposit_signature} /></>
                : tr({ en: "A simulated position: no USDC moved.", pt: "Uma posição simulada: nenhum USDC foi movimentado." })}
            </RouteStep>,
            <RouteStep n={2} title={tr({ en: "Released to the regulated off-ramp", pt: "Liberado para o off-ramp regulado" })} reality={!loan?.disbursed_at ? null : inv.is_simulated ? "simulated" : "real"}>
              {!loan?.disbursed_at ? tr({ en: "When EmpowerFI's P2P desk disburses the loan.", pt: "Quando a mesa P2P da EmpowerFI desembolsar o empréstimo." })
                : inv.is_simulated || !settlement?.release ? tr({ en: "Nothing real to release for this position.", pt: "Nada real a liberar nesta posição." })
                : settlement.release.status === "done" && settlement.release.signature ? (
                  <>
                    {tr({ en: "With the loan's other real deposits,", pt: "Com os outros depósitos reais do empréstimo," })} {usdc(settlement.release.amount_micro_usdc)}
                    {settlement.release.loans_in_transfer > 1 && tr({
                      en: `, in one transfer covering ${settlement.release.loans_in_transfer} loans`,
                      pt: `, numa única transferência para ${settlement.release.loans_in_transfer} empréstimos`,
                    })} · <ExplorerLink tx={settlement.release.signature} />
                  </>
                ) : tr({ en: "Leaving the vault now.", pt: "Saindo do cofre agora." })}
            </RouteStep>,
            <RouteStep n={3}
              title={chosen
                ? tr({ en: `Converted to reais · ${ROUTE[chosen.route].short}`, pt: `Convertido em reais · ${ROUTE[chosen.route].short}` })
                : tr({ en: "Converted to reais", pt: "Convertido em reais" })}
              reality={loan?.disbursed_at ? "simulated" : null}>
              {chosen && route
                ? tr({
                  en: `${FX_STRUCK[chosen.fx_struck].label} at ${reaisRate(chosen.fx_rate_milli, 3)} per USDC, ${bpsPercent(chosen.cost_bps)} in spread and fees. ${why}`,
                  pt: `${FX_STRUCK[chosen.fx_struck].label} a ${reaisRate(chosen.fx_rate_milli, 3)} por USDC, ${bpsPercent(chosen.cost_bps)} de spread e taxas. ${why}`,
                })
                : loan?.disbursed_at
                ? tr({
                  en: `Your ${usdc(inv.amount_micro_usdc)} ≈ ${money(reaisAtRamp(inv.amount_micro_usdc, opp.fx_brl_per_usdc_milli, settlement?.ramp_bps ?? 50))} at ${reaisRate(opp.fx_brl_per_usdc_milli)} per USDC, less the ramp's ${pct((settlement?.ramp_bps ?? 50) / 100, 2)}.`,
                  pt: `Seus ${usdc(inv.amount_micro_usdc)} ≈ ${money(reaisAtRamp(inv.amount_micro_usdc, opp.fx_brl_per_usdc_milli, settlement?.ramp_bps ?? 50))} a ${reaisRate(opp.fx_brl_per_usdc_milli)} por USDC, menos os ${pct((settlement?.ramp_bps ?? 50) / 100, 2)} da rampa.`,
                })
                : tr({ en: "At the ramp, once released.", pt: "Na rampa, depois de liberado." })}
            </RouteStep>,
            <RouteStep n={4} title={tr({ en: "Paid to her business by Pix", pt: "Pago ao negócio dela por Pix" })} reality={settlement?.pix ? "mock" : null}>
              {settlement?.pix
                ? <>{money(settlement.pix.brl_cents)}, {tr({ en: "the whole loan", pt: "o empréstimo inteiro" })} · {date(settlement.pix.at)} · <span className="break-all font-mono">{settlement.pix.e2e}</span></>
                : tr({ en: "Paid when EmpowerFI's P2P desk disburses.", pt: "Pago quando a mesa P2P da EmpowerFI desembolsar." })}
            </RouteStep>,
            <RouteStep n={5} title={tr({ en: "Instalments come back to you", pt: "As parcelas voltam para você" })}
              reality={schedule.some((s) => s.payment_id) ? (inv.is_simulated ? "simulated" : "real") : null}>
              {inv.is_simulated ? tr({ en: "Simulated: your share of each instalment is shown, not paid.", pt: "Simulado: sua parte de cada parcela aparece, mas não é paga." })
                : !inv.wallet_address ? (zecReturns.data?.return_address
                  ? tr({
                    en: "She pays each instalment by Pix (a mock). Your share goes back to you in shielded ZEC, from EmpowerFI's treasury to your return address: real testnet ZEC, at the quote when it is sent.",
                    pt: "Ela paga cada parcela por Pix (fictício). Sua parte volta para você em ZEC blindado, da tesouraria da EmpowerFI para o seu endereço de retorno: ZEC real da testnet, pela cotação do momento do envio.",
                  })
                  : tr({
                    en: "She pays each instalment by Pix (a mock). Your share is held until you give a shielded return address, below: it then goes back to you in ZEC.",
                    pt: "Ela paga cada parcela por Pix (fictício). Sua parte fica retida até você informar um endereço de retorno blindado, abaixo: aí ela volta para você em ZEC.",
                  }))
                : tr({
                  en: `She pays each instalment by Pix (a mock); the ramp returns your share to the vault, which pays it to your wallet in the same transaction. ${schedule.filter((s) => s.payout?.status === "done").length} of ${schedule.filter((s) => s.payment_id).length} paid out so far.`,
                  pt: `Ela paga cada parcela por Pix (fictício); a rampa devolve sua parte ao cofre, que a repassa para a sua carteira na mesma transação. ${schedule.filter((s) => s.payout?.status === "done").length} de ${schedule.filter((s) => s.payment_id).length} repassadas até agora.`,
                })}
            </RouteStep>
          ]} />
        )}
        {/* The mechanism, offered after the money moved rather than before it.
            The engine page takes this code and opens on this request. */}
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          <Link to={`/app/capital/engine?opportunity=${opp.code}`} className="text-info hover:underline">
            {tr({ en: "Why this opportunity existed", pt: "Por que esta oportunidade existiu" })}
          </Link>{" "}
          {tr({
            en: "— the two engines that judged this request, the pool they gave it, and the capital they released.",
            pt: "— os dois motores que avaliaram este pedido, o pool que deram a ele, e o capital que liberaram.",
          })}
        </p>
      </Panel>

      {loan && (
        <Panel title={tr({ en: "Scheduled repayments", pt: "Pagamentos previstos" })}
          description={domestic
            ? tr({
              en: "Instalments fall due monthly from the start of repayment; your share is shown in reais, simulated.",
              pt: "As parcelas vencem todo mês a partir do início dos pagamentos; sua parte aparece em reais, simulada.",
            })
            : zecOnly
            ? tr({
              en: "Instalments fall due monthly from the start of repayment; your share goes back to you in shielded ZEC, at the quote when it is sent.",
              pt: "As parcelas vencem todo mês a partir do início dos pagamentos; sua parte volta para você em ZEC blindado, pela cotação do momento do envio.",
            })
            : tr({
              en: "Instalments fall due monthly from the start of repayment; your share is paid out in USDC at the simulated quote.",
              pt: "As parcelas vencem todo mês a partir do início dos pagamentos; sua parte é repassada em USDC pela cotação simulada.",
            })}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Due", pt: "Vencimento" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Status", pt: "Situação" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Your share", pt: "Sua parte" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Paid out", pt: "Repassado" })}</th>
                  <th className="py-2 font-medium"><span className="sr-only">{tr({ en: "Proof", pt: "Prova" })}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedule.map((s) => {
                  const late = !s.paid_at && s.due_at && new Date(s.due_at).getTime() + 30 * 86_400_000 < now;
                  return (
                    <tr key={s.instalment_no}>
                      <td className="num py-2.5 pr-4 text-muted-foreground">{s.instalment_no}</td>
                      <td className="py-2.5 pr-4 text-foreground">{s.due_at ? date(s.due_at) : tr({ en: "after repayment starts", pt: "após o início dos pagamentos" })}</td>
                      <td className="py-2.5 pr-4">
                        {s.paid_at ? <StatusPill tone="positive">{tr({ en: "Paid", pt: "Paga em" })} {date(s.paid_at)}</StatusPill>
                          : late ? <StatusPill tone="alert">{tr({ en: "Late", pt: "Em atraso" })}</StatusPill>
                          : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Circle size={10} /> {tr({ en: "Scheduled", pt: "Prevista" })}</span>}
                      </td>
                      <td className="num py-2.5 pr-4 text-right">
                        <span className="block text-foreground">{obligation(s.share_micro_usdc ?? loan.instalment_share_micro_usdc)}</span>
                        {!domestic && <span className="block text-xs text-muted-foreground">{usdc(s.share_micro_usdc ?? loan.instalment_share_micro_usdc)}</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        {s.payment_id ? (
                          <PayoutCell payout={s.payout} simulated={inv.is_simulated}
                            zecReturn={zecReturns.data?.returns.find((r) => r.kind === "payout" && r.instalment_no === s.instalment_no)} />
                        ) : null}
                      </td>
                      <td className="py-2.5 text-right">
                        {s.payment_id && <VerifyButton className="text-xs text-positive" proof={{ kind: "payment", entity_id: s.payment_id }} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <PrivacyBoundaries />

      {outcome && (
        <Panel title={tr({ en: "Productive outcome · simulated", pt: "Resultado produtivo · simulado" })}
          description={tr({
            en: "Measured from the months the business reports: before the loan's month against after it. What changed after the loan, not what the loan caused.",
            pt: "Medido pelos meses que o negócio informa: antes do mês do empréstimo comparado com depois. O que mudou após o empréstimo, não o que o empréstimo causou.",
          })}>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">{tr({ en: "Monthly sales", pt: "Vendas mensais" })}</p><p className="num text-foreground">{money(outcome.avg_revenue_before_cents)} → {money(outcome.avg_revenue_after_cents)}</p></div>
            <div><p className="text-xs text-muted-foreground"><EvcLabel /></p><p className={`num ${outcome.evc_cents >= 0 ? "text-positive" : "text-alert"}`}>{money(outcome.evc_cents)}</p></div>
            <div><p className="text-xs text-muted-foreground">{tr({ en: "Use of capital", pt: "Uso do capital" })}</p><p className="text-foreground">{CAPITAL_USE_LABEL[outcome.capital_use]}</p></div>
            <div><p className="text-xs text-muted-foreground">{tr({ en: "Confidence", pt: "Confiança" })}</p><p className="text-foreground">{confidenceLabel(outcome.confidence)} · {date(outcome.measured_at)}</p></div>
          </div>
        </Panel>
      )}
    </div>
  );
}
