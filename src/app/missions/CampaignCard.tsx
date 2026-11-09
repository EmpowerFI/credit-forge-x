import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { HandCoins, CheckCircle2, CircleAlert, Loader2, Wallet } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatDate, tr } from "../i18n";
import { checks, type PublicCampaign, readOnChain, units } from "./chain";
import { type CampaignGroup, type CampaignMoney, campaignMoney, campaignProgress, day, groupMoney, share } from "./money";
import { ChainKey, InfoTip, Metric, PhaseBadge } from "./ui";

const num = (n: number, digits = 0) => new Intl.NumberFormat(tr({ en: "en-GB", pt: "pt-BR" }), { maximumFractionDigits: digits }).format(n);

type ChainState = UseQueryResult<Awaited<ReturnType<typeof readOnChain>>>;

/**
 * One published campaign, with every sponsor in it: where it is in its days,
 * who takes part, where the money is, and -- behind panels -- the
 * conditions, each vault's checks and the transactions. Each sponsor's money
 * is its own vault; the figures add them up. The entrepreneurs are the same
 * in every vault (same days, same cohort), so their counts are the lead's,
 * shown only from min_group up.
 */
export default function CampaignCard({ g, onCoSponsor }: { g: CampaignGroup; onCoSponsor?: (programId: string) => void }) {
  const c = g.lead;
  const chains = useQueries({
    queries: g.vaults.map((v) => ({ queryKey: ["missions", "chain", v.chain.campaign], queryFn: () => readOnChain(v), refetchInterval: 60_000 })),
  });
  const d = c.mint_decimals;
  const money = groupMoney(g, chains.map((q) => q.data?.vaultUnits));
  const paid = g.vaults.reduce((n, v) => ({ count: n.count + v.paid.count, units: n.units + v.paid.units }), { count: 0, units: 0 });
  const progress = campaignProgress(c);
  const counted = c.enrolled !== null;
  const usd = (n: bigint | number) => `${units(n, d)} USDC`;
  const many = g.co.length > 0;

  return (
    <article aria-labelledby={`c-${c.program_id}`} className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="space-y-5 p-5 sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {g.vaults.map((v) => v.sponsor).join(" · ")}
            </p>
            <h3 id={`c-${c.program_id}`} className="font-heading text-2xl leading-snug">{c.name}</h3>
            <p className="text-sm text-muted-foreground">{day(c.period_start)} – {day(c.period_end)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-gold/60 px-2.5 py-0.5 text-xs font-medium text-accent">
              {tr({ en: "Impact Marketing", pt: "Marketing de Impacto" })}
            </span>
            {many && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                {tr({ en: `${g.vaults.length} sponsors`, pt: `${g.vaults.length} patrocinadores` })}
              </span>
            )}
            <PhaseBadge phase={progress.phase} />
          </div>
        </header>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {progress.phase === "upcoming" ? tr({ en: "Not started", pt: "Ainda não começou" })
                : progress.phase === "ended" ? tr({ en: `All ${progress.total} days done`, pt: `Os ${progress.total} dias concluídos` })
                : tr({ en: `Day ${progress.day} of ${progress.total}`, pt: `Dia ${progress.day} de ${progress.total}` })}
            </span>
            <span className="tabular-nums text-muted-foreground">{progress.percent}%</span>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}
            aria-label={tr({ en: "Campaign progress", pt: "Andamento da campanha" })} className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gold" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-3">
          <Metric emphasis label={tr({ en: "Total funding", pt: "Financiamento total" })} value={usd(money.funded)}
            note={many
              ? tr({ en: `From ${g.vaults.length} sponsors, each in its own vault`, pt: `De ${g.vaults.length} patrocinadores, cada um no seu cofre` })
              : tr({ en: `${usd(c.price_per_seat_units)} × ${c.seats} entrepreneurs`, pt: `${usd(c.price_per_seat_units)} × ${c.seats} empreendedoras` })} />
          <Metric emphasis label={tr({ en: "Entrepreneurs taking part", pt: "Empreendedoras participando" })}
            value={counted ? <>{num(c.enrolled!)} <span className="text-base text-muted-foreground">/ {num(c.seats)}</span></> : "—"}
            note={counted ? tr({ en: "of the funded seats", pt: "das vagas financiadas" }) : tr({ en: `Shown from ${c.min_group} participants`, pt: `Aparece a partir de ${c.min_group} participantes` })}
            tip={tr({
              en: `Diary entrepreneurs who agreed to share their impact figures. Every one of them takes part. Counts appear only from ${c.min_group}, so no one can be singled out.`,
              pt: `Empreendedoras do diário que autorizaram compartilhar os números de impacto. Todas participam. Os números só aparecem a partir de ${c.min_group}, para que ninguém seja identificada.`,
            })} />
          <Metric emphasis label={tr({ en: "In the vault now", pt: "No cofre agora" })} value={usd(money.inVault)}
            note={chains.some((q) => q.isLoading) ? tr({ en: "Reading Solana…", pt: "Lendo a Solana…" })
              : money.fromChain ? tr({ en: "Balance read on Solana", pt: "Saldo lido na Solana" })
              : tr({ en: "From the record; Solana did not answer", pt: "Pelo registro; a Solana não respondeu" })} />
          <Metric label={tr({ en: "Active", pt: "Em atividade" })} value={counted ? num(c.active ?? 0) : "—"}
            tip={tr({ en: "Recorded at least one day in the diary during this campaign.", pt: "Registraram pelo menos um dia no diário durante esta campanha." })} />
          <Metric label={tr({ en: `Completed ${c.unlock_days} days`, pt: `Completaram ${c.unlock_days} dias` })} value={counted ? num(c.engaged ?? 0) : "—"}
            tip={tr({ en: `Recorded ${c.unlock_days} days in the diary during the campaign: the condition for a reward.`, pt: `Registraram ${c.unlock_days} dias no diário durante a campanha: a condição para a recompensa.` })} />
          <Metric label={tr({ en: "Rewards paid", pt: "Recompensas pagas" })} value={usd(paid.units)}
            note={tr({ en: `${paid.count} ${paid.count === 1 ? "payment" : "payments"}`, pt: `${paid.count} ${paid.count === 1 ? "pagamento" : "pagamentos"}` })} />
        </dl>

        <Allocation money={money} usd={usd} />

        {progress.phase !== "ended" && onCoSponsor && (
          <div className="flex flex-col gap-3 rounded-md border border-dashed border-gold/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {tr({
                en: "Add to this campaign: your own vault, the same 30 days. Each entrepreneur who completes it receives every sponsor's reward.",
                pt: "Some-se a esta campanha: um cofre só seu, nos mesmos 30 dias. Cada empreendedora que concluir recebe a recompensa de todos os patrocinadores.",
              })}
            </p>
            <button type="button" onClick={() => onCoSponsor(c.program_id)}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-foreground/80 px-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <HandCoins size={16} aria-hidden /> {tr({ en: "Co-sponsor this campaign", pt: "Copatrocinar esta campanha" })}
            </button>
          </div>
        )}
      </div>

      <Accordion type="multiple" className="border-t border-border px-5 sm:px-7">
        <Panel value="engagement" title={tr({ en: "Engagement statistics", pt: "Estatísticas de engajamento" })}>
          {counted ? (
            <dl className="divide-y divide-border">
              <Row k={tr({ en: "Taking part", pt: "Participando" })} v={num(c.enrolled!)} />
              <Row k={tr({ en: "Active (recorded at least one day)", pt: "Em atividade (registraram ao menos um dia)" })} v={num(c.active ?? 0)} />
              <Row k={tr({ en: `Completed ${c.unlock_days} days`, pt: `Completaram ${c.unlock_days} dias` })} v={num(c.engaged ?? 0)} />
              <Row k={tr({ en: "Mean days recorded, among the active", pt: "Média de dias registrados, entre as ativas" })}
                v={c.avg_days === null ? "—" : num(c.avg_days, 1)} />
            </dl>
          ) : (
            <p className="text-muted-foreground">
              {tr({
                en: `Waiting for participants. Counts, and the proof of who kept the ${c.unlock_days} days, start at ${c.min_group} entrepreneurs, so no one is ever singled out.`,
                pt: `Aguardando participantes. Os números, e a prova de quem cumpriu os ${c.unlock_days} dias, começam com ${c.min_group} empreendedoras, para que ninguém seja identificada.`,
              })}
            </p>
          )}
        </Panel>

        <Panel value="funding" title={tr({ en: "Funding allocation", pt: "Divisão do financiamento" })}>
          {many && (
            <dl className="mb-3 divide-y divide-border border-b border-border">
              {g.vaults.map((v) => (
                <Row key={v.program_id} k={v.sponsor}
                  v={<>{usd(v.chain.funded_units)} <span className="text-xs text-muted-foreground">
                    ({tr({ en: `${usd(campaignMoney(v).perSeat)} per entrepreneur`, pt: `${usd(campaignMoney(v).perSeat)} por empreendedora` })})</span></>} />
              ))}
            </dl>
          )}
          <dl className="divide-y divide-border">
            <Row k={many ? tr({ en: "Paid by the sponsors", pt: "Pago pelos patrocinadores" }) : tr({ en: "Paid by the sponsor", pt: "Pago pelo patrocinador" })} v={usd(money.funded)} />
            <Row k={tr({ en: `EmpowerFI (${c.house_share_bps / 100}%)`, pt: `EmpowerFI (${c.house_share_bps / 100}%)` })} v={usd(money.house)} />
            <Row k={tr({ en: `Entrepreneurs (${100 - c.house_share_bps / 100}%)`, pt: `Empreendedoras (${100 - c.house_share_bps / 100}%)` })} v={usd(money.entrepreneurs)} />
            <Row k={many ? tr({ en: "Reward for each entrepreneur, all sponsors", pt: "Recompensa de cada empreendedora, somando todos" }) : tr({ en: "Reward for each entrepreneur", pt: "Recompensa de cada empreendedora" })} v={usd(money.perSeat)} />
          </dl>
          <p className="mt-3 text-muted-foreground">
            {tr({
              en: "Each sponsor's amount sits in its own vault on Solana. A reward leaves a vault only for an entrepreneur who met the condition, and the program never pays a reward out of EmpowerFI's half.",
              pt: "O valor de cada patrocinador fica no próprio cofre, na Solana. Uma recompensa só sai de um cofre para a empreendedora que cumpriu a condição, e o programa nunca paga recompensa com a metade da EmpowerFI.",
            })}
          </p>
        </Panel>

        <Panel value="conditions" title={tr({ en: "Reward conditions", pt: "Condições da recompensa" })}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{tr({ en: "Every diary entrepreneur who shares her impact figures takes part. She does not need to sign up.", pt: "Toda empreendedora do diário que autoriza os números de impacto participa. Ela não precisa se inscrever." })}</li>
            <li>{tr({ en: `She earns ${usd(money.perSeat)} after recording ${c.unlock_days} days in the diary during the campaign.`, pt: `Ela recebe ${usd(money.perSeat)} depois de registrar ${c.unlock_days} dias no diário durante a campanha.` })}</li>
            {many && <li>{tr({ en: "With more than one sponsor, she is paid once by each sponsor's vault: the rewards add up.", pt: "Com mais de um patrocinador, ela recebe uma vez de cada cofre: as recompensas se somam." })}</li>}
            <li>{tr({ en: "The reward goes to her reward wallet: an address of the program, with no private key, that nothing on this page links to her.", pt: "A recompensa vai para a carteira de recompensas dela: um endereço do programa, sem chave privada, que nada nesta página liga a ela." })}</li>
            <li>{tr({ en: "Rewards that no one earns go to EmpowerFI (Impact Marketing).", pt: "As recompensas que ninguém conquistar vão para a EmpowerFI (Marketing de Impacto)." })}</li>
          </ul>
        </Panel>

        <Panel value="verification" title={tr({ en: "On-chain verification", pt: "Verificação na blockchain" })}>
          <div className="space-y-6">
            {g.vaults.map((v, i) => (
              <div key={v.program_id} className={cn(i > 0 && "border-t border-border pt-5")}>
                {many && <p className="mb-2 font-heading text-base">{v.sponsor}</p>}
                <Verification c={v} state={chains[i]} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel value="history" title={tr({ en: "Transaction history", pt: "Histórico de transações" })}>
          <History g={g} usd={usd} />
        </Panel>
      </Accordion>
    </article>
  );
}

/** Where the money is: EmpowerFI's half, rewards paid, rewards still reserved, and what goes back to the sponsor. */
function Allocation({ money, usd }: { money: CampaignMoney; usd: (n: bigint) => string }) {
  const parts = [
    { key: "house", cls: "bg-primary", label: tr({ en: "EmpowerFI's half, held in the vault", pt: "Metade da EmpowerFI, guardada no cofre" }), v: money.house },
    { key: "released", cls: "bg-gold", label: tr({ en: "Released to entrepreneurs", pt: "Liberado às empreendedoras" }), v: money.released },
    { key: "reserved", cls: "bg-gold/35", label: tr({ en: "Reserved for entrepreneurs", pt: "Reservado às empreendedoras" }), v: money.reserved },
  ];
  return (
    <section aria-label={tr({ en: "Where the funding is", pt: "Onde está o financiamento" })} className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
        {parts.map((p) => p.v > 0n && <div key={p.key} className={cn("h-full", p.cls)} style={{ width: `${share(p.v, money.funded)}%` }} />)}
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", p.cls)} aria-hidden />{p.label}
            </dt>
            <dd className="whitespace-nowrap tabular-nums">{usd(p.v)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border" aria-hidden />
            {tr({ en: "Returned to the sponsor", pt: "Devolvido ao patrocinador" })}
            <InfoTip label={tr({ en: "Returned to the sponsor", pt: "Devolvido ao patrocinador" })}>
              {tr({
                en: "Nothing returns to the sponsor: under the campaign terms, rewards that no one earns are allocated to EmpowerFI.",
                pt: "Nada volta ao patrocinador: pelos termos da campanha, as recompensas que ninguém conquistar ficam com a EmpowerFI.",
              })}
            </InfoTip>
          </dt>
          <dd className="whitespace-nowrap tabular-nums text-muted-foreground">{tr({ en: "Not in the terms", pt: "Não previsto" })}</dd>
        </div>
      </dl>
    </section>
  );
}

function Panel({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-border last:border-b-0">
      <AccordionTrigger className="min-h-12 text-left text-sm hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

const CHECK_LABELS = {
  ref: { en: "The account is this campaign's", pt: "A conta é desta campanha" },
  terms: { en: "Terms match the published commitment", pt: "Os termos batem com o compromisso publicado" },
  seats: { en: "Seats and amount per entrepreneur", pt: "Vagas e valor por empreendedora" },
  split: { en: "50/50 split and 30 days to unlock", pt: "Divisão 50/50 e 30 dias para desbloquear" },
  funded: { en: "Funded in full; the vault holds it, less the rewards paid", pt: "Financiada por inteiro; o cofre guarda o valor, menos as recompensas pagas" },
  house: { en: "EmpowerFI's half is still in the vault", pt: "A metade da EmpowerFI segue no cofre" },
  proof: { en: "Latest engagement proof", pt: "Última prova de engajamento" },
} as const;

function Verification({ c, state }: { c: PublicCampaign; state: ChainState }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 font-medium">{tr({ en: "Checked on Solana, now", pt: "Conferido na Solana, agora" })}</p>
        {state.isLoading && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" aria-hidden /> {tr({ en: "Reading the chain…", pt: "Lendo a blockchain…" })}
          </p>
        )}
        {state.error && (
          <p className="text-muted-foreground">
            {tr({ en: "Devnet did not answer; the figures above are the database's.", pt: "A devnet não respondeu; os números acima são os do banco." })}{" "}
            <button type="button" className="font-medium text-foreground underline" onClick={() => void state.refetch()}>
              {tr({ en: "Try again", pt: "Tentar de novo" })}
            </button>
          </p>
        )}
        {state.data && (
          <ul className="space-y-1.5">
            {checks(c, state.data.account, state.data.vaultUnits).map((x) => (
              <li key={x.key} className="flex items-start gap-2">
                {x.ok
                  ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-positive" aria-label={tr({ en: "matches", pt: "confere" })} />
                  : <CircleAlert size={16} className="mt-0.5 shrink-0 text-alert" aria-label={tr({ en: "does not match", pt: "não confere" })} />}
                {tr(CHECK_LABELS[x.key])}
              </li>
            ))}
          </ul>
        )}
      </div>
      <dl className="divide-y divide-border border-t border-border">
        <ChainKey label={tr({ en: "Campaign account", pt: "Conta da campanha" })} value={c.chain.campaign} />
        <ChainKey label={tr({ en: "Vault", pt: "Cofre" })} value={c.chain.vault} />
        <ChainKey label={tr({ en: "Program", pt: "Programa" })} value={c.chain.program} />
        <ChainKey label={tr({ en: "Token (test USDC)", pt: "Token (USDC de teste)" })} value={c.chain.mint} />
        <ChainKey label={tr({ en: "Sponsor wallet", pt: "Carteira do patrocinador" })} value={c.chain.sponsor_wallet} />
        <ChainKey label={tr({ en: "EmpowerFI wallet", pt: "Carteira da EmpowerFI" })} value={c.chain.house_wallet} />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
          <dt className="text-sm text-muted-foreground">{tr({ en: "Terms commitment", pt: "Compromisso dos termos" })}</dt>
          <dd className="break-all font-mono text-xs">{c.chain.terms_commitment.slice(0, 16)}…</dd>
        </div>
      </dl>
    </div>
  );
}

interface Entry { at: string; key: string; text: string; signature: string; icon?: boolean }

/** Every vault's transactions, newest first, each with the sponsor it belongs to when there is more than one. */
function History({ g, usd }: { g: CampaignGroup; usd: (n: number) => string }) {
  const many = g.co.length > 0;
  const who = (v: PublicCampaign) => (many ? ` · ${v.sponsor}` : "");
  const entries: Entry[] = g.vaults.flatMap((v) => [
    ...v.payments.map((p) => ({
      at: p.block_time ?? v.chain.funded_at, key: p.signature, signature: p.signature, icon: true,
      text: tr({ en: `Reward paid: ${usd(p.amount_units)}`, pt: `Recompensa paga: ${usd(p.amount_units)}` }) + who(v),
    })),
    ...v.attestations.map((a) => ({
      at: a.as_of, key: `${v.program_id}-${a.as_of}`, signature: a.signature,
      text: tr({
        en: `Engagement proof: ${a.engaged} of ${a.enrolled} kept ${v.unlock_days} days`,
        pt: `Prova de engajamento: ${a.engaged} de ${a.enrolled} cumpriram ${v.unlock_days} dias`,
      }) + who(v),
    })),
    {
      at: v.chain.funded_at, key: v.chain.funded_signature, signature: v.chain.funded_signature,
      text: (v.joins
        ? tr({ en: `Co-sponsored: ${usd(v.chain.funded_units)}`, pt: `Copatrocinada: ${usd(v.chain.funded_units)}` })
        : tr({ en: `Created and funded: ${usd(v.chain.funded_units)}`, pt: `Criada e financiada: ${usd(v.chain.funded_units)}` })) + who(v),
    },
  ]);
  entries.sort((a, b) => Date.parse(b.at.length === 10 ? `${b.at}T12:00:00Z` : b.at) - Date.parse(a.at.length === 10 ? `${a.at}T12:00:00Z` : a.at));
  const proofs = g.vaults.some((v) => v.attestations.length > 0);
  return (
    <div className="space-y-3">
      <ol className="space-y-3 border-l border-gold pl-4">
        {entries.map((e) => (
          <li key={e.key} className="space-y-0.5">
            <p className="flex items-center gap-1.5">
              {e.icon && <Wallet size={14} className="shrink-0 text-accent" aria-hidden />}
              {e.at.length === 10 ? day(e.at) : formatDate(e.at, { day: "numeric", month: "short", year: "numeric" })} · {e.text}
            </p>
            <dl><ChainKey label={tr({ en: "Transaction", pt: "Transação" })} value={e.signature} kind="tx" /></dl>
          </li>
        ))}
      </ol>
      {!proofs && (
        <p className="text-muted-foreground">
          {tr({
            en: `An engagement proof is written here once a day, from the campaign's ${g.lead.min_group}th entrepreneur on.`,
            pt: `Uma prova de engajamento é gravada aqui uma vez por dia, a partir da ${g.lead.min_group}ª empreendedora da campanha.`,
          })}
        </p>
      )}
    </div>
  );
}
