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
// fictional company is enough.

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
}

export const SPONSORS: Sponsorship[] = localized([
  {
    sponsor: "NOVA",
    enables: {
      en: "This journey is offered with the support of NOVA.",
      pt: "Esta jornada é oferecida com o apoio da NOVA.",
    },
    because: {
      en: "NOVA is supporting this program to help women entrepreneurs strengthen their businesses and their financial readiness.",
      pt: "A NOVA apoia este programa para ajudar mulheres empreendedoras a fortalecer seus negócios e seu preparo financeiro.",
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
