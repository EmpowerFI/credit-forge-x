import { Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DataTag } from "../product/DataLegend";
import ProofLine from "../product/ProofLine";
import { CHANNEL_LABEL, type Choices, type ConsentRecord, SCOPE_TEXT, SCOPES, setScope } from "../../lib/consent";
import { shortDate } from "../../lib/community";
import { tr } from "../../i18n";

/** The four uses of her data, each with what it reads, who sees it, and what never leaves. */
export function ConsentScopes({ value, onChange, disabled = false }: {
  value: Choices;
  onChange: (next: Choices) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {SCOPES.map((scope) => {
        const t = SCOPE_TEXT[scope];
        const on = value[scope];
        const id = `consent-${scope}`;
        return (
          <li key={scope} className={`rounded-xl border p-4 transition-colors ${on ? "border-positive/40 bg-positive/5" : "border-border"}`}>
            <div className="flex items-start justify-between gap-4">
              <label htmlFor={id} className="cursor-pointer space-y-0.5">
                <span className="block font-medium text-foreground">{t.title}</span>
                {t.needs && (
                  <span className="block text-xs text-muted-foreground">
                    {tr({
                      en: `Builds on “${SCOPE_TEXT[t.needs].title.toLowerCase()}”.`,
                      pt: `Depende de “${SCOPE_TEXT[t.needs].title.toLowerCase()}”.`,
                    })}
                  </span>
                )}
              </label>
              <Switch id={id} checked={on} disabled={disabled} onCheckedChange={(v) => onChange(setScope(value, scope, v))} />
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-xs text-muted-foreground">{tr({ en: "Uses", pt: "Usa" })}</dt>
              <dd className="text-foreground">{t.uses}</dd>
              <dt className="text-xs text-muted-foreground">{tr({ en: "Who sees it", pt: "Quem vê" })}</dt>
              <dd className="text-foreground">{t.who}</dd>
              <dt className="text-xs text-muted-foreground">{tr({ en: "Never", pt: "Nunca" })}</dt>
              <dd className="flex items-start gap-1.5 text-foreground"><span className="mt-0.5"><DataTag kind="private" /></span>{t.never}</dd>
              {!on && (
                <>
                  <dt className="text-xs text-muted-foreground">{tr({ en: "Without it", pt: "Sem isso" })}</dt>
                  <dd className="text-muted-foreground">{t.without}</dd>
                </>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/** One consent record at a glance: each use allowed or not, how and when it was given, and its proof. */
export function ConsentSummary({ record, compact = false }: { record: ConsentRecord | null; compact?: boolean }) {
  if (!record) {
    return (
      <p className="text-sm text-muted-foreground">
        {tr({
          en: "No consent recorded yet: nothing of hers is assessed or shared.",
          pt: "Nenhum consentimento registrado ainda: nada dela é avaliado ou compartilhado.",
        })}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <ul className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {SCOPES.map((s) => (
          <li key={s} className="flex items-center gap-2 text-sm">
            {record[s]
              ? <Check size={15} className="shrink-0 text-positive" aria-label={tr({ en: "Allowed", pt: "Autorizado" })} />
              : <X size={15} className="shrink-0 text-muted-foreground" aria-label={tr({ en: "Not allowed", pt: "Não autorizado" })} />}
            <span className={record[s] ? "text-foreground" : "text-muted-foreground"}>{SCOPE_TEXT[s].title}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {tr({ en: `Record #${record.consent_no}`, pt: `Registro nº ${record.consent_no}` })} · {CHANNEL_LABEL[record.channel]} ·{" "}
          {shortDate(record.at)} · {record.text_version}
        </span>
        <ProofLine proof={record.proof} />
      </div>
    </div>
  );
}

export { ProofLine };
