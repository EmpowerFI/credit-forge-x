import { useEffect, useMemo, useState } from "react";
import { Check, CircleDashed, X } from "lucide-react";
import {
  allocate, allocatePortfolio, CAPITAL_ALLOCATION_MODEL_VERSION, type AllocationOpportunity, type PoolPolicy, type RiskBand,
} from "@empowerfi/capital-allocation";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import LoadError from "../../components/LoadError";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { bpsPercent, type CapitalOverview, POOL, PROTOTYPE_NOTICE, REASON, type PoolId } from "../../lib/capital";
import { money, PURPOSE_LABEL } from "../../lib/readiness";
import CapitalPools from "../investor/CapitalPools";
import { useCapitalOverview } from "../investor/queries";

// The Capital Allocation Engine, in the open: the same function the database
// runs when an opportunity opens to investors, here with every input editable.
// Nothing on this page writes anything.

const BANDS: RiskBand[] = ["LOW", "MEDIUM", "HIGH"];
const BAND_LABEL: Record<RiskBand, string> = { LOW: "A · lower", MEDIUM: "B · moderate", HIGH: "C · higher" };
/** Eligibility proposes nothing whose instalment takes more than this of her monthly result. */
const AFFORDABILITY_LIMIT_BPS = 3000;

interface PoolForm {
  available: string; // reais for domestic, USDC for global
  requiredReturn: string;
  bands: RiskBand[];
  minTicket: string;
  maxTicket: string;
  impact: boolean;
  purposes: string[];
  fxHedge: string;
  ramp: string;
}

const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pctToBps = (v: string) => Math.round(num(v) * 100);
const reaisToCents = (v: string) => Math.round(num(v) * 100);

function formFor(p: CapitalOverview["pools"][number]): PoolForm {
  return {
    available: p.pool === "domestic" ? String(p.liquidity_cents / 100) : String((p.liquidity_micro_usdc ?? 0) / 1e6),
    requiredReturn: String(p.policy.required_return_bps / 100),
    bands: p.policy.eligible_risk_bands,
    minTicket: String(p.policy.min_ticket_cents / 100),
    maxTicket: String(p.policy.max_ticket_cents / 100),
    impact: p.policy.impact_mandate,
    purposes: p.policy.purposes,
    fxHedge: String(p.policy.fx_hedge_bps / 100),
    ramp: String(p.policy.ramp_bps / 100),
  };
}

function policyOf(id: PoolId, f: PoolForm, fxMilli: number): PoolPolicy {
  return {
    id,
    available_cents: id === "domestic" ? reaisToCents(f.available) : Math.floor(num(f.available) * fxMilli / 10),
    required_return_bps: pctToBps(f.requiredReturn),
    eligible_risk_bands: f.bands,
    min_ticket_cents: reaisToCents(f.minTicket),
    max_ticket_cents: reaisToCents(f.maxTicket),
    purposes: f.purposes,
    impact_mandate: f.impact,
    fx_hedge_bps: id === "domestic" ? 0 : pctToBps(f.fxHedge),
    ramp_bps: id === "domestic" ? 0 : pctToBps(f.ramp),
  };
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PoolInputs({ id, form, onChange }: { id: PoolId; form: PoolForm; onChange: (f: PoolForm) => void }) {
  const set = <K extends keyof PoolForm>(k: K) => (v: PoolForm[K]) => onChange({ ...form, [k]: v });
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const global = id === "global";
  return (
    <Panel title={`Input ${global ? 3 : 2} · ${POOL[id].name} pool`} description={`${POOL[id].investors} · ${POOL[id].asset}.`}
      actions={<StatusPill tone="caution" dot={false}>Simulated</StatusPill>}>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-available`} label={global ? "Available, USDC" : "Available, R$"}>
          <Input id={`${id}-available`} type="number" min={0} value={form.available} onChange={(e) => set("available")(e.target.value)} />
        </Field>
        <Field id={`${id}-return`} label="Required return, % a year">
          <Input id={`${id}-return`} type="number" min={0} step="0.5" value={form.requiredReturn} onChange={(e) => set("requiredReturn")(e.target.value)} />
        </Field>
        <Field id={`${id}-min`} label="Ticket from, R$">
          <Input id={`${id}-min`} type="number" min={0} value={form.minTicket} onChange={(e) => set("minTicket")(e.target.value)} />
        </Field>
        <Field id={`${id}-max`} label="Ticket up to, R$">
          <Input id={`${id}-max`} type="number" min={0} value={form.maxTicket} onChange={(e) => set("maxTicket")(e.target.value)} />
        </Field>
        {global && (
          <>
            <Field id={`${id}-hedge`} label="FX hedge, % a year">
              <Input id={`${id}-hedge`} type="number" min={0} step="0.25" value={form.fxHedge} onChange={(e) => set("fxHedge")(e.target.value)} />
            </Field>
            <Field id={`${id}-ramp`} label="Ramp, % each way">
              <Input id={`${id}-ramp`} type="number" min={0} step="0.25" value={form.ramp} onChange={(e) => set("ramp")(e.target.value)} />
            </Field>
          </>
        )}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">Risk appetite</legend>
        <div className="flex flex-wrap gap-4">
          {BANDS.map((b) => (
            <label key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={form.bands.includes(b)} onCheckedChange={() => set("bands")(toggle(form.bands, b))} /> {BAND_LABEL[b]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-foreground">Mandate: productive purposes {form.purposes.length === 0 && <span className="font-normal text-muted-foreground">(any)</span>}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(PURPOSE_LABEL).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={form.purposes.includes(k)} onCheckedChange={() => set("purposes")(toggle(form.purposes, k))} /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      {global && (
        <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          Impact mandate: women-led businesses in verified communities
          <Switch checked={form.impact} onCheckedChange={set("impact")} />
        </label>
      )}
    </Panel>
  );
}

function Decision({ n, title, ok, children }: { n: number; title: string; ok: boolean | null; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-1">
      <span className="mt-0.5">
        {ok === null ? <CircleDashed size={18} className="text-muted-foreground" /> : ok ? <Check size={18} className="text-positive" /> : <X size={18} className="text-caution" />}
      </span>
      <span className="text-sm font-medium text-foreground">Decision {n} · {title}</span>
      <span />
      <div className="text-sm text-muted-foreground">{children}</div>
    </li>
  );
}

export default function AllocationEngine() {
  const q = useCapitalOverview();
  const [domestic, setDomestic] = useState<PoolForm | null>(null);
  const [global, setGlobal] = useState<PoolForm | null>(null);
  const [demand, setDemand] = useState({ amount: "3000", term: "6", band: "LOW" as RiskBand, purpose: "inventory", affordability: "15" });

  useEffect(() => {
    if (!q.data || domestic) return;
    const d = q.data.pools.find((p) => p.pool === "domestic");
    const g = q.data.pools.find((p) => p.pool === "global");
    if (d) setDomestic(formFor(d));
    if (g) setGlobal(formFor(g));
  }, [q.data, domestic]);

  const fx = q.data?.fx_brl_per_usdc_milli ?? 5400;
  const opportunity: AllocationOpportunity = {
    amount_cents: Math.max(1, reaisToCents(demand.amount)), term_months: Math.max(1, Math.round(num(demand.term))),
    risk_band: demand.band, purpose: demand.purpose, impact_eligible: true,
  };
  const qualified = pctToBps(demand.affordability) <= AFFORDABILITY_LIMIT_BPS;
  const policies = domestic && global ? { d: policyOf("domestic", domestic, fx), g: policyOf("global", global, fx) } : null;
  const result = policies && qualified ? allocate(opportunity, policies.d, policies.g) : null;

  // Its funding-gap impact: the live demand replayed without it, and with it last in line.
  const impact = useMemo(() => {
    if (!q.data || !policies || !result) return null;
    const live = q.data.demand.map((o) => ({ amount_cents: o.amount_cents, term_months: o.term_months, risk_band: o.risk_band, purpose: o.purpose, impact_eligible: o.impact_eligible }));
    const before = allocatePortfolio(live, policies.d, policies.g);
    const after = allocatePortfolio([...live, opportunity], policies.d, policies.g);
    return { before, after };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, JSON.stringify(policies), JSON.stringify(opportunity), Boolean(result)]);

  // The browser's engine against the database's, over the same demand and liquidity.
  const parity = useMemo(() => {
    if (!q.data) return null;
    const d = q.data.pools.find((p) => p.pool === "domestic")!;
    const g = q.data.pools.find((p) => p.pool === "global")!;
    const replay = allocatePortfolio(
      q.data.demand.map((o) => ({ amount_cents: o.amount_cents, term_months: o.term_months, risk_band: o.risk_band, purpose: o.purpose, impact_eligible: o.impact_eligible })),
      { ...(d.policy as PoolPolicy), id: "domestic", available_cents: d.liquidity_cents },
      { ...(g.policy as PoolPolicy), id: "global", available_cents: g.liquidity_cents },
    );
    return { replay, same: replay.domestic_only_cents === q.data.coverage.domestic_only_cents && replay.combined_cents === q.data.coverage.combined_cents };
  }, [q.data]);

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;

  const d = result?.domestic;
  const g = result?.global;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="P2P capital" title="Capital Allocation Engine"
        description="Which pool of capital can fund a qualified opportunity sustainably — domestic P2P capital or global P2P capital? Feasibility first: availability, risk appetite, ticket and mandate. Economics second: what it costs her a year." />

      <CapitalPools engineLink={false} />

      {!domestic || !global ? <Skeleton className="h-96 w-full rounded-2xl bg-card" /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel title="Input 1 · Qualified demand" description="An opportunity after readiness and eligibility. Try your own.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="d-amount" label="Amount, R$">
                  <Input id="d-amount" type="number" min={100} step="100" value={demand.amount} onChange={(e) => setDemand({ ...demand, amount: e.target.value })} />
                </Field>
                <Field id="d-term" label="Term">
                  <Select value={demand.term} onValueChange={(v) => setDemand({ ...demand, term: v })}>
                    <SelectTrigger id="d-term"><SelectValue /></SelectTrigger>
                    <SelectContent>{["3", "6", "9", "12"].map((t) => <SelectItem key={t} value={t}>{t} months</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="d-band" label="Risk band">
                  <Select value={demand.band} onValueChange={(v) => setDemand({ ...demand, band: v as RiskBand })}>
                    <SelectTrigger id="d-band"><SelectValue /></SelectTrigger>
                    <SelectContent>{BANDS.map((b) => <SelectItem key={b} value={b}>{BAND_LABEL[b]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="d-purpose" label="Productive purpose">
                  <Select value={demand.purpose} onValueChange={(v) => setDemand({ ...demand, purpose: v })}>
                    <SelectTrigger id="d-purpose"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PURPOSE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="d-afford" label="Affordability: instalment, % of her monthly result">
                  <Input id="d-afford" type="number" min={0} step="1" value={demand.affordability} onChange={(e) => setDemand({ ...demand, affordability: e.target.value })} />
                </Field>
              </div>
              {!qualified && (
                <p className="rounded-xl border tone-caution px-3 py-2 text-xs">
                  Above {bpsPercent(AFFORDABILITY_LIMIT_BPS)} of her monthly result, eligibility proposes a smaller amount: this would not be a qualified opportunity, and no pool is asked.
                </p>
              )}
            </Panel>
            <PoolInputs id="domestic" form={domestic} onChange={setDomestic} />
            <PoolInputs id="global" form={global} onChange={setGlobal} />
          </div>

          <div className="space-y-6">
            <Panel title="Decisions" description={CAPITAL_ALLOCATION_MODEL_VERSION}>
              <ol className="space-y-4">
                <Decision n={1} title="Is domestic capital available and eligible?" ok={d ? d.feasible : null}>
                  {!d ? "Waiting for a qualified opportunity." : d.feasible ? "Yes: liquidity, risk appetite, ticket and mandate all fit."
                    : d.blocks.map((b) => REASON[b].label).join(" · ")}
                </Decision>
                <Decision n={2} title="Is global capital available and eligible?" ok={g ? g.feasible : null}>
                  {!g ? "Waiting for a qualified opportunity." : g.feasible ? "Yes: liquidity, risk appetite, ticket and mandate all fit."
                    : g.blocks.map((b) => REASON[b].label).join(" · ")}
                </Decision>
                <Decision n={3} title="Among eligible pools, which has the best sustainable economics?" ok={result ? result.pool !== null : null}>
                  {!result || !d || !g ? "—" : (
                    <div className="num grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs">
                      <span />
                      <span className="text-right">{POOL.domestic.name}</span>
                      <span className="text-right">{POOL.global.name}</span>
                      <span>Required return</span>
                      <span className="text-right text-foreground">{bpsPercent(policies!.d.required_return_bps)}</span>
                      <span className="text-right text-foreground">{bpsPercent(policies!.g.required_return_bps)}</span>
                      <span>Expected loss + cost to serve</span>
                      <span className="text-right text-foreground">{bpsPercent(d.all_in_bps - policies!.d.required_return_bps - d.fx_hedge_bps - d.ramp_bps_year)}</span>
                      <span className="text-right text-foreground">{bpsPercent(g.all_in_bps - policies!.g.required_return_bps - g.fx_hedge_bps - g.ramp_bps_year)}</span>
                      <span>FX hedge</span>
                      <span className="text-right text-foreground">{bpsPercent(d.fx_hedge_bps)}</span>
                      <span className="text-right text-foreground">{bpsPercent(g.fx_hedge_bps)}</span>
                      <span>Ramp, in and out over the term</span>
                      <span className="text-right text-foreground">{bpsPercent(d.ramp_bps_year)}</span>
                      <span className="text-right text-foreground">{bpsPercent(g.ramp_bps_year)}</span>
                      <span className="font-medium text-foreground">Her all-in cost, a year</span>
                      <span className={`text-right font-semibold ${result.pool === "domestic" ? "text-positive" : "text-foreground"}`}>{bpsPercent(d.all_in_bps)}{!d.feasible && " ✗"}</span>
                      <span className={`text-right font-semibold ${result.pool === "global" ? "text-positive" : "text-foreground"}`}>{bpsPercent(g.all_in_bps)}{!g.feasible && " ✗"}</span>
                    </div>
                  )}
                </Decision>
              </ol>
            </Panel>

            <Panel title="Output" actions={result ? <PoolPill pool={result.pool} /> : undefined}>
              {!result ? <p className="text-sm text-muted-foreground">Not a qualified opportunity: nothing to allocate.</p> : (
                <div className="space-y-4">
                  <ul className="space-y-2">
                    {result.reason_codes.map((r) => (
                      <li key={r} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:gap-3">
                        <span className="shrink-0"><StatusPill tone={REASON[r].tone} dot={false}>{r}</StatusPill></span>
                        <span className="text-muted-foreground">{REASON[r].says}</span>
                      </li>
                    ))}
                  </ul>
                  {result.pool && (
                    <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Borrower economics</p>
                        <p className="num text-sm text-foreground">{bpsPercent(result.borrower_rate_bps_month!)} a month</p>
                        <p className="num text-sm text-foreground">{opportunity.term_months} × {money(result.instalment_cents)}, in reais by Pix</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Investor economics · simulated</p>
                        <p className="num text-sm text-foreground">{bpsPercent(result.investor_return_bps!)} asked a year</p>
                        <p className="num text-sm text-foreground">{bpsPercent(result.investor_net_return_bps!)} after expected loss</p>
                      </div>
                    </div>
                  )}
                  {impact && (
                    <div className="space-y-1 border-t border-border pt-4 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">Funding-gap impact, on today's demand</p>
                      <p className="num text-foreground">
                        Gap {money(impact.before.demand_cents - impact.before.combined_cents)} → {money(impact.after.demand_cents - impact.after.combined_cents)}
                        {" "}· coverage {bpsPercent(impact.before.combined_coverage_bps)} → {bpsPercent(impact.after.combined_coverage_bps)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        With the pools above, this opportunity joins the queue last: {impact.after.results.at(-1)?.pool
                          ? `it is funded, from the ${POOL[impact.after.results.at(-1)!.pool!].name} pool.`
                          : "the pools run out before it."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="The live portfolio, replayed" description="The database allocates each opportunity when it opens to investors. Here the browser runs the same engine over today's demand and liquidity.">
              {!parity || !q.data ? <Skeleton className="h-24 w-full" /> : (
                <div className="space-y-3">
                  <p className={`text-sm ${parity.same ? "text-positive" : "text-caution"}`}>
                    {parity.same ? "The browser's coverage matches the database's: " : "The browser's coverage differs from the database's: "}
                    {bpsPercent(parity.replay.domestic_coverage_bps)} domestic alone, {bpsPercent(parity.replay.combined_coverage_bps)} combined.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 font-medium">Opportunity</th>
                          <th className="py-2 pr-3 text-right font-medium">Need</th>
                          <th className="py-2 pr-3 font-medium">Risk · term</th>
                          <th className="py-2 pr-3 font-medium">At listing</th>
                          <th className="py-2 font-medium">Replayed now</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {q.data.demand.map((o, i) => (
                          <tr key={o.opportunity_id}>
                            <td className="py-2 pr-3 font-mono text-xs text-foreground">{o.code}</td>
                            <td className="num py-2 pr-3 text-right text-foreground">{money(o.amount_cents)}</td>
                            <td className="py-2 pr-3 text-xs text-muted-foreground">{o.risk_band === "LOW" ? "A" : o.risk_band === "MEDIUM" ? "B" : "C"} · {o.term_months}m</td>
                            <td className="py-2 pr-3"><PoolPill pool={o.funding_pool} /></td>
                            <td className="py-2"><PoolPill pool={parity.replay.results[i]?.pool ?? null} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    An opportunity keeps the pool it was given while investors fund it; a replay with today's liquidity can answer differently.
                  </p>
                </div>
              )}
            </Panel>
            <p className="px-1 text-xs text-muted-foreground">{PROTOTYPE_NOTICE}</p>
          </div>
        </div>
      )}
    </div>
  );
}
