// fx-quote — what USDC is actually worth in reais, read from public prices.
//
// Called every ten minutes by pg_cron (private.dispatch_fx_quote) with the
// anchoring secret in x-anchor-secret, and by any signed-in person asking for a
// fresh look. Two sources, and the difference between them is the point:
//
//   Mercado Bitcoin  USDC/BRL  the price at which USDC becomes reais in Brazil
//   Banco Central    USD/BRL   PTAX, the official rate, as the reference beside it
//
// Neither request carries a parameter of ours: no amount, no wallet, no person.
// Both are public price endpoints, and the platform only records what they
// said and when they said it. What a provider would charge to move the money is not
// here — that is its rate card, and MoneyGram's sandbox quote, which is a
// price for a transaction rather than an observation of a market.
//
// A source that fails, answers nonsense or has gone stale is skipped, not
// guessed at: the database falls back to its stated assumption and says so.
//
// Secrets: ANCHOR_CRON_SECRET; SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anchor-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

/** Constant-time enough for a shared secret. */
function secretMatches(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export interface FxRow {
  source: "mercado_bitcoin" | "bcb_ptax";
  pair: "USDC/BRL" | "USD/BRL";
  bid_milli: number;
  ask_milli: number;
  mid_milli: number;
  observed_at: string;
}

/** Reais per unit in thousandths. A price outside R$1–R$20 is not a rate, it is a bug. */
export function milli(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 20) throw new Error(`not a plausible BRL rate: ${String(value)}`);
  return Math.round(n * 1000);
}

/** An instant, refused when it is in the future or older than the window that pair allows. */
function instant(ms: number, now: number, maxAgeMs: number): string {
  if (!Number.isFinite(ms)) throw new Error("not a timestamp");
  if (ms > now + 5 * 60_000 || ms < now - maxAgeMs) throw new Error(`timestamp out of range: ${new Date(ms).toISOString()}`);
  return new Date(ms).toISOString();
}

/** A venue's epoch seconds, within the last day. */
export function observedAt(epochSeconds: unknown, now = Date.now()): string {
  const n = typeof epochSeconds === "string" ? Number(epochSeconds) : typeof epochSeconds === "number" ? epochSeconds : NaN;
  if (!Number.isFinite(n)) throw new Error(`not a timestamp: ${String(epochSeconds)}`);
  return instant(n * 1000, now, 24 * 3600_000);
}

/** Mercado Bitcoin's USDC/BRL ticker: the top of the book, in reais. */
export function readMercadoBitcoin(body: unknown, now = Date.now()): FxRow {
  const t = (Array.isArray(body) ? body[0] : null) as
    { pair?: string; buy?: string; sell?: string; last?: string; date?: number } | null;
  if (!t || t.pair !== "USDC-BRL") throw new Error("no USDC-BRL ticker");
  const bid = milli(t.buy);
  const ask = milli(t.sell);
  if (ask < bid) throw new Error("ask below bid");
  return {
    source: "mercado_bitcoin",
    pair: "USDC/BRL",
    bid_milli: bid,
    ask_milli: ask,
    mid_milli: Math.round((bid + ask) / 2),
    observed_at: observedAt(t.date, now),
  };
}

/**
 * The Banco Central's PTAX, the official commercial dollar. It publishes on
 * business days, so the last one may be Friday's — a week's window, and the
 * newest entry in it. Its timestamps are Brasília time, which has had no
 * daylight saving since 2019, so they are read at UTC-03:00.
 */
export function readBcbPtax(body: unknown, now = Date.now()): FxRow {
  const rows = (body as { value?: { cotacaoCompra?: number; cotacaoVenda?: number; dataHoraCotacao?: string }[] } | null)?.value;
  const q = Array.isArray(rows) ? rows[rows.length - 1] : null;
  if (!q) throw new Error("no PTAX quote in the period");
  const bid = milli(q.cotacaoCompra);
  const ask = milli(q.cotacaoVenda);
  if (ask < bid) throw new Error("ask below bid");
  if (typeof q.dataHoraCotacao !== "string") throw new Error("no PTAX timestamp");
  const ms = Date.parse(`${q.dataHoraCotacao.replace(" ", "T")}-03:00`);
  return {
    source: "bcb_ptax",
    pair: "USD/BRL",
    bid_milli: bid,
    ask_milli: ask,
    mid_milli: Math.round((bid + ask) / 2),
    observed_at: instant(ms, now, 8 * 24 * 3600_000),
  };
}

/** MM-DD-YYYY, the only date format the PTAX service takes. */
export const ptaxDate = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`;

export function ptaxUrl(now = Date.now()): string {
  const from = ptaxDate(new Date(now - 7 * 24 * 3600_000));
  const to = ptaxDate(new Date(now + 24 * 3600_000));
  return "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    + "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
    + `?@dataInicial='${from}'&@dataFinalCotacao='${to}'&$top=200&$format=json`;
}

// The URL is built per run, not at module load: a function instance lives for
// days, and PTAX is asked for a window ending today.
const SOURCES: { name: string; url: () => string; read: (body: unknown, now?: number) => FxRow }[] = [
  {
    name: "mercado_bitcoin",
    url: () => "https://api.mercadobitcoin.net/api/v4/tickers?symbols=USDC-BRL",
    read: readMercadoBitcoin,
  },
  {
    name: "bcb_ptax",
    url: () => ptaxUrl(),
    read: readBcbPtax,
  },
];

async function readSource(s: (typeof SOURCES)[number]): Promise<{ row?: FxRow; error?: string }> {
  try {
    const res = await fetch(s.url(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { error: `${s.name}: HTTP ${res.status}` };
    return { row: s.read(await res.json()) };
  } catch (err) {
    return { error: `${s.name}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // The cron, or anyone signed in asking for a fresh look.
  if (!secretMatches(req.headers.get("x-anchor-secret"), env("ANCHOR_CRON_SECRET"))) {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "unauthorized" }, 401);
    const asCaller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: who, error } = await asCaller.auth.getUser();
    if (error || !who.user) return json({ error: "unauthorized" }, 401);
  }

  const read = await Promise.all(SOURCES.map(readSource));
  const rows = read.flatMap((r) => (r.row ? [r.row] : []));
  const errors = read.flatMap((r) => (r.error ? [r.error] : []));
  if (rows.length === 0) return json({ recorded: 0, rows: [], errors }, 502);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: recorded, error } = await db.rpc("record_fx_rates", { p_rows: rows });
  if (error) return json({ error: error.message, rows, errors }, 500);

  return json({ recorded: recorded ?? 0, rows, errors });
});
