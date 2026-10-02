import { useState } from "react";
import { AlertTriangle, Check, Loader2, Radio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, tr } from "../../i18n";
import { confirmOnChain, type ZcashOnChain } from "../../lib/zcash";

/**
 * Asks a public Zcash server, live, whether a transaction is on chain.
 *
 * The audit table beside this button is decrypted with the treasury's viewing
 * key, which makes it the only account of a shielded payment that exists — and
 * an account served out of EmpowerFI's own database, which proves nothing about
 * a chain. No explorer can stand in: a shielded transaction carries no address,
 * value or memo in the clear, and the Ironwood pool is not indexed on testnet.
 *
 * So the button sends the transaction id, and only the id, to a lightwalletd
 * EmpowerFI does not run. What comes back is the height and the size, from
 * someone else. Set against the height this table already claims, the reader
 * watches two independent sources agree — or sees that they do not, which is
 * the more important case and why the mismatch is drawn as a warning rather
 * than hidden.
 *
 * `found: false` is rendered as an answer, not as a broken feature. A server
 * that says no when it has nothing is the only reason its yes means anything,
 * which is also what the control beneath the table demonstrates on purpose.
 *
 * It is drawn as a caution rather than a failure, and it says why. The gRPC
 * status that would separate "never mined" from "the server is having trouble"
 * travels in an HTTP/2 trailer, which the runtime does not expose, so the
 * function reads an empty body as not-found. Calling that a flat "not on chain"
 * would repeat the mistake the explorer link made: presenting one reading of an
 * ambiguous answer as the only one.
 */
export default function OnChainCheck({ txid, claimedHeight }: { txid: string; claimedHeight: number | null }) {
  const [state, setState] = useState<"idle" | "asking">("idle");
  const [result, setResult] = useState<ZcashOnChain | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const ask = async () => {
    setState("asking");
    setFailed(null);
    setResult(null);
    try {
      setResult(await confirmOnChain(txid));
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setState("idle");
    }
  };

  if (!result && !failed) {
    return (
      <Button variant="secondary" size="sm" onClick={ask} disabled={state === "asking"}
        aria-label={tr({ en: `Ask a public Zcash server about ${txid}`, pt: `Perguntar a um servidor Zcash público sobre ${txid}` })}>
        {state === "asking"
          ? <><Loader2 size={13} className="animate-spin" aria-hidden /> {tr({ en: "Asking…", pt: "Perguntando…" })}</>
          : <><Radio size={13} aria-hidden /> {tr({ en: "Confirm on chain", pt: "Confirmar na rede" })}</>}
      </Button>
    );
  }

  if (failed) {
    return (
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-caution">
          <AlertTriangle size={12} aria-hidden /> {tr({ en: "Could not ask", pt: "Não deu para perguntar" })}
        </span>
        <span className="text-[11px] text-muted-foreground">{failed}</span>
        <button type="button" onClick={ask} className="self-start text-[11px] underline">
          {tr({ en: "Try again", pt: "Tentar de novo" })}
        </button>
      </span>
    );
  }

  const r = result!;
  const server = r.server.replace(/^https?:\/\//, "");
  const agrees = r.found && claimedHeight !== null && r.height === claimedHeight;
  const disagrees = r.found && claimedHeight !== null && r.height !== claimedHeight;

  return (
    <span className="flex flex-col gap-1">
      {!r.reachable ? (
        <span className="flex items-center gap-1.5 text-xs text-caution">
          <AlertTriangle size={12} aria-hidden />
          {tr({ en: "The server did not answer", pt: "O servidor não respondeu" })}
        </span>
      ) : r.found ? (
        <>
          <span className={`flex items-center gap-1.5 text-xs ${disagrees ? "text-caution" : "text-positive"}`}>
            {disagrees ? <AlertTriangle size={12} aria-hidden /> : <Check size={12} aria-hidden />}
            {tr({ en: "On chain", pt: "Está na rede" })}
            {r.height !== null && ` · ${tr({ en: "block", pt: "bloco" })} ${formatNumber(r.height)}`}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {server}
            {r.bytes ? ` · ${formatNumber(r.bytes)} ${tr({ en: "bytes", pt: "bytes" })}` : ""}
            {r.version ? ` · ${tr({ en: "version", pt: "versão" })} ${r.version}` : ""}
          </span>
          {agrees && (
            <span className="text-[11px] text-positive">
              {tr({ en: "Same height as this table reports.", pt: "Mesma altura que esta tabela informa." })}
            </span>
          )}
          {disagrees && (
            <span className="text-[11px] text-caution">
              {tr({
                en: `This table says block ${formatNumber(claimedHeight!)}. The two do not agree; trust the server.`,
                pt: `Esta tabela diz bloco ${formatNumber(claimedHeight!)}. As duas não concordam; confie no servidor.`,
              })}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-xs text-caution">
            <X size={12} aria-hidden />
            {tr({ en: "No record on this server", pt: "Sem registro neste servidor" })}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {server}
            {r.grpc_status != null ? ` · grpc ${r.grpc_status}` : ""}
          </span>
          {r.grpc_message && <span className="text-[11px] text-muted-foreground">{r.grpc_message}</span>}
          <span className="text-[11px] text-muted-foreground">
            {tr({
              en: "This is what a transaction that was never mined looks like, and it is also what a server having trouble looks like. The gRPC status that would tell them apart arrives in an HTTP/2 trailer, which the runtime does not expose. Ask again before concluding anything.",
              pt: "É assim que aparece uma transação que nunca foi minerada, e é assim também que aparece um servidor com problema. O status gRPC que separaria os dois chega num trailer de HTTP/2, que o runtime não expõe. Pergunte de novo antes de concluir qualquer coisa.",
            })}
          </span>
        </>
      )}
      <span className="text-[11px] text-muted-foreground">
        {tr({ en: "Asked", pt: "Perguntado" })} {new Date(r.asked_at).toLocaleTimeString()}
        {" · "}
        <button type="button" onClick={ask} className="underline">{tr({ en: "ask again", pt: "perguntar de novo" })}</button>
      </span>
    </span>
  );
}
