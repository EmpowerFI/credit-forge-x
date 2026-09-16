import { ArrowRight, ArrowUpRight, Database, Gauge, Landmark, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import CapitalFlow from "@/components/CapitalFlow";
import { investorCopy, type InvestorLang } from "@/components/investors/copy";

// Icons by position: proof, revenue, cost to serve, data.
const pillarIcons = [ShieldCheck, Landmark, Gauge, Database];

const linkClass =
  "inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-foreground";

/**
 * The thesis, in the order an investor needs it: how a loan comes to exist and
 * is repaid, where the capital comes from (two pools, one engine), what the
 * business rests on, and which phase each of those statements belongs to.
 *
 * The pilot's partner lending is a fact about the pilot only; nothing here may
 * read as the permanent model, or as a licence EmpowerFI holds.
 */
const InvestorThesis = ({ lang }: { lang: InvestorLang }) => {
  const t = investorCopy[lang].thesis;

  return (
    <section id="thesis" className="section-padding gradient-subtle">
      <div className="container mx-auto space-y-16">
        <div className="space-y-12">
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {t.eyebrow}
            </p>
            <h2 className="section-title">
              {t.titleLead} <span className="text-gradient">{t.titleAccent}</span>
            </h2>
            <p className="section-subtitle">{t.subtitle}</p>
          </div>

          <CapitalFlow steps={t.flow} caption={t.flowCaption} />

          <p className="mx-auto max-w-2xl text-center font-heading text-base font-semibold text-foreground">
            {t.invariants}
          </p>
        </div>

        <div className="space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {t.pools.eyebrow}
            </p>
            <h3 className="section-title !text-3xl md:!text-4xl">{t.pools.title}</h3>
            <p className="section-subtitle">{t.pools.intro}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {t.pools.items.map(({ name, rail, desc }) => (
              <div key={name} className="rounded-2xl p-8 glass glow-border">
                <p className="text-xs font-medium uppercase tracking-widest text-accent">{rail}</p>
                <h4 className="mb-2 mt-2 font-heading text-xl font-bold text-foreground">{name}</h4>
                <p className="leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-3xl space-y-3 rounded-2xl border border-border bg-card/50 p-8">
            <p className="font-heading font-semibold text-foreground">{t.pools.herSide}</p>
            <p className="leading-relaxed text-muted-foreground">{t.pools.engine}</p>
            <p className="leading-relaxed text-muted-foreground">{t.pools.whyGlobal}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {t.pillars.map(({ title, desc }, i) => {
            const Icon = pillarIcons[i % pillarIcons.length];
            return (
              <div key={title} className="rounded-2xl p-8 glass glow-border">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg gradient-primary">
                  <Icon className="text-primary-foreground" size={22} />
                </div>
                <h3 className="mb-2 font-heading text-lg font-bold text-foreground">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-accent">
              {t.phases.eyebrow}
            </p>
            <h3 className="section-title !text-3xl md:!text-4xl">{t.phases.title}</h3>
          </div>

          <ol className="grid gap-6 md:grid-cols-3">
            {t.phases.items.map(({ when, title, desc }) => (
              <li key={when} className="rounded-2xl border border-border bg-card/60 p-7">
                <p className="text-xs font-medium uppercase tracking-widest text-accent">{when}</p>
                <h4 className="mb-2 mt-2 font-heading text-lg font-bold text-foreground">{title}</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>

          <div className="mx-auto max-w-3xl space-y-2 text-center text-sm leading-relaxed text-muted-foreground">
            <p>{t.phases.regulation}</p>
            <p>{t.phases.notOffer}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
          <Link to={`/app?lang=${lang}`} className={linkClass}>
            {t.links.prototype} <ArrowUpRight size={14} />
          </Link>
          <Link to="/sources" className={linkClass}>
            {t.links.sources} <ArrowRight size={14} />
          </Link>
          <Link to={t.links.morePath} className={linkClass}>
            {t.links.more} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default InvestorThesis;
