import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import OnChainCheck from "../../components/product/OnChainCheck";
import ZcashTx from "../../components/product/ZcashTx";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { formatNumber, tr } from "../../i18n";
import { usdc } from "../../lib/solana";
import { POOL_LABEL, RETURN_LABEL, shieldedExplorerNote, STATUS_LABEL, usdPerZec, zec } from "../../lib/zcash";
import { useZcashAudit, useZcashReturnsAudit, type ZcashBatchQueue } from "./queries";

/**
 * A transaction id invented here, used by the control under the notes table. It
 * is hex so the server will accept the question, and a question the chain has
 * no answer to, so a reader can watch the same button return "not on chain" and
 * know the confirmations above are not a rubber stamp.
 */
const INVENTED_TXID = "deadbeef".repeat(8);

const ago = (iso: string | null) => {
  if (!iso) return tr({ en: "never", pt: "nunca" });
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return tr({ en: `${Math.round(s)} s ago`, pt: `há ${Math.round(s)} s` });
  if (s < 5400) return tr({ en: `${Math.round(s / 60)} min ago`, pt: `há ${Math.round(s / 60)} min` });
  return tr({ en: `${Math.round(s / 3600)} h ago`, pt: `há ${Math.round(s / 3600)} h` });
};

/** label: what is copied, already in the current language. */
function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" size="sm" aria-label={tr({ en: `Copy ${label}`, pt: `Copiar ${label}` })} onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // clipboard refused: the value is on screen to select
      }
    }}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? tr({ en: "Copied", pt: "Copiado" }) : tr({ en: "Copy", pt: "Copiar" })}
    </Button>
  );
}

/**
 * EmpowerFI's shielded treasury as its viewing key reads it. The key is
 * disclosed to auditors: with it, anyone they trust can check these payments
 * in their own Zcash wallet, and still spend nothing.
 */
export default function Zcash() {
  const q = useZcashAudit();
  const [reveal, setReveal] = useState(false);
  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  if (!d.configured) {
    return (
      <Panel title={tr({ en: "No treasury yet", pt: "Ainda sem tesouraria" })}>
        <p className="text-sm text-muted-foreground">
          {tr({ en: "EmpowerFI's Zcash treasury is not set up in this environment.", pt: "A tesouraria Zcash da EmpowerFI não está configurada neste ambiente." })}
        </p>
      </Panel>
    );
  }
  const behind = d.tip_height !== null && d.scanned_height !== null ? d.tip_height - d.scanned_height : null;
  const matched = d.receipts.filter((r) => r.ref).length;
  const credited = d.requests?.credited ?? 0;
  const net = d.network === "test" ? "Zcash testnet" : "Zcash mainnet";
  // One row per note, but a transaction can pay several allocations at once:
  // that is what a batch looks like from the treasury's side, and showing its
  // notes as unrelated rows hid the single most interesting fact on the screen.
  // `span` carries the group size onto the first note of each transaction.
  const grouped = d.receipts.map((r, i, all) => ({
    r,
    first: i === 0 || all[i - 1].txid !== r.txid,
    span: all.filter((o) => o.txid === r.txid).length,
  }));
  const devtool = `zcash-devtool wallet -w ./audit-view init-fvk --name audit --fvk "$UFVK" --birthday ${d.birthday_height} -s zecrocks
zcash-devtool wallet -w ./audit-view sync -s zecrocks
zcash-devtool wallet -w ./audit-view enhance -s zecrocks
zcash-devtool wallet -w ./audit-view list-tx`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={tr({ en: "Received", pt: "Recebido" })} value={zec(d.received_zat, d.network)}
          hint={tr({
            en: `${d.receipts.length} note${d.receipts.length === 1 ? "" : "s"} read`,
            pt: `${d.receipts.length} nota${d.receipts.length === 1 ? " lida" : "s lidas"}`,
          })} />
        <StatTile label={tr({ en: "Matched to a request", pt: "Ligadas a um pedido" })} value={matched}
          hint={tr({ en: `${d.receipts.length - matched} with no EmpowerFI memo`, pt: `${d.receipts.length - matched} sem memo da EmpowerFI` })} />
        <StatTile label={tr({ en: "Allocated", pt: "Alocados" })} value={credited}
          hint={tr({ en: "credited to the vault, proven on Solana", pt: "creditados no cofre, com prova na Solana" })} hintTone={credited ? "positive" : "info"} />
        <StatTile label={tr({ en: "Watcher", pt: "Monitor" })}
          value={behind === null ? "—" : behind <= 1 ? tr({ en: "Up to date", pt: "Em dia" }) : tr({ en: `${behind} blocks behind`, pt: `${behind} blocos atrás` })}
          hint={tr({
            en: `block ${d.scanned_height !== null ? formatNumber(d.scanned_height) : "—"} · ${ago(d.scanned_at)}`,
            pt: `bloco ${d.scanned_height !== null ? formatNumber(d.scanned_height) : "—"} · ${ago(d.scanned_at)}`,
          })} hintTone={behind !== null && behind <= 2 ? "positive" : "caution"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "The viewing key", pt: "A chave de visualização" })}
          description={tr({
            en: `Disclosed to auditors, and to no one else. It reads every payment the treasury receives on ${net}, amounts and memos included, and can spend none of it.`,
            pt: `Revelada aos auditores, e a mais ninguém. Ela lê cada pagamento que a tesouraria recebe na ${net}, com valores e memos, e não pode gastar nada.`,
          })}>
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <code className={`min-w-0 flex-1 break-all font-mono text-xs ${reveal ? "text-foreground" : "select-none text-muted-foreground"}`}>
                {reveal ? d.ufvk : `${d.ufvk.slice(0, 14)}${"•".repeat(40)}`}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReveal((v) => !v)}>
                {reveal ? <EyeOff size={14} /> : <Eye size={14} />} {reveal ? tr({ en: "Hide", pt: "Ocultar" }) : tr({ en: "Reveal", pt: "Mostrar" })}
              </Button>
              <Copyable value={d.ufvk} label={tr({ en: "viewing key", pt: "chave de visualização" })} />
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{tr({ en: "Treasury address", pt: "Endereço da tesouraria" })}</dt>
                <dd className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs text-foreground">{d.address.slice(0, 12)}…{d.address.slice(-6)}</span><Copyable value={d.address} label={tr({ en: "address", pt: "endereço" })} /></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{tr({ en: "Read from block", pt: "Lida a partir do bloco" })}</dt>
                <dd className="num text-foreground">{formatNumber(d.birthday_height)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{tr({ en: "Credited after", pt: "Creditado após" })}</dt>
                <dd className="text-foreground">{tr({ en: `${d.confirmations_needed} confirmations`, pt: `${d.confirmations_needed} confirmações` })}</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel title={tr({ en: "Check it without us", pt: "Confira sem depender de nós" })}
          description={tr({
            en: "Import the key into any Zcash wallet that takes a viewing key and it lists the same payments. With zcash-devtool:",
            pt: "Importe a chave em qualquer carteira Zcash que aceite chave de visualização, e ela lista os mesmos pagamentos. Com o zcash-devtool:",
          })}>
          <div className="relative overflow-x-auto rounded-xl border border-border bg-secondary/40">
            <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">{devtool}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr({
              en: "Each memo names a random reference (EFI-…), never the investor or the opportunity: the reference ties the payment to its allocation here, and the allocation's proof is on Solana. A block explorer shows only that a shielded transaction happened.",
              pt: "Cada memo traz uma referência aleatória (EFI-…), nunca o investidor ou a oportunidade: a referência liga o pagamento à sua alocação aqui, e a prova da alocação está na Solana. Um explorador de blocos mostra só que uma transação blindada aconteceu.",
            })}
          </p>
        </Panel>
      </div>

      <Batches queue={d.batches} />

      <Panel title={tr({ en: "Notes received", pt: "Notas recebidas" })}
        description={tr({
          en: "Every shielded note the viewing key decrypts, newest first, with what it paid for.",
          pt: "Cada nota blindada que a chave de visualização decifra, das mais recentes às mais antigas, com o que ela pagou.",
        })}>
        <p className="mb-4 border-l-2 border-info/60 pl-3 text-xs leading-relaxed text-muted-foreground">
          {shieldedExplorerNote()}
        </p>
        <div className="relative -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">{tr({ en: "Block", pt: "Bloco" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Transaction", pt: "Transação" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Pool", pt: "Pool" })}</th>
                <th className="py-2 pr-4 text-right font-medium">{tr({ en: "Amount", pt: "Valor" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Memo", pt: "Memo" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Request", pt: "Pedido" })}</th>
                <th className="py-2 pr-4 font-medium">{tr({ en: "Shared USDC credit", pt: "Crédito compartilhado em USDC" })}</th>
                <th className="py-2 font-medium">{tr({ en: "Allocation proof", pt: "Prova da alocação" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grouped.map(({ r, first, span }) => (
                <tr key={`${r.txid}:${r.pool}:${r.index}`} className={first ? "" : "border-t-0"}>
                  <td className="num py-2.5 pr-4 text-muted-foreground">{first ? formatNumber(r.height) : ""}</td>
                  {first && (
                    <td className="py-2.5 pr-4 align-top" rowSpan={span}>
                      <span className="flex flex-col items-start gap-1.5">
                        <ZcashTx txid={r.txid} network={d.network} />
                        <OnChainCheck txid={r.txid} claimedHeight={r.height} />
                        {span > 1 && (
                          <span className="text-[11px] text-info">
                            {tr({
                              en: `One transaction, ${span} allocations.`,
                              pt: `Uma transação, ${span} alocações.`,
                            })}
                          </span>
                        )}
                      </span>
                    </td>
                  )}
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{POOL_LABEL[r.pool]}</td>
                  <td className="num py-2.5 pr-4 text-right text-foreground">{zec(r.value_zat, d.network)}</td>
                  <td className="max-w-[16rem] truncate py-2.5 pr-4 font-mono text-xs text-muted-foreground" title={r.memo ?? undefined}>{r.memo ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    {r.ref ? (
                      <span className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-foreground">{r.ref} · {r.opportunity_code}</span>
                        {r.status && <span><StatusPill tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</StatusPill> <span className="num text-xs text-muted-foreground">{usdc(r.amount_micro_usdc)}</span></span>}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">{tr({ en: "none", pt: "nenhum" })}</span>}
                  </td>
                  <td className="py-2.5 pr-4">{r.credit_signature ? <ExplorerLink tx={r.credit_signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="py-2.5">{r.allocation_signature ? <ExplorerLink tx={r.allocation_signature} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
              {d.receipts.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{tr({ en: "Nothing received yet.", pt: "Nada recebido ainda." })}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tr({
              en: "“Confirm on chain” sends the transaction id, and nothing else, to a public Zcash server EmpowerFI does not run. No viewing key is involved: the height and the size come back from a third party, and you can watch them agree with the height this table reports. The amount under “shared USDC credit” is deliberately not the amount of any single payment — several ZEC payments are credited to the vault in one transfer, in whole units, with the remainder carried to the next batch. Attributing that remainder to one investor would rebuild the link the batch exists to break.",
              pt: "“Confirmar na rede” envia o id da transação, e nada mais, para um servidor Zcash público que a EmpowerFI não opera. Nenhuma chave de visualização entra nisso: a altura e o tamanho voltam de um terceiro, e dá para ver que concordam com a altura que esta tabela informa. O valor em “crédito compartilhado em USDC” não é o valor de nenhum pagamento isolado, de propósito — vários pagamentos em ZEC são creditados ao cofre numa única transferência, em unidades inteiras, com o resto levado para o lote seguinte. Atribuir esse resto a uma investidora reconstruiria justamente o vínculo que o lote existe para quebrar.",
            })}
          </p>
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-foreground">
              {tr({
                en: "Check that the server can say no",
                pt: "Confira que o servidor sabe dizer não",
              })}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {tr({
                en: "A check that always passes is not a check. This asks the same server about a transaction id that was made up here and never existed. It should come back “not on chain”.",
                pt: "Uma verificação que sempre passa não verifica nada. Isto pergunta ao mesmo servidor sobre um id de transação inventado aqui, que nunca existiu. A resposta deve ser “não está na rede”.",
              })}
            </p>
            <OnChainCheck txid={INVENTED_TXID} claimedHeight={null} />
          </div>
        </div>
      </Panel>

      <ReturnsPaid network={d.network} />
    </div>
  );
}

/** What the treasury paid back in ZEC: instalment shares and refunds, by transaction. */
/**
 * The float, in the open. A batch credits the vault in whole units and carries
 * the remainder, so between batches the vault holds less than the book — by less
 * than one unit, and belonging to no single investor, because attributing it
 * would rebuild the link the batch exists to break. Showing it is the price of
 * the claim: a privacy mechanism that hides its own float is bookkeeping with
 * the lights off.
 *
 * `investors` is printed beside `members` because they are not the same number.
 * Positions blend the amounts; only people blend the totals, and a batch of one
 * is labelled as hiding nothing rather than left to look like a crowd.
 */
function Batches({ queue }: { queue: ZcashBatchQueue }) {
  const short = queue.booked_micro_usdc - queue.credited_micro_usdc;
  return (
    <Panel title={tr({ en: "Carried into the vault, in batches", pt: "Levado ao cofre, em lotes" })}
      description={tr({
        en: "One transfer per batch, rounded down to whole units, so the amount on Solana is the sum of nobody. What the rounding leaves over waits for the next batch, which is why the vault holds less than the book here.",
        pt: "Uma transferência por lote, arredondada para baixo em unidades inteiras, então o valor na Solana não é a soma de ninguém. O que o arredondamento deixa de fora espera o próximo lote, e é por isso que o cofre tem menos que o livro aqui.",
      })}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={tr({ en: "The book says", pt: "O livro diz" })} value={usdc(queue.booked_micro_usdc)}
          hint={tr({ en: "every position whose ZEC arrived", pt: "cada posição cujo ZEC chegou" })} />
        <StatTile label={tr({ en: "The vault was sent", pt: "O cofre recebeu" })} value={usdc(queue.credited_micro_usdc)}
          hint={tr({ en: "in whole units only", pt: "só em unidades inteiras" })} />
        <StatTile label={tr({ en: "Waiting for the next batch", pt: "Esperando o próximo lote" })} value={usdc(queue.queued_micro_usdc)}
          hint={tr({ en: "the rounding's remainder, nobody's in particular", pt: "a sobra do arredondamento, de ninguém em particular" })} />
        <StatTile label={tr({ en: "Paid, not yet batched", pt: "Pago, ainda sem lote" })} value={usdc(queue.awaiting_micro_usdc)}
          hint={tr({ en: "confirmed on Zcash, waiting its turn", pt: "confirmado na Zcash, esperando a vez" })} />
      </div>
      {short > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {tr({
            en: `The vault is ${usdc(short)} short of the book. That is the rounding waiting to be carried, not a position that was missed: it belongs to the pool rather than to anyone, and the next batch credits it.`,
            pt: `O cofre está ${usdc(short)} abaixo do livro. Essa é a sobra do arredondamento esperando ser levada, não uma posição esquecida: ela é da pool e não de alguém, e o próximo lote a credita.`,
          })}
        </p>
      )}
      {queue.batches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {tr({ en: "No batch yet.", pt: "Nenhum lote ainda." })}
        </p>
      ) : (
        <div className="relative mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">{tr({ en: "Moved on Solana", pt: "Movido na Solana" })}</th>
                <th className="pb-2 font-medium">{tr({ en: "Carried in", pt: "Veio da fila" })}</th>
                <th className="pb-2 font-medium">{tr({ en: "Carried on", pt: "Foi para a fila" })}</th>
                <th className="pb-2 font-medium">{tr({ en: "Positions", pt: "Posições" })}</th>
                <th className="pb-2 font-medium">{tr({ en: "Investors", pt: "Investidoras" })}</th>
                <th className="pb-2 font-medium">{tr({ en: "Transfer", pt: "Transferência" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {queue.batches.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-2 num">{usdc(b.credited_micro_usdc)}</td>
                  <td className="py-2 num text-muted-foreground">{usdc(b.carried_in_micro_usdc)}</td>
                  <td className="py-2 num text-muted-foreground">{usdc(b.carried_out_micro_usdc)}</td>
                  <td className="py-2 num">{formatNumber(b.members)}</td>
                  <td className="py-2">
                    <span className="num">{formatNumber(b.investors)}</span>
                    {b.investors <= 1 && (
                      <span className="block text-[11px] text-muted-foreground">
                        {tr({ en: "one investor: hides no total", pt: "uma investidora: não esconde total" })}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {b.signature
                      ? <ExplorerLink tx={b.signature} />
                      : <span className="text-xs text-muted-foreground">
                          {b.status === "credited"
                            ? tr({ en: "nothing whole to move", pt: "nada inteiro para mover" })
                            : (STATUS_OF_BATCH[b.status] ?? b.status)}
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** A batch that has not landed says which way it is waiting. */
const STATUS_OF_BATCH: Record<string, string> = {
  open: tr({ en: "forming", pt: "formando" }),
  sending: tr({ en: "sent, not yet confirmed", pt: "enviada, sem confirmação" }),
  failed: tr({ en: "failed; its payments went back to the queue", pt: "falhou; os pagamentos voltaram para a fila" }),
};

function ReturnsPaid({ network }: { network: "test" | "main" }) {
  const returns = useZcashReturnsAudit();
  if (returns.isError) return <LoadError compact error={returns.error} onRetry={() => returns.refetch()} />;
  const r = returns.data;
  return (
    <Panel title={tr({ en: "Paid back in ZEC", pt: "Devolvido em ZEC" })}
      description={tr({
        en: "Instalment shares and refunds owed to investors who paid in ZEC and have no Solana wallet, sent from the treasury by the operator, who alone holds its spending key. Listed by reference and transaction, never by the investor's address.",
        pt: "Partes de parcelas e reembolsos devidos a investidores que pagaram em ZEC e não têm carteira Solana, enviados da tesouraria pelo operador, o único com a chave de gasto. Listados por referência e transação, nunca pelo endereço do investidor.",
      })}>
      {!r ? <Skeleton className="h-20 w-full" /> : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["due", "sending", "sent", "failed"] as const).map((k) => (
              <StatusPill key={k} tone={RETURN_LABEL[k].tone}>{RETURN_LABEL[k].label} · {r.counts[k] ?? 0}</StatusPill>
            ))}
            <span className="self-center text-muted-foreground">{tr({ en: `${zec(r.sent_zat, network)} sent in all`, pt: `${zec(r.sent_zat, network)} enviados no total` })}</span>
          </div>
          {r.rows.length === 0 ? <p className="text-sm text-muted-foreground">{tr({ en: "Nothing owed or paid back yet.", pt: "Nada devido nem devolvido ainda." })}</p> : (
            <ul className="divide-y divide-border">
              {r.rows.map((x, i) => (
                <li key={x.txid ?? `${x.ref}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-foreground">{x.kind === "refund" ? tr({ en: "Refund", pt: "Reembolso" }) : tr({ en: "Instalment share", pt: "Parte da parcela" })}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{x.ref ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {usdc(x.amount_micro_usdc)}{x.amount_zat
                        ? tr({
                          en: ` → ${zec(x.amount_zat, network)} at ${usdPerZec(x.usd_per_zec_cents!)}`,
                          pt: ` → ${zec(x.amount_zat, network)} a ${usdPerZec(x.usd_per_zec_cents!)}`,
                        })
                        : ""}
                      {x.error && x.status !== "sent" ? ` · ${x.error}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {x.txid && (
                      <ZcashTx txid={x.txid} network={network} />
                    )}
                    <StatusPill tone={RETURN_LABEL[x.status].tone}>{RETURN_LABEL[x.status].label}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
