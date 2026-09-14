import { BadgeCheck, Lock, Sparkles } from "lucide-react";

export type DataKind = "private" | "derived" | "proven";

const DATA_KIND: Record<DataKind, { label: string; hint: string; className: string; Icon: typeof Lock }> = {
  private: { label: "Private", hint: "Stays in EmpowerFI's vault; never shown to this role or put on chain", className: "text-alert", Icon: Lock },
  derived: { label: "Derived", hint: "Computed by EmpowerFI's engines from private data", className: "text-caution", Icon: Sparkles },
  proven: { label: "Proven on Solana", hint: "Its commitment is on chain and can be verified", className: "text-positive", Icon: BadgeCheck },
};

/** The mark for one kind of data, used inline next to a field. */
export function DataTag({ kind, withLabel = false }: { kind: DataKind; withLabel?: boolean }) {
  const { label, hint, className, Icon } = DATA_KIND[kind];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={hint}>
      <Icon size={13} aria-hidden />
      {withLabel ? <span className="text-xs">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

/** The three kinds of data, explained once so every screen can use the marks. */
export default function DataLegend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={compact ? "space-y-1.5" : "flex flex-wrap gap-x-5 gap-y-2"} aria-label="How data is marked">
      {(Object.keys(DATA_KIND) as DataKind[]).map((k) => (
        <li key={k} className="flex items-center gap-2 text-xs text-muted-foreground" title={DATA_KIND[k].hint}>
          <DataTag kind={k} /> {DATA_KIND[k].label}
        </li>
      ))}
    </ul>
  );
}
