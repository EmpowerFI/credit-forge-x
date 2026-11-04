import { diaryDb } from "../diary/db";
import { DiaryError } from "../diary/diary";
import { localized, tr } from "../i18n";

// The real impact area (/impacto): one campaign's figures, from the diary,
// in the app's production database. The prototype's /app/impact stays the
// showroom; nothing here reads it.

type RpcResult<T> = { data: T | null; error: { message: string } | null };
const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (diaryDb.rpc as unknown as
    (this: typeof diaryDb, f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>).call(diaryDb, fn, args);
  if (error) throw new DiaryError(error.message);
  return data as T;
};

export interface Campaign {
  id: string;
  name: string;
  sponsor_name: string;
  is_default: boolean;
  period_start: string;
  period_end: string | null;
  /** From impact_campaigns: the sponsor's logo (sponsor-logos bucket) and link. */
  logo_path?: string | null;
  link_url?: string | null;
}

export interface Segment { key: string; women: number; started: number }

export interface BusinessMonth {
  month: string;
  suppressed: boolean;
  women: number | null;
  median_sales_cents?: number;
  median_expenses_cents?: number;
  total_sales_cents?: number;
  positive_share_bps?: number;
  median_growth_bps?: number | null;
  growth_women?: number;
}

export interface ImpactLive {
  campaign: Campaign;
  from: string;
  to: string;
  status: "live" | "not_started";
  as_of: string;
  min_group?: number;
  participation?: {
    authorised: number | null;
    enrolled: number;
    started: number;
    active_7d: number;
    days_recorded: number;
    quiet_days: number;
    days_per_week: number | null;
    median_streak: number | null;
    goals_set: number;
    goals_met: number;
  };
  funnel?: { key: FunnelKey; n: number | null }[];
  weekly?: { week_start: string; days_recorded: number; women: number }[];
  reminders?: { sent: number; accepted: number; opened: number };
  channels?: { form: number; voice: number; text: number; median_seconds: number | null };
  business?: {
    consenting: number;
    of: number;
    well_recorded_days: number;
    months: BusinessMonth[];
    payment_mix: Record<string, number> | null;
  };
  segments?: Record<"sector" | "state" | "formalization" | "finance_control", Segment[]>;
}

export type FunnelKey = "authorised" | "enrolled" | "first_day" | "kept_7" | "kept_30" | "kept_60";

export const impacto = {
  campaigns: () => call<Campaign[]>("impact_campaigns"),
  live: (id: string, from?: string | null, to?: string | null) =>
    call<ImpactLive>("impact_live", { p_program_id: id, p_from: from ?? null, p_to: to ?? null }),
};

export const FUNNEL: Record<FunnelKey, { label: string; hint: string }> = localized({
  authorised: { label: { en: "Authorised", pt: "Autorizadas" }, hint: { en: "E-mails the campaign names", pt: "E-mails que a campanha inclui" } },
  enrolled: { label: { en: "Signed up", pt: "Cadastradas" }, hint: { en: "Joined the diary", pt: "Entraram no diário" } },
  first_day: { label: { en: "Recorded a day", pt: "Registraram um dia" }, hint: { en: "In this period", pt: "Neste período" } },
  kept_7: { label: { en: "7+ days", pt: "7+ dias" }, hint: { en: "Days recorded in total", pt: "Dias registrados no total" } },
  kept_30: { label: { en: "30+ days", pt: "30+ dias" }, hint: { en: "Days recorded in total", pt: "Dias registrados no total" } },
  kept_60: { label: { en: "60+ days", pt: "60+ dias" }, hint: { en: "Enough history for the credit passport", pt: "Histórico suficiente para o passaporte de crédito" } },
});

export const SEGMENT_TITLE = localized({
  sector: { en: "By what she sells", pt: "Por ramo" },
  state: { en: "By state", pt: "Por estado" },
  formalization: { en: "By formalisation", pt: "Por formalização" },
  finance_control: { en: "By how she tracked money before", pt: "Por como controlava o dinheiro antes" },
});

const KEY_LABEL: Record<string, { en: string; pt: string }> = {
  mei: { en: "MEI", pt: "MEI" },
  cnpj: { en: "Other CNPJ", pt: "Outro CNPJ" },
  none: { en: "None", pt: "Nenhum" },
  notebook: { en: "Notebook", pt: "Caderno" },
  spreadsheet: { en: "Spreadsheet", pt: "Planilha" },
  app: { en: "An app", pt: "Aplicativo" },
  memory: { en: "In her head", pt: "De cabeça" },
  outros: { en: "Others (small groups)", pt: "Outros (grupos pequenos)" },
  "não informado": { en: "Not said", pt: "Não informado" },
  pix: { en: "Pix", pt: "Pix" },
  cash: { en: "Cash", pt: "Dinheiro" },
  debit_card: { en: "Debit card", pt: "Cartão de débito" },
  credit_card: { en: "Credit card", pt: "Cartão de crédito" },
  fiado: { en: "On credit (fiado)", pt: "Fiado" },
};

/** A segment or payment key in words; a free-text sector keeps its own, capitalised. */
export function keyLabel(key: string): string {
  const known = KEY_LABEL[key];
  if (known) return tr(known);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export const pct = (bps: number | null | undefined) =>
  bps == null ? "—" : `${(bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const ratio = (a: number, b: number) => (b > 0 ? pct(Math.round((a * 10000) / b)) : "—");

/** dd/mm/aaaa from an ISO day. */
export const ddmm = (day: string | null | undefined) => (day ? day.slice(0, 10).split("-").reverse().join("/") : "—");

export function monthName(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  const text = d.toLocaleDateString(tr({ en: "en-GB", pt: "pt-BR" }), { month: "long", year: "numeric", timeZone: "UTC" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
