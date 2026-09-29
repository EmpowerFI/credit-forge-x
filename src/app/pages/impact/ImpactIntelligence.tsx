import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ArrowRight, BadgeCheck, BarChart3, CalendarRange, ChevronRight, Download, FileText, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { formatDate, formatDateTime, formatNumber, localized, tr } from "../../i18n";
import { bpsPercent } from "../../lib/capital";
import { fetchImpactIntelligence, fetchPrograms, type ImpactIntelligence as Data } from "../../lib/impact";
import { money, monthLabel } from "../../lib/readiness";
import { Evidence, Funnel, Mobilisation, Opportunities, Operators, Outcomes, Segments } from "./parts";

const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber(Math.round((part / whole) * 100))}%` : "—");

const SPONSOR_KIND: Record<Data["sponsor"]["kind"], () => string> = {
  company: () => tr({ en: "Company ESG program", pt: "Programa ESG de empresa" }),
  foundation: () => tr({ en: "Foundation", pt: "Fundação" }),
  impact_fund: () => tr({ en: "Impact fund", pt: "Fundo de impacto" }),
};

/**
 * An auditable report of the program, from the same live read: the figures,
 * the proofs a reader can check on Solana devnet without EmpowerFI, and how
 * they were computed. JSON to keep, or the page printed to PDF.
 */
function downloadReport(data: Data) {
  const report = {
    report: "EmpowerFI Impact Intelligence — sponsor report",
    generated_at: new Date().toISOString(),
    method: {
      source: "impact_intelligence() on the EmpowerFI platform database, computed at the time of generation",
      privacy: "aggregates only; groups under five hidden; outcomes only where the business consented to impact reporting",
      outcomes: "observed association before and after each loan, not causal impact",
      verification: "each proof's commitment can be checked on Solana devnet against the EmpowerFI audit program",
      simulated: data.program.is_simulated || data.sponsor.is_simulated ? "demo program: sponsor, budget and businesses are simulated" : null,
    },
    ...data,
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `empowerfi-impact-report-${data.program.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function Header({ data }: { data: Data }) {
  const e = data.evidence;
  return (
    <div className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Sponsor", pt: "Patrocinador" })}</p>
        <p className="font-semibold text-foreground">{data.sponsor.name}</p>
        <p className="text-xs text-muted-foreground">{SPONSOR_KIND[data.sponsor.kind]()}</p>
      </div>
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Users size={12} aria-hidden />{tr({ en: "Run by", pt: "Conduzido por" })}</p>
        <p className="font-semibold text-foreground">{tr({ en: `${data.communities.length} communities`, pt: `${data.communities.length} comunidades` })}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{data.communities.map((c) => c.city).filter(Boolean).join(" · ")}</p>
      </div>
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><CalendarRange size={12} aria-hidden />{tr({ en: "Reporting period", pt: "Período de reporte" })}</p>
        <p className="font-semibold text-foreground">{formatDate(`${data.program.period_start}T12:00:00`)} – {formatDate(`${data.program.period_end}T12:00:00`)}</p>
        {data.as_of_period && <p className="text-xs text-muted-foreground">{tr({ en: `Latest month reported: ${monthLabel(data.as_of_period)}`, pt: `Último mês informado: ${monthLabel(data.as_of_period)}` })}</p>}
      </div>
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><BadgeCheck size={12} aria-hidden />{tr({ en: "Proof status", pt: "Situação das provas" })}</p>
        <p className="num font-semibold text-foreground">
          {e.confirmed > 0
            ? tr({ en: `${formatNumber(e.confirmed)} confirmed on Solana`, pt: `${formatNumber(e.confirmed)} confirmadas na Solana` })
            : tr({ en: `${formatNumber(e.total)} proofs recorded`, pt: `${formatNumber(e.total)} provas registradas` })}
        </p>
        <p className="text-xs text-muted-foreground">
          {e.mismatches > 0
            ? <span className="text-alert">{tr({ en: `${e.mismatches} not matching their proof`, pt: `${e.mismatches} sem bater com a prova` })}</span>
            : e.pending > 0
              ? tr({ en: `${formatNumber(e.pending)} confirming on devnet`, pt: `${formatNumber(e.pending)} confirmando na devnet` })
              : e.last_confirmed_at ? tr({ en: `Last anchored ${formatDateTime(e.last_confirmed_at)}`, pt: `Última registrada em ${formatDateTime(e.last_confirmed_at)}` }) : null}
        </p>
      </div>
    </div>
  );
}

/** What waits on the sponsor, if anything does. Each line is a place to go. */
function NextActions({ data }: { data: Data }) {
  const toMeasure = data.hero.loans_disbursed - data.hero.outcomes_measured;
  const items = [
    data.capital.waiting_for_capital > 0 && {
      key: "waiting", to: "/app/capital/engine", tone: "caution" as const,
      text: tr({
        en: `${data.capital.waiting_for_capital} qualified ${data.capital.waiting_for_capital === 1 ? "opportunity waits" : "opportunities wait"} for a pool that can fund them`,
        pt: `${data.capital.waiting_for_capital} ${data.capital.waiting_for_capital === 1 ? "oportunidade qualificada aguarda" : "oportunidades qualificadas aguardam"} um pool que possa financiá-las`,
      }),
      action: tr({ en: "Run the engine", pt: "Rodar o motor" }),
    },
    toMeasure > 0 && {
      key: "outcomes", to: "#outcomes", tone: "info" as const,
      text: tr({
        en: `${toMeasure} of ${data.hero.loans_disbursed} loans have no measured outcome yet`,
        pt: `${toMeasure} de ${data.hero.loans_disbursed} empréstimos ainda sem resultado medido`,
      }),
      action: tr({ en: "See outcomes", pt: "Ver resultados" }),
    },
    data.evidence.mismatches > 0 ? {
      key: "mismatch", to: "#evidence", tone: "alert" as const,
      text: tr({ en: `${data.evidence.mismatches} records do not match their proof`, pt: `${data.evidence.mismatches} registros não batem com a prova` }),
      action: tr({ en: "Check the evidence", pt: "Conferir a evidência" }),
    } : data.evidence.pending > 0 && {
      key: "pending", to: "#evidence", tone: "info" as const,
      text: tr({ en: `${formatNumber(data.evidence.pending)} proofs are confirming on devnet`, pt: `${formatNumber(data.evidence.pending)} provas estão confirmando na devnet` }),
      action: tr({ en: "See the evidence", pt: "Ver a evidência" }),
    },
  ].filter(Boolean) as { key: string; to: string; tone: "caution" | "info" | "alert"; text: string; action: string }[];

  if (items.length === 0) return null;
  return (
    <section className="panel space-y-3 p-5" aria-labelledby="next-actions">
      <h2 id="next-actions" className="font-heading text-base font-bold text-foreground">{tr({ en: "What waits on you", pt: "O que espera por você" })}</h2>
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="flex items-center gap-2.5 text-sm text-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-full",
                item.tone === "alert" ? "bg-alert" : item.tone === "caution" ? "bg-caution" : "bg-info")} aria-hidden />
              {item.text}
            </span>
            <Link to={item.to} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-foreground">
              {item.action} <ArrowRight size={14} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One figure the sponsor came for, three that frame it, and the rest on request. */
function Headline({ data }: { data: Data }) {
  const h = data.hero;
  const p = data.program;
  const coverage = data.capital.domestic_coverage_bps + data.capital.global_coverage_bps;
  return (
    <section className="space-y-3">
      <div className="panel grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-center">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr({ en: "Capital mobilised for the businesses", pt: "Capital mobilizado para os negócios" })}</p>
          <p className="num font-heading text-4xl font-bold text-foreground sm:text-5xl">{money(h.capital_mobilized_cents)}</p>
          <div className="h-2 overflow-hidden rounded-full bg-secondary" role="img"
            aria-label={tr({ en: `${bpsPercent(coverage)} of qualified demand`, pt: `${bpsPercent(coverage)} da demanda qualificada` })}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, coverage / 100)}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: <><span className="font-semibold text-foreground">{bpsPercent(coverage)}</span> of {money(data.capital.eligible_cents)} in qualified demand, from {h.requested} requests.</>,
              pt: <><span className="font-semibold text-foreground">{bpsPercent(coverage)}</span> de {money(data.capital.eligible_cents)} de demanda qualificada, a partir de {h.requested} pedidos.</>,
            })}
          </p>
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {tr({
              en: <>Program funding: <span className="font-semibold text-foreground">{money(p.funding_deployed_cents)}</span> deployed of {money(p.funding_committed_cents)} committed.</>,
              pt: <>Recursos do programa: <span className="font-semibold text-foreground">{money(p.funding_deployed_cents)}</span> aplicados de {money(p.funding_committed_cents)} comprometidos.</>,
            })}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label={tr({ en: "Entrepreneurs reached", pt: "Empreendedoras alcançadas" })} value={formatNumber(h.reached)}
            hint={tr({ en: `${pct(h.reporting, h.reached)} reported the latest month`, pt: `${pct(h.reporting, h.reached)} informaram o último mês` })} hintTone="positive" />
          <StatTile label={tr({ en: "Credit ready", pt: "Prontas para crédito" })} value={formatNumber(h.credit_ready)}
            hint={tr({ en: `${pct(h.credit_ready, h.reached)} of those reached`, pt: `${pct(h.credit_ready, h.reached)} das alcançadas` })} hintTone="info" />
          <StatTile label={tr({ en: "Outcomes measured", pt: "Resultados medidos" })} value={`${h.outcomes_measured} / ${h.loans_disbursed}`}
            hint={tr({ en: "of the loans lent", pt: "dos empréstimos concedidos" })} />
        </div>
      </div>

      <details className="panel px-5 py-3 [&[open]>summary>svg]:rotate-90">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-foreground">
          <ChevronRight size={14} className="text-accent transition-transform" aria-hidden />
          {tr({ en: "All the indicators", pt: "Todos os indicadores" })}
        </summary>
        <div className="grid grid-cols-2 gap-3 pt-4 lg:grid-cols-4">
          <StatTile label={tr({ en: "Program funding deployed", pt: "Recursos do programa aplicados" })} value={money(p.funding_deployed_cents)}
            hint={tr({ en: `${pct(p.funding_deployed_cents, p.funding_committed_cents)} of ${money(p.funding_committed_cents)}`, pt: `${pct(p.funding_deployed_cents, p.funding_committed_cents)} de ${money(p.funding_committed_cents)}` })} />
          <StatTile label={tr({ en: "Active and reporting", pt: "Ativas e reportando" })} value={formatNumber(h.reporting)}
            hint={tr({ en: `of ${h.reached} reached`, pt: `de ${h.reached} alcançadas` })} />
          <StatTile label={tr({ en: "Capital requested", pt: "Capital pedido" })} value={money(h.capital_requested_cents)}
            hint={tr({ en: `${h.requested} requests`, pt: `${h.requested} pedidos` })} />
          <StatTile label={tr({ en: "Repayment received", pt: "Pagamentos recebidos" })} value={money(data.portfolio.repaid_cents)}
            hint={tr({
              en: `${data.portfolio.loans_repaying + data.portfolio.loans_paid} performing · ${data.portfolio.loans_late + data.portfolio.loans_defaulted} late`,
              pt: `${data.portfolio.loans_repaying + data.portfolio.loans_paid} em dia · ${data.portfolio.loans_late + data.portfolio.loans_defaulted} em atraso`,
            })} hintTone={data.portfolio.loans_late + data.portfolio.loans_defaulted ? "caution" : "positive"} />
        </div>
      </details>
    </section>
  );
}

/** A long page needs a map: the sections, one click away. */
const SECTIONS: { id: string; label: string }[] = localized([
  { id: "funnel", label: { en: "Funnel", pt: "Funil" } },
  { id: "capital", label: { en: "Capital", pt: "Capital" } },
  { id: "outcomes", label: { en: "Outcomes", pt: "Resultados" } },
  { id: "opportunities", label: { en: "Opportunities", pt: "Oportunidades" } },
  { id: "evidence", label: { en: "Evidence", pt: "Evidência" } },
  { id: "segments", label: { en: "Segments", pt: "Segmentos" } },
]);

function SectionIndex() {
  return (
    <nav aria-label={tr({ en: "Sections", pt: "Seções" })}
      className="sticky top-[6.9rem] z-30 -mx-1 flex gap-2 overflow-x-auto rounded-xl bg-background/90 px-1 py-2 backdrop-blur">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`}
          className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export default function ImpactIntelligence() {
  const [params, setParams] = useSearchParams();
  const programs = useQuery({ queryKey: ["platform", "programs"], queryFn: fetchPrograms });
  const programId = params.get("program") ?? programs.data?.[0]?.id;
  const impact = useQuery({
    queryKey: ["platform", "impact-intelligence", programId],
    enabled: Boolean(programId),
    queryFn: () => fetchImpactIntelligence(programId!),
    refetchInterval: 30_000,
  });

  if (programs.isError) return <LoadError error={programs.error} onRetry={() => programs.refetch()} />;
  if (programs.data && programs.data.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
        {tr({ en: "No program to show yet.", pt: "Ainda não há programa para mostrar." })}
      </div>
    );
  }
  if (impact.isError) return <LoadError error={impact.error} onRetry={() => impact.refetch()} />;
  const data = impact.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tr({ en: "Impact Intelligence", pt: "Inteligência de Impacto" })}
        title={data?.program.name ?? <Skeleton className="h-9 w-72" />}
        meta={data?.program.is_simulated ? <StatusPill tone="caution" dot={false}>{tr({ en: "Simulated", pt: "Simulado" })}</StatusPill> : undefined}
        description={tr({
          en: "What the program bought, and how to check it.",
          pt: "O que o programa comprou, e como conferir.",
        })}
        about={tr({
          en: (
            <>
              <p>Every figure is an aggregate computed live from the platform's records: no name, no business and no figure a participant reported appears here. Groups under five are hidden, and outcomes count only the businesses that consented — the rest are reported as withheld.</p>
              <p>Proofs are real transactions on Solana devnet. The sponsor, its budget and the businesses are simulated.</p>
            </>
          ),
          pt: (
            <>
              <p>Cada número é um agregado calculado ao vivo a partir dos registros da plataforma: nenhum nome, nenhum negócio e nenhum valor informado por uma participante aparece aqui. Grupos com menos de cinco ficam ocultos, e os resultados contam apenas os negócios que consentiram — os demais são reportados como retidos.</p>
              <p>As provas são transações reais na devnet da Solana. O patrocinador, o orçamento e os negócios são simulados.</p>
            </>
          ),
        })}
        actions={
          <>
            {programs.data && programs.data.length > 1 && (
              <Select value={programId} onValueChange={(v) => setParams({ program: v })}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>{programs.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {programId && (
              <Button asChild variant="outline" className="gap-2">
                <Link to={`/app/capital/economics?program=${programId}`}><BarChart3 size={16} /> {tr({ en: "Cost to serve", pt: "Custo de servir" })}</Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button id="report" disabled={!data} className="scroll-mt-32 gap-2"><FileText size={16} /> {tr({ en: "Generate auditable report", pt: "Gerar relatório auditável" })}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onSelect={() => data && downloadReport(data)} className="items-start gap-3 py-2">
                  <Download size={16} className="mt-0.5" />
                  <span><span className="block text-sm">{tr({ en: "Download the report (JSON)", pt: "Baixar o relatório (JSON)" })}</span>
                    <span className="block text-xs text-muted-foreground">{tr({ en: "Figures, method and every proof listed, to check on Solana", pt: "Números, método e cada prova listada, para conferir na Solana" })}</span></span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.print()} className="items-start gap-3 py-2">
                  <Printer size={16} className="mt-0.5" />
                  <span><span className="block text-sm">{tr({ en: "Print or save as PDF", pt: "Imprimir ou salvar em PDF" })}</span>
                    <span className="block text-xs text-muted-foreground">{tr({ en: "This page, as it reads now", pt: "Esta página, como está agora" })}</span></span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}</div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Header data={data} />
          <NextActions data={data} />
          <Headline data={data} />
          <SectionIndex />
          <div className="grid gap-6 lg:grid-cols-5">
            <Funnel data={data} />
            <Mobilisation data={data} />
          </div>
          <Outcomes data={data} />
          <Opportunities data={data} />
          <Evidence data={data} />
          <Segments data={data} />
          <Operators data={data} />
        </>
      )}
    </div>
  );
}
