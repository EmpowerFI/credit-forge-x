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
  /** invited: only the e-mails EmpowerFI names; open: anyone in the diary joins with a tap. */
  enrolment?: "invited" | "open";
  offers_rewards?: boolean;
  /** The caller is one of the sponsor's people, who set its rewards (or, for EmpowerFI's, its dashboard owners). */
  can_edit_rewards?: boolean;
}

/** One milestone of a sponsor's rewards: a gift handed over by code or link. */
export interface SponsorMilestone {
  code: string;
  threshold_days: number;
  title: string;
  how_to_redeem: string | null;
  redeem_url: string | null;
}

export interface CampaignRewards {
  offers_rewards: boolean;
  can_edit: boolean;
  programme: { version: number; published_at: string; note: string | null; milestones: SponsorMilestone[] | null } | null;
  /** How many women earned each milestone, by code. */
  earned: Record<string, number>;
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
  rewards: (id: string) => call<CampaignRewards>("impact_rewards", { p_program_id: id }),
  offerRewards: (id: string, on: boolean) => call<boolean>("impact_rewards_offer", { p_program_id: id, p_on: on }),
  publishRewards: (id: string, milestones: SponsorMilestone[]) =>
    call<{ version: number }>("reward_programme_publish", {
      p_program_id: id,
      p_note: null,
      p_milestones: milestones.map((m) => ({
        code: m.code, threshold_days: m.threshold_days, kind: "perk", title: m.title.trim(),
        how_to_redeem: m.how_to_redeem?.trim() ?? "", ...(m.redeem_url?.trim() ? { redeem_url: m.redeem_url.trim() } : {}),
      })),
    }),
};

/** The open campaign's first step: whoever is in it, named by e-mail or joined with a tap. */
export const FUNNEL_OPEN = localized({
  label: { en: "In the campaign", pt: "Na campanha" },
  hint: { en: "Named by e-mail or joined in the diary", pt: "Incluídas por e-mail ou que aderiram no diário" },
});

/**
 * Why a sponsor's rewards cannot be published yet, or null. None at all is
 * fine: a campaign may offer no reward (20261209). The database
 * checks the same; this only says it before the round trip.
 */
export function rewardsProblem(milestones: SponsorMilestone[]): string | null {
  const days = new Set<number>();
  for (const [i, m] of milestones.entries()) {
    const n = tr({ en: `Reward ${i + 1}: `, pt: `Prêmio ${i + 1}: ` });
    if (!Number.isInteger(m.threshold_days) || m.threshold_days < 1 || m.threshold_days > 3650)
      return n + tr({ en: "days between 1 and 3650.", pt: "dias entre 1 e 3650." });
    if (days.has(m.threshold_days)) return n + tr({ en: "another reward falls on the same day.", pt: "outro prêmio cai no mesmo dia." });
    days.add(m.threshold_days);
    if (!m.title.trim() || m.title.trim().length > 80) return n + tr({ en: "a name of up to 80 characters.", pt: "um nome de até 80 caracteres." });
    if (!m.how_to_redeem?.trim() || m.how_to_redeem.trim().length > 300)
      return n + tr({ en: "say how to redeem it (a code or an instruction), up to 300 characters.", pt: "diga como resgatar (um código ou uma instrução), em até 300 caracteres." });
    if (m.redeem_url?.trim() && !/^https:\/\/\S+$/.test(m.redeem_url.trim()))
      return n + tr({ en: "the link must start with https://", pt: "o link precisa começar com https://" });
  }
  return null;
}

/** A milestone's stable code: kept across versions, so whoever earned it does not earn it again. */
export const newMilestoneCode = () => `m_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

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
