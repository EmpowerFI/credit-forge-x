import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { tr } from "../../i18n";
import { shortDate } from "../../lib/community";
import { level, STAGE, outstandingCents, stageOf, type DeskStage } from "../../lib/partner";
import { money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
import { useDesk } from "./context";
import { FundingSummary, LoanActions, OpportunityActions, StagePill } from "./parts";

const ORDER: DeskStage[] = ["to_formalise", "formalised", "overdue", "disbursed", "raising", "waiting", "repaying", "defaulted", "paid", "cancelled", "declined", "withdrawn"];

/**
 * Every qualified opportunity on EmpowerFI's P2P desk, where it stands, and
 * what the desk does next: formalise once investors have funded it, start
 * repayment, follow up an overdue instalment.
 */
export default function Pipeline() {
  const { desk, decides } = useDesk();
  const loanOf = new Map(desk.loans.map((l) => [l.opportunity_id, l]));
  const rows = desk.opportunities
    .map((o) => ({ o, loan: loanOf.get(o.opportunity_id), stage: stageOf(o, loanOf.get(o.opportunity_id)) }))
    .sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || b.o.referred_at.localeCompare(a.o.referred_at));
  const count = (s: DeskStage) => rows.filter((r) => r.stage === s).length;
  const raising = rows.filter((r) => r.stage === "raising");
  const live = desk.loans.filter((l) => l.status === "ACTIVE" || l.status === "DISBURSED");
  const actions = rows.filter((r) => ["to_formalise", "formalised", "disbursed", "overdue"].includes(r.stage));
  const outstanding = money(live.reduce((n, l) => n + outstandingCents(l), 0));
  const overdueInstalments = desk.loans.reduce((n, l) => n + l.overdue, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={tr({ en: "Investors funding", pt: "Em captação" })} value={raising.length}
          hint={money(raising.reduce((n, r) => n + r.o.amount_cents, 0))} hintTone="info" />
        <StatTile label={tr({ en: "Waiting for capital", pt: "Aguardando capital" })} value={count("waiting")}
          hint={tr({ en: "no pool can take it yet", pt: "nenhum pool pode assumir ainda" })} />
        <StatTile label={tr({ en: "Ready to formalise", pt: "Prontas para formalizar" })} value={count("to_formalise")}
          hint={tr({ en: "funded", pt: "100% captadas" })} hintTone={count("to_formalise") ? "positive" : "neutral"} />
        <StatTile label={tr({ en: "Repaying", pt: "Em pagamento" })} value={count("repaying") + count("overdue") + count("disbursed")}
          hint={tr({ en: `${outstanding} outstanding`, pt: `${outstanding} em aberto` })} />
        <StatTile label={tr({ en: "Overdue", pt: "Em atraso" })} value={count("overdue")}
          hint={tr({ en: `${overdueInstalments} instalments`, pt: `${overdueInstalments} parcelas` })}
          hintTone={count("overdue") ? "alert" : "neutral"} />
        <StatTile label={tr({ en: "Received", pt: "Recebido" })} value={money(desk.loans.reduce((n, l) => n + l.received_cents, 0))}
          hint={tr({ en: "instalments", pt: "parcelas" })} hintTone="positive" />
      </div>

      <Panel title={tr({ en: "Your next actions", pt: "Suas próximas ações" })}
        description={decides
          ? tr({ en: "What waits on you, most urgent first.", pt: "O que espera por você, o mais urgente primeiro." })
          : tr({ en: "What waits on the desk, most urgent first.", pt: "O que espera pela mesa, o mais urgente primeiro." })}>
        {actions.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Nothing waits on you right now.", pt: "Nada espera por você agora." })}</p> : (
          <ul className="divide-y divide-border">
            {actions.map(({ o, loan, stage }) => (
              <li key={o.opportunity_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono text-foreground">{o.participant}</span>
                    <StagePill stage={stage} />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {money(loan?.principal_cents ?? o.amount_cents)} · {PURPOSE_LABEL[o.purpose].toLowerCase()} · {sectorLabel(o.business_sector) ?? "—"}
                    {stage === "overdue" && loan && tr({
                      en: ` · ${loan.overdue} overdue since ${shortDate(loan.next_due_at)}`,
                      pt: ` · ${loan.overdue} em atraso desde ${shortDate(loan.next_due_at)}`,
                    })}
                  </p>
                </div>
                {stage === "to_formalise" ? (
                  decides ? <OpportunityActions o={o} decides={decides} /> : <span className="text-xs text-muted-foreground">{STAGE[stage].next}</span>
                ) : stage === "overdue" && loan ? (
                  <Link to={`loans/${loan.id}`} className="inline-flex items-center gap-1 text-sm text-info hover:underline">
                    {tr({ en: "Open the schedule", pt: "Abrir o cronograma" })} <ArrowRight size={14} />
                  </Link>
                ) : loan && (decides ? <LoanActions loan={loan} decides={decides} /> : <span className="text-xs text-muted-foreground">{STAGE[stage].next}</span>)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={tr({ en: "Every opportunity", pt: "Todas as oportunidades" })}
        description={tr({
          en: "Qualified by EmpowerFI's eligibility rules, given a pool by the Capital Allocation Engine, and funded by investors when she allowed it to be shown to them.",
          pt: "Qualificadas pelas regras de elegibilidade da EmpowerFI, com o pool definido pelo Motor de Alocação de Capital, e captadas com investidores quando ela permitiu que fossem exibidas a eles.",
        })}>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "No qualified opportunity yet.", pt: "Nenhuma oportunidade qualificada ainda." })}</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Participant", pt: "Participante" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Request", pt: "Pedido" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Amount", pt: "Valor" })}</th>
                  <th className="w-56 py-2 pr-4 font-medium">{tr({ en: "Funding", pt: "Captação" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Stage", pt: "Etapa" })}</th>
                  <th className="py-2 font-medium">{tr({ en: "Qualified", pt: "Qualificada em" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ o, loan, stage }) => (
                  <tr key={o.opportunity_id} className="align-top">
                    <td className="py-3 pr-4">
                      {loan ? (
                        <Link to={`loans/${loan.id}`} className="font-mono text-foreground hover:underline">{o.participant}</Link>
                      ) : <span className="font-mono text-foreground">{o.participant}</span>}
                      <span className="block text-xs text-muted-foreground">{o.community_name ?? "—"}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-foreground">{PURPOSE_LABEL[o.purpose]}</span>
                      <span className="block text-xs text-muted-foreground">{sectorLabel(o.business_sector) ?? "—"} · {tr({ en: "risk", pt: "risco" })} {level(o.risk_band)}</span>
                    </td>
                    <td className="num py-3 pr-4 text-right text-foreground">
                      {money(loan?.principal_cents ?? o.amount_cents)}
                      <span className="block text-xs text-muted-foreground">{tr({ en: `${loan?.term_months ?? o.term_months} months`, pt: `${loan?.term_months ?? o.term_months} meses` })}</span>
                    </td>
                    <td className="py-3 pr-4"><FundingSummary funding={o.funding} compact amountCents={o.amount_cents} /></td>
                    <td className="py-3 pr-4"><StagePill stage={stage} /></td>
                    <td className="py-3 text-xs text-muted-foreground">{shortDate(o.referred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
