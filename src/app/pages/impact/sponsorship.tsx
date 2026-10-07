import { Lock } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatusPill from "../../components/product/StatusPill";
import { formatNumber, tr } from "../../i18n";
import { BRAND_LIFT, type BrandLift } from "../../lib/sponsorship";
import type { ImpactIntelligence } from "../../lib/impact";
import { money } from "../../lib/readiness";

const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber(Math.round((part / whole) * 100))}%` : "—");

/** DEMO DATA, said in the one place a reader looks for a caveat: beside the number. */
const demoPill = () => (
  <StatusPill tone="caution" dot={false}>{tr({ en: "Demo data", pt: "Dados de demonstração" })}</StatusPill>
);

/**
 * One question, as two bars on one track: where the cohort started and where it
 * is now. Drawn as a shared axis so the gap is the thing the eye reads, because
 * the gap is the measurement — a sponsor who sees only "68%" learns nothing
 * about whether paying for the programme moved it.
 */
function Lift({ m }: { m: BrandLift }) {
  const delta = m.now - m.before;
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium text-foreground">{m.label}</span>
        <span className="num text-sm text-muted-foreground">
          {m.before}% <span aria-hidden>→</span> <span className="font-semibold text-foreground">{m.now}%</span>
          <span className={delta >= 0 ? "ml-1.5 text-positive" : "ml-1.5 text-alert"}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </span>
      </div>
      {/* Two fills on one track. The darker one is where the cohort started and
          the lighter one is where it is now, so what the eye reads is the band
          between them — which is the measurement, not either number alone. */}
      <div className="relative h-6 overflow-hidden rounded-md bg-secondary/50"
        role="img" aria-label={tr({
          en: `${m.label}: ${m.before}% before the program, ${m.now}% now`,
          pt: `${m.label}: ${m.before}% antes do programa, ${m.now}% agora`,
        })}>
        <div className="absolute inset-y-0 left-0 bg-accent/40" style={{ width: `${Math.min(100, m.now)}%` }} />
        <div className="absolute inset-y-0 left-0 border-r-2 border-accent bg-accent/70"
          style={{ width: `${Math.min(100, m.before)}%` }} />
      </div>
      <p className="text-xs italic text-muted-foreground">{m.question}</p>
    </li>
  );
}

/**
 * Did sponsoring the programme change how participants see the sponsor?
 *
 * The sponsor's own question, and the only part of this dashboard that is not
 * computed from a record. It is demo data and says so three times — in the
 * pill, in the description and under the bars — because a perception figure is
 * the easiest number in the product to invent and the hardest for a reader to
 * falsify.
 */
export function BrandImpact({ sponsor }: { sponsor: string }) {
  return (
    <Panel id="brand" title={tr({ en: "Brand Impact", pt: "Impacto de marca" })}
      actions={demoPill()}
      description={tr({
        en: `Brand Impact measures aggregated participant perception before and during the sponsored program. No individual answer is stored against a participant, and none is shown here. The figures below are demo data: no participant has been asked these questions yet.`,
        pt: `O impacto de marca mede a percepção agregada das participantes antes e durante o programa patrocinado. Nenhuma resposta individual é guardada vinculada a uma participante, e nenhuma aparece aqui. Os números abaixo são dados de demonstração: nenhuma participante foi perguntada ainda.`,
      })}>
      <ul className="space-y-4">{BRAND_LIFT.map((m) => <Lift key={m.id} m={m} />)}</ul>
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>{tr({
          en: `Answers are optional for the participant, reported to ${sponsor} only as a share of the cohort, and never presented as an individual profile. Declining changes nothing about her readiness, her eligibility or her access to capital.`,
          pt: `As respostas são opcionais para a participante, reportadas à ${sponsor} apenas como percentual da turma, e nunca apresentadas como perfil individual. Recusar não altera nada no seu preparo, na sua elegibilidade ou no seu acesso a capital.`,
        })}</span>
      </p>
    </Panel>
  );
}

/**
 * The two questions a sponsor arrives with, side by side: what changed for the
 * businesses, and what the support meant to the people behind them. Both
 * columns are summaries of sections further down the page rather than new
 * figures, so a number here and a number there can never disagree.
 */
export function ProgramSummary({ data, sponsor }: { data: ImpactIntelligence; sponsor: string }) {
  const h = data.hero;
  const business: { label: string; value: string }[] = [
    { label: tr({ en: "Participation", pt: "Participação" }), value: formatNumber(h.reached) },
    { label: tr({ en: "Businesses monitored", pt: "Negócios acompanhados" }), value: formatNumber(h.reporting) },
    { label: tr({ en: "Financially ready", pt: "Preparadas financeiramente" }), value: `${formatNumber(h.credit_ready)} · ${pct(h.credit_ready, h.reached)}` },
    { label: tr({ en: "Capital mobilised", pt: "Capital mobilizado" }), value: money(h.capital_mobilized_cents) },
    { label: tr({ en: "Outcomes measured", pt: "Resultados medidos" }), value: formatNumber(h.outcomes_measured) },
  ];
  return (
    <Panel id="summary" title={tr({ en: "Program Summary", pt: "Resumo do programa" })}
      description={tr({
        en: "Measure what changed for the businesses — and what your support means to the people behind them.",
        pt: "Meça o que mudou para os negócios — e o que o seu apoio significa para as pessoas por trás deles.",
      })}>
      <div className="grid gap-5 sm:grid-cols-2">
        <section aria-labelledby="summary-business" className="space-y-2.5">
          <h3 id="summary-business" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr({ en: "Business impact", pt: "Impacto no negócio" })}
          </h3>
          <dl className="divide-y divide-border/60">
            {business.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                <dt className="text-sm text-muted-foreground">{r.label}</dt>
                <dd className="num text-sm font-semibold text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {tr({ en: "Computed live from the program's records, with every proof checkable on Solana.", pt: "Calculado ao vivo a partir dos registros do programa, com cada prova conferível na Solana." })}
          </p>
        </section>
        <section aria-labelledby="summary-brand" className="space-y-2.5">
          <h3 id="summary-brand" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr({ en: "Brand impact", pt: "Impacto de marca" })} {demoPill()}
          </h3>
          <dl className="divide-y divide-border/60">
            {BRAND_LIFT.map((m) => (
              <div key={m.id} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                <dt className="text-sm text-muted-foreground">{m.label}</dt>
                <dd className="num text-sm text-muted-foreground">
                  {m.before}% <span aria-hidden>→</span> <span className="font-semibold text-foreground">{m.now}%</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {tr({ en: `Aggregated perception across the cohort, reported to ${sponsor} as shares only.`, pt: `Percepção agregada da turma, reportada à ${sponsor} apenas como percentuais.` })}
          </p>
        </section>
      </div>
    </Panel>
  );
}

/**
 * What the sponsor does not receive, said on the sponsor's own screen rather
 * than in a policy document it will never open. Placed where the dashboard ends
 * so it reads as a closing term of the arrangement.
 */
export function SponsorBoundary({ sponsor }: { sponsor: string }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
      <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-foreground">{tr({ en: "Participant-level financial and business data remains private.", pt: "Os dados financeiros e de negócio de cada participante permanecem privados." })}</span>{" "}
        {tr({
          en: `${sponsor} receives aggregated program insights and verified impact evidence — never a name, a business, a reported figure or an individual answer. Any financial product offer would be a separate arrangement and would require each entrepreneur's explicit consent.`,
          pt: `A ${sponsor} recebe indicadores agregados do programa e evidência de impacto verificável — nunca um nome, um negócio, um valor informado ou uma resposta individual. Qualquer oferta de produto financeiro seria um acordo separado e exigiria consentimento explícito de cada empreendedora.`,
        })}
      </span>
    </p>
  );
}
