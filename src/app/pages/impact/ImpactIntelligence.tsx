import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, BarChart3, CalendarRange, Download, FileText, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { formatDate, formatDateTime, formatNumber, tr } from "../../i18n";
import { bpsPercent } from "../../lib/capital";
import { fetchImpactIntelligence, fetchPrograms, type ImpactIntelligence as Data } from "../../lib/impact";
import { money, monthLabel } from "../../lib/readiness";
import { Evidence, Funnel, Mobilisation, Opportunities, Operators, Outcomes, Segments, SimulatedNote } from "./parts";

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
        <p className="num font-semibold text-foreground">{tr({ en: `${formatNumber(e.confirmed)} of ${formatNumber(e.total)} on Solana`, pt: `${formatNumber(e.confirmed)} de ${formatNumber(e.total)} na Solana` })}</p>
        <p className="text-xs text-muted-foreground">
          {e.mismatches > 0
            ? <span className="text-alert">{tr({ en: `${e.mismatches} not matching their proof`, pt: `${e.mismatches} sem bater com a prova` })}</span>
            : e.pending > 0
              ? tr({ en: `${formatNumber(e.pending)} queued for devnet`, pt: `${formatNumber(e.pending)} na fila da devnet` })
              : e.last_confirmed_at ? tr({ en: `Last anchored ${formatDateTime(e.last_confirmed_at)}`, pt: `Última registrada em ${formatDateTime(e.last_confirmed_at)}` }) : null}
        </p>
      </div>
    </div>
  );
}

function Hero({ data }: { data: Data }) {
  const h = data.hero;
  const p = data.program;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label={tr({ en: "Program funding deployed", pt: "Recursos do programa aplicados" })} value={money(p.funding_deployed_cents)}
        hint={tr({ en: `${pct(p.funding_deployed_cents, p.funding_committed_cents)} of ${money(p.funding_committed_cents)}`, pt: `${pct(p.funding_deployed_cents, p.funding_committed_cents)} de ${money(p.funding_committed_cents)}` })} />
      <StatTile label={tr({ en: "Entrepreneurs reached", pt: "Empreendedoras alcançadas" })} value={formatNumber(h.reached)}
        hint={tr({ en: `${data.communities.length} communities`, pt: `${data.communities.length} comunidades` })} />
      <StatTile label={tr({ en: "Active and reporting", pt: "Ativas e reportando" })} value={formatNumber(h.reporting)}
        hint={tr({ en: `${pct(h.reporting, h.reached)} reported the latest month`, pt: `${pct(h.reporting, h.reached)} informaram o último mês` })} hintTone="positive" />
      <StatTile label={tr({ en: "Credit ready", pt: "Prontas para crédito" })} value={formatNumber(h.credit_ready)}
        hint={tr({ en: `${pct(h.credit_ready, h.reached)} of those reached`, pt: `${pct(h.credit_ready, h.reached)} das alcançadas` })} hintTone="info" />
      <StatTile label={tr({ en: "Capital requested", pt: "Capital pedido" })} value={money(h.capital_requested_cents)}
        hint={tr({ en: `${h.requested} requests`, pt: `${h.requested} pedidos` })} />
      <StatTile label={tr({ en: "Capital mobilised", pt: "Capital mobilizado" })} value={money(h.capital_mobilized_cents)}
        hint={tr({ en: `${bpsPercent(data.capital.domestic_coverage_bps + data.capital.global_coverage_bps)} of qualified demand`, pt: `${bpsPercent(data.capital.domestic_coverage_bps + data.capital.global_coverage_bps)} da demanda qualificada` })} hintTone="positive" />
      <StatTile label={tr({ en: "Repayment", pt: "Pagamentos" })} value={money(data.portfolio.repaid_cents)}
        hint={tr({
          en: `${data.portfolio.loans_repaying + data.portfolio.loans_paid} performing · ${data.portfolio.loans_late + data.portfolio.loans_defaulted} late`,
          pt: `${data.portfolio.loans_repaying + data.portfolio.loans_paid} em dia · ${data.portfolio.loans_late + data.portfolio.loans_defaulted} em atraso`,
        })} hintTone={data.portfolio.loans_late + data.portfolio.loans_defaulted ? "caution" : "positive"} />
      <StatTile label={tr({ en: "Outcome coverage", pt: "Cobertura de resultados" })} value={`${h.outcomes_measured} / ${h.loans_disbursed}`}
        hint={tr({ en: "loans with a measured outcome", pt: "empréstimos com resultado medido" })} />
    </div>
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
          en: "From program funding to business outcomes: measurable, traceable and auditable.",
          pt: "Do investimento no programa aos resultados dos negócios: mensurável, rastreável e auditável.",
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
          <SimulatedNote data={data} />
          <Hero data={data} />
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
