import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, MapPin, SlidersHorizontal, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { poolOf, REASON, type AllocationReason } from "../../lib/capital";
import { percent } from "../../lib/credit";
import { FUNDING_LABEL, type MarketRow, RISK, title } from "../../lib/investor";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import FundingBar from "./FundingBar";
import { useMandate, useMarket, useMarketElsewhere } from "./queries";
import { MANDATE_CHECK_LABEL, mandateChecks, matchesMandate } from "../../lib/mandate";

type Filter = { mandate: string; risk: string; purpose: string; term: string; amount: string; status: string };
const ALL: Filter = { mandate: "fit", risk: "all", purpose: "all", term: "all", amount: "all", status: "raising" };

const matches = (o: MarketRow, f: Filter) => {
  const reais = o.amount_cents / 100;
  return (
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
      {/* The label says what is being filtered and must stay whole; the chosen
          value is the part that may run out of room, so it truncates. */}
      <SelectTrigger className="h-9 w-auto min-w-[9rem] gap-2 border-border bg-secondary text-sm" aria-label={label}>
        <span className="shrink-0 text-muted-foreground">{label}:</span> <span className="truncate"><SelectValue /></span>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Opportunities() {
  const market = useMarket();
  const elsewhere = useMarketElsewhere();
  const [filter, setFilter] = useState<Filter>(ALL);
  const [moreFilters, setMoreFilters] = useState(false);
  // What the button has to answer: how many of the folded filters are on.
  const narrowed = (["risk", "purpose", "term", "amount"] as const).filter((k) => filter[k] !== ALL[k]).length;
  const set = (k: keyof Filter) => (v: string) => setFilter((f) => ({ ...f, [k]: v }));
  const mandate = useMandate();
  const m = mandate.data ?? null;
  const rows = useMemo(
    () => (market.data ?? []).filter((o) => matches(o, filter) && (filter.mandate === "all" || matchesMandate(m, o))),
    [market.data, filter, m],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        meta={<PageEvidence family="readiness_and_eligibility" />}
        eyebrow={tr({ en: "Investor Console", pt: "Console do Investidor" })}
        title={tr({ en: "Opportunities", pt: "Oportunidades" })}
        description={tr({
          en: "Qualified requests raising in USDC now. Returns are simulated; nothing here is a promise of return.",
          pt: "Pedidos qualificados captando em USDC agora. Os retornos são simulados; nada aqui é promessa de retorno.",
        })}
        about={tr({
          en: (
            <>
              <p>An opportunity exists only after readiness, her own request for capital, and an eligibility check. She appears by code, and only because she agreed to be shown to investors.</p>
              <p>You never hold reais and she never holds a dollar: the currency effect sits with the pool, priced into the hedge. Requests the engine routed to Brazilian capital are funded in reais by a domestic desk, and are not offered here.</p>
            </>
          ),
          pt: (
            <>
              <p>Uma oportunidade só existe depois da prontidão, do pedido de crédito feito por ela e da verificação de elegibilidade. Ela aparece por código, e só porque concordou em ser mostrada a investidores.</p>
              <p>Você nunca tem reais e ela nunca tem dólar: o efeito cambial fica com o pool, precificado no hedge. Os pedidos que o motor roteou para capital brasileiro são financiados em reais por uma mesa doméstica, e não são ofertados aqui.</p>
            </>
          ),
        })} />

      {/* "Mandate filters" in Your tools opens here, not at the top of the page. */}
      <div id="filters" className="scroll-mt-32 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {m && (
            <FilterSelect label={tr({ en: "Mandate", pt: "Mandato" })} value={filter.mandate} onChange={set("mandate")}
              options={[["fit", tr({ en: `Fits ${m.label ?? "my mandate"}`, pt: `Cabe em ${m.label ?? "meu mandato"}` })], ["all", tr({ en: "All opportunities", pt: "Todas as oportunidades" })]]} />
          )}
          <FilterSelect label={tr({ en: "Status", pt: "Status" })} value={filter.status} onChange={set("status")}
            options={[["raising", tr({ en: "Raising", pt: "Captando" })], ["funded", tr({ en: "Funded", pt: "Captadas" })], ["all", tr({ en: "All", pt: "Todas" })]]} />
          <Button variant={narrowed > 0 ? "secondary" : "outline"} className="h-9 gap-2" aria-expanded={moreFilters}
            onClick={() => setMoreFilters((v) => !v)}>
            <SlidersHorizontal size={15} aria-hidden />
            {narrowed > 0 ? tr({ en: `Filters · ${narrowed}`, pt: `Filtros · ${narrowed}` }) : tr({ en: "Filters", pt: "Filtros" })}
          </Button>
          {narrowed > 0 && (
            <button type="button" onClick={() => setFilter((f) => ({ ...ALL, mandate: f.mandate, status: f.status }))}
              className="text-xs font-medium text-accent hover:text-foreground">{tr({ en: "Clear", pt: "Limpar" })}</button>
          )}
          {market.data && (
            <p className="ml-auto text-sm text-muted-foreground">
              {tr({ en: `${rows.length} of ${market.data.length} opportunities`, pt: `${rows.length} de ${market.data.length} oportunidades` })}
            </p>
          )}
        </div>
        {moreFilters && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border p-3">
            <FilterSelect label={tr({ en: "Risk", pt: "Risco" })} value={filter.risk} onChange={set("risk")}
              options={[["all", tr({ en: "All", pt: "Todos" })], ["LOW", tr({ en: "A · lower", pt: "A · menor" })], ["MEDIUM", tr({ en: "B · moderate", pt: "B · moderado" })], ["HIGH", tr({ en: "C · higher", pt: "C · maior" })]]} />
            <FilterSelect label={tr({ en: "Purpose", pt: "Finalidade" })} value={filter.purpose} onChange={set("purpose")}
              options={[["all", tr({ en: "All", pt: "Todas" })], ...Object.entries(PURPOSE_LABEL)] as [string, string][]} />
            <FilterSelect label={tr({ en: "Term", pt: "Prazo" })} value={filter.term} onChange={set("term")}
              options={[["all", tr({ en: "All", pt: "Todos" })], ["short", tr({ en: "Up to 6 months", pt: "Até 6 meses" })], ["mid", tr({ en: "7–12 months", pt: "7 a 12 meses" })], ["long", tr({ en: "Over 12 months", pt: "Mais de 12 meses" })]]} />
            <FilterSelect label={tr({ en: "Amount", pt: "Valor" })} value={filter.amount} onChange={set("amount")}
              options={[["all", tr({ en: "All", pt: "Todos" })], ["small", tr({ en: "Under R$ 2,500", pt: "Abaixo de R$ 2.500" })], ["mid", tr({ en: "R$ 2,500–5,000", pt: "R$ 2.500 a 5.000" })], ["large", tr({ en: "R$ 5,000 and up", pt: "R$ 5.000 ou mais" })]]} />
          </div>
        )}
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
                  <h2 className="font-heading font-mono text-lg font-bold text-foreground">{o.code}</h2>
                  <StatusPill tone={FUNDING_LABEL[o.funding_status].tone}>{FUNDING_LABEL[o.funding_status].label}</StatusPill>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-foreground">
                  {title(o.purpose, o.business_sector)}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} aria-hidden /> {o.community_name}</span>
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
                      {proven === 0
                        ? tr({ en: `${proofs.length} proofs recorded · confirming`, pt: `${proofs.length} provas registradas · confirmando` })
                        : proven === proofs.length
                          ? tr({ en: `${proven} proofs confirmed on Solana`, pt: `${proven} provas confirmadas na Solana` })
                          : tr({ en: `${proven} of ${proofs.length} proofs confirmed`, pt: `${proven} de ${proofs.length} provas confirmadas` })}
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

      {/* What this console does not carry. An investor who counts eight
          requests should be able to learn that the engine qualified ten, and
          where the other two went — otherwise the market looks like the whole
          of qualified demand, which it is not. */}
      {elsewhere.data && elsewhere.data.count > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {tr({
            en: `${elsewhere.data.count} more qualified ${elsewhere.data.count === 1 ? "request" : "requests"}, ${money(elsewhere.data.amount_cents)} in all, ${elsewhere.data.count === 1 ? "is" : "are"} raising in reais on the domestic desk. Brazilian capital funds those, so they are not offered here.`,
            pt: `Mais ${elsewhere.data.count} ${elsewhere.data.count === 1 ? "pedido qualificado está captando" : "pedidos qualificados estão captando"} em reais na mesa doméstica, ${money(elsewhere.data.amount_cents)} ao todo. Quem financia esses é o capital brasileiro, então não são ofertados aqui.`,
          })}
        </p>
      )}
    </div>
  );
}
