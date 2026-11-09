import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CircleDashed, ExternalLink, Loader2, Wallet, X } from "lucide-react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays, CAMPAIGN_DAYS, createCampaignData, fundCampaignData, HOUSE_SHARE_BPS, HOUSE_WALLET, MIN_PRICE_UNITS, MIN_SEATS,
  OPERATOR_WALLET, REWARDS_PROGRAM_ID, spDay, UNLOCK_DAYS, USDC_DECIMALS, USDC_DEVNET_MINT, uuidBytes,
} from "@empowerfi/campaign-vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { tr } from "../i18n";
import { describeError } from "../lib/errors";
import { explorerTx } from "../lib/platform";
import { CLUSTER, confirmSignature, FAUCETS, rpc, shortAddress, usdc } from "../lib/solana";
import ConnectWalletDialog from "../wallet/ConnectWallet";
import { useBalances } from "../wallet/useBalances";
import { diaryDb } from "../diary/db";
import { missions, priceUnits, units } from "./chain";
import { campaignProgress, day, groupCampaigns } from "./money";
import { DevnetNotice, SectionHeading } from "./ui";

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
const today = () => spDay(Math.floor(Date.now() / 1000));
/** The earliest first day whose 30 days still include today. */
const earliest = () => addDays(today(), -(CAMPAIGN_DAYS - 1));

const REGISTER_ERRORS: Record<string, { en: string; pt: string }> = {
  sponsor_name_taken: { en: "That sponsor name is already in use. Choose another.", pt: "Esse nome de patrocinador já está em uso. Escolha outro." },
  campaign_name_taken: { en: "That campaign name is already in use. Choose another.", pt: "Esse nome de campanha já está em uso. Escolha outro." },
  campaign_name_length: { en: "The campaign name needs 3 to 80 characters.", pt: "O nome da campanha precisa ter de 3 a 80 caracteres." },
  sponsor_name_length: { en: "The sponsor name needs 2 to 80 characters.", pt: "O nome do patrocinador precisa ter de 2 a 80 caracteres." },
  no_such_lead: { en: "That campaign is no longer published. Your vault is on chain: write to contato@empowerfi.io.", pt: "Essa campanha não está mais publicada. Seu cofre está na blockchain: escreva para contato@empowerfi.io." },
  lead_ended: { en: "That campaign has ended. Your vault is on chain: write to contato@empowerfi.io.", pt: "Essa campanha terminou. Seu cofre está na blockchain: escreva para contato@empowerfi.io." },
  dates_differ: { en: "The dates do not match the campaign's. Write to contato@empowerfi.io with the transaction link.", pt: "As datas não batem com as da campanha. Escreva para contato@empowerfi.io com o link da transação." },
  already_sponsoring: { en: "This wallet already sponsors that campaign.", pt: "Esta carteira já patrocina essa campanha." },
};

/** The published campaign a co-sponsor joins: its own vault, these days and this name. */
interface Lead { programId: string; name: string; starts: string; ends: string; sponsors: string[] }

interface Form { sponsor: string; name: string; starts: string; seats: string; price: string }
type Field = keyof Form;

/** The figures a form adds up to, or null where a field is not a number yet. */
function figures(form: Form) {
  const seats = Number(form.seats);
  const price = priceUnits(form.price);
  const total = price !== null && Number.isInteger(seats) && seats > 0 ? price * BigInt(seats) : null;
  const house = total !== null ? (total * BigInt(HOUSE_SHARE_BPS)) / 10_000n : null;
  const entrepreneurs = total !== null && house !== null ? total - house : null;
  return { seats, price, total, house, entrepreneurs, ends: addDays(form.starts, CAMPAIGN_DAYS - 1) };
}

/** What is wrong with each field, in the order a sponsor fills them in. */
function fieldErrors(form: Form, joining = false): Partial<Record<Field, string>> {
  const { seats, price } = figures(form);
  const e: Partial<Record<Field, string>> = {};
  if (form.sponsor.trim().length < 2) e.sponsor = tr({ en: "Write your organization's name (2 characters or more).", pt: "Escreva o nome da sua organização (2 caracteres ou mais)." });
  if (!joining && form.name.trim().length < 3) e.name = tr({ en: "Give the campaign a name (3 characters or more).", pt: "Dê um nome à campanha (3 caracteres ou mais)." });
  // Up to 29 days back, so the diary's history counts and the campaign still runs today.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.starts)) e.starts = tr({ en: "Pick a start date.", pt: "Escolha a data de início." });
  else if (form.starts < earliest()) e.starts = tr({ en: `The campaign can start at most ${CAMPAIGN_DAYS - 1} days ago.`, pt: `A campanha pode começar no máximo ${CAMPAIGN_DAYS - 1} dias atrás.` });
  if (!Number.isInteger(seats) || seats < MIN_SEATS) e.seats = tr({ en: `At least ${MIN_SEATS} entrepreneurs.`, pt: `No mínimo ${MIN_SEATS} empreendedoras.` });
  if (price === null || price < BigInt(MIN_PRICE_UNITS)) e.price = tr({ en: "At least 0.01 USDC per entrepreneur.", pt: "No mínimo 0,01 USDC por empreendedora." });
  return e;
}

const FIELDS: Field[] = ["sponsor", "name", "starts", "seats", "price"];

/**
 * "Sponsor a campaign", in three steps: configure it, review where the money
 * goes, then connect a wallet and sign. The connected wallet is the sponsor.
 * It signs one transaction that creates the campaign on chain and pays price
 * x seats into the campaign's own vault; campaign-register then reads the
 * chain back and records it, unlisted until EmpowerFI reviews the names it
 * was given.
 */
export default function SponsorPanel() {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<Form>({ sponsor: "", name: "", starts: addDays(today(), 1), seats: String(MIN_SEATS), price: "0,10" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [account] = useSelectedWalletAccount();
  const [connecting, setConnecting] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  // ?join=<lead program id>: co-sponsor a published campaign that is still running.
  const [params, setParams] = useSearchParams();
  const joinId = params.get("join");
  const list = useQuery({ queryKey: ["missions"], queryFn: missions.campaigns, enabled: Boolean(joinId) });
  const group = joinId ? groupCampaigns(list.data ?? []).find((g) => g.lead.program_id === joinId) : undefined;
  const lead: Lead | null = group && campaignProgress(group.lead).phase !== "ended"
    ? { programId: group.lead.program_id, name: group.lead.name, starts: group.lead.period_start.slice(0, 10),
        ends: group.lead.period_end.slice(0, 10), sponsors: group.vaults.map((v) => v.sponsor) }
    : null;
  const errors = fieldErrors(form, Boolean(lead));

  // Joining takes the campaign's days; leaving gives the form its own back.
  useEffect(() => {
    setForm((f) => (lead ? { ...f, starts: lead.starts } : { ...f, starts: f.starts === "" ? addDays(today(), 1) : f.starts }));
    setStage(1);
  }, [lead?.programId]); // eslint-disable-line react-hooks/exhaustive-deps
  const leave = () => {
    setParams((p) => { p.delete("join"); return p; }, { replace: true });
    setForm((f) => ({ ...f, starts: addDays(today(), 1) }));
  };

  const go = (to: 1 | 2 | 3) => {
    setStage(to);
    // Bring the step's top into view and give it the focus, for keyboards and screen readers.
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      top.current?.focus({ preventScroll: true });
    });
  };
  const next = () => {
    setTried(true);
    const first = FIELDS.find((f) => errors[f]);
    if (first) {
      document.getElementById(`sp-${first}`)?.focus();
      return;
    }
    go(2);
  };
  const reset = () => {
    setForm({ sponsor: "", name: "", starts: addDays(today(), 1), seats: String(MIN_SEATS), price: "0,10" });
    setTouched({});
    setTried(false);
    setParams((p) => { p.delete("join"); return p; }, { replace: true });
    go(1);
  };

  return (
    <section id="sponsor" aria-labelledby="sponsor-title" className="scroll-mt-20 space-y-8">
      <SectionHeading id="sponsor-title" eyebrow={tr({ en: "For sponsors", pt: "Para patrocinadores" })}
        title={tr({ en: "Sponsor a campaign", pt: "Patrocine uma campanha" })}
        lead={tr({
          en: "Three steps, about two minutes. Your wallet becomes the sponsor, and one transaction creates the campaign and funds its vault. You can also join a running campaign as a co-sponsor.",
          pt: "Três passos, cerca de dois minutos. A sua carteira passa a ser a patrocinadora, e uma transação cria a campanha e financia o cofre. Você também pode entrar numa campanha em andamento como copatrocinador.",
        })} />

      {joinId && !lead && !list.isLoading && (
        <p role="status" className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          {tr({ en: "That campaign is not open to co-sponsors any more. You can sponsor a new one below.", pt: "Essa campanha não aceita mais copatrocinadores. Você pode patrocinar uma nova abaixo." })}{" "}
          <button type="button" className="font-medium text-foreground underline" onClick={leave}>{tr({ en: "Start a new campaign", pt: "Criar uma nova campanha" })}</button>
        </p>
      )}
      {lead && (
        <div role="status" className="flex flex-col gap-3 rounded-md border-2 border-gold bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">{tr({ en: `Co-sponsoring "${lead.name}"`, pt: `Copatrocinando "${lead.name}"` })}</p>
            <p className="text-muted-foreground">
              {day(lead.starts)} – {day(lead.ends)} · {tr({ en: "with", pt: "com" })} {lead.sponsors.join(", ")}
            </p>
          </div>
          <button type="button" onClick={leave} disabled={stage === 3}
            className="min-h-10 shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">
            {tr({ en: "Start a new campaign instead", pt: "Criar uma campanha nova" })}
          </button>
        </div>
      )}

      <div ref={top} tabIndex={-1} className="scroll-mt-24 rounded-lg border border-border bg-card outline-none">
        <Stepper stage={stage} />
        <div className="p-5 sm:p-7">
          {stage === 1 && (
            <Configure form={form} setForm={setForm} errors={errors} lead={lead}
              show={(f) => Boolean(tried || touched[f])} touch={(f) => setTouched((t) => ({ ...t, [f]: true }))} onNext={next} />
          )}
          {stage === 2 && <Review form={form} lead={lead} account={account ?? null} onBack={() => go(1)} onNext={() => go(3)} />}
          {stage === 3 && (account
            ? <Fund account={account} form={form} lead={lead} onBack={() => go(2)} onAgain={reset} />
            : (
              <div className="space-y-5">
                <h3 className="font-heading text-xl">{tr({ en: "Connect your wallet", pt: "Conecte a sua carteira" })}</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  {tr({
                    en: "Use a Solana wallet set to Devnet, such as Phantom or Solflare. It signs the transaction and is recorded as the campaign's sponsor.",
                    pt: "Use uma carteira Solana configurada na Devnet, como Phantom ou Solflare. Ela assina a transação e fica registrada como patrocinadora da campanha.",
                  })}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" className="h-11 gap-2" onClick={() => go(2)}><ArrowLeft aria-hidden /> {tr({ en: "Back", pt: "Voltar" })}</Button>
                  <Button className="h-11 gap-2" onClick={() => setConnecting(true)}><Wallet aria-hidden /> {tr({ en: "Connect wallet", pt: "Conectar carteira" })}</Button>
                </div>
              </div>
            ))}
        </div>
      </div>
      <ConnectWalletDialog open={connecting} onOpenChange={setConnecting} onConnected={() => setConnecting(false)} />
    </section>
  );
}

const STAGES = [
  { en: "Configure", pt: "Configurar" },
  { en: "Review funding", pt: "Revisar valores" },
  { en: "Sign and fund", pt: "Assinar e financiar" },
];

function Stepper({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <ol className="grid grid-cols-3 border-b border-border" aria-label={tr({ en: "Steps", pt: "Passos" })}>
      {STAGES.map((s, i) => {
        const n = i + 1;
        const state = n < stage ? "done" : n === stage ? "current" : "next";
        return (
          <li key={s.en} aria-current={state === "current" ? "step" : undefined}
            className={cn("flex flex-col items-center gap-1.5 px-2 py-3 text-center text-xs sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
              state === "current" ? "border-b-2 border-gold font-medium text-foreground" : "text-muted-foreground")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
              state === "done" ? "border-positive bg-positive text-background" : state === "current" ? "border-gold text-foreground" : "border-border")}>
              {state === "done" ? <Check size={12} aria-hidden /> : n}
            </span>
            <span>{tr(s)}{state === "done" && <span className="sr-only"> ({tr({ en: "done", pt: "concluído" })})</span>}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Configure({ form, setForm, errors, lead, show, touch, onNext }: {
  form: Form; setForm: (f: Form) => void; errors: Partial<Record<Field, string>>; lead: Lead | null;
  show: (f: Field) => boolean; touch: (f: Field) => void; onNext: () => void;
}) {
  const { total, ends } = figures(form);
  const field = "h-11 text-base";
  const bind = (k: Field) => ({
    id: `sp-${k}`,
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
    onBlur: () => touch(k),
    "aria-invalid": show(k) && Boolean(errors[k]) ? true : undefined,
    "aria-describedby": `sp-${k}-help`,
    className: cn(field, show(k) && errors[k] && "border-alert"),
  });
  const help = (k: Field, hint?: string) => (
    <p id={`sp-${k}-help`} className={cn("text-xs", show(k) && errors[k] ? "text-alert" : "text-muted-foreground")}>
      {show(k) && errors[k] ? errors[k] : hint}
    </p>
  );

  return (
    <form noValidate className="space-y-6" onSubmit={(e) => { e.preventDefault(); onNext(); }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-sponsor">{tr({ en: "Sponsor organization", pt: "Organização patrocinadora" })}</Label>
          <Input {...bind("sponsor")} maxLength={80} autoComplete="organization" placeholder={tr({ en: "e.g. Rede Institute", pt: "ex.: Instituto Rede" })} />
          {help("sponsor", tr({ en: "Shown on the campaign once EmpowerFI publishes it.", pt: "Aparece na campanha depois que a EmpowerFI publicar." }))}
        </div>
        {!lead && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sp-name">{tr({ en: "Campaign name", pt: "Nome da campanha" })}</Label>
          <Input {...bind("name")} maxLength={80} autoComplete="off" placeholder={tr({ en: "e.g. 30 days of good habits", pt: "ex.: 30 dias de bons hábitos" })} />
          {help("name")}
        </div>
        )}
        {lead ? (
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium">{tr({ en: "Dates", pt: "Datas" })}</p>
          <p className="flex h-11 items-center rounded-md border border-border bg-muted/40 px-3 text-base">{day(lead.starts)} – {day(lead.ends)}</p>
          <p className="text-xs text-muted-foreground">{tr({ en: "The campaign's own days. The days entrepreneurs already recorded count.", pt: "Os dias da própria campanha. Os dias que as empreendedoras já registraram contam." })}</p>
        </div>
        ) : (
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="sp-starts">{tr({ en: "Start date", pt: "Data de início" })}</Label>
          <Input {...bind("starts")} type="date" min={earliest()} />
          {help("starts", /^\d{4}-\d{2}-\d{2}$/.test(form.starts)
            ? tr({ en: `${CAMPAIGN_DAYS} days, until ${day(ends)}. It can start up to ${CAMPAIGN_DAYS - 1} days ago, so recent diary days count.`, pt: `${CAMPAIGN_DAYS} dias, até ${day(ends)}. Pode começar até ${CAMPAIGN_DAYS - 1} dias atrás, para os dias recentes do diário contarem.` })
            : undefined)}
        </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-1">
          <div className="space-y-1.5">
            <Label htmlFor="sp-seats">{tr({ en: "Entrepreneurs", pt: "Empreendedoras" })}</Label>
            <Input {...bind("seats")} type="number" inputMode="numeric" min={MIN_SEATS} step={1} />
            {help("seats", tr({ en: `Minimum ${MIN_SEATS}`, pt: `Mínimo ${MIN_SEATS}` }))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-price">{tr({ en: "USDC per entrepreneur", pt: "USDC por empreendedora" })}</Label>
            <Input {...bind("price")} inputMode="decimal" autoComplete="off" />
            {help("price", tr({ en: "Minimum 0.01", pt: "Mínimo 0,01" }))}
          </div>
        </div>
      </div>


      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total !== null ? <>{tr({ en: "Total", pt: "Total" })}: <span className="font-medium tabular-nums text-foreground">{usdc(total)}</span></> : null}
        </p>
        <Button type="submit" className="h-11 gap-2">{tr({ en: "Review funding", pt: "Revisar valores" })} <ArrowRight aria-hidden /></Button>
      </div>
    </form>
  );
}

function Review({ form, lead, account, onBack, onNext }: { form: Form; lead: Lead | null; account: UiWalletAccount | null; onBack: () => void; onNext: () => void }) {
  const { seats, price, total, house, entrepreneurs, ends } = figures(form);
  const balances = useBalances(account?.address);
  const short = balances.data && total !== null && BigInt(balances.data.microUsdc) < total;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{form.sponsor.trim()}</p>
        <h3 className="font-heading text-xl">{lead ? lead.name : form.name.trim()}</h3>
        <p className="text-sm text-muted-foreground">{day(form.starts)} – {day(ends)} · {tr({ en: "Impact Marketing", pt: "Marketing de Impacto" })}</p>
        {lead && (
          <p className="text-sm">
            {tr({
              en: `As a co-sponsor, with ${lead.sponsors.join(", ")}. Your money goes into your own vault; entrepreneurs who complete the campaign receive your reward on top of the others'.`,
              pt: `Como copatrocinador, com ${lead.sponsors.join(", ")}. Seu dinheiro vai para um cofre só seu; quem concluir a campanha recebe a sua recompensa somada às dos outros.`,
            })}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
        {[
          { k: tr({ en: "Total campaign cost", pt: "Custo total da campanha" }), v: usdc(total), strong: true },
          { k: `${HOUSE_SHARE_BPS / 100}% EmpowerFI`, v: usdc(house) },
          { k: tr({ en: `${100 - HOUSE_SHARE_BPS / 100}% Entrepreneur rewards`, pt: `${100 - HOUSE_SHARE_BPS / 100}% Recompensas das empreendedoras` }), v: usdc(entrepreneurs) },
        ].map((x) => (
          <div key={x.k} className="bg-background p-4">
            <dt className="text-xs text-muted-foreground">{x.k}</dt>
            <dd className={cn("mt-1 font-heading tabular-nums", x.strong ? "text-2xl" : "text-xl")}>{x.v}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 text-xs text-muted-foreground">
        {tr({ en: `${usdc(price)} × ${seats} entrepreneurs.`, pt: `${usdc(price)} × ${seats} empreendedoras.` })}{" "}
        {entrepreneurs !== null && tr({
          en: `Each entrepreneur who completes the campaign earns ${`${units(entrepreneurs / BigInt(seats), USDC_DECIMALS)} USDC`}.`,
          pt: `Cada empreendedora que concluir a campanha recebe ${`${units(entrepreneurs / BigInt(seats), USDC_DECIMALS)} USDC`}.`,
        })}
      </p>

      <dl className="divide-y divide-border rounded-md border border-border text-sm">
        <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">{tr({ en: "Who takes part", pt: "Quem participa" })}</dt>
          <dd className="text-muted-foreground">{tr({ en: "Every EmpowerFI diary entrepreneur who agreed to share her impact figures.", pt: "Toda empreendedora do diário EmpowerFI que autorizou compartilhar os números de impacto." })}</dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">{tr({ en: "Eligibility", pt: "Condição" })}</dt>
          <dd className="text-muted-foreground">{tr({ en: `${UNLOCK_DAYS} days recorded in the diary during the campaign.`, pt: `${UNLOCK_DAYS} dias registrados no diário durante a campanha.` })}</dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">{tr({ en: "Unclaimed rewards", pt: "Recompensas não conquistadas" })}</dt>
          <dd className="text-muted-foreground">{tr({ en: "Go to EmpowerFI. Nothing returns to the sponsor in Impact Marketing.", pt: "Vão para a EmpowerFI. No Marketing de Impacto, nada volta ao patrocinador." })}</dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">{tr({ en: "Before it is public", pt: "Antes de ficar pública" })}</dt>
          <dd className="text-muted-foreground">{tr({ en: "EmpowerFI reviews the names you gave, then publishes the campaign on this page.", pt: "A EmpowerFI revisa os nomes informados e depois publica a campanha nesta página." })}</dd>
        </div>
        <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr]">
          <dt className="font-medium">{tr({ en: "Your wallet", pt: "Sua carteira" })}</dt>
          <dd className="text-muted-foreground">
            {!account ? tr({
              en: `You connect it in the next step. It needs ${usdc(total)} in test USDC and a little test SOL for the fee.`,
              pt: `Você conecta no próximo passo. Ela precisa de ${usdc(total)} em USDC de teste e um pouco de SOL de teste para a taxa.`,
            }) : balances.data ? (
              <span className={short ? "text-alert" : undefined}>
                {shortAddress(account.address)} · {usdc(balances.data.microUsdc)}{" "}
                {short ? tr({ en: "— not enough for this campaign.", pt: "— não é suficiente para esta campanha." }) : tr({ en: "— enough for this campaign.", pt: "— suficiente para esta campanha." })}
              </span>
            ) : tr({ en: "Reading the balance…", pt: "Lendo o saldo…" })}
            {short && <Faucets />}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button variant="outline" className="h-11 gap-2" onClick={onBack}><ArrowLeft aria-hidden /> {tr({ en: "Edit", pt: "Editar" })}</Button>
        <Button className="h-11 gap-2" onClick={onNext}>{tr({ en: "Continue to sign", pt: "Continuar para assinar" })} <ArrowRight aria-hidden /></Button>
      </div>
    </div>
  );
}

function Faucets() {
  return (
    <span className="mt-2 flex flex-wrap gap-4">
      <a href={FAUCETS.usdc} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
        {tr({ en: "Get test USDC", pt: "Obter USDC de teste" })} <ExternalLink size={12} aria-hidden />
      </a>
      <a href={FAUCETS.sol} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
        {tr({ en: "Get test SOL", pt: "Obter SOL de teste" })} <ExternalLink size={12} aria-hidden />
      </a>
    </span>
  );
}

type Step = "sign" | "confirm" | "record" | "done";
const STEPS: { key: Step; label: { en: string; pt: string } }[] = [
  { key: "sign", label: { en: "Sign in your wallet", pt: "Assinar na sua carteira" } },
  { key: "confirm", label: { en: "Confirmed on Solana", pt: "Confirmada na Solana" } },
  { key: "record", label: { en: "Checked and recorded by EmpowerFI", pt: "Conferida e registrada pela EmpowerFI" } },
];

function Fund({ account, form, lead, onBack, onAgain }: { account: UiWalletAccount; form: Form; lead: Lead | null; onBack: () => void; onAgain: () => void }) {
  const [, setAccount] = useSelectedWalletAccount();
  const signer = useWalletAccountTransactionSendingSigner(account, CLUSTER);
  const balances = useBalances(account.address);
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step | null>(null);
  const [failed, setFailed] = useState<{ step: Step; message: string } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const { seats, price, total, ends } = figures(form);
  const invalid = Object.keys(fieldErrors(form, Boolean(lead))).length > 0
    // A co-sponsorship carries the campaign's own days, or campaign_register refuses it.
    || (lead !== null && (form.starts !== lead.starts || ends !== lead.ends));
  const shortUsdc = balances.data && total !== null && BigInt(balances.data.microUsdc) < total;
  const noSol = balances.data && balances.data.lamports === 0n;
  const blocked =
    invalid ? tr({ en: "Go back and complete the campaign's details.", pt: "Volte e complete os dados da campanha." })
    : balances.isLoading ? tr({ en: "Reading your wallet's balance…", pt: "Lendo o saldo da sua carteira…" })
    : shortUsdc ? tr({ en: `This wallet needs ${usdc(total)} in test USDC.`, pt: `Esta carteira precisa de ${usdc(total)} em USDC de teste.` })
    : noSol ? tr({ en: "This wallet needs a little test SOL to pay the network fee.", pt: "Esta carteira precisa de um pouco de SOL de teste para pagar a taxa da rede." })
    : null;

  const sponsor = async () => {
    if (blocked || total === null || price === null) return;
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
        body: { signature: sent, program_id: id, name: lead ? lead.name : form.name.trim(), sponsor_name: form.sponsor.trim(), joins: lead?.programId ?? null },
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
  // Once the transaction is sent, signing again would create a second campaign.
  const sentAlready = signature !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <Wallet size={16} className="text-accent" aria-hidden />
          <span className="font-mono">{shortAddress(account.address)}</span>
          <span className="text-muted-foreground">{balances.data ? usdc(balances.data.microUsdc) : "…"}</span>
        </span>
        {!busy && step !== "done" && (
          <button type="button" className="min-h-10 text-muted-foreground underline-offset-4 hover:underline" onClick={() => setAccount(undefined)}>
            {tr({ en: "Change wallet", pt: "Trocar carteira" })}
          </button>
        )}
      </div>

      {step !== "done" && (
        <div className="space-y-3">
          <h3 className="font-heading text-xl">{tr({ en: "Review the transaction", pt: "Revise a transação" })}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {tr({
              en: lead
                ? `Your wallet will ask you to sign one transaction. It creates your vault for "${lead.name}" on Solana, with the campaign's days, and moves ${usdc(total)} in test USDC from this wallet into it. A small test-SOL network fee applies.`
                : `Your wallet will ask you to sign one transaction. It creates "${form.name.trim()}" on Solana and moves ${usdc(total)} in test USDC from this wallet into the campaign's vault. A small test-SOL network fee applies.`,
              pt: lead
                ? `Sua carteira vai pedir para assinar uma transação. Ela cria o seu cofre para "${lead.name}" na Solana, com os dias da campanha, e move ${usdc(total)} em USDC de teste desta carteira para ele. Há uma pequena taxa de rede em SOL de teste.`
                : `Sua carteira vai pedir para assinar uma transação. Ela cria "${form.name.trim()}" na Solana e move ${usdc(total)} em USDC de teste desta carteira para o cofre da campanha. Há uma pequena taxa de rede em SOL de teste.`,
            })}
          </p>
        </div>
      )}

      {step && (
        <ol className="space-y-2.5 rounded-md border border-border bg-background p-4" aria-label={tr({ en: "Progress", pt: "Andamento" })} aria-live="polite">
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
                  {isFailed && <span role="alert" className="block text-xs">{failed!.message}</span>}
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

      {step === "done" ? (
        <div role="status" className="space-y-3 rounded-md border border-gold bg-background p-5">
          <p className="flex items-center gap-2 font-heading text-lg"><Check size={18} className="text-positive" aria-hidden /> {lead ? tr({ en: "Your co-sponsorship is funded", pt: "Seu copatrocínio está financiado" }) : tr({ en: "Your campaign is funded", pt: "Sua campanha está financiada" })}</p>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "It is recorded on Solana and with EmpowerFI. EmpowerFI reviews it before it appears on this page.",
              pt: "Ela está registrada na Solana e na EmpowerFI. A EmpowerFI revisa antes de ela aparecer nesta página.",
            })}
          </p>
          <Button variant="outline" className="h-11" onClick={onAgain}>{tr({ en: "Sponsor another campaign", pt: "Patrocinar outra campanha" })}</Button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-border pt-5">
          {blocked && !busy && (
            <div id="sp-blocked" className="text-sm text-muted-foreground">
              <p>{blocked}</p>
              {(shortUsdc || noSol) && <Faucets />}
            </div>
          )}
          {sentAlready && failed && failed.step !== "sign" && (
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "The transaction was already sent, so signing again would create a second campaign. Follow it on Explorer, or write to contato@empowerfi.io.",
                pt: "A transação já foi enviada, então assinar de novo criaria uma segunda campanha. Acompanhe no Explorer ou escreva para contato@empowerfi.io.",
              })}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" className="h-11 gap-2" disabled={busy || sentAlready} onClick={onBack}><ArrowLeft aria-hidden /> {tr({ en: "Back", pt: "Voltar" })}</Button>
            <Button className="h-11 gap-2" disabled={Boolean(blocked) || busy || sentAlready} aria-describedby={blocked ? "sp-blocked" : undefined} onClick={() => void sponsor()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Wallet aria-hidden />}
              {busy ? tr({ en: "Working…", pt: "Processando…" })
                : failed?.step === "sign" ? tr({ en: `Try again · ${usdc(total)}`, pt: `Tentar de novo · ${usdc(total)}` })
                : tr({ en: `Sign and fund · ${usdc(total)}`, pt: `Assinar e financiar · ${usdc(total)}` })}
            </Button>
          </div>
        </div>
      )}
      <DevnetNotice />
    </div>
  );
}
