import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";
import StoreLinks from "@/components/StoreLinks";
import { Eyebrow, GradedRule, PullQuote, RingList, StatusNote } from "@/components/site/editorial";
import EconomicLoop from "./EconomicLoop";
import { HOME, type Lang, PATHS } from "./copy";

/**
 * The home page's sections in the site's editorial language (founder's
 * reference, 24 Sep): hairlines, graded gold rules and a status line beside
 * every claim, instead of a grid of glowing cards.
 */

const inlineLink = "inline-flex items-center gap-1.5 text-[1.0625rem] text-accent underline-offset-4 hover:underline";

/** Who the platform is for, and — beside each of them — where it actually stands. */
export const HomeAudiences = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].audiences;
  return (
    <section id="who" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {t.items.map((item, i) => (
            <div key={item.number} className="flex flex-col">
              <GradedRule index={i} />
              <p className="label-ui mt-4 text-accent">{item.number} · {item.who}</p>
              <h3 className="mt-5 font-heading text-[1.75rem] leading-tight">
                {item.title} <em className="italic text-accent">{item.accent}</em>
              </h3>
              <p className="mt-4 leading-relaxed text-foreground/85">{item.desc}</p>
              <div className="mt-6"><RingList items={item.points} /></div>
              <div className="mt-auto">
                <StatusNote label={t.statusLabel}>{item.status}</StatusNote>
                {/* Her column ends on both stores; the other two on one link. */}
                {i === 1 ? (
                  <StoreLinks className="!mt-5" />
                ) : (
                  i === 0 ? (
                    <a href="#contact" className={`${inlineLink} mt-5`}>{item.cta} <ArrowRight size={15} aria-hidden /></a>
                  ) : (
                    <Link to={`${PATHS[lang].investors}#waitlist`} className={`${inlineLink} mt-5`}>
                      {item.cta} <ArrowRight size={15} aria-hidden />
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** The problem, with the one number the thesis leans on standing alone. */
export const HomeProblem = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].problem;
  const b = t.benchmark;
  return (
    <section id="problem" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
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

          <dl className="divide-y divide-foreground/15 border-t border-foreground/15 lg:border-t-0">
            {t.cards.map((c) => (
              <div key={c.who} className="grid gap-x-8 gap-y-3 py-7 lg:first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                <dt className="label-ui pt-1.5 text-accent">{c.who}</dt>
                <dd>
                  <p className="font-heading text-[1.4rem] leading-tight">{c.title}</p>
                  <p className="mt-2.5 leading-relaxed text-foreground/85">{c.desc}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

/** What has to move, what may not be traded away for it, and how it is measured. */
export const HomePilot = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].pilot;
  const m = HOME[lang].problem.measure;
  return (
    <section id="pilot" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-14">
          <div className="hidden grid-cols-3 gap-10 border-b-[1.5px] border-gold pb-4 sm:grid">
            {m.headers.map((h) => <span key={h} className="label-ui text-accent">{h}</span>)}
          </div>
          <ul className="divide-y divide-foreground/15">
            {m.rows.map(([improve, keep, how]) => (
              <li key={improve} className="grid gap-x-10 gap-y-4 py-5 sm:grid-cols-3 sm:gap-y-1.5">
                {/* Below sm the three headers repeat above each value: read
                    inline they tangled with it, and these labels are long in
                    Portuguese. */}
                {([[m.headers[0], improve, "text-xl"], [m.headers[1], keep, "text-xl"], [m.headers[2], how, "text-foreground/85"]] as const).map(([header, value, tone]) => (
                  <span key={header} className="block">
                    <span className="label-ui mb-1 block text-foreground/60 sm:hidden">{header}</span>
                    <span className={`block leading-snug ${tone}`}>{value}</span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[0.95rem] leading-relaxed text-foreground/80">{m.note}</p>
          <Link to={PATHS[lang].sources} className={`${inlineLink} shrink-0`}>
            {HOME[lang].problem.sources} <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
};

export const HomeHowItWorks = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container mx-auto">
        {/* The figure headlines itself, so the section does not say it again.
            The eyebrow becomes the heading rather than disappearing: this is a
            nav target, and a section anyone can jump to needs a heading to land on. */}
        <h2><Eyebrow>{t.eyebrow}</Eyebrow></h2>
        <div className="mt-10"><EconomicLoop lang={lang} /></div>
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

export const HomeRevenue = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].revenue;
  return (
    <section id="business-model" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-10">
          {t.engines.map((e, i) => (
            <div key={e.name}>
              <GradedRule index={i} />
              <h3 className="mt-5 font-heading text-[1.75rem] leading-tight">{e.name}</h3>
              <dl className="mt-6 divide-y divide-foreground/15 border-t border-foreground/15">
                {([["customer", e.customer], ["pays", e.pays], ["status", e.status]] as const).map(([k, v]) => (
                  <div key={k} className="grid gap-x-8 gap-y-2 py-4 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
                    <dt className="label-ui pt-1 text-accent">{t.labels[k]}</dt>
                    <dd className="leading-relaxed text-foreground/85">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
          <PullQuote>{t.keyLine}</PullQuote>
          <p className="leading-relaxed text-foreground/80">{t.communities}</p>
        </div>
      </div>
    </section>
  );
};

export const HomeCapital = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].capital;
  return (
    <section id="capital" className="section-padding">
      <div className="container mx-auto">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="mt-14 divide-y divide-foreground/15">
          {t.routes.map((r) => (
            <div key={r.name} className="grid gap-5 py-8 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:items-center lg:gap-8">
              <p className="label-ui text-accent">{r.name}</p>
              <CapitalFlow steps={r.steps} caption={r.caption} />
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-12">
          <PullQuote>{t.herSide}</PullQuote>
          <div className="space-y-3 leading-relaxed text-foreground/80">
            <p>{t.callout}</p>
            <p>{t.solana}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const HomeAuditability = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].audit;
  return (
    <section id="auditability" className="section-padding">
      <div className="container mx-auto grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <ol className="space-y-3">
          {t.layers.map((l, i) => {
            const last = i === t.layers.length - 1;
            return (
              <li key={l.name}
                className={`grid gap-x-8 gap-y-2 rounded-sm px-7 py-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] ${last
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
