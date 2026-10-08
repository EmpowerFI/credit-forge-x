// A sponsored impact programme: what the sponsor gets, and what it never gets.
//
// A company pays for a cohort. In return it receives exactly two things:
//
//   · measured impact, which comes from the live records and is already what
//     Impact Intelligence computes — aggregates only, groups under five
//     hidden, outcomes only where she consented;
//   · its name in front of the cohort it funds, stated once in her journey
//     rather than stamped on every screen.
//
// There was a third, and taking it out is the decision this file records. Brand
// lift — did paying for this change how participants see us — cannot be
// answered without asking them, and EmpowerFI does not turn a participant into
// a survey respondent. She is here for her business, and a woman part-way
// through a credit assessment does not experience an optional question as
// optional. So the questions are not asked, the perception figures they would
// have produced are not shown, and what the sponsor sees instead is exposure:
// arithmetic on the programme's own configuration, with nothing tracked about
// her to produce it.
//
// A sponsor is owed its name in front of the cohort it funds. It is not owed
// the cohort's attention, and it is not owed the cohort's opinion. The product
// measures impact, not marketing.
//
// What it never receives is a participant. No name, no business, no figure she
// reported. A sponsor reading this dashboard cannot reach a person through it,
// and that is enforced in the database by row-level security rather than by
// this file's good intentions.
//
// SPONSORS below is demo configuration, matched by the sponsor's name. There is
// no sponsor-administration product here and this iteration does not build one:
// the point is to show a prospective sponsor what the layer looks like, so one
// sponsor is enough.
//
// That sponsor is now a real organisation named as a hypothesis, at the
// founder's decision (8 Oct) and against my advice: she wants the ESG dashboard
// to show the kind of sponsor this layer is for, and the Solana Foundation is
// the recognisable example in the ecosystem this is submitted to. It does not
// sponsor this programme and has no relationship with EmpowerFI.
//
// So `hypothetical` and `disclosure` exist, and two rules hold them:
//
//   · **The label travels with the name.** Every place the name is rendered
//     renders the disclaimer in the same visual unit, so a cropped screenshot
//     or a paused video frame cannot carry the claim without the correction.
//   · **No mark is drawn for it.** `SponsorWordmark` invents a corporate
//     wordmark; inventing one for a real organisation is manufacturing its
//     branding, which is a different and worse thing than naming it. A
//     hypothetical sponsor is set in the page's own type.
//
// Both rules are structural: the renderers branch on `hypothetical`, so adding
// a real name without a disclaimer is not a thing this configuration can
// express.

import { useQuery } from "@tanstack/react-query";

import { localized } from "../i18n";
import { platform } from "./platform";
import type { Database } from "./platform.types";

/** A sponsor this build knows how to dress a programme for. */
export interface Sponsorship {
  /** Matched against `sponsors.name`, case-insensitively. */
  sponsor: string;
  /** How the programme is introduced to a participant. */
  enables: string;
  /** Why the sponsor says it is paying. Informational, never an offer. */
  because: string;
  /**
   * Set when the sponsor is a real organisation named as an illustration. A
   * short line for the slots beside the name; its presence also suppresses the
   * drawn wordmark. See this file's header for why both.
   */
  hypothetical?: string;
  /** The same thing said in full, for a panel with room for a sentence. */
  disclosure?: string;
}

export const SPONSORS: Sponsorship[] = localized([
  {
    sponsor: "Solana Foundation",
    enables: {
      en: "In this example, the journey is offered with the support of the Solana Foundation.",
      pt: "Neste exemplo, a jornada é oferecida com o apoio da Solana Foundation.",
    },
    // Conditional on purpose: a reason attributed to an organisation that never
    // gave one would be words in its mouth, so this is the reason such a
    // sponsor would have, said as ours.
    because: {
      en: "An example of why an ecosystem foundation would fund a cohort like this one: preparing entrepreneurs for credit, and measuring what changed in their businesses. It is not a statement by the Solana Foundation.",
      pt: "Um exemplo de por que uma fundação de ecossistema financiaria uma turma como esta: preparar empreendedoras para o crédito e medir o que mudou nos negócios delas. Não é uma declaração da Solana Foundation.",
    },
    hypothetical: {
      en: "Hypothetical example · not a sponsor of this program",
      pt: "Exemplo hipotético · não patrocina este programa",
    },
    disclosure: {
      en: "The Solana Foundation is named here as a hypothetical sponsor, to show what this layer looks like for the kind of funder it is built for. It does not sponsor this program, it has no relationship with EmpowerFI, and nothing on this page came from it.",
      pt: "A Solana Foundation é nomeada aqui como patrocinadora hipotética, para mostrar como esta camada funciona para o tipo de financiador a que ela se destina. Ela não patrocina este programa, não tem relação com a EmpowerFI, e nada nesta página veio dela.",
    },
  },
]);

/** The demo dressing for a sponsor, or nothing — an unknown sponsor is drawn plainly. */
export const sponsorshipFor = (sponsorName: string | null | undefined): Sponsorship | null =>
  SPONSORS.find((s) => s.sponsor.toLowerCase() === (sponsorName ?? "").trim().toLowerCase()) ?? null;

/** What `my_program_sponsorship()` returns: a programme and its sponsor, never a budget. */
export type SponsorshipRow = Database["public"]["Functions"]["my_program_sponsorship"]["Returns"][number];

/** The programme and sponsor behind the caller's own community, or nothing. */
export function useMySponsorship(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "my-sponsorship"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await platform.rpc("my_program_sponsorship");
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
}
