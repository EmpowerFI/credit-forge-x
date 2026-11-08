import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, CircleAlert, Loader2, Lock, Users, Wallet } from "lucide-react";
import { formatDate, tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import ExplorerLink from "../components/product/ExplorerLink";
import NetworkBadge from "../components/product/NetworkBadge";
import { diaryClosed } from "../diary/db";
import SponsorPanel from "./SponsorPanel";
import { checks, missions, type PublicCampaign, readOnChain, units } from "./chain";

/** A calendar day (YYYY-MM-DD) as a date, read at noon so no time zone moves it. */
const day = (d: string) => formatDate(`${d.slice(0, 10)}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" });

/**
 * /app/missions -- EmpowerFI Missions, inside the platform and open without a
 * sign-in: each campaign a sponsor paid into a vault on Solana devnet, read
 * from the app's real database (not the showroom's) and checked against the
 * chain's own account. Counts show only from five women up, and nothing on
 * this page names one. The platform's locale provider redraws it on a switch.
 */
export default function MissionsPage() {
  useLayoutEffect(() => {
    document.title = "EmpowerFI Missions";
  }, []);
  return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
            <Link to="/app" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
            <div className="flex items-center gap-2">
              <LanguageSwitch />
              <NetworkBadge />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
          <div>
            <header className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">EmpowerFI Missions</p>
              <h1 className="font-heading text-4xl leading-tight sm:text-5xl">
                {tr({ en: "Engagement", pt: "Engajamento" })}{" "}
                <em className="text-accent">{tr({ en: "That Rewards", pt: "que recompensa" })}</em>
              </h1>
              <p className="text-muted-foreground">
                {tr({
                  en: "30-day campaigns · 100+ entrepreneurs · Programmable rewards",
                  pt: "Campanhas de 30 dias · 100+ empreendedoras · Recompensas programáveis",
                })}
              </p>
              {!diaryClosed && (
                <a href="#sponsor" className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-accent underline-offset-4 hover:underline">
                  {tr({ en: "Sponsor a campaign with your wallet", pt: "Patrocine uma campanha com a sua carteira" })} →
                </a>
              )}
            </header>
          </div>
          {diaryClosed ? (
            <p className="mt-12 text-muted-foreground">{tr({ en: "Missions are not open here yet.", pt: "As missões ainda não estão abertas aqui." })}</p>
          ) : (
            <>
              <Campaigns />
              <div className="mt-16"><SponsorPanel /></div>
            </>
          )}
          <Models />
          <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            {tr({
              en: "Solana devnet: test tokens with no value. Every diary entrepreneur who shares her impact figures takes part, and the figures are her real days in the diary, counted only from five entrepreneurs up. Each one has a reward wallet: an address of the program, with no private key, that nothing here links to her. Rewards will move from it to a wallet of her choice later.",
              pt: "Solana devnet: tokens de teste, sem valor. Toda empreendedora do diário que autoriza os números de impacto participa, e os números são os dias reais dela no diário, contados só a partir de cinco empreendedoras. Cada uma tem uma carteira de recompensas: um endereço do programa, sem chave privada, que nada aqui liga a ela. Mais tarde, as recompensas passam dela para uma carteira que ela escolher.",
            })}
          </p>
        </div>
      </div>
  );
}

function Campaigns() {
  const list = useQuery({ queryKey: ["missions"], queryFn: missions.campaigns, refetchInterval: 60_000 });
  if (list.isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
      </div>
    );
  }
  if (list.error) {
    return (
      <p role="alert" className="mt-12 text-muted-foreground">
        {tr({ en: "The campaigns could not be read just now.", pt: "Não foi possível ler as campanhas agora." })}{" "}
        <button type="button" className="font-medium text-foreground underline" onClick={() => void list.refetch()}>
          {tr({ en: "Try again", pt: "Tentar de novo" })}
        </button>
      </p>
    );
  }
  if (!list.data?.length) {
    return (
      <p className="mt-12 text-muted-foreground">
        {tr({ en: "No campaign is published yet. Sponsor the first one below.", pt: "Nenhuma campanha publicada ainda. Patrocine a primeira logo abaixo." })}
      </p>
    );
  }
  return (
    <>
      <Totals list={list.data} />
      <div className="mt-12 space-y-16">{list.data.map((c) => <Campaign key={c.program_id} c={c} />)}</div>
    </>
  );
}

/** Across the published campaigns: what sponsors put in the vaults, and what reached the entrepreneurs. */
function Totals({ list }: { list: PublicCampaign[] }) {
  const d = list[0]?.mint_decimals ?? 6;
  const funded = list.reduce((n, c) => n + BigInt(c.chain.funded_units), 0n);
  const paid = list.reduce((n, c) => n + BigInt(c.paid.units), 0n);
  const rewards = list.reduce((n, c) => n + c.paid.count, 0);
  return (
    <dl className="mt-10 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
      {[
        { k: tr({ en: "Sent to the vaults", pt: "Enviado aos cofres" }), v: `${units(funded, d)} USDC` },
        { k: tr({ en: "Campaigns", pt: "Campanhas" }), v: String(list.length) },
        { k: tr({ en: "Rewards paid", pt: "Recompensas pagas" }), v: `${units(paid, d)} USDC · ${rewards}` },
      ].map((x) => (
        <div key={x.k} className="bg-card px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{x.k}</dt>
          <dd className="mt-1 font-heading text-2xl tabular-nums">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Campaign({ c }: { c: PublicCampaign }) {
  const chain = useQuery({ queryKey: ["missions", "chain", c.chain.campaign], queryFn: () => readOnChain(c), refetchInterval: 60_000 });
  const d = c.mint_decimals;
  const funded = BigInt(c.chain.funded_units);
  const house = (funded * BigInt(c.house_share_bps)) / 10_000n;
  const entrepreneurs = funded - house;
  const perSeat = entrepreneurs / BigInt(c.seats);
  const vaultUnits = chain.data?.vaultUnits ?? funded;

  return (
    <article className="space-y-10" aria-labelledby={`c-${c.program_id}`}>
      {/* Sponsor -> vault -> split, as the model reads. */}
      <ol className="relative grid gap-10 sm:grid-cols-3 sm:gap-6">
        <span aria-hidden className="absolute left-[16.6%] right-[16.6%] top-7 hidden h-px bg-gold sm:block" />
        <Node icon={<Building2 size={22} aria-hidden />} title={tr({ en: "Sponsor", pt: "Patrocinador" })}>
          <p className="font-heading text-lg">{c.sponsor}</p>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: `${units(c.price_per_seat_units, d)} USDC per entrepreneur · ${c.seats} seats`,
              pt: `${units(c.price_per_seat_units, d)} USDC por empreendedora · ${c.seats} vagas`,
            })}
          </p>
          <ExplorerLink address={c.chain.sponsor_wallet} />
        </Node>
        <Node filled icon={<Lock size={22} aria-hidden />} title={tr({ en: "Solana Campaign Vault", pt: "Cofre da campanha na Solana" })}>
          <span className="inline-block border border-gold px-2 py-0.5 text-xs uppercase tracking-wide text-accent">
            {tr({ en: "Live now (devnet)", pt: "No ar (devnet)" })}
          </span>
          <p className="font-heading text-2xl tabular-nums">{units(vaultUnits, d)} USDC</p>
          <ExplorerLink address={c.chain.vault} label={tr({ en: "vault on Explorer", pt: "cofre no Explorer" })} />
        </Node>
        <Node icon={<Users size={22} aria-hidden />} title={<>50% EmpowerFI<br />{tr({ en: "50% Entrepreneurs", pt: "50% Empreendedoras" })}</>}>
          <p className="text-sm tabular-nums">
            {units(house, d)} USDC · {units(entrepreneurs, d)} USDC
          </p>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: `${units(perSeat, d)} USDC for each entrepreneur after ${c.unlock_days} days`,
              pt: `${units(perSeat, d)} USDC para cada empreendedora depois de ${c.unlock_days} dias`,
            })}
          </p>
        </Node>
      </ol>

      <div className="grid gap-10 border-t border-border pt-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {tr({ en: "Impact campaign", pt: "Campanha de impacto" })}
            </p>
            <h2 id={`c-${c.program_id}`} className="font-heading text-2xl">{c.name}</h2>
            <p className="text-sm text-muted-foreground">
              {day(c.period_start)} – {day(c.period_end)} · <DayOf c={c} />
            </p>
          </div>
          <Participation c={c} />
          <OnChain c={c} state={chain} />
        </section>
        <Proofs c={c} />
      </div>
    </article>
  );
}

function Node({ icon, title, filled, children }: { icon: React.ReactNode; title: React.ReactNode; filled?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative flex flex-col items-center gap-2 text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full border ${
        filled ? "border-accent bg-accent text-background" : "border-gold bg-background text-accent"}`}>
        {icon}
      </span>
      <p className="font-heading text-xl leading-snug">{title}</p>
      {children}
    </li>
  );
}

function DayOf({ c }: { c: PublicCampaign }) {
  const day = Math.floor((Date.now() - Date.parse(`${c.period_start}T03:00:00Z`)) / 86_400_000) + 1;
  const total = Math.round((Date.parse(`${c.period_end}T03:00:00Z`) - Date.parse(`${c.period_start}T03:00:00Z`)) / 86_400_000) + 1;
  if (day < 1) return <>{tr({ en: "starts soon", pt: "começa em breve" })}</>;
  if (day > total) return <>{tr({ en: "ended", pt: "encerrada" })}</>;
  return <>{tr({ en: `day ${day} of ${total}`, pt: `dia ${day} de ${total}` })}</>;
}

function Participation({ c }: { c: PublicCampaign }) {
  if (c.enrolled === null) {
    return (
      <div className="border border-border bg-card p-4 text-sm">
        <p className="font-medium">{tr({ en: "Waiting for participants", pt: "Aguardando participantes" })}</p>
        <p className="mt-1 text-muted-foreground">
          {tr({
            en: `Counts, and the proof of who kept the ${c.unlock_days} days, start at ${c.min_group} entrepreneurs, so no one is ever singled out.`,
            pt: `Os números, e a prova de quem cumpriu os ${c.unlock_days} dias, começam com ${c.min_group} empreendedoras, para que ninguém seja identificada.`,
          })}
        </p>
      </div>
    );
  }
  const avg = c.avg_days === null ? "—" : new Intl.NumberFormat(tr({ en: "en-GB", pt: "pt-BR" }), { maximumFractionDigits: 1 }).format(c.avg_days);
  return (
    <dl className="grid grid-cols-2 gap-px border border-border bg-border text-center sm:grid-cols-5">
      {[
        { k: tr({ en: "Taking part", pt: "Participantes" }), v: String(c.enrolled) },
        { k: tr({ en: "Active", pt: "Em atividade" }), v: String(c.active) },
        { k: tr({ en: `Completed ${c.unlock_days} days`, pt: `Completaram ${c.unlock_days} dias` }), v: String(c.engaged) },
        { k: tr({ en: "Mean days kept", pt: "Média de dias" }), v: avg },
        { k: tr({ en: "Paid", pt: "Pago" }), v: `${units(c.paid.units, c.mint_decimals)} USDC` },
      ].map((x) => (
        <div key={x.k} className="bg-card p-3">
          <dt className="text-xs text-muted-foreground">{x.k}</dt>
          <dd className="mt-1 font-heading text-xl tabular-nums">{x.v}</dd>
        </div>
      ))}
    </dl>
  );
}

const CHECK_LABELS = {
  ref: { en: "The account is this campaign's", pt: "A conta é desta campanha" },
  terms: { en: "Terms match the published commitment", pt: "Os termos batem com o compromisso publicado" },
  seats: { en: "Seats and price per entrepreneur", pt: "Vagas e preço por empreendedora" },
  split: { en: "50/50 split and 30 days to unlock", pt: "Divisão 50/50 e 30 dias para desbloquear" },
  funded: { en: "Funded in full; the vault holds it, less the rewards paid", pt: "Financiada por inteiro; o cofre guarda o valor, menos as recompensas pagas" },
  house: { en: "EmpowerFI's half is still in the vault", pt: "A metade da EmpowerFI segue no cofre" },
  proof: { en: "Latest engagement proof", pt: "Última prova de engajamento" },
} as const;

function OnChain({ c, state }: { c: PublicCampaign; state: ReturnType<typeof useQuery<Awaited<ReturnType<typeof readOnChain>>>> }) {
  return (
    <section aria-labelledby={`v-${c.program_id}`} className="space-y-2">
      <h3 id={`v-${c.program_id}`} className="text-sm font-semibold">
        {tr({ en: "Checked on Solana, now", pt: "Conferido na Solana, agora" })}
      </h3>
      {state.isLoading && <p className="text-sm text-muted-foreground">{tr({ en: "Reading the chain…", pt: "Lendo a blockchain…" })}</p>}
      {state.error && (
        <p className="text-sm text-muted-foreground">
          {tr({ en: "Devnet did not answer; the figures above are the database's.", pt: "A devnet não respondeu; os números acima são os do banco." })}
        </p>
      )}
      {state.data && (
        <ul className="space-y-1.5 text-sm">
          {checks(c, state.data.account, state.data.vaultUnits).map((x) => (
            <li key={x.key} className="flex items-center gap-2">
              {x.ok
                ? <CheckCircle2 size={16} className="shrink-0 text-positive" aria-label={tr({ en: "matches", pt: "confere" })} />
                : <CircleAlert size={16} className="shrink-0 text-alert" aria-label={tr({ en: "does not match", pt: "não confere" })} />}
              {tr(CHECK_LABELS[x.key])}
            </li>
          ))}
        </ul>
      )}
      <p className="pt-1 text-xs text-muted-foreground">
        {tr({ en: "Campaign account", pt: "Conta da campanha" })}: <ExplorerLink address={c.chain.campaign} />
        {" · "}{tr({ en: "Program", pt: "Programa" })}: <ExplorerLink address={c.chain.program} />
      </p>
    </section>
  );
}

function Proofs({ c }: { c: PublicCampaign }) {
  return (
    <section aria-labelledby={`p-${c.program_id}`} className="space-y-3">
      <h3 id={`p-${c.program_id}`} className="text-sm font-semibold">{tr({ en: "On-chain record", pt: "Registro na blockchain" })}</h3>
      <ol className="space-y-3 border-l border-gold pl-4 text-sm">
        {c.payments.map((p) => (
          <li key={p.signature}>
            <p className="flex items-center gap-1.5">
              <Wallet size={14} className="shrink-0 text-accent" aria-hidden />
              {p.block_time && <>{day(p.block_time)} · </>}
              {tr({
                en: `Reward paid: ${units(p.amount_units, c.mint_decimals)} USDC`,
                pt: `Recompensa paga: ${units(p.amount_units, c.mint_decimals)} USDC`,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Reward wallet", pt: "Carteira de recompensas" })} <ExplorerLink address={p.recipient} /> · <ExplorerLink tx={p.signature} />
            </p>
          </li>
        ))}
        {c.attestations.map((a) => (
          <li key={a.as_of}>
            <p>
              {day(a.as_of)} · {tr({
                en: `${a.engaged} of ${a.enrolled} kept ${c.unlock_days} days`,
                pt: `${a.engaged} de ${a.enrolled} cumpriram ${c.unlock_days} dias`,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Merkle root", pt: "Raiz Merkle" })} <span className="font-mono">{a.root.slice(0, 10)}…</span> · <ExplorerLink tx={a.signature} />
            </p>
          </li>
        ))}
        <li>
          <p>
            {formatDate(c.chain.funded_at, { day: "numeric", month: "short", year: "numeric" })} · {tr({
              en: `Created and funded: ${units(c.chain.funded_units, c.mint_decimals)} USDC`,
              pt: `Criada e financiada: ${units(c.chain.funded_units, c.mint_decimals)} USDC`,
            })}
          </p>
          <p className="text-xs text-muted-foreground"><ExplorerLink tx={c.chain.funded_signature} /></p>
        </li>
      </ol>
      {c.attestations.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {tr({
            en: "The diary writes a proof here once a day, from the campaign's fifth entrepreneur on.",
            pt: "O diário grava uma prova aqui uma vez por dia, a partir da quinta empreendedora da campanha.",
          })}
        </p>
      )}
    </section>
  );
}

/** The two kinds of campaign, as the model sets them. */
function Models() {
  return (
    <div className="mt-16 grid gap-8 border-t border-border pt-8 sm:grid-cols-2 sm:gap-0">
      <section className="space-y-1.5 sm:pr-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{tr({ en: "Impact marketing", pt: "Marketing de impacto" })}</p>
        <p className="font-heading text-xl">{tr({ en: "Rewards unlock after 30 days of engagement.", pt: "As recompensas desbloqueiam depois de 30 dias de engajamento." })}</p>
        <p className="text-sm text-muted-foreground">{tr({ en: "Unclaimed rewards → EmpowerFI", pt: "Recompensas não resgatadas → EmpowerFI" })}</p>
      </section>
      <section className="space-y-1.5 sm:border-l sm:border-border sm:pl-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">
          {tr({ en: "Activation marketing · coming next", pt: "Marketing de ativação · em seguida" })}
        </p>
        <p className="font-heading text-xl">{tr({ en: "Rewards unlock after 30 days + a verified activation.", pt: "As recompensas desbloqueiam depois de 30 dias + uma ativação verificada." })}</p>
        <p className="text-sm text-muted-foreground">{tr({ en: "Unclaimed rewards → back to the sponsor", pt: "Recompensas não resgatadas → voltam ao patrocinador" })}</p>
      </section>
    </div>
  );
}
