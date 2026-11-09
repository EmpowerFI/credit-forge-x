import type { AboutContent } from "@/content/about";
import { PARTNERSHIPS_ANCHOR, type Lang } from "@/site/content";
import { ContactForm } from "@/site/parts";

/**
 * The business model, kept in three separate relationships -- one
 * sponsorship product, strategic partnerships, the long-term infrastructure
 * -- and then the partnerships themselves, with a form to propose one.
 * Partnerships are never presented as a second sponsorship product.
 */
const AboutStrategy = ({ strategy, lang }: { strategy: AboutContent["strategy"]; lang: Lang }) => {
  const { model, partnerships: p } = strategy;
  return (
    <>
      <section id="modelo" className="section-padding gradient-subtle">
        <div className="container mx-auto max-w-5xl space-y-12">
          <div className="text-center space-y-4">
            <p className="text-sm font-medium text-accent uppercase tracking-widest">{model.eyebrow}</p>
            <h2 className="section-title">
              {model.titleLead}
              <span className="text-gradient">{model.titleAccent}</span>
            </h2>
            <p className="section-subtitle">{model.subtitle}</p>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {model.tiers.map((t, i) => (
              <li key={t.title} className="glass rounded-2xl p-8 glow-border flex flex-col gap-3">
                <span className="font-heading text-sm text-accent tabular-nums">0{i + 1}</span>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t.horizon}</p>
                <h3 className="font-heading text-xl font-bold text-foreground">{t.title}</h3>
                <p className="flex-1 leading-relaxed text-muted-foreground">{t.desc}</p>
                <p className="self-start rounded-full border border-gold/60 px-3 py-1 text-xs font-medium text-foreground">{t.status}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id={PARTNERSHIPS_ANCHOR} className="section-padding scroll-mt-20">
        <div className="container mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-medium text-accent uppercase tracking-widest">{p.eyebrow}</p>
              <h2 className="section-title">
                {p.titleLead}
                <span className="text-gradient">{p.titleAccent}</span>
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">{p.subtitle}</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">{p.partnersLabel}</h3>
                <ul className="mt-3 space-y-2 text-foreground/85">
                  {p.partners.map((x) => (
                    <li key={x} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground">{p.usesLabel}</h3>
                <ul className="mt-3 space-y-2 text-foreground/85">
                  {p.uses.map((x) => (
                    <li key={x} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="border-l-2 border-gold pl-4 text-foreground/85">{p.note}</p>
          </div>
          <div className="space-y-5">
            <h3 className="font-heading text-2xl font-bold text-foreground">{p.cta}</h3>
            <ContactForm lang={lang} initial="partnership" />
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutStrategy;
