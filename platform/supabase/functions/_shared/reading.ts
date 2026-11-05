// reading — writes the reading of one month or one week, once.
//
// Shared by checkin-report (called by the platform with the service key) and
// diary-reading (called by her diary in the browser, with her session). Both
// hand it a service-role client; who may ask is their business, not this
// file's.
//
// The order matters and is the safety design:
//
//   1. Claim the period. A period already read returns its reading; one
//      being read right now returns busy. Two calls for the same period
//      cannot both reach the model.
//   2. Compute the figures (checkin-insights), and build the fallback reading
//      from them -- BEFORE any network call. Whatever happens next, a safe
//      reading already exists.
//   3. Ask the model, with a hard timeout, and run its answer through every
//      check in report.ts. A refused answer is replaced by the fallback, and
//      the reasons are kept for review.
//   4. Record the reading, who wrote it, the tokens and the cost.
//
// Her first name goes into the message here and nowhere near the model. When
// she has turned the AI off (ai_reading), the model is not called at all.
//
// Secrets: ANTHROPIC_API_KEY (without it every reading is the fallback, which
// is a deliberate and safe degradation); optional ANTHROPIC_MODEL,
// ANTHROPIC_USD_PER_MTOK_IN, ANTHROPIC_USD_PER_MTOK_OUT for the cost record.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeInsights, INSIGHTS_FORMULA_VERSION, type MonthFigures } from "./checkin-insights/index.ts";
import {
  anthropicRequest, costMicroUsd, coverageLine, DEFAULT_MODEL, fallbackReport, parseAnthropicResponse,
  PROMPT_VERSION, renderMessage, type Report, validateReport,
} from "./report.ts";

const UUID = /^[0-9a-f-]{36}$/i;

/** Which record a call is about, and the RPCs that read and write it. */
export interface Target {
  span: "month" | "week";
  key: Record<string, string>;
  rpc: { claim: string; inputs: string; complete: string; fail: string };
}

/** A week of the daily journal, named by its Monday. */
export function weekTarget(entrepreneurId: string, weekStart: string): Target {
  if (!UUID.test(entrepreneurId)) throw new Error("entrepreneur_id is not a uuid");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("week_start is not a date");
  return {
    span: "week",
    key: { p_entrepreneur_id: entrepreneurId, p_week_start: weekStart },
    rpc: {
      claim: "journal_reading_claim", inputs: "journal_reading_inputs",
      complete: "journal_reading_complete", fail: "journal_reading_fail",
    },
  };
}

/** { checkin_id } for an assembled month, { entrepreneur_id, week_start } for a week. */
export function targetOf(body: Record<string, unknown> | null): Target {
  if (body && typeof body.checkin_id === "string") {
    if (!UUID.test(body.checkin_id)) throw new Error("checkin_id is not a uuid");
    return {
      span: "month",
      key: { p_checkin_id: body.checkin_id },
      rpc: { claim: "report_claim", inputs: "report_inputs", complete: "report_complete", fail: "report_fail" },
    };
  }
  if (body && typeof body.entrepreneur_id === "string" && typeof body.week_start === "string") {
    return weekTarget(body.entrepreneur_id, body.week_start);
  }
  throw new Error("expected { checkin_id } or { entrepreneur_id, week_start }");
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
  /** Weeks only: days kept in the last thirty, said by code under the reading. */
  coverage?: { kept: number; days: number } | null;
  /** Weeks only: false when she chose a reading without AI. Absent: on. */
  ai_reading?: boolean;
}

/** What a reading call answers: an HTTP status and its body. */
export interface ReadingResult {
  status: number;
  body: { busy?: true; source?: string; repeated?: true; refused?: boolean; text?: string; error?: string };
}

/** Claims, computes, asks the model, checks and records one period's reading. */
export async function writeReading(db: SupabaseClient, target: Target): Promise<ReadingResult> {
  const label = Object.values(target.key).join(" ");

  const { data: claim, error: claimError } = await db.rpc(target.rpc.claim, target.key);
  if (claimError) return { status: 500, body: { error: claimError.message } };
  const action = (claim as { action: string }).action;
  if (action === "busy") return { status: 202, body: { busy: true } };

  const { data: rawInputs, error: inputsError } = await db.rpc(target.rpc.inputs, target.key);
  if (inputsError) {
    await db.rpc(target.rpc.fail, { ...target.key, p_error: inputsError.message });
    return { status: 500, body: { error: inputsError.message } };
  }
  const inputs = rawInputs as Inputs;

  // Already read: the stored reading, nothing called, nothing billed.
  if (action === "done") {
    const stored = (claim as { report: Report; source: string });
    return {
      status: 200,
      body: { source: stored.source, repeated: true, text: renderMessage(stored.report, inputs.first_name, target.span, coverageLine(inputs.coverage)) },
    };
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

    if (inputs.ai_reading === false) {
      // Her choice: the same figures, in fixed sentences, and nothing sent out.
      error = "she chose a reading without AI; fallback written";
    } else if (action === "run" && apiKey) {
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
        // fallback, and this period is never sent to the model again.
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

    return {
      status: 200,
      body: { source, refused: refusalReasons.length > 0, text: renderMessage(report, inputs.first_name, target.span, coverageLine(inputs.coverage)) },
    };
  } catch (e) {
    await db.rpc(target.rpc.fail, { ...target.key, p_error: String(e) });
    return { status: 500, body: { error: String(e) } };
  }
}
