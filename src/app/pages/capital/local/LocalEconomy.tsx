import { useState } from "react";
import { Building2, Coins, ShieldCheck, Sprout, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LoadError from "../../../components/LoadError";
import PageHeader from "../../../components/product/PageHeader";
import Panel from "../../../components/product/Panel";
import StatTile from "../../../components/product/StatTile";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { prototypeNotice } from "../../../lib/capital";
import { EVIDENCE } from "../../../lib/evidence";
import { units, type LocalEconomyDashboard } from "../../../lib/localEconomy";
import { money } from "../../../lib/readiness";
import Ledger from "./Ledger";
import Metrics from "./Metrics";
import { useLocalEconomies, useLocalEconomy } from "./queries";

// The Local Economy Dashboard (addendum v3 §7.2).
//
// Global capital reaches a business, and then what? Until the rail existed the
// answer ended at her bank account. This screen is the answer: how much trade
// each unit of capital produced inside the territory, how much of it stayed,
// how fast it moved, and how much of it came from abroad at all.
//
// Every number is arithmetic over local_transactions, computed in the database
// and never here — §12 forbids a presentation value, and two places computing a
// multiplier would be two multipliers. If the ledger recorded a shorter loop the
// numbers come out smaller, and the screen reports the smaller numbers.
//
// The guardrail below is not decoration. §8 says in the addendum's own words
// that these measure network activity and prove nothing causal about
// prosperity, and a dashboard that shows a multiplier without saying so is
// making the claim the addendum refuses to make.

const CIRCULATING = ["productive_purchase", "merchant_payment", "transfer"];

function Body({ d }: { d: LocalEconomyDashboard }) {
  const code = d.economy.currency_code;
  const label = EVIDENCE[d.evidence_status];
  // The movements behind this tile's own figure, not every movement the ledger
  // holds: an injection and a redemption are not trade inside the territory,
  // and counting them here would put a number beside an amount it did not make.
  const traded = d.by_type.filter((t) => CIRCULATING.includes(t.tx_type))
    .reduce((n, t) => n + t.movements, 0);

  return (
    <>
      <Metrics d={d} />

      <Panel
        title={tr({ en: "What the ledger holds", pt: "O que o razão guarda" })}
        description={tr({
          en: "The sums the four figures above divide, and the businesses they passed through.",
          pt: "As somas que as quatro medidas acima dividem, e os negócios por onde passaram.",
        })}
        actions={
          <>
            <StatusPill tone={label.tone} dot={false}>{label.label}</StatusPill>
            {d.conserved && d.supply_matches_balances ? (
              <StatusPill tone="positive" dot={false}>
                <ShieldCheck size={11} className="mr-0.5" aria-hidden />
                {tr({ en: "Balances sum to zero", pt: "Saldos somam zero" })}
              </StatusPill>
            ) : (
              <StatusPill tone="alert">{tr({ en: "Ledger does not balance", pt: "O razão não fecha" })}</StatusPill>
            )}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <StatTile
            label={tr({ en: "Capital placed on the rail", pt: "Capital colocado no trilho" })}
            value={units(d.injected_units, code)}
            hint={tr({ en: `${money(d.injected_brl_cents)} disbursed`, pt: `${money(d.injected_brl_cents)} desembolsados` })}
            icon={<Coins size={14} aria-hidden />}
          />
          <StatTile
            label={tr({ en: "Traded inside the territory", pt: "Negociado dentro do território" })}
            value={units(d.circulated_units, code)}
            hint={traded === 1
              ? tr({ en: "across 1 movement", pt: "em 1 movimento" })
              : tr({ en: `across ${traded} movements`, pt: `em ${traded} movimentos` })}
            hintTone="positive"
            icon={<Sprout size={14} aria-hidden />}
          />
          <StatTile
            label={tr({ en: "Businesses the capital reached", pt: "Negócios que o capital alcançou" })}
            value={d.merchants_paid + d.businesses_funded}
            hint={tr({
              en: `${d.businesses_funded} funded, ${d.merchants_paid} supplying; ${d.merchants_spent_onward} passed it on`,
              pt: `${d.businesses_funded} financiados, ${d.merchants_paid} fornecendo; ${d.merchants_spent_onward} repassaram adiante`,
            })}
            hintTone={d.merchants_spent_onward > 0 ? "positive" : "neutral"}
            icon={<Building2 size={14} aria-hidden />}
          />
          <StatTile
            label={tr({ en: "Cashed out for reais", pt: "Sacado em reais" })}
            value={units(d.redeemed_units, code)}
            hint={d.redemptions === 1
              ? tr({ en: "1 redemption, simulated", pt: "1 resgate, simulado" })
              : tr({ en: `${d.redemptions} redemptions, simulated`, pt: `${d.redemptions} resgates, simulados` })}
            hintTone="caution"
            icon={<TrendingDown size={14} aria-hidden />}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {tr({
            en: `${units(d.circulating_units, code)} is still in circulation, held across ${d.accounts} accounts. What the treasury is short by is exactly that, which is how a ledger of ${d.movements} movements can be checked in one subtraction rather than read line by line.`,
            pt: `${units(d.circulating_units, code)} seguem em circulação, distribuídos por ${d.accounts} contas. O que falta na tesouraria é exatamente isso, que é como um razão de ${d.movements} movimentos pode ser conferido numa subtração em vez de linha a linha.`,
          })}
        </p>
      </Panel>

      <Ledger d={d} />

      {/* Addendum v3 §8, in the addendum's own words. It belongs on the screen
          and not behind a disclosure, because the number it qualifies is the
          largest thing on the page. */}
      <Panel
        title={tr({ en: "What these numbers do not prove", pt: "O que estes números não provam" })}
        actions={<StatusPill tone="caution" dot={false}>{tr({ en: "Read this with the figures", pt: "Leia isto junto com as medidas" })}</StatusPill>}
      >
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>{tr({
            en: "The multiplier, the retention rate and the velocity measure network activity. They do not by themselves prove causal economic impact.",
            pt: "O multiplicador, a taxa de retenção e a velocidade medem atividade de rede. Sozinhos, eles não provam impacto econômico causal.",
          })}</li>
          <li>{tr({
            en: `${d.economy.name} is a clearly labelled sandbox. It is not a municipal or community currency, in production or in intent: nothing is issued, nothing is custodied, and ${code} cannot be spent outside this demonstration.`,
            pt: `${d.economy.name} é um sandbox claramente rotulado. Não é uma moeda municipal nem comunitária, nem em produção nem em intenção: nada é emitido, nada é custodiado, e ${code} não pode ser gasto fora desta demonstração.`,
          })}</li>
          <li>{tr({
            en: "A redemption sends no Pix and no institution converts anything. The row exists so that retention has a denominator that is not a guess.",
            pt: "Um resgate não envia Pix e nenhuma instituição converte nada. A linha existe para que a retenção tenha um denominador que não seja um chute.",
          })}</li>
          <li className="num">{tr({
            en: `Parity: ${d.economy.parity_reference}. Model ${d.model_version}.`,
            pt: `Paridade: ${d.economy.parity_reference}. Modelo ${d.model_version}.`,
          })}</li>
        </ul>
      </Panel>
    </>
  );
}

export default function LocalEconomy() {
  const [chosen, setChosen] = useState<string | null>(null);
  const economies = useLocalEconomies();
  const dashboard = useLocalEconomy(chosen);

  const rows = economies.data ?? [];
  const error = economies.error ?? dashboard.error;
  const d = dashboard.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tr({ en: "Credit & Capital Operator", pt: "Operação de Crédito e Capital" })}
        title={tr({ en: "Local Economy", pt: "Economia Local" })}
        description={tr({
          en: "Capital reached a business, and then what? What each unit produced inside the territory, how much of it stayed, and how much of it came from abroad.",
          pt: "O capital chegou a um negócio, e depois? O que cada unidade produziu dentro do território, quanto disso ficou, e quanto veio de fora.",
        })}
        meta={<StatusPill tone="caution" dot={false}>{tr({ en: "Simulated rail", pt: "Trilho simulado" })}</StatusPill>}
        about={
          <>
            <p>
              {tr({
                en: "Every figure is arithmetic over the rail's own movements, computed in the database. No number on this screen is stored, configured or targeted: a shorter loop in the ledger produces smaller figures and the screen reports the smaller figures.",
                pt: "Toda medida é aritmética sobre os movimentos do próprio trilho, calculada no banco. Nenhum número desta tela é armazenado, configurado ou uma meta: um laço mais curto no razão produz medidas menores, e a tela informa as medidas menores.",
              })}
            </p>
            <p>
              {tr({
                en: "Local circulation counts purchases, payments between merchants and sales back to the business — movements between participants inside the territory. It excludes redemption, which is capital leaving the rail, and repayment, which returns it to the issuer. Counting a redemption as circulation would inflate the multiplier with the exact movement that is leakage.",
                pt: "A circulação local conta compras, pagamentos entre comerciantes e vendas de volta para o negócio — movimentos entre participantes dentro do território. Ela exclui o resgate, que é capital saindo do trilho, e o pagamento da parcela, que o devolve ao emissor. Contar um resgate como circulação inflaria o multiplicador justamente com o movimento que é vazamento.",
              })}
            </p>
            <p>
              {tr({
                en: "Velocity divides local circulation by the units still in circulation, read at this instant rather than averaged over a period, because this ledger is hours old and an average over hours would be a more complicated way of saying the same thing.",
                pt: "A velocidade divide a circulação local pelas unidades ainda em circulação, lidas neste instante e não como média de um período, porque este razão tem horas de vida e uma média de horas seria um jeito mais complicado de dizer a mesma coisa.",
              })}
            </p>
            <p>{prototypeNotice()}</p>
          </>
        }
        actions={rows.length > 1 ? (
          <Select value={chosen ?? rows[0]?.id ?? ""} onValueChange={setChosen}>
            <SelectTrigger className="w-64" aria-label={tr({ en: "Territory", pt: "Território" })}><SelectValue /></SelectTrigger>
            <SelectContent>{rows.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : undefined}
      />

      {error ? (
        <LoadError error={error} onRetry={() => { void economies.refetch(); void dashboard.refetch(); }} />
      ) : economies.isLoading || dashboard.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : !d ? (
        // No territory in this product has a rail, or none this account may
        // open. Most territories do not, which is the honest arrangement: the
        // capital network then says LOCAL_RAIL_UNAVAILABLE on their plans and a
        // reader can put two plans side by side.
        <Panel title={tr({ en: "No territory here has a local rail", pt: "Nenhum território aqui tem trilho local" })}>
          <p className="text-sm text-muted-foreground">
            {tr({
              en: "A local economy is a demonstration run in one territory at a time. Where there is none, capital is disbursed in reais as it always was, and the capital network says so on every plan it writes for that territory.",
              pt: "Uma economia local é uma demonstração feita em um território por vez. Onde não há nenhuma, o capital é desembolsado em reais como sempre foi, e a rede de capital diz isso em todo plano que escreve para aquele território.",
            })}
          </p>
        </Panel>
      ) : (
        <Body d={d} />
      )}
    </div>
  );
}
