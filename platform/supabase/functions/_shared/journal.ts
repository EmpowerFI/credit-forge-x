// journal — the daily form: what it asks, and reading what comes back.
//
// The form and its reader live in one file on purpose. The Flow JSON in
// docs/whatsapp/diario-flow.pt-BR.json is generated from journalFlow() below,
// and a test fails if the file and the function disagree -- so a field renamed
// in the form cannot silently become a field the reader never sees.
//
// The reminder goes out at nine in the morning and asks about the day before,
// because in the evening she is tired. So "ontem" is the default answer to
// "which day", and the day is resolved against the moment she sent the form,
// in São Paulo -- not against when Meta delivered it, which can be later.
//
// Nothing here guesses, as in whatsapp.ts: a blank is "not this one", a
// written amount is read strictly, and a sale on credit or fiado without the
// date she will be paid is refused rather than filed as à vista.
//
// Pure: no network, no database.

import { brlToCents } from "./whatsapp.ts";
import { formatBRL } from "./report.ts";

/** Marks a completed Flow as the daily journal rather than the old fortnight form. */
export const JOURNAL_FORM = "diario";

/** What a quick-reply button sends when she taps "Ontem não teve movimento" (reason unsaid). */
export const QUIET_YESTERDAY = "journal_quiet_yesterday";
/** "Não abri ontem": the business did not open. */
export const CLOSED_YESTERDAY = "journal_closed_yesterday";
/** "Abri e não vendi": open, no sales. */
export const NO_SALES_YESTERDAY = "journal_no_sales_yesterday";

export type QuietReason = "closed" | "no_sales" | null;

/** The reason each quiet-day button carries; undefined for any other payload. */
export function quietButton(payload: string): QuietReason | undefined {
  if (payload === QUIET_YESTERDAY) return null;
  if (payload === CLOSED_YESTERDAY) return "closed";
  if (payload === NO_SALES_YESTERDAY) return "no_sales";
  return undefined;
}

export const SALE_METHODS = [
  { id: "pix", field: "sale_pix", title: "Pix" },
  { id: "cash", field: "sale_cash", title: "Dinheiro" },
  { id: "debit_card", field: "sale_debit", title: "Cartão de débito" },
  { id: "credit_card", field: "sale_credit", title: "Cartão de crédito", due: "sale_credit_due" },
  { id: "fiado", field: "sale_fiado", title: "Fiado", due: "sale_fiado_due" },
] as const;

export const PAYMENT_METHODS = [
  { id: "pix", title: "Pix" },
  { id: "cash", title: "Dinheiro" },
  { id: "debit_card", title: "Cartão de débito" },
  { id: "credit_card", title: "Cartão de crédito" },
  { id: "fiado", title: "Fiado" },
] as const;

/** The keys match private.journal_group in the database; the titles are what she reads. */
export const CATEGORIES = [
  { id: "stock", title: "Mercadoria ou matéria-prima" },
  { id: "packaging", title: "Embalagem" },
  { id: "fees", title: "Taxas (maquininha, app)" },
  { id: "transport", title: "Transporte e entrega" },
  { id: "rent_utilities", title: "Aluguel, água, luz, internet" },
  { id: "marketing", title: "Divulgação" },
  { id: "staff", title: "Ajudante ou funcionário" },
  { id: "withdrawal", title: "Retirada para casa" },
  { id: "equipment", title: "Equipamento" },
  { id: "debt", title: "Parcela de empréstimo" },
  { id: "other", title: "Outro gasto do negócio" },
] as const;

/** Expenses per form. More is another form, the same day: everything adds up. */
export const EXPENSE_SCREENS = 3;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
export type Category = (typeof CATEGORIES)[number]["id"];

/** One line, as public.journal_record takes it. */
export interface JournalLine {
  kind: "sale" | "expense";
  amount_cents: number;
  payment_method: PaymentMethod;
  due_on?: string;
  category?: Category;
}

export interface JournalDay {
  /** YYYY-MM-DD, in São Paulo. */
  day: string;
  lines: JournalLine[];
}

// ------------------------------------------------------------------- dates

const SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar date in São Paulo at a moment. */
export function spDate(at: Date): string {
  return SP.format(at);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of a day's calendar week. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/**
 * The week a newly recorded day may close. Sunday closes its own week -- the
 * usual case, recorded on Monday morning. Any other day closes the week
 * before, in case Sunday never came; the database decides whether that week
 * is actually due.
 */
export function weekToRead(day: string): string {
  const monday = mondayOf(day);
  return new Date(`${day}T12:00:00Z`).getUTCDay() === 0 ? monday : addDays(monday, -7);
}

/**
 * A DatePicker answer. Newer Flow versions send "YYYY-MM-DD"; older ones send
 * milliseconds since the epoch. Both are accepted; anything else is refused.
 */
export function pickedDate(raw: unknown): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) throw new Error(`not a date: ${JSON.stringify(raw)}`);
    return raw;
  }
  const ms = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{10,14}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isFinite(ms)) throw new Error(`not a date: ${JSON.stringify(raw)}`);
  return spDate(new Date(ms));
}

/** brlToCents, refusing in her words: these reasons are sent back to her. */
function amount(raw: unknown, what: string): number {
  try {
    return brlToCents(raw);
  } catch {
    throw new Error(`${what}: não consegui ler o valor ${JSON.stringify(raw)}`);
  }
}

/** pickedDate, refusing in her words. */
function dateOf(raw: unknown, what: string): string {
  try {
    return pickedDate(raw);
  } catch {
    throw new Error(`${what}: não consegui ler a data`);
  }
}

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// ----------------------------------------------------------------- reading

export function isJournalReply(responseJson: string): boolean {
  try {
    return (JSON.parse(responseJson) as { form?: unknown })?.form === JOURNAL_FORM;
  } catch {
    return false;
  }
}

/**
 * A completed daily form, checked field by field.
 *
 * `sentAt` is when she pressed send (Meta's message timestamp), which is what
 * "ontem" and "hoje" mean. An empty form -- nothing sold, nothing spent -- is
 * returned with no lines, and the caller answers it by pointing at the
 * no-activity button rather than recording a day she did not describe.
 */
export function parseJournalReply(responseJson: string, sentAt: Date): JournalDay {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(responseJson) as Record<string, unknown>;
  } catch {
    throw new Error("o formulário chegou incompleto");
  }
  if (body === null || typeof body !== "object" || body.form !== JOURNAL_FORM) throw new Error("o formulário não é o do registro do dia");

  const today = spDate(sentAt);
  const day = body.day === "today" ? today : body.day === "yesterday" ? addDays(today, -1) : null;
  if (day === null) throw new Error("falta dizer se o registro é de hoje ou de ontem");

  const lines: JournalLine[] = [];

  for (const m of SALE_METHODS) {
    const raw = body[m.field];
    if (blank(raw)) continue;
    const line: JournalLine = { kind: "sale", amount_cents: amount(raw, m.title), payment_method: m.id };
    if (line.amount_cents === 0) continue; // "0" in a sales box is "none", not a sale
    if ("due" in m) {
      // Credit and fiado are money still to come: when is the whole point.
      const due = body[m.due];
      if (blank(due)) throw new Error(`${m.title}: falta quando vai receber`);
      line.due_on = dateOf(due, m.title);
      if (line.due_on <= day) throw new Error(`${m.title}: a data de receber tem de ser depois do dia da venda`);
    }
    lines.push(line);
  }

  for (let n = 1; n <= EXPENSE_SCREENS; n++) {
    const category = body[`exp${n}_category`];
    const written = body[`exp${n}_amount`];
    if (blank(category) && blank(written)) continue;
    if (blank(category)) throw new Error(`gasto ${n}: falta o tipo`);
    if (blank(written)) throw new Error(`gasto ${n}: falta o valor`);
    if (!CATEGORIES.some((c) => c.id === category)) throw new Error(`gasto ${n}: tipo desconhecido ${JSON.stringify(category)}`);
    const method = body[`exp${n}_method`];
    if (!PAYMENT_METHODS.some((p) => p.id === method)) throw new Error(`gasto ${n}: falta como pagou`);

    const line: JournalLine = {
      kind: "expense",
      amount_cents: amount(body[`exp${n}_amount`], `gasto ${n}`),
      payment_method: method as PaymentMethod,
      category: category as Category,
    };
    if (line.amount_cents === 0) throw new Error(`gasto ${n}: valor zero`);
    if (body[`exp${n}_paid_now`] === "no") {
      const due = body[`exp${n}_due`];
      if (blank(due)) throw new Error(`gasto ${n}: falta quando vai pagar`);
      line.due_on = dateOf(due, `gasto ${n}`);
      if (line.due_on <= day) throw new Error(`gasto ${n}: a data de pagar tem de ser depois do dia do gasto`);
    }
    lines.push(line);
  }

  return { day, lines };
}

/** A tap on a quick-reply button, from a template or from an interactive message. */
export interface ButtonReply {
  messageId: string;
  from: string;
  payload: string;
  sentAt: Date;
}

/** When Meta says a message was sent (unix seconds); now if it does not say. */
export const sentAtOf = (ts: unknown): Date => {
  const s = typeof ts === "string" ? Number(ts) : typeof ts === "number" ? ts : NaN;
  return Number.isFinite(s) ? new Date(s * 1000) : new Date();
};

export function buttonReplies(body: unknown): ButtonReply[] {
  const out: ButtonReply[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const message of messages) {
        const m = message as {
          id?: unknown; from?: unknown; timestamp?: unknown; type?: unknown;
          button?: { payload?: unknown };
          interactive?: { type?: unknown; button_reply?: { id?: unknown } };
        };
        if (typeof m?.id !== "string" || typeof m.from !== "string") continue;
        // A template's quick reply arrives as type "button"; an interactive
        // message's as interactive.button_reply.
        const payload = m.type === "button"
          ? m.button?.payload
          : m.interactive?.type === "button_reply" ? m.interactive.button_reply?.id : undefined;
        if (typeof payload !== "string") continue;
        out.push({ messageId: m.id, from: m.from, payload, sentAt: sentAtOf(m.timestamp) });
      }
    }
  }
  return out;
}

/**
 * "Sem movimento", written rather than tapped. Only whole phrases: a woman
 * who writes "sem movimento ontem, mas hoje vendi" is not saying her day was
 * quiet, and she is better answered by the form than by a guess.
 */
const plain = (text: string) =>
  text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!]+$/, "");

const QUIET_WORDS: Record<string, QuietReason> = {
  "sem movimento": null,
  "nao teve movimento": null,
  "ontem nao teve movimento": null,
  "ontem sem movimento": null,
  "fechado": "closed",
  "fechei": "closed",
  "nao abri": "closed",
  "nao abri ontem": "closed",
  "ontem nao abri": "closed",
  "nao trabalhei": "closed",
  "ontem nao trabalhei": "closed",
  "sem vendas": "no_sales",
  "nao vendi": "no_sales",
  "nao vendi nada": "no_sales",
  "ontem nao vendi": "no_sales",
  "ontem nao vendi nada": "no_sales",
  "abri e nao vendi": "no_sales",
};

/** The reason, if the whole message says yesterday was quiet; undefined if it does not. */
export function quietTextReason(text: string): QuietReason | undefined {
  const s = plain(text);
  return s in QUIET_WORDS ? QUIET_WORDS[s] : undefined;
}

export function isQuietText(text: string): boolean {
  return quietTextReason(text) !== undefined;
}

/** VER, CONSULTAR, CORRIGIR: she wants to see today's and yesterday's lines. */
export function isListText(text: string): boolean {
  return ["ver", "ver registros", "meus registros", "consultar", "corrigir", "conferir", "registros"].includes(plain(text));
}

/** "APAGAR 2" -> 2; anything else -> null. */
export function voidNumber(text: string): number | null {
  const m = plain(text).match(/^(?:apagar|apaga|excluir|exclui|remover)\s+(\d{1,2})$/);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------- replying

export interface DaySummary {
  quiet: boolean;
  quiet_reason?: "closed" | "no_sales" | null;
  sales_cents: number;
  expenses_cents: number;
  /** Days kept so far in the calendar week of the day, including it. */
  week_kept: number;
  /** Days of that week up to and including the day. */
  week_days: number;
}

/** A milestone, as journal_progress and whatsapp_share_answer return it. */
export interface Milestone {
  code: string;
  kind: "perk" | "partner_benefit";
  title: string;
  how_to_redeem: string | null;
  partner_name: string | null;
  threshold_days: number;
  status?: "granted" | "awaiting_consent";
}

export interface Progress {
  streak_days: number;
  streak_started_on: string | null;
  earned: Milestone[];
  next: { code: string; title: string; kind: string; threshold_days: number; days_left: number } | null;
}

/** Seven days is "1 semana", twenty-eight is "4 semanas", sixty is "60 dias". */
export function span(days: number): string {
  if (days % 7 === 0 && days <= 56) return days === 7 ? "1 semana" : `${days / 7} semanas`;
  return days === 1 ? "1 dia" : `${days} dias`;
}

/**
 * What she reads the moment the form is in. Fixed text, not a model: it
 * arrives at once, costs nothing, and its sums are the database's.
 */
export function confirmationText(day: string, sentAt: Date, s: DaySummary, p?: Progress | null): string {
  const which = day === spDate(sentAt) ? "Hoje" : "Ontem";
  const head = s.quiet
    ? s.quiet_reason === "closed"
      ? `Anotado ✅ ${which} o negócio não abriu.`
      : s.quiet_reason === "no_sales"
        ? `Anotado ✅ ${which} o negócio abriu e não teve vendas.`
        : `Anotado ✅ ${which} não teve movimento.`
    : `Registrado ✅ ${which}: R$ ${formatBRL(s.sales_cents)} em vendas e R$ ${formatBRL(s.expenses_cents)} em gastos.`;
  let progress: string;
  if (p && p.streak_days > 0) {
    progress = `🔥 ${p.streak_days === 1 ? "1 dia" : `${p.streak_days} dias`} seguidos registrando.`;
    // The milestone just earned is announced in its own message; "next" is
    // already the one after it.
    if (p.next && p.next.days_left > 0) {
      progress += `\nFaltam ${p.next.days_left === 1 ? "1 dia" : `${p.next.days_left} dias`} para: ${p.next.title}.`;
    }
  } else {
    progress = s.week_kept === s.week_days
      ? `Você registrou todos os ${s.week_days === 1 ? "dias" : `${s.week_days} dias`} desta semana até agora. 💜`
      : `Nesta semana você registrou ${s.week_kept} de ${s.week_days} dias.`;
  }
  return `${head}\n${progress}\n\nTeve mais algum gasto? É só mandar o formulário de novo, que soma.`;
}

/** The message for a milestone she has just reached. */
export function earnedText(m: Milestone): string {
  if (m.kind === "perk") {
    return [`🎁 Você completou ${span(m.threshold_days)} registrando o seu negócio!`, `Ganhou: *${m.title}*.`, m.how_to_redeem]
      .filter(Boolean).join("\n");
  }
  // A partner's benefit is the partner's: whose offer, and who decides, is
  // said every time, and nothing is promised.
  const partner = m.partner_name ?? "o parceiro";
  const lines = [
    `🎉 ${span(m.threshold_days)} registrando! Você liberou: *${m.title}*, uma oferta de ${partner}.`,
    `Quem analisa e decide a oferta é ${partner}, não a EmpowerFI.`,
  ];
  if (m.status === "awaiting_consent") {
    // The share itself -- who, what for, which figures, for how long -- comes
    // in its own message, written by the database, and asks for AUTORIZO.
    lines.push(
      "",
      `Para analisar, ${partner} precisa ver números do seu diário. Nada vai sem você ver antes exatamente o que vai e autorizar.`,
    );
  } else if (m.how_to_redeem) {
    lines.push(m.how_to_redeem);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- sharing

/**
 * The version recorded in consents when AUTORIZO answers a share: the words
 * she read are the share's own preview, stored with it.
 */
export const SHARE_CONSENT_TEXT_VERSION = "whatsapp-share-2026-10";

export function isAuthorise(text: string): boolean {
  return ["autorizo", "eu autorizo", "sim autorizo", "sim, autorizo"].includes(plain(text));
}

/** NÃO, answering a share she was shown. "Não quero mais" is SAIR's, not this. */
export function isDecline(text: string): boolean {
  return ["nao", "nao autorizo", "eu nao autorizo", "nao, nao autorizo", "nao compartilhar", "nao quero compartilhar"]
    .includes(plain(text));
}

/** AUTORIZAÇÕES: the shares she has in force. */
export function isSharesText(text: string): boolean {
  return ["autorizacoes", "autorizacao", "minhas autorizacoes", "compartilhamentos", "compartilhamento"].includes(plain(text));
}

/** "ENCERRAR 1" -> 1; anything else -> null. "CANCELAR" alone stays SAIR's. */
export function revokeNumber(text: string): number | null {
  const m = plain(text).match(/^(?:encerrar|encerra|revogar|cancelar)\s+(\d{1,2})$/);
  return m ? Number(m[1]) : null;
}

/** One share as whatsapp_share_list returns it. */
export interface ListedShare {
  n: number;
  recipient: string;
  purpose: string;
  periods: string[];
  expires_on: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
  "outubro", "novembro", "dezembro"];
const ddmmyyyy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

/** ["2026-10", "2026-11"] -> "outubro e novembro de 2026"; across years, each with its own. */
export function monthsText(periods: string[]): string {
  const named = periods.map((p) => ({ year: p.slice(0, 4), month: MONTHS[Number(p.slice(5, 7)) - 1] }));
  const years = [...new Set(named.map((m) => m.year))];
  const list = (xs: string[]) => xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
  if (years.length === 1) return `${list(named.map((m) => m.month))} de ${years[0]}`;
  return list(named.map((m) => `${m.month} de ${m.year}`));
}

/** What AUTORIZAÇÕES answers. */
export function sharesText(shares: ListedShare[]): string {
  if (shares.length === 0) return "Você não está compartilhando os seus números com ninguém agora. 💜";
  return [
    "Com quem você compartilha os seus números agora:",
    shares.map((s) => `${s.n}. *${s.recipient}*, para ${s.purpose}. Meses: ${monthsText(s.periods)}. Até ${ddmmyyyy(s.expires_on)}.`)
      .join("\n"),
    "Para encerrar um deles agora, responda ENCERRAR e o número. Exemplo: ENCERRAR 1.",
  ].join("\n\n");
}

/** whatsapp_share_answer's outcome, in her words. */
export function shareAnswerText(r: { status: string; recipient?: string; expires_on?: string }): string {
  switch (r.status) {
    case "authorised":
      return `Autorização registrada ✅ ${r.recipient} pode consultar o que você viu até ${ddmmyyyy(r.expires_on ?? "")}.\n` +
        "Para encerrar antes, escreva AUTORIZAÇÕES. Obrigada pela confiança. 💜";
    case "declined":
      return `Tudo bem. Nada foi compartilhado com ${r.recipient}. 💜`;
    case "lapsed":
      return "Esse pedido passou dos 7 dias e expirou, então nada foi compartilhado. Se quiser, fale com a equipe da EmpowerFI. 💜";
    default:
      return "Não há nenhum pedido de autorização esperando a sua resposta agora.";
  }
}

/** whatsapp_share_revoke's outcome, in her words. */
export function shareRevokedText(r: { status: string; recipient?: string }): string {
  return r.status === "revoked"
    ? `Pronto ✅ ${r.recipient} não pode mais consultar os seus números.`
    : "Não achei esse número. Escreva AUTORIZAÇÕES para ver a lista.";
}

// ------------------------------------------------------------- correcting

/** One line as journal_list returns it. */
export interface ListedLine {
  n: number;
  day: string;
  kind: "sale" | "expense";
  amount_cents: number;
  payment_method: string;
  category: string | null;
  due_on: string | null;
}

const METHOD_TITLE = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.title])) as Record<string, string>;
const CATEGORY_TITLE = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.title])) as Record<string, string>;
const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function lineText(l: Omit<ListedLine, "due_on"> & { due_on?: string | null }): string {
  const what = l.kind === "sale" ? `Venda · ${METHOD_TITLE[l.payment_method] ?? l.payment_method}` : `Gasto · ${CATEGORY_TITLE[l.category ?? ""] ?? l.category}`;
  const later = l.due_on ? (l.kind === "sale" ? ` (recebe em ${ddmm(l.due_on)})` : ` (paga em ${ddmm(l.due_on)})`) : "";
  return `${l.n}. ${what} · R$ ${formatBRL(l.amount_cents)}${later}`;
}

/** What VER answers: the lines that still count, by day, numbered for APAGAR. */
export function listText(lines: ListedLine[], today: string): string {
  if (lines.length === 0) return "Você não tem registros de ontem nem de hoje. Para registrar, é só mandar o formulário. 💜";
  const parts = ["Seus registros de ontem e de hoje:"];
  for (const day of [addDays(today, -1), today]) {
    const mine = lines.filter((l) => l.day === day);
    if (mine.length === 0) continue;
    parts.push(`*${day === today ? "Hoje" : "Ontem"} (${ddmm(day)})*\n${mine.map(lineText).join("\n")}`);
  }
  parts.push("Para apagar um registro errado, responda APAGAR e o número. Exemplo: APAGAR 2.\nDepois, mande o formulário com o valor certo.");
  return parts.join("\n\n");
}

export function voidedText(v: Omit<ListedLine, "due_on">): string {
  return [
    `Apagado ✅ ${lineText(v)}`,
    "Ele fica guardado como apagado e não entra mais nas contas.",
    "Para lançar o valor certo, é só mandar o formulário.",
  ].join("\n");
}

/** The database's refusals to void, in words she can act on. */
export function voidRefusedText(message: string): string {
  if (message.includes("no_recent_list")) return "Primeiro escreva VER para ver a lista com os números. 💜";
  if (message.includes("no_such_line")) return "Não achei esse número na lista. Escreva VER para ver de novo.";
  if (message.includes("too_old_to_correct")) return "Só dá para corrigir os registros de hoje e de ontem.";
  if (message.includes("month_closed")) {
    return "Esse mês já foi fechado e não dá mais para mudar por aqui. Fale com a equipe da EmpowerFI. 💜";
  }
  return "Não consegui apagar agora. Pode tentar de novo daqui a pouco?";
}

export const EMPTY_FORM_TEXT =
  "Não encontrei nenhum valor no formulário. Se não teve movimento, toque em *Ontem não teve movimento* ou escreva SEM MOVIMENTO. 💜";

export function refusedText(reason: string): string {
  return `Não consegui registrar: ${reason}.\n\nPode mandar o formulário de novo? Se ficou alguma dúvida, escreva AJUDA.`;
}

/**
 * The interactive message that opens the form. Inside the twenty-four hours
 * after she wrote, so it is not billed; the 9 o'clock reminder is a template
 * and is sent elsewhere.
 */
export function sendFlowRequest(
  phoneNumberId: string,
  to: string,
  flowId: string,
  text: string,
): { url: string; init: RequestInit } {
  return {
    url: `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "flow",
          body: { text },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: JOURNAL_FORM,
              flow_id: flowId,
              flow_cta: "Registrar o dia",
              flow_action: "navigate",
              flow_action_payload: { screen: "VENDAS" },
            },
          },
        },
      }),
    },
  };
}

// ---------------------------------------------------------------- the form

const str = { type: "string", __example__: "" };

/** The Flow JSON. docs/whatsapp/diario-flow.pt-BR.json is this, written out. */
export function journalFlow(): unknown {
  const saleFields = SALE_METHODS.flatMap((m) => ("due" in m ? [m.field, m.due] : [m.field]));
  const carried = ["day", ...saleFields];
  const expenseFields = (n: number) => [
    `exp${n}_category`, `exp${n}_amount`, `exp${n}_method`, `exp${n}_paid_now`, `exp${n}_due`,
  ];
  const ref = (scope: "form" | "data", f: string) => `\${${scope}.${f}}`;
  const pass = (fields: string[], scope: "form" | "data") => Object.fromEntries(fields.map((f) => [f, ref(scope, f)]));

  const vendas = {
    id: "VENDAS",
    title: "Registro do dia",
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "RadioButtonsGroup",
          name: "day",
          label: "De que dia é este registro?",
          required: true,
          "init-value": "yesterday",
          "data-source": [{ id: "yesterday", title: "Ontem" }, { id: "today", title: "Hoje" }],
        },
        { type: "TextBody", text: "Quanto você vendeu em cada forma de pagamento? Deixe em branco o que não teve." },
        ...SALE_METHODS.flatMap((m) => {
          const input = { type: "TextInput", name: m.field, label: m.title, "input-type": "number", required: false };
          if (!("due" in m)) return [input];
          return [input, {
            type: "If",
            condition: `${ref("form", m.field)} != ''`,
            then: [{ type: "DatePicker", name: m.due, label: `Quando vai receber do ${m.id === "fiado" ? "fiado" : "cartão"}?`, required: true }],
          }];
        }),
        {
          type: "Footer",
          label: "Continuar",
          "on-click-action": {
            name: "navigate",
            next: { type: "screen", name: "GASTO_1" },
            payload: pass(carried, "form"),
          },
        },
      ],
    },
  };

  const gastos = Array.from({ length: EXPENSE_SCREENS }, (_, i) => {
    const n = i + 1;
    const before = [...carried, ...Array.from({ length: i }, (_, k) => expenseFields(k + 1)).flat()];
    const mine = expenseFields(n);
    const forward = { ...pass(before, "data"), ...pass(mine, "form") };
    return {
      id: `GASTO_${n}`,
      title: n === 1 ? "Gastos do dia" : `Gasto ${n}`,
      terminal: true,
      data: Object.fromEntries(before.map((f) => [f, str])),
      layout: {
        type: "SingleColumnLayout",
        children: [
          { type: "TextBody", text: n === 1 ? "Teve algum gasto? Se não teve, é só tocar em Enviar." : "Mais um gasto:" },
          {
            type: "Dropdown", name: `exp${n}_category`, label: "Tipo de gasto", required: false,
            "data-source": CATEGORIES.map(({ id, title }) => ({ id, title })),
          },
          { type: "TextInput", name: `exp${n}_amount`, label: "Valor", "input-type": "number", required: false },
          {
            type: "Dropdown", name: `exp${n}_method`, label: "Como pagou", required: false,
            "data-source": PAYMENT_METHODS.map(({ id, title }) => ({ id, title })),
          },
          {
            type: "RadioButtonsGroup", name: `exp${n}_paid_now`, label: "Pagou à vista?", required: false,
            "init-value": "yes",
            "data-source": [{ id: "yes", title: "Sim" }, { id: "no", title: "Não, vou pagar depois" }],
          },
          {
            type: "If",
            condition: `${ref("form", `exp${n}_paid_now`)} == 'no'`,
            then: [{ type: "DatePicker", name: `exp${n}_due`, label: "Quando vai pagar?", required: true }],
          },
          ...(n < EXPENSE_SCREENS
            ? [{
              type: "EmbeddedLink",
              text: "Adicionar outro gasto",
              "on-click-action": { name: "navigate", next: { type: "screen", name: `GASTO_${n + 1}` }, payload: forward },
            }]
            : []),
          {
            type: "Footer",
            label: "Enviar",
            "on-click-action": { name: "complete", payload: { form: JOURNAL_FORM, ...forward } },
          },
        ],
      },
    };
  });

  return { version: "6.0", screens: [vendas, ...gastos] };
}
