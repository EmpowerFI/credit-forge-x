import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteAnchorButton, SiteLinkButton } from "@/components/site/editorial";
import { HOME, type Lang } from "./copy";

/**
 * The hero: the economic thesis on the left, and on the right the architecture
 * it rests on — four layers, with EmpowerFI as the one in the middle.
 *
 * The right-hand column deliberately says nothing about Solana, USDC or
 * tokenisation. A visitor who reads only this screen should leave knowing what
 * the company connects to what; the technology that carries it is a later
 * section, because leading with the rail is how an infrastructure company gets
 * mistaken for a crypto one.
 *
 * No entrance animation. The first thing a partner or a judge reads should be
 * on the screen when the screen arrives — and a page that fades itself in has
 * to be told, separately, to stop doing that for anyone who asked it to.
 */
const HomeHero = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].hero;
  const s = t.stack;
  return (
    <section className="px-4 pb-20 pt-28 md:px-8 lg:pb-28 lg:pt-36">
      <div className="container mx-auto grid gap-14 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start xl:gap-16">
        <div>
          <p className="eyebrow leading-relaxed text-foreground/60">{t.badge}</p>
          <div className="mt-7 h-[1.5px] w-[5.5rem] bg-gold" aria-hidden />
          <h1 className="section-title mt-7 !text-[2.5rem] md:!text-[3.5rem] lg:!text-[4.25rem]">
            {t.title} <em className="italic text-accent">{t.accent}</em>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-foreground/85 md:text-xl">{t.body}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <SiteLinkButton to={`/app?lang=${lang}`} primary>
              {t.explore} <ArrowUpRight size={18} className="text-accent" aria-hidden />
            </SiteLinkButton>
            <SiteAnchorButton href="#contact">
              {t.partner} <ArrowRight size={18} className="text-accent" aria-hidden />
            </SiteAnchorButton>
          </div>

          <p className="mt-6 text-[0.95rem] text-foreground/70">{t.note}</p>

          {/* What is a prototype and what is a plan, before anything else is claimed. */}
          <div className="mt-10 max-w-2xl space-y-2 border-t border-foreground/15 pt-4">
            <p className="label-ui text-foreground/90">{t.statusLabel}</p>
            {t.status.map((line) => (
              <p key={line} className="text-[0.95rem] leading-relaxed text-foreground/80">{line}</p>
            ))}
          </div>
        </div>

        {/* Four layers, capital going down and everything that proves it coming
            back up. The arrows point both ways on purpose: a diagram with one
            direction describes a grant, and this is not one. */}
        <div className="xl:pt-1.5">
          <p className="eyebrow">{s.title}</p>
          <ol className="mt-5 space-y-2">
            {s.layers.map((l, i) => (
              <li key={l.name}>
                {i > 0 && (
                  <p className="py-1.5 text-center text-sm leading-none tracking-[0.3em] text-accent" aria-hidden>↓ ↑</p>
                )}
                <div className={`rounded-sm px-6 py-5 ${l.emphasis
                  ? "border-[1.5px] border-gold bg-gold/12"
                  : "border border-gold/55"}`}>
                  <p className="font-heading text-2xl leading-tight">{l.name}</p>
                  <p className="mt-1.5 text-[0.95rem] leading-snug text-foreground/80">{l.sub}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="pt-4 text-sm leading-relaxed text-foreground/65">{s.note}</p>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
