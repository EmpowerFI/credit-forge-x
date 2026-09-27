import { FIT_WEIGHTS, type FitBreakdown } from "@empowerfi/capital-allocation";
import { ArrowRight, Ban, Globe2, Handshake, MapPin } from "lucide-react";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import StatusPill from "../../../components/product/StatusPill";
import type { Tone } from "../../../components/product/StatusPill";
import { localized, tr } from "../../../i18n";
import {
  gateDetail, INSTRUMENT_TYPE, reasonOf,
  type CapitalPlan, type Gate, type InstrumentAssessment, type RouteInstrument,
} from "../../../lib/capitalNetwork";
import { money } from "../../../lib/readiness";

// The Recommended Capital Plan: what the network would do with one need.
//
// Three numbers rather than two, because a global route fills part of the gap
// instead of reducing it. Domestic coverage is what routes inside Brazil
// absorbed; the external capital gap is what they could not, measured before
// global money can hide it; and unfunded is qualified demand nothing reached.
//
// Nothing here is an offer. Every route whose owner still has to say yes carries
// that on its card.

const STATUS: Record<CapitalPlan["status"], { label: string; says: string; tone: Tone }> = localized({
  recommended: {
    label: { en: "Plan recommended", pt: "Plano recomendado" },
    says: { en: "A recommendation, not an offer: each route's owner still decides.", pt: "Uma recomendação, não uma oferta: o dono de cada rota ainda decide." },
    tone: "positive",
  },
  manual_review: {
    label: { en: "For a person to review", pt: "Para uma pessoa revisar" },
    says: { en: "This need has not cleared the checks that come before this engine.", pt: "Esta necessidade não passou pelas verificações que vêm antes deste motor." },
    tone: "caution",
  },
  no_route: {
    label: { en: "No route available", pt: "Nenhuma rota disponível" },
    says: { en: "Qualified demand the network does not reach as it stands.", pt: "Demanda qualificada que a rede não alcança como está." },
    tone: "alert",
  },
});

const FIT_TERM: Record<keyof FitBreakdown, string> = localized({
  purpose: { en: "Funds this purpose", pt: "Financia esta finalidade" },
  amount_coverage: { en: "How much of it this route takes", pt: "Quanto desta necessidade a rota toma" },
  cost: { en: "What it costs her", pt: "Quanto custa para ela" },
  availability: { en: "Capacity against the need", pt: "Capacidade frente à necessidade" },
  geography: { en: "Serves her state", pt: "Atende o estado dela" },
  mandate: { en: "Mandate match", pt: "Encaixe de mandato" },
  operational: { en: "Friction she would meet", pt: "Atrito que ela encontraria" },
});

const TERMS = Object.keys(FIT_WEIGHTS) as (keyof FitBreakdown)[];

/** The three terms that weighed most on this route's ranking, largest first. */
const weighed = (fit: FitBreakdown) =>
  TERMS
    .map((k) => ({ term: k, score: fit[k], weight: FIT_WEIGHTS[k], moved: fit[k] * FIT_WEIGHTS[k] }))
    .sort((a, b) => b.moved - a.moved)
    .slice(0, 3);

function RouteCard({ allocation, instrument, assessment }: {
  allocation: CapitalPlan["allocations"][number];
  instrument: RouteInstrument | undefined;
  assessment: InstrumentAssessment | undefined;
}) {
  const kind = instrument ? INSTRUMENT_TYPE[instrument.instrument_type] : null;
  return (
    <li className="panel min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-heading text-sm font-bold text-foreground">{instrument?.name ?? allocation.instrument_id}</p>
          {kind && <p className="text-xs text-muted-foreground">{kind.label}</p>}
        </div>
        <p className="num font-heading text-xl font-bold text-foreground">{money(allocation.amount_cents)}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {!allocation.is_credit && (
          <StatusPill tone="caution">{tr({ en: "Not credit", pt: "Não é crédito" })}</StatusPill>
        )}
        {allocation.requires_partner_approval && (
          <StatusPill tone="info" dot={false}>
            <Handshake size={11} className="mr-0.5" aria-hidden /> {tr({ en: "Partner approval required", pt: "Requer aprovação do parceiro" })}
          </StatusPill>
        )}
        {instrument && !instrument.is_domestic && (
          <StatusPill tone="info" dot={false}>
            <Globe2 size={11} className="mr-0.5" aria-hidden /> {tr({ en: "Global capital", pt: "Capital global" })}
          </StatusPill>
        )}
      </div>

      <ul className="space-y-1.5">
        {allocation.reasons.map((code) => {
          const r = reasonOf(code);
          return (
            <li key={code} className="flex items-start gap-2 text-xs">
              <ArrowRight size={12} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span><span className="font-medium text-foreground">{r.label}.</span> <span className="text-muted-foreground">{r.says}</span></span>
            </li>
          );
        })}
      </ul>

      {assessment && (
        <details className="text-xs [&[open]>summary]:mb-2">
          <summary className="cursor-pointer list-none font-medium text-accent hover:text-foreground">
            {tr({ en: "What weighed most on its ranking", pt: "O que pesou mais na classificação dela" })}
            {" · "}
            <span className="num font-normal text-muted-foreground">{(assessment.fit_score / 100).toFixed(0)}/100</span>
          </summary>
          <ul className="space-y-1">
            {weighed(assessment.fit).map((w) => (
              <li key={w.term} className="flex flex-wrap justify-between gap-x-3 text-muted-foreground">
                <span>{FIT_TERM[w.term]}</span>
                <span className="num">
                  {w.score}/100 · {tr({ en: "weight", pt: "peso" })} {w.weight / 100}%
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function Refused({ assessment, instrument }: { assessment: InstrumentAssessment; instrument: RouteInstrument | undefined }) {
  const blocked = assessment.gates.filter((g) => !g.passed);
  return (
    <li className="min-w-0 space-y-1.5 border-l-2 border-border pl-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Ban size={13} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground">{instrument?.name ?? assessment.instrument_id}</span>
      </p>
      <ul className="space-y-1 text-xs">
        {blocked.map((g: Gate) => {
          const r = reasonOf(g.reason);
          return (
            <li key={g.gate} className="text-muted-foreground">
              {/* The reason names the gate, so naming it twice only adds noise.
                  Both sides of it follow, in her currency and her language: a
                  refusal a person can check beats one she has to believe. */}
              <span className="text-foreground">{r.label}</span> — {gateDetail(g)}.
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export default function PlanView({ plan, instruments, meta }: {
  plan: CapitalPlan;
  instruments: RouteInstrument[];
  /** What the caller wants to say about this run: when, by whom, which version. */
  meta?: React.ReactNode;
}) {
  const byCode = new Map(instruments.map((i) => [i.code, i]));
  const assessmentOf = new Map(plan.evaluated.map((e) => [e.instrument_id, e]));
  const covered = plan.domestic_coverage_cents + plan.global_coverage_cents;
  const refused = plan.evaluated.filter((e) => !e.eligible);
  const status = STATUS[plan.status];
  const gapFilled = plan.external_capital_gap_cents > 0 && plan.global_coverage_cents > 0;

  return (
    <div className="space-y-4">
      <Panel
        title={tr({ en: "Recommended capital plan", pt: "Plano de capital recomendado" })}
        description={status.says}
        actions={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
      >
        {meta}
        {/* Four money tiles do not fit four across in the narrow column of the
            investor's opportunity page: "R$ 1.500,00" loses its last digit long
            before the grid wraps. Two across until there is real room for four. */}
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <StatTile label={tr({ en: "What she asked for", pt: "O que ela pediu" })} value={money(plan.requested_cents)} />
          <StatTile
            label={tr({ en: "Covered by the plan", pt: "Coberto pelo plano" })}
            value={money(covered)}
            hint={covered === plan.requested_cents ? tr({ en: "in full", pt: "integralmente" }) : `${Math.floor((covered * 100) / plan.requested_cents)}%`}
            hintTone={covered === plan.requested_cents ? "positive" : "caution"}
          />
          <StatTile
            label={tr({ en: "Domestic coverage", pt: "Cobertura doméstica" })}
            value={money(plan.domestic_coverage_cents)}
            hint={tr({ en: "routes inside Brazil", pt: "rotas dentro do Brasil" })}
            icon={<MapPin size={14} aria-hidden />}
          />
          <StatTile
            label={tr({ en: "External capital gap", pt: "Lacuna de capital externo" })}
            value={money(plan.external_capital_gap_cents)}
            hint={gapFilled
              ? tr({ en: `${money(plan.global_coverage_cents)} of it from global capital`, pt: `${money(plan.global_coverage_cents)} disso vindo de capital global` })
              : plan.unfunded_cents > 0
                ? tr({ en: `${money(plan.unfunded_cents)} still unfunded`, pt: `${money(plan.unfunded_cents)} ainda sem financiamento` })
                : tr({ en: "none", pt: "nenhuma" })}
            hintTone={plan.unfunded_cents > 0 ? "alert" : gapFilled ? "info" : "positive"}
            icon={<Globe2 size={14} aria-hidden />}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {tr({
            en: "The gap measures the domestic network: it is taken after local routes have taken what they can and before global capital fills any of it. That is what makes it worth showing.",
            pt: "A lacuna mede a rede doméstica: é medida depois que as rotas locais tomaram o que podiam e antes que o capital global preencha qualquer parte dela. É isso que a torna digna de ser mostrada.",
          })}
        </p>
      </Panel>

      {plan.allocations.length > 0 && (
        <Panel
          title={tr({ en: "The routes", pt: "As rotas" })}
          description={tr({
            en: "In the order the engine chose them: best fit first, local capital before global.",
            pt: "Na ordem em que o motor as escolheu: melhor encaixe primeiro, capital local antes do global.",
          })}
        >
          <ul className="space-y-3">
            {plan.allocations.map((a) => (
              <RouteCard
                key={a.instrument_id}
                allocation={a}
                instrument={byCode.get(a.instrument_id)}
                assessment={assessmentOf.get(a.instrument_id)}
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "The weights that ranked these routes are policy about fit, and configurable. They are not credit policy: the gates below decide who is eligible at all, and no weight can overturn one.",
              pt: "Os pesos que classificaram estas rotas são política de encaixe, e configuráveis. Não são política de crédito: os portões abaixo decidem quem é elegível, e nenhum peso derruba um deles.",
            })}
          </p>
        </Panel>
      )}

      {refused.length > 0 && (
        <Panel
          title={tr({ en: "What the network refused, and why", pt: "O que a rede recusou, e por quê" })}
          description={tr({
            en: "Each refusal with both sides of the comparison, so it can be checked rather than believed — and so the fixable ones are visible.",
            pt: "Cada recusa com os dois lados da comparação, para que possa ser verificada em vez de acreditada — e para que as resolvíveis fiquem visíveis.",
          })}
        >
          <ul className="space-y-3">
            {refused.map((e) => (
              <Refused key={e.instrument_id} assessment={e} instrument={byCode.get(e.instrument_id)} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
