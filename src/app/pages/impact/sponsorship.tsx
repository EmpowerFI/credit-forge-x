import { CalendarRange, Lock, MapPin, Megaphone, Users } from "lucide-react";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import { formatNumber, tr } from "../../i18n";
import type { ImpactIntelligence } from "../../lib/impact";
import { money } from "../../lib/readiness";
import { sponsorshipFor } from "../../lib/sponsorship";

const pct = (part: number, whole: number) => (whole > 0 ? `${formatNumber(Math.round((part / whole) * 100))}%` : "—");

/** Whole months the programme runs, from its own period. */
function months(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`), b = new Date(`${to}T12:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

/**
 * What the sponsor's money buys in visibility, counted rather than surveyed.
 *
 * The earlier version of this section reported perception — awareness, positive
 * perception, consideration — as before-and-after shares. Those numbers cannot
 * exist without asking participants, and EmpowerFI does not turn a participant
 * into a survey respondent: she is here for her business, and a woman mid-way
 * through a credit assessment does not experience an optional question as
 * optional. So the questions are not asked, and the figures they would have
 * produced are not shown.
 *
 * What is left is better, because every number here is arithmetic on the
 * programme's own configuration rather than an opinion collected from someone:
 * how many women the programme reaches, across how many communities, for how
 * long, and how many times the sponsor is named in the journey it paid for.
 * Nothing is tracked to produce it — no view counted, no click recorded — which
 * is the same rule the rest of the product already holds: engagement data is
 * not a thing this product collects about her.
 *
 * The product is impact measurement, not marketing. A sponsor is owed its name
 * in front of the cohort it funds; it is not owed the cohort's attention.
 */
export function BrandExposure({ data, sponsor }: { data: ImpactIntelligence; sponsor: string }) {
  const n = months(data.program.period_start, data.program.period_end);
  return (
    <Panel id="brand" title={tr({ en: "Brand exposure", pt: "Exposição da marca" })}
      description={tr({
        en: `Where ${sponsor} appears, and to how many. Counted from the program's own shape — no participant is surveyed and nothing she does is tracked to produce these figures.`,
        pt: `Onde a ${sponsor} aparece, e para quantas. Contado a partir da própria configuração do programa — nenhuma participante é pesquisada e nada do que ela faz é rastreado para produzir estes números.`,
      })}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Users size={14} />} label={tr({ en: "Entrepreneurs reached", pt: "Empreendedoras alcançadas" })}
          value={formatNumber(data.hero.reached)}
          hint={tr({ en: "every one of them sees the sponsorship", pt: "todas elas veem o patrocínio" })} />
        <StatTile icon={<MapPin size={14} />} label={tr({ en: "Communities", pt: "Comunidades" })}
          value={formatNumber(data.communities.length)}
          hint={data.communities.map((c) => c.city).filter(Boolean).join(" · ")} />
        <StatTile icon={<CalendarRange size={14} />} label={tr({ en: "Months running", pt: "Meses de duração" })}
          value={formatNumber(n)}
          hint={tr({ en: "for the whole program", pt: "durante todo o programa" })} />
        <StatTile icon={<Megaphone size={14} />} label={tr({ en: "Placements", pt: "Inserções" })}
          value="1"
          hint={tr({ en: "one card in her journey, not every screen", pt: "um card na jornada dela, não em toda tela" })} />
      </div>
      {/* The brand panel is the one a sponsor screenshots, so of all the places
          the name appears this is the one that most needs the hypothesis with
          it. */}
      {sponsorshipFor(sponsor)?.disclosure && (
        <p className="mt-4 rounded-lg border tone-caution px-3 py-2 text-xs">{sponsorshipFor(sponsor)!.disclosure}</p>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>{tr({
          en: `What ${sponsor} does not receive is measured perception — whether sponsoring changed how participants see it. That would mean surveying them, and EmpowerFI does not do that: she is here for her business. A sponsor who wants brand lift measured runs its own study. This product measures impact, not marketing.`,
          pt: `O que a ${sponsor} não recebe é percepção medida — se patrocinar mudou como as participantes a enxergam. Isso exigiria pesquisá-las, e a EmpowerFI não faz isso: ela está aqui pelo negócio dela. Um patrocinador que queira medir percepção roda o próprio estudo. Este produto mede impacto, não marketing.`,
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
    { label: tr({ en: "Businesses monitored", pt: "Negócios acompanhados" }), value: `${formatNumber(h.reporting)} · ${pct(h.reporting, h.reached)}` },
    { label: tr({ en: "Financially ready", pt: "Preparadas financeiramente" }), value: `${formatNumber(h.credit_ready)} · ${pct(h.credit_ready, h.reached)}` },
    { label: tr({ en: "Capital mobilised", pt: "Capital mobilizado" }), value: money(h.capital_mobilized_cents) },
    { label: tr({ en: "Outcomes measured", pt: "Resultados medidos" }), value: formatNumber(h.outcomes_measured) },
  ];
  const exposure: { label: string; value: string }[] = [
    { label: tr({ en: "Entrepreneurs reached", pt: "Empreendedoras alcançadas" }), value: formatNumber(h.reached) },
    { label: tr({ en: "Communities", pt: "Comunidades" }), value: formatNumber(data.communities.length) },
    { label: tr({ en: "Months running", pt: "Meses de duração" }), value: formatNumber(months(data.program.period_start, data.program.period_end)) },
    { label: tr({ en: "Placements in her journey", pt: "Inserções na jornada dela" }), value: "1" },
  ];
  return (
    <Panel id="summary" title={tr({ en: "Program Summary", pt: "Resumo do programa" })}
      description={tr({
        en: "What changed for the businesses, and what your support put in front of the women behind them.",
        pt: "O que mudou para os negócios, e o que o seu apoio colocou diante das mulheres por trás deles.",
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
          <h3 id="summary-brand" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr({ en: "Brand exposure", pt: "Exposição da marca" })}
          </h3>
          <dl className="divide-y divide-border/60">
            {exposure.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                <dt className="text-sm text-muted-foreground">{r.label}</dt>
                <dd className="num text-sm font-semibold text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: `Counted from the program's own shape. ${sponsor} is named in front of the cohort it funds; how the cohort feels about it is not measured here.`,
              pt: `Contado a partir da configuração do programa. A ${sponsor} é nomeada diante da turma que financia; o que a turma acha dela não é medido aqui.`,
            })}
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
          en: `${sponsor} receives aggregated program insights and verified impact evidence — never a name, a business or a reported figure. It is never asked for either: EmpowerFI does not survey participants on a sponsor's behalf, because the product measures impact, not marketing. Any financial product offer would be a separate arrangement and would require each entrepreneur's explicit consent.`,
          pt: `A ${sponsor} recebe indicadores agregados do programa e evidência de impacto verificável — nunca um nome, um negócio ou um valor informado. Nada disso é perguntado a ninguém: a EmpowerFI não pesquisa participantes em nome de patrocinador, porque o produto mede impacto, não marketing. Qualquer oferta de produto financeiro seria um acordo separado e exigiria consentimento explícito de cada empreendedora.`,
        })}
      </span>
    </p>
  );
}
