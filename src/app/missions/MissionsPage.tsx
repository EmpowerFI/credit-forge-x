import { useLayoutEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarCheck, Gift, Landmark, RefreshCw } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "../i18n";
import LanguageSwitch from "../i18n/LanguageSwitch";
import NetworkBadge from "../components/product/NetworkBadge";
import { diaryClosed } from "../diary/db";
import CampaignCard from "./CampaignCard";
import { groupCampaigns } from "./money";
import SponsorPanel from "./SponsorPanel";
import { missions, type PublicCampaign, units } from "./chain";
import { DevnetNotice, SectionHeading } from "./ui";

/**
 * /app/missions -- EmpowerFI Missions, inside the platform and open without a
 * sign-in: each campaign a sponsor paid into a vault on Solana devnet, read
 * from the app's real database (not the showroom's) and checked against the
 * chain's own account. Counts show only from five women up, and nothing on
 * this page names one. The platform's locale provider redraws it on a switch.
 *
 * The page reads top to bottom as a sponsor decides: what it is, how the
 * money moves, campaigns running now, sponsoring one, and what the chain
 * does and does not prove. Impact Marketing is the one sponsorship product.
 */
export default function MissionsPage() {
  useLayoutEffect(() => {
    document.title = "EmpowerFI Missions";
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link to="/" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <NetworkBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-24 px-4 pb-16 pt-12 sm:space-y-28 sm:px-8 sm:pt-16">
        <Hero />
        <HowItWorks />
        {diaryClosed ? (
          <p className="text-muted-foreground">{tr({ en: "Missions are not open here yet.", pt: "As missões ainda não estão abertas aqui." })}</p>
        ) : (
          <>
            <LiveCampaigns />
            <SponsorPanel />
          </>
        )}
        <Transparency />
        <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          {tr({
            en: "Solana Devnet: test tokens with no value. Figures are the entrepreneurs' real days in the EmpowerFI diary, shown only from five participants up. Rewards will move from each reward wallet to a wallet the entrepreneur chooses later.",
            pt: "Solana Devnet: tokens de teste, sem valor. Os números são os dias reais das empreendedoras no diário EmpowerFI, mostrados só a partir de cinco participantes. Mais tarde, as recompensas passam de cada carteira de recompensas para uma carteira que a empreendedora escolher.",
          })}
        </footer>
      </main>
    </div>
  );
}

function Hero() {
  return (
    <header className="max-w-3xl space-y-6">
      <DevnetNotice />
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">EmpowerFI Missions</p>
        <h1 className="font-heading text-4xl leading-[1.1] sm:text-6xl">
          {tr({ en: "Turn sponsorship into ", pt: "Transforme patrocínio em " })}
          <em className="text-accent">{tr({ en: "measurable impact.", pt: "impacto mensurável." })}</em>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {tr({
            en: "Fund entrepreneurs, reward consistent engagement, and track outcomes with transparent, programmable rules.",
            pt: "Financie empreendedoras, recompense o engajamento constante e acompanhe os resultados com regras transparentes e programáveis.",
          })}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {!diaryClosed && (
          <Button asChild size="lg" className="h-12 gap-2 px-6 text-base">
            <a href="#sponsor">{tr({ en: "Sponsor a campaign", pt: "Patrocinar uma campanha" })} <ArrowRight aria-hidden /></a>
          </Button>
        )}
        <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
          <a href="#how">{tr({ en: "How it works", pt: "Como funciona" })}</a>
        </Button>
      </div>
    </header>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Landmark,
      title: tr({ en: "Fund", pt: "Financie" }),
      body: tr({ en: "The sponsor deposits USDC into the campaign's own vault on Solana, in one transaction.", pt: "O patrocinador deposita USDC no cofre da campanha na Solana, em uma transação." }),
    },
    {
      icon: CalendarCheck,
      title: tr({ en: "Engage", pt: "Engaje" }),
      body: tr({ en: "For 30 days, entrepreneurs record their sales and expenses in the EmpowerFI diary, on the days their business opens.", pt: "Por 30 dias, as empreendedoras registram vendas e gastos no diário EmpowerFI, nos dias em que o negócio abre." }),
    },
    {
      icon: Gift,
      title: tr({ en: "Reward", pt: "Recompense" }),
      body: tr({ en: "Whoever records every day she opens in those 30 days receives her reward from the vault, under rules set before the campaign starts.", pt: "Quem registra todos os dias em que abre nesses 30 dias recebe a recompensa do cofre, por regras definidas antes de a campanha começar." }),
    },
  ];
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-24 space-y-10">
      <SectionHeading id="how-title" eyebrow={tr({ en: "How it works", pt: "Como funciona" })}
        title={tr({ en: "Three steps, written into the campaign", pt: "Três passos, escritos na campanha" })} />
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="space-y-3 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold text-accent"><s.icon size={20} aria-hidden /></span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">0{i + 1}</span>
            </div>
            <h3 className="font-heading text-2xl">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <SplitDiagram />
    </section>
  );
}

/** 100 USDC as an example of the rule: the half, and where the entrepreneurs' half goes. */
function SplitDiagram() {
  return (
    <figure className="rounded-lg border border-border bg-card p-5 sm:p-7">
      <figcaption className="mb-5 text-sm font-medium">
        {tr({ en: "Where every campaign's funding goes", pt: "Para onde vai o financiamento de cada campanha" })}
      </figcaption>
      <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="space-y-2">
          <div className="flex h-10 overflow-hidden rounded-md text-xs font-medium">
            <div className="flex w-1/2 items-center justify-center bg-primary text-primary-foreground">50% EmpowerFI</div>
            <div className="flex w-1/2 items-center justify-center bg-gold text-foreground">{tr({ en: "50% Entrepreneurs", pt: "50% Empreendedoras" })}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            {tr({ en: "The split is fixed in the campaign on Solana when it is created.", pt: "A divisão fica fixada na campanha, na Solana, quando ela é criada." })}
          </p>
        </div>
        <ArrowRight className="mx-auto rotate-90 text-muted-foreground md:rotate-0" aria-hidden />
        <ul className="space-y-2 text-sm">
          <li className="flex gap-3 rounded-md border border-border p-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm bg-gold" aria-hidden />
            <span><span className="font-medium">{tr({ en: "Recorded every day she opens", pt: "Registrou todos os dias em que abre" })}</span> → {tr({ en: "her reward, paid to her reward wallet", pt: "a recompensa dela, paga na carteira de recompensas" })}</span>
          </li>
          <li className="flex gap-3 rounded-md border border-border p-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm bg-gold/35" aria-hidden />
            <span><span className="font-medium">{tr({ en: "Not earned", pt: "Não conquistada" })}</span> → {tr({ en: "EmpowerFI (Impact Marketing)", pt: "EmpowerFI (Marketing de Impacto)" })}</span>
          </li>
        </ul>
      </div>
    </figure>
  );
}

function LiveCampaigns() {
  const list = useQuery({ queryKey: ["missions"], queryFn: missions.campaigns, refetchInterval: 60_000 });
  const [, setParams] = useSearchParams();
  // Co-sponsoring opens the wizard below on that campaign.
  const coSponsor = (programId: string) => {
    setParams((p) => { p.set("join", programId); return p; }, { replace: true });
    requestAnimationFrame(() => document.getElementById("sponsor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return (
    <section id="campaigns" aria-labelledby="campaigns-title" aria-busy={list.isLoading} className="scroll-mt-24 space-y-8">
      <SectionHeading id="campaigns-title" eyebrow={tr({ en: "Live on Devnet", pt: "No ar na Devnet" })}
        title={tr({ en: "Campaigns", pt: "Campanhas" })}
        lead={tr({ en: "Real engagement from the EmpowerFI diary, with every amount readable on Solana.", pt: "Engajamento real do diário EmpowerFI, com cada valor legível na Solana." })} />
      {list.isLoading ? (
        <div className="space-y-4" aria-label={tr({ en: "Loading campaigns", pt: "Carregando campanhas" })}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : list.error ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
          <p>{tr({ en: "The campaigns could not be loaded just now.", pt: "Não foi possível carregar as campanhas agora." })}</p>
          <Button variant="outline" className="h-11 gap-2" onClick={() => void list.refetch()}>
            <RefreshCw aria-hidden /> {tr({ en: "Try again", pt: "Tentar de novo" })}
          </Button>
        </div>
      ) : !list.data?.length ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-8">
          <p className="font-heading text-xl">{tr({ en: "No campaign is published yet.", pt: "Nenhuma campanha publicada ainda." })}</p>
          <p className="text-sm text-muted-foreground">{tr({ en: "Be the first sponsor: it takes three steps.", pt: "Seja o primeiro patrocinador: são três passos." })}</p>
          <Button asChild className="h-11 gap-2"><a href="#sponsor">{tr({ en: "Sponsor a campaign", pt: "Patrocinar uma campanha" })} <ArrowRight aria-hidden /></a></Button>
        </div>
      ) : (
        <>
          <Totals list={list.data} />
          <div className="space-y-8">
            {groupCampaigns(list.data).map((g) => <CampaignCard key={g.lead.program_id} g={g} onCoSponsor={coSponsor} />)}
          </div>
        </>
      )}
    </section>
  );
}

/** Across the published campaigns: what sponsors put in the vaults, and what reached the entrepreneurs. */
function Totals({ list }: { list: PublicCampaign[] }) {
  const d = list[0]?.mint_decimals ?? 6;
  const funded = list.reduce((n, c) => n + BigInt(c.chain.funded_units), 0n);
  const paid = list.reduce((n, c) => n + BigInt(c.paid.units), 0n);
  const rewards = list.reduce((n, c) => n + c.paid.count, 0);
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      {[
        { k: tr({ en: "Sent to the vaults", pt: "Enviado aos cofres" }), v: `${units(funded, d)} USDC` },
        { k: tr({ en: "Campaigns", pt: "Campanhas" }), v: String(groupCampaigns(list).length) },
        { k: tr({ en: "Rewards paid", pt: "Recompensas pagas" }), v: `${units(paid, d)} USDC`, note: tr({ en: `to ${rewards} entrepreneurs`, pt: `para ${rewards} empreendedoras` }) },
      ].map((x) => (
        <div key={x.k} className="bg-card px-5 py-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{x.k}</dt>
          <dd className="mt-1 font-heading text-2xl tabular-nums">{x.v}</dd>
          {x.note && <p className="text-xs text-muted-foreground">{x.note}</p>}
        </div>
      ))}
    </dl>
  );
}

function Transparency() {
  const items = [
    {
      key: "vault",
      title: tr({ en: "The Solana vault", pt: "O cofre na Solana" }),
      body: tr({
        en: "Each campaign has its own vault: a token account owned by the campaign's program address, not by a person. Its balance is public, and the program's rules decide when anything leaves it.",
        pt: "Cada campanha tem seu próprio cofre: uma conta de tokens que pertence ao endereço do programa da campanha, não a uma pessoa. O saldo é público, e as regras do programa decidem quando algo sai dele.",
      }),
    },
    {
      key: "terms",
      title: tr({ en: "On-chain campaign commitments", pt: "Compromissos da campanha na blockchain" }),
      body: tr({
        en: "When it is created, the campaign records on Solana its seats, amount per entrepreneur, 50/50 split, 30 days to unlock and a fingerprint of its terms. None of these can change afterwards.",
        pt: "Ao ser criada, a campanha grava na Solana as vagas, o valor por empreendedora, a divisão 50/50, os 30 dias para desbloquear e uma impressão digital dos termos. Nada disso pode mudar depois.",
      }),
    },
    {
      key: "proofs",
      title: tr({ en: "Engagement proofs", pt: "Provas de engajamento" }),
      body: tr({
        en: "Once a day, EmpowerFI writes a Merkle root of who kept the days, from five participants up. Each leaf is a salted commitment, so the record never reveals who an entrepreneur is. A reward is paid only for a leaf in the latest root, once.",
        pt: "Uma vez por dia, a EmpowerFI grava uma raiz Merkle de quem cumpriu os dias, a partir de cinco participantes. Cada folha é um compromisso com sal, então o registro nunca revela quem é a empreendedora. A recompensa só é paga para uma folha da raiz mais recente, uma única vez.",
      }),
    },
    {
      key: "verify",
      title: tr({ en: "What the chain proves, and what it does not", pt: "O que a blockchain prova, e o que não prova" }),
      body: tr({
        en: "Solana gives a verifiable record: what was funded, the terms, each proof EmpowerFI wrote and each reward paid. It does not verify that an entrepreneur's own records of sales and expenses are accurate: those are self-reported in the diary.",
        pt: "A Solana oferece um registro verificável: o que foi financiado, os termos, cada prova gravada pela EmpowerFI e cada recompensa paga. Ela não verifica se os registros de vendas e gastos da empreendedora estão corretos: eles são informados por ela mesma no diário.",
      }),
    },
    {
      key: "devnet",
      title: tr({ en: "Current Devnet limitations", pt: "Limitações atuais da Devnet" }),
      body: tr({
        en: "This runs on Solana Devnet with test USDC that has no value. Devnet can be slow or reset. Rewards stay in each entrepreneur's reward wallet until moving them to a wallet of her choice is built.",
        pt: "Isto roda na Solana Devnet, com USDC de teste sem valor. A Devnet pode ficar lenta ou ser reiniciada. As recompensas ficam na carteira de recompensas de cada empreendedora até existir a transferência para uma carteira que ela escolher.",
      }),
    },
  ];
  return (
    <section aria-labelledby="tech-title" className="space-y-6">
      <SectionHeading id="tech-title" eyebrow={tr({ en: "Technical transparency", pt: "Transparência técnica" })}
        title={tr({ en: "What runs on Solana", pt: "O que roda na Solana" })} />
      <Accordion type="single" collapsible className="rounded-lg border border-border bg-card px-5 sm:px-7">
        {items.map((i) => (
          <AccordionItem key={i.key} value={i.key} className="border-border last:border-b-0">
            <AccordionTrigger className="min-h-12 text-left hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{i.title}</AccordionTrigger>
            <AccordionContent className="max-w-3xl text-muted-foreground">{i.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
