import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { compareRoutes, DEFAULT_ROUTES, type LoanTerms, type Route } from "@empowerfi/capital-route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { percent } from "../lib/credit";
import { money } from "../lib/readiness";

// The Capital Route simulator: the same loan, reaching the same business by
// four routes, and what each costs her. Illustrative assumptions throughout;
// every one of them can be changed here.

const PART_LABEL: Record<keyof ReturnType<typeof compareRoutes>[number]["components"], string> = {
  capital: "Return the capital asks",
  hedge: "Currency hedge",
  expected_loss: "Expected loss",
  operating: "Origination and servicing",
  rail: "Rail: spreads and fees",
  compliance: "Compliance",
};
const PART_TONE: Record<keyof typeof PART_LABEL, string> = {
  capital: "bg-primary", hedge: "bg-alert", expected_loss: "bg-caution",
  operating: "bg-accent", rail: "bg-info", compliance: "bg-muted-foreground",
};
const ROUTE_TITLE: Record<Route["id"], string> = {
  domestic_pix: "Domestic · partner and Pix",
  brl_stablecoin: "BRL stablecoin",
  usd_wire: "Foreign capital · bank wire",
  usd_stablecoin: "Foreign capital · USD stablecoin",
};
const ASSUMPTIONS: { key: keyof Route; label: string; unit: "bps" | "cents" }[] = [
  { key: "fx_bps", label: "FX spread, each way", unit: "bps" },
  { key: "ramp_bps", label: "Ramp spread, each way", unit: "bps" },
  { key: "inbound_tax_bps", label: "Tax on inbound FX", unit: "bps" },
  { key: "hedge_bps_year", label: "Currency hedge, a year", unit: "bps" },
  { key: "transfer_cents", label: "Transfer fee (per loan)", unit: "cents" },
  { key: "blockchain_cents", label: "On-chain fee, per transaction", unit: "cents" },
  { key: "compliance_cents", label: "Compliance per loan", unit: "cents" },
];

function Field({ id, label, value, onChange, step = "1" }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </div>
  );
}

export default function CapitalRoutes({ operatingCostCents }: { operatingCostCents: number | null }) {
  const [amount, setAmount] = useState(3000);
  const [term, setTerm] = useState(6);
  const [required, setRequired] = useState(12);
  const [loss, setLoss] = useState(5);
  const [operating, setOperating] = useState(Math.round((operatingCostCents ?? 30_000) / 100));
  const [routes, setRoutes] = useState<Route[]>(DEFAULT_ROUTES);
  const [open, setOpen] = useState(false);

  const terms: LoanTerms = {
    principal_cents: Math.max(1, Math.round(amount * 100)),
    term_months: Math.max(1, Math.round(term)),
    required_return_bps: Math.round(required * 100),
    expected_loss_bps: Math.round(loss * 100),
    operating_cost_cents: Math.round(operating * 100),
  };
  const ranked = useMemo(() => compareRoutes(terms, routes), [JSON.stringify(terms), routes]); // eslint-disable-line react-hooks/exhaustive-deps
  const widest = Math.max(...ranked.map((c) => c.borrower_bps_year), 1);
  const cheapest = ranked[0];

  const setAssumption = (id: Route["id"], key: keyof Route, value: number) =>
    setRoutes((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  return (
    <section className="space-y-5 rounded-2xl p-6 glass glow-border">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-bold text-foreground">Capital routes · simulator</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The same loan, reaching the same business by four routes. A blockchain rail is not cheaper by default: for
          capital already in reais the domestic route wins; a stablecoin earns its place when capital crosses a border,
          against the wire it replaces. Illustrative assumptions, all editable; no money moves.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field id="cr-amount" label="Loan (R$)" value={amount} onChange={setAmount} step="100" />
        <Field id="cr-term" label="Term (months)" value={term} onChange={setTerm} />
        <Field id="cr-return" label="Capital's return (% a year)" value={required} onChange={setRequired} step="0.5" />
        <Field id="cr-loss" label="Expected loss (% a year)" value={loss} onChange={setLoss} step="0.5" />
        <Field id="cr-operating" label="Cost to serve (R$ per loan)" value={operating} onChange={setOperating} step="10" />
      </div>

      <ul className="space-y-4">
        {ranked.map((c) => (
          <li key={c.route.id} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                {ROUTE_TITLE[c.route.id]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{c.route.capital_source} · {c.route.rail}</span>
              </span>
              <span className="text-foreground">
                {percent(c.borrower_bps_month)} a month · {percent(c.borrower_bps_year)} a year
                {c !== cheapest && (
                  <span className="ml-1 text-xs text-muted-foreground">(+{percent(c.borrower_bps_year - cheapest.borrower_bps_year)})</span>
                )}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-border" aria-label={`Cost breakdown, ${ROUTE_TITLE[c.route.id]}`}>
              {(Object.keys(PART_LABEL) as (keyof typeof PART_LABEL)[]).map((k) => (
                <div key={k} className={PART_TONE[k]} style={{ width: `${(c.components[k] / widest) * 100}%` }}
                  title={`${PART_LABEL[k]}: ${percent(c.components[k])} a year`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Rail and compliance over the loan: {money(c.rail_cents)}
              {c.components.hedge > 0 && <> · currency hedge {percent(c.components.hedge)} a year</>}
            </p>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(PART_LABEL) as (keyof typeof PART_LABEL)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`inline-block h-2 w-2 rounded-full ${PART_TONE[k]}`} />{PART_LABEL[k]}</span>
        ))}
      </p>

      <div className="border-t border-border pt-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="inline-flex items-center gap-1 text-sm text-accent hover:text-foreground">
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} /> Route assumptions
        </button>
        {open && (
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Assumption</th>
                  {routes.map((r) => <th key={r.id} className="py-2 pr-3 font-medium">{ROUTE_TITLE[r.id]}</th>)}
                </tr>
              </thead>
              <tbody>
                {ASSUMPTIONS.map((a) => (
                  <tr key={a.key} className="border-t border-border">
                    <td className="py-1.5 pr-3 text-muted-foreground">{a.label} {a.unit === "bps" ? "(%)" : "(R$)"}</td>
                    {routes.map((r) => (
                      <td key={r.id} className="py-1.5 pr-3">
                        <Input aria-label={`${a.label}, ${ROUTE_TITLE[r.id]}`} type="number" min={0} step={a.unit === "bps" ? "0.01" : "0.01"}
                          className="h-8 w-24" value={(r[a.key] as number) / 100}
                          onChange={(e) => setAssumption(r.id, a.key, Math.max(0, Math.round((Number(e.target.value) || 0) * 100)))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              Tax and regulatory treatment of foreign and stablecoin capital are assumptions to be validated with counsel
              before any real route is offered.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
