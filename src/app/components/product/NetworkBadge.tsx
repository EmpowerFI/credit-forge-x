import { tr } from "../../i18n";

/** Which Solana cluster this workspace reads and writes. Devnet: tokens have no value. */
export default function NetworkBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
      title={tr({ en: "Solana Devnet — test network; tokens have no real value", pt: "Solana Devnet — rede de teste; os tokens não têm valor real" })}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
      </span>
      Devnet
    </span>
  );
}
