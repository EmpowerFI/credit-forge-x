// A sponsored impact programme: what the sponsor gets, and what it never gets.
//
// A company pays for a cohort. In return it receives three things, and the
// boundary between them is the whole design:
//
//   · measured impact, which comes from the live records and is already what
//     Impact Intelligence computes — aggregates only, groups under five
//     hidden, outcomes only where she consented;
//   · recognition in the journey its money paid for, stated once where it is
//     relevant rather than stamped on every screen;
//   · brand lift, which is the sponsor's own question — did paying for this
//     change how participants see us — answered in aggregate and never per
//     person.
//
// What it never receives is a participant. No name, no business, no figure she
// reported, no answer she gave. A sponsor reading this dashboard cannot reach a
// person through it, and that is enforced in the database by row-level security
// rather than by this file's good intentions.
//
// SPONSORS below is demo configuration, matched by the sponsor's name. There is
// no sponsor-administration product here and this iteration does not build one:
// the point is to show a prospective sponsor what the layer looks like, so one
// fictional company is enough. BRAND_LIFT is likewise demo data, labelled as
// such everywhere it is drawn, because no participant has ever been asked these
// questions and inventing a measured answer is the one thing this product
// exists to argue against.

import { useQuery } from "@tanstack/react-query";

import { localized } from "../i18n";
import { platform } from "./platform";

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

/**
 * One perception question, asked of participants and reported only as a share.
 *
 * `before` is what the cohort answered when it started and `now` is where it
 * stands — the pair is the measurement, because a single number says nothing
 * about whether sponsoring the programme changed anything.
 */
export interface BrandLift {
  id: string;
  label: string;
  /** The question as a participant would have been asked it. */
  question: string;
  before: number;
  now: number;
}

export const BRAND_LIFT: BrandLift[] = localized([
  {
    id: "awareness",
    label: { en: "Sponsor awareness", pt: "Conhecimento da patrocinadora" },
    question: { en: "Before joining this program, did you know NOVA?", pt: "Antes de entrar neste programa, você conhecia a NOVA?" },
    before: 32, now: 68,
  },
  {
    id: "perception",
    label: { en: "Positive perception", pt: "Percepção positiva" },
    question: { en: "How has your perception of NOVA changed since joining?", pt: "Como sua percepção da NOVA mudou desde que você entrou?" },
    before: 41, now: 71,
  },
  {
    id: "association",
    label: { en: "Supports women entrepreneurs", pt: "Apoia mulheres empreendedoras" },
    question: { en: "Do you associate NOVA with supporting women entrepreneurs?", pt: "Você associa a NOVA ao apoio a mulheres empreendedoras?" },
    before: 28, now: 76,
  },
  {
    id: "consideration",
    label: { en: "Consideration", pt: "Consideração" },
    question: { en: "Would you consider NOVA when looking for relevant products or services?", pt: "Você consideraria a NOVA ao procurar produtos ou serviços relevantes?" },
    before: 35, now: 58,
  },
]);

/** What `my_program_sponsorship()` returns: a programme and its sponsor, never a budget. */
export interface SponsorshipRow {
  program_id: string;
  program_name: string;
  description: string | null;
  period_start: string;
  period_end: string;
  sponsor_name: string;
  sponsor_kind: string;
  is_simulated: boolean;
}

/** The programme and sponsor behind the caller's own community, or nothing. */
export function useMySponsorship(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "my-sponsorship"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // `platform.types.ts` is generated from the pushed schema (`npm run
      // platform:types`), so this function is not in it until its migration is
      // applied. The cast is the bridge, and it goes away on the next
      // generation rather than staying as a permanent escape hatch.
      const { data, error } = await (platform.rpc as unknown as
        (fn: string) => Promise<{ data: SponsorshipRow[] | null; error: { message: string } | null }>)("my_program_sponsorship");
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });
}
