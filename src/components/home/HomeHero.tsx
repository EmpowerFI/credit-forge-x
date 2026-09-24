import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SiteAnchorButton, SiteLinkButton } from "@/components/site/editorial";
import { HOME, type Lang } from "./copy";

/**
 * The hero, as the founder's reference draws it: the sentence on the left with
 * room to be long, and on the right what the platform is actually made of.
 *
 * No entrance animation. The first thing a partner or a judge reads should be
 * on the screen when the screen arrives — and a page that fades itself in has
 * to be told, separately, to stop doing that for anyone who asked it to.
 */
const HomeHero = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].hero;
  const p = t.panel;
  return (
    <section className="px-4 pb-20 pt-28 md:px-8 lg:pb-28 lg:pt-36">
      <div className="container mx-auto grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
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

          {/* What is a prototype and what is a plan, before anything else is claimed. */}
          <div className="mt-11 max-w-2xl space-y-2 border-t border-foreground/15 pt-4">
            <p className="label-ui text-foreground/90">{t.statusLabel}</p>
            {t.status.map((line) => (
              <p key={line} className="text-[0.95rem] leading-relaxed text-foreground/80">{line}</p>
            ))}
          </div>
        </div>

        <div className="lg:pt-1.5">
          <p className="eyebrow">{p.title}</p>
          <div className="mt-5 space-y-3">
            {p.intelligences.map((it, i) => (
              <div key={it.name}>
                {i > 0 && <p className="py-1 text-center text-xl leading-none text-accent" aria-hidden>+</p>}
                <div className="rounded-sm border border-gold/55 px-6 py-5">
                  <p className="font-heading text-2xl leading-tight">{it.name}</p>
                  <p className="mt-2 text-[0.95rem] leading-snug text-foreground/85">{it.desc}</p>
                </div>
              </div>
            ))}
            <p className="py-1 text-center text-xl leading-none text-accent" aria-hidden>↓</p>
            <ul className="grid grid-cols-3 gap-2.5">
              {p.outputs.map((o) => (
                <li key={o.who}
                  className={`rounded-sm px-3.5 py-4 ${o.future
                    ? "border border-dashed border-gold/60"
                    : "border-[1.5px] border-gold bg-gold/12"}`}>
                  <span className="label-ui block text-foreground/90">{o.who}</span>
                  <span className="mt-1.5 block font-heading text-[1.0625rem] leading-tight">{o.what}</span>
                </li>
              ))}
            </ul>
            <p className="pt-1 text-sm text-foreground/65">{p.futureNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHero;
