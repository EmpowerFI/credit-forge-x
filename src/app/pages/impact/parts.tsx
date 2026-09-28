import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, EyeOff, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import EvcLabel from "../../components/product/EvcLabel";
import Panel from "../../components/product/Panel";
import PoolPill from "../../components/product/PoolPill";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import VerifyOnSolana from "../../components/product/VerifyOnSolana";
import VerifyButton from "../../components/proof/VerifyButton";
import { formatDateTime, formatNumber, tr } from "../../i18n";
import { PROOF_KIND_LABEL } from "../../lib/audit";
import { bpsPercent, POOL } from "../../lib/capital";
import { LOAN_LABEL, type LoanStatus } from "../../lib/credit";
import {
  EVIDENCE_GROUPS, FUNNEL_LABEL, type ImpactIntelligence, SEGMENT_KEY, SEGMENT_TITLE, type SegmentGroup, type SegmentId,
} from "../../lib/impact";
import { FUNDING_LABEL, RISK } from "../../lib/investor";
import { money, PURPOSE_LABEL, sectorLabel, STATUS_LABEL, type CreditPurpose, type ReadinessStatus } from "../../lib/readiness";

const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber(Math.round((part / whole) * 100))}%` : "—");

/** Sponsored → … → performing, each bar the businesses that reached at least that stage. */
export function Funnel({ data }: { data: ImpactIntelligence }) {
  const top = Math.max(1, data.funnel[0]?.n ?? 1);
  return (
    <Panel id="funnel" className="lg:col-span-3" title={tr({ en: "From sponsored to performing", pt: "De patrocinadas a em dia" })}
      description={tr({
        en: "Businesses that reached at least each stage, from the program's first day to a loan repaying on schedule.",
        pt: "Negócios que chegaram pelo menos a cada etapa, do primeiro dia do programa a um empréstimo pago em dia.",
      })}>
      <ol className="space-y-2.5">
        {data.funnel.map((f, i) => {
          const prev = i > 0 ? data.funnel[i - 1].n : f.n;
          const credit = i >= 4;
          return (
            <li key={f.stage} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_6rem]">
              <span className="truncate text-muted-foreground" title={FUNNEL_LABEL[f.stage].hint}>{FUNNEL_LABEL[f.stage].label}</span>
              <div className="h-6 overflow-hidden rounded-md bg-secondary/50">
                <div className={cn("h-full origin-left rounded-md animate-in slide-in-from-left fill-mode-both motion-reduce:animate-none",
                  credit ? "bg-accent/80" : "bg-info/50")}
                  style={{ width: `${Math.max(f.n ? 2 : 0, (f.n / top) * 100)}%`, animationDelay: `${i * 70}ms`, animationDuration: "600ms" }} />
              </div>
              <span className="num text-right">
                <span className="font-semibold text-foreground">{formatNumber(f.n)}</span>
                {i > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{pct(f.n, prev)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">{tr({
        en: "Gold: the credit stages, qualified by the Credit Engine. Blue: the program's execution, run by the communities.",
        pt: "Dourado: as etapas de crédito, qualificadas pelo Motor de Crédito. Azul: a execução do programa, conduzida pelas comunidades.",
      })}</p>
    </Panel>
  );
}

/** The capital the program's evidence mobilised: domestic, global, and what is still missing. */
export function Mobilisation({ data }: { data: ImpactIntelligence }) {
  const k = data.capital;
  const total = Math.max(1, k.eligible_cents);
  const seg = (cents: number) => `${(cents / total) * 100}%`;
  return (
    <Panel id="capital" className="lg:col-span-2" title={tr({ en: "Capital mobilised", pt: "Capital mobilizado" })}
      description={tr({
        en: "Qualified demand from the program's businesses, and who funded it. Totals only, never an investor.",
        pt: "A demanda qualificada dos negócios do programa, e quem a financiou. Só totais, nunca um investidor.",
      })}>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{tr({ en: "Qualified demand", pt: "Demanda qualificada" })}</p>
        <p className="num font-heading text-3xl font-bold text-foreground">{money(k.eligible_cents)}</p>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-secondary" role="img"
        aria-label={tr({ en: `Domestic ${bpsPercent(k.domestic_coverage_bps)}, global ${bpsPercent(k.global_coverage_bps)}`, pt: `Doméstico ${bpsPercent(k.domestic_coverage_bps)}, global ${bpsPercent(k.global_coverage_bps)}` })}>
        <div className={POOL.domestic.bar} style={{ width: seg(k.domestic_cents) }} />
        <div className={POOL.global.bar} style={{ width: seg(k.global_cents) }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", POOL.domestic.bar)} />{tr({ en: "Domestic funded", pt: "Captado no doméstico" })}</dt>
          <dd className="num font-semibold text-foreground">{money(k.domestic_cents)} <span className="text-xs font-normal text-muted-foreground">{bpsPercent(k.domestic_coverage_bps)}</span></dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", POOL.global.bar)} />{tr({ en: "Global / impact funded", pt: "Captado no global / impacto" })}</dt>
          <dd className="num font-semibold text-foreground">{money(k.global_cents)} <span className="text-xs font-normal text-muted-foreground">{bpsPercent(k.global_coverage_bps)}</span></dd></div>
        <div><dt className="text-xs text-muted-foreground">{tr({ en: "Funding gap", pt: "Lacuna de captação" })}</dt>
          <dd className="num font-semibold text-caution">{money(k.gap_cents)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{tr({ en: "Funding coverage", pt: "Cobertura da captação" })}</dt>
          <dd className="num font-semibold text-foreground">{bpsPercent(k.domestic_coverage_bps + k.global_coverage_bps)}</dd></div>
      </dl>
      {k.waiting_for_capital > 0 && (
        <p className="flex items-center gap-2 rounded-lg border tone-caution px-3 py-2 text-xs">
          <Hourglass size={13} aria-hidden />
          {tr({
            en: `${k.waiting_for_capital} qualified ${k.waiting_for_capital === 1 ? "opportunity waits" : "opportunities wait"} for a pool that can fund them.`,
            pt: `${k.waiting_for_capital} ${k.waiting_for_capital === 1 ? "oportunidade qualificada aguarda" : "oportunidades qualificadas aguardam"} um pool que possa financiá-las.`,
          })}
        </p>
      )}
    </Panel>
  );
}

/** What the capital did: repayment, declared use, and business change where measured. An observation, never a cause. */
export function Outcomes({ data }: { data: ImpactIntelligence }) {
  const o = data.outcomes;
  const p = data.portfolio;
  return (
    <Panel id="outcomes" title={tr({ en: "Repayment and productive outcomes", pt: "Pagamentos e resultados produtivos" })}
      actions={<StatusPill tone="info" dot={false}>{tr({ en: "Observed association, not causal impact", pt: "Associação observada, não impacto causal" })}</StatusPill>}
      description={tr({
        en: "Sales before and after each loan, from the months the business reports anyway. A business can grow for reasons that have nothing to do with the loan; counted only where she consented to impact reporting.",
        pt: "Vendas antes e depois de cada empréstimo, a partir dos meses que o negócio já informa. Um negócio pode crescer por motivos que nada têm a ver com o empréstimo; só conta quem consentiu com o relato de impacto.",
      })}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={tr({ en: "Repaid", pt: "Pago" })} value={money(p.repaid_cents)}
          hint={tr({ en: `of ${money(p.financed_cents)} lent`, pt: `de ${money(p.financed_cents)} emprestados` })} />
        <StatTile label={tr({ en: "Instalments on time", pt: "Parcelas em dia" })} value={`${formatNumber(p.instalments_paid)} / ${formatNumber(p.instalments_due)}`}
          hint={tr({ en: `${p.loans_repaying} repaying · ${p.loans_paid} paid off · ${p.loans_late} late`, pt: `${p.loans_repaying} pagando · ${p.loans_paid} quitados · ${p.loans_late} atrasados` })}
          hintTone={p.loans_late || p.loans_defaulted ? "caution" : "positive"} />
        <StatTile label={tr({ en: "Sales up after the loan", pt: "Vendas maiores depois do empréstimo" })} value={`${o.revenue_up} / ${o.measured}`}
          hint={o.revenue_change_bps === null ? undefined : tr({ en: `${o.revenue_change_bps >= 0 ? "+" : ""}${bpsPercent(o.revenue_change_bps)} average monthly sales`, pt: `${o.revenue_change_bps >= 0 ? "+" : ""}${bpsPercent(o.revenue_change_bps)} nas vendas médias mensais` })}
          hintTone={(o.revenue_change_bps ?? 0) >= 0 ? "positive" : "caution"} />
        <StatTile label={tr({ en: "Capital used as declared", pt: "Capital usado como declarado" })} value={`${o.as_declared} / ${o.measured}`}
          hint={tr({ en: `${o.partly_as_declared} partly · ${o.other_use} other use`, pt: `${o.partly_as_declared} em parte · ${o.other_use} outro uso` })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm">
        <span className="text-muted-foreground"><EvcLabel />: <span className="num font-semibold text-foreground">{money(o.evc_cents)}</span>
          <span className="ml-2 text-xs">{tr({ en: `${o.evc_positive} of ${o.measured} positive`, pt: `${o.evc_positive} de ${o.measured} positivos` })}</span></span>
        {o.withheld > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><EyeOff size={13} aria-hidden />
            {tr({ en: `${o.withheld} measured and left out: no consent to impact reporting`, pt: `${o.withheld} medidos e deixados de fora: sem consentimento para relato de impacto` })}</span>
        )}
      </div>
    </Panel>
  );
}

function segmentKey(id: SegmentId, key: string) {
  if (id === "readiness" && key in STATUS_LABEL) return STATUS_LABEL[key as ReadinessStatus].title;
  if (id === "sector") return sectorLabel(key);
  if (id === "purpose") return PURPOSE_LABEL[key as CreditPurpose] ?? key;
  return SEGMENT_KEY[key] ?? key;
}

/** Six privacy-safe breakdowns: any group under five businesses is hidden. */
export function Segments({ data }: { data: ImpactIntelligence }) {
  const ids: SegmentId[] = ["readiness", "data_quality", "credit_intent", "purpose", "sector", "geography"];
  return (
    <Panel id="segments" title={tr({ en: "Segments", pt: "Segmentos" })}
      actions={<StatusPill tone="neutral" dot={false}><EyeOff size={12} className="mr-1 inline" aria-hidden />{tr({ en: "Groups under 5 hidden", pt: "Grupos com menos de 5 ocultos" })}</StatusPill>}
      description={tr({
        en: "Where the program's businesses stand. Geography is the community's city, never an address.",
        pt: "Onde estão os negócios do programa. O território é a cidade da comunidade, nunca um endereço.",
      })}>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {ids.map((id) => (
          <div key={id} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{SEGMENT_TITLE[id]}</p>
            <ul className="space-y-1.5">
              {data.segments[id].map((g: SegmentGroup) => (
                <li key={g.key} className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", g.suppressed ? "text-muted-foreground" : "text-foreground")}>{segmentKey(id, g.key)}</span>
                    <span className="num shrink-0 text-xs text-muted-foreground">
                      {g.suppressed ? tr({ en: "fewer than 5", pt: "menos de 5" })
                        : <>{formatNumber(g.n!)} · {bpsPercent(g.share_bps ?? 0)}{g.cents ? ` · ${money(g.cents)}` : ""}</>}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                    {!g.suppressed && <div className="h-full rounded-full bg-info/60" style={{ width: `${(g.share_bps ?? 0) / 100}%` }} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Qualified opportunities from the program, by pseudonymous code, each one a step from the engine. */
export function Opportunities({ data }: { data: ImpactIntelligence }) {
  const [all, setAll] = useState(false);
  if (data.opportunities.length === 0) return null;
  // The engine's queue first: those are the ones to run.
  const sorted = [...data.opportunities].sort((a, b) => Number(b.in_engine) - Number(a.in_engine) || b.amount_cents - a.amount_cents);
  const shown = all ? sorted : sorted.slice(0, 8);
  return (
    <Panel id="opportunities" title={tr({ en: "Drill into an opportunity", pt: "Abra uma oportunidade" })}
      description={tr({
        en: "Qualified credit opportunities from the program's businesses, shown by code where she consented to be shown to investors. Open one in the Credit & Capital Engine to see how it qualified and which pool can fund it.",
        pt: "Oportunidades de crédito qualificadas dos negócios do programa, mostradas por código quando ela consentiu em aparecer para investidores. Abra uma no Motor de Crédito e Capital para ver como se qualificou e qual pool pode financiá-la.",
      })}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{tr({ en: "Opportunity", pt: "Oportunidade" })}</th>
              <th className="py-2 pr-4 font-medium">{tr({ en: "Purpose", pt: "Finalidade" })}</th>
              <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Ticket", pt: "Ticket" })}</th>
              <th className="py-2 pr-4 font-medium">{tr({ en: "Risk", pt: "Risco" })}</th>
              <th className="py-2 pr-4 font-medium">{tr({ en: "Route", pt: "Rota" })}</th>
              <th className="py-2 pr-4 font-medium">{tr({ en: "Where it stands", pt: "Situação" })}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((o) => (
              <tr key={o.opportunity_id}>
                <td className="py-2.5 pr-4"><span className="font-mono font-semibold text-foreground">{o.code}</span>
                  {o.community && <span className="block text-xs text-muted-foreground">{o.community}</span>}</td>
                <td className="py-2.5 pr-4 text-foreground">{PURPOSE_LABEL[o.purpose]}<span className="block text-xs text-muted-foreground">{tr({ en: `${o.term_months} months`, pt: `${o.term_months} meses` })}</span></td>
                <td className="num py-2.5 pr-4 text-right text-foreground">{money(o.amount_cents)}</td>
                <td className="py-2.5 pr-4"><StatusPill tone={RISK[o.risk_band].tone} dot={false}>{RISK[o.risk_band].grade}</StatusPill></td>
                <td className="py-2.5 pr-4"><PoolPill pool={o.funding_pool} /></td>
                <td className="py-2.5 pr-4 text-xs">
                  {o.loan_status
                    ? <StatusPill tone={o.late ? "caution" : "positive"} dot={false}>{LOAN_LABEL[o.loan_status as LoanStatus] ?? o.loan_status}{o.late ? tr({ en: " · late", pt: " · atrasado" }) : ""}</StatusPill>
                    : o.funding_status && o.funding_status !== "waiting"
                      ? <StatusPill tone={FUNDING_LABEL[o.funding_status].tone} dot={false}>{FUNDING_LABEL[o.funding_status].label}</StatusPill>
                      : <StatusPill tone="caution" dot={false}>{tr({ en: "Waiting for capital", pt: "Aguardando capital" })}</StatusPill>}
                </td>
                <td className="py-2.5 text-right">
                  {o.in_engine && (
                    <Link to={`/app/capital/engine?opportunity=${encodeURIComponent(o.code)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-accent hover:underline">
                      {tr({ en: "Run the engine", pt: "Rodar o motor" })} <ArrowRight size={12} aria-hidden />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="text-sm text-info hover:underline">
          {tr({ en: `Show all ${sorted.length}`, pt: `Mostrar todas as ${sorted.length}` })}
        </button>
      )}
    </Panel>
  );
}

/** The proofs behind the program on Solana, by stage of the lifecycle, and the latest to verify. */
export function Evidence({ data }: { data: ImpactIntelligence }) {
  const e = data.evidence;
  const byKind = new Map(e.by_kind.map((k) => [k.kind, k]));
  const checkable = e.latest.filter((p) => p.signature && p.commitment)
    .map((p) => ({ kind: p.kind, signature: p.signature!, account: p.account, commitment: p.commitment }));
  return (
    <Panel id="evidence" title={tr({ en: "Evidence on Solana", pt: "Evidência na Solana" })}
      actions={checkable.length > 0 ? <VerifyOnSolana proofs={checkable} /> : undefined}
      description={tr({
        en: "Every fact behind these figures is committed to Solana devnet as a hash: participation, attestations, funding, repayments and outcomes. Names, documents, Pix details and reported figures stay off-chain.",
        pt: "Cada fato por trás destes números é registrado na devnet da Solana como um hash: participação, atestados, captação, pagamentos e resultados. Nomes, documentos, dados de Pix e valores informados ficam fora da blockchain.",
      })}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="space-y-2.5">
          {EVIDENCE_GROUPS.map((g) => {
            const total = g.kinds.reduce((a, k) => a + (byKind.get(k)?.total ?? 0), 0);
            const confirmed = g.kinds.reduce((a, k) => a + (byKind.get(k)?.confirmed ?? 0), 0);
            if (total === 0) return null;
            return (
              <li key={g.id} className="space-y-1 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-foreground">{g.label}</span>
                  <span className="num text-xs text-muted-foreground">{tr({ en: `${formatNumber(confirmed)} of ${formatNumber(total)} on-chain`, pt: `${formatNumber(confirmed)} de ${formatNumber(total)} na blockchain` })}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div className="h-full rounded-full bg-positive/70" style={{ width: pct(confirmed, total) === "—" ? "0%" : pct(confirmed, total) }} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Latest proofs", pt: "Provas mais recentes" })}</p>
          {e.latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr({
              en: `${formatNumber(e.pending)} proofs are confirming on devnet; they land within minutes.`,
              pt: `${formatNumber(e.pending)} provas estão na fila da devnet; elas confirmam em minutos.`,
            })}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {e.latest.map((p) => (
                <li key={`${p.kind}-${p.entity_id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-foreground"><BadgeCheck size={14} className="shrink-0 text-positive" aria-hidden />{PROOF_KIND_LABEL[p.kind]}</span>
                    {p.confirmed_at && <span className="block text-xs text-muted-foreground">{formatDateTime(p.confirmed_at)}</span>}
                  </span>
                  <VerifyButton className="shrink-0 text-xs" proof={p} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** The communities that run the program: execution partners, not customers. */
export function Operators({ data }: { data: ImpactIntelligence }) {
  return (
    <Panel title={tr({ en: "Executed by", pt: "Executado por" })}
      description={tr({
        en: "The communities that run the program: education, engagement and monthly check-ins. They are EmpowerFI's distribution and execution partners.",
        pt: "As comunidades que conduzem o programa: formação, engajamento e check-ins mensais. Elas são parceiras de distribuição e execução da EmpowerFI.",
      })}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.communities.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-background/40 p-3 text-sm">
            <p className="font-semibold text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ")}</p>
            <p className="num mt-2 text-xs text-muted-foreground">{tr({
              en: `${c.participants} reached · ${c.credit_ready} credit ready · ${money(c.funded_cents)} funded`,
              pt: `${c.participants} alcançadas · ${c.credit_ready} prontas · ${money(c.funded_cents)} captados`,
            })}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

