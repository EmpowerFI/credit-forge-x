import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { tr } from "../../i18n";
import { explorerCaveat, zcashExplorerTx } from "../../lib/zcash";

/**
 * A shielded transaction id, as its own evidence.
 *
 * The explorer link used to be the only thing here, and the id was its label,
 * so the obvious click led straight to "Transaction Not Found" — which reads
 * as a failed payment rather than as an explorer that cannot see shielded
 * value. The id now copies instead, because an id in the clipboard is useful
 * anywhere, and the explorer is a second, smaller link that says on hover what
 * it can and cannot do.
 */
export default function ZcashTx({ txid, network = "test" }: { txid: string; network?: "test" | "main" }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <button type="button"
        aria-label={tr({ en: `Copy the transaction id ${txid}`, pt: `Copiar o id da transação ${txid}` })}
        title={tr({ en: "Copy the transaction id", pt: "Copiar o id da transação" })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(txid);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard refused: the id is on screen to select
          }
        }}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-xs text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {txid.slice(0, 4)}…{txid.slice(-4)}
        {copied ? <Check size={11} className="text-positive" aria-hidden /> : <Copy size={11} className="text-muted-foreground" aria-hidden />}
      </button>
      <a href={zcashExplorerTx(txid, network)} target="_blank" rel="noopener noreferrer" title={explorerCaveat()}
        className="inline-flex items-center gap-0.5 rounded-md px-1 py-1 text-xs text-muted-foreground hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {tr({ en: "explorer", pt: "explorador" })} <ExternalLink size={10} aria-hidden />
      </a>
    </span>
  );
}
