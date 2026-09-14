import { ExternalLink } from "lucide-react";
import { explorerAddress, explorerTx } from "../../lib/platform";

const short = (v: string) => (v.length > 12 ? `${v.slice(0, 4)}…${v.slice(-4)}` : v);

/** A transaction or account on Solana Explorer, shortened, in monospace. */
export default function ExplorerLink({ tx, address, label }: { tx?: string; address?: string; label?: string }) {
  const value = tx ?? address;
  if (!value) return null;
  return (
    <a href={tx ? explorerTx(tx) : explorerAddress(address!)} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-info hover:underline">
      {label ?? short(value)} <ExternalLink size={11} aria-hidden />
    </a>
  );
}
