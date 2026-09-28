import { ArrowLeftRight, ExternalLink, Gauge, Globe2, Repeat } from "lucide-react";
import { tr } from "../../../i18n";
import { benchmark, share, times, units, type Benchmark, type LocalEconomyDashboard } from "../../../lib/localEconomy";

// The four questions the addendum asks of a local rail (v3 §7.2, §8), each with
// the division that produced it written underneath. A metric whose arithmetic is
// hidden is a metric a reader has to trust; this product's whole argument is
// that nobody should have to.
//
// The headline is LM3, the New Economics Foundation's Local Multiplier 3, and
// not a ratio of our own: LM3 runs 1 to 3, everyone in local economic
// development knows what 1.9 means, and a number nobody can compare to anything
// is an assertion however honestly it was derived.
//
// Where a published figure exists for the same thing, it sits on the card. Ours
// is a demonstration loop and it leaks less than a municipality does — showing
// the two together is the difference between a measurement and a boast.

function Cite({ b }: { b: Benchmark }) {
  return (
    <a
      href={b.source_url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 rounded text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {b.source}{b.observed_period ? `, ${b.observed_period}` : ""}
      <ExternalLink size={10} aria-hidden />
    </a>
  );
}

function Metric({ icon, label, value, formula, reading, against }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  formula: string;
  reading: string;
  against?: React.ReactNode;
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
      {against && (
        <div className="mt-auto border-t border-border/60 pt-2 text-xs text-muted-foreground">{against}</div>
      )}
    </div>
  );
}

export default function Metrics({ d }: { d: LocalEconomyDashboard }) {
  const u = (n: number) => units(n, d.economy.currency_code);
  const mumbuca = benchmark(d, "mumbuca_retention");
  const ceiling = benchmark(d, "lm3_ceiling");

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <Metric
        icon={<Repeat size={14} aria-hidden />}
        label={tr({ en: "Local Multiplier 3", pt: "Multiplicador Local 3 (LM3)" })}
        value={times(d.lm3_bps)}
        formula={`(${u(d.round_1_units)} + ${u(d.round_2_units)} + ${u(d.round_3_units)}) ÷ ${u(d.round_1_units)}`}
        reading={tr({
          en: "Capital in, what she spent inside the territory, and what those merchants spent locally in turn.",
          pt: "Capital que entrou, o que ela gastou dentro do território, e o que aqueles comerciantes gastaram localmente em seguida.",
        })}
        against={ceiling && (
          <p>
            {tr({
              en: "LM3 stops at three rounds, so 3.00 is its ceiling and a fourth hop is real activity it does not count — the measure is a floor, not a total. Method: ",
              pt: "O LM3 para na terceira rodada, então 3,00 é o teto dele e um quarto salto é atividade real que ele não conta — a medida é um piso, não um total. Método: ",
            })}
            <Cite b={ceiling} />
          </p>
        )}
      />
      <Metric
        icon={<ArrowLeftRight size={14} aria-hidden />}
        label={tr({ en: "Local retention rate", pt: "Taxa de retenção local" })}
        value={share(d.retention_bps)}
        formula={`(${u(d.round_1_units)} − ${u(d.redeemed_units)}) ÷ ${u(d.round_1_units)}`}
        reading={tr({
          en: "Of the capital placed on the rail, the share that has not been cashed out for reais. Redemption is the only way out.",
          pt: "Do capital colocado no trilho, a parte que não foi sacada em reais. O resgate é a única saída.",
        })}
        against={mumbuca && (
          <p>
            {/* Ours is a demonstration loop of a few movements and it leaks far
                less than a municipality of 133,000 people does. Printing the
                flattering figure alone would be the easy thing here. */}
            {tr({
              en: `Mumbuca, in Maricá, retained ${share(mumbuca.value_bps ?? 0)}. A demonstration loop leaks less than a municipality does, so read the gap as the distance to reality, not as an advantage. `,
              pt: `A Mumbuca, em Maricá, reteve ${share(mumbuca.value_bps ?? 0)}. Um laço de demonstração vaza menos que um município, então leia a diferença como distância da realidade, não como vantagem. `,
            })}
            <Cite b={mumbuca} />
          </p>
        )}
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
      />
    </div>
  );
}
