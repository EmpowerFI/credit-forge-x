import { CheckCircle2, CircleDashed, ExternalLink, ShieldAlert, XCircle } from "lucide-react";
import { ANCHOR_DOMAINS, fromHex, toHex } from "@empowerfi/audit-commitments";
import { formatDateTime, localized, tr } from "../../i18n";
import { explorerAddress, explorerTx } from "../../lib/platform";
import type { AuditRecord, audit, Verdict } from "../../lib/verify";

// A proof, recomputed in this browser: the verdict, each check, the three
// hashes side by side and what was committed. The audit page shows it whole;
// the proof drawer shows it beside the event it proves.

const VERDICT_STYLE: Record<Verdict, { className: string; icon: typeof CheckCircle2; word: string; text: string }> = localized({
  VERIFIED: {
    className: "tone-positive", icon: CheckCircle2, word: { en: "VERIFIED", pt: "VERIFICADA" },
    text: { en: "The record in the database is the one proven on Solana.", pt: "O registro no banco de dados é o mesmo provado na Solana." },
  },
  MISMATCH: {
    className: "tone-alert", icon: XCircle, word: { en: "MISMATCH", pt: "DIVERGENTE" },
    text: {
      en: "The record no longer matches its proof. It changed after it was anchored.",
      pt: "O registro não bate mais com a sua prova. Ele mudou depois de ser registrado na Solana.",
    },
  },
  MISSING: {
    className: "tone-alert", icon: ShieldAlert, word: { en: "MISSING", pt: "AUSENTE" },
    text: { en: "The account recorded for this proof does not exist on-chain.", pt: "A conta registrada para esta prova não existe na blockchain." },
  },
  PENDING: {
    className: "tone-caution", icon: CircleDashed, word: { en: "PENDING", pt: "PENDENTE" },
    text: { en: "This fact has not been anchored yet.", pt: "Este fato ainda não foi registrado na Solana." },
  },
});

const RECONCILE_PT: Record<AuditRecord["anchor"]["reconcile"], string> = {
  unchecked: "ainda não conferido", verified: "verificado", missing: "ausente", mismatch: "divergente",
};

function Hash({ label, bytes }: { label: string; bytes: Uint8Array | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="break-all font-mono text-xs text-foreground">{bytes ? toHex(bytes) : "—"}</p>
    </div>
  );
}


export type AuditResult = Awaited<ReturnType<typeof audit>>;

/** The verdict and everything behind it. `compact` leaves the committed record folded away. */
export default function ProofResult({ result, compact = false }: { result: AuditResult; compact?: boolean }) {
  const { record, verdict, checks, recomputed, onChain, canonical } = result;
  const kind = record.anchor.kind;
  const style = VERDICT_STYLE[verdict];
  const Icon = style.icon;
  return (
    <>
      <div className={`flex items-start gap-3 rounded-2xl border p-5 ${style.className}`} role="status">
        <Icon className="mt-0.5 shrink-0" size={22} />
        <div>
          <p className="font-heading text-xl font-bold tracking-wide">{style.word}</p>
          <p className="text-sm">{style.text}</p>
        </div>
      </div>

      {checks.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
          {checks.map((c, i) => (
            <li key={i} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-foreground">
                {c.label()}
                {c.detail && <span className="block text-xs text-muted-foreground">{c.detail()}</span>}
              </span>
              {c.ok === true && <CheckCircle2 size={18} className="shrink-0 text-positive" aria-label={tr({ en: "passes", pt: "confere" })} />}
              {c.ok === false && <XCircle size={18} className="shrink-0 text-alert" aria-label={tr({ en: "fails", pt: "não confere" })} />}
              {c.ok === null && <CircleDashed size={18} className="shrink-0 text-muted-foreground" aria-label={tr({ en: "not checked", pt: "não conferido" })} />}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-border bg-background/60 p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{tr({ en: "Anchored", pt: "Registrada na Solana" })}</dt>
          <dd className="text-foreground">{record.anchor.confirmed_at ? formatDateTime(record.anchor.confirmed_at) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{tr({ en: "Commitment schema", pt: "Esquema do compromisso" })}</dt>
          <dd className="font-mono text-xs text-foreground">{ANCHOR_DOMAINS[kind]}</dd>
        </div>
        {(record.payload?.model_version || record.payload?.text_version) && (
          <div>
            <dt className="text-xs text-muted-foreground">{record.payload?.text_version ? tr({ en: "Wording", pt: "Texto" }) : tr({ en: "Model", pt: "Modelo" })}</dt>
            <dd className="font-mono text-xs text-foreground">{String(record.payload?.model_version ?? record.payload?.text_version)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">{tr({ en: "Program", pt: "Programa" })}</dt>
          <dd><a href={explorerAddress(record.anchor.program_id)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:text-foreground">
            {record.anchor.program_id.slice(0, 4)}…{record.anchor.program_id.slice(-4)} <ExternalLink size={11} />
          </a></dd>
        </div>
      </dl>

      <section className="space-y-4 rounded-2xl p-6 glass glow-border">
        <Hash label={tr({ en: "Recomputed here", pt: "Recalculado aqui" })} bytes={recomputed} />
        <Hash label={tr({ en: "Recorded in the database", pt: "Registrado no banco de dados" })} bytes={record.anchor.commitment ? fromHex(record.anchor.commitment) : null} />
        <Hash label={tr({ en: "On-chain", pt: "Na blockchain" })} bytes={onChain} />
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
          {record.anchor.signature && (
            <a href={explorerTx(record.anchor.signature)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:text-foreground">
              {tr({ en: "Transaction", pt: "Transação" })} · slot {record.anchor.slot} <ExternalLink size={12} />
            </a>
          )}
          {record.anchor.account_address && (
            <a href={explorerAddress(record.anchor.account_address)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:text-foreground">
              {tr({ en: "Account", pt: "Conta" })} <ExternalLink size={12} />
            </a>
          )}
        </div>
        {record.anchor.reconciled_at && (
          <p className={`text-xs ${record.anchor.reconcile === "verified" ? "text-muted-foreground" : "text-alert"}`}>
            {tr({
              en: `Also re-checked by EmpowerFI's reconciliation job on ${formatDateTime(record.anchor.reconciled_at)}: ${record.anchor.reconcile}`,
              pt: `Também conferido de novo pela conciliação da EmpowerFI em ${formatDateTime(record.anchor.reconciled_at)}: ${RECONCILE_PT[record.anchor.reconcile]}`,
            })}
            {record.anchor.reconcile_note ? ` — ${record.anchor.reconcile_note}` : ""}.
          </p>
        )}
      </section>

      {canonical && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {tr({ en: "What was committed", pt: "O que o compromisso registra" })} · {ANCHOR_DOMAINS[kind]}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-background/60 p-4">
            <pre className="text-xs text-foreground">{JSON.stringify(JSON.parse(canonical), null, 2)}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "SHA-256 of the domain tag, a zero byte and this record in canonical JSON. No personal data leaves the database; the chain holds only the hash.",
              pt: "SHA-256 da tag de domínio, um byte zero e este registro em JSON canônico. Nenhum dado pessoal sai do banco de dados; a blockchain guarda só o hash.",
            })}
          </p>
        </section>
      )}
    </>
  );
}
