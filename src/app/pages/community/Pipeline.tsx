import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import type { Tone } from "../../components/product/StatusPill";
import { DECISION_LABEL, LOAN_LABEL, OPPORTUNITY_LABEL, type LoanStatus } from "../../lib/credit";
import { money, PURPOSE_LABEL, sectorLabel } from "../../lib/readiness";
import { useCommunity } from "./context";
import { useParticipants } from "./queries";
import { tr } from "../../i18n";

const LOAN_TONE: Record<LoanStatus, Tone> = {
  DRAFT: "neutral", PARTNER_APPROVED: "info", DISBURSED: "info", ACTIVE: "positive", PAID: "positive", DEFAULTED: "alert", CANCELLED: "neutral",
};
const FINANCED: LoanStatus[] = ["DISBURSED", "ACTIVE", "PAID", "DEFAULTED"];

/** Everyone who asked for capital, and where the request stands: eligible, a P2P opportunity, funded. The community sees status and totals, never investors. */
export default function Pipeline() {
  const { community } = useCommunity();
  const participants = useParticipants(community.id);

  if (participants.isError) return <LoadError error={participants.error} onRetry={() => participants.refetch()} />;
  if (!participants.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  const rows = participants.data.filter((p) => p.intent_purpose || p.loan_status)
    .sort((a, b) => b.stage_no - a.stage_no || a.display_name.localeCompare(b.display_name));
  const asking = participants.data.filter((p) => p.intent_purpose);
  const eligible = asking.filter((p) => p.eligibility_decision === "ELIGIBLE" || p.eligibility_decision === "ELIGIBLE_REDUCED");
  const listed = participants.data.filter((p) => p.stage_no >= 6);
  const funded = participants.data.filter((p) => p.stage_no >= 7);
  const financed = participants.data.filter((p) => p.loan_status && FINANCED.includes(p.loan_status));
  const late = participants.data.filter((p) => p.late);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={tr({ en: "Asking for credit", pt: "Pedindo crédito" })} value={asking.length} hint={money(asking.reduce((n, p) => n + (p.intent_cents ?? 0), 0))} />
        <StatTile label={tr({ en: "Eligible", pt: "Elegíveis" })} value={eligible.length} hint={tr({ en: "by EmpowerFI's rules", pt: "pelas regras da EmpowerFI" })} />
        <StatTile label={tr({ en: "P2P opportunities", pt: "Oportunidades P2P" })} value={listed.length} hint={money(listed.reduce((n, p) => n + (p.opportunity_cents ?? 0), 0))} />
        <StatTile label={tr({ en: "Funded", pt: "Captadas" })} value={funded.length} hint={money(funded.reduce((n, p) => n + (p.funded_cents ?? 0), 0))} hintTone="positive" />
        <StatTile label={tr({ en: "Disbursed", pt: "Desembolsados" })} value={financed.length} hint={tr({ en: "by Pix", pt: "via Pix" })} hintTone="positive" />
        <StatTile label={tr({ en: "Late", pt: "Em atraso" })} value={late.length} hint={tr({ en: "instalments overdue", pt: "parcelas em atraso" })} hintTone={late.length ? "alert" : "neutral"} />
      </div>

      <Panel title={tr({ en: "P2P pipeline", pt: "Pipeline P2P" })}
        description={tr({
          en: "Requests move from the community to EmpowerFI's eligibility rules, become P2P opportunities with a pool of capital, and are funded by investors — domestic or global. She receives and repays in reais, by Pix.",
          pt: "Os pedidos saem da comunidade para as regras de elegibilidade da EmpowerFI, viram oportunidades P2P com um pool de capital e são financiados por investidores, domésticos ou globais. Ela recebe e paga em reais, via Pix.",
        })}>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Nobody has asked for credit yet.", pt: "Ninguém pediu crédito ainda." })}</p> : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Participant", pt: "Participante" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Purpose", pt: "Finalidade" })}</th>
                  <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Requested", pt: "Pedido" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Eligibility", pt: "Elegibilidade" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "P2P funding", pt: "Captação P2P" })}</th>
                  <th className="py-2 font-medium">{tr({ en: "Loan", pt: "Empréstimo" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.entrepreneur_id}>
                    <td className="py-3 pr-4">
                      <Link to={`../participants/${p.entrepreneur_id}`} relative="path" className="font-medium text-foreground hover:underline">{p.display_name}</Link>
                      {p.business_sector && <span className="block text-xs text-muted-foreground">{sectorLabel(p.business_sector)}</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.intent_purpose ? PURPOSE_LABEL[p.intent_purpose] : "—"}</td>
                    <td className="num py-3 pr-4 text-right text-foreground">{money(p.intent_cents)}</td>
                    <td className="py-3 pr-4">
                      {p.eligibility_decision
                        ? <span className={`rounded-full border px-2 py-0.5 text-xs ${DECISION_LABEL[p.eligibility_decision].tone}`}>{DECISION_LABEL[p.eligibility_decision].title}</span>
                        : <span className="text-xs text-muted-foreground">{tr({ en: "Not evaluated", pt: "Não avaliada" })}</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {p.stage_no >= 6 ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <PoolPill pool={p.funding_pool} />
                          <span className="num">{tr({ en: `${money(p.funded_cents ?? 0)} of ${money(p.opportunity_cents)}`, pt: `${money(p.funded_cents ?? 0)} de ${money(p.opportunity_cents)}` })}</span>
                        </span>
                      ) : p.opportunity_status ? OPPORTUNITY_LABEL[p.opportunity_status] : "—"}
                    </td>
                    <td className="py-3">
                      {p.loan_status ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={LOAN_TONE[p.loan_status]}>{LOAN_LABEL[p.loan_status]}</StatusPill>
                          {p.loan_term && FINANCED.includes(p.loan_status) && (
                            <span className="num text-xs text-muted-foreground">{p.instalments_paid}/{p.loan_term}</span>
                          )}
                          {p.late && <AlertTriangle size={14} className="text-alert" aria-label={tr({ en: "Late", pt: "Em atraso" })} />}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
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
