import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { LOAN_LABEL, percent, type LoanStatus } from "../lib/credit";
import { platform } from "../lib/platform";
import { money, PURPOSE_LABEL, type CreditPurpose } from "../lib/readiness";
import LoadError from "../components/LoadError";

// The capital provider's view: what its capital funds, in aggregate and loan
// by loan under a code of the loan's own. Nothing here names or points to a
// person; the proofs are open to audit. The capital is simulated and says so.

type Band = "LOW" | "MEDIUM" | "HIGH";
interface Slice { loans: number; principal_cents: number }
interface Portfolio {
  is_simulated: boolean;
  committed_cents: number;
  target_return_bps: number | null;
  deployed_cents: number;
  available_cents: number;
  approved_not_disbursed_cents: number;
  approved_not_disbursed: number;
  received_cents: number;
  principal_repaid_cents: number;
  outstanding_cents: number;
  defaulted_cents: number;
  loans: number;
  average_ticket_cents: number | null;
  repayment: { instalments_received: number; instalments_due: number; on_time_bps: number | null; par30_cents: number; par30_bps: number };
  expected: { interest_cents: number; loss_cents: number; net_cents: number; net_return_bps_year: number | null; loss_bps_by_band: Record<Band, number> };
  by_risk: Partial<Record<Band, Slice>>;
  by_purpose: Partial<Record<CreditPurpose, Slice>>;
  by_community: { name: string; city: string; state: string; verified: boolean; loans: number; principal_cents: number }[];
  cost: { total_cents: number; by_phase: { preparation: number; origination: number; servicing: number }; per_loan_cents: number | null; per_1000_deployed_cents: number | null };
  audit: { facts: number; confirmed: number; reconciled: number; discrepancies: number };
  book: {
    loan_id: string; code: string; status: LoanStatus; principal_cents: number; term_months: number; rate_bps: number;
    instalment_cents: number; paid: number; risk_band: Band; purpose: CreditPurpose; community_name: string | null;
    disbursed_at: string | null; over_30: boolean;
  }[];
}

const loans = (n: number) => `${n} ${n === 1 ? "loan" : "loans"}`;

const BAND_LABEL: Record<Band, string> = { LOW: "Low risk", MEDIUM: "Medium risk", HIGH: "High risk" };
const BAND_TONE: Record<Band, string> = { LOW: "bg-emerald-600", MEDIUM: "bg-amber-500", HIGH: "bg-rose-600" };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3 rounded-2xl p-6 glass glow-border">
      <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
      {children}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}

function Bar({ label, value, share, tone = "bg-accent" }: { label: string; value: string; share: number; tone?: string }) {
  return (
    <li className="space-y-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </li>
  );
}

export default function CapitalPage() {
  const portfolio = useQuery({
    queryKey: ["platform", "capital-portfolio"],
    queryFn: async () => {
      const { data, error } = await platform.rpc("capital_portfolio");
      if (error) throw error;
      return data as unknown as Portfolio;
    },
  });

  if (portfolio.isPending) return <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />;
  if (portfolio.isError) return <LoadError error={portfolio.error} onRetry={() => portfolio.refetch()} />;
  const p = portfolio.data;
  const deployedShare = (cents: number) => (p.deployed_cents > 0 ? cents / p.deployed_cents : 0);
  const phaseTotal = Math.max(1, p.cost.by_phase.preparation + p.cost.by_phase.origination + p.cost.by_phase.servicing);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Capital</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-bold text-foreground">Portfolio</h1>
          {p.is_simulated && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
              Simulated capital · demo data
            </span>
          )}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          What your capital funds, through the partner that lends it. Loans appear under a code of their own — terms,
          repayment and proofs, never a person. Every loan, status change and payment can be checked against Solana.
        </p>
      </div>

      {p.committed_cents === 0 && (
        <p className="rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted-foreground">
          No capital committed yet. Once a commitment is recorded, the loans it funds appear here.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Committed" value={money(p.committed_cents)} note={p.target_return_bps !== null ? `target ${percent(p.target_return_bps)} a year` : undefined} />
        <Stat label="Deployed" value={money(p.deployed_cents)} note={loans(p.loans)} />
        <Stat label="Available" value={money(p.available_cents)} note="committed − principal still out" />
        <Stat label="Received" value={money(p.received_cents)} note={`${money(p.principal_repaid_cents)} of it principal`} />
        <Stat label="Outstanding" value={money(p.outstanding_cents)} note="principal on live loans" />
        <Stat label="Average ticket" value={money(p.average_ticket_cents)} />
      </div>
      {p.approved_not_disbursed > 0 && (
        <p className="-mt-6 text-sm text-muted-foreground">
          Approved by the partner and not yet disbursed: {money(p.approved_not_disbursed_cents)} ({loans(p.approved_not_disbursed)}).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Repayment" note="Instalments fall due monthly from the start of repayment. PAR 30: principal of loans with an instalment more than 30 days late.">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <span><span className="block text-xs text-muted-foreground">Instalments received</span>{p.repayment.instalments_received}</span>
            <span><span className="block text-xs text-muted-foreground">Fallen due</span>{p.repayment.instalments_due}</span>
            <span><span className="block text-xs text-muted-foreground">Paid when due</span>{p.repayment.instalments_due > 0 ? percent(p.repayment.on_time_bps) : "none due yet"}</span>
            <span><span className="block text-xs text-muted-foreground">PAR 30</span>{percent(p.repayment.par30_bps)}</span>
          </div>
          {p.defaulted_cents > 0 && <p className="text-sm text-rose-700">Defaulted principal: {money(p.defaulted_cents)}</p>}
        </Card>

        <Card title="Risk mix" note="EmpowerFI's risk band at eligibility, weighted by principal. The lending decision was the partner's.">
          <ul className="space-y-2">
            {(["LOW", "MEDIUM", "HIGH"] as Band[]).map((b) => (
              <Bar key={b} label={BAND_LABEL[b]} tone={BAND_TONE[b]}
                value={`${money(p.by_risk[b]?.principal_cents ?? 0)} · ${loans(p.by_risk[b]?.loans ?? 0)}`}
                share={deployedShare(p.by_risk[b]?.principal_cents ?? 0)} />
            ))}
          </ul>
        </Card>

        <Card title="Expected return · simulated"
          note={`Scheduled interest on deployed loans, less expected loss at pilot assumptions (${(["LOW", "MEDIUM", "HIGH"] as Band[]).map((b) => `${b.toLowerCase()} ${percent(p.expected.loss_bps_by_band[b])}`).join(", ")} of principal). The portfolio's yield at the partner's rates, before the partner's and EmpowerFI's fees and the cost to serve: not a forecast of what capital earns, and not a promise.`}>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <span><span className="block text-xs text-muted-foreground">Interest scheduled</span>{money(p.expected.interest_cents)}</span>
            <span><span className="block text-xs text-muted-foreground">Expected loss</span>{money(p.expected.loss_cents)}</span>
            <span><span className="block text-xs text-muted-foreground">Net</span>{money(p.expected.net_cents)}</span>
            <span><span className="block text-xs text-muted-foreground">Net yield a year</span>{percent(p.expected.net_return_bps_year)}</span>
          </div>
        </Card>

        <Card title="Cost to serve" note="Counted from the communities' first day: preparing the people who never borrow is part of what small credit costs. Pilot rate card.">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <span><span className="block text-xs text-muted-foreground">Total</span>{money(p.cost.total_cents)}</span>
            <span><span className="block text-xs text-muted-foreground">Per loan</span>{money(p.cost.per_loan_cents)}</span>
            <span><span className="block text-xs text-muted-foreground">Per R$ 1,000 lent</span>{money(p.cost.per_1000_deployed_cents)}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-border" aria-label="Cost by phase">
            <div className="bg-accent" style={{ width: `${(p.cost.by_phase.preparation / phaseTotal) * 100}%` }} />
            <div className="bg-primary" style={{ width: `${(p.cost.by_phase.origination / phaseTotal) * 100}%` }} />
            <div className="bg-emerald-600" style={{ width: `${(p.cost.by_phase.servicing / phaseTotal) * 100}%` }} />
          </div>
          <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span>■ preparation {money(p.cost.by_phase.preparation)}</span>
            <span>■ origination {money(p.cost.by_phase.origination)}</span>
            <span>■ servicing {money(p.cost.by_phase.servicing)}</span>
          </p>
        </Card>

        <Card title="Where it went">
          <ul className="space-y-2">
            {p.by_community.map((c) => (
              <Bar key={c.name} share={deployedShare(c.principal_cents)} value={`${money(c.principal_cents)} · ${loans(c.loans)}`}
                label={`${c.name} (${c.city}, ${c.state})${c.verified ? " · verified" : ""}`} />
            ))}
          </ul>
          <ul className="space-y-2 border-t border-border pt-3">
            {Object.entries(p.by_purpose).map(([purpose, s]) => (
              <Bar key={purpose} tone="bg-primary" share={deployedShare(s!.principal_cents)} value={`${money(s!.principal_cents)} · ${loans(s!.loans)}`}
                label={PURPOSE_LABEL[purpose as CreditPurpose]} />
            ))}
          </ul>
        </Card>

        <Card title="Audit trail">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
            <p className="text-sm text-foreground">
              {p.audit.confirmed} of {p.audit.facts} loans, status changes and payments are proven on Solana
              {p.audit.reconciled > 0 && <>; {p.audit.reconciled} re-checked against the chain since</>}
              {p.audit.discrepancies > 0 && <span className="text-rose-700">; {p.audit.discrepancies} did not match</span>}.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Each proof holds a hash of the record, never the record: open any loan below and your browser recomputes it.
          </p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold text-foreground">Loans</h2>
        {p.book.length === 0 && <p className="text-sm text-muted-foreground">No loans yet.</p>}
        <div className="relative overflow-x-auto rounded-2xl border border-border bg-background/60">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Loan</th>
                <th className="px-4 py-3 font-medium">Community · purpose</th>
                <th className="px-4 py-3 font-medium">Terms</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Proof</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.book.map((l) => (
                <tr key={l.loan_id}>
                  <td className="px-4 py-3 font-medium text-foreground">{l.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.community_name ?? "—"} · {PURPOSE_LABEL[l.purpose].toLowerCase()}</td>
                  <td className="px-4 py-3">{money(l.principal_cents)} · {l.term_months} × {money(l.instalment_cents)} at {(l.rate_bps / 100).toFixed(1)}%/month</td>
                  <td className="px-4 py-3">{l.risk_band.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    {LOAN_LABEL[l.status]}
                    {["ACTIVE", "PAID", "DEFAULTED"].includes(l.status) && <span className="text-muted-foreground"> · {l.paid}/{l.term_months}</span>}
                    {l.over_30 && <span className="ml-1 text-rose-700">· late</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/app/audit/loan/${l.loan_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <BadgeCheck size={14} /> Verify
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
