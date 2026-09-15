import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Loader2, MapPin, ShieldCheck } from "lucide-react";
import LoadError from "../../components/LoadError";
import { DataTag } from "../../components/product/DataLegend";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { DECISION_LABEL, ELIGIBILITY_REASON, percent } from "../../lib/credit";
import { FUNDING_LABEL, PROOF_LABEL, type Proof, reaisFromUsdc, RISK, title } from "../../lib/investor";
import { money } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import FundingBar from "./FundingBar";
import InvestPanel from "./InvestPanel";
import { useMarket } from "./queries";

// What an investor needs to decide, and nothing more: the purpose, the size,
// EmpowerFI's assessment, the community that vouches for her — and the proof
// that each was done, on Solana. Never her name, her words or her figures.

const WHY: Record<string, string> = {
  working_capital: "Working capital to keep the business running between sales: materials, stock and day-to-day costs.",
  inventory: "Stock and materials bought ahead, to sell more or produce at better prices.",
  equipment: "Equipment that raises what the business can produce or serve in a week.",
  renovation: "Improvements to the space where the business works.",
  other: "A productive use the entrepreneur described to her community.",
};

function Field({ label, children, kind }: { label: string; children: React.ReactNode; kind: "derived" | "proven" | "private" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground"><DataTag kind={kind} /> {label}</span>
      <span className="num text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const market = useMarket();
  if (market.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  if (market.isError) return <LoadError error={market.error} onRetry={() => market.refetch()} />;
  const row = market.data.find((o) => o.opportunity_id === id);
  if (!row) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-muted-foreground">This opportunity is not in the market.</p>
        <Link to="/app/investor/opportunities" className="text-sm text-info">Back to opportunities</Link>
      </div>
    );
  }
  const risk = RISK[row.risk_band];
  const decision = DECISION_LABEL[row.eligibility_decision];
  const proofs = (row.proofs as unknown as Proof[]) ?? [];
  const exceptions = row.eligibility_reasons.filter((r) => !["AFFORDABLE"].includes(r));
  const consent = proofs.find((p) => p.kind === "consent");

  return (
    <div className="space-y-6">
      <Link to="/app/investor/opportunities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Opportunities
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="panel space-y-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{title(row.purpose, row.business_sector)}</h1>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span className="font-mono">{row.code}</span> ·
                  <span className="inline-flex items-center gap-1"><MapPin size={13} /> {row.community_name} ({row.community_city}, {row.community_state})</span>
                  <BadgeCheck size={14} className="text-positive" aria-label="verified community" />
                </p>
              </div>
              <StatusPill tone={FUNDING_LABEL[row.funding_status].tone}>{FUNDING_LABEL[row.funding_status].label}</StatusPill>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Requested</p>
                <p className="num font-heading text-xl font-bold text-primary">{usdc(row.funding_target_micro_usdc, 0)}</p>
                <p className="num text-xs text-muted-foreground">{money(row.amount_cents)} at R$ {(row.fx_brl_per_usdc_milli ?? 0) / 1000}/USDC demo</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Term</p>
                <p className="num font-heading text-xl font-bold text-foreground">{row.term_months} months</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risk band</p>
                <p className={`font-heading text-xl font-bold text-${risk.tone}`}>{risk.grade}</p>
                <p className="text-xs text-muted-foreground">{row.confidence.toLowerCase()} confidence</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Readiness</p>
                <p className="num font-heading text-xl font-bold text-info">{row.readiness_score ?? "—"}<span className="text-sm">/100</span></p>
                <p className="text-xs text-muted-foreground">band {row.readiness_band?.toLowerCase()}</p>
              </div>
            </div>

            <FundingBar funded={row.funded_micro_usdc} target={row.funding_target_micro_usdc} investors={row.investors} />

            <div className="space-y-2 border-t border-border pt-5">
              <h2 className="font-heading text-base font-bold text-foreground">Why this capital?</h2>
              <p className="text-sm text-muted-foreground">{WHY[row.purpose]}</p>
              <p className="text-xs text-muted-foreground">
                <DataTag kind="private" /> Her own description of the need stays with her community and the partner.
              </p>
            </div>

            <div className="space-y-2 border-t border-border pt-5">
              <h2 className="font-heading text-base font-bold text-foreground">Underwriting snapshot</h2>
              <div>
                <Field label="Data quality" kind="derived">{row.records_kept_bps !== null ? `${percent(row.records_kept_bps)} of months with records` : "—"}</Field>
                <Field label="Affordability" kind="derived">{percent(row.affordability_bps)} of the monthly result</Field>
                <Field label="Check-in regularity" kind="derived">{row.months_reported ?? 0}/6 months reported</Field>
                <Field label="EmpowerFI assessment" kind="proven">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${decision.tone}`}>{decision.title}</span>
                </Field>
                <Field label="Manual exceptions" kind="derived">{exceptions.length === 0 ? "None" : exceptions.length}</Field>
                <Field label="Instalment, sized by the engine" kind="derived">{row.term_months} × {money(row.instalment_cents)}</Field>
              </div>
              {exceptions.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {exceptions.map((r) => (
                    <li key={r} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{ELIGIBILITY_REASON[r] ?? r}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <Panel title="What you can see, and what stays private"
            description="Investors get the decision-relevant snapshot and cryptographic evidence — never identity, bank data or the financial history behind it.">
            <div className="grid gap-4 sm:grid-cols-2">
              <ul className="space-y-2 text-sm">
                <li className="font-medium text-foreground">You see</li>
                {["Purpose, sector and size", "The verified community", "Readiness score and band", "Risk band, confidence, affordability", "Proofs of each assessment on Solana"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="derived" /> {t}</li>
                ))}
              </ul>
              <ul className="space-y-2 text-sm">
                <li className="font-medium text-foreground">Stays private</li>
                {["Her name, CPF and contacts", "Her business name and address", "Reported sales, costs and household spending", "Bank and Pix details", "Her own words about the need"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="private" /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-4 text-sm">
              <ShieldCheck size={16} className="text-positive" aria-hidden />
              <span className="text-foreground">Shown here because she allowed it.</span>
              <span className="text-muted-foreground">
                If she withdraws that, it leaves the market and investors are refunded from the vault, unless the loan has been paid out.
              </span>
              {consent?.signature && <ExplorerLink tx={consent.signature} label="Her consent, on Solana" />}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <InvestPanel row={row} />
          <Panel title="Indicative yield · simulated">
            <p className="num font-heading text-3xl font-bold text-foreground">{percent(row.indicative_yield_bps)} <span className="text-sm font-normal text-muted-foreground">a year</span></p>
            <p className="text-xs text-muted-foreground">
              In reais, before currency effects: the reference rate less expected loss for band {risk.grade} and servicing.
              {row.my_micro_usdc > 0 && <> You hold {usdc(row.my_micro_usdc)} ({money(reaisFromUsdc(row.my_micro_usdc, row.fx_brl_per_usdc_milli))}).</>}
            </p>
          </Panel>
          <Panel title="Verifiable evidence" description="Each assessment's commitment is on Solana; the record behind it stays private.">
            <ul className="space-y-3">
              {proofs.map((p) => (
                <li key={p.kind} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="block text-foreground">{PROOF_LABEL[p.kind] ?? p.kind}</span>
                    {p.signature && <ExplorerLink tx={p.signature} />}
                  </span>
                  <StatusPill tone={p.reconcile === "verified" ? "positive" : p.status === "confirmed" ? "positive" : "caution"}>
                    {p.reconcile === "verified" ? "Verified" : p.status === "confirmed" ? "On-chain" : "Queued"}
                  </StatusPill>
                </li>
              ))}
              <li className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Model versions</span>
                <span className="font-mono text-xs text-foreground">{row.readiness_model} · {row.eligibility_model}</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
