// The consent an entrepreneur gives, in the words she sees (version
// consent-v2). The database stores which uses she allowed and this version;
// the chain stores a hash of the record. Changing the wording means a new
// version here and in docs/PRIVACY.md, and the database's consent_text_version().

export const CONSENT_TEXT_VERSION = "consent-v2";

export const SCOPES = ["assessment", "partner", "investors", "impact"] as const;
export type Scope = (typeof SCOPES)[number];
export type Choices = Record<Scope, boolean>;

export interface ScopeText {
  title: string;
  /** Her data this use reads. */
  uses: string;
  /** Who sees what comes of it. */
  who: string;
  /** What never leaves, whatever she chooses. */
  never: string;
  /** What happens without it. */
  without: string;
  /** The scope it builds on: no sharing of what is not assessed. */
  needs?: Scope;
}

export const SCOPE_TEXT: Record<Scope, ScopeText> = {
  assessment: {
    title: "Assess my business",
    uses: "My monthly check-ins, my education progress and my community's verification.",
    who: "Me, my community's leader, and EmpowerFI's auditors.",
    never: "My figures never go on chain: only a hash of each record does.",
    without: "I can keep reporting and learning, but nothing is assessed and I cannot ask for credit.",
  },
  partner: {
    title: "Share my request with EmpowerFI's P2P desk",
    uses: "My request, EmpowerFI's assessment of it, and my indicators, with sales and result rounded to R$ 100.",
    who: "EmpowerFI's P2P desk, which formalises and services loans funded by P2P investors.",
    never: "The desk sees a code, not my name, my business's name or my monthly figures.",
    without: "I cannot ask for credit here, because the desk has to see the request to formalise a loan.",
    needs: "assessment",
  },
  investors: {
    title: "Show my request to investors, without my name",
    uses: "Purpose, sector, amount, term, my community, and the grades of the assessment.",
    who: "Investors in EmpowerFI's console.",
    never: "My name, my words, my figures and my bank details. On chain, no investment points to me.",
    without: "My request cannot be funded: in this P2P model, investors fund every loan. If I withdraw this later, investors are refunded, unless the loan has already been paid out.",
    needs: "partner",
  },
  impact: {
    title: "Count my business in impact figures",
    uses: "Whether my sales changed after a loan, and how the capital was used.",
    who: "Only as totals, in my community's and EmpowerFI's reports.",
    never: "My figures on their own. A total never names anyone.",
    without: "My outcome is left out of the totals. Nothing else changes.",
  },
};

/** Turning a use off turns off what builds on it; turning one on turns on what it needs. */
export function setScope(choices: Choices, scope: Scope, on: boolean): Choices {
  const next = { ...choices, [scope]: on };
  if (!on) {
    for (const s of SCOPES) if (SCOPE_TEXT[s].needs === scope) Object.assign(next, setScope(next, s, false));
  } else {
    const needs = SCOPE_TEXT[scope].needs;
    if (needs && !next[needs]) Object.assign(next, setScope(next, needs, true));
  }
  return next;
}

export const NONE: Choices = { assessment: false, partner: false, investors: false, impact: false };
export const ALL: Choices = { assessment: true, partner: true, investors: true, impact: true };

export interface ConsentRecord {
  id: string;
  consent_no: number;
  text_version: string;
  assessment: boolean;
  partner: boolean;
  investors: boolean;
  impact: boolean;
  channel: "app" | "community";
  at: string;
  proof: { kind: string; entity_id: string; status: string; signature: string | null; reconcile: string | null } | null;
}

export const choicesOf = (r: Pick<ConsentRecord, Scope> | null | undefined): Choices =>
  r ? { assessment: r.assessment, partner: r.partner, investors: r.investors, impact: r.impact } : NONE;

export const sameChoices = (a: Choices, b: Choices) => SCOPES.every((s) => a[s] === b[s]);

/** What saving would change, in her words. */
export function consequences(from: Choices | null, to: Choices): string[] {
  const out: string[] = [];
  const was = from ?? NONE;
  if (was.assessment && !to.assessment) out.push("New assessments stop. The ones already made stay on record, with their proofs.");
  if (was.partner && !to.partner) out.push("New requests are not sent to EmpowerFI's P2P desk. Loans already formalised keep their obligations.");
  if (was.investors && !to.investors) out.push("An open request leaves the investor market, and anyone who funded it is refunded, unless the loan has already been paid out.");
  if (!was.investors && to.investors) out.push("An open request, never funded, is shown to investors without your name.");
  if (was.impact !== to.impact) out.push(to.impact ? "Your outcome will count in impact totals." : "Your outcome leaves the impact totals.");
  return out;
}

export const CHANNEL_LABEL: Record<ConsentRecord["channel"], string> = {
  app: "given in the app",
  community: "recorded by the community from the signed form",
};
