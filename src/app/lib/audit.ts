import { localized } from "../i18n";
import type { AnchorKind } from "./platform";

/** The audit console's views, as paths under /app/audit. */
export const AUDIT_TABS = localized([
  { to: "", label: { en: "Attestations", pt: "Atestados" }, end: true },
  { to: "events", label: { en: "Events", pt: "Eventos" } },
  { to: "models", label: { en: "Models", pt: "Modelos" } },
  { to: "consents", label: { en: "Consents", pt: "Consentimentos" } },
  { to: "zcash", label: { en: "Zcash treasury", pt: "Tesouraria Zcash" } },
  { to: "system", label: { en: "System", pt: "Sistema" } },
  { to: "reports", label: { en: "Reports", pt: "Relatórios" } },
] as const);

export const PROOF_KIND_LABEL: Record<AnchorKind, string> = localized({
  community: { en: "Community registration", pt: "Cadastro da comunidade" },
  community_verification: { en: "Community verification", pt: "Verificação da comunidade" },
  enrollment: { en: "Borrower enrollment", pt: "Inscrição da empreendedora" },
  consent: { en: "Consent record", pt: "Registro de consentimento" },
  checkin: { en: "Monthly check-in", pt: "Check-in mensal" },
  readiness: { en: "Readiness assessment", pt: "Avaliação de prontidão" },
  eligibility: { en: "Eligibility assessment", pt: "Avaliação de elegibilidade" },
  opportunity: { en: "Qualified opportunity", pt: "Oportunidade qualificada" },
  loan: { en: "Loan terms", pt: "Condições do empréstimo" },
  loan_transition: { en: "Loan status change", pt: "Mudança de status do empréstimo" },
  payment: { en: "Instalment paid", pt: "Parcela paga" },
  outcome: { en: "Productive outcome", pt: "Resultado produtivo" },
  allocation: { en: "Capital allocation", pt: "Alocação de capital" },
  settlement_route: { en: "Settlement route", pt: "Rota de liquidação" },
  capital_route: { en: "Capital plan", pt: "Plano de capital" },
});

export const EVENT_LABEL: Record<string, string> = localized({
  community_registered: { en: "Community registered", pt: "Comunidade cadastrada" },
  community_verified: { en: "Community verified", pt: "Comunidade verificada" },
  enrolled: { en: "Participant enrolled", pt: "Participante inscrita" },
  consent: { en: "Consent recorded", pt: "Consentimento registrado" },
  checkin: { en: "Check-in reported", pt: "Check-in enviado" },
  readiness: { en: "Readiness assessed", pt: "Prontidão avaliada" },
  credit_intent: { en: "Credit requested", pt: "Crédito pedido" },
  eligibility: { en: "Eligibility assessed", pt: "Elegibilidade avaliada" },
  referred: { en: "Opened to P2P investors", pt: "Aberta a investidores P2P" },
  partner_decision: { en: "P2P desk decided", pt: "Decisão da mesa P2P" },
  loan: { en: "Loan status changed", pt: "Status do empréstimo mudou" },
  payment: { en: "Instalment paid", pt: "Parcela paga" },
  outcome: { en: "Outcome measured", pt: "Resultado medido" },
  investment: { en: "Capital allocated", pt: "Capital alocado" },
  refund: { en: "Refunded from the vault", pt: "Reembolsado do cofre" },
  outreach: { en: "Community outreach", pt: "Ação na comunidade" },
});

export const ACTOR_LABEL: Record<string, string> = localized({
  entrepreneur: { en: "Participant", pt: "Participante" },
  community_leader: { en: "Community leader", pt: "Líder da comunidade" },
  partner: { en: "Credit partner", pt: "Parceiro de crédito" },
  capital_provider: { en: "Investor", pt: "Investidor" },
  auditor: { en: "Auditor", pt: "Auditor" },
  admin: { en: "EmpowerFI admin", pt: "Admin EmpowerFI" },
  system: { en: "EmpowerFI engine", pt: "Motor EmpowerFI" },
});

/** The fields an assessment stores from the engine's result: what a re-run must reproduce. */
export const READINESS_RESULT_FIELDS = ["model_version", "status", "band", "score", "components", "missing_requirements", "reason_codes"] as const;
export const ELIGIBILITY_RESULT_FIELDS = [
  "model_version", "decision", "requested_amount_cents", "proposed_amount_cents", "term_months", "instalment_cents",
  "max_instalment_cents", "affordability_bps", "suggested_min_cents", "suggested_max_cents", "risk_band", "risk_points",
  "confidence", "reason_codes",
] as const;
