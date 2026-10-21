// journal-reminder — the nine o'clock reminder, about yesterday.
//
// Called once a day by pg_cron (private.dispatch_journal_reminder, 12:00 UTC,
// 9h in São Paulo) with a shared secret in x-journal-reminder-secret. It
// claims everyone due -- active, enrolled before today, nothing recorded for
// yesterday, not reminded about it yet -- and sends each the approved
// template, recording what Meta answered. A failed send is recorded and not
// retried: one message a morning, at most.
//
// Her number is read from the database for the send and goes nowhere else;
// the log carries counts and Meta's status codes, never a number or a name.
//
// Secrets: JOURNAL_REMINDER_SECRET (scripts/whatsapp/generate-reminder-secret.mts),
// WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID; optional WHATSAPP_REMINDER_TEMPLATE
// (default lembrete_diario); SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// the runtime.

import { createClient } from "@supabase/supabase-js";
import { REMINDER_TEMPLATE, sendReminderRequest } from "../_shared/journal.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function secretMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

interface Due {
  entrepreneur_id: string;
  day: string;
  phone: string | null;
  name: string;
}

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get("x-journal-reminder-secret"), env("JOURNAL_REMINDER_SECRET"))) {
    return json({ error: "forbidden" }, 403);
  }
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    // Nothing is claimed without a way to send: tomorrow's run finds them all again.
    console.warn("journal-reminder: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set");
    return json({ sent: 0, failed: 0, note: "not configured" });
  }
  const template = Deno.env.get("WHATSAPP_REMINDER_TEMPLATE") || REMINDER_TEMPLATE;

  const { data, error } = await db.rpc("journal_reminders_claim");
  if (error) {
    console.error("journal-reminder: claim failed", error.message);
    return json({ error: "claim failed" }, 500);
  }
  const due = (data ?? []) as Due[];

  let sent = 0;
  let failed = 0;
  for (const d of due) {
    let messageId: string | null = null;
    let problem: string | null = null;
    try {
      if (!d.phone) throw new Error("no number on record");
      const { url, init } = sendReminderRequest(phoneNumberId, d.phone.replace(/^\+/, ""), template, d.name);
      const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` };
      const response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
      const body = await response.json().catch(() => null) as
        | { messages?: Array<{ id?: unknown }>; error?: { code?: unknown; message?: unknown } }
        | null;
      const id = body?.messages?.[0]?.id;
      if (response.ok && typeof id === "string") messageId = id;
      else problem = `meta ${response.status}: ${body?.error?.code ?? ""} ${String(body?.error?.message ?? "").slice(0, 200)}`;
    } catch (e) {
      problem = String(e).slice(0, 300);
    }
    const { error: recordError } = await db.rpc("journal_reminder_finished", {
      p_entrepreneur_id: d.entrepreneur_id,
      p_day: d.day,
      p_message_id: messageId,
      p_error: problem,
    });
    if (recordError) console.error("journal-reminder: outcome not recorded", recordError.message);
    if (messageId) sent++;
    else {
      failed++;
      console.warn("journal-reminder: not sent", problem?.replace(/\+?\d{10,15}/g, "<number>"));
    }
  }
  return json({ due: due.length, sent, failed });
});
