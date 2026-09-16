import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { fetchPlatformConfig, findConfigPda } from "@empowerfi/audit-client";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { localized, tr } from "../../i18n";
import { PROGRAM_ID, rpc, sol, usdc, vaultAddress } from "../../lib/solana";
import { useSystemAudit } from "./queries";

const ago = (iso: string | null) => {
  if (!iso) return tr({ en: "never", pt: "nunca" });
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return tr({ en: `${Math.round(s)} s ago`, pt: `há ${Math.round(s)} s` });
  if (s < 5400) return tr({ en: `${Math.round(s / 60)} min ago`, pt: `há ${Math.round(s / 60)} min` });
  if (s < 172800) return tr({ en: `${Math.round(s / 3600)} h ago`, pt: `há ${Math.round(s / 3600)} h` });
  return tr({ en: `${Math.round(s / 86400)} days ago`, pt: `há ${Math.round(s / 86400)} dias` });
};

const JOB_PURPOSE: Record<string, string> = localized({
  "dispatch-anchor-jobs": { en: "Sends queued proofs to Solana", pt: "Envia à Solana as provas na fila" },
  "reconcile-anchors": { en: "Re-reads confirmed proofs from Solana and compares", pt: "Relê na Solana as provas confirmadas e compara" },
  "vault-refunds": { en: "Returns investors' USDC from the vault when owed", pt: "Devolve do cofre o USDC devido aos investidores" },
  "zcash-watch": {
    en: "Reads the Zcash treasury with its viewing key; credits confirmed payments",
    pt: "Lê a tesouraria Zcash com a chave de visualização; credita os pagamentos confirmados",
  },
  "vault-settle": {
    en: "Releases disbursed loans to the ramp; pays instalments out to investors",
    pt: "Libera para a rampa os empréstimos desembolsados; repassa as parcelas aos investidores",
  },
});

/** What Solana itself says, read here: the vault's USDC and the operator's SOL. */
async function readChain() {
  const vault = await vaultAddress();
  const [config] = await findConfigPda();
  const [balance, platform] = await Promise.all([
    rpc.getTokenAccountBalance(vault, { commitment: "confirmed" }).send().then(({ value }) => BigInt(value.amount)).catch(() => null),
    fetchPlatformConfig(rpc, config),
  ]);
  const { value: lamports } = await rpc.getBalance(platform.data.operator, { commitment: "confirmed" }).send();
  return { vault, vaultMicro: balance, operator: platform.data.operator as string, operatorLamports: lamports };
}

/** The machinery behind the proofs: queues, reconciliation, refunds, the vault and the jobs that drive them. */
export default function System() {
  const q = useSystemAudit();
  const chain = useQuery({ queryKey: ["audit-chain"], queryFn: readChain, refetchInterval: 30_000 });

  if (q.isError) return <LoadError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const d = q.data;
  const queued = d.anchors.pending + d.anchors.submitted;
  const flagged = d.reconcile.missing + d.reconcile.mismatch;
  const vaultMatches = chain.data?.vaultMicro !== null && chain.data?.vaultMicro !== undefined
    ? chain.data.vaultMicro === BigInt(d.vault.expected_micro_usdc) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={tr({ en: "Proofs queued", pt: "Provas na fila" })} value={queued}
          hint={queued ? tr({ en: `oldest ${ago(d.anchors.oldest_queued_at)}`, pt: `a mais antiga, ${ago(d.anchors.oldest_queued_at)}` }) : tr({ en: "queue empty", pt: "fila vazia" })}
          hintTone={queued ? "caution" : "positive"} />
        <StatTile label={tr({ en: "Last proof confirmed", pt: "Última prova confirmada" })} value={ago(d.anchors.last_confirmed_at)}
          hint={tr({ en: `${d.anchors.confirmed} in total`, pt: `${d.anchors.confirmed} no total` })} />
        <StatTile label={tr({ en: "Flagged by reconciliation", pt: "Sinalizadas pela conciliação" })} value={flagged}
          hint={tr({ en: `${d.reconcile.verified} verified`, pt: `${d.reconcile.verified} verificadas` })} hintTone={flagged ? "alert" : "positive"} />
        <StatTile label={tr({ en: "Refunds owed", pt: "Reembolsos devidos" })} value={d.refunds.due + d.refunds.sending}
          hint={tr({ en: `${d.refunds.refunded} sent`, pt: `${d.refunds.refunded} enviados` })} hintTone={d.refunds.due + d.refunds.sending ? "caution" : "positive"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "The vault", pt: "O cofre" })}
          description={tr({
            en: "Investors' USDC, held by the program. What Solana says it holds, against what the database says it should.",
            pt: "O USDC dos investidores, guardado pelo programa. O que a Solana diz que ele tem, comparado com o que o banco de dados diz que deveria ter.",
          })}>
          <dl className="divide-y divide-border text-sm">
            <Row label={tr({ en: "On Solana", pt: "Na Solana" })}>
              {chain.isPending ? tr({ en: "Reading devnet…", pt: "Lendo a devnet…" })
                : chain.data?.vaultMicro === null ? tr({ en: "No account yet", pt: "Ainda sem conta" })
                : chain.data ? usdc(chain.data.vaultMicro) : "—"}
              {chain.data && <span className="ml-2"><ExplorerLink address={chain.data.vault} /></span>}
            </Row>
            <Row label={tr({ en: "Should hold", pt: "Deveria ter" })}>
              {usdc(d.vault.expected_micro_usdc)}{" "}
              <span className="text-xs text-muted-foreground">{tr({ en: "allocated, or owed back and not yet sent", pt: "alocado, ou devido de volta e ainda não enviado" })}</span>
            </Row>
            <Row label={tr({ en: "Deposited", pt: "Depositado" })}>
              {tr({
                en: `${usdc(d.vault.deposited_micro_usdc)} in ${d.vault.deposits} deposit${d.vault.deposits === 1 ? "" : "s"}`,
                pt: `${usdc(d.vault.deposited_micro_usdc)} em ${d.vault.deposits} depósito${d.vault.deposits === 1 ? "" : "s"}`,
              })}
            </Row>
            {d.vault.zcash_micro_usdc > 0 && (
              <Row label={tr({ en: "From shielded ZEC", pt: "De ZEC blindado" })}>
                {usdc(d.vault.zcash_micro_usdc)}{" "}
                <span className="text-xs text-muted-foreground">{tr({ en: "credited by the operator for ZEC payments", pt: "creditado pelo operador por pagamentos em ZEC" })}</span>
              </Row>
            )}
            <Row label={tr({ en: "Refunded", pt: "Reembolsado" })}>{usdc(d.vault.refunded_micro_usdc)}</Row>
            <Row label={tr({ en: "Released", pt: "Liberado" })}>
              {usdc(d.vault.released_micro_usdc)}{" "}
              <span className="text-xs text-muted-foreground">
                {tr({ en: "to the off-ramp, as the P2P desk disbursed global loans", pt: "para o off-ramp, conforme a mesa P2P desembolsou empréstimos globais" })}
              </span>
            </Row>
            <Row label={tr({ en: "Paid out", pt: "Repassado" })}>
              {usdc(d.vault.paid_out_micro_usdc)}{" "}
              <span className="text-xs text-muted-foreground">
                {tr({
                  en: `to investors; ${usdc(d.vault.repaid_in_micro_usdc)} came in with it`,
                  pt: `aos investidores; ${usdc(d.vault.repaid_in_micro_usdc)} entraram junto`,
                })}
              </span>
            </Row>
          </dl>
          <p className={`flex items-center gap-2 text-sm ${vaultMatches === null ? "text-muted-foreground" : vaultMatches ? "text-positive" : "text-caution"}`}>
            {vaultMatches === null ? <CircleDashed size={16} /> : vaultMatches ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {vaultMatches === null ? tr({ en: "Comparing with Solana…", pt: "Comparando com a Solana…" })
              : vaultMatches ? tr({ en: "The vault holds exactly what the database accounts for.", pt: "O cofre tem exatamente o que o banco de dados registra." })
              : tr({
                en: "The vault and the database differ: a transfer not recorded here, or one on its way.",
                pt: "O cofre e o banco de dados divergem: uma transferência não registrada aqui, ou uma a caminho.",
              })}
          </p>
          {chain.isError && <p className="text-xs text-alert">{tr({ en: "Could not read devnet:", pt: "Não foi possível ler a devnet:" })} {(chain.error as Error).message}</p>}
        </Panel>

        <Panel title={tr({ en: "Program and operator", pt: "Programa e operador" })}
          description={tr({
            en: "The one program every proof and transfer goes through, and the key that signs for the platform.",
            pt: "O único programa por onde passam todas as provas e transferências, e a chave que assina pela plataforma.",
          })}>
          <dl className="divide-y divide-border text-sm">
            <Row label={tr({ en: "Program", pt: "Programa" })}><ExplorerLink address={PROGRAM_ID} /> <span className="text-xs text-muted-foreground">Solana Devnet</span></Row>
            <Row label={tr({ en: "Operator", pt: "Operador" })}>{chain.data ? <ExplorerLink address={chain.data.operator} /> : "…"}</Row>
            <Row label={tr({ en: "Operator balance", pt: "Saldo do operador" })}>
              {chain.data ? sol(chain.data.operatorLamports) : "…"}{" "}
              <span className="text-xs text-muted-foreground">{tr({ en: "pays for each proof's account and fee", pt: "paga a conta e a taxa de cada prova" })}</span>
            </Row>
            <Row label={tr({ en: "Last anchoring error", pt: "Último erro de registro" })}>{d.anchors.last_error ? <span className="text-xs text-alert">{d.anchors.last_error}</span> : <span className="text-xs text-muted-foreground">{tr({ en: "none", pt: "nenhum" })}</span>}</Row>
            <Row label={tr({ en: "Last refund error", pt: "Último erro de reembolso" })}>{d.refunds.last_error ? <span className="text-xs text-alert">{d.refunds.last_error}</span> : <span className="text-xs text-muted-foreground">{tr({ en: "none", pt: "nenhum" })}</span>}</Row>
            <Row label={tr({ en: "Settlement", pt: "Liquidação" })}>
              {tr({
                en: `${d.settlement.due + d.settlement.sending} to send · ${d.settlement.held} held · `,
                pt: `${d.settlement.due + d.settlement.sending} a enviar · ${d.settlement.held} retidas · `,
              })}
              <span className={d.settlement.failed ? "text-alert" : ""}>{tr({ en: `${d.settlement.failed} failed`, pt: `${d.settlement.failed} com falha` })}</span>
              {d.settlement.last_error && <span className="block text-xs text-alert">{d.settlement.last_error}</span>}
            </Row>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "Reconciliation", pt: "Conciliação" })}
          description={tr({
            en: "Every confirmed proof is re-read from Solana and compared with the record as it is now, at least once a day.",
            pt: "Cada prova confirmada é relida na Solana e comparada com o registro como está agora, pelo menos uma vez por dia.",
          })}>
          <dl className="divide-y divide-border text-sm">
            <Row label={tr({ en: "Verified", pt: "Verificadas" })}>{d.reconcile.verified}</Row>
            <Row label={tr({ en: "Awaiting a check", pt: "Aguardando conferência" })}>{d.reconcile.unchecked}</Row>
            <Row label={tr({ en: "Missing on chain", pt: "Ausentes na blockchain" })}><span className={d.reconcile.missing ? "text-alert" : ""}>{d.reconcile.missing}</span></Row>
            <Row label={tr({ en: "Changed since", pt: "Alteradas depois" })}>{<span className={d.reconcile.mismatch ? "text-alert" : ""}>{d.reconcile.mismatch}</span>}</Row>
            <Row label={tr({ en: "Last check", pt: "Última conferência" })}>{ago(d.reconcile.last_at)}</Row>
          </dl>
        </Panel>

        <Panel title={tr({ en: "Scheduled jobs", pt: "Tarefas agendadas" })}
          description={tr({ en: "Run by the database (pg_cron), each calling an Edge Function.", pt: "Executadas pelo banco de dados (pg_cron), cada uma chamando uma Edge Function." })}>
          {!d.jobs ? <p className="text-sm text-muted-foreground">{tr({ en: "The job list is not readable here.", pt: "A lista de tarefas não pode ser lida aqui." })}</p> : (
            <ul className="divide-y divide-border text-sm">
              {d.jobs.map((j) => (
                <li key={j.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="block font-mono text-xs text-foreground">{j.name}</span>
                    <span className="text-xs text-muted-foreground">{JOB_PURPOSE[j.name] ?? ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{j.schedule === "* * * * *" ? tr({ en: "every minute", pt: "a cada minuto" }) : tr({ en: `every ${j.schedule}`, pt: `a cada ${j.schedule}` })}</span>
                    <StatusPill tone={j.active ? "positive" : "neutral"}>{j.active ? tr({ en: "Active", pt: "Ativa" }) : tr({ en: "Paused", pt: "Pausada" })}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] items-center gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
