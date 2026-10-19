import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Loader2, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../components/LoadError";
import Panel from "../components/product/Panel";
import { formatDateTime, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import { money } from "../lib/readiness";
import {
  checkPassport, type CheckedMonth, fetchPassport, PassportUnavailable, passportIssuer, type SharedPassport,
} from "../lib/passport";

const LABEL: Record<string, { en: string; pt: string }> = {
  revenue_cents: { en: "Sales", pt: "Vendas" },
  business_expenses_cents: { en: "Business expenses", pt: "Gastos do negócio" },
  business_balance_cents: { en: "Business balance (sales minus expenses, not a profit)", pt: "Saldo do negócio (vendas menos gastos, não é lucro)" },
  days_kept: { en: "Days recorded", pt: "Dias registrados" },
  selling_days: { en: "Days with sales", pt: "Dias com venda" },
  receivable_cents: { en: "Receivable", pt: "A receber" },
  payable_cents: { en: "Payable", pt: "A pagar" },
  withdrawals_cents: { en: "Withdrawals for the household", pt: "Retiradas para casa" },
  financing_cents: { en: "Debt instalments", pt: "Parcelas de dívida" },
};
const ORDER = Object.keys(LABEL);
const PURPOSE: Record<string, { en: string; pt: string }> = {
  credit_offer: { en: "review and decide on a credit offer for her", pt: "analisar e decidir uma oferta de crédito para ela" },
};

const day = (iso: string) => formatDateTime(iso, { day: "2-digit", month: "short", year: "numeric" });
const monthName = (period: string) => {
  const name = formatDateTime(`${period}-15T12:00:00Z`, { month: "long", year: "numeric", timeZone: "UTC" });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

function Check({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      {ok === null ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" aria-hidden />
        : ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" aria-hidden />
        : <XCircle size={16} className="mt-0.5 shrink-0 text-alert" aria-hidden />}
      <span className="text-foreground">{children}</span>
    </p>
  );
}

function Month({ m }: { m: CheckedMonth }) {
  const shown = m.month?.disclosed ?? {};
  const daysInPeriod = Number(m.month?.subject.daysInPeriod ?? 0);
  return (
    <Panel title={monthName(m.period)}
      description={tr({ en: `Version ${m.version} of this month's record`, pt: `Versão ${m.version} do registro deste mês` })}>
      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <dl className="divide-y divide-border text-sm">
          {ORDER.filter((k) => k in shown).map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{tr(LABEL[k])}</dt>
              <dd className="num text-right font-medium text-foreground">
                {k.endsWith("_cents") ? money(Number(shown[k]))
                  : k === "days_kept" ? `${shown[k]} / ${daysInPeriod}` : String(shown[k])}
              </dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2">
          <Check ok={m.signature === "valid"}>
            {m.signature === "valid"
              ? tr({ en: "Signed by EmpowerFI, unchanged", pt: "Assinado pela EmpowerFI, sem alteração" })
              : tr({ en: `Signature does not verify: ${m.error ?? ""}`, pt: `A assinatura não confere: ${m.error ?? ""}` })}
          </Check>
          <Check ok={m.status === "active" ? true : m.status === "unknown" ? null : false}>
            {m.status === "active" ? tr({ en: "Not revoked", pt: "Não revogado" })
              : m.status === "revoked"
                ? m.superseded
                  ? tr({
                    en: "Revoked: this month was corrected after she authorised the share. Seeing the corrected version needs a new authorisation from her.",
                    pt: "Revogado: este mês foi corrigido depois da autorização. Ver a versão corrigida exige uma nova autorização dela.",
                  })
                  : tr({ en: "Revoked", pt: "Revogado" })
                : tr({ en: "Revocation could not be checked just now", pt: "Não foi possível consultar a revogação agora" })}
          </Check>
          <Check ok={m.time === "current"}>
            {m.time === "current" ? tr({ en: "Within its validity", pt: "Dentro da validade" }) : tr({ en: "Outside its validity", pt: "Fora da validade" })}
          </Check>
          <Check ok={null}>
            {tr({
              en: "Self-declared: her own daily records, not checked against an independent source.",
              pt: "Declarado por ela: os registros diários dela, não conferidos com uma fonte independente.",
            })}
          </Check>
        </div>
      </div>
    </Panel>
  );
}

function download(p: SharedPassport) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `empowerfi-passport-${p.share.subject_ref}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * A Business Passport opened by the recipient's link: no account needed.
 * What shows is what she authorised, and each month is checked here, in this
 * browser, against EmpowerFI's published keys and revocation list.
 */
export default function PassportPage() {
  const { token = "" } = useParams();
  const passport = useQuery({ queryKey: ["passport", token], queryFn: () => fetchPassport(token), retry: false, staleTime: Infinity });
  const checks = useQuery({
    queryKey: ["passport-checks", token],
    queryFn: () => checkPassport(passport.data!),
    enabled: Boolean(passport.data),
    retry: 1,
  });

  const header = (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <span className="hidden font-heading text-base font-semibold text-foreground sm:block">Business Passport</span>
        </div>
        <LanguageSwitch />
      </div>
    </header>
  );

  if (passport.isPending) {
    return <div className="min-h-screen bg-background">{header}<main className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6"><Skeleton className="h-24" /><Skeleton className="h-72" /></main></div>;
  }
  if (passport.isError) {
    const reason = passport.error instanceof PassportUnavailable ? passport.error.reason : "error";
    const why = {
      not_found: tr({ en: "The link is wrong, or a newer link replaced it. Ask EmpowerFI for the current one.", pt: "O link está errado, ou um link mais novo o substituiu. Peça o atual à EmpowerFI." }),
      expired: tr({ en: "The period she authorised has ended.", pt: "O prazo que ela autorizou terminou." }),
      ended: tr({ en: "She ended this authorisation.", pt: "Ela encerrou esta autorização." }),
      not_configured: tr({ en: "This site is not set up to open passports.", pt: "Este site não está configurado para abrir passaportes." }),
    }[reason as string];
    return (
      <div className="min-h-screen bg-background">{header}
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          {why ? (
            <Panel title={tr({ en: "This passport is not available", pt: "Este passaporte não está disponível" })}>
              <p className="text-sm text-muted-foreground">{why}</p>
            </Panel>
          ) : <LoadError error={passport.error} onRetry={() => passport.refetch()} />}
        </main>
      </div>
    );
  }

  const p = passport.data;
  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">EmpowerFI · Business Passport</p>
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{p.share.subject_ref}</h1>
            <p className="text-sm text-muted-foreground">
              {tr({
                en: `Shared with ${p.share.recipient}, to ${PURPOSE[p.share.purpose]?.en ?? p.share.purpose}. Authorised by her on ${day(p.share.authorised_at)}, until ${day(p.share.expires_at)}.`,
                pt: `Compartilhado com ${p.share.recipient}, para ${PURPOSE[p.share.purpose]?.pt ?? p.share.purpose_text}. Autorizado por ela em ${day(p.share.authorised_at)}, até ${day(p.share.expires_at)}.`,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "A code stands in for her name. Her name, phone and ID number are not shared, nor any single sale or expense. To make an offer, contact EmpowerFI.",
                pt: "Um código substitui o nome dela. Nome, telefone e CPF não são compartilhados, nem cada venda ou gasto. Para fazer uma oferta, fale com a EmpowerFI.",
              })}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => download(p)}><Download size={15} aria-hidden /> JSON</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer size={15} aria-hidden /> {tr({ en: "Print or save as PDF", pt: "Imprimir ou salvar em PDF" })}</Button>
          </div>
        </div>

        {checks.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden /> {tr({ en: "Checking each month's signature and status…", pt: "Conferindo a assinatura e a situação de cada mês…" })}</p>
        ) : checks.isError ? (
          <LoadError error={checks.error} onRetry={() => checks.refetch()} />
        ) : checks.data.map((m) => <Month key={`${m.period}-${m.version}`} m={m} />)}

        <Panel folded title={tr({ en: "Verify it with your own tools", pt: "Verifique com as suas próprias ferramentas" })}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {tr({
                en: "Each month is a W3C Verifiable Credential (Data Model 2.0) secured with SD-JWT (typ vc+sd-jwt, ES256). Only the indicators she authorised are disclosed. Revocation is a W3C Bitstring Status List. The JSON download holds every presentation exactly as served.",
                pt: "Cada mês é uma Credencial Verificável W3C (Data Model 2.0) protegida com SD-JWT (typ vc+sd-jwt, ES256). Só os indicadores que ela autorizou são revelados. A revogação é uma Bitstring Status List W3C. O JSON baixado traz cada apresentação exatamente como foi servida.",
              })}
            </p>
            <p className="break-all font-mono text-xs">{tr({ en: "Issuer", pt: "Emissor" })}: {passportIssuer}</p>
            <p className="break-all font-mono text-xs">{tr({ en: "Public keys", pt: "Chaves públicas" })}: {passportIssuer}/jwks</p>
            <p className="break-all font-mono text-xs">{tr({ en: "Revocation list", pt: "Lista de revogação" })}: {passportIssuer}/status/1</p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
