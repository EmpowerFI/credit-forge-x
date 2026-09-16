import { Check, CheckCircle2, X, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProofLine } from "../../components/consent/ConsentScopes";
import LoadError from "../../components/LoadError";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { localized, tr } from "../../i18n";
import { shortDate } from "../../lib/community";
import { CHANNEL_LABEL, SCOPE_TEXT, SCOPES } from "../../lib/consent";
import { useConsentAudit } from "./queries";

const CHECKS = localized([
  {
    key: "assessed_without_consent",
    label: { en: "Readiness assessments made without consent to assess", pt: "Avaliações de prontidão feitas sem consentimento para avaliar" },
  },
  {
    key: "eligibility_without_consent",
    label: { en: "Eligibility assessments made without consent to assess", pt: "Avaliações de elegibilidade feitas sem consentimento para avaliar" },
  },
  {
    key: "referred_without_consent",
    label: { en: "Requests sent to the P2P desk without consent to share", pt: "Pedidos enviados à mesa P2P sem consentimento para compartilhar" },
  },
  {
    key: "listed_without_consent",
    label: { en: "Opportunities open to investors without consent to be shown", pt: "Oportunidades abertas a investidores sem consentimento para serem mostradas" },
  },
] as const);

/** Column headings: the scope's code in English, a word in Portuguese. */
const SCOPE_COLUMN_PT: Record<(typeof SCOPES)[number], string> = {
  assessment: "Avaliação", partner: "Mesa P2P", investors: "Investidores", impact: "Impacto",
};

/** Consent as recorded, and whether the platform honoured it — each check against the consent in force at the time. */
export default function Consents() {
  const q = useConsentAudit();
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  const clean = CHECKS.every((c) => d.checks[c.key] === 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label={tr({ en: "Participants", pt: "Participantes" })} value={d.enrolled}
          hint={tr({ en: `${d.with_record} with a record`, pt: `${d.with_record} com registro` })} />
        <StatTile label={tr({ en: "Without a record", pt: "Sem registro" })} value={d.without_record}
          hint={tr({ en: "nothing of theirs is used", pt: "nenhum dado delas é usado" })} hintTone={d.without_record ? "caution" : "positive"} />
        <StatTile label={tr({ en: "Records", pt: "Registros" })} value={d.records}
          hint={tr({ en: `${d.changes} changes of mind`, pt: `${d.changes} mudanças de decisão` })} />
        <StatTile label={tr({ en: "From the community", pt: "Pela comunidade" })} value={d.by_channel.community}
          hint={tr({ en: `${d.by_channel.app} in the app`, pt: `${d.by_channel.app} no app` })} />
        <StatTile label={tr({ en: "Proven on Solana", pt: "Provados na Solana" })} value={d.anchored}
          hint={tr({ en: `of ${d.records}`, pt: `de ${d.records}` })} hintTone={d.anchored === d.records ? "positive" : "info"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Enforced, not only recorded", pt: "Cumprido, não só registrado" })}
          description={tr({
            en: "Every assessment, referral and listing checked against the consent that was in force when it happened. Each should read zero.",
            pt: "Cada avaliação, encaminhamento e oferta a investidores conferidos com o consentimento em vigor quando aconteceram. Todos devem dar zero.",
          })}>
          <ul className="divide-y divide-border">
            {CHECKS.map((c) => {
              const n = d.checks[c.key];
              return (
                <li key={c.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="text-foreground">{c.label}</span>
                  <span className={`flex items-center gap-1.5 font-medium ${n === 0 ? "text-positive" : "text-alert"}`}>
                    {n === 0 ? <CheckCircle2 size={16} aria-hidden /> : <XCircle size={16} aria-hidden />} <span className="num">{n}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={`text-sm ${clean ? "text-positive" : "text-alert"}`}>
            {clean
              ? tr({ en: "Nothing happened to anyone's data that they had not allowed.", pt: "Nada foi feito com os dados de ninguém sem a sua permissão." })
              : tr({ en: "Something happened without the consent it needed: see the counts above.", pt: "Algo foi feito sem o consentimento necessário: veja as contagens acima." })}
          </p>
        </Panel>

        <Panel title={tr({ en: "What participants allow", pt: "O que as participantes permitem" })}
          description={tr({ en: "Their latest record, per use.", pt: "O registro mais recente de cada uma, por uso." })}>
          <ul className="space-y-3">
            {SCOPES.map((s) => {
              const n = d.by_scope[s];
              const pct = d.with_record ? Math.round((n / d.with_record) * 100) : 0;
              return (
                <li key={s} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{SCOPE_TEXT[s].title}</span>
                    <span className="num text-muted-foreground">{n} · {pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-positive" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title={tr({ en: "Latest records", pt: "Registros mais recentes" })}
        description={tr({
          en: "Participants by code. Each record is a commitment on Solana, so none can be rewritten after the fact.",
          pt: "Participantes por código. Cada registro é um compromisso na Solana, então nenhum pode ser reescrito depois.",
        })}>
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Participant", pt: "Participante" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Record", pt: "Registro" })}</th>
                {SCOPES.map((s) => <th key={s} className="py-2 pr-3 text-center font-medium capitalize">{tr({ en: s, pt: SCOPE_COLUMN_PT[s] })}</th>)}
                <th className="py-2 pr-4 font-medium">{tr({ en: "How", pt: "Como" })}</th>
                <th className="py-2 font-medium">{tr({ en: "Proof", pt: "Prova" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-4">
                    <span className="font-mono text-xs text-foreground">{r.participant}</span>
                    {r.community && <span className="block text-xs text-muted-foreground">{r.community}</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">#{r.consent_no} · {shortDate(r.at)}</td>
                  {SCOPES.map((s) => (
                    <td key={s} className="py-2.5 pr-3 text-center">
                      {r[s] ? <Check size={15} className="inline text-positive" aria-label={tr({ en: "Allowed", pt: "Permitido" })} /> : <X size={15} className="inline text-muted-foreground" aria-label={tr({ en: "Not allowed", pt: "Não permitido" })} />}
                    </td>
                  ))}
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{CHANNEL_LABEL[r.channel]}</td>
                  <td className="py-2.5 text-xs"><ProofLine proof={r.proof} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
