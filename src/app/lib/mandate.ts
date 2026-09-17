import type { Database } from "./platform.types";
import { localized } from "../i18n";

// An investor's mandate (refactor spec §6), matched against what every investor
// already sees of an opportunity: the community's state, its purpose and sector,
// the ticket, the risk grade, the funding route, and whether the business is in
// a verified community. An empty list means any.

export type Mandate = Database["public"]["Tables"]["investor_mandates"]["Row"];

export interface MandateSubject {
  amount_cents: number;
  purpose: string;
  business_sector: string | null;
  risk_band: string;
  funding_pool: string | null;
  community_state: string | null;
  /** In a verified community: what an impact mandate asks for. */
  community_name: string | null;
}

export type MandateCheckId = "impact" | "geography" | "purpose" | "sector" | "ticket" | "risk" | "route";

export interface MandateCheck { id: MandateCheckId; passed: boolean }

/** Only the checks the mandate sets; an opportunity matches when all of them pass. */
export function mandateChecks(m: Mandate, o: MandateSubject): MandateCheck[] {
  const checks: MandateCheck[] = [];
  if (m.impact_mandate) checks.push({ id: "impact", passed: Boolean(o.community_name) });
  if (m.states.length) checks.push({ id: "geography", passed: Boolean(o.community_state && m.states.includes(o.community_state)) });
  if (m.purposes.length) checks.push({ id: "purpose", passed: (m.purposes as string[]).includes(o.purpose) });
  if (m.sectors.length) checks.push({ id: "sector", passed: Boolean(o.business_sector && m.sectors.includes(o.business_sector)) });
  if (m.min_ticket_cents !== null || m.max_ticket_cents !== null) {
    checks.push({
      id: "ticket",
      passed: (m.min_ticket_cents === null || o.amount_cents >= m.min_ticket_cents) && (m.max_ticket_cents === null || o.amount_cents <= m.max_ticket_cents),
    });
  }
  if (m.risk_bands.length) checks.push({ id: "risk", passed: (m.risk_bands as string[]).includes(o.risk_band) });
  if (m.pools.length) checks.push({ id: "route", passed: Boolean(o.funding_pool && (m.pools as string[]).includes(o.funding_pool)) });
  return checks;
}

export const matchesMandate = (m: Mandate | null | undefined, o: MandateSubject) => !m || mandateChecks(m, o).every((c) => c.passed);

export const MANDATE_CHECK_LABEL: Record<MandateCheckId, string> = localized({
  impact: { en: "impact mandate", pt: "mandato de impacto" },
  geography: { en: "geography", pt: "território" },
  purpose: { en: "purpose", pt: "finalidade" },
  sector: { en: "sector", pt: "setor" },
  ticket: { en: "ticket", pt: "ticket" },
  risk: { en: "risk appetite", pt: "apetite a risco" },
  route: { en: "route", pt: "rota" },
});
