import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  address, appendTransactionMessageInstruction, createTransactionMessage, getBase58Decoder, pipe,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
} from "@solana/kit";
import { getTransferCheckedInstruction } from "@solana-program/token-2022";
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { ArrowLeft, ArrowRightLeft, CircleCheck, FlaskConical, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../components/LoadError";
import ExplorerLink from "../../components/product/ExplorerLink";
import PageHeader from "../../components/product/PageHeader";
import Panel from "../../components/product/Panel";
import StatTile from "../../components/product/StatTile";
import StatusPill from "../../components/product/StatusPill";
import { formatDate, formatNumber, tr } from "../../i18n";
import { duration } from "../../lib/economics";
import {
  eligibleWalletsKey, fetchEligibleWallets, fetchTokenizedPosition, POSITION_EVENT, POSITION_LIQUIDITY,
  POSITION_RELATION, POSITION_STATE, POSITION_TONE, positionDisclaimer, positionKey, positionsKey,
  prepareTransfer, recordTransfer,
} from "../../lib/positions";
import { money } from "../../lib/readiness";
import { CLUSTER, confirmSignature, rpc, shortAddress } from "../../lib/solana";

// One asset, in full: what it is worth to her, what the loan behind it is
// doing, what evidence stands behind that, and where it has been.
//
// The transfer is signed by the investor in her own wallet. The platform
// cannot move her asset — it holds the freeze authority, which decides where
// the asset may go, not whether it goes. So the flow has three steps and the
// first belongs to us: admit the destination by thawing its token account,
// then she signs, then the chain is asked whether it happened.

type Step = "admit" | "sign" | "confirm" | "record" | "done";

// Read when the step changes rather than when this module loads, so switching
// language mid-transfer does not leave the old one on screen.
const stepLabel = (step: Step): string => ({
  admit: tr({ en: "Admitting the destination…", pt: "Admitindo o destino…" }),
  sign: tr({ en: "Waiting for your wallet…", pt: "Esperando sua carteira…" }),
  confirm: tr({ en: "Confirming on Devnet…", pt: "Confirmando na Devnet…" }),
  record: tr({ en: "Recording the new owner…", pt: "Registrando o novo dono…" }),
  done: tr({ en: "Transferred", pt: "Transferida" }),
}[step]);

function Line({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}{hint && <span className="block text-xs">{hint}</span>}</span>
      <span className="num shrink-0 text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

/**
 * A position she cannot read. Almost always because it has changed hands: the
 * console shows what she funded and what her wallet holds, and an asset she
 * has handed on is neither. "Try again" would be a lie, so it does not offer
 * one — anything else that failed still does.
 */
function NoLongerYours({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);
  if (message !== "not_your_position") return <LoadError error={error} onRetry={onRetry} />;
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <ArrowRightLeft size={26} className="text-muted-foreground" aria-hidden />
      <p className="font-heading text-lg font-bold text-foreground">
        {tr({ en: "Not yours to read", pt: "Não é seu para ler" })}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">{tr({
        en: "This asset is neither one you funded nor one the wallet you connected holds. If you handed it on, the transfer is on Solana and whoever holds it reads it now.",
        pt: "Este ativo não foi financiado por você nem está na carteira que você conectou. Se você o entregou, a transferência está na Solana e quem o detém agora é quem o lê.",
      })}</p>
      <Button asChild className="mt-1">
        <Link to="/app/investor/assets">{tr({ en: "Your positions", pt: "Suas posições" })}</Link>
      </Button>
    </div>
  );
}

function Transfer({ positionId, mint, owner, account, onTransferred }: {
  positionId: string;
  mint: string;
  owner: string;
  account: UiWalletAccount;
  onTransferred: (toWallet: string, signature: string) => void | Promise<void>;
}) {
  const signer = useWalletAccountTransactionSendingSigner(account, CLUSTER);
  const wallets = useQuery({ queryKey: eligibleWalletsKey, queryFn: fetchEligibleWallets });
  const [to, setTo] = useState<string>("");
  const [step, setStep] = useState<Step | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  // Her own wallet is not a destination, and neither is one she does not hold.
  const options = (wallets.data ?? []).filter((w) => w.wallet !== owner);
  const mine = account.address === owner;

  const run = async () => {
    setFailed(null);
    setSignature(null);
    try {
      setStep("admit");
      const prepared = await prepareTransfer(positionId, to);
      setStep("sign");
      const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstruction(
          getTransferCheckedInstruction({
            source: address(prepared.source),
            mint: address(prepared.mint),
            destination: address(prepared.destination),
            authority: signer,
            amount: 1n,
            decimals: prepared.decimals,
          }), m),
      );
      const sent = getBase58Decoder().decode(await signAndSendTransactionMessageWithSigners(message));
      setSignature(sent);
      setStep("confirm");
      await confirmSignature(sent);
      setStep("record");
      await recordTransfer(positionId, to, sent);
      setStep("done");
      // What to refresh is the page's decision, not this panel's: handing an
      // asset on can take the page's own data away from her.
      await onTransferred(to, sent);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : String(err));
    }
  };

  if (!mine) {
    return (
      <p className="text-sm text-muted-foreground">{tr({
        en: `This asset is held by ${shortAddress(owner)}. Connect that wallet to move it — the platform cannot sign for you.`,
        pt: `Este ativo está com ${shortAddress(owner)}. Conecte essa carteira para movê-lo — a plataforma não assina por você.`,
      })}</p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground" htmlFor="destination">
        {tr({ en: "Send to an admitted wallet", pt: "Enviar para uma carteira admitida" })}
      </label>
      <Select value={to} onValueChange={setTo}>
        <SelectTrigger id="destination" className="w-full sm:w-96">
          <SelectValue placeholder={tr({ en: "Choose a destination", pt: "Escolha um destino" })} />
        </SelectTrigger>
        <SelectContent>
          {options.map((w) => (
            <SelectItem key={w.wallet} value={w.wallet}>{w.label} · {shortAddress(w.wallet)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{tr({
        en: "Only these wallets can receive it. A token account for this asset is frozen when it is created, and the platform thaws the destination's before you sign — a transfer anywhere else fails at the token program.",
        pt: "Só estas carteiras podem recebê-lo. A conta de token deste ativo nasce congelada, e a plataforma descongela a do destino antes de você assinar — uma transferência para qualquer outro lugar falha no programa do token.",
      })}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={!to || (step !== null && step !== "done" && !failed)} className="gap-2">
          {step && step !== "done" && !failed ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRightLeft size={16} aria-hidden />}
          {tr({ en: "Transfer position", pt: "Transferir posição" })}
        </Button>
        {step && !failed && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {step === "done" && <CircleCheck size={15} className="text-positive" aria-hidden />}
            {stepLabel(step)}
          </span>
        )}
      </div>

      {signature && <ExplorerLink tx={signature} label={tr({ en: "The transfer on Solana Explorer", pt: "A transferência no Solana Explorer" })} />}
      {failed && (
        <p className="flex items-start gap-2 rounded-lg border tone-alert px-3 py-2 text-sm" role="alert">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>{failed}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">{tr({
        en: "Transferability is not liquidity: there is no buyer, no price and no market here.",
        pt: "Transferibilidade não é liquidez: aqui não há comprador, nem preço, nem mercado.",
      })}</p>
    </div>
  );
}

export default function PositionAsset() {
  const { id = "" } = useParams();
  const [account] = useSelectedWalletAccount();
  const queryClient = useQueryClient();
  // Set when she hands on an asset she held but did not fund: from that moment
  // the position is not hers to read, so refetching it would answer 403 and
  // replace the page she is standing on with an error. The page freezes on
  // what it already has and says what happened instead.
  const [handedOn, setHandedOn] = useState<{ to: string; signature: string } | null>(null);
  const q = useQuery({
    queryKey: positionKey(id), queryFn: () => fetchTokenizedPosition(id),
    enabled: Boolean(id) && handedOn === null,
  });
  const p = q.data;

  const onTransferred = async (to: string, signature: string) => {
    // The investor who funded it goes on reading it; whoever only held it does not.
    const keepsAccess = p?.relation === "invested";
    if (!keepsAccess) setHandedOn({ to, signature });
    await queryClient.invalidateQueries({ queryKey: positionsKey });
    if (keepsAccess) await queryClient.invalidateQueries({ queryKey: positionKey(id) });
  };

  if (q.isError) return <NoLongerYours error={q.error} onRetry={() => q.refetch()} />;
  if (!p) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={tr({ en: "Tokenised position", pt: "Posição tokenizada" })}
        title={p.asset}
        description={tr({
          en: "One investor's economic position in one funded loan, as an asset on Solana Devnet.",
          pt: "A posição econômica de uma investidora em um empréstimo financiado, como ativo na Devnet da Solana.",
        })}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/app/investor/assets"><ArrowLeft size={16} /> {tr({ en: "All positions", pt: "Todas as posições" })}</Link>
          </Button>
        } />

      <p className="flex items-start gap-2.5 rounded-xl border tone-caution px-4 py-3 text-sm">
        <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{positionDisclaimer()}</span>
      </p>

      {handedOn && (
        <div className="panel space-y-2 p-4">
          <p className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">
            <CircleCheck size={16} className="text-positive" aria-hidden />
            {tr({ en: "You have handed this asset on", pt: "Você entregou este ativo" })}
          </p>
          <p className="text-sm text-muted-foreground">{tr({
            en: `${shortAddress(handedOn.to)} holds it now, so it is no longer yours to read and what follows is what this page last knew.`,
            pt: `${shortAddress(handedOn.to)} o detém agora, então ele deixou de ser seu para ler e o que segue é o que esta página soube por último.`,
          })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <ExplorerLink tx={handedOn.signature} label={tr({ en: "The transfer on Solana Explorer", pt: "A transferência no Solana Explorer" })} />
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/app/investor/assets"><ArrowLeft size={14} /> {tr({ en: "Your positions", pt: "Suas posições" })}</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={tr({ en: "State", pt: "Estado" })}
          value={<StatusPill tone={POSITION_TONE[p.state]}>{POSITION_STATE[p.state]}</StatusPill>}
          hint={p.loan ? tr({ en: `${p.loan.payments_made}/${p.loan.term_months} instalments`, pt: `${p.loan.payments_made}/${p.loan.term_months} parcelas` }) : undefined} />
        <StatTile label={tr({ en: "Her share, at origination", pt: "A parte dela, na originação" })}
          value={money(p.principal_cents)}
          hint={tr({
            en: `${formatNumber(p.share_bps / 100, { maximumFractionDigits: 2 })}% of the loan`,
            pt: `${formatNumber(p.share_bps / 100, { maximumFractionDigits: 2 })}% do empréstimo`,
          })} />
        <StatTile label={tr({ en: "Her share, still to come", pt: "A parte dela, ainda a receber" })}
          value={money(p.outstanding_cents)}
          hint={tr({ en: "instalments left, interest included", pt: "parcelas que faltam, com juros" })} />
        <StatTile label={tr({ en: "Liquidity", pt: "Liquidez" })}
          value={POSITION_LIQUIDITY[p.liquidity].label}
          hint={p.risk_band ? tr({ en: `risk ${p.risk_band}`, pt: `risco ${p.risk_band}` }) : undefined} />
      </div>
      <p className="text-xs text-muted-foreground">{POSITION_LIQUIDITY[p.liquidity].says}</p>
      {POSITION_RELATION[p.relation] && (
        <p className="text-xs text-muted-foreground">{POSITION_RELATION[p.relation]?.says}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={tr({ en: "The asset", pt: "O ativo" })}>
          <Line label={tr({ en: "Owner", pt: "Dono" })}
            value={p.owner_wallet ? <ExplorerLink address={p.owner_wallet} /> : "—"}
            hint={POSITION_RELATION[p.relation]?.label} />
          <Line label={tr({ en: "Mint", pt: "Mint" })}
            value={p.mint_address ? <ExplorerLink address={p.mint_address} /> : tr({ en: "not created yet", pt: "ainda não criado" })}
            hint={tr({ en: "Token-2022, supply 1, frozen by default", pt: "Token-2022, oferta 1, congelado por padrão" })} />
          <Line label={tr({ en: "Token account", pt: "Conta de token" })}
            value={p.token_account ? <ExplorerLink address={p.token_account} /> : "—"} />
          <Line label={tr({ en: "Created on Devnet", pt: "Criado na Devnet" })}
            value={p.mint_signature ? <ExplorerLink tx={p.mint_signature} /> : "—"}
            hint={p.minted_at ? formatDate(p.minted_at) : undefined} />
        </Panel>

        <Panel title={tr({ en: "The loan behind it", pt: "O empréstimo por trás" })}>
          {p.loan ? (
            <>
              <Line label={tr({ en: "Loan principal", pt: "Principal do empréstimo" })} value={money(p.loan.principal_cents)}
                hint={tr({ en: "the whole loan, not her share", pt: "o empréstimo inteiro, não a parte dela" })} />
              <Line label={tr({ en: "Loan outstanding", pt: "Em aberto no empréstimo" })} value={money(p.loan.outstanding_cents)} />
              <Line label={tr({ en: "Instalment", pt: "Parcela" })} value={money(p.loan.instalment_cents)}
                hint={tr({ en: `${p.loan.term_months} months`, pt: `${p.loan.term_months} meses` })} />
              <Line label={tr({ en: "Disbursed", pt: "Desembolsado" })}
                value={p.loan.disbursed_at ? formatDate(p.loan.disbursed_at) : "—"} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{tr({
              en: "The opportunity is funded and the desk has not disbursed yet. Her position exists; the loan does not.",
              pt: "A oportunidade está financiada e a mesa ainda não desembolsou. A posição dela existe; o empréstimo, não.",
            })}</p>
          )}
        </Panel>

        <Panel title={tr({ en: "The evidence behind it", pt: "A evidência por trás" })}>
          <Line label={tr({ en: "Latest check-in", pt: "Último check-in" })}
            value={p.evidence.latest_checkin_at ? formatDate(p.evidence.latest_checkin_at) : "—"}
            hint={p.evidence.latest_checkin_at
              ? tr({
                en: `${duration((Date.now() - Date.parse(p.evidence.latest_checkin_at)) / 1000)} ago`,
                pt: `há ${duration((Date.now() - Date.parse(p.evidence.latest_checkin_at)) / 1000)}`,
              })
              : undefined} />
          <Line label={tr({ en: "Months reported", pt: "Meses reportados" })} value={formatNumber(p.evidence.checkins)} />
          <Line label={tr({ en: "Readiness", pt: "Preparo" })}
            value={p.evidence.readiness_band ?? "—"} hint={p.evidence.readiness_model ?? undefined} />
          <Line label={tr({ en: "Outcomes measured", pt: "Resultados medidos" })} value={formatNumber(p.evidence.outcomes_measured)} />
          {p.mandate && (
            <Line label={tr({ en: "Impact mandate", pt: "Mandato de impacto" })}
              value={p.mandate.program} hint={p.mandate.sponsor} />
          )}
          <p className="pt-2 text-xs text-muted-foreground">{tr({
            en: "Dates and derived grades only. No name, no business, no figure she reported.",
            pt: "Apenas datas e notas derivadas. Nenhum nome, nenhum negócio, nenhum valor que ela reportou.",
          })}</p>
        </Panel>

        <Panel title={tr({ en: "Transfer", pt: "Transferência" })}>
          {p.liquidity === "transferable" && p.mint_address && p.owner_wallet && account ? (
            <Transfer positionId={p.id} mint={p.mint_address} owner={p.owner_wallet} account={account}
              onTransferred={onTransferred} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {!p.mint_address
                ? POSITION_LIQUIDITY[p.liquidity].says
                : !account
                  ? tr({ en: "Connect the wallet that holds this asset to move it.", pt: "Conecte a carteira que guarda este ativo para movê-lo." })
                  : POSITION_LIQUIDITY[p.liquidity].says}
            </p>
          )}
        </Panel>
      </div>

      <Panel title={tr({ en: "History", pt: "Histórico" })}>
        <ol className="space-y-3">
          {p.events.map((e, i) => (
            <li key={`${e.occurred_at}-${i}`} className="grid gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:grid-cols-[10rem_1fr]">
              <span className="num text-xs text-muted-foreground">{formatDate(e.occurred_at)}</span>
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm text-foreground">{POSITION_EVENT[e.kind]}</span>
                {(e.from_wallet || e.to_wallet) && (
                  <span className="block text-xs text-muted-foreground">
                    {e.from_wallet ? `${shortAddress(e.from_wallet)} → ` : ""}{e.to_wallet ? shortAddress(e.to_wallet) : ""}
                  </span>
                )}
                {e.signature
                  ? <ExplorerLink tx={e.signature} />
                  : <span className="block text-[11px] text-muted-foreground">{tr({ en: "recorded off chain", pt: "registrado fora da cadeia" })}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {p.proof.length > 0 && (
        <Panel title={tr({ en: "The credit's own proofs", pt: "As provas do próprio crédito" })}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {p.proof.map((a) => (
              <li key={`${a.kind}-${a.signature ?? ""}`} className="flex items-center gap-2">
                <span className="text-muted-foreground">{a.kind}</span>
                {a.signature ? <ExplorerLink tx={a.signature} /> : <span className="text-xs text-muted-foreground">{a.status}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
