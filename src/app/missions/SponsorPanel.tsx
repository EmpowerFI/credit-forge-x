import { useState } from "react";
import { Check, CircleDashed, ExternalLink, Loader2, Wallet, X } from "lucide-react";
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase58Decoder,
  getProgramDerivedAddress,
  type Instruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
} from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  addDays, CAMPAIGN_DAYS, createCampaignData, fundCampaignData, HOUSE_SHARE_BPS, HOUSE_WALLET, MIN_PRICE_UNITS, MIN_SEATS,
  OPERATOR_WALLET, REWARDS_PROGRAM_ID, spDay, USDC_DECIMALS, USDC_DEVNET_MINT, uuidBytes,
} from "@empowerfi/campaign-vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "../i18n";
import { describeError } from "../lib/errors";
import { explorerTx } from "../lib/platform";
import { CLUSTER, confirmSignature, FAUCETS, rpc, shortAddress, usdc } from "../lib/solana";
import ConnectWalletDialog from "../wallet/ConnectWallet";
import { useBalances } from "../wallet/useBalances";
import { diaryDb } from "../diary/db";
import { priceUnits } from "./chain";

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const today = () => spDay(Math.floor(Date.now() / 1000));
/** The earliest first day whose 30 days still include today. */
const earliest = () => addDays(today(), -(CAMPAIGN_DAYS - 1));

const REGISTER_ERRORS: Record<string, { en: string; pt: string }> = {
  sponsor_name_taken: { en: "That sponsor name is already in use. Choose another.", pt: "Esse nome de patrocinador já está em uso. Escolha outro." },
  campaign_name_taken: { en: "That campaign name is already in use. Choose another.", pt: "Esse nome de campanha já está em uso. Escolha outro." },
  campaign_name_length: { en: "The campaign name needs 3 to 80 characters.", pt: "O nome da campanha precisa ter de 3 a 80 caracteres." },
  sponsor_name_length: { en: "The sponsor name needs 2 to 80 characters.", pt: "O nome do patrocinador precisa ter de 2 a 80 caracteres." },
};

type Step = "sign" | "confirm" | "record" | "done";
const STEPS: { key: Step; label: { en: string; pt: string } }[] = [
  { key: "sign", label: { en: "Sign in your wallet", pt: "Assinar na sua carteira" } },
  { key: "confirm", label: { en: "Confirmed on Solana", pt: "Confirmada na Solana" } },
  { key: "record", label: { en: "Checked and recorded by EmpowerFI", pt: "Conferida e registrada pela EmpowerFI" } },
];

/**
 * "Sponsor a campaign": the connected wallet is the sponsor. It signs one
 * transaction that creates the campaign on chain and pays price x seats into
 * the campaign's own vault; campaign-register then reads the chain back and
 * records it, unlisted until EmpowerFI reviews the names it was given.
 */
export default function SponsorPanel() {
  const [account] = useSelectedWalletAccount();
  const [connecting, setConnecting] = useState(false);
  return (
    <section id="sponsor" aria-labelledby="sponsor-title" className="scroll-mt-20 space-y-5 border-t border-border pt-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent">{tr({ en: "For sponsors", pt: "Para patrocinadores" })}</p>
        <h2 id="sponsor-title" className="font-heading text-3xl">{tr({ en: "Sponsor a campaign", pt: "Patrocinar uma campanha" })}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {tr({
            en: "Connect your wallet: it becomes the sponsor. One transaction creates the campaign on Solana and pays it into the campaign's vault. Devnet only, with test USDC.",
            pt: "Conecte a sua carteira: ela passa a ser a patrocinadora. Uma transação cria a campanha na Solana e deposita o valor no cofre da campanha. Só devnet, com USDC de teste.",
          })}
        </p>
      </div>
      {account ? <SponsorForm account={account} /> : (
        <Button className="gap-2" onClick={() => setConnecting(true)}>
          <Wallet size={16} aria-hidden /> {tr({ en: "Connect wallet", pt: "Conectar carteira" })}
        </Button>
      )}
      <ConnectWalletDialog open={connecting} onOpenChange={setConnecting} onConnected={() => setConnecting(false)} />
    </section>
  );
}

function SponsorForm({ account }: { account: UiWalletAccount }) {
  const [, setAccount] = useSelectedWalletAccount();
  const signer = useWalletAccountTransactionSendingSigner(account, CLUSTER);
  const balances = useBalances(account.address);
  const queryClient = useQueryClient();
  const tomorrow = addDays(today(), 1);
  const [form, setForm] = useState({ sponsor: "", name: "", starts: tomorrow, seats: String(MIN_SEATS), price: "0,10" });
  const [step, setStep] = useState<Step | null>(null);
  const [failed, setFailed] = useState<{ step: Step; message: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const seats = Number(form.seats);
  const price = priceUnits(form.price);
  const total = price !== null && Number.isInteger(seats) ? price * BigInt(seats) : null;
  const ends = addDays(form.starts, CAMPAIGN_DAYS - 1);
  const problem =
    form.sponsor.trim().length < 2 ? tr({ en: "Write the sponsor's name.", pt: "Escreva o nome do patrocinador." })
    : form.name.trim().length < 3 ? tr({ en: "Write the campaign's name.", pt: "Escreva o nome da campanha." })
    : !Number.isInteger(seats) || seats < MIN_SEATS ? tr({ en: `At least ${MIN_SEATS} entrepreneurs.`, pt: `No mínimo ${MIN_SEATS} empreendedoras.` })
    : price === null || price < BigInt(MIN_PRICE_UNITS) ? tr({ en: "At least 0.01 USDC per entrepreneur.", pt: "No mínimo 0,01 USDC por empreendedora." })
    // Up to 29 days back, so the diary's history counts and the campaign still runs today.
    : form.starts < earliest() ? tr({ en: "A campaign can start at most 29 days ago.", pt: "A campanha pode começar no máximo 29 dias atrás." })
    : balances.data && total !== null && BigInt(balances.data.microUsdc) < total
      ? tr({ en: "Not enough test USDC in this wallet.", pt: "Esta carteira não tem USDC de teste suficiente." })
    : null;

  const sponsor = async () => {
    if (problem || total === null || price === null) return;
    setFailed(null);
    setSignature(null);
    let current: Step = "sign";
    const id = crypto.randomUUID();
    try {
      setStep("sign");
      const program = address(REWARDS_PROGRAM_ID);
      const mint = address(USDC_DEVNET_MINT);
      const [campaign] = await getProgramDerivedAddress({ programAddress: program, seeds: [new TextEncoder().encode("campaign"), uuidBytes(id)] });
      const [vault] = await findAssociatedTokenPda({ owner: campaign, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      const [sponsorTokens] = await findAssociatedTokenPda({ owner: signer.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
      const terms = { campaign: id, seats, pricePerSeatUnits: price, startsOn: form.starts, endsOn: ends };
      const create: Instruction = {
        programAddress: program,
        accounts: [
          { address: signer.address, role: AccountRole.WRITABLE_SIGNER, signer } as never,
          { address: address(OPERATOR_WALLET), role: AccountRole.READONLY },
          { address: address(HOUSE_WALLET), role: AccountRole.READONLY },
          { address: mint, role: AccountRole.READONLY },
          { address: campaign, role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
        ],
        data: await createCampaignData(terms),
      };
      const makeVault = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: signer, owner: campaign, mint });
      const fund: Instruction = {
        programAddress: program,
        accounts: [
          { address: signer.address, role: AccountRole.READONLY_SIGNER, signer } as never,
          { address: campaign, role: AccountRole.WRITABLE },
          { address: mint, role: AccountRole.READONLY },
          { address: sponsorTokens, role: AccountRole.WRITABLE },
          { address: vault, role: AccountRole.WRITABLE },
          { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: await fundCampaignData(),
      };
      const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstructions([create, makeVault, fund], m),
      );
      const sent = getBase58Decoder().decode(await signAndSendTransactionMessageWithSigners(message));
      setSignature(sent);
      current = "confirm";
      setStep("confirm");
      await confirmSignature(sent);
      current = "record";
      setStep("record");
      const { data, error } = await diaryDb.functions.invoke<{ status: string }>("campaign-register", {
        body: { signature: sent, program_id: id, name: form.name.trim(), sponsor_name: form.sponsor.trim() },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        const known = body?.error && REGISTER_ERRORS[body.error as string];
        throw new Error(known ? tr(known) : tr({
          en: "The campaign is on chain, but it could not be recorded yet. Write to contato@empowerfi.io with the transaction link.",
          pt: "A campanha está na blockchain, mas ainda não foi registrada. Escreva para contato@empowerfi.io com o link da transação.",
        }));
      }
      if (!data) throw new Error("empty answer");
      setStep("done");
      await queryClient.invalidateQueries({ queryKey: ["missions"] });
      await queryClient.invalidateQueries({ queryKey: ["solana", "balances"] });
    } catch (err) {
      setFailed({ step: current, message: describeError(err) });
    }
  };

  const busy = step !== null && step !== "done" && !failed;
  const position = STEPS.findIndex((s) => s.key === step);
  const field = "h-11 text-base";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const house = total !== null ? (total * BigInt(HOUSE_SHARE_BPS)) / 10_000n : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-mono"><Wallet size={14} aria-hidden /> {shortAddress(account.address)}</span>
          <span className="text-muted-foreground">{balances.data ? usdc(balances.data.microUsdc) : "…"}</span>
          <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setAccount(undefined)}>
            {tr({ en: "Disconnect", pt: "Desconectar" })}
          </button>
        </div>
        {step !== "done" && (
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sp-sponsor">{tr({ en: "Sponsor", pt: "Patrocinador" })}</Label>
              <Input id="sp-sponsor" maxLength={80} autoComplete="organization" value={form.sponsor} onChange={set("sponsor")} className={field}
                placeholder={tr({ en: "Your organization", pt: "Sua organização" })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sp-name">{tr({ en: "Campaign name", pt: "Nome da campanha" })}</Label>
              <Input id="sp-name" maxLength={80} value={form.name} onChange={set("name")} className={field}
                placeholder={tr({ en: "30 days of good habits", pt: "30 dias de bons hábitos" })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-starts">{tr({ en: "Starts on", pt: "Começa em" })}</Label>
              <Input id="sp-starts" type="date" min={earliest()} value={form.starts} onChange={set("starts")} className={field} />
              <p className="text-xs text-muted-foreground">{tr({ en: `${CAMPAIGN_DAYS} days, until ${ends}`, pt: `${CAMPAIGN_DAYS} dias, até ${ends.split("-").reverse().join("/")}` })}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-seats">{tr({ en: "Entrepreneurs", pt: "Empreendedoras" })}</Label>
              <Input id="sp-seats" type="number" inputMode="numeric" min={MIN_SEATS} step={1} value={form.seats} onChange={set("seats")} className={field} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-price">{tr({ en: "USDC per entrepreneur", pt: "USDC por empreendedora" })}</Label>
              <Input id="sp-price" inputMode="decimal" value={form.price} onChange={set("price")} className={field} />
            </div>
          </fieldset>
        )}
        {problem && step === null && <p className="text-sm text-muted-foreground">{problem}</p>}
        {balances.data && total !== null && BigInt(balances.data.microUsdc) < total && (
          <p className="flex flex-wrap gap-3 text-sm">
            <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
              {tr({ en: "Get test USDC", pt: "Obter USDC de teste" })} <ExternalLink size={12} aria-hidden />
            </a>
            <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
              {tr({ en: "Get test SOL", pt: "Obter SOL de teste" })} <ExternalLink size={12} aria-hidden />
            </a>
          </p>
        )}
      </div>

      <div className="space-y-4">
        {total !== null && (
          <dl className="grid grid-cols-3 gap-px border border-border bg-border text-center">
            {[
              { k: tr({ en: "Total", pt: "Total" }), v: usdc(total) },
              { k: "50% EmpowerFI", v: usdc(house) },
              { k: tr({ en: "50% Entrepreneurs", pt: "50% Empreendedoras" }), v: usdc(total - (house ?? 0n)) },
            ].map((x) => (
              <div key={x.k} className="bg-card p-3">
                <dt className="text-xs text-muted-foreground">{x.k}</dt>
                <dd className="mt-1 font-heading text-base tabular-nums">{x.v}</dd>
              </div>
            ))}
          </dl>
        )}
        {step !== "done" && (
          <Button className="h-11 w-full gap-2 text-base" disabled={Boolean(problem) || busy} onClick={() => void sponsor()}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Wallet size={18} aria-hidden />}
            {total !== null
              ? tr({ en: `Create and fund · ${usdc(total)}`, pt: `Criar e financiar · ${usdc(total)}` })
              : tr({ en: "Create and fund", pt: "Criar e financiar" })}
          </Button>
        )}
        {step && (
          <ol className="space-y-2 border border-border bg-card p-4" aria-label={tr({ en: "Progress", pt: "Andamento" })}>
            {STEPS.map((s, i) => {
              const isFailed = failed?.step === s.key;
              const isDone = i < position || step === "done";
              const active = i === position && !isFailed && step !== "done";
              return (
                <li key={s.key} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5">
                    {isFailed ? <X size={16} className="text-alert" aria-hidden /> : isDone ? <Check size={16} className="text-positive" aria-hidden />
                      : active ? <Loader2 size={16} className="animate-spin text-accent" aria-hidden /> : <CircleDashed size={16} className="text-muted-foreground" aria-hidden />}
                  </span>
                  <span className={isFailed ? "text-alert" : isDone || active ? "text-foreground" : "text-muted-foreground"}>
                    {tr(s.label)}
                    {isFailed && <span className="block text-xs">{failed!.message}</span>}
                    {s.key === "confirm" && signature && (
                      <a href={explorerTx(signature)} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 font-mono text-xs text-info hover:underline">
                        {signature.slice(0, 8)}…{signature.slice(-8)} <ExternalLink size={11} aria-hidden />
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {step === "done" && (
          <p role="status" className="border border-gold bg-card p-4 text-sm">
            {tr({
              en: "Your campaign is funded and recorded. EmpowerFI reviews it before it shows on this page and opens to entrepreneurs.",
              pt: "Sua campanha está financiada e registrada. A EmpowerFI revisa antes de ela aparecer nesta página e abrir para as empreendedoras.",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
