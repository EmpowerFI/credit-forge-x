import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Loader2, Printer, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../components/LoadError";
import { formatDateTime, localized, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import DataLegend from "../components/product/DataLegend";
import ExplorerLink from "../components/product/ExplorerLink";
import NetworkBadge from "../components/product/NetworkBadge";
import Panel from "../components/product/Panel";
import StatTile from "../components/product/StatTile";
import StatusPill from "../components/product/StatusPill";
import { PROOF_KIND_LABEL } from "../lib/audit";
import { shortDate } from "../lib/community";
import { DECISION_LABEL, LOAN_LABEL, type LoanStatus } from "../lib/credit";
import type { AnchorKind } from "../lib/platform";
import { checkOnChain, fetchSharedReport, proofIssue, type ChainCheck, type SharedReport } from "../lib/report";
import { money } from "../lib/readiness";
import { usdc } from "../lib/solana";
import { zcashExplorerTx, zec } from "../lib/zcash";

const CONSENT_CHECK: Record<string, string> = localized({
  assessed_without_consent: { en: "Readiness assessed without consent", pt: "Prontidão avaliada sem consentimento" },
  eligibility_without_consent: { en: "Eligibility assessed without consent", pt: "Elegibilidade avaliada sem consentimento" },
  referred_without_consent: { en: "Sent to the P2P desk without consent", pt: "Enviado à mesa P2P sem consentimento" },
  listed_without_consent: { en: "Shown to investors without consent", pt: "Mostrado a investidores sem consentimento" },
});
const LEG_LABEL: Record<string, string> = localized({
  release: { en: "Releases to the ramp", pt: "Liberações para a rampa" },
  payout: { en: "Payouts to investors", pt: "Repasses aos investidores" },
  pix_payout: { en: "Pix to her business (mock)", pt: "Pix para o negócio dela (simulado)" },
  pix_in: { en: "Pix instalments in (mock)", pt: "Parcelas recebidas via Pix (simulado)" },
});

const at = (iso: string | null | undefined) =>
  iso ? formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
const MODEL_NAME: Record<"readiness" | "eligibility" | "outcome", string> = localized({
  readiness: { en: "readiness", pt: "prontidão" },
  eligibility: { en: "eligibility", pt: "elegibilidade" },
  outcome: { en: "outcome", pt: "resultado" },
});
/** A settlement leg's status is the database's value; in Portuguese it reads as a word. */
const LEG_STATUS_PT: Record<string, string> = {
  due: "a enviar", held: "em espera", sending: "enviando", done: "concluído", failed: "com falha", mock: "mock",
};
/** The P2P desk's verdicts are the database's values; in Portuguese they read as words. */
const VERDICT_PT: Record<string, string> = { approved: "aprovados", declined: "recusados", more_information: "mais informações" };
const legStatus = (status: string) => tr({ en: status, pt: LEG_STATUS_PT[status] ?? status });
const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-6)}`;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-right text-foreground">{children}</span>
    </div>
  );
}

function Verdict({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      {ok === null ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" />
        : ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-alert" />}
      <span className="text-foreground">{children}</span>
    </p>
  );
}

function ChainResult({ c, expected, title }: { c: ChainCheck; expected: number; title: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title} · {at(c.at)}</p>
      {c.proofs.checked === 0 ? <Verdict ok={null}>{tr({ en: "No proof had reached Solana yet when the report was made", pt: "Nenhuma prova tinha chegado à Solana quando o relatório foi feito" })}</Verdict> : (
        <>
          <Verdict ok={c.proofs.landed === c.proofs.checked}>
            {tr({
              en: `${c.proofs.landed} of ${c.proofs.checked} proof transactions landed on Solana`,
              pt: `${c.proofs.landed} de ${c.proofs.checked} transações de prova foram confirmadas na Solana`,
            })}
          </Verdict>
          <Verdict ok={c.proofs.commitment_found === c.proofs.checked ? true : c.proofs.problems.length === 0 ? null : false}>
            {tr({
              en: `${c.proofs.commitment_found} of ${c.proofs.checked} commitments found where the program wrote them`,
              pt: `${c.proofs.commitment_found} de ${c.proofs.checked} compromissos encontrados onde o programa os gravou`,
            })}
            {(c.proofs.unreadable ?? 0) > 0 && (
              <span className="block text-xs text-muted-foreground">
                {tr({
                  en: `${c.proofs.unreadable} could not be read just now: the public Solana RPC limits how fast a browser may ask. Run the check again in a minute.`,
                  pt: `${c.proofs.unreadable} não puderam ser lidos agora: o RPC público da Solana limita a frequência das consultas de um navegador. Rode a verificação de novo em um minuto.`,
                })}
              </span>
            )}
          </Verdict>
        </>
      )}
      {c.transfers.checked > 0 && (
        <Verdict ok={c.transfers.landed === c.transfers.checked}>
          {tr({
            en: `${c.transfers.landed} of ${c.transfers.checked} vault transactions landed`,
            pt: `${c.transfers.landed} de ${c.transfers.checked} transações do cofre foram confirmadas`,
          })}
        </Verdict>
      )}
      <Verdict ok={c.vault.chain_micro_usdc === null ? null : c.vault.chain_micro_usdc === expected}>
        {tr({
          en: `The vault holds ${c.vault.chain_micro_usdc === null ? "no account yet" : usdc(c.vault.chain_micro_usdc)}; the ledger says ${usdc(expected)}`,
          pt: `O cofre tem ${c.vault.chain_micro_usdc === null ? "nenhuma conta ainda" : usdc(c.vault.chain_micro_usdc)}; o livro-razão diz ${usdc(expected)}`,
        })}
        {c.vault.chain_micro_usdc !== null && c.vault.chain_micro_usdc !== expected
          && tr({ en: " (it may have moved since the report was made)", pt: " (ele pode ter mudado desde que o relatório foi feito)" })}
      </Verdict>
      {c.proofs.problems.length > 0 && (
        <ul className="space-y-1 text-xs text-alert">
          {c.proofs.problems.slice(0, 10).map((p) => <li key={p.signature}>{PROOF_KIND_LABEL[p.kind as AnchorKind] ?? p.kind}: {proofIssue(p.issue)} · <ExplorerLink tx={p.signature} /></li>)}
        </ul>
      )}
    </div>
  );
}

function download(report: SharedReport, mine: ChainCheck | null) {
  const body = JSON.stringify({ ...report, reader_checks: mine }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `empowerfi-audit-report-${report.created_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * An audit report opened by its link: no account needed. The figures are the
 * auditor's snapshot; the chain checks can be run again here, from this
 * browser, against Solana directly.
 */
export default function ReportPage() {
  const { token = "" } = useParams();
  const report = useQuery({ queryKey: ["shared-report", token], queryFn: () => fetchSharedReport(token), retry: false });
  const [progress, setProgress] = useState("");
  const recheck = useMutation({ mutationFn: () => checkOnChain(report.data!.snapshot, setProgress) });

  const header = (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <span className="hidden font-heading text-base font-semibold text-foreground sm:block">{tr({ en: "Audit report", pt: "Relatório de auditoria" })}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <NetworkBadge />
        </div>
      </div>
    </header>
  );

  if (report.isPending) {
    return <div className="min-h-screen bg-background">{header}<main className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6"><Skeleton className="h-24" /><Skeleton className="h-72" /></main></div>;
  }
  if (report.isError) {
    const gone = (report.error as { message?: string }).message === "report_not_found";
    return (
      <div className="min-h-screen bg-background">{header}
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          {gone ? (
            <Panel title={tr({ en: "This report is not available", pt: "Este relatório não está disponível" })}>
              <p className="text-sm text-muted-foreground">
                {tr({
                  en: "The link is wrong, or the auditor who shared it has closed it. Ask them for a new one.",
                  pt: "O link está errado, ou quem o compartilhou encerrou o acesso. Peça um novo link.",
                })}
              </p>
            </Panel>
          ) : <LoadError error={report.error} onRetry={() => report.refetch()} />}
        </main>
      </div>
    );
  }

  const { title, created_at, snapshot: s, checks } = report.data;
  const consentClean = Object.values(s.consent.checks).every((n) => n === 0);
  const kinds = Object.entries(s.anchors.by_kind).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">{tr({ en: "EmpowerFI · audit report", pt: "EmpowerFI · relatório de auditoria" })}</p>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {tr({
                en: `Made by an EmpowerFI auditor on ${at(created_at)}. Demo data on Solana devnet: every figure is simulated or devnet, and no real money moved.`,
                pt: `Feito por um auditor da EmpowerFI em ${at(created_at)}. Dados de demonstração na Solana devnet: todo número é simulado ou da devnet, e nenhum dinheiro real foi movimentado.`,
              })}
            </p>
            <DataLegend />
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => download(report.data, recheck.data ?? null)}><Download size={15} /> JSON</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer size={15} /> {tr({ en: "Print or save as PDF", pt: "Imprimir ou salvar em PDF" })}</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label={tr({ en: "Proofs on Solana", pt: "Provas na Solana" })} value={s.anchors.confirmed}
            hint={tr({ en: `${s.anchors.queued} queued`, pt: `${s.anchors.queued} na fila` })} />
          <StatTile label={tr({ en: "Re-read from chain", pt: "Relidas na blockchain" })} value={s.anchors.verified}
            hint={tr({ en: `${s.anchors.mismatch + s.anchors.missing} disagree`, pt: `${s.anchors.mismatch + s.anchors.missing} divergem` })}
            hintTone={s.anchors.mismatch + s.anchors.missing ? "alert" : "positive"} />
          <StatTile label={tr({ en: "Decisions reproduced", pt: "Decisões reproduzidas" })}
            value={checks.models ? `${checks.models.reproduced}/${checks.models.checked}` : "—"}
            hint={tr({ en: "in the auditor's browser", pt: "no navegador do auditor" })}
            hintTone={checks.models && checks.models.reproduced === checks.models.checked ? "positive" : "neutral"} />
          <StatTile label={tr({ en: "Consent breaches", pt: "Violações de consentimento" })} value={Object.values(s.consent.checks).reduce((a, b) => a + b, 0)}
            hint={tr({ en: "enforcement checks", pt: "verificações de cumprimento" })} hintTone={consentClean ? "positive" : "alert"} />
          <StatTile label={tr({ en: "Vault, expected", pt: "Cofre, esperado" })} value={usdc(s.vault.expected_micro_usdc)} hint={tr({ en: "devnet USDC", pt: "USDC da devnet" })} />
          <StatTile label={tr({ en: "Lent, P2P", pt: "Emprestado, P2P" })} value={money(s.credit.lent_cents)} hint={tr({ en: "simulated", pt: "simulado" })} />
        </div>

        <Panel title={tr({ en: "Check it yourself", pt: "Confira você mesmo" })} actions={(
          <Button className="no-print gap-1.5" disabled={recheck.isPending} onClick={() => recheck.mutate()}>
            {recheck.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {tr({ en: "Check on Solana now", pt: "Verificar na Solana agora" })}
          </Button>
        )} description={tr({
          en: "This page asks Solana directly, from your browser, whether each proof's transaction landed and whether its commitment is where the program wrote it; it reads the vault's balance too. A commitment is a hash: it proves a record existed unchanged, without revealing it.",
          pt: "Esta página pergunta direto à Solana, do seu navegador, se a transação de cada prova foi confirmada e se o compromisso está onde o programa o gravou; ela também lê o saldo do cofre. Um compromisso é um hash: prova que um registro existia sem alteração, sem revelá-lo.",
        })}>
          <div className="grid gap-6 md:grid-cols-2">
            {checks.chain ? <ChainResult c={checks.chain} expected={s.vault.expected_micro_usdc} title={tr({ en: "The auditor's check", pt: "A verificação do auditor" })} />
              : <p className="text-sm text-muted-foreground">{tr({ en: "The auditor's browser did not record a chain check.", pt: "O navegador do auditor não registrou uma verificação na blockchain." })}</p>}
            {recheck.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> {progress}</p>
              : recheck.isError ? <LoadError compact error={recheck.error} onRetry={() => recheck.mutate()} />
              : recheck.data ? <ChainResult c={recheck.data} expected={s.vault.expected_micro_usdc} title={tr({ en: "Your check", pt: "Sua verificação" })} />
              : <p className="text-sm text-muted-foreground">{tr({ en: "Run it to compare with the auditor's.", pt: "Rode para comparar com a do auditor." })}</p>}
          </div>
          <div className="grid gap-x-6 text-xs sm:grid-cols-3">
            <Row label={tr({ en: "Program", pt: "Programa" })}><ExplorerLink address={s.chain.program_id} /></Row>
            <Row label={tr({ en: "Vault", pt: "Cofre" })}>{checks.vault ? <ExplorerLink address={checks.vault.address} /> : "—"}</Row>
            <Row label={tr({ en: "USDC mint (Circle devnet)", pt: "Mint do USDC (Circle devnet)" })}><ExplorerLink address={s.chain.usdc_mint} /></Row>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={tr({ en: "Proofs by kind", pt: "Provas por tipo" })}
            description={tr({
              en: "Every fact EmpowerFI records is committed on Solana. The reconciler re-reads each one from the chain and compares.",
              pt: "Cada fato que a EmpowerFI registra tem seu compromisso na Solana. A conciliação relê cada um na blockchain e compara.",
            })}>
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">{tr({ en: "Kind", pt: "Tipo" })}</th>
                    <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Recorded", pt: "Registradas" })}</th>
                    <th className="py-2 pr-4 text-right font-medium">{tr({ en: "On chain", pt: "Na blockchain" })}</th>
                    <th className="py-2 text-right font-medium">{tr({ en: "Re-read", pt: "Relidas" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {kinds.map(([k, v]) => (
                    <tr key={k}><td className="py-2 pr-4 text-foreground">{PROOF_KIND_LABEL[k as AnchorKind] ?? k}</td><td className="num py-2 pr-4 text-right">{v.total}</td><td className="num py-2 pr-4 text-right">{v.confirmed}</td><td className="num py-2 text-right text-positive">{v.verified}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: `First proof ${at(s.anchors.first_confirmed_at)} · latest ${at(s.anchors.last_confirmed_at)} · last re-read ${at(s.anchors.last_reconciled_at)}`,
                pt: `Primeira prova ${at(s.anchors.first_confirmed_at)} · mais recente ${at(s.anchors.last_confirmed_at)} · última releitura ${at(s.anchors.last_reconciled_at)}`,
              })}
            </p>
          </Panel>

          <Panel title={tr({ en: "Consent, enforced", pt: "Consentimento cumprido" })}
            description={tr({
              en: "Each use of her data needs her consent in force at the time. Every check should read 0.",
              pt: "Cada uso dos dados dela precisa do consentimento dela em vigor naquele momento. Toda verificação deve dar 0.",
            })}>
            {Object.entries(s.consent.checks).map(([k, n]) => (
              <Verdict key={k} ok={n === 0}>{CONSENT_CHECK[k] ?? k}: {n}</Verdict>
            ))}
            <div className="grid gap-x-6 sm:grid-cols-2">
              <Row label={tr({ en: "Enrolled", pt: "Inscritas" })}>{s.consent.enrolled}</Row>
              <Row label={tr({ en: "With a consent record", pt: "Com registro de consentimento" })}>{s.consent.with_record}</Row>
              <Row label={tr({ en: "Records (changes)", pt: "Registros (mudanças)" })}>{s.consent.records} ({s.consent.changes})</Row>
              <Row label={tr({ en: "Proven on Solana", pt: "Provados na Solana" })}>{s.consent.anchored}</Row>
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={tr({ en: "Models", pt: "Modelos" })}
            description={tr({
              en: "The rule engines behind each decision, by version. The auditor re-ran the latest decisions through the same engines in the browser.",
              pt: "Os motores de regras por trás de cada decisão, por versão. O auditor rodou de novo as decisões mais recentes nos mesmos motores, no navegador.",
            })}>
            {(["readiness", "eligibility", "outcome"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{MODEL_NAME[k]}</p>
                {s.models[k].length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Not run.", pt: "Não rodou." })}</p> : s.models[k].map((m) => (
                  <Row key={m.version} label={m.version}>{tr({ en: `${m.runs} runs · ${m.anchored} on chain`, pt: `${m.runs} execuções · ${m.anchored} na blockchain` })}</Row>
                ))}
              </div>
            ))}
          </Panel>

          <Panel title={tr({ en: "From readiness to credit", pt: "Da prontidão ao crédito" })}
            description={tr({ en: "Counts only: who is who stays private.", pt: "Só contagens: quem é quem fica privado." })}>
            <Row label={tr({ en: "Verified communities", pt: "Comunidades verificadas" })}>{s.credit.communities}</Row>
            <Row label={tr({ en: "Participants", pt: "Participantes" })}>{s.credit.participants}</Row>
            <Row label={tr({ en: "Credit ready now", pt: "Prontas para crédito agora" })}>{s.credit.credit_ready}</Row>
            <Row label={tr({ en: "Eligibility assessments", pt: "Avaliações de elegibilidade" })}>{Object.entries(s.credit.eligibility)
              .map(([k, n]) => `${tr({ en: k.toLowerCase().replace(/_/g, " "), pt: DECISION_LABEL[k as keyof typeof DECISION_LABEL]?.title.toLowerCase() ?? k })} ${n}`)
              .join(" · ") || "—"}</Row>
            <Row label={tr({ en: "Opened to P2P investors", pt: "Abertas a investidores P2P" })}>{s.credit.referred}</Row>
            <Row label={tr({ en: "Desk decisions", pt: "Decisões da mesa" })}>{Object.entries(s.credit.decisions).map(([k, n]) => `${tr({ en: k, pt: VERDICT_PT[k] ?? k })} ${n}`).join(" · ") || "—"}</Row>
            <Row label={tr({ en: "Loans", pt: "Empréstimos" })}>{Object.entries(s.credit.loans).map(([k, n]) => `${LOAN_LABEL[k as LoanStatus]?.toLowerCase() ?? k} ${n}`).join(" · ") || "—"}</Row>
            <Row label={tr({ en: "Instalments received", pt: "Parcelas recebidas" })}>{s.credit.instalments} · {money(s.credit.repaid_cents)}</Row>
            <Row label={tr({ en: "Outcomes measured", pt: "Resultados medidos" })}>{s.credit.outcomes}</Row>
          </Panel>
        </div>

        <Panel title={tr({ en: "The vault and settlement", pt: "O cofre e a liquidação" })}
          description={tr({
            en: "Investors' devnet USDC in the program's vault, and every transaction that moved it. Deposits never name the opportunity they fund.",
            pt: "O USDC de devnet dos investidores no cofre do programa, e cada transação que o movimentou. Os depósitos nunca indicam a oportunidade que financiam.",
          })}>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <Row label={tr({ en: "Deposited by wallet and credited for ZEC", pt: "Depositado por carteira e creditado por ZEC" })}>
                {usdc(s.vault.deposits_micro_usdc)} · {tr({ en: `${s.vault.deposits} deposits`, pt: `${s.vault.deposits} depósitos` })}
              </Row>
              <Row label={tr({ en: "From shielded ZEC", pt: "De ZEC blindado" })}>{usdc(s.vault.zcash_micro_usdc)}</Row>
              <Row label={tr({ en: "Refunded", pt: "Reembolsado" })}>{usdc(s.vault.refunded_micro_usdc)} · {s.vault.refunded}</Row>
              <Row label={tr({ en: "Released to the ramp", pt: "Liberado para a rampa" })}>{usdc(s.vault.released_micro_usdc)}</Row>
              <Row label={tr({ en: "Paid out to investors", pt: "Repassado aos investidores" })}>
                {tr({
                  en: `${usdc(s.vault.paid_out_micro_usdc)} (${usdc(s.vault.repaid_in_micro_usdc)} in)`,
                  pt: `${usdc(s.vault.paid_out_micro_usdc)} (${usdc(s.vault.repaid_in_micro_usdc)} recebidos)`,
                })}
              </Row>
              <Row label={tr({ en: "Should hold", pt: "Deveria ter" })}>{usdc(s.vault.expected_micro_usdc)}</Row>
              <Row label={tr({ en: "Simulated positions (no USDC)", pt: "Posições simuladas (sem USDC)" })}>{s.vault.simulated_positions}</Row>
            </div>
            <div>
              {Object.entries(s.settlement.legs).sort().map(([k, n]) => {
                const [kind, status] = k.split(":");
                return <Row key={k} label={`${LEG_LABEL[kind] ?? kind} · ${legStatus(status)}`}>{n}</Row>;
              })}
            </div>
          </div>
          {[...s.settlement.transfers, ...s.settlement.deposits, ...s.settlement.refunds].length > 0 && (
            <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">{tr({ en: "Movement", pt: "Movimento" })}</th>
                    <th className="py-2 pr-4 text-right font-medium">USDC</th>
                    <th className="py-2 pr-4 font-medium">{tr({ en: "When", pt: "Quando" })}</th>
                    <th className="py-2 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {s.settlement.deposits.map((d) => <tr key={d.signature}><td className="py-2 pr-4">{tr({ en: "Deposit into the vault", pt: "Depósito no cofre" })}</td><td className="num py-2 pr-4 text-right">{usdc(d.amount_micro_usdc)}</td><td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(d.at)}</td><td className="py-2"><ExplorerLink tx={d.signature} /></td></tr>)}
                  {s.settlement.refunds.map((d) => <tr key={d.signature}><td className="py-2 pr-4">{tr({ en: "Refund from the vault", pt: "Reembolso do cofre" })}</td><td className="num py-2 pr-4 text-right">{usdc(d.amount_micro_usdc)}</td><td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(d.at)}</td><td className="py-2"><ExplorerLink tx={d.signature} /></td></tr>)}
                  {s.settlement.transfers.map((t) => (
                    <tr key={t.signature}>
                      <td className="py-2 pr-4">{t.kind === "release" ? tr({ en: "Release to the ramp", pt: "Liberação para a rampa" }) : tr({ en: "Payout to investors", pt: "Repasse aos investidores" })}</td>
                      <td className="num py-2 pr-4 text-right">{t.kind === "payout"
                        ? tr({
                          en: `${usdc(t.inflow_micro_usdc)} in, ${usdc(t.outflow_micro_usdc)} out`,
                          pt: `${usdc(t.inflow_micro_usdc)} entrada, ${usdc(t.outflow_micro_usdc)} saída`,
                        })
                        : usdc(t.outflow_micro_usdc)}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{shortDate(t.at)}</td>
                      <td className="py-2"><ExplorerLink tx={t.signature} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {s.zcash && (
          <Panel title={tr({ en: "Zcash treasury", pt: "Tesouraria Zcash" })}
            description={tr({
              en: "Payments to EmpowerFI's shielded address, as its viewing key reads them. The viewing key is disclosed to auditors only; each note's transaction is public, its amount and memo are not, so the amounts here come from the auditor's view.",
              pt: "Pagamentos ao endereço blindado da EmpowerFI, como a chave de visualização os lê. A chave de visualização é revelada só aos auditores; a transação de cada nota é pública, o valor e o memo não, então os valores aqui vêm da visão do auditor.",
            })}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <Row label={tr({ en: "Network", pt: "Rede" })}>{s.zcash.network === "test" ? "Zcash testnet" : "Zcash mainnet"}</Row>
              <Row label={tr({ en: "Received", pt: "Recebido" })}>
                {tr({ en: `${zec(s.zcash.received_zat)} in ${s.zcash.receipts.length} notes`, pt: `${zec(s.zcash.received_zat)} em ${s.zcash.receipts.length} notas` })}
              </Row>
              <Row label={tr({ en: "Address", pt: "Endereço" })}><span className="break-all font-mono text-xs">{short(s.zcash.address)}</span></Row>
              <Row label={tr({ en: "Read up to block", pt: "Lida até o bloco" })}>
                {s.zcash.scanned_height ?? "—"} · {tr({
                  en: `${s.zcash.confirmations_needed} confirmations needed`,
                  pt: `${s.zcash.confirmations_needed} confirmações necessárias`,
                })}
              </Row>
            </div>
            <ul className="divide-y divide-border text-sm">
              {s.zcash.receipts.map((r) => (
                <li key={`${r.txid}-${r.pool}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={zcashExplorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                    {short(r.txid)} <ExternalLink size={11} />
                  </a>
                  <span className="text-xs text-muted-foreground">{r.pool} · {tr({ en: "block", pt: "bloco" })} {r.height}</span>
                  <span className="num">{zec(r.value_zat)}</span>
                  {r.credited && r.credit_signature ? <span className="text-xs">{tr({ en: "credited", pt: "creditado" })} · <ExplorerLink tx={r.credit_signature} /></span>
                    : <StatusPill tone="neutral" dot={false}>{tr({ en: "not an allocation", pt: "não é uma alocação" })}</StatusPill>}
                </li>
              ))}
            </ul>
            {(s.zcash.returns ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{tr({ en: "Paid back in ZEC", pt: "Devolvido em ZEC" })}</p>
                <ul className="divide-y divide-border text-sm">
                  {s.zcash.returns.map((r) => (
                    <li key={r.txid} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <a href={zcashExplorerTx(r.txid)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
                        {short(r.txid)} <ExternalLink size={11} />
                      </a>
                      <span className="text-xs text-muted-foreground">{r.kind === "refund" ? tr({ en: "refund", pt: "reembolso" }) : tr({ en: "instalment share", pt: "parte da parcela" })} · {shortDate(r.sent_at)}</span>
                      <span className="num">{zec(r.amount_zat)} <span className="text-xs text-muted-foreground">({usdc(r.amount_micro_usdc)})</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        )}

        {s.proofs.length > 0 && <Panel title={tr({ en: `Latest ${s.proofs.length} proofs`, pt: `As ${s.proofs.length} provas mais recentes` })}
          description={tr({
            en: "Each by its kind, its commitment, the account that holds it and the transaction that wrote it. What each commitment is a hash of stays with EmpowerFI; the auditor can open it, you can check it exists.",
            pt: "Cada uma com seu tipo, seu compromisso, a conta que o guarda e a transação que o gravou. O conteúdo por trás de cada hash fica com a EmpowerFI; o auditor pode abri-lo, você pode conferir que ele existe.",
          })}>
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Kind", pt: "Tipo" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Commitment", pt: "Compromisso" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Account", pt: "Conta" })}</th>
                  <th className="py-2 pr-4 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                  <th className="py-2 font-medium">{tr({ en: "Confirmed", pt: "Confirmada" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.proofs.map((p) => {
                  const bad = recheck.data?.proofs.problems.find((x) => x.signature === p.signature);
                  return (
                    <tr key={p.signature}>
                      <td className="py-2 pr-4 text-foreground">
                        {PROOF_KIND_LABEL[p.kind as AnchorKind] ?? p.kind}
                        {recheck.data && (bad ? <XCircle size={13} className="ml-1.5 inline text-alert" aria-label={proofIssue(bad.issue)} /> : <CheckCircle2 size={13} className="ml-1.5 inline text-positive" aria-label={tr({ en: "Found on chain", pt: "Encontrada na blockchain" })} />)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground" title={p.commitment ?? undefined}>{p.commitment ? short(p.commitment) : "—"}</td>
                      <td className="py-2 pr-4">{p.account ? <ExplorerLink address={p.account} /> : "—"}</td>
                      <td className="py-2 pr-4"><ExplorerLink tx={p.signature} /></td>
                      <td className="py-2 text-xs text-muted-foreground">{shortDate(p.confirmed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>}

        <Panel title={tr({ en: "What this report leaves out, on purpose", pt: "O que este relatório deixa de fora, de propósito" })}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{tr({
              en: "No participant's name, business, community membership or code, and none of her figures.",
              pt: "Nenhum nome, negócio, comunidade ou código de participante, e nenhum dos números dela.",
            })}</li>
            <li>{tr({
              en: "No investor's identity or wallet; deposits appear by transaction only, never with what they fund.",
              pt: "Nenhuma identidade ou carteira de investidor; os depósitos aparecem só pela transação, nunca com o que financiam.",
            })}</li>
            <li>{tr({
              en: "No record behind a commitment, and no Zcash viewing key or memo. An auditor opens those in the console.",
              pt: "Nenhum registro por trás de um compromisso, e nenhuma chave de visualização ou memo da Zcash. Um auditor os abre no console.",
            })}</li>
            <li>{tr({
              en: "Nothing here is a promise of return or a credit approval: it is a devnet demonstration with simulated data.",
              pt: "Nada aqui é promessa de retorno ou aprovação de crédito: é uma demonstração na devnet com dados simulados.",
            })}</li>
          </ul>
        </Panel>
      </main>
    </div>
  );
}
