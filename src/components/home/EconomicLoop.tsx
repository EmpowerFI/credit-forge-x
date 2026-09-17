import { ArrowRight, BarChart3, Box, Brain, CheckCircle2, ChevronRight, FileText, Globe, Landmark, Leaf, Lock, Radio, Share2, ShieldCheck, Store, Users, type LucideIcon } from "lucide-react";
import { HOME, type Lang } from "./copy";

// The one economic loop, as the founder's figure draws it (17 Sep): a sponsor
// funds a cohort, the community runs it, evidence qualifies credit, the capital
// engine routes it, the business receives and repays, and the outcome returns
// to the sponsor — with Solana in the middle and every step's proof named.
//
// On large screens the seven steps sit around the centre, clockwise from the
// top, in a three-by-three grid; below that they read as one column, in order.

const STEP_ICON: LucideIcon[] = [Landmark, Users, FileText, Brain, Share2, Store, BarChart3];
const TRAIT_ICON: LucideIcon[] = [ShieldCheck, Lock, Radio, Box];
const RESULT_ICON: (LucideIcon | null)[] = [Leaf, Users, BarChart3, null];

/** Where each step sits around the centre on large screens, clockwise from the top. */
const STEP_CELL = [
  "lg:col-start-2 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-3 lg:row-start-3",
  "lg:col-start-1 lg:row-start-3",
  "lg:col-start-1 lg:row-start-2",
  "lg:col-start-1 lg:row-start-1",
];
/** The order they read in on one column: the loop, then the pools after the capital engine. */
const STEP_ORDER = ["order-1", "order-2", "order-3", "order-4", "order-5", "order-7", "order-8"];

/** The four corners the centre's qualities sit at, inside the dashed ring. */
const TRAIT_POS = [
  "lg:absolute lg:left-1 lg:top-[13%]",
  "lg:absolute lg:right-1 lg:top-[13%]",
  "lg:absolute lg:bottom-[13%] lg:left-1",
  "lg:absolute lg:bottom-[13%] lg:right-1",
];

/** Solana's mark, in its own colours, as the figure has it. */
const SolanaMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 397 311" className={className} role="img" aria-label="Solana">
    <defs>
      <linearGradient id="solana-mark" x1="360" y1="-37" x2="141" y2="383" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    <g fill="url(#solana-mark)">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.6z" />
    </g>
  </svg>
);

const EconomicLoop = ({ lang }: { lang: Lang }) => {
  const t = HOME[lang].how;
  return (
    <figure className="space-y-8">
      <div className="mx-auto max-w-2xl space-y-2 text-center">
        <p className="font-heading text-xl font-bold text-foreground">{t.kicker}</p>
        <p className="text-xs font-medium uppercase tracking-widest text-accent">{t.layers}</p>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-center lg:gap-5">
        {t.steps.map((step, i) => {
          const Icon = STEP_ICON[i];
          return (
            <article key={step.label}
              className={`flex flex-col gap-2.5 rounded-2xl p-5 glass glow-border ${STEP_ORDER[i]} lg:order-none lg:self-center ${STEP_CELL[i]}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary">
                  <Icon size={19} className="text-primary-foreground" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-bold text-foreground">
                    <span className="text-accent">{i + 1}.</span> {step.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{step.sub}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {step.proof && (
                <p className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs font-medium text-foreground">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden /> {step.proof}
                </p>
              )}
              <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-semibold text-accent">
                <ArrowRight size={13} aria-hidden /> {step.hands}
              </p>
            </article>
          );
        })}

        {/* The centre: Solana, and what it is there for. */}
        <div className="relative order-first mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-5 rounded-2xl p-5 lg:order-none lg:col-start-2 lg:row-start-2 lg:aspect-square lg:w-[21rem] lg:max-w-none lg:p-0">
          <span aria-hidden className="pointer-events-none absolute inset-3 hidden rounded-full border border-dashed border-accent/45 lg:block" />
          {/* Four heads on the ring, so the loop reads clockwise. */}
          {["lg:left-1/2 lg:top-3 lg:-translate-x-1/2 lg:-translate-y-1/2",
            "lg:right-3 lg:top-1/2 lg:translate-x-1/2 lg:-translate-y-1/2 lg:rotate-90",
            "lg:bottom-3 lg:left-1/2 lg:-translate-x-1/2 lg:translate-y-1/2 lg:rotate-180",
            "lg:left-3 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:-rotate-90"].map((pos) => (
            <ChevronRight key={pos} size={16} aria-hidden
              className={`absolute hidden text-accent lg:block ${pos}`} />
          ))}
          <ul className="grid w-full grid-cols-2 gap-3 lg:contents">
            {t.centre.traits.map((trait, i) => {
              const Icon = TRAIT_ICON[i];
              return (
                <li key={trait} className={`flex flex-col items-center gap-1 text-center lg:w-[6.5rem] ${TRAIT_POS[i]}`}>
                  <Icon size={17} className="text-primary" aria-hidden />
                  <span className="text-xs font-medium leading-tight text-muted-foreground">{trait}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex aspect-square w-44 flex-col items-center justify-center gap-1.5 rounded-full bg-primary p-6 text-center shadow-card lg:w-[58%]">
            <SolanaMark className="h-6 w-6" />
            <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground">{t.centre.name}</p>
            <p className="text-[11px] leading-tight text-primary-foreground/75">{t.centre.role}</p>
          </div>
        </div>

        {/* The two pools the capital engine chooses between. */}
        <div className="order-6 flex flex-col gap-3 rounded-2xl p-5 glass glow-border lg:order-none lg:col-start-2 lg:row-start-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.pools.title}</p>
          {[t.pools.domestic, t.pools.global].map((pool, i) => {
            const Icon = i === 0 ? Landmark : Globe;
            return (
              <div key={pool.name} className="flex items-start gap-3">
                <Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  <span className="block font-semibold text-foreground">{pool.name}</span>
                  {pool.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl p-6 gradient-glow">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent">{t.results.title}</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.results.items.map((item, i) => {
            const Icon = RESULT_ICON[i];
            return (
              <li key={item} className="flex items-start gap-3">
                {Icon
                  ? <Icon size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  : <SolanaMark className="mt-0.5 h-[18px] w-[18px] shrink-0" />}
                <span className="text-sm font-medium text-foreground">{item}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-sm text-muted-foreground">{t.results.note}</p>
      </div>

      <figcaption className="sr-only">{t.caption}</figcaption>
    </figure>
  );
};

export default EconomicLoop;
