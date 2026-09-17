import type { Database } from "./platform.types";
import { formatDate, localized, tr } from "../i18n";

export type ReadinessStatus = Database["public"]["Enums"]["readiness_status"];
export type CreditPurpose = Database["public"]["Enums"]["credit_purpose"];

// The engine speaks in codes (packages/readiness-engine); people read these.

export const STATUS_LABEL: Record<ReadinessStatus, { title: string; summary: string; tone: string }> = localized({
  CREDIT_READY: {
    title: { en: "Ready for credit", pt: "Pronta para crédito" },
    summary: {
      en: "The business is prepared, with enough data behind the judgement.",
      pt: "O negócio está preparado, com dados suficientes para embasar a avaliação.",
    },
    tone: "tone-positive",
  },
  NEEDS_MORE_DATA: {
    title: { en: "Needs more data", pt: "Precisa de mais dados" },
    summary: {
      en: "The business is running; the record of it is still too thin.",
      pt: "O negócio está funcionando; o histórico dele ainda é pequeno demais.",
    },
    tone: "tone-info",
  },
  NEEDS_PREPARATION: {
    title: { en: "Needs more preparation", pt: "Precisa de mais preparo" },
    summary: {
      en: "Organisation or education is still in progress.",
      pt: "A organização ou a educação ainda estão em andamento.",
    },
    tone: "tone-caution",
  },
  MANUAL_REVIEW: {
    title: { en: "Manual review", pt: "Revisão manual" },
    summary: {
      en: "The figures need a person to look at them before the rules decide.",
      pt: "Os números precisam ser vistos por uma pessoa antes que as regras decidam.",
    },
    tone: "tone-neutral",
  },
});

interface Requirement {
  code: string;
  current: number | null;
  required: number;
}

export function describeRequirement(r: Requirement): string {
  const current = r.current ?? 0;
  switch (r.code) {
    case "COMMUNITY_NOT_VERIFIED":
      return tr({ en: "Join a community EmpowerFI has verified.", pt: "Entre em uma comunidade verificada pela EmpowerFI." });
    case "CORE_EDUCATION_INCOMPLETE":
      return tr({
        en: `Finish the credit readiness programme — ${current} of ${r.required} modules done.`,
        pt: `Conclua o programa de prontidão para crédito — ${current} de ${r.required} módulos feitos.`,
      });
    case "RECORD_KEEPING": {
      const share = Math.round(current / 100);
      return tr({
        en: `Record every sale — you did in ${share}% of recent months; two in three is the bar.`,
        pt: `Registre todas as vendas — você registrou em ${share}% dos meses recentes; o mínimo é dois em cada três.`,
      });
    }
    case "CASH_FLOW_NOT_POSITIVE":
      return tr({
        en: `Bring in more than the business spends — ${current} of your last 3 months were positive; ${r.required} are needed.`,
        pt: `Faça o negócio ganhar mais do que gasta — ${current} dos seus últimos 3 meses foram positivos; são necessários ${r.required}.`,
      });
    case "INSUFFICIENT_HISTORY":
      return tr({
        en: `Report more months — ${current} so far in the last six; ${r.required} are needed.`,
        pt: `Informe mais meses — ${current} até agora nos últimos seis; são necessários ${r.required}.`,
      });
    case "IRREGULAR_REPORTING":
      return tr({
        en: `Report month after month — your current run is ${current}; ${r.required} in a row are needed.`,
        pt: `Informe mês após mês — sua sequência atual é de ${current}; são necessários ${r.required} seguidos.`,
      });
    case "STALE_REPORTING":
      return r.current === null
        ? tr({ en: "Send your first monthly check-in.", pt: "Envie seu primeiro check-in mensal." })
        : tr({
            en: `Report this month — your last check-in was ${r.current} months ago.`,
            pt: `Informe este mês — seu último check-in foi há ${r.current} meses.`,
          });
    default:
      return r.code;
  }
}

export const REASON_LABEL: Record<string, { text: string; positive: boolean }> = localized({
  EDUCATION_COMPLETE: { text: { en: "Readiness programme completed", pt: "Programa de prontidão concluído" }, positive: true },
  KEEPS_RECORDS: { text: { en: "Every sale recorded", pt: "Todas as vendas registradas" }, positive: true },
  CONSISTENT_REPORTING: { text: { en: "Six months reported in a row", pt: "Seis meses informados seguidos" }, positive: true },
  POSITIVE_CASH_FLOW: { text: { en: "Positive cash flow, three months running", pt: "Fluxo de caixa positivo, três meses seguidos" }, positive: true },
  STEADY_REVENUE: { text: { en: "Steady revenue", pt: "Receita estável" }, positive: true },
  GROWING_REVENUE: { text: { en: "Revenue growing", pt: "Receita em alta" }, positive: true },
  DECLINING_REVENUE: { text: { en: "Revenue falling", pt: "Receita em queda" }, positive: false },
  VOLATILE_REVENUE: { text: { en: "Revenue swings a lot", pt: "Receita oscila muito" }, positive: false },
  HIGH_HOUSEHOLD_DRAW: { text: { en: "Most of the profit goes to the household", pt: "A maior parte do lucro vai para as despesas da casa" }, positive: false },
  DATA_INCONSISTENT: { text: { en: "Some figures contradict each other", pt: "Alguns números se contradizem" }, positive: false },
});

export const PURPOSE_LABEL: Record<CreditPurpose, string> = localized({
  working_capital: { en: "Working capital", pt: "Capital de giro" },
  inventory: { en: "Stock and materials", pt: "Estoque e materiais" },
  equipment: { en: "Equipment", pt: "Equipamentos" },
  renovation: { en: "Improving the workspace", pt: "Melhorias no espaço de trabalho" },
  other: { en: "Something else", pt: "Outra finalidade" },
});

// A business's sector is free text a leader types. The ones the demo uses are
// read in the current language; anything else shows as it was written.
const SECTOR_LABEL: Record<string, string> = localized({
  food: { en: "food", pt: "alimentação" },
  beauty: { en: "beauty", pt: "beleza" },
  crafts: { en: "crafts", pt: "artesanato" },
  fashion: { en: "fashion", pt: "moda" },
  retail: { en: "retail", pt: "comércio" },
  services: { en: "services", pt: "serviços" },
});

export const sectorLabel = <T extends string | null | undefined>(sector: T) =>
  (sector && Object.prototype.hasOwnProperty.call(SECTOR_LABEL, sector) ? SECTOR_LABEL[sector] : sector) as T;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? "—" : brl.format(cents / 100));

/** "2026-09" → "Sep 2026", "set. de 2026". */
/** This month and the two before it, in São Paulo: the months a check-in may cover. */
export function recentPeriods(): string[] {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return [0, 1, 2].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export const monthLabel = (period: string) =>
  formatDate(`${period}-01T12:00:00Z`, { month: "short", year: "numeric", timeZone: "UTC" });
