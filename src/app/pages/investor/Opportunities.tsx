import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useMarket } from "./queries";

type Filter = { route: string; risk: string; purpose: string; term: string; amount: string; status: string };
const ALL: Filter = { route: "all", risk: "all", purpose: "all", term: "all", amount: "all", status: "raising" };

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
  const rows = useMemo(() => (market.data ?? []).filter((o) => matches(o, filter)), [market.data, filter]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="P2P capital console" title="Qualified P2P opportunities"
        description="Each one exists only after readiness, her own request for capital and EmpowerFI's eligibility check. The Capital Allocation Engine then assigns it a funding route: Domestic P2P in reais, or Global P2P in USDC. Returns are simulated; nothing here is a promise of return." />

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Route" value={filter.route} onChange={set("route")}
          options={[["all", "Both"], ["domestic", "Domestic / Pix"], ["global", "Global / USDC"]]} />
        <FilterSelect label="Status" value={filter.status} onChange={set("status")}
          options={[["raising", "Raising"], ["funded", "Funded"], ["all", "All"]]} />
        <FilterSelect label="Risk" value={filter.risk} onChange={set("risk")}
          options={[["all", "All"], ["LOW", "A · lower"], ["MEDIUM", "B · moderate"], ["HIGH", "C · higher"]]} />
        <FilterSelect label="Purpose" value={filter.purpose} onChange={set("purpose")}
          options={[["all", "All"], ...Object.entries(PURPOSE_LABEL)] as [string, string][]} />
        <FilterSelect label="Term" value={filter.term} onChange={set("term")}
          options={[["all", "All"], ["short", "Up to 6 months"], ["mid", "7–12 months"], ["long", "Over 12 months"]]} />
        <FilterSelect label="Amount" value={filter.amount} onChange={set("amount")}
          options={[["all", "All"], ["small", "Under R$ 2,500"], ["mid", "R$ 2,500–5,000"], ["large", "R$ 5,000 and up"]]} />
      </div>

      {market.isPending && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl bg-card" />)}</div>
      )}
      {market.isError && <LoadError error={market.error} onRetry={() => market.refetch()} />}
      {market.data && rows.length === 0 && (
        <p className="panel p-8 text-center text-sm text-muted-foreground">No opportunity matches these filters.</p>
      )}

      <ul className="space-y-3">
        {rows.map((o) => {
          const risk = RISK[o.risk_band];
          const pool = poolOf(o.funding_pool);
          const lead = (o.allocation_reason_codes ?? [])[0] as AllocationReason | undefined;
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
                <FundingBar funded={o.funded_micro_usdc} target={o.funding_target_micro_usdc} investors={o.investors}
                  pool={pool} fxMilli={o.fx_brl_per_usdc_milli} amountCents={o.amount_cents} />
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-primary">{money(o.amount_cents)}</p>
                <p className="text-xs text-muted-foreground">
                  {pool === "global" ? `${usdc(o.funding_target_micro_usdc, 0)} · ` : ""}Term {o.term_months} mo
                </p>
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-foreground">{percent(o.indicative_yield_bps)}</p>
                <p className="text-xs text-muted-foreground">Expected return · simulated</p>
              </div>
              <div>
                <p className={`font-heading text-xl font-bold text-${risk.tone}`}>Risk {risk.grade}</p>
                <p className="text-xs text-muted-foreground">Readiness {o.readiness_score ?? "—"}</p>
              </div>
              <Button asChild className="gap-2 lg:justify-self-end">
                <Link to={`/app/investor/opportunities/${o.opportunity_id}`}>View opportunity <ArrowRight size={16} /></Link>
              </Button>
            </li>
          );
        })}
      </ul>

      <p className="panel px-5 py-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Routing principle:</span> each opportunity goes to domestic P2P or global USDC by cost,
        availability, mandate and risk appetite. Either way she receives and repays in reais, by Pix, and EmpowerFI's P2P desk
        formalises and services the loan.
      </p>
    </div>
  );
}
