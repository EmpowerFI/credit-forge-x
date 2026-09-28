import { ArrowLeftRight, Gauge, Globe2, Repeat } from "lucide-react";
import StatusPill from "../../../components/product/StatusPill";
import { tr } from "../../../i18n";
import { EVIDENCE } from "../../../lib/evidence";
import { share, times, units, type LocalEconomyDashboard } from "../../../lib/localEconomy";

// The four questions the addendum asks of a local rail (v3 §7.2, §8), each with
// the division that produced it written underneath. A metric whose arithmetic is
// hidden is a metric a reader has to trust; this product's whole argument is
// that nobody should have to.

function Metric({ icon, label, value, formula, reading, evidence }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  formula: string;
  reading: string;
  evidence: React.ReactNode;
}) {
  return (
    <div className="panel flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-xs font-medium text-muted-foreground">{label}</p>
        <span className="shrink-0 text-muted-foreground">{icon}</span>
      </div>
      <p className="num font-heading text-3xl font-bold text-foreground">{value}</p>
      <div className="space-y-1.5">
        {/* The division itself, so the number can be checked against the ledger
            below rather than believed. */}
        <p className="num text-xs text-muted-foreground">{formula}</p>
        <p className="text-xs text-muted-foreground">{reading}</p>
      </div>
      <div>{evidence}</div>
    </div>
  );
}

export default function Metrics({ d }: { d: LocalEconomyDashboard }) {
  const code = d.economy.currency_code;
  // The same two decimals the rest of the product writes amounts in, so a
  // division on a tile can be checked against a figure in the ledger below
  // without the reader first deciding whether 8.700 and 8.700,00 are the same.
  const u = (n: number) => units(n, code);
  const label = EVIDENCE[d.evidence_status];
  const pill = (
    <StatusPill tone={label.tone} dot={false}>{label.label}</StatusPill>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <Metric
        icon={<Repeat size={14} aria-hidden />}
        label={tr({ en: "Local capital multiplier", pt: "Multiplicador de capital local" })}
        value={times(d.multiplier_bps)}
        formula={`${u(d.circulated_units)} ÷ ${u(d.injected_units)}`}
        reading={d.multiplier_bps >= 10000
          ? tr({
            en: "Each unit placed on the rail has already produced more than its own value in local trade.",
            pt: "Cada unidade colocada no trilho já produziu mais que o próprio valor em comércio local.",
          })
          : tr({
            en: "Circulation per unit injected. Below 1× means the capital has not finished moving — an ordinary state, not a failure.",
            pt: "Circulação por unidade injetada. Abaixo de 1× significa que o capital ainda não terminou de se mover — um estado comum, não uma falha.",
          })}
        evidence={pill}
      />
      <Metric
        icon={<ArrowLeftRight size={14} aria-hidden />}
        label={tr({ en: "Local retention rate", pt: "Taxa de retenção local" })}
        value={share(d.retention_bps)}
        formula={`(${u(d.injected_units)} − ${u(d.redeemed_units)}) ÷ ${u(d.injected_units)}`}
        reading={tr({
          en: "Of the capital placed on the rail, the share that has not been cashed out for reais. Redemption is the only way out.",
          pt: "Do capital colocado no trilho, a parte que não foi sacada em reais. O resgate é a única saída.",
        })}
        evidence={pill}
      />
      <Metric
        icon={<Gauge size={14} aria-hidden />}
        label={tr({ en: "Capital velocity", pt: "Velocidade do capital" })}
        value={times(d.velocity_bps)}
        formula={`${u(d.circulated_units)} ÷ ${u(d.circulating_units)}`}
        reading={tr({
          en: "Turns of the units still in circulation, read at this instant rather than averaged over a period.",
          pt: "Giros das unidades ainda em circulação, lidos neste instante e não como média de um período.",
        })}
        evidence={pill}
      />
      <Metric
        icon={<Globe2 size={14} aria-hidden />}
        label={tr({ en: "Global capital additionality", pt: "Adicionalidade do capital global" })}
        value={share(d.additionality_bps)}
        formula={d.loans_landed === 1
          ? tr({ en: "over 1 loan that landed here", pt: "sobre 1 empréstimo que aterrissou aqui" })
          : tr({ en: `over ${d.loans_landed} loans that landed here`, pt: `sobre ${d.loans_landed} empréstimos que aterrissaram aqui` })}
        reading={tr({
          en: "The share of what arrived on this rail that was funded from abroad — capital this territory would not otherwise have had.",
          pt: "A parte do que chegou neste trilho que foi financiada de fora — capital que este território não teria de outro modo.",
        })}
        evidence={pill}
      />
    </div>
  );
}
