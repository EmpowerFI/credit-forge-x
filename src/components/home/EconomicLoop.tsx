import { ArrowUpRight } from "lucide-react";
import loopEn from "@/assets/one-economic-loop-en.webp";
import loopPt from "@/assets/one-economic-loop-pt.webp";
import { HOME, type Lang } from "./copy";

// One economic loop, as the founder's figure draws it: sponsors, communities,
// entrepreneurs, tokenised credit, investors and the impact that returns. The
// figure is the artwork itself and carries its own headline, so the section
// around it says nothing the picture already says. Drawn in both languages —
// a Portuguese reader gets the Portuguese one — and what a screen reader hears
// is written out in both too.

const FIGURE: Record<Lang, string> = { en: loopEn, pt: loopPt };

const EconomicLoop = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  const figure = FIGURE[lang];
  return (
    <figure className="space-y-3">
      {/* Too wide to read on a phone: there it scrolls sideways at a size that can be read. */}
      <div className="overflow-x-auto rounded-sm border border-foreground/15 bg-card">
        <a href={figure} target="_blank" rel="noopener noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
          <img src={figure} alt={t.figureAlt} width={1536} height={1024} loading="lazy" decoding="async"
            className="w-[52rem] max-w-none lg:w-full" />
        </a>
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-foreground/70">
        <span className="text-xs lg:hidden">{t.figureSwipe}</span>
        <a href={figure} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline">
          {t.figureOpen} <ArrowUpRight size={14} aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
};

export default EconomicLoop;
