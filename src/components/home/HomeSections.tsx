import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";
import StoreLinks from "@/components/StoreLinks";
import { Eyebrow, GradedRule, PullQuote, RingList, StatusNote } from "@/components/site/editorial";
import { HOME, type Lang, PATHS } from "./copy";

/**
 * The home page's sections in the site's editorial language: hairlines, graded
 * gold rules and a status line beside every claim, instead of a grid of glowing
 * cards.
 *
 * The order tells one argument: what the four engines do, why the connection is
 * broken, how a need becomes routed capital, what it can be routed to, why
 * local capital goes first, what happens after the capital lands, where the
 * global side is stuck, and where all of it is going. Technology comes last.
 */

const inlineLink = "inline-flex items-center gap-1.5 text-[1.0625rem] text-accent underline-offset-4 hover:underline";

/** A small gold-ruled step chip, used by the flows that are sequences of words. */
const StepChips = ({ items, label }: { items: readonly string[]; label: string }) => (
  <div>
    <p className="label-ui text-accent">{label}</p>
    <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2.5">
      {items.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span className="text-accent" aria-hidden>→</span>}
          <span className="rounded-sm border border-foreground/20 px-3.5 py-2 font-ui text-sm tracking-[0.02em]">{s}</span>
        </li>
      ))}
    </ol>
  </div>
);

/** The four engines, and the loop they run over one dataset. */
export const HomeEngines = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].engines;
  return (
    <section id="engines" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-10 xl:grid-cols-4">
          {t.items.map((e, i) => (
            <div key={e.number} className="flex flex-col">
              <GradedRule index={i % 3} />
              <p className="mt-4 font-ui text-xs uppercase tracking-[0.16em] text-accent">{e.number}</p>
              <h3 className="mt-3 font-heading text-[1.6rem] leading-tight">{e.name}</h3>
              <p className="mt-3 leading-relaxed text-foreground/85">{e.lead}</p>
              <div className="mt-6"><RingList items={e.points} /></div>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-foreground/15 pt-8">
          <StepChips items={t.flow} label={t.flowLabel} />
        </div>
      </div>
    </section>
  );
};

/** Why the two sides do not meet, and what productive demand has to become. */
export const HomeProblem = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].problem;
  const b = t.benchmark;
  return (
    <section id="problem" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />

        <div className="mt-14">
          <p className="label-ui text-accent">{t.qualifiesLabel}</p>
          <dl className="mt-6 divide-y divide-foreground/15 border-t border-foreground/15">
            {t.qualifies.map((q) => (
              <div key={q.word} className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <dt className="font-heading text-[1.4rem] leading-tight">
                  {q.word}
                  {/* The fifth is where this is going. A page that does not mark
                      it reads as a claim that it has arrived. */}
                  {"future" in q && q.future && (
                    <span className="label-ui ml-3 align-middle text-foreground/55">{t.futureNote}</span>
                  )}
                </dt>
                <dd className="leading-relaxed text-foreground/85">{q.desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,24rem)_1px_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="eyebrow">{b.label}</p>
            <p className="mt-6 flex items-baseline gap-3">
              <span className="num font-heading text-[4.5rem] leading-[0.88] md:text-[5.5rem]">{b.figure}</span>
              <span className="num text-xl text-foreground/65">{b.unit}</span>
            </p>
            <p className="mt-6 text-lg leading-snug text-foreground/90">{b.lead}</p>
            <p className="mt-3.5 leading-snug text-foreground/80">{b.caveat}</p>
            <p className="mt-6 text-sm text-foreground/70">{b.source}</p>
          </div>

          <div className="hidden bg-foreground/15 lg:block" aria-hidden />

          <div>
            <p className="eyebrow">{t.brazil.label}</p>
            <dl className="mt-6 divide-y divide-foreground/15 border-t border-foreground/15">
              {t.brazil.items.map((i) => (
                <div key={i.figure} className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                  <dt className="num font-heading text-[2rem] leading-none">{i.figure}</dt>
                  <dd className="leading-relaxed text-foreground/85">{i.desc}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-foreground/70">{t.brazil.source}</p>
            <p className="mt-6">
              <Link to={PATHS[lang].sources} className={inlineLink}>{t.sources} <ArrowRight size={15} aria-hidden /></Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

/** What has to move, what may not be traded away for it, and how it is measured. */
export const HomePilot = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].pilot;
  const m = t.measure;
  return (
    <section id="pilot" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <div className="mt-14">
          {/* Three across only from md: at sm each column was 165px and
              "Acompanhamento" alone is 176px. */}
          <div className="hidden grid-cols-3 gap-10 border-b-[1.5px] border-gold pb-4 md:grid">
            {m.headers.map((h) => <span key={h} className="label-ui text-accent">{h}</span>)}
          </div>
          <ul className="divide-y divide-foreground/15">
            {m.rows.map(([improve, keep, how]) => (
              <li key={improve} className="grid gap-x-10 gap-y-4 py-5 md:grid-cols-3 md:gap-y-1.5">
                {/* Below md the three headers repeat above each value: read
                    inline they tangled with it, and these labels are long in
                    Portuguese. */}
                {([[m.headers[0], improve, "text-xl"], [m.headers[1], keep, "text-xl"], [m.headers[2], how, "text-foreground/85"]] as const).map(([header, value, tone]) => (
                  <span key={header} className="block">
                    <span className="label-ui mb-1 block text-foreground/60 md:hidden">{header}</span>
                    <span className={`block leading-snug ${tone}`}>{value}</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 max-w-2xl text-[0.95rem] leading-relaxed text-foreground/80">{m.note}</p>
      </div>
    </section>
  );
};

/** Eight steps from a productive need to capital that can be serviced. */
export const HomeHowItWorks = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <ol className="mt-14 divide-y divide-foreground/15 border-t border-foreground/15">
          {t.steps.map((s) => (
            <li key={s.number} className="grid gap-x-10 gap-y-2 py-7 lg:grid-cols-[minmax(0,4rem)_minmax(0,18rem)_minmax(0,1fr)]">
              <span className="num font-heading text-[1.4rem] leading-none text-accent">{s.number}</span>
              <h3 className="font-heading text-[1.4rem] leading-tight">{s.name}</h3>
              <p className="leading-relaxed text-foreground/85">{s.desc}</p>
            </li>
          ))}
        </ol>

        {/* The three decisions the platform keeps apart, which is the part of
            this architecture most often collapsed into one. */}
        <div className="mt-14 grid gap-3 sm:grid-cols-3">
          {t.judgements.map((j, i) => (
            <div key={j.a} className="rounded-sm border border-foreground/15 px-5 py-5">
              <p className="text-[0.95rem] text-foreground/70">{j.q}</p>
              <p className="mt-1 font-heading text-[1.4rem] leading-tight">{j.a}</p>
              <div className={`mt-4 ${["rule-gold", "rule-gold-2", "rule-gold-3"][i]}`} aria-hidden />
            </div>
          ))}
        </div>
        <div className="mt-9 space-y-4">
          <PullQuote>{t.judgementsNote}</PullQuote>
          <p className="pl-16">
            <Link to={PATHS[lang].readiness} className={inlineLink}>{t.more} <ArrowRight size={15} aria-hidden /></Link>
          </p>
        </div>
      </div>
    </section>
  );
};

/** One need, and everything it could be routed to. */
export const HomeNetwork = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].network;
  return (
    <section id="capital-network" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <div className="space-y-2">
            <div className="rounded-sm border border-gold/55 px-6 py-5">
              <p className="font-heading text-[1.4rem] leading-tight">{t.needLabel}</p>
            </div>
            <p className="py-1 text-center text-xl leading-none text-accent" aria-hidden>↓</p>
            <div className="rounded-sm border-[1.5px] border-gold bg-gold/12 px-6 py-5">
              <p className="font-heading text-[1.4rem] leading-tight">{t.engineLabel}</p>
            </div>
            <p className="py-1 text-center text-xl leading-none text-accent" aria-hidden>↓</p>
            <div className="space-y-2">
              {t.outcomes.map((o) => (
                <div key={o} className="rounded-sm border border-foreground/20 px-6 py-4">
                  <p className="leading-snug text-foreground/90">{o}</p>
                </div>
              ))}
            </div>
            <p className="pt-2 label-ui text-foreground/60">{t.outcomeLabel}</p>
          </div>

          <div>
            <p className="label-ui text-accent">{t.sourcesLabel}</p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {t.sources.map((s) => (
                <li key={s} className="rounded-sm border border-foreground/18 px-5 py-4 leading-snug">{s}</li>
              ))}
            </ul>
            <p className="mt-8 leading-relaxed text-foreground/80">{t.callout}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

/** The subtraction that decides whether global capital is asked at all. */
export const HomeLocalFirst = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].localFirst;
  return (
    <section id="local-first" className="section-padding">
      <div className="container mx-auto grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
          <div className="mt-8 space-y-4 leading-relaxed text-foreground/85">
            {t.body.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>

        <div>
          <ol className="space-y-2">
            {t.equation.map((e) => (
              <li key={e.label} className="flex items-stretch gap-4">
                <span className="num flex w-7 shrink-0 items-center justify-center font-heading text-2xl text-accent" aria-hidden>{e.op}</span>
                <span className={`flex-1 rounded-sm px-6 py-5 font-heading text-[1.4rem] leading-tight ${"emphasis" in e && e.emphasis
                  ? "border-[1.5px] border-gold bg-gold/12"
                  : "border border-foreground/20"}`}>{e.label}</span>
              </li>
            ))}
          </ol>
          <p className="py-2 pl-11 text-xl leading-none text-accent" aria-hidden>↓</p>
          <dl className="divide-y divide-foreground/15 border-t border-foreground/15 pl-11">
            {t.then.map((s) => (
              <div key={s.label} className="py-5">
                <dt className="font-heading text-[1.25rem] leading-tight">{s.label}</dt>
                <dd className="mt-1.5 leading-relaxed text-foreground/80">{s.desc}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8"><PullQuote>{t.callout}</PullQuote></div>
        </div>
      </div>
    </section>
  );
};

/** What can happen after the capital lands — stated as a question, not a result. */
export const HomeRails = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].rails;
  return (
    <section id="local-economies" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-10 max-w-3xl space-y-4 leading-relaxed text-foreground/85">
          {t.body.map((p) => <p key={p}>{p}</p>)}
        </div>

        <div className="mt-12">
          <CapitalFlow
            steps={t.chain.map((label, i) => ({ label, emphasis: i === 0 || i === t.chain.length - 1 }))}
            caption={t.chainCaption}
          />
        </div>

        {/* Marked as a hypothesis in the markup as well as the words: this is
            the claim a reader is most likely to carry away as a result. */}
        <div className="mt-12 rounded-sm border-[1.5px] border-gold bg-gold/10 px-7 py-6">
          <p className="label-ui text-accent">{t.hypothesisLabel}</p>
          <p className="mt-3 text-lg leading-relaxed text-foreground/90">{t.hypothesis}</p>
        </div>
        <ul className="mt-6 space-y-2">
          {t.cautions.map((c) => (
            <li key={c} className="text-[0.95rem] leading-relaxed text-foreground/75">{c}</li>
          ))}
        </ul>

        <div className="mt-14 border-t border-foreground/15 pt-8">
          <p className="label-ui text-foreground/60">{t.evidenceLabel}</p>
          <dl className="mt-6 grid gap-8 md:grid-cols-3">
            {t.evidence.map((e) => (
              <div key={e.figure}>
                <dt className="num font-heading text-[2.5rem] leading-none">{e.figure}</dt>
                <dd className="mt-3 leading-snug text-foreground/85">{e.desc}</dd>
                <dd className="mt-3 text-sm text-foreground/65">{e.source}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8">
            <Link to={PATHS[lang].sources} className={inlineLink}>{t.sources} <ArrowRight size={15} aria-hidden /></Link>
          </p>
        </div>
      </div>
    </section>
  );
};

/** The mismatch between where capital is and where productive demand is. */
export const HomeGlobal = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].global;
  return (
    <section id="global-capital" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <div className="mt-14 grid gap-3 lg:grid-cols-3">
          {t.columns.map((c, i) => (
            <div key={c.label} className="flex flex-col">
              {/* The arrow belongs to the gap between columns, so on a phone,
                  where they stack, it points down the page instead. */}
              {i > 0 && <p className="py-2 text-center text-xl leading-none text-accent lg:hidden" aria-hidden>↓</p>}
              <div className={`flex h-full flex-col rounded-sm px-7 py-6 ${"emphasis" in c && c.emphasis
                ? "border-[1.5px] border-gold bg-gold/12"
                : "border border-foreground/18"}`}>
                <p className="font-heading text-[1.5rem] leading-tight">{c.label}</p>
                <ul className="mt-5 space-y-2 leading-snug text-foreground/85">
                  {c.items.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <p className="mt-auto pt-6 text-[0.95rem] text-foreground/70">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
          <PullQuote>{t.callout}</PullQuote>
          <p className="leading-relaxed text-foreground/80">{t.caveat}</p>
        </div>
      </div>
    </section>
  );
};

/** Where the architecture is going, labelled as future for its whole length. */
export const HomeNorthStar = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].northStar;
  return (
    <section id="north-star" className="section-padding">
      <div className="container mx-auto">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        </div>
        <p className="mt-6 inline-block rounded-sm border border-dashed border-gold/60 px-4 py-2 label-ui text-foreground/80">{t.label}</p>

        <div className="mt-10 max-w-3xl space-y-4 leading-relaxed text-foreground/85">
          {t.body.map((p) => <p key={p}>{p}</p>)}
        </div>

        <div className="mt-12 space-y-3">
          <div>
            <p className="label-ui text-accent">{t.ticketsLabel}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {t.tickets.map((x) => (
                <li key={x} className="num rounded-sm border border-foreground/20 px-4 py-2.5 text-[0.95rem]">{x}</li>
              ))}
              <li className="num px-2 py-2.5 text-[0.95rem] text-foreground/55" aria-hidden>…</li>
            </ul>
          </div>
          <p className="py-1 text-xl leading-none text-accent" aria-hidden>↓</p>
          <div className="rounded-sm border-[1.5px] border-gold bg-gold/12 px-7 py-6">
            <StepChips items={t.steps} label={t.stepsLabel} />
          </div>
          <p className="py-1 text-xl leading-none text-accent" aria-hidden>↓</p>
          <div>
            <p className="label-ui text-accent">{t.outLabel}</p>
            <ul className="mt-4 space-y-2">
              {t.out.map((x) => (
                <li key={x} className="rounded-sm border border-dashed border-gold/60 px-6 py-4 font-heading text-[1.25rem] leading-tight">{x}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 max-w-3xl leading-relaxed text-foreground/75">{t.caveat}</p>
      </div>
    </section>
  );
};

/** Where the chain actually runs, kept to the end on purpose. */
export const HomeSolana = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].solana;
  return (
    <section id="technology" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {t.roles.map((r, i) => (
            <div key={r.number}>
              <GradedRule index={i} />
              <p className="mt-4 font-ui text-xs uppercase tracking-[0.16em] text-accent">{r.number}</p>
              <h3 className="mt-3 font-heading text-[1.5rem] leading-tight">
                {r.name}
                {"future" in r && r.future && <span className="label-ui ml-3 align-middle text-foreground/55">·</span>}
              </h3>
              <p className="mt-3 leading-relaxed text-foreground/85">{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12"><PullQuote>{t.callout}</PullQuote></div>
      </div>
    </section>
  );
};

export const HomeAuditability = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].audit;
  return (
    <section id="auditability" className="section-padding">
      {/* Heading beside the layers only from xl. Splitting at lg and again
          inside each layer left 192px for a Portuguese sentence. */}
      <div className="container mx-auto grid gap-12 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-20">
        <div>
          <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
          <div className="mt-8"><PullQuote>{t.keyLine}</PullQuote></div>
        </div>
        <ol className="space-y-3">
          {t.layers.map((l, i) => {
            const last = i === t.layers.length - 1;
            return (
              <li key={l.name}
                className={`grid gap-x-8 gap-y-2 rounded-sm px-7 py-6 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] ${last
                  ? "border-[1.5px] border-gold bg-gold/10"
                  : "border border-foreground/18"}`}>
                <div>
                  {/* What is kept where, said as a label so the three layers
                      read as one chain rather than three claims. */}
                  <span className="label-ui block text-foreground/90">{i + 1} / {t.layers.length}</span>
                  <span className="mt-2 block font-heading text-[1.4rem] leading-tight">{l.name}</span>
                </div>
                <p className="leading-relaxed text-foreground/85">{l.desc}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

/** Six participants, and beside each of them where it actually stands. */
export const HomeAudiences = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].audiences;
  return (
    <section id="who" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-10 xl:grid-cols-3">
          {t.items.map((item, i) => (
            <div key={item.number} className="flex flex-col">
              <GradedRule index={i % 3} />
              {/* Its own tracking rather than `label-ui`: at 0.22em some of
                  these names are wider than a third of the row. */}
              <p className="mt-4 font-ui text-xs uppercase tracking-[0.16em] text-accent">{item.number} · {item.who}</p>
              <h3 className="mt-5 font-heading text-[1.75rem] leading-tight">
                {item.title} <em className="italic text-accent">{item.accent}</em>
              </h3>
              <p className="mt-4 leading-relaxed text-foreground/85">{item.desc}</p>
              <div className="mt-6"><RingList items={item.points} /></div>
              <div className="mt-auto">
                <StatusNote label={t.statusLabel}>{item.status}</StatusNote>
                {/* The entrepreneur's column ends on both stores rather than on
                    a link that would pick a phone for her; the investor's on the
                    waitlist, because there is nothing else to send them to yet. */}
                {item.cta === "" ? (
                  <StoreLinks className="!mt-5" />
                ) : item.number === "03" ? (
                  <Link to={`${PATHS[lang].investors}#waitlist`} className={`${inlineLink} mt-5`}>
                    {item.cta} <ArrowRight size={15} aria-hidden />
                  </Link>
                ) : (
                  <a href="#contact" className={`${inlineLink} mt-5`}>{item.cta} <ArrowRight size={15} aria-hidden /></a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const HomeRevenue = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].revenue;
  return (
    <section id="business-model" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <p className="mt-8 inline-block rounded-sm border border-dashed border-gold/60 px-4 py-2 label-ui text-foreground/80">{t.label}</p>
        <dl className="mt-10 divide-y divide-foreground/15 border-t border-foreground/15">
          {t.layers.map((l) => (
            <div key={l.name} className="grid gap-x-10 gap-y-2 py-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              <dt className="font-heading text-[1.4rem] leading-tight">
                {l.name}
                {"future" in l && l.future && (
                  <span className="ml-3 inline-block rounded-sm border border-dashed border-gold/60 px-2 py-0.5 align-middle font-ui text-[0.65rem] uppercase tracking-[0.16em] text-foreground/70">
                    {t.label}
                  </span>
                )}
              </dt>
              <dd className="leading-relaxed text-foreground/85">{l.desc}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
          <PullQuote>{t.keyLine}</PullQuote>
          <p className="leading-relaxed text-foreground/80">{t.communities}</p>
        </div>
      </div>
    </section>
  );
};

/** Kept for the pages that still import the old eyebrow-only heading helper. */
export const HomeSectionEyebrow = ({ children }: { children: React.ReactNode }) => <h2><Eyebrow>{children}</Eyebrow></h2>;
