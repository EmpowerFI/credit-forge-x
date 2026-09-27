import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Landmark, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import StatTile from "../../components/product/StatTile";
import { formatNumber, tr } from "../../i18n";
import {
  BEARER_LABEL, BEARER_SELLS, BILLING_MODEL, bps, type BusinessModel as Data, businessModelKey,
  CARD_SOURCE, type CostBearer, fetchBusinessModel,
} from "../../lib/economics";
import { money } from "../../lib/readiness";

// Who sells what, and whether the tool pays for itself.
//
// Three businesses meet on this platform: EmpowerFI licenses a tool, the
// community does the fieldwork on a budget of its own, the desk lends from its
// own book. A single "cost to serve" adds them together and answers none of
// their questions — least of all the sponsor's, who may be paying all three.
//
// The two contract shapes are cards, not assumptions: separate contracts, or
// one package with the community's share passed through. Reading them side by
// side is the point, so the scenario is a control rather than a deploy.

const ICON: Record<CostBearer, typeof Building2> = {
  empowerfi: Building2,
  community: Users,
  partner: Landmark,
};

/** One of the three, with what it sells and what its work costs. */
function Ledger({ who, cents, perMonth }: { who: CostBearer; cents: number; perMonth: number | null }) {
  const Icon = ICON[who];
  return (
    <div className="space-y-1.5 rounded-lg border border-border p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon size={15} className="text-muted-foreground" aria-hidden /> {BEARER_LABEL[who]}
      </p>
      <p className="text-xs text-muted-foreground">{BEARER_SELLS[who]}</p>
      <p className="num font-heading text-lg font-bold text-foreground">{money(cents)}</p>
      <p className="num text-[11px] text-muted-foreground">
        {perMonth == null ? "—" : tr({
          en: `${money(Math.round(perMonth))} per participant-month`,
          pt: `${money(Math.round(perMonth))} por participante-mês`,
        })}
      </p>
    </div>
  );
}

export default function BusinessModel({ programId }: { programId: string | null }) {
  // Null means the card marked as the default one; a version names a scenario.
  const [version, setVersion] = useState<string | null>(null);
  const q = useQuery({
    queryKey: businessModelKey(programId, version),
    queryFn: () => fetchBusinessModel(programId, version),
  });
  const b: Data | undefined = q.data;

  // A reader without the right to prices sees nothing here rather than an error.
  if (q.isError) return null;
  if (!b) return <Skeleton className="h-96 w-full rounded-xl" />;

  const { pricing, scope, monthly, leverage, evidence, borne_by: borne } = b;
  const bundled = pricing.billing_model === "bundled";
  const perParticipantMonth = (cents: number) =>
    scope.participants > 0 && scope.months_measured > 0 ? cents / scope.months_measured / scope.participants : null;
  // The card in force first, so the control reads as "this, or that instead".
  const cards = [
    { version: pricing.version, billing_model: pricing.billing_model },
    ...pricing.others.map((o) => ({ version: o.version, billing_model: o.billing_model })),
  ];
  const standaloneLoses = (leverage.standalone_margin_bps ?? 0) < 0;

  return (
    <section id="business" className="panel scroll-mt-32 space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {tr({ en: "Three businesses, one screen", pt: "Três negócios, uma tela" })}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{tr({
            en: "EmpowerFI licenses a tool. The fieldwork belongs to the community, on a budget of its own; the credit belongs to the desk. The sponsor pays the three under separate contracts — one package is a shape the model supports and has no agreed community budget to price yet.",
            pt: "A EmpowerFI licencia uma ferramenta. O trabalho de campo é da comunidade, com orçamento próprio; o crédito é da mesa. O patrocinador paga os três em contratos separados — o pacote único é um formato que o modelo suporta e que ainda não tem orçamento de comunidade acordado para precificar.",
          })}</p>
        </div>
        {cards.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group"
            aria-label={tr({ en: "Contract shape", pt: "Formato de contrato" })}>
            {cards.map((c) => {
              const on = c.version === pricing.version;
              return (
                <button key={c.version} type="button" aria-pressed={on}
                  onClick={() => setVersion(c.version)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-secondary/60",
                  )}>
                  {BILLING_MODEL[c.billing_model].label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{BILLING_MODEL[pricing.billing_model].says}</p>
      {/* The pass-through is priced at what the leader's minutes cost on the
          rate card, which is the floor of a community budget and not a
          negotiated one. Saying so keeps the bundle's margin honest. */}
      {bundled && (
        <p className="flex items-start gap-2 rounded-lg border tone-caution px-3 py-2 text-xs">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>{tr({
            en: <>The share passed through is {money(pricing.community_share_cents)} per participant-month — what her work costs on the rate card, not what a community would negotiate. A real budget carries coordination, space and travel, so this margin is a ceiling.</>,
            pt: <>O repasse está em {money(pricing.community_share_cents)} por participante-mês — o que o trabalho dela custa na tabela, não o que uma comunidade negociaria. Um orçamento real carrega coordenação, espaço e deslocamento, então esta margem é um teto.</>,
          })}</span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Ledger who="empowerfi" cents={borne.empowerfi_cents} perMonth={perParticipantMonth(borne.empowerfi_cents)} />
        <Ledger who="community" cents={borne.community_cents} perMonth={perParticipantMonth(borne.community_cents)} />
        <Ledger who="partner" cents={borne.partner_cents} perMonth={perParticipantMonth(borne.partner_cents)} />
      </div>
      <p className="text-xs text-muted-foreground">{tr({
        en: `Work recorded over ${formatNumber(scope.months_measured, { maximumFractionDigits: 1 })} months, priced by the cost card. Only the first column is EmpowerFI's to pay.`,
        pt: `Trabalho registrado em ${formatNumber(scope.months_measured, { maximumFractionDigits: 1 })} meses, precificado pela tabela de custos. Só a primeira coluna é a EmpowerFI que paga.`,
      })}</p>

      {/* The licence against what it costs to serve, per month, at the size this
          programme is now. Two across clips "R$ 1.500,00" at 390, so one across
          until there is room — the same remedy the plan tiles already carry. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={tr({ en: "Licence, per month", pt: "Licença, por mês" })} value={money(monthly.licence_cents)}
          hint={monthly.floor_applied
            ? tr({ en: "the floor, not the seats", pt: "o piso, não os assentos" })
            : tr({ en: `${formatNumber(scope.participants)} seats at ${money(pricing.seat_cents)}`, pt: `${formatNumber(scope.participants)} assentos a ${money(pricing.seat_cents)}` })} />
        <StatTile label={tr({ en: "Cost to serve, per month", pt: "Custo de servir, por mês" })} value={money(monthly.cost_cents)}
          hint={bundled
            ? tr({ en: "with the community's share", pt: "com a parte da comunidade" })
            : tr({ en: "events, plus a share of the fixed block", pt: "eventos, mais uma parte do bloco fixo" })} />
        <StatTile label={tr({ en: "Gross margin", pt: "Margem bruta" })} value={bps(monthly.margin_bps)}
          hint={money(monthly.margin_cents)} hintTone={(monthly.margin_bps ?? 0) > 0 ? "positive" : "alert"} />
        <StatTile label={tr({ en: "Per participant-month", pt: "Por participante-mês" })}
          value={money((b.per_participant_month.variable_cents ?? 0) + (b.per_participant_month.fixed_share_cents ?? 0))}
          hint={tr({ en: `licensed at ${money(b.per_participant_month.licence_cents)}`, pt: `licenciado a ${money(b.per_participant_month.licence_cents)}` })} />
      </div>

      {/* A fixed block divided by seats would make every participant look
          equally cheap. These two numbers are what it really does. */}
      <div className={cn("space-y-2 rounded-lg border px-3 py-2.5", standaloneLoses ? "tone-caution" : "border-border")}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          {standaloneLoses ? <TriangleAlert size={15} aria-hidden /> : <ShieldCheck size={15} aria-hidden />}
          {tr({ en: "What it takes to pay for itself", pt: "O que falta para se pagar" })}
        </p>
        <p className="text-sm">{tr({
          en: <>The fixed block costs <span className="num font-semibold">{money(b.rate_card.fixed_monthly_cents ?? 0)}</span> a month
            and carries about <span className="num">{formatNumber(leverage.capacity_participants ?? 0)}</span> participants. Licences pay for it
            at <span className="num font-semibold">{formatNumber(leverage.breakeven_participants ?? 0)}</span> participants across every
            programme — about {formatNumber(Math.max(1, Math.round((leverage.breakeven_participants ?? 0) / Math.max(1, scope.participants))))} of this size.</>,
          pt: <>O bloco fixo custa <span className="num font-semibold">{money(b.rate_card.fixed_monthly_cents ?? 0)}</span> por mês
            e carrega cerca de <span className="num">{formatNumber(leverage.capacity_participants ?? 0)}</span> participantes. As licenças o pagam
            com <span className="num font-semibold">{formatNumber(leverage.breakeven_participants ?? 0)}</span> participantes somando todos os
            programas — uns {formatNumber(Math.max(1, Math.round((leverage.breakeven_participants ?? 0) / Math.max(1, scope.participants))))} deste tamanho.</>,
        })}</p>
        <p className="text-xs">{tr({
          en: <>This programme carrying the block alone would cost <span className="num">{money(leverage.standalone_cost_cents)}</span> a month
            against <span className="num">{money(monthly.licence_cents)}</span> of licence: <span className="num font-semibold">{bps(leverage.standalone_margin_bps)}</span>.
            The margin above assumes the block is shared; today it is not.</>,
          pt: <>Este programa carregando o bloco sozinho custaria <span className="num">{money(leverage.standalone_cost_cents)}</span> por mês
            contra <span className="num">{money(monthly.licence_cents)}</span> de licença: <span className="num font-semibold">{bps(leverage.standalone_margin_bps)}</span>.
            A margem acima supõe o bloco dividido; hoje ele não está.</>,
        })}</p>
      </div>

      {/* Why a sponsor pays for a tool rather than a spreadsheet. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label={tr({ en: "Proofs on chain", pt: "Provas em cadeia" })} value={formatNumber(evidence.proofs)}
          hint={tr({ en: `${formatNumber(evidence.facts)} facts recorded`, pt: `${formatNumber(evidence.facts)} fatos registrados` })} />
        <StatTile label={tr({ en: "Per participant", pt: "Por participante" })}
          value={formatNumber(evidence.proofs_per_participant ?? 0, { maximumFractionDigits: 1 })}
          hint={tr({ en: "checkable by someone else", pt: "conferível por outra pessoa" })} />
        <StatTile label={tr({ en: "Cost per proof", pt: "Custo por prova" })} value={money(evidence.cost_per_proof_cents)}
          hint={tr({ en: "EmpowerFI's own cost", pt: "custo da própria EmpowerFI" })} />
      </div>

      {/* The card's own note is written for whoever reads the database; what
          belongs here is where the price came from. */}
      <p className="text-xs text-muted-foreground">
        {tr({
          en: <>Priced by card <span className="text-foreground">{pricing.version}</span>, {CARD_SOURCE[pricing.source]}: {money(pricing.seat_cents)} per
            participant-month with a {money(pricing.floor_cents)} floor, set against Musoni's €3 per client for microfinance core banking and a
            median institution's US$ 106.7 per borrower a year. The pilot replaces it with a signed contract.</>,
          pt: <>Precificado pela tabela <span className="text-foreground">{pricing.version}</span>, {CARD_SOURCE[pricing.source]}: {money(pricing.seat_cents)} por
            participante-mês com piso de {money(pricing.floor_cents)}, ancorado nos €3 por cliente do Musoni, core banking de microfinanças, e nos
            US$ 106,7 por mutuário ao ano de uma instituição mediana. O piloto troca isso por um contrato assinado.</>,
        })}
      </p>
    </section>
  );
}
