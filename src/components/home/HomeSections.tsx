import { ArrowRight, Building2, Coins, Eye, Fingerprint, Lock, Sprout, Store, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";
import SectionHeading from "@/components/SectionHeading";
import { HOME, type Lang, PATHS } from "./copy";

const PROBLEM_ICONS = [Building2, Store, TrendingUp];

export const HomeProblem = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].problem;
  return (
    <section id="problem" className="section-padding">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="grid gap-6 md:grid-cols-3">
          {t.cards.map((c, i) => {
            const Icon = PROBLEM_ICONS[i];
            return (
              <div key={c.who} className="flex flex-col rounded-2xl p-7 glass glow-border">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary"><Icon size={20} className="text-primary-foreground" aria-hidden /></span>
                  <span className="text-sm font-semibold uppercase tracking-widest text-accent">{c.who}</span>
                </div>
                <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{c.title}</h3>
                <p className="flex-1 leading-relaxed text-muted-foreground">{c.desc}</p>
                {"note" in c && c.note && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{c.note}</p>}
              </div>
            );
          })}
        </div>
        <p className="text-center">
          <Link to={PATHS[lang].sources} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-foreground">
            {t.sources} <ArrowRight size={14} />
          </Link>
        </p>
      </div>
    </section>
  );
};

export const HomeHowItWorks = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  return (
    <section id="how-it-works" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} subtitle={t.subtitle} />
        <CapitalFlow steps={t.steps} loopLabel={t.loop} caption={t.caption} />
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {t.judgements.map((j) => (
              <div key={j.a} className="rounded-xl bg-background/70 px-4 py-3 text-center glow-border">
                <p className="text-sm text-muted-foreground">{j.q}</p>
                <p className="font-heading text-base font-bold text-foreground">{j.a}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {t.judgementsNote}{" "}
            <Link to={PATHS[lang].readiness} className="font-medium text-accent hover:text-foreground">{t.more} →</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

const ENGINE_ICONS = [Sprout, Coins];

export const HomeRevenue = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].revenue;
  return (
    <section id="business-model" className="section-padding">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="grid gap-6 md:grid-cols-2">
          {t.engines.map((e, i) => {
            const Icon = ENGINE_ICONS[i];
            return (
              <div key={e.name} className="flex flex-col gap-5 rounded-2xl p-8 glass glow-border">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg gradient-primary"><Icon size={22} className="text-primary-foreground" aria-hidden /></span>
                  <h3 className="font-heading text-xl font-bold text-foreground">{e.name}</h3>
                </div>
                <dl className="space-y-4">
                  {([["customer", e.customer], ["pays", e.pays], ["status", e.status]] as const).map(([k, v]) => (
                    <div key={k} className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-widest text-accent">{t.labels[k]}</dt>
                      <dd className="leading-relaxed text-muted-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="font-heading text-2xl font-bold text-foreground md:text-3xl">
            <span className="text-gradient">{t.keyLine}</span>
          </p>
          <p className="flex items-start justify-center gap-2 text-sm text-muted-foreground">
            <Users size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {t.communities}
          </p>
        </div>
      </div>
    </section>
  );
};

export const HomeCapital = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].capital;
  return (
    <section id="capital" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <div className="space-y-8">
          {t.routes.map((r) => (
            <div key={r.name} className="space-y-3">
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">{r.name}</p>
              <CapitalFlow steps={r.steps} caption={r.caption} />
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-3xl space-y-3 rounded-2xl p-6 text-center glass glow-border">
          <p className="leading-relaxed text-foreground">{t.callout}</p>
          <p className="text-sm text-muted-foreground">{t.herSide} {t.solana}</p>
        </div>
      </div>
    </section>
  );
};

const LAYER_ICONS = [Lock, Eye, Fingerprint];

export const HomeAuditability = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].audit;
  return (
    <section id="auditability" className="section-padding">
      <div className="container mx-auto space-y-12">
        <SectionHeading eyebrow={t.eyebrow} title={t.title} accent={t.accent} />
        <ol className="grid gap-4 md:grid-cols-3">
          {t.layers.map((l, i) => {
            const Icon = LAYER_ICONS[i];
            return (
              <li key={l.name} className="relative flex flex-col gap-3 rounded-2xl p-7 glass glow-border">
                <span className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${i === 2 ? "gradient-primary" : "bg-secondary"}`}>
                    <Icon size={20} className={i === 2 ? "text-primary-foreground" : "text-accent"} aria-hidden />
                  </span>
                  <span className="font-heading text-lg font-bold text-foreground">{l.name}</span>
                </span>
                <p className="leading-relaxed text-muted-foreground">{l.desc}</p>
                {i < 2 && <ArrowRight size={18} className="absolute -right-3.5 top-1/2 hidden -translate-y-1/2 text-accent md:block" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
