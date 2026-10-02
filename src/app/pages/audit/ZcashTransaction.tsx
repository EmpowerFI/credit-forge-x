import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import Copyable from "../../components/product/Copyable";
import OnChainCheck from "../../components/product/OnChainCheck";
import Panel from "../../components/product/Panel";
import { formatNumber, tr } from "../../i18n";
import { POOL_LABEL, zec } from "../../lib/zcash";
import { useZcashAudit } from "./queries";

/**
 * How to check one shielded transaction without believing this screen.
 *
 * The notes table reports a height, a value and a memo for every payment the
 * treasury received, all of it decrypted with the treasury's viewing key and
 * served from our own database. A reader has no way to tell that apart from
 * numbers typed into a table, and no explorer can settle it: a shielded
 * transaction carries no address, value or memo in the clear, and the Ironwood
 * pool is not indexed on testnet. So the table, on its own, reads as a claim.
 *
 * This page answers it the only way that works, by handing over the two checks
 * and saying in advance what each one returns. The reader runs them and compares
 * — which is a different thing from being shown a number and asked to accept it.
 *
 *   1. Is it on chain? A public lightwalletd answers from the transaction id
 *      alone. No key, nothing of ours in the path: the command below talks to
 *      testnet.zec.rocks directly, and the button does the same call for anyone
 *      who would rather click.
 *   2. What was in it? Only the treasury's viewing key opens that, and it is
 *      published here. It reads every note and can spend nothing.
 *
 * Each check prints what it should return before it is run. A page that shows
 * only its own answer proves nothing; a page that predicts someone else's
 * answer is wrong in public when it lies.
 */
export default function ZcashTransaction() {
  const { txid = "" } = useParams();
  const q = useZcashAudit();
  const [reveal, setReveal] = useState(false);

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;

  const back = (
    <Link to="/app/audit/zcash" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft size={14} aria-hidden /> {tr({ en: "Notes received", pt: "Notas recebidas" })}
    </Link>
  );

  if (!d.configured) {
    return (
      <div className="space-y-6">
        {back}
        <Panel title={tr({ en: "No treasury yet", pt: "Ainda sem tesouraria" })}>
          <p className="text-sm text-muted-foreground">
            {tr({ en: "EmpowerFI's Zcash treasury is not set up in this environment.", pt: "A tesouraria Zcash da EmpowerFI não está configurada neste ambiente." })}
          </p>
        </Panel>
      </div>
    );
  }

  const notes = d.receipts.filter((r) => r.txid === txid).sort((a, b) => a.index - b.index);
  if (notes.length === 0) {
    return (
      <div className="space-y-6">
        {back}
        <Panel title={tr({ en: "Not a transaction this treasury received", pt: "Não é uma transação que esta tesouraria recebeu" })}>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "No note in this treasury came from that transaction id. Open a row from the notes table to check one that did.",
              pt: "Nenhuma nota desta tesouraria veio desse id de transação. Abra uma linha da tabela de notas para verificar uma que veio.",
            })}
          </p>
        </Panel>
      </div>
    );
  }

  const height = notes[0].height;
  const totalZat = notes.reduce((sum, r) => sum + r.value_zat, 0);
  const memos = notes.filter((r) => r.memo).length;
  const net = d.network === "test" ? "testnet" : "mainnet";
  const server = d.network === "test" ? "https://testnet.zec.rocks" : "https://zec.rocks";

  // lightwalletd takes the id in internal byte order, which is the displayed
  // form reversed. Asking as-displayed answers "Transaction not found", so the
  // reversal is the command working or not; shell escapes keep it copy-pasteable.
  const escaped = (txid.match(/../g) ?? []).reverse().map((b) => `\\x${b}`).join("");
  const grpcCommand =
    `printf '\\x00\\x00\\x00\\x00\\x22\\x1a\\x20${escaped}' | \\\n` +
    `  curl -s --http2 -X POST ${server}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTransaction \\\n` +
    `    -H 'content-type: application/grpc' -H 'te: trailers' --data-binary @- \\\n` +
    `    -o /dev/null -w 'HTTP %{http_code}  bytes=%{size_download}\\n'`;

  const devtoolCommands =
    `# the viewing key is above; export it first, so it stays out of your shell history\n` +
    `zcash-devtool wallet -w ./audit-view init-fvk --name audit --fvk "$UFVK" --birthday ${d.birthday_height} -s zecrocks\n` +
    `zcash-devtool wallet -w ./audit-view sync    -s zecrocks\n` +
    `zcash-devtool wallet -w ./audit-view enhance -s zecrocks\n` +
    `zcash-devtool wallet -w ./audit-view list-tx`;

  const pool = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);
  const expected =
    `${txid}\n` +
    `     Mined: ${height}\n` +
    `    Amount:   ${(totalZat / 1e8).toFixed(8)} TAZ\n` +
    `  Sent 0 notes, received ${notes.length} notes, ${memos} memos\n` +
    notes.map((r) =>
      `  Output ${r.index} (${pool(r.pool)})\n` +
      `    Value:   ${(r.value_zat / 1e8).toFixed(8)} TAZ\n` +
      (r.memo ? `    Memo: Memo::Text("${r.memo}")\n` : "")).join("");

  return (
    <div className="space-y-6">
      {back}

      <Panel title={tr({ en: "What this platform claims", pt: "O que esta plataforma afirma" })}
        description={tr({
          en: "Read with the treasury's viewing key and served from EmpowerFI's database. Everything on this page exists so you do not have to take it on trust.",
          pt: "Lido com a chave de visualização da tesouraria e servido do banco da EmpowerFI. Tudo nesta página existe para você não precisar aceitar isso por confiança.",
        })}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all rounded-md bg-secondary/50 px-2 py-1.5 font-mono text-xs">{txid}</code>
            <Copyable value={txid} label={tr({ en: "the transaction id", pt: "o id da transação" })} />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Block", pt: "Bloco" })}</dt>
              <dd className="num">{formatNumber(height)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Received", pt: "Recebido" })}</dt>
              <dd className="num">{zec(totalZat, d.network)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Notes", pt: "Notas" })}</dt>
              <dd className="num">{notes.length}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{tr({ en: "Network", pt: "Rede" })}</dt>
              <dd>Zcash {net}</dd></div>
          </dl>
          <ul className="divide-y divide-border border-y border-border text-sm">
            {notes.map((r) => (
              <li key={`${r.pool}:${r.index}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
                <span className="num min-w-[7rem] text-foreground">{zec(r.value_zat, d.network)}</span>
                <span className="text-xs text-muted-foreground">{POOL_LABEL[r.pool]}</span>
                <span className="min-w-0 break-words font-mono text-xs text-muted-foreground">{r.memo ?? "—"}</span>
                {r.opportunity_code && (
                  <span className="font-mono text-xs text-foreground">{r.opportunity_code}</span>
                )}
              </li>
            ))}
          </ul>
          {notes.length > 1 && (
            <p className="text-xs text-info">
              {tr({
                en: `One shielded transaction carrying ${notes.length} allocations. That is a batch: several investors settle together so no single transfer is attributable to one of them.`,
                pt: `Uma transação blindada carregando ${notes.length} alocações. Isso é um lote: várias investidoras liquidam juntas, para que nenhuma transferência isolada seja atribuível a uma delas.`,
              })}
            </p>
          )}
        </div>
      </Panel>

      <Panel title={tr({ en: "Check 1 — is it on chain?", pt: "Checagem 1 — está na cadeia?" })}
        description={tr({
          en: "No key needed, and nothing of ours in the path. A public Zcash server answers from the transaction id alone.",
          pt: "Sem chave nenhuma, e nada nosso no caminho. Um servidor Zcash público responde a partir do id da transação.",
        })}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-secondary/50 p-3 font-mono text-[11px] leading-relaxed">{grpcCommand}</pre>
            <Copyable value={grpcCommand} label={tr({ en: "the command", pt: "o comando" })} />
          </div>
          <div className="rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">{tr({ en: "What it should print", pt: "O que deve imprimir" })}</p>
            <code className="mt-1 block font-mono text-xs text-foreground">HTTP 200  bytes=…</code>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {tr({
                en: "A few thousand bytes of a real transaction, and HTTP 200. Flip any character of the id and the same server returns zero bytes: it answers from the chain rather than agreeing with whatever it is handed. The id goes in reversed, which is why the command looks the way it does — asking in display order is one of the ways to get a not-found.",
                pt: "Alguns milhares de bytes de uma transação real, e HTTP 200. Troque qualquer caractere do id e o mesmo servidor devolve zero bytes: ele responde a partir da cadeia, não concorda com o que recebe. O id vai invertido, e é por isso que o comando tem essa cara — pedir na ordem exibida é uma das formas de receber não-encontrado.",
              })}
            </p>
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Or let this page make the same call now:", pt: "Ou deixe esta página fazer a mesma chamada agora:" })}
            </p>
            <OnChainCheck txid={txid} claimedHeight={height} />
          </div>
        </div>
      </Panel>

      <Panel title={tr({ en: "Check 2 — what was inside it?", pt: "Checagem 2 — o que havia dentro?" })}
        description={tr({
          en: "Check 1 proves a transaction exists in a block. It cannot say who was paid: that is what being shielded means. Only the treasury's viewing key opens it, and here it is.",
          pt: "A checagem 1 prova que uma transação existe num bloco. Ela não diz quem foi pago: é isso que significa ser blindada. Só a chave de visualização da tesouraria abre, e ela está aqui.",
        })}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound size={14} className="text-muted-foreground" aria-hidden />
            <code className="min-w-0 flex-1 break-all rounded-md bg-secondary/50 px-2 py-1.5 font-mono text-[11px]">
              {reveal ? d.ufvk : "•".repeat(48)}
            </code>
            <Button variant="secondary" size="sm" onClick={() => setReveal(!reveal)}
              aria-label={reveal
                ? tr({ en: "Hide the viewing key", pt: "Esconder a chave de visualização" })
                : tr({ en: "Reveal the viewing key", pt: "Revelar a chave de visualização" })}>
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
              {reveal ? tr({ en: "Hide", pt: "Esconder" }) : tr({ en: "Reveal", pt: "Revelar" })}
            </Button>
            <Copyable value={d.ufvk} label={tr({ en: "the viewing key", pt: "a chave de visualização" })} />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {tr({
              en: "A unified full viewing key. It reads every note this treasury ever received and carries no authority to spend any of it. Disclosing it is the point: an auditor who holds it never has to ask us what happened.",
              pt: "Uma chave de visualização completa unificada. Ela lê todas as notas que esta tesouraria já recebeu e não carrega poder nenhum de gastar. Divulgá-la é o objetivo: quem a tem nunca precisa nos perguntar o que aconteceu.",
            })}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-secondary/50 p-3 font-mono text-[11px] leading-relaxed">{devtoolCommands}</pre>
            <Copyable value={devtoolCommands} label={tr({ en: "the commands", pt: "os comandos" })} />
          </div>
          <div className="rounded-md border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">
              {tr({ en: "What list-tx should print for this transaction", pt: "O que o list-tx deve imprimir para esta transação" })}
            </p>
            <pre className="mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground">{expected}</pre>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {tr({
                en: "Alongside the block time and the treasury's address, which are left out here only to keep the comparison short. The enhance step is not optional: without it list-tx reports 0 memos and no reference, because the wallet holds the notes but not the full transaction data the memo lives in.",
                pt: "Ao lado da hora do bloco e do endereço da tesouraria, omitidos aqui só para manter a comparação curta. O passo enhance não é opcional: sem ele o list-tx informa 0 memos e nenhuma referência, porque a carteira tem as notas mas não os dados completos da transação onde o memo vive.",
              })}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={tr({ en: "Why there is no explorer link", pt: "Por que não há link de explorador" })}>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {tr({
              en: "A shielded transaction carries no address, no value and no memo in the clear, so a block explorer has nothing to display. Every note in this treasury is in the Ironwood pool, added in network upgrade NU6.3, which testnet explorers do not index.",
              pt: "Uma transação blindada não carrega endereço, valor nem memo em claro, então um explorador de blocos não tem o que exibir. Todas as notas desta tesouraria estão no pool Ironwood, criado na atualização de rede NU6.3, que os exploradores de testnet não indexam.",
            })}
          </p>
          <p>
            {tr({
              en: "Measured on 2 Oct 2026 against testnet.zcashexplorer.app, rather than assumed: its indexer was ahead of these transactions, a transaction id taken from its own block listing resolved normally, and all twenty ids from both EmpowerFI wallets returned not-found. The explorer is working and has nothing to show. One that could show you this transaction would mean the privacy claim was false.",
              pt: "Medido em 2 de outubro de 2026 contra o testnet.zcashexplorer.app, em vez de suposto: o indexador dele estava à frente destas transações, um id tirado da listagem de blocos dele próprio resolveu normalmente, e os vinte ids das duas carteiras da EmpowerFI voltaram não-encontrado. O explorador funciona e não tem o que mostrar. Um que conseguisse exibir esta transação significaria que a afirmação de privacidade é falsa.",
            })}
          </p>
          <p className="text-xs">
            {tr({
              en: "This is testnet: the funds are TAZ, not ZEC, and the conversion to dollars and the Pix settlement are simulated in this build.",
              pt: "Esta é a testnet: os valores são TAZ, não ZEC, e a conversão em dólares e a liquidação por Pix são simuladas nesta versão.",
            })}
          </p>
        </div>
      </Panel>
    </div>
  );
}
