import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, Landmark, Loader2, Receipt, Store, Vault, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import MarketRate from "../../components/product/MarketRate";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { platform } from "../../lib/platform";
import { fetchRampQuote, inRampRange, RAMP_MIN_MICRO_USDC, rampFeeBps, rampQuoteKey, receivedAfterTax } from "../../lib/ramp";
import { money } from "../../lib/readiness";
import { mockPixE2e, reaisAtRamp, REALITY, type Reality, type SettlementOverview, WHAT_IS_REAL } from "../../lib/settlement";
import { rpc, usdc, vaultAddress } from "../../lib/solana";
import { vaultStanding } from "../../lib/vault";
import { formatDateTime, formatNumber, formatTime, tr } from "../../i18n";

/** A percentage to two places: 0.50% or 0,50%. */
const pct2 = (value: number) => `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
/** Reais per USDC, in the Brazilian format in both languages. */
const reaisRate = (value: number, digits: number) =>
  `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;

// Where capital goes after it is allocated, and how it comes back: the legs
// that are real transactions on devnet, and the ones that are simulated or
// mocks, each labelled as such.

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
  return (
    <Panel title={tr({ en: "Global route · off-ramp simulator", pt: "Rota global · simulador de off-ramp" })}
      description={tr({
        en: "What a USDC release becomes in reais on her side of the global route, at MoneyGram's sandbox quote or at assumptions you set. The domestic route has no conversion: reais in, reais out.",
        pt: "Quanto uma liberação em USDC vira em reais do lado dela na rota global, pela cotação do sandbox da MoneyGram ou por premissas que você define. A rota doméstica não tem conversão: entra real, sai real.",
      })}>
      {/* What the market says now, so MoneyGram's rate and the demo's
          assumption can both be read against it. */}
      <MarketRate />
      <div role="radiogroup" aria-label={tr({ en: "Quote from", pt: "Cotação de" })} className="grid grid-cols-2 gap-1 rounded-xl border border-border p-1">
        {([
          ["moneygram", tr({ en: "MoneyGram sandbox", pt: "Sandbox da MoneyGram" }), tr({ en: "a live quote · cash pickup, $2–$500", pt: "cotação ao vivo · saque em dinheiro, US$ 2–500" })],
          ["demo", tr({ en: "Demo assumptions", pt: "Premissas da demo" }), tr({ en: "a quote and spread you set", pt: "cotação e spread definidos por você" })],
        ] as const).map(([key, label, hint]) => (
          <button key={key} type="button" role="radio" aria-checked={source === key} onClick={() => change(setSource)(key)}
            className={`rounded-lg px-2 py-1.5 text-left transition-colors ${source === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-[11px]">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="sim-usdc">{tr({ en: "USDC released", pt: "USDC liberados" })}</Label>
          <Input id="sim-usdc" type="number" min={0} step="1" value={amount} onChange={(e) => change(setAmount)(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        {source === "demo" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sim-fx" className="text-xs">{tr({ en: "Quote, R$ per USDC", pt: "Cotação, R$ por USDC" })}</Label>
              <Input id="sim-fx" type="number" min={0} step="0.01" value={fx} onChange={(e) => change(setFx)(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-spread" className="text-xs">{tr({ en: "Ramp spread, %", pt: "Spread da rampa, %" })}</Label>
              <Input id="sim-spread" type="number" min={0} step="0.05" value={spread} onChange={(e) => change(setSpread)(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </>
        )}
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="sim-tax" className="text-xs">{tr({ en: "Tax on the inbound conversion, % (an assumption to be validated)", pt: "Imposto sobre a conversão de entrada, % (premissa a validar)" })}</Label>
          <Input id="sim-tax" type="number" min={0} step="0.01" value={tax} onChange={(e) => change(setTax)(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>

      {source === "demo" ? (
        <div className="divide-y divide-border rounded-xl border border-border px-3">
          {row(tr({ en: "At the quote", pt: "Pela cotação" }), money(gross))}
          {row(tr({ en: `Ramp spread (${pct2(spread)})`, pt: `Spread da rampa (${pct2(spread)})` }), `− ${money(spreadCents)}`)}
          {row(tr({ en: `Tax (${pct2(tax)})`, pt: `Imposto (${pct2(tax)})` }), `− ${money(demoTax)}`)}
          {row(tr({ en: "Pix fee", pt: "Tarifa do Pix" }), money(0))}
          {row(tr({ en: "She receives by Pix", pt: "Ela recebe por Pix" }), money(demoNet), true)}
        </div>
      ) : !inRampRange(micro) ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3 text-sm">
          <p className="text-foreground">{tr({ en: "MoneyGram's sandbox quotes a transfer from 2 to 500 USDC.", pt: "O sandbox da MoneyGram cota transferências de 2 a 500 USDC." })}</p>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "A loan is released in larger amounts: switch to the demo assumptions for those, or quote a transfer MoneyGram would carry.",
              pt: "Um empréstimo é liberado em valores maiores: para esses, use as premissas da demo, ou cote uma transferência que a MoneyGram faria.",
            })}
          </p>
          <Button size="sm" variant="outline" onClick={() => change(setAmount)(micro < RAMP_MIN_MICRO_USDC ? 2 : 200)}>
            {tr({ en: "Quote", pt: "Cotar" })} {micro < RAMP_MIN_MICRO_USDC ? "2" : "200"} USDC
          </Button>
        </div>
      ) : quote.isError && !waiting ? (
        <LoadError compact error={quote.error} onRetry={() => quote.refetch()} />
      ) : (
        <div className="space-y-2" aria-live="polite" aria-busy={waiting}>
          <div className="divide-y divide-border rounded-xl border border-border px-3">
            {row(tr({ en: "Sent to MoneyGram", pt: "Enviado à MoneyGram" }), q ? usdc(q.send_micro_usdc) : "…")}
            {row(q ? tr({ en: `MoneyGram's fee (${pct2(rampFeeBps(q) / 100)})`, pt: `Taxa da MoneyGram (${pct2(rampFeeBps(q) / 100)})` })
              : tr({ en: "MoneyGram's fee", pt: "Taxa da MoneyGram" }), q ? `− ${usdc(q.fee_micro_usdc)}` : "…")}
            {row(q ? tr({
              en: `At MoneyGram's rate, ${reaisRate(q.brl_per_usdc, 4)}${q.rate_estimated ? " (estimated)" : ""}`,
              pt: `Pelo câmbio da MoneyGram, ${reaisRate(q.brl_per_usdc, 4)}${q.rate_estimated ? " (estimado)" : ""}`,
            }) : tr({ en: "At MoneyGram's rate", pt: "Pelo câmbio da MoneyGram" }), q ? money(q.receive_cents) : "…")}
            {row(tr({ en: `Tax (${pct2(tax)})`, pt: `Imposto (${pct2(tax)})` }), mg ? `− ${money(mg.tax_cents)}` : "…")}
            {row(tr({ en: "She receives", pt: "Ela recebe" }), mg ? money(mg.net_cents) : "…", true)}
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            {waiting ? <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" /> : <StatusPill tone={REALITY.sandbox.tone} dot={false}>{REALITY.sandbox.label}</StatusPill>}
            <span>
              {q ? tr({
                en: <>Quoted at {formatTime(q.quoted_at, { hour: "2-digit", minute: "2-digit" })} as <span title={q.service}>a cash pickup in Brazil</span>, the only delivery the sandbox prices there; the Pix to her account stays a mock. </>,
                pt: <>Cotado às {formatTime(q.quoted_at, { hour: "2-digit", minute: "2-digit" })} como <span title={q.service}>retirada em dinheiro no Brasil</span>, a única forma de entrega que o sandbox cota lá; o Pix para a conta dela continua fictício. </>,
              }) : tr({ en: "Asking MoneyGram's sandbox… ", pt: "Consultando o sandbox da MoneyGram… " })}
              {tr({ en: <>At the demo assumptions she would receive {money(demoNet)}.</>, pt: <>Pelas premissas da demo, ela receberia {money(demoNet)}.</> })}
            </span>
          </p>
        </div>
      )}

      <Button variant="secondary" className="w-full" disabled={net <= 0} onClick={() => setReceipt({ e2e: mockPixE2e(), at: new Date(), cents: net })}>
        <Receipt size={15} /> {tr({ en: "Run a mock Pix settlement", pt: "Simular uma liquidação por Pix fictícia" })}
      </Button>
      {receipt && (
        <div className="space-y-1.5 rounded-xl border border-dashed border-border p-3 text-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">{tr({ en: "Pix settled", pt: "Pix liquidado" })}</span>
            <StatusPill tone={REALITY.mock.tone}>{tr({ en: "Mock · no Pix was sent", pt: "Fictício · nenhum Pix foi enviado" })}</StatusPill>
          </div>
          <p className="num text-foreground">{money(receipt.cents)} → {tr({ en: "her business account, by Pix", pt: "conta do negócio dela, por Pix" })}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{receipt.e2e}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(receipt.at)} · {tr({ en: "end-to-end id in Pix's format, invented", pt: "ID end-to-end no formato do Pix, inventado" })}</p>
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
      <PageHeader
        meta={<PageEvidence family="settlement_quotes" />}
        eyebrow={tr({ en: "Investor console", pt: "Console do investidor" })} title={tr({ en: "Settlement", pt: "Liquidação" })}
        description={tr({
          en: "How capital reaches her business and comes back, by either route. Global P2P: deposits, releases and payouts are real transactions on Solana devnet, the conversion to reais is simulated (with a live MoneyGram sandbox quote in the simulator), and Pix is a mock. Domestic P2P: a simulated BRL pool and a mock Pix. Every screen says which is which.",
          pt: "Como o capital chega ao negócio dela e volta, pelas duas rotas. P2P Global: depósitos, liberações e repasses são transações reais na Solana devnet, a conversão para reais é simulada (com uma cotação ao vivo do sandbox da MoneyGram no simulador) e o Pix é fictício. P2P Doméstico: um pool em reais simulado e um Pix fictício. Cada tela diz o que é o quê.",
        })} />

      {!d ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={tr({ en: "Paid out to you", pt: "Repassado a você" })} value={usdc(d.mine.paid_out_micro_usdc)}
              hint={tr({
                en: `${d.mine.payouts} payout${d.mine.payouts === 1 ? "" : "s"} to your wallet`,
                pt: `${d.mine.payouts} ${d.mine.payouts === 1 ? "repasse" : "repasses"} para a sua carteira`,
              })} hintTone="positive" />
            <StatTile label={tr({ en: "On its way to you", pt: "A caminho de você" })} value={usdc(d.mine.due_micro_usdc)} hint={tr({ en: "instalments being paid out", pt: "parcelas sendo repassadas" })} />
            <StatTile label={tr({ en: "Held for you", pt: "Retido para você" })} value={usdc(d.mine.held_micro_usdc)}
              hint={tr({ en: "ZEC positions with no Solana wallet", pt: "posições em ZEC sem carteira Solana" })} hintTone={d.mine.held_micro_usdc ? "caution" : undefined} />
            {/* An investor asks one thing of this tile: is what I am owed
                covered? A vault holding more than the book claims answered that
                with a caution, which is the wrong answer. See lib/vault. */}
            {(() => {
              const standing = vaultStanding(chain.data?.micro, d.vault.in_vault_micro_usdc);
              return (
                <StatTile label={tr({ en: "In the vault", pt: "No cofre" })} value={chain.data ? usdc(chain.data.micro) : chain.isPending ? "…" : "—"}
                  hint={standing === "exact"
                    ? tr({ en: "matches every recorded movement", pt: "confere com cada movimentação registrada" })
                    : standing === "surplus"
                      ? tr({ en: "covers every recorded movement", pt: "cobre cada movimentação registrada" })
                      : tr({ en: `ledger says ${usdc(d.vault.in_vault_micro_usdc)}`, pt: `o livro-razão diz ${usdc(d.vault.in_vault_micro_usdc)}` })}
                  hintTone={standing === "short" ? "caution" : standing === "unknown" ? undefined : "positive"} />
              );
            })()}
          </div>

          <Panel title={tr({ en: "Domestic P2P · the route", pt: "P2P Doméstico · a rota" })}
            description={tr({ en: "Brazilian investors' capital, in reais: no wallet, no conversion.", pt: "Capital de investidores brasileiros, em reais: sem carteira, sem conversão." })}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              <Node icon={Landmark} title={tr({ en: "Brazilian investors", pt: "Investidores brasileiros" })} reality="simulated">
                {tr({ en: "A BRL pool, allocated in reais. No bank transfer in this prototype.", pt: "Um pool em reais, alocado em reais. Sem transferência bancária neste protótipo." })}
              </Node>
              <Arrow label={tr({ en: "allocation", pt: "alocação" })} />
              <Node icon={Vault} title={tr({ en: "P2P structure", pt: "Estrutura P2P" })} reality="simulated">
                {tr({
                  en: "Formalised and serviced by EmpowerFI's P2P desk, at the allocation engine's rate.",
                  pt: "Formalizado e acompanhado pela mesa P2P da EmpowerFI, à taxa do Motor de Alocação de Capital.",
                })}
              </Node>
              <Arrow label="Pix" />
              <Node icon={Store} title={tr({ en: "Her business", pt: "O negócio dela" })} reality="mock">
                {tr({ en: "Receives and repays in reais, by Pix.", pt: "Recebe e paga em reais, por Pix." })}
              </Node>
            </div>
          </Panel>

          <Panel title={tr({ en: "Global P2P · the route", pt: "P2P Global · a rota" })}
            description={tr({
              en: "Out to her business when EmpowerFI's P2P desk disburses, and back to investors with each instalment.",
              pt: "Vai para o negócio dela quando a mesa P2P da EmpowerFI desembolsa, e volta aos investidores a cada parcela.",
            })}>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              <Node icon={Wallet} title={tr({ en: "Investors", pt: "Investidores" })} reality="real">
                {tr({
                  en: <>{usdc(d.vault.deposits_micro_usdc)} deposited by wallet or shielded ZEC, and not refunded.</>,
                  pt: <>{usdc(d.vault.deposits_micro_usdc)} depositados por carteira ou ZEC blindado, e não reembolsados.</>,
                })}
              </Node>
              <Arrow label={tr({ en: "deposit", pt: "depósito" })} />
              <Node icon={Vault} title={tr({ en: "Program vault", pt: "Cofre do programa" })} reality="real">
                {tr({ en: "Holds", pt: "Guarda" })} {chain.data ? usdc(chain.data.micro) : "…"}. {chain.data && <ExplorerLink address={chain.data.vault} />}
              </Node>
              <Arrow label={tr({ en: "release, batched", pt: "liberação, em lote" })} />
              <Node icon={Landmark} title={tr({ en: "Regulated off-ramp", pt: "Off-ramp regulado" })} reality="simulated">
                {tr({
                  en: `${usdc(d.vault.released_micro_usdc)} released, turned into reais at ${money(d.fx_brl_per_usdc_milli / 10)} less ${pct2(d.ramp_bps / 100)}. The simulator prices it with MoneyGram's sandbox.`,
                  pt: `${usdc(d.vault.released_micro_usdc)} liberados, convertidos em reais a ${money(d.fx_brl_per_usdc_milli / 10)}, menos ${pct2(d.ramp_bps / 100)}. O simulador cota com o sandbox da MoneyGram.`,
                })}
              </Node>
              <Arrow label="Pix" />
              <Node icon={Store} title={tr({ en: "Her business", pt: "O negócio dela" })} reality="mock">
                {tr({
                  en: `${d.pix.payouts} loan${d.pix.payouts === 1 ? "" : "s"} paid by Pix, ${money(d.pix.payout_cents)}.`,
                  pt: `${d.pix.payouts} ${d.pix.payouts === 1 ? "empréstimo pago" : "empréstimos pagos"} por Pix, ${money(d.pix.payout_cents)}.`,
                })}
              </Node>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{tr({ en: "Back:", pt: "Volta:" })}</span>
              <span>{tr({
                en: `${d.pix.ins} instalments by Pix (${money(d.pix.in_cents)}, mock)`,
                pt: `${d.pix.ins} parcelas por Pix (${money(d.pix.in_cents)}, fictício)`,
              })}</span>
              <ArrowRight size={12} aria-hidden />
              <span>{tr({
                en: `the ramp returns real investors' shares to the vault, ${usdc(d.vault.repaid_in_micro_usdc)}`,
                pt: `a rampa devolve ao cofre as partes dos investidores reais, ${usdc(d.vault.repaid_in_micro_usdc)}`,
              })}</span>
              <ArrowRight size={12} aria-hidden />
              <span>{tr({
                en: `paid out to their wallets in the same transaction, ${usdc(d.vault.paid_out_micro_usdc)}`,
                pt: `repassadas às carteiras deles na mesma transação, ${usdc(d.vault.paid_out_micro_usdc)}`,
              })}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr({
                en: "Releases leave in one transfer for every loan disbursed at the same time, so no transfer's amount is a loan's principal. Simulated positions move no USDC.",
                pt: "As liberações saem numa única transferência para todos os empréstimos desembolsados ao mesmo tempo, então nenhum valor transferido é o principal de um empréstimo. Posições simuladas não movimentam USDC.",
              })}
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Simulator fxMilli={d.fx_brl_per_usdc_milli} rampBps={d.ramp_bps} />

            <Panel title={tr({ en: "What is real in this demo", pt: "O que é real nesta demo" })}
              description={tr({
                en: "Leg by leg: a transaction you can open on an explorer, a figure at an assumed quote, or a mock.",
                pt: "Etapa por etapa: uma transação que você pode abrir num explorer, um valor a uma cotação assumida, ou algo fictício.",
              })}>
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

          <Panel title={tr({ en: "Vault transfers", pt: "Transferências do cofre" })}
            description={tr({
              en: "The operator-signed transactions that moved USDC out of the vault, newest first.",
              pt: "As transações assinadas pelo operador que tiraram USDC do cofre, das mais recentes para as mais antigas.",
            })}>
            {d.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr({
                  en: "No release or payout yet: they start when EmpowerFI's P2P desk disburses a global loan with real deposits.",
                  pt: "Nenhuma liberação ou repasse ainda: eles começam quando a mesa P2P da EmpowerFI desembolsa um empréstimo global com depósitos reais.",
                })}
              </p>
            ) : (
              <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">{tr({ en: "Transfer", pt: "Transferência" })}</th>
                      <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Out of the vault", pt: "Saída do cofre" })}</th>
                      <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Back in", pt: "Retorno" })}</th>
                      <th className="py-2 pr-4 font-medium">{tr({ en: "State", pt: "Situação" })}</th>
                      <th className="py-2 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...d.transfers].sort((a, b) => b.id - a.id).map((t) => (
                      <tr key={t.id}>
                        <td className="py-2.5 pr-4">
                          <span className="block text-foreground">
                            {t.kind === "release"
                              ? tr({ en: `Release · ${t.legs} loan${t.legs === 1 ? "" : "s"}`, pt: `Liberação · ${t.legs} ${t.legs === 1 ? "empréstimo" : "empréstimos"}` })
                              : tr({ en: `Payout · ${t.legs} investor${t.legs === 1 ? "" : "s"}`, pt: `Repasse · ${t.legs} ${t.legs === 1 ? "investidor" : "investidores"}` })}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(t.at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </td>
                        <td className="num py-2.5 pr-4 text-right text-foreground">{usdc(t.outflow_micro_usdc)}</td>
                        <td className="num py-2.5 pr-4 text-right text-muted-foreground">{t.inflow_micro_usdc ? usdc(t.inflow_micro_usdc) : "—"}</td>
                        <td className="py-2.5 pr-4">
                          <StatusPill tone={t.status === "confirmed" ? "positive" : t.status === "failed" ? "alert" : "caution"}>
                            {t.status === "confirmed" ? tr({ en: "Confirmed", pt: "Confirmada" }) : t.status === "failed" ? tr({ en: "Failed", pt: "Falhou" }) : tr({ en: "Sending", pt: "Enviando" })}
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
