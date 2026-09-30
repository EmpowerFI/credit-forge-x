import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronRight, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { localized, tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import PrivacyBoundaries from "../../components/product/PrivacyBoundaries";
import StatusPill from "../../components/product/StatusPill";
import VerifyOnSolana from "../../components/product/VerifyOnSolana";
import { type PoolId, poolOf, prototypeNotice } from "../../lib/capital";
import { DECISION_LABEL, ELIGIBILITY_REASON, percent } from "../../lib/credit";
import { FUNDING_LABEL, type MarketRow, PROOF_LABEL, type Proof, reaisFromUsdc, RISK, title } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { reaisRate } from "../../lib/settlement";
import { usdc } from "../../lib/solana";
import Lifecycle, { type LifecycleStage, type StageState } from "./Lifecycle";
import FundingBar from "./FundingBar";
import FundingRoute from "./FundingRoute";
import InvestPanel from "./InvestPanel";
import { useMarket } from "./queries";

// What an investor needs to decide, and nothing more: the purpose, the size,
// EmpowerFI's assessment, the community that vouches for her — and the proof
// that each was done, on Solana. Never her name, her words or her figures.

const WHY: Record<string, string> = localized({
  working_capital: {
    en: "Working capital to keep the business running between sales: materials, stock and day-to-day costs.",
    pt: "Capital de giro para manter o negócio funcionando entre uma venda e outra: materiais, estoque e custos do dia a dia.",
  },
  inventory: {
    en: "Stock and materials bought ahead, to sell more or produce at better prices.",
    pt: "Estoque e materiais comprados com antecedência, para vender mais ou produzir a preços melhores.",
  },
  equipment: {
    en: "Equipment that raises what the business can produce or serve in a week.",
    pt: "Equipamentos que aumentam o que o negócio consegue produzir ou atender em uma semana.",
  },
  renovation: {
    en: "Improvements to the space where the business works.",
    pt: "Melhorias no espaço onde o negócio funciona.",
  },
  other: {
    en: "A productive use the entrepreneur described to her community.",
    pt: "Um uso produtivo que a empreendedora descreveu para a comunidade dela.",
  },
});

/** Confidence and readiness bands, LOW to HIGH, as they read after a noun: "high confidence", "confiança alta". */
const LEVEL: Record<string, string> = localized({
  LOW: { en: "low", pt: "baixa" },
  MEDIUM: { en: "medium", pt: "média" },
  HIGH: { en: "high", pt: "alta" },
});

/**
 * A request the engine routed to the domestic desk. This console funds in USDC
 * and has no rail to send reais on, so there is nothing to allocate here — only
 * the reason, and the way back to a position if this investor already holds one
 * from before. Saying it beats a button that would be refused.
 */
function FundedElsewhere({ hasPosition }: { hasPosition: boolean }) {
  return (
    <Panel title={tr({ en: "Funded in reais", pt: "Financiada em reais" })}
      actions={<StatusPill tone="neutral">{tr({ en: "Not this console", pt: "Fora deste console" })}</StatusPill>}>
      <p className="text-sm text-muted-foreground">
        {tr({
          en: "The allocation engine routed this one to Brazilian capital: a domestic desk funds it in reais, at a lower all-in cost to her than the global pool could offer. This console allocates in USDC, so it is not raising here.",
          pt: "O motor de alocação roteou esta para o capital brasileiro: uma mesa doméstica financia em reais, a um custo total menor para ela do que o pool global conseguiria oferecer. Este console aloca em USDC, então ela não está captando aqui.",
        })}
      </p>
      {hasPosition && (
        <p className="text-sm text-foreground">
          {tr({ en: "You hold a position in it from before, and it is in your portfolio.", pt: "Você tem uma posição nela de antes, e ela está na sua carteira." })}
        </p>
      )}
    </Panel>
  );
}

function Field({ label, children, kind }: { label: string; children: React.ReactNode; kind: "derived" | "proven" | "private" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground"><DataTag kind={kind} /> {label}</span>
      <span className="num text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

/** What this pool asks, less expected loss. Its own component so the panel can
 *  sit first in the document and still be the aside at two columns. */
function ExpectedReturn({ row, pool, grade }: { row: MarketRow; pool: PoolId | null; grade: string }) {
  return (
    <>
<p className="num font-heading text-3xl font-bold text-foreground">
            {percent(row.indicative_yield_bps)} <span className="text-sm font-normal text-muted-foreground">{tr({ en: "a year", pt: "ao ano" })}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {pool === "global"
              ? tr({
                en: `What global investors ask for this pool, less expected loss for band ${grade}. Global investors also carry the currency effect the hedge assumes away.`,
                pt: `O que os investidores globais exigem neste pool, menos a perda esperada da faixa ${grade}. Os investidores globais também assumem o efeito cambial que o hedge deixa de fora.`,
              })
              : tr({
                en: `What domestic investors ask for this pool, less expected loss for band ${grade}.`,
                pt: `O que os investidores domésticos exigem neste pool, menos a perda esperada da faixa ${grade}.`,
              })}
            {row.my_micro_usdc > 0 && tr({
              en: <> You hold {usdc(row.my_micro_usdc)} ({money(reaisFromUsdc(row.my_micro_usdc, row.fx_brl_per_usdc_milli))}).</>,
              pt: <> Você tem {usdc(row.my_micro_usdc)} ({money(reaisFromUsdc(row.my_micro_usdc, row.fx_brl_per_usdc_milli))}).</>,
            })}
          </p>
    </>
  );
}

/** The proofs, and the model versions that produced them. */
function Evidence({ row, proofs }: { row: MarketRow; proofs: Proof[] }) {
  return (
      <Panel title={tr({ en: "Verifiable evidence", pt: "Evidências verificáveis" })}
        description={tr({
          en: "Each assessment's commitment is on Solana; the record behind it stays private.",
          pt: "O hash de cada avaliação está na Solana; o registro por trás dele fica privado.",
        })}
        actions={<VerifyOnSolana proofs={proofs.map((p) => ({ kind: p.kind, signature: p.signature ?? "", account: p.account, commitment: p.commitment }))} />}>
        <ul className="space-y-3">
          {proofs.map((p) => (
            <li key={p.kind} className="flex items-start justify-between gap-3 text-sm">
              <span>
                <span className="block text-foreground">{PROOF_LABEL[p.kind] ?? p.kind}</span>
                {p.signature && <ExplorerLink tx={p.signature} />}
              </span>
              <StatusPill tone={p.reconcile === "verified" ? "positive" : p.status === "confirmed" ? "positive" : "caution"}>
                {p.reconcile === "verified" ? tr({ en: "Verified", pt: "Verificada" })
                  : p.status === "confirmed" ? tr({ en: "On-chain", pt: "Na blockchain" })
                  : tr({ en: "Queued", pt: "Na fila" })}
              </StatusPill>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{tr({ en: "Model versions", pt: "Versões dos modelos" })}</span>
            <span className="text-right font-mono text-xs text-foreground">{row.readiness_model} · {row.eligibility_model}</span>
          </li>
        </ul>
      </Panel>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const market = useMarket();
  if (market.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label={tr({ en: "Loading", pt: "Carregando" })} />;
  if (market.isError) return <LoadError error={market.error} onRetry={() => market.refetch()} />;
  const row = market.data.find((o) => o.opportunity_id === id);
  if (!row) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-muted-foreground">{tr({ en: "This opportunity is not in the market.", pt: "Esta oportunidade não está no mercado." })}</p>
        <Link to="/app/investor/opportunities" className="text-sm text-info">{tr({ en: "Back to opportunities", pt: "Voltar para as oportunidades" })}</Link>
      </div>
    );
  }
  const risk = RISK[row.risk_band];
  const decision = DECISION_LABEL[row.eligibility_decision];
  const proofs = (row.proofs as unknown as Proof[]) ?? [];
  const exceptions = row.eligibility_reasons.filter((r) => !["AFFORDABLE"].includes(r));
  const consent = proofs.find((p) => p.kind === "consent");
  const pool = poolOf(row.funding_pool);
  // What this opportunity's money will do, before any of it has happened: the
  // same five steps a position reads, each already carrying the reality it
  // will have. Global pool only — it is where the two currencies meet.
  const stages: Record<LifecycleStage, StageState> = {
    funded: {
      done: row.funding_status === "funded",
      reality: "real",
      detail: tr({
        en: `${usdc(row.funded_micro_usdc, 0)} of ${usdc(row.funding_target_micro_usdc, 0)} from ${row.investors} ${row.investors === 1 ? "investor" : "investors"}`,
        pt: `${usdc(row.funded_micro_usdc, 0)} de ${usdc(row.funding_target_micro_usdc, 0)}, de ${row.investors} ${row.investors === 1 ? "investidor" : "investidores"}`,
      }),
    },
    locked: {
      done: false,
      reality: "simulated",
      detail: tr({
        en: "Struck when the desk settles: at allocation on the stablecoin route, at the payout on the direct one.",
        pt: "Fechado quando a mesa liquidar: na alocação pela rota da stablecoin, no pagamento pela direta.",
      }),
    },
    disbursed: {
      done: false,
      reality: "mock",
      detail: tr({ en: `${money(row.amount_cents)} to her account, in one Pix`, pt: `${money(row.amount_cents)} na conta da empreendedora, num único Pix` }),
    },
    repayments: {
      done: false,
      reality: "mock",
      detail: tr({ en: `${row.term_months} × ${money(row.instalment_cents)}, monthly`, pt: `${row.term_months} × ${money(row.instalment_cents)}, todo mês` }),
    },
    settlement: {
      done: false,
      reality: "real",
      detail: tr({ en: "Your share of each instalment, paid out in USDC", pt: "Sua parte de cada parcela, repassada em USDC" }),
    },
  };

  return (
    <div className="space-y-6">
      <Link to="/app/investor/opportunities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> {tr({ en: "Opportunities", pt: "Oportunidades" })}
      </Link>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6 xl:col-start-2 xl:row-start-1">
          {pool === "domestic" ? <FundedElsewhere hasPosition={row.my_micro_usdc > 0} /> : <InvestPanel row={row} />}
          <Panel title={tr({ en: "Expected return · simulated", pt: "Retorno esperado · simulado" })}>
            <ExpectedReturn row={row} pool={pool} grade={risk.grade} />
          </Panel>
          <Evidence row={row} proofs={proofs} />
        </div>

        <div className="space-y-6 xl:col-start-1 xl:row-start-1">
          <section className="panel space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title(row.purpose, row.business_sector)}</h1>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span className="font-mono">{row.code}</span> ·
                  <span className="inline-flex items-center gap-1"><MapPin size={13} /> {row.community_name} ({row.community_city}, {row.community_state})</span>
                  <BadgeCheck size={14} className="text-positive" aria-label={tr({ en: "verified community", pt: "comunidade verificada" })} />
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <PoolPill pool={pool} />
                <StatusPill tone={FUNDING_LABEL[row.funding_status].tone}>{FUNDING_LABEL[row.funding_status].label}</StatusPill>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">{tr({ en: "Requested", pt: "Pedido" })}</p>
                <p className="num font-heading text-xl font-bold text-primary">{money(row.amount_cents)}</p>
                <p className="num text-xs text-muted-foreground">
                  {pool === "global"
                    ? tr({
                      en: `${usdc(row.funding_target_micro_usdc, 0)} at ${reaisRate(row.fx_brl_per_usdc_milli ?? 0, 3)}/USDC, simulated quote`,
                      pt: `${usdc(row.funding_target_micro_usdc, 0)} a ${reaisRate(row.fx_brl_per_usdc_milli ?? 0, 3)}/USDC, cotação simulada`,
                    })
                    : tr({ en: "in reais, funded by Brazilian capital", pt: "em reais, financiada por capital brasileiro" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr({ en: "Term", pt: "Prazo" })}</p>
                <p className="num font-heading text-xl font-bold text-foreground">{tr({ en: `${row.term_months} months`, pt: `${row.term_months} meses` })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr({ en: "Risk band", pt: "Faixa de risco" })}</p>
                <p className={`font-heading text-xl font-bold text-${risk.tone}`}>{risk.grade}</p>
                <p className="text-xs text-muted-foreground">{tr({ en: `${LEVEL[row.confidence]} confidence`, pt: `confiança ${LEVEL[row.confidence]}` })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tr({ en: "Readiness", pt: "Prontidão" })}</p>
                <p className="num font-heading text-xl font-bold text-info">{row.readiness_score ?? "—"}<span className="text-sm">/100</span></p>
                <p className="text-xs text-muted-foreground">{tr({ en: "band", pt: "faixa" })} {row.readiness_band ? LEVEL[row.readiness_band] : ""}</p>
              </div>
            </div>

            <FundingBar funded={row.funded_micro_usdc} target={row.funding_target_micro_usdc} investors={row.investors}
              pool={pool} fxMilli={row.fx_brl_per_usdc_milli} amountCents={row.amount_cents} />

            <div className="space-y-2 border-t border-border pt-5">
              <h2 className="font-heading text-base font-bold text-foreground">{tr({ en: "Productive purpose", pt: "Finalidade produtiva" })}</h2>
              <p className="text-sm text-muted-foreground">{WHY[row.purpose]}</p>
              <p className="text-xs text-muted-foreground">
                <DataTag kind="private" />{" "}
                {tr({ en: "Her own description of the need stays with her and her community.", pt: "A descrição da necessidade, nas palavras dela, fica com ela e com a comunidade." })}
              </p>
            </div>

            <details className="space-y-2 border-t border-border pt-5 [&[open]>summary>svg]:rotate-90">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-heading text-base font-bold text-foreground hover:text-accent">
                <ChevronRight size={15} className="transition-transform text-accent" aria-hidden />
                {tr({ en: "How it was underwritten", pt: "Como a análise foi feita" })}
              </summary>
              <div className="pt-2">
                <Field label={tr({ en: "Data quality", pt: "Qualidade dos dados" })} kind="derived">
                  {row.records_kept_bps !== null
                    ? tr({ en: `${percent(row.records_kept_bps)} of months with records`, pt: `${percent(row.records_kept_bps)} dos meses com registros` })
                    : "—"}
                </Field>
                <Field label={tr({ en: "Affordability", pt: "Capacidade de pagamento" })} kind="derived">
                  {tr({ en: `${percent(row.affordability_bps)} of the monthly result`, pt: `${percent(row.affordability_bps)} do resultado mensal` })}
                </Field>
                <Field label={tr({ en: "Check-in regularity", pt: "Regularidade dos check-ins" })} kind="derived">
                  {tr({ en: `${row.months_reported ?? 0}/6 months reported`, pt: `${row.months_reported ?? 0}/6 meses informados` })}
                </Field>
                <Field label={tr({ en: "EmpowerFI assessment", pt: "Avaliação da EmpowerFI" })} kind="proven">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${decision.tone}`}>{decision.title}</span>
                </Field>
                <Field label={tr({ en: "Manual exceptions", pt: "Exceções manuais" })} kind="derived">
                  {exceptions.length === 0 ? tr({ en: "None", pt: "Nenhuma" }) : exceptions.length}
                </Field>
                <Field label={tr({ en: "Instalment, sized at eligibility", pt: "Parcela, calculada na elegibilidade" })} kind="derived">{row.term_months} × {money(row.instalment_cents)}</Field>
              </div>
              {exceptions.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {exceptions.map((r) => (
                    <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
                  ))}
                </ul>
              )}
            </details>
          </section>

          <FundingRoute row={row} />

          {pool === "global" && (
            <Lifecycle folded principalCents={row.amount_cents} instalmentCents={row.instalment_cents} termMonths={row.term_months}
              fxMilli={row.fx_brl_per_usdc_milli} stages={stages} />
          )}

          <PrivacyBoundaries folded>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-sm">
              <ShieldCheck size={16} className="text-positive" aria-hidden />
              <span className="text-foreground">{tr({ en: "Shown here because she allowed it.", pt: "Exibida aqui porque ela autorizou." })}</span>
              <span className="text-muted-foreground">
                {tr({
                  en: "If she withdraws that, it leaves the market and investors are refunded from the vault, unless the loan has been paid out.",
                  pt: "Se ela retirar a autorização, a oportunidade sai do mercado e os investidores são reembolsados pelo cofre, a menos que o empréstimo já tenha sido desembolsado.",
                })}
              </span>
              {consent?.signature && <ExplorerLink tx={consent.signature} label={tr({ en: "Her consent, on Solana", pt: "O consentimento dela, na Solana" })} />}
            </div>
          </PrivacyBoundaries>

          {/* Why this opportunity is here at all — which local routes could
              take it, which could not, and what residual is being offered here
              — is the engine's subject, and the engine opens on this request. It
              used to be 665 words of network plan at the foot of a page where
              someone is deciding whether to commit ten dollars. */}
          <p className="px-1 text-sm text-muted-foreground">
            <Link to={`/app/capital/engine?opportunity=${row.code}`} className="text-info hover:underline">
              {tr({ en: "Why this opportunity exists", pt: "Por que esta oportunidade existe" })}
            </Link>{" "}
            {tr({
              en: "— the engines that judged this request, which Brazilian routes could not take it, and what was left for capital from abroad.",
              pt: "— os motores que avaliaram este pedido, quais rotas brasileiras não puderam atendê-lo, e o que sobrou para o capital de fora.",
            })}
          </p>
        </div>

        <p className="px-1 text-xs text-muted-foreground">{prototypeNotice()}</p>

      </div>
    </div>
  );
}
