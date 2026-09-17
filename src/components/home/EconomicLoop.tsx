import { ArrowUpRight } from "lucide-react";
import loopFigure from "@/assets/one-economic-loop.webp";
import { HOME, type Lang } from "./copy";

// One economic loop, as the founder's figure draws it: the problem, the seven
// steps around Solana with the proof each one leaves, the two capital pools and
// the result. The figure is the artwork itself; the words around it, and the
// description a screen reader hears, are in both languages.

const EconomicLoop = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  return (
    <figure className="space-y-3">
      {/* Too wide to read on a phone: there it scrolls sideways at a size that can be read. */}
      <div className="overflow-x-auto rounded-2xl glass glow-border">
        <a href={loopFigure} target="_blank" rel="noopener noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
          <img src={loopFigure} alt={t.figureAlt} width={2072} height={1382} loading="lazy" decoding="async"
            className="w-[52rem] max-w-none lg:w-full" />
        </a>
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-muted-foreground">
        <span>{t.figureCaption}</span>
        <span className="text-xs lg:hidden">{t.figureSwipe}</span>
        {t.figureNote && <span className="text-xs">{t.figureNote}</span>}
        <a href={loopFigure} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-accent hover:text-foreground">
          {t.figureOpen} <ArrowUpRight size={14} aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
};

export default EconomicLoop;
