import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, Landmark, Loader2, Receipt, Store, Vault, Wallet } from "lucide-react";
import { compareRoutes, type Route } from "@empowerfi/capital-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { platform } from "../../lib/platform";
import { fetchRampQuote, inRampRange, RAMP_MIN_MICRO_USDC, rampFeeBps, rampQuoteKey, receivedAfterTax } from "../../lib/ramp";
import { money } from "../../lib/readiness";
import { mockPixE2e, reaisAtRamp, REALITY, type Reality, type SettlementOverview, WHAT_IS_REAL } from "../../lib/settlement";
import { rpc, usdc, vaultAddress } from "../../lib/solana";

// Where capital goes after it is allocated, and how it comes back: the legs
// that are real transactions on devnet, and the ones that are simulated or
// mocks, each labelled as such.

const ROUTE_TITLE: Record<Route["id"], string> = {
  domestic_pix: "Reais already in Brazil · Pix",
  brl_stablecoin: "BRL stablecoin · off-ramp",
  usd_wire: "US dollars · bank wire",
  usd_stablecoin: "USDC · regulated off-ramp",
};

function useSettlement() {
  return useQuery({
    queryKey: ["platform", "settlement-overview"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("settlement_overview");
      if (error) throw error;
      return data as unknown as SettlementOverview;
    },
    refetchInterval: 20_000,
  });
}

function Node({ icon: Icon, title, reality, children }: { icon: typeof Wallet; title: string; reality: Reality; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="shrink-0 text-accent" aria-hidden />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <StatusPill tone={REALITY[reality].tone}>{REALITY[reality].label}</StatusPill>
      <div className="text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1 text-[11px] text-muted-foreground lg:w-24 lg:flex-col">
      <ArrowRight size={16} className="hidden lg:block" aria-hidden />
      <ArrowDown size={16} className="lg:hidden" aria-hidden />
      <span className="text-center">{label}</span>
    </div>
  );
}

type QuoteSource = "demo" | "moneygram";

/** The amount the simulator asks MoneyGram about, once typing has settled. */
function useSettled<T>(value: T, ms = 500): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

function Simulator({ fxMilli, rampBps }: { fxMilli: number; rampBps: number }) {
  const [source, setSource] = useState<QuoteSource>("moneygram");
  const [amount, setAmount] = useState(100);
  const [fx, setFx] = useState(fxMilli / 1000);
  const [spread, setSpread] = useState(rampBps / 100);
  const [tax, setTax] = useState(0.38);
  const [receipt, setReceipt] = useState<{ e2e: string; at: Date; cents: number } | null>(null);

  const micro = Math.max(0, Math.round(amount * 1e6));
  const settledMicro = useSettled(micro);
  const quote = useQuery({
    queryKey: rampQuoteKey(settledMicro),
    queryFn: () => fetchRampQuote(settledMicro),
    enabled: source === "moneygram" && inRampRange(settledMicro),
    staleTime: 60_000,
    // MoneyGram's quotes last half an hour; a fresh one before this one lapses.
    refetchInterval: 10 * 60_000,
    retry: false,
  });

  // At the demo's own assumptions.
  const gross = reaisAtRamp(micro, Math.round(fx * 1000), 0);
  const spreadCents = Math.round((gross * spread) / 100);
  const demoTax = Math.round((gross * tax) / 100);
  const demoNet = Math.max(0, gross - spreadCents - demoTax);

  // At MoneyGram's sandbox quote, once it is for the amount shown.
  const q = source === "moneygram" && quote.data && quote.data.send_micro_usdc === Math.floor(micro / 10_000) * 10_000 ? quote.data : null;
  const mg = q ? receivedAfterTax(q.receive_cents, tax) : null;
  const waiting = source === "moneygram" && inRampRange(micro) && !q && !quote.isError;
  const net = source === "demo" ? demoNet : mg?.net_cents ?? 0;

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setReceipt(null); };
  const row = (label: string, value: string, strong = false) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num ${strong ? "font-semibold text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
  // Moving this amount in, and back out as it is repaid, by each route: rail and compliance only.
  const rails = useMemo(() => net > 0
    ? compareRoutes({ principal_cents: net, term_months: 12, required_return_bps: 0, expected_loss_bps: 0, operating_cost_cents: 0 })
        .sort((a, b) => a.rail_cents - b.rail_cents)
    : [], [net]);

  return (
    <Panel title="Payment simulator" description="What a USDC release becomes in reais on her side of the route, at MoneyGram's sandbox quote or at assumptions you set.">
      <div role="radiogroup" aria-label="Quote from" className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
        {([["moneygram", "MoneyGram sandbox", "a live quote, $2–$200"], ["demo", "Demo assumptions", "a quote and spread you set"]] as const).map(([key, label, hint]) => (
          <button key={key} type="button" role="radio" aria-checked={source === key} onClick={() => change(setSource)(key)}
            className={`rounded-lg px-2 py-1.5 text-left transition-colors ${source === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-[11px]">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="sim-usdc">USDC released</Label>
          <Input id="sim-usdc" type="number" min={0} step="1" value={amount} onChange={(e) => change(setAmount)(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        {source === "demo" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sim-fx" className="text-xs">Quote, R$ per USDC</Label>
              <Input id="sim-fx" type="number" min={0} step="0.01" value={fx} onChange={(e) => change(setFx)(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-spread" className="text-xs">Ramp spread, %</Label>
              <Input id="sim-spread" type="number" min={0} step="0.05" value={spread} onChange={(e) => change(setSpread)(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </>
        )}
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="sim-tax" className="text-xs">Tax on the inbound conversion, % (an assumption to be validated)</Label>
          <Input id="sim-tax" type="number" min={0} step="0.01" value={tax} onChange={(e) => change(setTax)(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>

      {source === "demo" ? (
        <div className="divide-y divide-border rounded-xl border border-border px-3">
          {row("At the quote", money(gross))}
          {row(`Ramp spread (${spread.toFixed(2)}%)`, `− ${money(spreadCents)}`)}
          {row(`Tax (${tax.toFixed(2)}%)`, `− ${money(demoTax)}`)}
          {row("Pix fee", money(0))}
          {row("She receives by Pix", money(demoNet), true)}
        </div>
      ) : !inRampRange(micro) ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3 text-sm">
          <p className="text-foreground">MoneyGram's sandbox quotes a transfer from 2 to 200 USDC.</p>
          <p className="text-xs text-muted-foreground">A loan is released in larger amounts: switch to the demo assumptions for those, or quote a transfer MoneyGram would carry.</p>
          <Button size="sm" variant="outline" onClick={() => change(setAmount)(micro < RAMP_MIN_MICRO_USDC ? 2 : 200)}>
            Quote {micro < RAMP_MIN_MICRO_USDC ? "2" : "200"} USDC
          </Button>
        </div>
      ) : quote.isError && !waiting ? (
        <LoadError compact error={quote.error} onRetry={() => quote.refetch()} />
      ) : (
        <div className="space-y-2" aria-live="polite" aria-busy={waiting}>
          <div className="divide-y divide-border rounded-xl border border-border px-3">
            {row("Sent to MoneyGram", q ? usdc(q.send_micro_usdc) : "…")}
            {row(q ? `MoneyGram's fee (${(rampFeeBps(q) / 100).toFixed(2)}%)` : "MoneyGram's fee", q ? `− ${usdc(q.fee_micro_usdc)}` : "…")}
            {row(q ? `At MoneyGram's rate, R$ ${q.brl_per_usdc.toFixed(4)}${q.rate_estimated ? " (estimated)" : ""}` : "At MoneyGram's rate", q ? money(q.receive_cents) : "…")}
            {row(`Tax (${tax.toFixed(2)}%)`, mg ? `− ${money(mg.tax_cents)}` : "…")}
            {row("She receives", mg ? money(mg.net_cents) : "…", true)}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            {waiting ? <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" /> : <StatusPill tone={REALITY.sandbox.tone} dot={false}>{REALITY.sandbox.label}</StatusPill>}
            <span>
              {q ? <>Quoted at {new Date(q.quoted_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} as <span title={q.service}>a cash pickup in Brazil</span>, the only delivery the sandbox prices there; the Pix to her account stays a mock. </> : "Asking MoneyGram's sandbox… "}
              At the demo assumptions she would receive {money(demoNet)}.
            </span>
          </p>
        </div>
      )}

      <Button variant="secondary" className="w-full" disabled={net <= 0} onClick={() => setReceipt({ e2e: mockPixE2e(), at: new Date(), cents: net })}>
        <Receipt size={15} /> Run a mock Pix settlement
      </Button>
      {receipt && (
        <div className="space-y-1.5 rounded-xl border border-dashed border-border p-3 text-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Pix settled</span>
            <StatusPill tone={REALITY.mock.tone}>Mock · no Pix was sent</StatusPill>
          </div>
          <p className="num text-foreground">{money(receipt.cents)} → her business account, held by the partner</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{receipt.e2e}</p>
          <p className="text-xs text-muted-foreground">{receipt.at.toLocaleString("en-GB")} · end-to-end id in Pix's format, invented</p>
        </div>
      )}

      {rails.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">Moving {money(net)} in and back out, by route</p>
          <ul className="space-y-1 text-sm">
            {rails.map((r) => (
              <li key={r.route.id} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{ROUTE_TITLE[r.route.id]}</span>
                <span className="num text-foreground">{money(r.rail_cents)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Spreads, fees and compliance from packages/capital-route, over a 12-month loan. A stablecoin rail is not cheaper by default: it earns its
            place against the bank wire it replaces. <Link to="/app/capital" className="text-info hover:underline">Compare what each route costs her →</Link>
          </p>
        </div>
      )}
    </Panel>
  );
}

export default function Settlement() {
  const q = useSettlement();
  const chain = useQuery({
    queryKey: ["settlement-vault-balance"],
    queryFn: async () => {
      const vault = await vaultAddress();
      const { value } = await rpc.getTokenAccountBalance(vault, { commitment: "confirmed" }).send();
      return { vault: vault as string, micro: Number(value.amount) };
    },
    refetchInterval: 30_000,
  });

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Investor console" title="Settlement"
        description="How capital reaches her business and comes back. Deposits, releases and payouts are real transactions on Solana devnet; the conversion to reais is simulated, with a live quote from MoneyGram's sandbox in the simulator, and Pix is a mock. Every screen says which is which." />

      {!d ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Paid out to you" value={usdc(d.mine.paid_out_micro_usdc)} hint={`${d.mine.payouts} payout${d.mine.payouts === 1 ? "" : "s"} to your wallet`} hintTone="positive" />
            <StatTile label="On its way to you" value={usdc(d.mine.due_micro_usdc)} hint="instalments being paid out" />
            <StatTile label="Held for you" value={usdc(d.mine.held_micro_usdc)} hint="ZEC positions with no Solana wallet" hintTone={d.mine.held_micro_usdc ? "caution" : undefined} />
            <StatTile label="In the vault" value={chain.data ? usdc(chain.data.micro) : chain.isPending ? "…" : "—"}
              hint={chain.data && chain.data.micro === d.vault.in_vault_micro_usdc ? "matches every recorded movement" : `ledger says ${usdc(d.vault.in_vault_micro_usdc)}`}
              hintTone={chain.data && chain.data.micro === d.vault.in_vault_micro_usdc ? "positive" : "caution"} />
          </div>

          <Panel title="The route" description="Out to her business when the partner disburses, and back to investors with each instalment.">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              <Node icon={Wallet} title="Investors" reality="real">
                {usdc(d.vault.deposits_micro_usdc)} deposited by wallet or shielded ZEC, and not refunded.
              </Node>
              <Arrow label="deposit" />
              <Node icon={Vault} title="Program vault" reality="real">
                Holds {chain.data ? usdc(chain.data.micro) : "…"}. {chain.data && <ExplorerLink address={chain.data.vault} />}
              </Node>
              <Arrow label="release, batched" />
              <Node icon={Landmark} title="Ramp partner" reality="simulated">
                {usdc(d.vault.released_micro_usdc)} released, turned into reais at R$ {(d.fx_brl_per_usdc_milli / 1000).toFixed(2)} less {(d.ramp_bps / 100).toFixed(2)}%. The simulator prices it with MoneyGram's sandbox.
              </Node>
              <Arrow label="Pix" />
              <Node icon={Store} title="Her business" reality="mock">
                {d.pix.payouts} loan{d.pix.payouts === 1 ? "" : "s"} paid by Pix, {money(d.pix.payout_cents)}.
              </Node>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Back:</span>
              <span>{d.pix.ins} instalments by Pix ({money(d.pix.in_cents)}, mock)</span>
              <ArrowRight size={12} aria-hidden />
              <span>the ramp returns real investors' shares to the vault, {usdc(d.vault.repaid_in_micro_usdc)}</span>
              <ArrowRight size={12} aria-hidden />
              <span>paid out to their wallets in the same transaction, {usdc(d.vault.paid_out_micro_usdc)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Releases leave in one transfer for every loan disbursed at the same time, so no transfer's amount is a loan's principal.
              Simulated positions move no USDC.
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Simulator fxMilli={d.fx_brl_per_usdc_milli} rampBps={d.ramp_bps} />

            <Panel title="What is real in this demo" description="Leg by leg: a transaction you can open on an explorer, a figure at an assumed quote, or a mock.">
              <ul className="divide-y divide-border">
                {WHAT_IS_REAL.map((r) => (
                  <li key={r.what} className="space-y-1 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-foreground">{r.what}</span>
                      <StatusPill tone={REALITY[r.reality].tone}>{REALITY[r.reality].label}</StatusPill>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.note}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel title="Vault transfers" description="The operator-signed transactions that moved USDC out of the vault, newest first.">
            {d.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No release or payout yet: they start when a partner disburses a loan with real deposits.</p>
            ) : (
              <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Transfer</th>
                      <th className="py-2 pr-4 text-right font-medium">Out of the vault</th>
                      <th className="py-2 pr-4 text-right font-medium">Back in</th>
                      <th className="py-2 pr-4 font-medium">State</th>
                      <th className="py-2 font-medium">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...d.transfers].sort((a, b) => b.id - a.id).map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 pr-4">
                          <span className="block text-foreground">{t.kind === "release" ? `Release · ${t.legs} loan${t.legs === 1 ? "" : "s"}` : `Payout · ${t.legs} investor${t.legs === 1 ? "" : "s"}`}</span>
                          <span className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="num py-2.5 pr-4 text-right text-foreground">{usdc(t.outflow_micro_usdc)}</td>
                        <td className="num py-2.5 pr-4 text-right text-muted-foreground">{t.inflow_micro_usdc ? usdc(t.inflow_micro_usdc) : "—"}</td>
                        <td className="py-2.5 pr-4">
                          <StatusPill tone={t.status === "confirmed" ? "positive" : t.status === "failed" ? "alert" : "caution"}>
                            {t.status === "confirmed" ? "Confirmed" : t.status === "failed" ? "Failed" : "Sending"}
                          </StatusPill>
                        </td>
                        <td className="py-2.5">{t.signature ? <ExplorerLink tx={t.signature} /> : q.isFetching ? <Loader2 size={12} className="animate-spin" /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
