import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import StatusPill from "../../components/product/StatusPill";
import { percent } from "../../lib/credit";
import { FUNDING_LABEL, type MarketRow, RISK, title } from "../../lib/investor";
import { PURPOSE_LABEL } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import FundingBar from "./FundingBar";
import { useMarket } from "./queries";

type Filter = { risk: string; purpose: string; term: string; amount: string; status: string };
const ALL: Filter = { risk: "all", purpose: "all", term: "all", amount: "all", status: "raising" };

const matches = (o: MarketRow, f: Filter) => {
  const usd = (o.funding_target_micro_usdc ?? 0) / 1e6;
  return (
    (f.risk === "all" || o.risk_band === f.risk) &&
    (f.purpose === "all" || o.purpose === f.purpose) &&
    (f.term === "all" || (f.term === "short" ? o.term_months <= 6 : f.term === "mid" ? o.term_months > 6 && o.term_months <= 12 : o.term_months > 12)) &&
    (f.amount === "all" || (f.amount === "small" ? usd < 500 : f.amount === "mid" ? usd >= 500 && usd < 1000 : usd >= 1000)) &&
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
      <PageHeader eyebrow="Investor console" title="Qualified productive-credit opportunities"
        description="Each one exists only after readiness, her own request for capital and EmpowerFI's eligibility check. Yields and risk bands are simulated; nothing here is a promise of return." />

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Status" value={filter.status} onChange={set("status")}
          options={[["raising", "Raising"], ["funded", "Funded"], ["all", "All"]]} />
        <FilterSelect label="Risk" value={filter.risk} onChange={set("risk")}
          options={[["all", "All"], ["LOW", "A · lower"], ["MEDIUM", "B · moderate"], ["HIGH", "C · higher"]]} />
        <FilterSelect label="Purpose" value={filter.purpose} onChange={set("purpose")}
          options={[["all", "All"], ...Object.entries(PURPOSE_LABEL)] as [string, string][]} />
        <FilterSelect label="Term" value={filter.term} onChange={set("term")}
          options={[["all", "All"], ["short", "Up to 6 months"], ["mid", "7–12 months"], ["long", "Over 12 months"]]} />
        <FilterSelect label="Amount" value={filter.amount} onChange={set("amount")}
          options={[["all", "All"], ["small", "Under 500 USDC"], ["mid", "500–1,000 USDC"], ["large", "1,000 USDC and up"]]} />
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
                <FundingBar funded={o.funded_micro_usdc} target={o.funding_target_micro_usdc} investors={o.investors} />
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-primary">{usdc(o.funding_target_micro_usdc, 0)}</p>
                <p className="text-xs text-muted-foreground">Term {o.term_months} mo</p>
              </div>
              <div>
                <p className="num font-heading text-xl font-bold text-foreground">{percent(o.indicative_yield_bps)}</p>
                <p className="text-xs text-muted-foreground">Indicative yield · demo</p>
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
        Opportunities read like investable assets, and stay transparent about credit risk, servicing and productive purpose.
        The partner who formalises each loan is its lender of record.
      </p>
    </div>
  );
}
