import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, tr } from "../../i18n";
import LoadError from "../../components/LoadError";
import PageEvidence from "../../components/product/PageEvidence";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import PoolPill from "../../components/product/PoolPill";
import StatusPill from "../../components/product/StatusPill";
import { POOL, poolOf, positionReais } from "../../lib/capital";
import { type PortfolioRow, positionState, RISK, title } from "../../lib/investor";
import { money, PURPOSE_LABEL, type CreditPurpose } from "../../lib/readiness";
import { usdc } from "../../lib/solana";
import { usePortfolio } from "./queries";
import EvcLabel from "../../components/product/EvcLabel";


export default function Portfolio() {
  const portfolio = usePortfolio();
  const navigate = useNavigate();
  if (portfolio.isError) return <LoadError error={portfolio.error} onRetry={() => portfolio.refetch()} />;
  const p = portfolio.data;
  const rows = p?.rows ?? [];
  const count = (f: (r: PortfolioRow) => boolean) => rows.filter(f).length;
  const byPurpose = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.purpose]: (acc[r.purpose] ?? 0) + r.amount_micro_usdc }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const total = Math.max(1, rows.reduce((s, r) => s + r.amount_micro_usdc, 0));
  const reaisOf = (r: PortfolioRow) => positionReais(r.amount_cents, r.amount_micro_usdc, r.fx_brl_per_usdc_milli) ?? 0;
  const domesticRows = rows.filter((r) => r.funding_pool === "domestic");
  const globalRows = rows.filter((r) => r.funding_pool !== "domestic");

  return (
    <div className="space-y-6">
      <PageHeader
        meta={<PageEvidence family="loans_and_instalments" />}
        eyebrow={tr({ en: "Investor Console", pt: "Console do Investidor" })} title={tr({ en: "Portfolio", pt: "Carteira" })}
        description={tr({
          en: "Every position you hold, by funding route: what it funds, where the loan stands, what has come back to you, and the proof of each step. Returns are simulated.",
          pt: "Todas as suas posições, por rota de captação: o que cada uma financia, em que pé está o empréstimo, o que já voltou para você e a prova de cada etapa. Os retornos são simulados.",
        })} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {p ? (
          <>
            <StatTile label={tr({ en: "Active", pt: "Ativas" })} value={count((r) => r.loan_status === "ACTIVE" || r.loan_status === "DISBURSED")}
              hint={tr({ en: "repaying or disbursed", pt: "em pagamento ou desembolsadas" })} />
            <StatTile label={tr({ en: "Raising", pt: "Captando" })} value={count((r) => r.status === "allocated" && (!r.loan_status || r.loan_status === "PARTNER_APPROVED"))}
              hint={tr({ en: "before disbursement", pt: "antes do desembolso" })} />
            <StatTile label={tr({ en: "Paid off", pt: "Quitadas" })} value={count((r) => r.loan_status === "PAID")} hintTone="positive"
              hint={tr({ en: "fully repaid", pt: "totalmente pagas" })} />
            <StatTile label={tr({ en: "Delinquent / defaulted", pt: "Em atraso / inadimplentes" })} value={count((r) => r.loan_status === "DEFAULTED")} hintTone="alert" />
            <StatTile label={tr({ en: "Refunded", pt: "Reembolsadas" })} value={count((r) => r.status !== "allocated")} hintTone="caution"
              hint={tr({ en: "declined or withdrawn", pt: "recusadas ou retiradas" })} />
          </>
        ) : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl bg-card" />)}
      </div>

      {p && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title={tr({ en: "Principal", pt: "Principal" })}>
            <dl className="num grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">{POOL.global.route}</dt>
              <dd className="text-right text-foreground">{usdc(globalRows.reduce((n, r) => n + r.amount_micro_usdc, 0))}</dd>
              {/* This console allocates in USDC. A position in reais can only
                  be one held from before the route closed here, so the line
                  appears when there is one and not as a permanent zero. */}
              {domesticRows.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{POOL.domestic.route} · {tr({ en: "simulated", pt: "simulado" })}</dt>
                  <dd className="text-right text-foreground">{money(domesticRows.reduce((n, r) => n + reaisOf(r), 0))}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{tr({ en: "Invested, in USDC terms", pt: "Investido, em USDC" })}</dt><dd className="text-right text-foreground">{usdc(p.invested_micro_usdc)}</dd>
              <dt className="text-muted-foreground">{tr({ en: "Deployed", pt: "Aplicado" })}</dt><dd className="text-right text-foreground">{usdc(p.deployed_micro_usdc)}</dd>
              <dt className="text-muted-foreground">{tr({ en: "Repaid to you", pt: "Pago a você" })}</dt><dd className="text-right text-positive">{usdc(p.repaid_micro_usdc)}</dd>
              <dt className="text-muted-foreground">{tr({ en: "Expected · simulated", pt: "Esperado · simulado" })}</dt><dd className="text-right text-foreground">{usdc(p.expected_micro_usdc)}</dd>
            </dl>
          </Panel>
          <Panel title={tr({ en: "By purpose", pt: "Por finalidade" })}>
            <ul className="space-y-2.5">
              {byPurpose.map(([purpose, micro]) => (
                <li key={purpose} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{PURPOSE_LABEL[purpose as CreditPurpose]}</span>
                    <span className="num text-foreground">{Math.round((micro / total) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-gold" style={{ width: `${(micro / total) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={tr({ en: "By risk band", pt: "Por faixa de risco" })}>
            <ul className="space-y-2.5">
              {(["LOW", "MEDIUM", "HIGH"] as const).map((b) => {
                const micro = Number(p.by_risk[b] ?? 0);
                return (
                  <li key={b} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{RISK[b].label}</span>
                      <span className="num text-foreground">{Math.round((micro / total) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary"><div className={`h-full rounded-full ${RISK[b].bar}`} style={{ width: `${(micro / total) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      <Panel title={tr({ en: "Positions", pt: "Posições" })}>
        {p && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {tr({ en: "No positions yet.", pt: "Nenhuma posição ainda." })}{" "}
            <Link to="/app/investor/opportunities" className="text-info hover:underline">{tr({ en: "Browse opportunities →", pt: "Ver oportunidades →" })}</Link>
          </p>
        )}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Opportunity", pt: "Oportunidade" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Route", pt: "Rota" })}</th>
                <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Invested", pt: "Investido" })}</th>
                <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Share", pt: "Participação" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "State", pt: "Situação" })}</th>
                <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Repaid", pt: "Pago" })}</th>
                <th className="py-2 pr-4 text-right font-medium"><EvcLabel /></th>
                <th className="py-2 font-medium"><span className="sr-only">{tr({ en: "Open", pt: "Abrir" })}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const state = positionState(r);
                const to = `/app/investor/positions/${r.investment_id}`;
                // The whole row answers a click; the title is the real link, for
                // the keyboard and for screen readers.
                return (
                  <tr key={r.investment_id} className="cursor-pointer hover:bg-secondary/40" onClick={() => navigate(to)}>
                    <td className="py-3 pr-4">
                      <Link to={to} onClick={(e) => e.stopPropagation()}
                        className="block font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none">
                        {title(r.purpose, r.business_sector)}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                      {r.is_simulated && <span className="ml-2 text-xs text-caution">{tr({ en: "simulated", pt: "simulada" })}</span>}
                      {r.mode === "zcash" && <span className="ml-2 text-xs text-info">{tr({ en: "shielded ZEC", pt: "ZEC blindado" })}</span>}
                    </td>
                    <td className="py-3 pr-4"><PoolPill pool={poolOf(r.funding_pool)} /></td>
                    <td className="num py-3 pr-4 text-right text-foreground">{r.funding_pool === "domestic" ? money(reaisOf(r)) : usdc(r.amount_micro_usdc)}</td>
                    <td className="num py-3 pr-4 text-right text-muted-foreground">{formatNumber(r.share_bps / 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      {r.loan_status && ["ACTIVE", "PAID"].includes(r.loan_status) && (
                        <span className="num ml-2 text-xs text-muted-foreground">{r.paid}/{r.term_months}</span>
                      )}
                    </td>
                    <td className="num py-3 pr-4 text-right text-positive">{r.repaid_micro_usdc ? usdc(r.repaid_micro_usdc) : "—"}</td>
                    <td className="num py-3 pr-4 text-right text-muted-foreground">{r.evc_cents !== null ? money(r.evc_cents) : "—"}</td>
                    <td className="py-3 text-right text-muted-foreground"><ChevronRight size={16} aria-hidden /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
