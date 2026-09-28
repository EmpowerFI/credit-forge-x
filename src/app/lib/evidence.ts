import { localized } from "../i18n";
import type { Tone } from "../components/product/StatusPill";

// The four words every number in this product is allowed to carry (addendum
// v3 §9). A judge reading a screen and a judge reading the addendum should be
// reading the same vocabulary, so this is the addendum's list and not a
// synonym of it.
//
// The order below is the order of strength. An aggregate is only as strong as
// its weakest input — one simulated row makes the total a simulated assumption
// — and `weakest()` is where that rule lives so no screen has to restate it.

export type EvidenceLabel =
  | "observed_pilot_data"
  | "partner_provided"
  | "simulated_assumption"
  | "external_benchmark";

const STRENGTH: Record<EvidenceLabel, number> = {
  observed_pilot_data: 3,
  partner_provided: 2,
  external_benchmark: 1,
  simulated_assumption: 0,
};

export const EVIDENCE: Record<EvidenceLabel, { label: string; means: string; tone: Tone }> = localized({
  observed_pilot_data: {
    label: { en: "Observed", pt: "Observado" },
    means: {
      en: "Recorded by someone in the pilot doing the thing it describes.",
      pt: "Registrado por alguém no piloto fazendo aquilo que o número descreve.",
    },
    tone: "positive",
  },
  partner_provided: {
    label: { en: "From a partner", pt: "De um parceiro" },
    means: {
      en: "Stated by the institution it belongs to, and not independently checked here.",
      pt: "Declarado pela instituição a que pertence, e não verificado aqui de forma independente.",
    },
    tone: "info",
  },
  simulated_assumption: {
    label: { en: "Simulated", pt: "Simulado" },
    means: {
      en: "Produced by this prototype from assumptions. Nobody paid it and nobody received it.",
      pt: "Produzido por este protótipo a partir de premissas. Ninguém pagou e ninguém recebeu.",
    },
    tone: "caution",
  },
  external_benchmark: {
    label: { en: "External benchmark", pt: "Referência externa" },
    means: {
      en: "Taken from published work about comparable programs, not from this one.",
      pt: "Tirado de trabalhos publicados sobre programas comparáveis, não deste aqui.",
    },
    tone: "neutral",
  },
});

/** The label an aggregate may carry, given the labels of what went into it. */
export function weakest(labels: EvidenceLabel[]): EvidenceLabel {
  return labels.reduce<EvidenceLabel>(
    (w, l) => (STRENGTH[l] < STRENGTH[w] ? l : w),
    labels[0] ?? "simulated_assumption",
  );
}
