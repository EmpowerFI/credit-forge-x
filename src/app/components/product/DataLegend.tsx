import { BadgeCheck, Lock, Sparkles } from "lucide-react";
import { localized, tr } from "../../i18n";

export type DataKind = "private" | "derived" | "proven";

const DATA_KIND: Record<DataKind, { className: string; Icon: typeof Lock }> = {
  private: { className: "text-alert", Icon: Lock },
  derived: { className: "text-caution", Icon: Sparkles },
  proven: { className: "text-positive", Icon: BadgeCheck },
};

const DATA_TEXT: Record<DataKind, { label: string; hint: string }> = localized({
  private: {
    label: { en: "Private", pt: "Privado" },
    hint: { en: "Stays in EmpowerFI's vault; never shown to this role or put on chain", pt: "Fica no cofre da EmpowerFI; nunca é mostrado a este perfil nem vai para a blockchain" },
  },
  derived: {
    label: { en: "Derived", pt: "Derivado" },
    hint: { en: "Computed by EmpowerFI's engines from private data", pt: "Calculado pelos motores da EmpowerFI a partir de dados privados" },
  },
  proven: {
    label: { en: "Proven on Solana", pt: "Comprovado na Solana" },
    hint: { en: "Its commitment is on chain and can be verified", pt: "O compromisso criptográfico está na blockchain e pode ser verificado" },
  },
});

/** The mark for one kind of data, used inline next to a field. */
export function DataTag({ kind, withLabel = false }: { kind: DataKind; withLabel?: boolean }) {
  const { className, Icon } = DATA_KIND[kind];
  const { label, hint } = DATA_TEXT[kind];
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
    <ul className={compact ? "space-y-1.5" : "flex flex-wrap gap-x-5 gap-y-2"} aria-label={tr({ en: "How data is marked", pt: "Como os dados são marcados" })}>
      {(Object.keys(DATA_KIND) as DataKind[]).map((k) => (
        <li key={k} className="flex items-center gap-2 text-xs text-muted-foreground" title={DATA_TEXT[k].hint}>
          <DataTag kind={k} /> {DATA_TEXT[k].label}
        </li>
      ))}
    </ul>
  );
}
