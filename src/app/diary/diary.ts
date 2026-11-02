import { platform } from "../lib/platform";
import { localized, tr } from "../i18n";

// The entrepreneur's daily diary, in the browser (/app/diario). Everything
// here goes through the diary_* functions, which find her by her session;
// nothing sends an entrepreneur id. The functions are newer than the
// generated platform types, so they are called through one untyped door.

type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null };
const rpc = <T>(fn: string, args?: Record<string, unknown>) =>
  (platform.rpc as unknown as (this: typeof platform, f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>)
    .call(platform, fn, args);

export class DiaryError extends Error {
  constructor(public readonly key: string) {
    super(key);
  }
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc<T>(fn, args);
  if (error) throw new DiaryError(error.message);
  return data as T;
}

/** The react-query key of her profile, under which every diary query sits. */
export const PROFILE_KEY = ["diary", "profile"] as const;

/** The consent wording's version, recorded with her enrolment. Change it whenever CONSENT changes. */
export const CONSENT_TEXT_VERSION = "web-2026-11";

// ------------------------------------------------------------------ shapes

export interface DiaryProfile {
  enrolled: boolean;
  today: string;
  name?: string;
  reminders?: { enabled: boolean; remind_at: string; time_zone: string };
  devices?: number;
}

export type PaymentMethod = "pix" | "cash" | "debit_card" | "credit_card" | "fiado";
export type Category =
  | "stock" | "packaging" | "fees" | "app_fees" | "transport" | "rent_utilities"
  | "marketing" | "staff" | "withdrawal" | "equipment" | "debt" | "other";

/** One line, as journal_record takes it. */
export interface Line {
  kind: "sale" | "expense";
  amount_cents: number;
  payment_method: PaymentMethod;
  category?: Category;
  due_on?: string;
  installments?: number;
}

export interface DaySummary {
  day: string;
  quiet: boolean;
  quiet_reason: "closed" | "no_sales" | null;
  sales_cents: number;
  expenses_cents: number;
  week_kept: number;
  week_days: number;
}

export interface Progress {
  streak_days: number;
  earned: { code: string; kind: string; title: string; how_to_redeem: string | null; partner_name: string | null; threshold_days: number }[];
  next: { title: string; days_left: number } | null;
}

export interface WeekGoal {
  kind: "days" | "sales";
  target: number;
  met: boolean;
  days_kept: number;
  sales_cents: number;
}

export interface GoalAfter {
  goal: WeekGoal | null;
  just_met: boolean;
  run: number | null;
  last_week: (WeekGoal & { run: number }) | null;
  ask: boolean;
  reference: { days_kept: number; sales_cents: number } | null;
}

export interface AfterRecord {
  recorded: { status: "recorded" | "no_activity" | "duplicate"; day?: string };
  summary: DaySummary;
  progress?: Progress;
  goal?: GoalAfter;
}

export interface HistoryEntry {
  id: string;
  kind: "sale" | "expense";
  amount_cents: number;
  payment_method: PaymentMethod;
  due_on: string | null;
  installments: number;
  category: Category | null;
  voided: boolean;
}

export interface HistoryDay {
  day: string;
  no_activity: boolean;
  quiet_reason: "closed" | "no_sales" | null;
  entries: HistoryEntry[];
}

export interface GoalNow {
  goal: WeekGoal | null;
  reference?: { days_kept: number; sales_cents: number };
  max_days?: number;
}

export interface Draft {
  draft_id: string;
  day: string;
  lines: Line[];
  notes: string[];
  heard: string | null;
}

// ------------------------------------------------------------------ calls

export const diary = {
  profile: () => call<DiaryProfile>("diary_profile"),
  enrol: (profile: EnrolForm) =>
    call<string>("diary_enrol", { p_profile: profile, p_text_version: CONSENT_TEXT_VERSION }),
  record: (args: { requestId: string; day: string; lines: Line[]; noActivity?: boolean; quietReason?: "closed" | "no_sales" | null; seconds?: number }) =>
    call<AfterRecord>("diary_record", {
      p_request_id: args.requestId,
      p_day: args.day,
      p_entries: args.lines,
      p_no_activity: args.noActivity ?? false,
      p_quiet_reason: args.quietReason ?? null,
      p_seconds: args.seconds ?? null,
    }),
  decideDraft: (draftId: string, confirm: boolean, seconds?: number) =>
    call<{ status: "confirmed" | "discarded" | "stale"; day?: string } & Partial<AfterRecord>>("diary_draft_decide", {
      p_draft_id: draftId,
      p_confirm: confirm,
      p_seconds: seconds ?? null,
    }),
  history: (days = 31) => call<HistoryDay[]>("diary_history", { p_days: days }),
  voidEntry: (entryId: string) => call<{ status: "voided" | "already_voided" }>("diary_void_entry", { p_entry_id: entryId }),
  goalNow: () => call<GoalNow>("diary_goal_now"),
  goalAnswer: (choice: "days" | "sales" | "skip", target?: number) =>
    call<{ status: string }>("diary_goal_answer", { p_choice: choice, p_target: target ?? null }),
  setReminders: (enabled: boolean, remindAt?: string) =>
    call<{ enabled: boolean; remind_at: string }>("diary_reminders_set", { p_enabled: enabled, p_remind_at: remindAt ?? null }),
  reminderOpened: (reminderId: string) => call<null>("diary_reminder_opened", { p_reminder_id: reminderId }),
};

export interface EnrolForm {
  name: string;
  adult_woman: boolean;
  consented: boolean;
  city: string;
  state_uf: string;
  sector: string;
  months_operating: number | null;
  formalization: "mei" | "cnpj" | "none" | null;
  finance_control: "notebook" | "spreadsheet" | "app" | "memory" | "none" | null;
}

// ------------------------------------------------------------------ what she reads

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = localized([
  { id: "pix", label: { en: "Pix", pt: "Pix" } },
  { id: "cash", label: { en: "Cash", pt: "Dinheiro" } },
  { id: "debit_card", label: { en: "Debit card", pt: "Cartão de débito" } },
  { id: "credit_card", label: { en: "Credit card", pt: "Cartão de crédito" } },
  { id: "fiado", label: { en: "On credit (fiado)", pt: "Fiado" } },
]);

/** The keys match private.journal_group in the database. */
export const CATEGORIES: { id: Category; label: string }[] = localized([
  { id: "stock", label: { en: "Goods or raw materials", pt: "Mercadoria ou matéria-prima" } },
  { id: "packaging", label: { en: "Packaging", pt: "Embalagem" } },
  { id: "fees", label: { en: "Card machine fee", pt: "Taxa da maquininha" } },
  { id: "app_fees", label: { en: "App or marketplace fee", pt: "Taxa de app ou marketplace" } },
  { id: "transport", label: { en: "Transport and delivery", pt: "Transporte e entrega" } },
  { id: "rent_utilities", label: { en: "Rent, water, power, internet", pt: "Aluguel, água, luz, internet" } },
  { id: "marketing", label: { en: "Advertising", pt: "Divulgação" } },
  { id: "staff", label: { en: "Helper or employee", pt: "Ajudante ou funcionário" } },
  { id: "withdrawal", label: { en: "Taken home (her pay)", pt: "Retirada para casa" } },
  { id: "equipment", label: { en: "Equipment", pt: "Equipamento" } },
  { id: "debt", label: { en: "Loan instalment", pt: "Parcela de empréstimo" } },
  { id: "other", label: { en: "Other business expense", pt: "Outro gasto do negócio" } },
]);

export const methodLabel = (id: string) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
export const categoryLabel = (id: string | null) => CATEGORIES.find((c) => c.id === id)?.label ?? "";

/** R$ 1.234,56 in both languages: reais are written the Brazilian way. */
export function brl(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * What she typed in a money field, in centavos; null when it is not an amount.
 * Takes "250", "250,5", "1.250,00", "R$ 1.250", and "1250.75" (a dot followed by
 * exactly one or two digits is a decimal point; otherwise dots group thousands).
 */
export function parseReais(text: string): number | null {
  let s = text.replace(/r\$/i, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",")) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    const [whole, frac] = s.split(",");
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(whole) || !/^\d{0,2}$/.test(frac)) return null;
    s = `${whole.replace(/\./g, "")}.${frac || "0"}`;
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // a decimal point
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (!/^\d+$/.test(s)) {
    return null;
  }
  const cents = Math.round(Number(s) * 100);
  return Number.isFinite(cents) && cents >= 1 && cents <= 10_000_000_000 ? cents : null;
}

/** A fresh id for one write, so a double tap or a retry records once. */
export const newRequestId = () => crypto.randomUUID();

/** The database's refusals, in words she can act on. */
export function diaryErrorText(error: unknown): string {
  const key = error instanceof Error ? error.message : String(error);
  const known: [RegExp | string, { en: string; pt: string }][] = [
    ["not_signed_in", { en: "Your session ended. Sign in again.", pt: "Sua sessão terminou. Entre de novo." }],
    ["not_enrolled", { en: "Finish your sign-up first.", pt: "Termine o seu cadastro primeiro." }],
    [/on the day or the day after/, { en: "You can record today or yesterday only.", pt: "Só dá para registrar hoje ou ontem." }],
    [/already has lines/, { en: "This day already has sales or expenses recorded.", pt: "Esse dia já tem vendas ou gastos registrados." }],
    [/nothing to record/, { en: "Add a sale or an expense, or mark the day as quiet.", pt: "Inclua uma venda ou um gasto, ou marque o dia sem movimento." }],
    ["too_old_to_correct", { en: "Only today's and yesterday's lines can be corrected.", pt: "Só dá para corrigir lançamentos de hoje e de ontem." }],
    ["month_closed", { en: "That month is already closed.", pt: "Esse mês já foi fechado." }],
    ["no_such_line", { en: "That line was not found.", pt: "Esse lançamento não foi encontrado." }],
    ["too_many_devices", { en: "Reminders are on in 10 devices already. Turn one off first.", pt: "Os lembretes já estão ligados em 10 aparelhos. Desligue um primeiro." }],
    [/consent/, { en: "Your consent is needed to continue.", pt: "Precisamos do seu consentimento para continuar." }],
    [/woman of 18/, { en: "This diary is for women entrepreneurs aged 18 or over.", pt: "Este diário é para mulheres empreendedoras com 18 anos ou mais." }],
  ];
  for (const [pattern, text] of known) {
    if (typeof pattern === "string" ? key === pattern : pattern.test(key)) return tr(text);
  }
  return tr({ en: "Something went wrong. Try again in a moment.", pt: "Algo deu errado. Tente de novo daqui a pouco." });
}

/** "hoje" / "ontem" / a date, for a day she may record. */
export function dayName(day: string, today: string): string {
  if (day === today) return tr({ en: "today", pt: "hoje" });
  if (day === addDays(today, -1)) return tr({ en: "yesterday", pt: "ontem" });
  const [y, m, d] = day.split("-");
  return `${d}/${m}${y === today.slice(0, 4) ? "" : `/${y}`}`;
}

export function addDays(day: string, n: number): string {
  const t = new Date(`${day}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
