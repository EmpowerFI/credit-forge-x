import { localized } from "../../../i18n";
import type { EngineOpportunity } from "../../../lib/engine";

export const QUEUE_STATUS = localized({
  waiting: { en: "Waiting for capital", pt: "Aguardando capital" },
  open: { en: "Open to investors", pt: "Aberta a investidores" },
  partially_funded: { en: "Partially funded", pt: "Parcialmente captada" },
  funded: { en: "Funded, to formalise", pt: "Captada, a formalizar" },
  in_review: { en: "Held for review", pt: "Em revisão" },
});

export const queueStatus = (o: EngineOpportunity) =>
  o.status === "in_review" ? "in_review" : ((o.funding_status ?? "waiting") as keyof typeof QUEUE_STATUS);

export const statusTone = (s: keyof typeof QUEUE_STATUS) =>
  s === "waiting" || s === "in_review" ? "caution" : s === "funded" ? "positive" : "info";
