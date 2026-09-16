import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import { REQUIREMENT_SHORT, STAGE_LABEL, STAGES } from "../../lib/community";
import { money, monthLabel, PURPOSE_LABEL } from "../../lib/readiness";
import type { CreditPurpose } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useCohorts } from "./queries";
import { localized, tr } from "../../i18n";
import EvcLabel from "../../components/product/EvcLabel";

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

const BUCKETS = localized([
  { key: "le_30", label: { en: "≤ 30 days", pt: "≤ 30 dias" }, cls: "bg-positive" },
  { key: "d31_60", label: "31–60", cls: "bg-positive/60" },
  { key: "d61_90", label: "61–90", cls: "bg-info/60" },
  { key: "gt_90", label: "> 90", cls: "bg-caution/70" },
  { key: "not_yet", label: { en: "Not yet", pt: "Ainda não" }, cls: "bg-secondary" },
] as const);

/** Intake-month cohorts: conversion, time to readiness, what holds people back, capital need, and what came of it. */
export default function Cohorts() {
  const { community } = useCommunity();
  const cohorts = useCohorts(community.id);

  if (cohorts.isError) return <LoadError error={cohorts.error} onRetry={() => cohorts.refetch()} />;
  if (!cohorts.data) return <div className="space-y-6"><Skeleton className="h-56 w-full" /><Skeleton className="h-56 w-full" /></div>;
  const list = cohorts.data;
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{tr({ en: "No participants yet, so no cohorts.", pt: "Ainda não há participantes, então não há turmas." })}</p>;

  // What holds people back, across cohorts.
  const reasons = new Map<string, number>();
  for (const c of list) for (const [code, n] of Object.entries(c.not_ready_reasons)) reasons.set(code, (reasons.get(code) ?? 0) + n);
  const reasonList = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const topReason = Math.max(1, ...reasonList.map(([, n]) => n));

  const purposes = new Map<CreditPurpose, { n: number; cents: number }>();
  for (const c of list) {
    for (const [p, v] of Object.entries(c.need_by_purpose) as [CreditPurpose, { n: number; cents: number }][]) {
      const cur = purposes.get(p) ?? { n: 0, cents: 0 };
      purposes.set(p, { n: cur.n + v.n, cents: cur.cents + v.cents });
    }
  }
  const purposeList = [...purposes.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const topPurpose = Math.max(1, ...purposeList.map(([, v]) => v.cents));

  return (
    <div className="space-y-6">
      <Panel title={tr({ en: "Conversion by cohort", pt: "Conversão por turma" })}
        description={tr({
          en: "Each intake month, and how far its participants have come. Percentages are of those who joined.",
          pt: "Cada mês de entrada, e até onde suas participantes chegaram. Os percentuais são sobre quem entrou.",
        })}>
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Intake", pt: "Entrada" })}</th>
                {STAGES.map((s) => <th key={s} className="py-2 pr-3 text-right font-medium">{STAGE_LABEL[s]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((c) => (
                <tr key={c.intake}>
                  <td className="py-2.5 pr-4 font-medium text-foreground">{monthLabel(c.intake)}</td>
                  {STAGES.map((s) => (
                    <td key={s} className="num py-2.5 pr-3 text-right">
                      <span className="text-foreground">{c.funnel[s]}</span>
                      {s !== "joined" && <span className="ml-1 text-xs text-muted-foreground">{pct(c.funnel[s], c.funnel.joined)}%</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Time to readiness", pt: "Tempo até a prontidão" })}
          description={tr({
            en: "Days from joining to the first CREDIT_READY, per cohort. Recent cohorts have had less time.",
            pt: "Dias entre a entrada e o primeiro CREDIT_READY, por turma. As turmas recentes tiveram menos tempo.",
          })}>
          <div className="space-y-3">
            {list.map((c) => {
              const d = c.days_to_ready;
              return (
                <div key={c.intake} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{monthLabel(c.intake)}</span>
                    <span className="text-muted-foreground">{d.median !== null
                      ? tr({ en: `median ${Math.round(d.median)} days`, pt: `mediana de ${Math.round(d.median)} dias` })
                      : tr({ en: "none ready yet", pt: "nenhuma pronta ainda" })}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-secondary/50" role="img"
                    aria-label={BUCKETS.map((b) => `${b.label}: ${d[b.key]}`).join(", ")}>
                    {BUCKETS.map((b) => d[b.key] > 0 && (
                      <div key={b.key} className={b.cls} style={{ width: `${pct(d[b.key], c.participants)}%` }} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
              {BUCKETS.map((b) => <span key={b.key} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${b.cls}`} />{b.label}</span>)}
            </div>
          </div>
        </Panel>

        <Panel title={tr({ en: "What holds people back", pt: "O que ainda falta" })}
          description={tr({ en: "Missing requirements of those not yet ready, across cohorts.", pt: "Requisitos que faltam para quem ainda não está pronta, em todas as turmas." })}>
          {reasonList.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Nothing missing: everyone assessed is ready or in review.", pt: "Nada falta: todas as avaliadas estão prontas ou em revisão." })}</p> : (
            <ul className="space-y-2">
              {reasonList.map(([code, n]) => (
                <li key={code} className="grid grid-cols-[1fr_2.5rem] items-center gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-foreground">{REQUIREMENT_SHORT[code] ?? code}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-caution" style={{ width: `${(n / topReason) * 100}%` }} />
                    </div>
                  </div>
                  <span className="num text-right text-foreground">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {tr({
              en: `In manual review: ${list.reduce((n, c) => n + c.manual_review, 0)}. Someone looks before the rules decide.`,
              pt: `Em revisão manual: ${list.reduce((n, c) => n + c.manual_review, 0)}. Uma pessoa analisa antes de as regras decidirem.`,
            })}
          </p>
        </Panel>
      </div>

      <Panel title={tr({ en: "Qualified P2P demand by cohort", pt: "Demanda qualificada P2P por turma" })}
        description={tr({
          en: "What each cohort's P2P opportunities ask, how much investors have funded, the gap, and how much came from each pool. Totals only: no investor, wallet or position.",
          pt: "Quanto pedem as oportunidades P2P de cada turma, quanto os investidores já captaram, a lacuna e quanto veio de cada pool. Só totais: nenhum investidor, carteira ou posição.",
        })}>
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">{tr({ en: "Intake", pt: "Entrada" })}</th>
                <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Eligible amount", pt: "Valor elegível" })}</th>
                <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Funded", pt: "Captado" })}</th>
                <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Funding gap", pt: "Lacuna de captação" })}</th>
                <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Domestic coverage", pt: "Cobertura doméstica" })}</th>
                <th className="py-2 text-right font-medium">{tr({ en: "Global coverage", pt: "Cobertura global" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((c) => (
                <tr key={c.intake}>
                  <td className="py-2 pr-3 text-foreground">{monthLabel(c.intake)}</td>
                  <td className="num py-2 pr-3 text-right text-foreground">{money(c.capital.eligible_cents)}</td>
                  <td className="num py-2 pr-3 text-right text-positive">{money(c.capital.funded_cents)}</td>
                  <td className={`num py-2 pr-3 text-right ${c.capital.gap_cents ? "text-caution" : "text-muted-foreground"}`}>{money(c.capital.gap_cents)}</td>
                  <td className="num py-2 pr-3 text-right">{c.capital.eligible_cents ? `${Math.round(c.capital.domestic_coverage_bps / 100)}%` : "—"}</td>
                  <td className="num py-2 text-right">{c.capital.eligible_cents ? `${Math.round(c.capital.global_coverage_bps / 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Credit need by productive purpose", pt: "Necessidade de crédito por finalidade produtiva" })}
          description={tr({ en: "Active requests from participants who asked, by what the capital is for.", pt: "Pedidos ativos das participantes que pediram crédito, pela finalidade do capital." })}>
          {purposeList.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "No credit requests yet.", pt: "Nenhum pedido de crédito ainda." })}</p> : (
            <ul className="space-y-2">
              {purposeList.map(([p, v]) => (
                <li key={p} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-foreground">{PURPOSE_LABEL[p]} <span className="text-xs text-muted-foreground">· {v.n}</span></span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${(v.cents / topPurpose) * 100}%` }} />
                    </div>
                  </div>
                  <span className="num text-right text-foreground">{money(v.cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={tr({ en: "Operations and outcomes", pt: "Operações e resultados" })}
          description={tr({ en: "How far the cohort's P2P opportunities got, and what the capital did after.", pt: "Até onde chegaram as oportunidades P2P da turma, e o que o capital fez depois." })}>
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">{tr({ en: "Intake", pt: "Entrada" })}</th>
                  <th className="py-2 pr-3 text-right font-medium">{tr({ en: "P2P opportunities", pt: "Oportunidades P2P" })}</th>
                  <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Funded", pt: "Captadas" })}</th>
                  <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Disbursed", pt: "Desembolsadas" })}</th>
                  <th className="py-2 pr-3 text-right font-medium">{tr({ en: "Sales up", pt: "Vendas em alta" })}</th>
                  <th className="py-2 text-right font-medium"><EvcLabel /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((c) => (
                  <tr key={c.intake}>
                    <td className="py-2 pr-3 text-foreground">{monthLabel(c.intake)}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.p2p_opportunities}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.funded}</td>
                    <td className="num py-2 pr-3 text-right">{c.operations.disbursed}</td>
                    <td className="num py-2 pr-3 text-right">{c.outcomes.measured ? `${c.outcomes.revenue_up}/${c.outcomes.measured}` : "—"}</td>
                    <td className={`num py-2 text-right ${c.outcomes.evc_cents < 0 ? "text-alert" : "text-foreground"}`}>
                      {c.outcomes.measured ? money(c.outcomes.evc_cents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "EVC: economic value created, the incremental profit after the cost of credit, as measured. Simulated in this demo.",
              pt: "EVC: valor econômico criado, o lucro adicional depois do custo do crédito, conforme medido. Simulado nesta demo.",
            })}
          </p>
        </Panel>
      </div>
    </div>
  );
}
