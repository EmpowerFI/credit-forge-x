// checkin-report — writes the reading of one assembled month, once.
//
// Called by whatsapp-webhook the moment a month is assembled, in the
// background so Meta gets its 200 straight away, and callable again for the
// same month at no cost: the second call returns the reading already written.
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

  let checkinId: string;
  try {
    const body = await req.json();
    checkinId = String(body?.checkin_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(checkinId)) throw new Error("checkin_id is not a uuid");
  } catch (e) {
    return json({ error: String(e) }, 400);
  }

  const { data: claim, error: claimError } = await db.rpc("report_claim", { p_checkin_id: checkinId });
  if (claimError) return json({ error: claimError.message }, 500);
  const action = (claim as { action: string }).action;
  if (action === "busy") return json({ busy: true }, 202);

  const { data: rawInputs, error: inputsError } = await db.rpc("report_inputs", { p_checkin_id: checkinId });
  if (inputsError) {
    await db.rpc("report_fail", { p_checkin_id: checkinId, p_error: inputsError.message });
    return json({ error: inputsError.message }, 500);
  }
  const inputs = rawInputs as Inputs;

  // Already read: the stored reading, nothing called, nothing billed.
  if (action === "done") {
    const stored = (claim as { report: Report; source: string });
    return json({ source: stored.source, repeated: true, text: renderMessage(stored.report, inputs.first_name) });
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
          console.warn("model reading refused", checkinId, checked.reasons);
        }
      } catch (e) {
        // A model that is down, slow or wrong is not her problem: she gets the
        // fallback, and this month is never sent to the model again.
        error = String(e);
        console.error("model call failed", checkinId, error);
      }
    } else if (action === "run_fallback") {
      error = "model attempts exhausted; fallback written";
    } else if (!apiKey) {
      error = "ANTHROPIC_API_KEY not set; fallback written";
    }

    const { error: completeError } = await db.rpc("report_complete", {
      p_checkin_id: checkinId,
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

    return json({ source, refused: refusalReasons.length > 0, text: renderMessage(report, inputs.first_name) });
  } catch (e) {
    await db.rpc("report_fail", { p_checkin_id: checkinId, p_error: String(e) });
    return json({ error: String(e) }, 500);
  }
});
