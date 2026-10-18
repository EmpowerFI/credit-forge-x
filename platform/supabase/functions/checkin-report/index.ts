// checkin-report — writes the reading of one month or one week, once.
//
// Two bodies, one procedure:
//   { checkin_id }                   an assembled month (ai_analyses)
//   { entrepreneur_id, week_start }  a week of the daily journal (journal_readings)
//
// Called by whatsapp-webhook in the background so Meta gets its 200 straight
// away, and callable again for the same period at no cost: the second call
// returns the reading already written.
//
// The order matters and is the safety design:
//
//   1. Claim the month (report_claim). A month already read returns its
//      reading; a month being read right now returns busy. Two deliveries of
//      the same month cannot both reach the model.
//   2. Compute the figures (checkin-insights), and build the fallback reading
//      from them -- BEFORE any network call. Whatever happens next, a safe
//      reading already exists.
//   3. Ask the model, with a hard timeout, and run its answer through every
//      check in _shared/report.ts. A refused answer is replaced by the
//      fallback, and the reasons are kept for review.
//   4. Record the reading, who wrote it, the tokens and the cost.
//
// Her first name goes into the message here and nowhere near the model.
//
// Secrets: ANTHROPIC_API_KEY (without it every reading is the fallback, which
// is a deliberate and safe degradation); optional ANTHROPIC_MODEL,
// ANTHROPIC_USD_PER_MTOK_IN, ANTHROPIC_USD_PER_MTOK_OUT for the cost record;
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import { computeInsights, INSIGHTS_FORMULA_VERSION, type MonthFigures } from "../_shared/checkin-insights/index.ts";
import {
  anthropicRequest, costMicroUsd, DEFAULT_MODEL, fallbackReport, parseAnthropicResponse,
  PROMPT_VERSION, renderMessage, type Report, validateReport,
} from "../_shared/report.ts";

const UUID = /^[0-9a-f-]{36}$/i;

/** Which record a call is about, and the RPCs that read and write it. */
interface Target {
  span: "month" | "week";
  key: Record<string, string>;
  rpc: { claim: string; inputs: string; complete: string; fail: string };
}

function targetOf(body: Record<string, unknown> | null): Target {
  if (body && typeof body.checkin_id === "string") {
    if (!UUID.test(body.checkin_id)) throw new Error("checkin_id is not a uuid");
    return {
      span: "month",
      key: { p_checkin_id: body.checkin_id },
      rpc: { claim: "report_claim", inputs: "report_inputs", complete: "report_complete", fail: "report_fail" },
    };
  }
  if (body && typeof body.entrepreneur_id === "string" && typeof body.week_start === "string") {
    if (!UUID.test(body.entrepreneur_id)) throw new Error("entrepreneur_id is not a uuid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.week_start)) throw new Error("week_start is not a date");
    return {
      span: "week",
      key: { p_entrepreneur_id: body.entrepreneur_id, p_week_start: body.week_start },
      rpc: {
        claim: "journal_reading_claim", inputs: "journal_reading_inputs",
        complete: "journal_reading_complete", fail: "journal_reading_fail",
      },
    };
  }
  throw new Error("expected { checkin_id } or { entrepreneur_id, week_start }");
}

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(env("SUPABASE_URL"), SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time enough for a shared secret, never short-circuiting. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length === 0 || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const numberEnv = (name: string): number | undefined => {
  const v = Deno.env.get(name);
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

interface Inputs {
  first_name: string | null;
  sector: string | null;
  current: MonthFigures;
  previous: MonthFigures | null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Only the platform itself calls this: it spends money on every new month.
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secretMatches(bearer, SERVICE_KEY)) return json({ error: "forbidden" }, 403);

  let target: Target;
  try {
    target = targetOf(await req.json());
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
  const label = Object.values(target.key).join(" ");

  const { data: claim, error: claimError } = await db.rpc(target.rpc.claim, target.key);
  if (claimError) return json({ error: claimError.message }, 500);
  const action = (claim as { action: string }).action;
  if (action === "busy") return json({ busy: true }, 202);

  const { data: rawInputs, error: inputsError } = await db.rpc(target.rpc.inputs, target.key);
  if (inputsError) {
    await db.rpc(target.rpc.fail, { ...target.key, p_error: inputsError.message });
    return json({ error: inputsError.message }, 500);
  }
  const inputs = rawInputs as Inputs;

  // Already read: the stored reading, nothing called, nothing billed.
  if (action === "done") {
    const stored = (claim as { report: Report; source: string });
    return json({ source: stored.source, repeated: true, text: renderMessage(stored.report, inputs.first_name, target.span) });
  }

  try {
    const insights = computeInsights({ current: inputs.current, previous: inputs.previous });
    const fallback = fallbackReport(insights);

    let report: Report = fallback;
    let source: "model" | "fallback" = "fallback";
    let refusalReasons: string[] = [];
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let error: string | null = null;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

    if (action === "run" && apiKey) {
      try {
        const { url, init, facts } = anthropicRequest(apiKey, model, insights, inputs.sector);
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`model answered ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);

        const parsed = parseAnthropicResponse(body);
        if (!parsed) throw new Error("model returned no report");
        inputTokens = parsed.inputTokens;
        outputTokens = parsed.outputTokens;

        const checked = validateReport(parsed.input, facts.allowedNumbers);
        if (checked.ok) {
          report = checked.report;
          source = "model";
        } else {
          refusalReasons = checked.reasons;
          console.warn("model reading refused", label, checked.reasons);
        }
      } catch (e) {
        // A model that is down, slow or wrong is not her problem: she gets the
        // fallback, and this month is never sent to the model again.
        error = String(e);
        console.error("model call failed", label, error);
      }
    } else if (action === "run_fallback") {
      error = "model attempts exhausted; fallback written";
    } else if (!apiKey) {
      error = "ANTHROPIC_API_KEY not set; fallback written";
    }

    const { error: completeError } = await db.rpc(target.rpc.complete, {
      ...target.key,
      p_source: source,
      p_model: source === "model" || inputTokens !== null ? model : null,
      p_prompt_version: PROMPT_VERSION,
      p_formula_version: INSIGHTS_FORMULA_VERSION,
      p_insights: insights,
      p_report: report,
      p_refusal_reasons: refusalReasons,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cost_micro_usd: inputTokens === null || outputTokens === null
        ? null
        : costMicroUsd(inputTokens, outputTokens, numberEnv("ANTHROPIC_USD_PER_MTOK_IN"), numberEnv("ANTHROPIC_USD_PER_MTOK_OUT")),
      p_error: error,
    });
    if (completeError) throw new Error(completeError.message);

    return json({ source, refused: refusalReasons.length > 0, text: renderMessage(report, inputs.first_name, target.span) });
  } catch (e) {
    await db.rpc(target.rpc.fail, { ...target.key, p_error: String(e) });
    return json({ error: String(e) }, 500);
  }
});
