import { ArrowDown, Banknote, Globe, Store } from "lucide-react";
import logoMark from "@/assets/logo-mark.png";

/** Official Solana mark — three slanted bars, teal to purple. */
const SolanaMark = () => (
  <svg viewBox="0 0 398 312" className="h-7 w-7" aria-hidden focusable="false">
    <defs>
      <linearGradient id="cs-solana" x1="360" y1="-37" x2="141" y2="383"
        gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    <g fill="url(#cs-solana)">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.6z" />
    </g>
  </svg>
);

/** Fading dot field — the texture behind the pool and business cards. */
const DotField = ({ id, className }: { id: string; className?: string }) => (
  <svg className={className} aria-hidden focusable="false">
    <defs>
      <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
      </pattern>
      <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="white" stopOpacity="0" />
        <stop offset="1" stopColor="white" stopOpacity="1" />
      </linearGradient>
      <mask id={`${id}-mask`}>
        <rect width="100%" height="100%" fill={`url(#${id}-fade)`} />
      </mask>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} mask={`url(#${id}-mask)`} />
  </svg>
);

/** Node network — the texture behind the EmpowerFI card. */
const NodeWeb = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 240 120" className={className} aria-hidden focusable="false">
    <g stroke="currentColor" strokeWidth="0.6" opacity="0.5">
      <path d="M18 84 L62 44 L104 72 L150 30 L196 60 L228 26" fill="none" />
      <path d="M62 44 L70 96 L150 30" fill="none" />
      <path d="M104 72 L196 60 L172 104 L70 96" fill="none" />
    </g>
    {[
      [18, 84], [62, 44], [104, 72], [150, 30], [196, 60], [228, 26], [70, 96], [172, 104],
    ].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="currentColor" />
    ))}
  </svg>
);

const Connector = () => (
  <div className="flex justify-center py-1.5" aria-hidden>
    <ArrowDown className="text-accent" size={22} strokeWidth={2.5} />
  </div>
);

/** The two P2P pools. Either one can fund a loan; the engine picks, per opportunity. */
const pools = [
  { id: "cs-domestic", icon: Banknote, title: "Domestic pool", sub: "Brazilian investors, in reais" },
  { id: "cs-global", icon: Globe, title: "Global pool", sub: "International and impact investors, in USDC" },
];

/**
 * The model as a stack: two pools of P2P capital, the engine and desk that turn
 * them into a loan, and the business that receives and repays it by Pix. Solana
 * sits apart, under the chain, because it is the proof of every step — not a
 * rail every loan travels (only the global pool moves on it).
 *
 * Built in markup rather than shipped as an image so it stays readable on a
 * phone, selectable, and legible to a screen reader — a diagram with baked-in
 * text is none of those things.
 */
const CapitalStack = () => (
  <ol className="space-y-1">
    {/* 1 — The two pools */}
    <li className="grid grid-cols-2 gap-2">
      {pools.map(({ id, icon: Icon, title, sub }) => (
        <div
          key={id}
          className="relative flex flex-col gap-3 overflow-hidden rounded-2xl gradient-primary px-4 py-4 shadow-glow sm:px-5 sm:py-5"
        >
          <DotField
            id={id}
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 text-primary-foreground/25 sm:block"
          />
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm sm:h-12 sm:w-12">
            <Icon className="text-accent" size={22} />
          </span>
          <span className="relative">
            <span className="block font-heading text-base font-bold leading-tight text-primary-foreground sm:text-lg">
              {title}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-primary-foreground/85 sm:text-sm">
              {sub}
            </span>
          </span>
        </div>
      ))}
    </li>

    <Connector />

    {/* 2 — EmpowerFI: the anchor of the chain, so it carries the brand navy. */}
    <li className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-primary px-5 py-5 shadow-card sm:gap-5 sm:px-6 sm:py-6">
      <NodeWeb
        className="pointer-events-none absolute -right-4 bottom-0 top-0 hidden h-full w-1/2 text-accent/45 sm:block"
      />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-accent/40 sm:h-14 sm:w-14">
        <img src={logoMark} alt="" width={56} height={56} className="h-full w-full object-cover" />
      </span>
      <span className="relative">
        <span className="block font-heading text-lg font-bold leading-tight text-primary-foreground">
          EmpowerFI
        </span>
        <span className="block text-sm font-medium text-accent">
          Capital Allocation Engine · P2P desk
        </span>
      </span>
    </li>

    <Connector />

    {/* 3 — Her business */}
    <li className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card px-5 py-5 shadow-card sm:gap-5 sm:px-6 sm:py-6">
      <DotField
        id="cs-store"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 text-accent/20 sm:block"
      />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border sm:h-14 sm:w-14">
        <Store className="text-accent" size={24} />
      </span>
      <span className="relative">
        <span className="block font-heading text-lg font-bold leading-tight text-foreground">
          Her business
        </span>
        <span className="block text-sm text-muted-foreground">
          Receives and repays in reais, by Pix
        </span>
      </span>
    </li>

    {/* 4 — Solana, under the whole chain rather than in it. */}
    <li className="relative !mt-4 flex items-center gap-4 overflow-hidden rounded-2xl border border-dashed border-accent/50 bg-card/60 px-5 py-4 sm:gap-5 sm:px-6">
      <DotField
        id="cs-solana-bg"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 text-foreground/[0.07] sm:block"
      />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border sm:h-14 sm:w-14">
        <SolanaMark />
      </span>
      <span className="relative">
        <span className="block font-heading text-lg font-bold leading-tight text-foreground">
          Solana
        </span>
        <span className="block text-sm text-muted-foreground">
          Proof of every step · no personal data on chain
        </span>
      </span>
    </li>
  </ol>
);

export default CapitalStack;
