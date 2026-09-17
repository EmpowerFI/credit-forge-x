import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { poolOf, REASON, type AllocationReason } from "../../lib/capital";
import { percent } from "../../lib/credit";
import { FUNDING_LABEL, type MarketRow, RISK, title } from "../../lib/investor";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import FundingBar from "./FundingBar";
import { useMandate, useMarket } from "./queries";
import { MANDATE_CHECK_LABEL, mandateChecks, matchesMandate } from "../../lib/mandate";

type Filter = { mandate: string; route: string; risk: string; purpose: string; term: string; amount: string; status: string };
const ALL: Filter = { mandate: "fit", route: "all", risk: "all", purpose: "all", term: "all", amount: "all", status: "raising" };

const matches = (o: MarketRow, f: Filter) => {
  const reais = o.amount_cents / 100;
  return (
    (f.route === "all" || o.funding_pool === f.route) &&
    (f.risk === "all" || o.risk_band === f.risk) &&
    (f.purpose === "all" || o.purpose === f.purpose) &&
    (f.term === "all" || (f.term === "short" ? o.term_months <= 6 : f.term === "mid" ? o.term_months > 6 && o.term_months <= 12 : o.term_months > 12)) &&
    (f.amount === "all" || (f.amount === "small" ? reais < 2500 : f.amount === "mid" ? reais >= 2500 && reais < 5000 : reais >= 5000)) &&
    (f.status === "all" || (f.status === "raising" ? ["open", "partially_funded"].includes(o.funding_status) : o.funding_status === f.status))
  );
};

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[9rem] gap-2 border-border bg-secondary text-sm" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span> <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Opportunities() {
  const market = useMarket();
  const [filter, setFilter] = useState<Filter>(ALL);
  const set = (k: keyof Filter) => (v: string) => setFilter((f) => ({ ...f, [k]: v }));
  const mandate = useMandate();
  const m = mandate.data ?? null;
  const rows = useMemo(
    () => (market.data ?? []).filter((o) => matches(o, filter) && (filter.mandate === "all" || matchesMandate(m, o))),
    [market.data, filter, m],
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Investor Console", pt: "Console do Investidor" })}
        title={tr({ en: "Qualified P2P opportunities", pt: "Oportunidades P2P qualificadas" })}
        description={tr({
          en: "Each one exists only after readiness, her own request for capital and EmpowerFI's eligibility check. The Capital Allocation Engine then assigns it a funding route: Domestic P2P in reais, or Global P2P in USDC. Returns are simulated; nothing here is a promise of return.",
          pt: "Cada uma só existe depois da prontidão, do pedido de crédito feito por ela e da verificação de elegibilidade da EmpowerFI. Depois, o Motor de Alocação de Capital define a rota de captação: P2P Doméstico em reais ou P2P Global em USDC. Os retornos são simulados; nada aqui é promessa de retorno.",
        })} />

      <div className="flex flex-wrap gap-2">
        {m && (
          <FilterSelect label={tr({ en: "Mandate", pt: "Mandato" })} value={filter.mandate} onChange={set("mandate")}
            options={[["fit", tr({ en: `Fits ${m.label ?? "my mandate"}`, pt: `Cabe em ${m.label ?? "meu mandato"}` })], ["all", tr({ en: "All opportunities", pt: "Todas as oportunidades" })]]} />
        )}
        <FilterSelect label={tr({ en: "Route", pt: "Rota" })} value={filter.route} onChange={set("route")}
          options={[["all", tr({ en: "Both", pt: "As duas" })], ["domestic", tr({ en: "Domestic / Pix", pt: "Doméstica / Pix" })], ["global", tr({ en: "Global / USDC", pt: "Global / USDC" })]]} />
        <FilterSelect label={tr({ en: "Status", pt: "Status" })} value={filter.status} onChange={set("status")}
          options={[["raising", tr({ en: "Raising", pt: "Captando" })], ["funded", tr({ en: "Funded", pt: "Captadas" })], ["all", tr({ en: "All", pt: "Todas" })]]} />
        <FilterSelect label={tr({ en: "Risk", pt: "Risco" })} value={filter.risk} onChange={set("risk")}
          options={[["all", tr({ en: "All", pt: "Todos" })], ["LOW", tr({ en: "A · lower", pt: "A · menor" })], ["MEDIUM", tr({ en: "B · moderate", pt: "B · moderado" })], ["HIGH", tr({ en: "C · higher", pt: "C · maior" })]]} />
        <FilterSelect label={tr({ en: "Purpose", pt: "Finalidade" })} value={filter.purpose} onChange={set("purpose")}
          options={[["all", tr({ en: "All", pt: "Todas" })], ...Object.entries(PURPOSE_LABEL)] as [string, string][]} />
        <FilterSelect label={tr({ en: "Term", pt: "Prazo" })} value={filter.term} onChange={set("term")}
          options={[["all", tr({ en: "All", pt: "Todos" })], ["short", tr({ en: "Up to 6 months", pt: "Até 6 meses" })], ["mid", tr({ en: "7–12 months", pt: "7 a 12 meses" })], ["long", tr({ en: "Over 12 months", pt: "Mais de 12 meses" })]]} />
        <FilterSelect label={tr({ en: "Amount", pt: "Valor" })} value={filter.amount} onChange={set("amount")}
          options={[["all", tr({ en: "All", pt: "Todos" })], ["small", tr({ en: "Under R$ 2,500", pt: "Abaixo de R$ 2.500" })], ["mid", tr({ en: "R$ 2,500–5,000", pt: "R$ 2.500 a 5.000" })], ["large", tr({ en: "R$ 5,000 and up", pt: "R$ 5.000 ou mais" })]]} />
      </div>

      {market.isPending && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl bg-card" />)}</div>
      )}
      {market.isError && <LoadError error={market.error} onRetry={() => market.refetch()} />}
      {market.data && rows.length === 0 && (
        <p className="panel p-8 text-center text-sm text-muted-foreground">{filter.mandate === "fit" && m
          ? tr({ en: "No opportunity raising now fits your mandate and these filters. Show all opportunities to see the rest.", pt: "Nenhuma oportunidade captando agora cabe no seu mandato e nesses filtros. Mostre todas para ver as demais." })
          : tr({ en: "No opportunity matches these filters.", pt: "Nenhuma oportunidade corresponde a esses filtros." })}</p>
      )}

      <ul className="space-y-3">
        {rows.map((o) => {
          const risk = RISK[o.risk_band];
          const pool = poolOf(o.funding_pool);
          const lead = (o.allocation_reason_codes ?? [])[0] as AllocationReason | undefined;
          const outside = m ? mandateChecks(m, o).filter((c) => !c.passed) : [];
          const proofs = (o.proofs as { status: string }[] | null) ?? [];
          const proven = proofs.filter((p) => p.status === "confirmed").length;
          return (
            <li key={o.opportunity_id} className="panel grid gap-5 p-5 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto] lg:items-center">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-lg font-bold text-foreground">{title(o.purpose, o.business_sector)}</h2>
                  <StatusPill tone={FUNDING_LABEL[o.funding_status].tone}>{FUNDING_LABEL[o.funding_status].label}</StatusPill>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-mono">{o.code}</span> · <MapPin size={12} /> {o.community_name}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <PoolPill pool={pool} />
                  {lead && <span>{REASON[lead].label}</span>}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  {m && (outside.length === 0
                    ? <StatusPill tone="positive" dot={false}><Target size={11} className="mr-1 inline" aria-hidden />{tr({ en: "Fits your mandate", pt: "Cabe no seu mandato" })}</StatusPill>
                    : <StatusPill tone="neutral" dot={false}>{tr({ en: "Outside mandate: ", pt: "Fora do mandato: " })}{outside.map((c) => MANDATE_CHECK_LABEL[c.id]).join(", ")}</StatusPill>)}
                  {proofs.length > 0 && (
                    <span className={`inline-flex items-center gap-1 ${proven === proofs.length ? "text-positive" : "text-muted-foreground"}`}>
                      <BadgeCheck size={12} aria-hidden />
                      {tr({ en: `${proven} of ${proofs.length} proofs on Solana`, pt: `${proven} de ${proofs.length} provas na Solana` })}
                    </span>
                  )}
                </p>
                <FundingBar funded={o.funded_micro_usdc} target={o.funding_target_micro_usdc} investors={o.investors}
                  pool={pool} fxMilli={o.fx_brl_per_usdc_milli} amountCents={o.amount_cents} />
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-primary">{money(o.amount_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  {pool === "global" ? `${usdc(o.funding_target_micro_usdc, 0)} · ` : ""}{tr({ en: `Term ${o.term_months} mo`, pt: `Prazo de ${o.term_months} meses` })}
                </p>
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-foreground">{percent(o.indicative_yield_bps)}</p>
                <p className="text-xs text-muted-foreground">{tr({ en: "Expected return · simulated", pt: "Retorno esperado · simulado" })}</p>
              </div>
              <div>
                <p className={`font-heading text-xl font-bold text-${risk.tone}`}>{tr({ en: "Risk", pt: "Risco" })} {risk.grade}</p>
                <p className="text-xs text-muted-foreground">{tr({ en: "Readiness", pt: "Prontidão" })} {o.readiness_score ?? "—"}</p>
                {o.affordability_bps !== null && (
                  <p className="text-xs text-muted-foreground">{tr({ en: `Instalment ${percent(o.affordability_bps)} of result`, pt: `Parcela ${percent(o.affordability_bps)} do resultado` })}</p>
                )}
              </div>
              <Button asChild className="gap-2 lg:justify-self-end">
                <Link to={`/app/investor/opportunities/${o.opportunity_id}`}>{tr({ en: "View opportunity", pt: "Ver oportunidade" })} <ArrowRight size={16} /></Link>
              </Button>
            </li>
          );
        })}
      </ul>

      <p className="panel px-5 py-3 text-xs text-muted-foreground">
        {tr({
          en: <>
            <span className="font-semibold text-foreground">Routing principle:</span> each opportunity goes to domestic P2P or global USDC by cost,
            availability, mandate and risk appetite. Either way she receives and repays in reais, by Pix, and EmpowerFI's P2P desk
            formalises and services the loan.
          </>,
          pt: <>
            <span className="font-semibold text-foreground">Princípio de roteamento:</span> cada oportunidade vai para o P2P doméstico ou para o
            USDC global por custo, disponibilidade, mandato e apetite a risco. Nos dois casos, ela recebe e paga em reais, por Pix, e a mesa P2P
            da EmpowerFI formaliza o empréstimo e acompanha os pagamentos.
          </>,
        })}
      </p>
    </div>
  );
}
