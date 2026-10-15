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

/** What a quick-reply button sends when she taps "Ontem não teve movimento". */
export const QUIET_YESTERDAY = "journal_quiet_yesterday";

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
export function isQuietText(text: string): boolean {
  const s = text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.!]+$/, "");
  return ["sem movimento", "nao teve movimento", "ontem nao teve movimento", "ontem sem movimento"].includes(s);
}

// ---------------------------------------------------------------- replying

export interface DaySummary {
  quiet: boolean;
  sales_cents: number;
  expenses_cents: number;
  /** Days kept so far in the calendar week of the day, including it. */
  week_kept: number;
  /** Days of that week up to and including the day. */
  week_days: number;
}

/**
 * What she reads the moment the form is in. Fixed text, not a model: it
 * arrives at once, costs nothing, and its sums are the database's.
 */
export function confirmationText(day: string, sentAt: Date, s: DaySummary): string {
  const which = day === spDate(sentAt) ? "Hoje" : "Ontem";
  const head = s.quiet
    ? `Anotado ✅ ${which} não teve movimento.`
    : `Registrado ✅ ${which}: R$ ${formatBRL(s.sales_cents)} em vendas e R$ ${formatBRL(s.expenses_cents)} em gastos.`;
  const week = s.week_kept === s.week_days
    ? `Você registrou todos os ${s.week_days === 1 ? "dias" : `${s.week_days} dias`} desta semana até agora. 💜`
    : `Nesta semana você registrou ${s.week_kept} de ${s.week_days} dias.`;
  return `${head}\n${week}\n\nTeve mais algum gasto? É só mandar o formulário de novo, que soma.`;
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
