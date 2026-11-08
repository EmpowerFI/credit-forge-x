import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { tr } from "../i18n";
import { explorerAddress, explorerTx } from "../lib/platform";

// The Missions page's small parts: a section's heading, a metric with its
// explanation, a key you can copy and open on Explorer, the devnet notice.

export function SectionHeading({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 id={id} className="font-heading text-3xl leading-tight sm:text-4xl">{title}</h2>
      {lead && <p className="text-muted-foreground">{lead}</p>}
    </div>
  );
}

/**
 * An explanation behind a small "i": a popover, so it opens with a tap, a
 * click or the keyboard, and not only on hover.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        className="-m-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={tr({ en: `What is "${label}"?`, pt: `O que é "${label}"?` })}
      >
        <Info size={14} aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="text-sm leading-relaxed" side="top">{children}</PopoverContent>
    </Popover>
  );
}

/** One figure: its name, its value, an optional note and explanation. */
export function Metric({ label, value, note, tip, emphasis }: {
  label: string; value: ReactNode; note?: ReactNode; tip?: ReactNode; emphasis?: boolean;
}) {
  return (
    <div className="bg-card p-4">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </dt>
      <dd className={cn("mt-1 font-heading tabular-nums", emphasis ? "text-2xl" : "text-xl")}>{value}</dd>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** A key on Solana: shortened, copyable, and opened on Explorer. */
export function ChainKey({ label, value, kind = "address" }: { label: string; value: string; kind?: "address" | "tx" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /* the clipboard is refused in some browsers; the key is still on Explorer */
    }
  };
  const short = value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1">
        <span className="font-mono text-xs" title={value}>{short}</span>
        <button type="button" onClick={() => void copy()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={tr({ en: `Copy ${label}`, pt: `Copiar ${label}` })}>
          {copied ? <Check size={14} className="text-positive" aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
        <a href={kind === "tx" ? explorerTx(value) : explorerAddress(value)} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-info transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={tr({ en: `${label} on Solana Explorer`, pt: `${label} no Solana Explorer` })}>
          <ExternalLink size={14} aria-hidden />
        </a>
        <span className="sr-only" aria-live="polite">{copied ? tr({ en: "Copied", pt: "Copiado" }) : ""}</span>
      </dd>
    </div>
  );
}

/** Solana devnet: the money here is test money. */
export function DevnetNotice({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2 rounded-full border border-gold/60 bg-card px-3 py-1 text-xs font-medium", className)}>
      <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
      {tr({ en: "Solana Devnet — test funds, no real value", pt: "Solana Devnet — fundos de teste, sem valor real" })}
    </p>
  );
}

/** A campaign's phase, in words and a colour that is never the only cue. */
export function PhaseBadge({ phase }: { phase: "upcoming" | "live" | "ended" }) {
  const text = {
    upcoming: tr({ en: "Starts soon", pt: "Começa em breve" }),
    live: tr({ en: "Live", pt: "Em andamento" }),
    ended: tr({ en: "Ended", pt: "Encerrada" }),
  }[phase];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      phase === "live" ? "border-positive/40 text-positive" : "border-border text-muted-foreground")}>
      {phase === "live" && <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />}
      {text}
    </span>
  );
}
