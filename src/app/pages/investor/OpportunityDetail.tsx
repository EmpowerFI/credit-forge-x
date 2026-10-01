import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronRight, EyeOff, FileCheck2, Loader2, Lock, MapPin, ShieldCheck, ShoppingCart, TrendingUp, UserCheck } from "lucide-react";
import { localized, tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import PrivacyBoundaries from "../../components/product/PrivacyBoundaries";
import StatusPill from "../../components/product/StatusPill";
import VerifyOnSolana from "../../components/product/VerifyOnSolana";
import { RailTick } from "../../components/product/MoneyRail";
import { railStep, type RailState, useRailReveal } from "../../lib/moneyRail";
import { type PoolId, poolOf, prototypeNotice } from "../../lib/capital";
import { DECISION_LABEL, ELIGIBILITY_REASON, percent } from "../../lib/credit";
import { FUNDING_LABEL, type MarketRow, PROOF_LABEL, type Proof, RISK } from "../../lib/investor";
import { type CreditPurpose, money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
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

function Field({ label, children, kind, state = "settled" }: {
  label: string; children: React.ReactNode; kind: "derived" | "proven" | "private"; state?: RailState;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0 ${railStep(state)}`}>
      <span className="flex items-center gap-2 text-muted-foreground"><RailTick state={state} /><DataTag kind={kind} /> {label}</span>
      <span className="num text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

/** One figure of the band that decides: label, number, and a hint or a hairline. */
function Cell({ label, value, hint, bar, first }: {
  label: string; value: React.ReactNode; hint?: string; bar?: number | null; first?: boolean;
}) {
  return (
    <div className={`space-y-1 py-3 ${first ? "lg:pr-4" : "lg:px-4"}`}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="num font-heading text-2xl font-bold leading-none text-foreground">{value}</dd>
      {hint && <p className="num text-xs text-muted-foreground">{hint}</p>}
      {bar !== undefined && bar !== null && (
        <div className="h-0.5 bg-border" role="presentation">
          <div className="h-0.5 bg-accent transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(100, bar)}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * One answer, scannable. The page used to make a reader open a fold to learn
 * why the opportunity had passed at all, which is the wrong order: the question
 * "should I care" comes before "show me the workings".
 */
function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="panel flex min-w-0 gap-3 p-4">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>{icon}</span>
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}

/**
 * The four things that decide whether to read further. Readiness sits here with
 * the risk band rather than beside it in the figures above, where adjacency
 * implied they were the same measurement: one is what EmpowerFI thinks of the
 * loan, the other is how well the business keeps its own records.
 */
function Why({ row }: { row: MarketRow }) {
  const risk = RISK[row.risk_band];
  return (
    <section className="space-y-3 pt-6">
      <h2 className="font-heading text-xl font-bold text-foreground">{tr({ en: "Why this opportunity", pt: "Por que esta oportunidade" })}</h2>
      <p className="text-sm text-muted-foreground">{tr({ en: "Key facts from the underwriting, in simple terms.", pt: "Os fatos da análise, em termos simples." })}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        <Card icon={<ShoppingCart size={18} />} title={tr({ en: "Productive purpose", pt: "Finalidade produtiva" })}>
          {WHY[row.purpose]}
        </Card>
        <Card icon={<TrendingUp size={18} />} title={tr({ en: "Affordable repayment", pt: "Parcela que cabe" })}>
          {tr({
            en: `Eligible for a smaller amount — her instalment is ${percent(row.affordability_bps)} of the monthly result.`,
            pt: `Elegível a um valor menor — a parcela dela é ${percent(row.affordability_bps)} do resultado mensal.`,
          })}
        </Card>
        <Card icon={<ShieldCheck size={18} />} title={tr({ en: "Assessment", pt: "Avaliação" })}>
          <span className="block">
            {tr({ en: "Risk band", pt: "Faixa de risco" })} <span className="num font-medium text-foreground">{risk.grade}</span>
            {" · "}
            {tr({ en: "EmpowerFI's view of the loan", pt: "a visão da EmpowerFI sobre o empréstimo" })}
          </span>
          <span className="block">
            {tr({ en: "Business readiness", pt: "Prontidão do negócio" })}{" "}
            <span className="num font-medium text-foreground">{row.readiness_score ?? "\u2014"}/100</span>
            {" · "}
            {tr({ en: "how well she keeps her own records", pt: "o quanto ela mantém os próprios registros" })}
          </span>
        </Card>
        <Card icon={<Lock size={18} />} title={tr({ en: "Privacy-preserving", pt: "Preserva a privacidade" })}>
          {tr({
            en: "Each assessment's commitment is on Solana; investors get the decision and its proof — never her identity, bank data or financial history.",
            pt: "O hash de cada avaliação está na Solana; os investidores recebem a decisão e a prova dela — nunca a identidade, os dados bancários ou o histórico financeiro.",
          })}
        </Card>
      </ul>
    </section>
  );
}

/**
 * How the request was judged, in three sentences and then in full. The three
 * cards are the structure of the credit — what it is, where the money comes
 * from, which currency she actually owes — and the engine's own checks sit
 * under them as the workings.
 *
 * The fold is gone: a reader deciding whether to commit should not have to
 * open anything to find out why the request passed. The staged reveal survives
 * it — the rail arms on scroll instead of on a click, so the checks still fill
 * in the order they were asked rather than arriving as a finished table.
 */
function Underwriting({ row }: { row: MarketRow }) {
  const decision = DECISION_LABEL[row.eligibility_decision];
  const exceptions = row.eligibility_reasons.filter((r) => !["AFFORDABLE"].includes(r));
  const checks: { label: string; kind: "derived" | "proven"; value: React.ReactNode }[] = [
    { label: tr({ en: "Data quality", pt: "Qualidade dos dados" }), kind: "derived",
      value: row.records_kept_bps !== null
        ? tr({ en: `${percent(row.records_kept_bps)} of months with records`, pt: `${percent(row.records_kept_bps)} dos meses com registros` })
        : "\u2014" },
    { label: tr({ en: "Affordability", pt: "Capacidade de pagamento" }), kind: "derived",
      value: tr({ en: `${percent(row.affordability_bps)} of the monthly result`, pt: `${percent(row.affordability_bps)} do resultado mensal` }) },
    { label: tr({ en: "Check-in regularity", pt: "Regularidade dos check-ins" }), kind: "derived",
      value: tr({ en: `${row.months_reported ?? 0}/6 months reported`, pt: `${row.months_reported ?? 0}/6 meses informados` }) },
    { label: tr({ en: "Instalment, sized at eligibility", pt: "Parcela, calculada na elegibilidade" }), kind: "derived",
      value: <>{row.term_months} × {money(row.instalment_cents)}</> },
    { label: tr({ en: "Manual exceptions", pt: "Exceções manuais" }), kind: "derived",
      value: exceptions.length === 0 ? tr({ en: "None", pt: "Nenhuma" }) : exceptions.length },
    { label: tr({ en: "EmpowerFI assessment", pt: "Avaliação da EmpowerFI" }), kind: "proven",
      value: <span className={`rounded-full border px-2 py-0.5 text-xs ${decision.tone}`}>{decision.title}</span> },
  ];
  const rail = useRailReveal<HTMLDivElement>(checks.length, { stepMs: 380 });
  const structure = [
    { no: 1, title: tr({ en: "Eligibility", pt: "Elegibilidade" }),
      body: tr({
        en: `Eligible for a smaller amount — her instalment is ${percent(row.affordability_bps)} of the monthly result.`,
        pt: `Elegível a um valor menor — a parcela dela é ${percent(row.affordability_bps)} do resultado mensal.`,
      }) },
    { no: 2, title: tr({ en: "Funding route", pt: "Rota de financiamento" }),
      body: tr({
        en: "Which pool could take it, and what it costs her all in — the comparison is below.",
        pt: "Qual pool pôde atendê-la, e quanto custa para ela no total — a comparação está abaixo.",
      }) },
    { no: 3, title: tr({ en: "Written in reais, funded in dollars", pt: "Escrita em reais, financiada em dólares" }),
      body: tr({
        en: "She owes reais, fixed in her currency — the dollar figures are never what she repays.",
        pt: "Ela deve reais, fixos na moeda dela — os valores em dólar nunca são o que ela paga.",
      }) },
  ];

  return (
    <Panel title={tr({ en: "How it was underwritten", pt: "Como a análise foi feita" })}
      description={tr({
        en: `${decision.title} — a smaller amount, with an affordable instalment and a clear productive use.`,
        pt: `${decision.title} — um valor menor, com parcela que cabe e um uso produtivo claro.`,
      })}>
      <ol className="mb-5 grid gap-3 sm:grid-cols-3">
        {structure.map((c) => (
          <li key={c.no} className="panel min-w-0 space-y-1 p-4">
            <span className="num flex size-6 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">{c.no}</span>
            <span className="block pt-1 text-sm font-medium text-foreground">{c.title}</span>
            <span className="block text-sm leading-snug text-muted-foreground">{c.body}</span>
          </li>
        ))}
      </ol>
      <div ref={rail.ref}>
        {checks.map((c, i) => (
          <Field key={c.label} label={c.label} kind={c.kind} state={rail.state(i)}>{c.value}</Field>
        ))}
      </div>
      {exceptions.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {exceptions.map((r) => (
            <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The proofs, and the model versions that produced them. Folded, but with no
 * run: these rows were written when the work was done, and a sequence filling
 * in over them would claim they were being worked out while the reader watched.
 */
function Evidence({ row, proofs }: { row: MarketRow; proofs: Proof[] }) {
  return (
      <Panel title={tr({ en: "Verifiable evidence", pt: "Evidências verificáveis" })}
        description={tr({
          en: "Each assessment's commitment is on Solana; the record behind it stays private.",
          pt: "O hash de cada avaliação está na Solana; o registro por trás dele fica privado.",
        })}
        actions={<VerifyOnSolana proofs={proofs.map((p) => ({ kind: p.kind, signature: p.signature ?? "", account: p.account, commitment: p.commitment }))} />}>
        <ul className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card icon={<FileCheck2 size={18} />} title={tr({ en: "Onchain commitment", pt: "Compromisso na blockchain" })}>
            {tr({ en: "Each assessment is recorded on Solana.", pt: "Cada avaliação fica registrada na Solana." })}
          </Card>
          <Card icon={<EyeOff size={18} />} title={tr({ en: "Private records", pt: "Registros privados" })}>
            {tr({ en: "The underlying financial record stays private.", pt: "O registro financeiro por trás dela fica privado." })}
          </Card>
          <Card icon={<UserCheck size={18} />} title={tr({ en: "Her consent", pt: "O consentimento dela" })}>
            {tr({
              en: "Shown because she allowed it. Withdraw that and it leaves the market, investors refunded from the vault.",
              pt: "Exibida porque ela autorizou. Se ela retirar, sai do mercado e os investidores são reembolsados pelo cofre.",
            })}
          </Card>
        </ul>
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
  const proofs = (row.proofs as unknown as Proof[]) ?? [];
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
        {/* Only the decision. It follows the reader down the argument rather
            than scrolling away from it, and the two panels that used to sit
            under it are now a figure in the header and a movement of the page. */}
        <div className="xl:col-start-2 xl:row-start-1 xl:sticky xl:top-6 xl:self-start">
          {pool === "domestic" ? <FundedElsewhere hasPosition={row.my_micro_usdc > 0} /> : <InvestPanel row={row} />}
        </div>

        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <header className="space-y-4 border-b border-border pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="num text-xs font-medium uppercase tracking-widest text-accent">
                  {row.business_sector ? `${sectorLabel(row.business_sector)} · ` : ""}{row.code}
                </p>
                <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">{PURPOSE_LABEL[row.purpose as CreditPurpose]}</h1>
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                  <MapPin size={13} aria-hidden />
                  {tr({
                    en: `A woman-led business in ${row.community_city}, ${row.community_state}`,
                    pt: `Um negócio liderado por mulher em ${row.community_city}, ${row.community_state}`,
                  })}
                  <BadgeCheck size={14} className="text-positive" aria-label={tr({ en: "verified community", pt: "comunidade verificada" })} />
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <PoolPill pool={pool} />
                <StatusPill tone={FUNDING_LABEL[row.funding_status].tone}>{FUNDING_LABEL[row.funding_status].label}</StatusPill>
              </span>
            </div>

            {/* The five figures that decide, in one band. Expected return was a
                panel of its own in the aside, where it sat below the fold. */}
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] divide-x divide-border">
              <Cell label={tr({ en: "Requested", pt: "Pedido" })} value={money(row.amount_cents)} first
                hint={pool === "global"
                  ? tr({
                    en: `≈ ${usdc(row.funding_target_micro_usdc, 0)} at ${reaisRate(row.fx_brl_per_usdc_milli ?? 0, 3)}/USDC, simulated`,
                    pt: `≈ ${usdc(row.funding_target_micro_usdc, 0)} a ${reaisRate(row.fx_brl_per_usdc_milli ?? 0, 3)}/USDC, simulada`,
                  })
                  : tr({ en: "in reais, from Brazilian capital", pt: "em reais, de capital brasileiro" })} />
              <Cell label={tr({ en: "Expected return", pt: "Retorno esperado" })}
                value={<span className="text-accent">{percent(row.indicative_yield_bps)} <span className="text-base font-medium">{tr({ en: "a year", pt: "ao ano" })}</span></span>}
                hint={tr({ en: "Simulated, net of expected loss", pt: "Simulado, após perda esperada" })} />
              <Cell label={tr({ en: "Term", pt: "Prazo" })}
                value={<>{row.term_months} <span className="text-base font-medium">{tr({ en: "months", pt: "meses" })}</span></>}
                hint={tr({ en: "Monthly instalments in reais", pt: "Parcelas mensais em reais" })} />
              <Cell label={tr({ en: "Risk band", pt: "Faixa de risco" })} value={risk.grade}
                hint={tr({ en: `${LEVEL[row.confidence]} confidence`, pt: `Confiança ${LEVEL[row.confidence]}` })} />
            </dl>

            <FundingBar funded={row.funded_micro_usdc} target={row.funding_target_micro_usdc} investors={row.investors}
              pool={pool} fxMilli={row.fx_brl_per_usdc_milli} amountCents={row.amount_cents} />
          </header>

          <Why row={row} />

          <Underwriting row={row} />

          <FundingRoute row={row} folded />

          {pool === "global" && (
            <Lifecycle folded principalCents={row.amount_cents} instalmentCents={row.instalment_cents} termMonths={row.term_months}
              fxMilli={row.fx_brl_per_usdc_milli} stages={stages} />
          )}

          <Evidence row={row} proofs={proofs} />

          <PrivacyBoundaries>
            {consent?.signature && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-sm">
                <ShieldCheck size={16} className="text-positive" aria-hidden />
                <ExplorerLink tx={consent.signature} label={tr({ en: "Her consent, on Solana", pt: "O consentimento dela, na Solana" })} />
              </div>
            )}
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
              en: "— the engines that judged it, and what Brazilian capital could not take.",
              pt: "— os motores que a avaliaram, e o que o capital brasileiro não pôde atender.",
            })}
          </p>
        </div>

        <p className="px-1 text-xs text-muted-foreground">{prototypeNotice()}</p>

      </div>
    </div>
  );
}
