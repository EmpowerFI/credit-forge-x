import { ArrowRight, ArrowUpRight, Check, Trophy } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";
import SupportLogo from "@/components/SupportLogo";
import { GradedRule, SiteLinkButton } from "@/components/site/editorial";
import { SEBRAE_LOGO_SRC, UNICAMP_SEAL_SRC } from "@/config/links";
import { AWARDS_ANCHOR, DIARY_PATH, type Lang, type Maturity, MISSIONS_DEMO_PATH, PARTNERSHIPS_ANCHOR, PATHS, SITE } from "./content";
import { CampaignFlow, ContactForm, DiaryAccess, MaturityTag, MoreLink, Section, Shot, SitePage } from "./parts";

const shot = (name: "month" | "day", lang: Lang) => `/site/diary-${name}-${lang}.png`;

/** A title, a line and where it stands: the unit every list on the site is made of. */
function Item({ lang, m, title, body, index }: { lang: Lang; m?: Maturity; title: string; body: string; index: number }) {
  return (
    <div>
      <GradedRule index={index} />
      {m && <div className="mt-4"><MaturityTag lang={lang} m={m} /></div>}
      <h3 className="mt-3 font-heading text-[1.4rem] leading-tight">{title}</h3>
      <p className="mt-2 leading-relaxed text-foreground/80">{body}</p>
    </div>
  );
}

// ------------------------------------------------------------------ home

/**
 * The home page in six sections: the hero, the tools, the campaigns, how a
 * campaign works, the technology, and what is real. The near-term product
 * leads; the protocol has its own page.
 */
export function HomePage({ lang }: { lang: Lang }) {
  const t = SITE[lang].home;
  const p = PATHS[lang];
  return (
    <SitePage lang={lang} page="home" seo={t.seo}>
      {/* 1 · Hero: what it is, for whom, and the two ways in. */}
      <section className="px-4 pb-16 pt-28 md:px-8 lg:pb-24 lg:pt-36">
        <div className="container mx-auto grid items-center gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow text-foreground/65">{t.hero.eyebrow}</p>
            <div className="mt-6 h-[1.5px] w-[5.5rem] bg-gold" aria-hidden />
            <h1 className="section-title mt-6 !text-[2.75rem] md:!text-[3.75rem] lg:!text-[4.5rem]">
              {t.hero.title} <em className="italic text-accent">{t.hero.accent}</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/85 md:text-xl">{t.hero.body}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <SiteLinkButton to={p.entrepreneurs} primary>
                {t.hero.primary} <ArrowRight size={18} className="text-accent" aria-hidden />
              </SiteLinkButton>
              <SiteLinkButton to={p.sponsors}>
                {t.hero.secondary} <ArrowRight size={18} className="text-accent" aria-hidden />
              </SiteLinkButton>
            </div>
          </div>
          <Shot src={shot("month", lang)} alt={t.hero.shotAlt} note={t.hero.shotNote} className="justify-self-center lg:justify-self-end" />
        </div>
      </section>

      {/* 2 · The tools she uses today. */}
      <Section id="tools" className="border-t border-foreground/10">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <SectionHeading eyebrow={t.tools.eyebrow} title={t.tools.title} accent={t.tools.accent} />
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-7">
              {t.tools.items.map((it, i) => <Item key={it.title} lang={lang} m={it.maturity as Maturity} title={it.title} body={it.body} index={i} />)}
            </div>
          </div>
          <Shot src={shot("day", lang)} alt={t.tools.shotAlt} className="justify-self-center lg:justify-self-end" />
        </div>
      </Section>

      {/* 3 · Impact campaigns, the one sponsored product: the benefit, not the money split. */}
      <Section id="campaigns" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.campaigns.eyebrow} title={t.campaigns.title} accent={t.campaigns.accent} subtitle={t.campaigns.body} />
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <p className="font-heading text-xl">{t.campaigns.product}</p>
          <MaturityTag lang={lang} m={t.campaigns.maturity} />
        </div>
        <ul className="mt-8 flex flex-wrap gap-3">
          {t.campaigns.facts.map((f) => (
            <li key={f} className="rounded-sm border border-foreground/20 px-4 py-2 text-[1.0625rem]">{f}</li>
          ))}
        </ul>
      </Section>

      {/* 4 · How it works: the flow, the split as a mechanism, the rules. */}
      <Section id="how-it-works" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.how.eyebrow} title={t.how.title} accent={t.how.accent} />
        <div className="mt-12"><CampaignFlow lang={lang} /></div>
        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-14">
          <dl className="grid grid-cols-2 gap-px self-start border border-foreground/15 bg-foreground/15">
            {t.how.split.map((s) => (
              <div key={s.label} className="bg-background p-5">
                <dt className="font-heading text-4xl text-accent">{s.share}</dt>
                <dd className="mt-2 text-[0.95rem] leading-snug text-foreground/80">{s.label}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-8 sm:grid-cols-2">
            {t.how.rules.map((r) => (
              <div key={r.title}>
                <h3 className="font-heading text-xl">{r.title}</h3>
                <p className="mt-2 leading-relaxed text-foreground/80">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-10 max-w-3xl border-t border-foreground/15 pt-4 text-[0.95rem] leading-relaxed text-foreground/75">
          {t.how.caveat} <MoreLink to={MISSIONS_DEMO_PATH}>{t.how.demo}</MoreLink>
        </p>
      </Section>

      {/* 5 · Technology, kept short: two uses, each with where it stands. */}
      <Section id="technology" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.tech.eyebrow} title={t.tech.title} accent={t.tech.accent} />
        <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-14">
          {t.tech.items.map((it, i) => <Item key={it.title} lang={lang} m={it.maturity as Maturity} title={it.title} body={it.body} index={i} />)}
        </div>
        <div className="mt-10">
          <SiteLinkButton to={p.protocol}>{t.tech.cta} <ArrowRight size={18} className="text-accent" aria-hidden /></SiteLinkButton>
        </div>
      </Section>

      {/* 6 · What is real, and the two ways in again. */}
      <Section id="traction" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.traction.eyebrow} title={t.traction.title} accent={t.traction.accent} />
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {t.traction.items.map((it, i) => (
            <div key={it.title} className="flex flex-col">
              <GradedRule index={i} />
              <p className="label-ui mt-4 text-foreground/85">{it.tag}</p>
              <h3 className="mt-2 font-heading text-[1.25rem] leading-tight">{it.title}</h3>
              <p className="mt-2 leading-relaxed text-foreground/80">{it.body}</p>
              {"diary" in it && it.diary && <DiaryAccess lang={lang} stack className="mt-4" />}
              {"logo" in it && it.logo === "sebrae" && <SupportLogo src={SEBRAE_LOGO_SRC} alt="Sebrae" />}
              {"logo" in it && it.logo === "unicamp" && (
                <SupportLogo large src={UNICAMP_SEAL_SRC} alt={lang === "pt" ? "Selo Empresa-filha da Unicamp" : "Unicamp empresa-filha seal"} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-foreground/15 pt-10">
          <h3 className="flex items-center gap-2 font-heading text-2xl"><Trophy size={22} className="text-accent" aria-hidden />{t.traction.awards.title}</h3>
          <ul className="mt-5 grid gap-6 sm:grid-cols-2">
            {t.traction.awards.items.map((a) => (
              <li key={a.title} className="border-l-2 border-gold pl-4">
                <p className="label-ui text-accent">{a.place}</p>
                <a href={a.href} target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-flex items-start gap-1.5 font-heading text-[1.2rem] leading-snug underline-offset-4 hover:underline">
                  {a.title} <ArrowUpRight size={16} className="mt-1 shrink-0 text-accent" aria-hidden />
                </a>
                <p className="mt-1 text-foreground/75">{a.by}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4"><MoreLink to={`${p.about}#${AWARDS_ANCHOR}`}>{t.traction.awards.cta}</MoreLink></div>
        </div>
        <div className="mt-14 grid gap-10 border-t border-foreground/15 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <h3 className="font-heading text-2xl">{t.traction.partnerships.title}</h3>
            <p className="mt-2 leading-relaxed text-foreground/80">{t.traction.partnerships.body}</p>
            <div className="mt-3"><MoreLink to={`${p.about}#${PARTNERSHIPS_ANCHOR}`}>{t.traction.partnerships.cta}</MoreLink></div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SiteLinkButton to={p.entrepreneurs} primary>{t.traction.join} <ArrowRight size={18} className="text-accent" aria-hidden /></SiteLinkButton>
            <SiteLinkButton to={`${p.sponsors}#contact`}>{t.traction.partner} <ArrowRight size={18} className="text-accent" aria-hidden /></SiteLinkButton>
          </div>
        </div>
      </Section>
    </SitePage>
  );
}

// ------------------------------------------------------------------ entrepreneurs

/** For the woman who runs the business: plain words, phone first. */
export function EntrepreneursPage({ lang }: { lang: Lang }) {
  const t = SITE[lang].entrepreneurs;
  const p = PATHS[lang];
  const start = (
    <SiteLinkButton to={DIARY_PATH} primary>
      {t.hero.primary} <ArrowUpRight size={18} className="text-accent" aria-hidden />
    </SiteLinkButton>
  );
  return (
    <SitePage lang={lang} page="entrepreneurs" seo={t.seo}>
      <section className="px-4 pb-16 pt-28 md:px-8 lg:pb-24 lg:pt-36">
        <div className="container mx-auto grid items-center gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow text-foreground/65">{t.hero.eyebrow}</p>
            <div className="mt-6 h-[1.5px] w-[5.5rem] bg-gold" aria-hidden />
            <h1 className="section-title mt-6 !text-[2.6rem] md:!text-[3.5rem] lg:!text-[4.25rem]">
              {t.hero.title} <em className="italic text-accent">{t.hero.accent}</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/85 md:text-xl">{t.hero.body}</p>
            <div className="mt-9">{start}</div>
            <DiaryAccess lang={lang} className="mt-7" />
          </div>
          <Shot src={shot("month", lang)} alt={SITE[lang].home.hero.shotAlt} note={SITE[lang].home.hero.shotNote}
            className="justify-self-center lg:justify-self-end" />
        </div>
      </section>

      <Section id="tools" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.tools.eyebrow} title={t.tools.title} accent={t.tools.accent} />
        <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid gap-10 sm:grid-cols-2">
            {t.tools.items.map((it, i) => <Item key={it.title} lang={lang} m={it.maturity as Maturity} title={it.title} body={it.body} index={i % 3} />)}
          </div>
          <Shot src={shot("day", lang)} alt={SITE[lang].home.tools.shotAlt} className="justify-self-center lg:justify-self-end" />
        </div>
      </Section>

      <Section id="campaigns" className="border-t border-foreground/10">
        <div className="flex flex-wrap items-center gap-4">
          <SectionHeading eyebrow={t.campaigns.eyebrow} title={t.campaigns.title} accent={t.campaigns.accent} />
        </div>
        <div className="mt-4"><MaturityTag lang={lang} m={t.campaigns.maturity} /></div>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {t.campaigns.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gold font-heading text-lg text-accent">{i + 1}</span>
              <span>
                <span className="block font-heading text-xl leading-snug">{s.title}</span>
                <span className="mt-1 block leading-relaxed text-foreground/80">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl border-t border-foreground/15 pt-4 text-[0.95rem] leading-relaxed text-foreground/75">{t.campaigns.caveat}</p>
      </Section>

      <Section id="history" className="border-t border-foreground/10">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <SectionHeading eyebrow={t.history.eyebrow} title={t.history.title} accent={t.history.accent} />
            <div className="mt-4"><MaturityTag lang={lang} m={t.history.maturity} /></div>
            <p className="mt-5 max-w-xl leading-relaxed text-foreground/85">{t.history.body}</p>
          </div>
          <div className="self-end border-t border-foreground/15 pt-5">
            <h3 className="font-heading text-2xl">{t.privacy.title}</h3>
            <p className="mt-2 leading-relaxed text-foreground/80">{t.privacy.body}</p>
            <div className="mt-3"><MoreLink to={p.privacy}>{t.privacy.link}</MoreLink></div>
          </div>
        </div>
      </Section>

      <Section className="border-t border-foreground/10">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <h2 className="section-title">{t.cta.title}</h2>
          <div className="space-y-6">{start}<DiaryAccess lang={lang} /></div>
        </div>
      </Section>
    </SitePage>
  );
}

// ------------------------------------------------------------------ sponsors

/** For sponsors: the benefit, the one product (Impact Marketing), then the vault. */
export function SponsorsPage({ lang }: { lang: Lang }) {
  const t = SITE[lang].sponsors;
  return (
    <SitePage lang={lang} page="sponsors" seo={t.seo}>
      <section className="px-4 pb-16 pt-28 md:px-8 lg:pb-20 lg:pt-36">
        <div className="container mx-auto">
          <p className="eyebrow text-foreground/65">{t.hero.eyebrow}</p>
          <div className="mt-6 h-[1.5px] w-[5.5rem] bg-gold" aria-hidden />
          <h1 className="section-title mt-6 max-w-4xl !text-[2.6rem] md:!text-[3.5rem] lg:!text-[4.25rem]">
            {t.hero.title} <em className="italic text-accent">{t.hero.accent}</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/85 md:text-xl">{t.hero.body}</p>
          <div className="mt-9">
            <a href="#contact" className="btn-site btn-site-primary">{t.hero.primary} <ArrowRight size={18} className="text-accent" aria-hidden /></a>
          </div>
        </div>
      </section>

      <Section id="format" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.format.eyebrow} title={t.format.title} accent={t.format.accent} subtitle={t.format.body} />
        <div className="mt-6"><MaturityTag lang={lang} m={t.format.maturity} /></div>
        <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {t.format.items.map((it) => (
            <li key={it.title} className="flex gap-3.5">
              <Check size={20} className="mt-1 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block font-heading text-xl leading-snug">{it.title}</span>
                <span className="mt-1 block leading-relaxed text-foreground/80">{it.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="vault" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.vault.eyebrow} title={t.vault.title} accent={t.vault.accent} subtitle={t.vault.body} />
        <div className="mt-12"><CampaignFlow lang={lang} /></div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <MaturityTag lang={lang} m="devnet" />
          <MoreLink to={MISSIONS_DEMO_PATH}>{t.vault.demo}</MoreLink>
        </div>
      </Section>

      <Section id="contact" className="border-t border-foreground/10">
        <div className="grid gap-12 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-20">
          <SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.accent} subtitle={t.contact.body} />
          <ContactForm lang={lang} initial="impact" />
        </div>
      </Section>
    </SitePage>
  );
}

// ------------------------------------------------------------------ protocol

/** For investors, institutions, developers and Web3 partners: the long view, labelled. */
export function ProtocolPage({ lang }: { lang: Lang }) {
  const t = SITE[lang].protocol;
  return (
    <SitePage lang={lang} page="protocol" seo={t.seo}>
      <section className="px-4 pb-16 pt-28 md:px-8 lg:pb-20 lg:pt-36">
        <div className="container mx-auto">
          <p className="eyebrow text-foreground/65">{t.hero.eyebrow}</p>
          <div className="mt-6 h-[1.5px] w-[5.5rem] bg-gold" aria-hidden />
          <h1 className="section-title mt-6 !text-[2.6rem] md:!text-[3.5rem] lg:!text-[4.25rem]">
            {t.hero.title} <em className="italic text-accent">{t.hero.accent}</em>
          </h1>
          <p className="mt-6 font-heading text-2xl text-foreground md:text-3xl">{t.hero.body}</p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">{t.hero.intro}</p>
        </div>
      </section>

      <Section id="layers" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.layers.eyebrow} title={t.layers.title} accent={t.layers.accent} />
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-7">
          {t.layers.items.map((it, i) => <Item key={it.title} lang={lang} m={it.maturity as Maturity} title={it.title} body={it.body} index={i % 3} />)}
        </div>
      </Section>

      <Section id="architecture" className="border-t border-foreground/10">
        <p className="eyebrow">{t.diagram.eyebrow}</p>
        <ol className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {t.diagram.columns.map((c, i) => (
            <li key={c.title} className="contents">
              <div className={`rounded-sm p-6 ${i === 1 ? "border-[1.5px] border-gold bg-gold/10" : "border border-foreground/20"}`}>
                <p className="font-heading text-xl">{c.title}</p>
                <ul className="mt-3 space-y-1.5 text-[0.95rem] text-foreground/80">
                  {c.items.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
              {i < 2 && <span className="self-center justify-self-center text-xl tracking-[0.3em] text-accent" aria-hidden>⇄</span>}
            </li>
          ))}
        </ol>
      </Section>

      <Section id="limits" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.limits.eyebrow} title={t.limits.title} accent={t.limits.accent} />
        <ul className="mt-10 grid gap-x-10 gap-y-4 md:grid-cols-2">
          {t.limits.items.map((x) => (
            <li key={x} className="flex gap-3.5 text-[1.0625rem] leading-snug">
              <span className="mt-[0.45rem] h-3 w-3 shrink-0 rounded-full border-[1.5px] border-gold" aria-hidden />{x}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="roadmap" className="border-t border-foreground/10">
        <SectionHeading eyebrow={t.roadmap.eyebrow} title={t.roadmap.title} accent={t.roadmap.accent} />
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {t.roadmap.phases.map((ph, i) => (
            <div key={ph.when}>
              <GradedRule index={i} />
              <p className="mt-4 font-heading text-2xl">{ph.when}</p>
              <ul className="mt-3 space-y-2 leading-snug text-foreground/85">
                {ph.items.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10"><MoreLink to={MISSIONS_DEMO_PATH}>{SITE[lang].home.how.demo}</MoreLink></div>
      </Section>

      <Section id="contact" className="border-t border-foreground/10">
        <div className="grid gap-12 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:gap-20">
          <SectionHeading eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.accent} subtitle={t.contact.body} />
          <ContactForm lang={lang} initial="investment" />
        </div>
      </Section>
    </SitePage>
  );
}
