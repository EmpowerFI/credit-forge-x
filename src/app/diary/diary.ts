import { diaryDb } from "./db";
import { localized, tr } from "../i18n";

// The entrepreneur's daily diary, in the browser (/app/diario). Everything
// here goes through the diary_* functions, which find her by her session;
// nothing sends an entrepreneur id. They live in the mobile app's database
// (db.ts), whose generated types this repository does not carry, so they are
// called through one untyped door.

type RpcResult<T> = { data: T | null; error: { message: string; code?: string } | null };
const rpc = <T>(fn: string, args?: Record<string, unknown>) =>
  (diaryDb.rpc as unknown as (this: typeof diaryDb, f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>)
    .call(diaryDb, fn, args);

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
export const CONSENT_TEXT_VERSION = "web-2026-12d";

/**
 * The wordings that already asked whether to count her business in the
 * impact figures. Whoever enrolled under one of these has answered it, so the
 * one-time question is not asked again when the wording moves on for another
 * reason. "web-2026-12b" only drops the voice paragraph (voice left the diary);
 * "web-2026-12c" sets the same points as titled items, and says she deletes
 * her account herself, under Reminders. "web-2026-12d" adds the AI that writes
 * the weekly reading.
 */
export const IMPACT_ASKED_IN = ["web-2026-12", "web-2026-12b", "web-2026-12c", "web-2026-12d"];

/** The wordings that already tell her the weekly reading is written by AI. Anyone else is told once, on Hoje. */
export const AI_TOLD_IN = ["web-2026-12d"];

// ------------------------------------------------------------------ shapes

export interface DiaryProfile {
  enrolled: boolean;
  today: string;
  name?: string;
  reminders?: { enabled: boolean; remind_at: string; time_zone: string };
  devices?: number;
  /** Not enrolled yet, but she has an account in the EmpowerFI app: what it already knows. */
  from_app?: FromApp | null;
  /** The campaign her days count for today; EmpowerFI's own when she is in none. */
  campaign?: {
    name: string;
    sponsor_name: string;
    is_default: boolean;
    until: string | null;
    offers_rewards?: boolean;
    /** The sponsor's logo in the public sponsor-logos bucket, and where it links. */
    logo_path?: string | null;
    link_url?: string | null;
    /** She joined it by herself (an open campaign), so she may leave it. */
    joined_herself?: boolean;
    /** She has left it: today is its last day. */
    leaving?: boolean;
  } | null;
  /** The icon that marks a day recorded in her week (a PROGRESS_ICONS code). */
  progress_emoji?: string;
  /** The ISO weekdays her business opens (1 = Monday ... 7 = Sunday): her week's base. */
  open_days?: number[];
  /** Whether the weekly reading is written by AI (true) or in fixed sentences only. */
  ai_reading?: boolean;
  /** Every reward she has earned, newest first. */
  rewards?: Reward[];
  /** Her latest answer to "count my business in impact figures", and the wording it was given under. */
  impact_consent?: { share: boolean; text_version: string } | null;
}

/** Her app account, as the diary may reuse it. declared: she made the app's woman-of-18 declaration. */
export interface FromApp {
  name: string | null;
  city: string | null;
  state_uf: string | null;
  business_name: string | null;
  sector: string | null;
  /** The app's answer, in its own buckets (AGE_RANGES), when she gave one. */
  age_range?: AgeRange | null;
  declared: boolean;
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

/** A reward she earned: what, how to redeem it, and, in a sponsor's campaign, whose it is. */
export interface Reward {
  title: string;
  kind: string;
  how_to_redeem: string | null;
  redeem_url?: string | null;
  sponsor_name?: string | null;
  status?: "granted" | "awaiting_consent";
  granted_at?: string;
}

/** A sponsor of a real campaign she is in today: its logo opens the page it named. */
export interface DiarySponsor {
  name: string;
  logo_path: string | null;
  link_url: string | null;
  campaigns: string[];
}

/** A strategic partner of EmpowerFI's (20270103), shown to every entrepreneur. */
export interface DiaryPartner {
  name: string;
  description: string | null;
  logo_path: string | null;
  link_url: string | null;
}

/** An open campaign she can join with one tap. blocked_by: the campaign she is already named in for later. */
export interface OpenCampaign {
  id: string;
  name: string;
  description: string | null;
  sponsor_name: string;
  period_end: string;
  logo_path: string | null;
  link_url: string | null;
  offers_rewards: boolean;
  blocked_by: string | null;
}

export interface Progress {
  streak_days: number;
  earned: (Reward & { code: string; partner_name: string | null; threshold_days: number })[];
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

/** The money that moved on a day: lines paid on the spot, and instalments falling due that day. */
export interface DayCash {
  sales_cents: number;
  expenses_cents: number;
  taken_home_cents: number;
}

export interface HistoryDay {
  day: string;
  no_activity: boolean;
  quiet_reason: "closed" | "no_sales" | null;
  /** What moved that day; absent from a database older than 20261221. */
  money?: DayCash;
  entries: HistoryEntry[];
}

export interface GoalNow {
  goal: WeekGoal | null;
  reference?: { days_kept: number; sales_cents: number };
  max_days?: number;
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
  history: (days = 31) => call<HistoryDay[]>("diary_history", { p_days: days }),
  voidEntry: (entryId: string) => call<{ status: "voided" | "already_voided" }>("diary_void_entry", { p_entry_id: entryId }),
  correctEntry: (entryId: string, line: Line, requestId: string) =>
    call<{ status: "corrected" | "duplicate" }>("diary_correct_entry", { p_entry_id: entryId, p_entry: line, p_request_id: requestId }),
  goalNow: () => call<GoalNow>("diary_goal_now"),
  goalAnswer: (choice: "days" | "sales" | "skip", target?: number) =>
    call<{ status: string }>("diary_goal_answer", { p_choice: choice, p_target: target ?? null }),
  setReminders: (enabled: boolean, remindAt?: string) =>
    call<{ enabled: boolean; remind_at: string }>("diary_reminders_set", { p_enabled: enabled, p_remind_at: remindAt ?? null }),
  reminderOpened: (reminderId: string) => call<null>("diary_reminder_opened", { p_reminder_id: reminderId }),
  pushSubscribe: (endpoint: string, p256dh: string, auth: string) =>
    call<{ devices: number }>("diary_push_subscribe", {
      p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: navigator.userAgent,
    }),
  setImpactConsent: (share: boolean) =>
    call<{ share: boolean }>("diary_impact_consent_set", { p_share: share, p_text_version: CONSENT_TEXT_VERSION }),
  pushUnsubscribe: (endpoint: string) => call<{ devices: number }>("diary_push_unsubscribe", { p_endpoint: endpoint }),
  categories: () => call<{ slug: string; label: string; icon: string | null }[]>("diary_categories"),
  setEmoji: (emoji: string) => call<string>("diary_emoji_set", { p_emoji: emoji }),
  forget: () => call<{ erased: boolean }>("diary_account_forget", { p_confirmation: "EXCLUIR" }),
  openCampaigns: () => call<OpenCampaign[]>("diary_campaigns"),
  sponsors: () => call<DiarySponsor[]>("diary_sponsors"),
  partners: () => call<DiaryPartner[]>("diary_partners"),
  joinCampaign: (id: string) => call<{ starts_on: string; until: string }>("diary_campaign_join", { p_program_id: id }),
  leaveCampaign: () => call<{ ends_on: string }>("diary_campaign_leave"),
  month: () => call<MonthSoFar>("diary_month"),
  statement: (period?: string) => call<MonthStatement>("diary_month_statement", period ? { p_period: period } : {}),
  setMonthlyNeed: (cents: number | null) => call<number | null>("diary_monthly_need_set", { p_cents: cents }),
  setOpenDays: (days: number[]) => call<number[]>("diary_open_days_set", { p_days: days }),
  setAiReading: (on: boolean) => call<boolean>("diary_ai_reading_set", { p_on: on }),
  readings: (limit = 12) => call<WeekReading[]>("diary_readings", { p_limit: limit }),
  /** Writes the week that has just closed, if it is due a reading. Once per week, whoever asks. */
  checkReading: async () => {
    const { data, error } = await diaryDb.functions.invoke<{ week_start: string; status: "not_due" | "written" | "busy" | "failed" }>(
      "diary-reading", { method: "POST" });
    if (error) throw error;
    return data;
  },
};

/** The month so far (diary_month), as money that moved: each instalment in the month it falls due. Taking home is apart. */
export interface MonthSoFar {
  period: string;
  first_day: string;
  today: string;
  sales_cents: number;
  expenses_cents: number;
  profit_cents: number;
  taken_home_cents: number;
  days_kept: number;
  /** "Coloque aqui o seu salário mensal": her pay, the month's break-even. Null until she says. */
  monthly_need_cents: number | null;
}

/** Lines made in a month on terms: how many, the whole amount, and how much falls due in the month and after it. */
export interface OnTerms { lines: number; total_cents: number; in_month_cents: number; later_cents: number }

/** One month as a statement (diary_month_statement): the same money as "Seu mês", laid out like a DRE. */
export interface MonthStatement {
  period: string;
  first_day: string;
  last_day: string;
  /** The last day counted: the month's last, or today while it runs. */
  to: string;
  complete: boolean;
  days_kept: number;
  sales_cents: number;
  sales_by_method: Partial<Record<PaymentMethod, number>>;
  expenses_by_category: { category: Category | null; group: "cogs" | "opex" | "staff" | "investment" | "financing" | null; cents: number }[];
  expenses_cents: number;
  /** Sales less the business's expenses, before her salary. */
  result_cents: number;
  salary_cents: number | null;
  profit_cents: number | null;
  taken_home_cents: number;
  receivable_cents: number;
  payable_cents: number;
  /** Sales she made in the month to receive later or in instalments; null if none. */
  sold_on_terms: OnTerms | null;
  /** Purchases she made in the month to pay later or in instalments; null if none. */
  bought_on_terms: OnTerms | null;
  /** Every month she can open, newest first (YYYY-MM). */
  months: string[];
}

/** A week's reading: what the model wrote (checked) or the fixed-sentence fallback, in Portuguese. */
export interface WeekReading {
  week_start: string;
  source: "model" | "fallback";
  /** Since 13/11/2026 a week is one tip (report.tip); a reading written before shows its action, which was its tip. */
  report: { summary: string; observations: string[]; action: string; limits: string; tip?: string };
  days_kept: number;
  /** The days a week her business opened, the week's base. */
  open_days: number;
  /** The figures the reading was written from (20261225); null where a cost was unknown or her salary not set. */
  figures?: {
    sales_cents: number;
    expenses_cents: number | null;
    result_cents: number | null;
    pay_cents: number | null;
    profit_cents: number | null;
  };
  completed_at: string;
}

export interface EnrolForm {
  name: string;
  adult_woman: boolean;
  consented: boolean;
  /** Optional: her business counted, with others and never alone, in the figures the sponsor sees. */
  share_impact: boolean;
  city: string;
  state_uf: string;
  sector: string;
  age_range: AgeRange;
  months_operating: number | null;
  formalization: "mei" | "cnpj" | "none" | null;
  finance_control: "notebook" | "spreadsheet" | "app" | "memory" | "none" | null;
}

/** The app's age buckets (public.users.age_range), in the app's own words; the database checks the same set. */
export const AGE_RANGES = localized([
  { value: "18_24", label: { en: "18 to 24", pt: "18 a 24 anos" } },
  { value: "25_34", label: { en: "25 to 34", pt: "25 a 34 anos" } },
  { value: "35_44", label: { en: "35 to 44", pt: "35 a 44 anos" } },
  { value: "45_54", label: { en: "45 to 54", pt: "45 a 54 anos" } },
  { value: "55_64", label: { en: "55 to 64", pt: "55 a 64 anos" } },
  { value: "65_plus", label: { en: "65 or over", pt: "65 anos ou mais" } },
  { value: "prefere_nao_declarar", label: { en: "I prefer not to say", pt: "Prefiro não declarar" } },
]);
export type AgeRange = "18_24" | "25_34" | "35_44" | "45_54" | "55_64" | "65_plus" | "prefere_nao_declarar";

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

/**
 * Her pay for one day: her monthly salary, split over
 * the days her business opens that month. A closed day carries none.
 */
export function payShare(need: number | null | undefined, day: string, openDays: number[]): number {
  if (!need || !openDays.includes(isoWeekday(day))) return 0;
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let open = 0;
  for (let d = 1; d <= last; d++) if (openDays.includes(isoWeekday(`${day.slice(0, 8)}${String(d).padStart(2, "0")}`))) open++;
  return open ? Math.round(need / open) : 0;
}

/**
 * A day as the diary says it to her: what came in from sales, the business's
 * expenses, her pay for the day (a cost like the others), and the profit --
 * what is left after all of them. Money counts on the day it moves: a sale or
 * a purchase paid later counts each instalment on its own due date, so the
 * day's figures come from the server ("money"), which knows the instalments
 * of earlier days too. Taking home ("Retirada para casa") comes out of her
 * pay, so it is reported apart, never added to the expenses.
 */
export function dayMoney(
  day: { entries: { kind: "sale" | "expense"; category: string | null; amount_cents: number; due_on?: string | null; voided?: boolean }[]; money?: DayCash } | undefined,
  pay = 0,
) {
  // Before the server says (an older database), only the lines paid on the spot.
  const paidNow = (day?.entries ?? []).filter((e) => !e.voided && !e.due_on);
  const sum = (f: (e: (typeof paidNow)[number]) => boolean) => paidNow.filter(f).reduce((t, e) => t + e.amount_cents, 0);
  const m = day?.money ?? {
    sales_cents: sum((e) => e.kind === "sale"),
    expenses_cents: sum((e) => e.kind === "expense" && e.category !== "withdrawal"),
    taken_home_cents: sum((e) => e.kind === "expense" && e.category === "withdrawal"),
  };
  return {
    sales: m.sales_cents,
    expenses: m.expenses_cents,
    pay,
    profit: m.sales_cents - m.expenses_cents - pay,
    takenHome: m.taken_home_cents,
  };
}

/**
 * The month against its whole cost -- the business's expenses so far plus
 * what she needs to get through it: how much of that the sales cover, what
 * is still missing, and the sales each open day still has to bring. Past
 * the cost, what is left is profit.
 */
export function breakEven(
  m: Pick<MonthSoFar, "sales_cents" | "expenses_cents" | "monthly_need_cents" | "today">,
  openDays: number[],
  todayKept: boolean,
) {
  const need = m.monthly_need_cents;
  if (!need) return null;
  const cost = m.expenses_cents + need;
  const profit = m.sales_cents - cost;
  const missing = Math.max(0, -profit);
  // Open days still ahead this month: from tomorrow, and today too if not yet recorded.
  const [y, mo] = m.today.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  let left = 0;
  for (let d = Number(m.today.slice(8)) + (todayKept ? 1 : 0); d <= last; d++) {
    if (openDays.includes(isoWeekday(`${m.today.slice(0, 8)}${String(d).padStart(2, "0")}`))) left++;
  }
  return {
    need,
    cost,
    profit,
    covered: cost > 0 ? Math.min(1, m.sales_cents / cost) : 1,
    missing,
    openDaysLeft: left,
    perOpenDay: missing > 0 && left > 0 ? Math.ceil(missing / left) : null,
  };
}

/** R$ 1.234,56 in both languages: reais are written the Brazilian way. */
export function brl(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Lucro" or "Prejuízo", by the sign. */
export const profitLabel = (cents: number) => (cents < 0 ? tr({ en: "Loss", pt: "Prejuízo" }) : tr({ en: "Profit", pt: "Lucro" }));

/** The month's query: under ["diary", "history"], so whatever refreshes her days after a record or a correction refreshes it too. */
export const MONTH_KEY = ["diary", "history", "month"] as const;

/** A profit or a loss: "R$ 300,00", or "−R$ 300,00" with a real minus sign. */
export const signedBrl = (cents: number) => (cents < 0 ? `−${brl(-cents)}` : brl(cents));

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
  // No signal: the page opens from the phone, but every figure lives on the server.
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || /Failed to fetch|NetworkError|Load failed/i.test(key)) {
    return tr({
      en: "No internet right now. The diary needs a connection to show and save your days. Try again when the signal is back.",
      pt: "Sem internet agora. O diário precisa de conexão para mostrar e guardar os seus dias. Tente de novo quando o sinal voltar.",
    });
  }
  const known: [RegExp | string, { en: string; pt: string }][] = [
    ["not_signed_in", { en: "Your session ended. Sign in again.", pt: "Sua sessão terminou. Entre de novo." }],
    ["forbidden", { en: "This e-mail has no access to that.", pt: "Este e-mail não tem acesso a isso." }],
    ["not_enrolled", { en: "Finish your sign-up first.", pt: "Termine o seu cadastro primeiro." }],
    [/on the day or the day after/, { en: "You can record today or yesterday only.", pt: "Só dá para registrar hoje ou ontem." }],
    [/already has lines/, { en: "This day already has sales or expenses recorded.", pt: "Esse dia já tem vendas ou gastos registrados." }],
    [/nothing to record/, { en: "Add a sale or an expense, or mark the day as quiet.", pt: "Inclua uma venda ou um gasto, ou marque o dia sem movimento." }],
    ["too_old_to_correct", { en: "Only today's and yesterday's lines can be corrected.", pt: "Só dá para corrigir lançamentos de hoje e de ontem." }],
    ["month_closed", { en: "That month is already closed.", pt: "Esse mês já foi fechado." }],
    ["no_such_line", { en: "That line was not found.", pt: "Esse lançamento não foi encontrado." }],
    ["monthly_need_out_of_range", { en: "Write an amount between R$ 1 and R$ 1,000,000.", pt: "Escreva um valor entre R$ 1 e R$ 1.000.000." }],
    ["open_days_invalid", { en: "Choose at least one day.", pt: "Escolha pelo menos um dia." }],
    ["already_voided", { en: "That line was already taken back.", pt: "Esse lançamento já tinha sido desfeito." }],
    ["not_a_push_service", { en: "This browser cannot receive the reminder. Try Chrome or Safari.", pt: "Este navegador não recebe o lembrete. Tente o Chrome ou o Safari." }],
    ["age_range_required", { en: "Choose your age range.", pt: "Escolha a sua faixa etária." }],
    ["sector_not_a_category", { en: "Choose what you sell from the list.", pt: "Escolha o que você vende na lista." }],
    ["emoji_not_offered", { en: "Choose one of the icons offered.", pt: "Escolha um dos ícones da lista." }],
    ["campaign_not_open", { en: "This campaign is not open to join.", pt: "Esta campanha não está aberta para adesão." }],
    ["campaign_not_running", { en: "This campaign is not running today.", pt: "Esta campanha não está acontecendo hoje." }],
    ["already_in_this_campaign", { en: "You have already taken part in this campaign.", pt: "Você já participou desta campanha." }],
    [/^in_another_campaign/, { en: "You are already in another campaign at the same time.", pt: "Você já está em outra campanha no mesmo período." }],
    ["already_left", { en: "You have already left this campaign.", pt: "Você já saiu desta campanha." }],
    ["campaign_named_you", { en: "EmpowerFI included you in this campaign; to leave it, talk to EmpowerFI.", pt: "A EmpowerFI incluiu você nesta campanha; para sair, fale com a EmpowerFI." }],
    ["not_in_a_campaign", { en: "You are not in a campaign.", pt: "Você não está em uma campanha." }],
    ["not_allowed_to_publish_rewards", { en: "Only the sponsor's people can change these rewards.", pt: "Só as pessoas do patrocinador podem mudar estes prêmios." }],
    ["a_sponsor_reward_is_a_gift", { en: "A sponsor's reward is a gift redeemed by code or link.", pt: "O prêmio do patrocinador é um presente resgatado por código ou link." }],
    ["a_sponsor_reward_says_how_to_redeem", { en: "Each reward needs to say how to redeem it.", pt: "Cada prêmio precisa dizer como resgatar." }],
    ["link_must_be_https", { en: "The link must start with https://", pt: "O link precisa começar com https://" }],
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

/**
 * Today where she is. The server's date (diary_profile.today) is the one
 * that counts; this is what to show until it arrives, and never the UTC
 * date, which after 21:00 in São Paulo is already tomorrow.
 */
export function spToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The server's today from whichever cached profile query has it, else São Paulo's. */
export function cachedToday(queries: ReadonlyArray<readonly [unknown, unknown]>): string {
  for (const [, data] of queries) {
    const today = (data as { today?: unknown } | undefined)?.today;
    if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today)) return today;
  }
  return spToday();
}

export function addDays(day: string, n: number): string {
  const t = new Date(`${day}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/**
 * EmpowerFI's own progress icons, the same codes the database accepts
 * (20261216). The files live where the service worker keeps them for offline
 * use, cache-first: a redrawn icon gets a new file name, not the same one.
 */
export const PROGRESS_ICONS = [
  { code: "growth", label: { en: "Coins growing", pt: "Moedas crescendo" } },
  { code: "money_bag", label: { en: "Money bag", pt: "Saco de dinheiro" } },
  { code: "dashboard", label: { en: "Dashboard", pt: "Painel" } },
  { code: "calendar", label: { en: "Calendar", pt: "Calendário" } },
  { code: "folder", label: { en: "Folder in order", pt: "Pasta organizada" } },
] as const;
export type ProgressIcon = (typeof PROGRESS_ICONS)[number]["code"];

/** Her icon, or the first one for anything else (an old emoji, nothing yet). */
export function progressIcon(code: string | null | undefined): ProgressIcon {
  return PROGRESS_ICONS.find((i) => i.code === code)?.code ?? "growth";
}

export const progressIconSrc = (code: ProgressIcon) => `/app/diario-icons/progress/${code}.png`;

/** Monday of the week a day is in (YYYY-MM-DD in, YYYY-MM-DD out). */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** "qua, 4/11": the day as the day switch names it. */
// The first-time tour, seen once per person on this phone. A new phone shows
// it again, which is no harm: it is short, and "Pular" is always there.
// Storage may be refused (private mode); then it shows each time the diary
// opens, until skipped.
const tourKey = (userId: string) => `empowerfi-diary-tour:${userId}`;

export function tourSeen(userId: string): boolean {
  try {
    return localStorage.getItem(tourKey(userId)) !== null;
  } catch {
    return false;
  }
}

export function markTourSeen(userId: string) {
  try {
    localStorage.setItem(tourKey(userId), new Date().toISOString());
  } catch {
    // Memory only: the tour closes for this visit either way.
  }
}

/** Every weekday, Monday first, by ISO number. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** One letter per weekday, Monday first, in her language. */
export const weekdayLetters = () => tr({ en: "MTWTFSS", pt: "STQQSSD" }).split("");

/** Weekday names, Monday first, in her language. */
export const weekdayNames = () => tr({
  en: "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday",
  pt: "Segunda,Terça,Quarta,Quinta,Sexta,Sábado,Domingo",
}).split(",");

/** The days her business opens, every day when she has not said. */
export const openDaysOf = (p: { open_days?: number[] } | undefined): number[] =>
  p?.open_days?.length ? p.open_days : [...WEEKDAYS];

/** ISO weekday of a YYYY-MM-DD day (1 = Monday ... 7 = Sunday). */
export const isoWeekday = (day: string) => ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** "2 a 8/11", or "29/12 a 4/1" across months. */
export function weekSpan(monday: string): string {
  const a = new Date(`${monday}T12:00:00Z`);
  const b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 6);
  const to = `${b.getUTCDate()}/${b.getUTCMonth() + 1}`;
  const from = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}` : `${a.getUTCDate()}/${a.getUTCMonth() + 1}`;
  return tr({ en: `${from} to ${to}`, pt: `${from} a ${to}` });
}

export function shortDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const weekday = d.toLocaleDateString(tr({ en: "en-GB", pt: "pt-BR" }), { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${weekday}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}
