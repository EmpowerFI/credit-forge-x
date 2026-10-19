// passport — the Business Passport's public face. Three reads, no writes
// anyone outside can direct:
//
//   GET …/passport/jwks          the issuer's public keys (current and retired)
//   GET …/passport/status/1      the revocation list, a signed Bitstring Status List
//   GET …/passport/link/<token>  what a recipient's link opens
//   GET …/passport/anchoring     who signs the Solana batches, and where
//
// The link is the recipient's: a token staff created for a share she
// authorised (share_link_create). Opening it records the opening, signs any
// month of the share not yet signed, and returns each month presented with
// only the indicators she authorised. Nothing is returned for a link that is
// unknown, expired or ended beyond which of the three it is.
//
// The signing key is this function's secret and nowhere else: not in the
// database, not in the repository. A database read gives anyone the signed
// credentials, which they could also be shown; it never gives them the power
// to sign one.
//
// Secrets: PASSPORT_SIGNING_KEY (private ES256 JWK, from
// scripts/passport/generate-key.mts); optional PASSPORT_RETIRED_KEYS (JSON
// array of retired public JWKs, still published so older credentials verify);
// optional PASSPORT_ISSUER (defaults to this function's URL);
// PASSPORT_ANCHOR_AUTHORITY (the public address that signs the batches, never
// its key); SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY from the runtime.

import { createClient } from "@supabase/supabase-js";
import {
  DISCLOSABLE, type EcJwk, issueMonth, issueStatusList, PASSPORT_VERSION, present, publicJwk,
} from "../_shared/passport/index.ts";

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const ISSUER = Deno.env.get("PASSPORT_ISSUER") ?? `${env("SUPABASE_URL")}/functions/v1/passport`;
const STATUS_URL = `${ISSUER}/status/1`;
const CREDENTIAL_DAYS = 365;

function signingKey(): EcJwk | null {
  const raw = Deno.env.get("PASSPORT_SIGNING_KEY");
  if (!raw) return null;
  const key = JSON.parse(raw) as EcJwk;
  if (!key.d || !key.kid) throw new Error("PASSPORT_SIGNING_KEY is not a private JWK with a kid");
  return key;
}

function publishedKeys(): EcJwk[] {
  const key = signingKey();
  const retired = JSON.parse(Deno.env.get("PASSPORT_RETIRED_KEYS") ?? "[]") as EcJwk[];
  return [...(key ? [publicJwk(key)] : []), ...retired.map(publicJwk)];
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": cache },
  });
}

/** A month's credential: the one already signed, or signed now. */
async function credentialOf(snapshotId: string, key: EcJwk): Promise<string> {
  const { data, error } = await db.rpc("passport_credential_begin", { p_snapshot_id: snapshotId });
  if (error) throw new Error(`begin: ${error.message}`);
  const c = data as Record<string, unknown>;
  if (c.status === "issued") return String(c.sd_jwt);

  const now = new Date();
  const until = new Date(now.getTime() + CREDENTIAL_DAYS * 86_400_000);
  const indicators = Object.fromEntries(
    DISCLOSABLE.filter((k) => typeof (c.indicators as Record<string, unknown>)?.[k] === "number")
      .map((k) => [k, (c.indicators as Record<string, number>)[k]]),
  );
  const sdJwt = await issueMonth({
    credentialId: String(c.id),
    issuer: ISSUER,
    statusListUrl: STATUS_URL,
    statusIndex: Number(c.status_index),
    validFrom: now.toISOString(),
    validUntil: until.toISOString(),
    subjectRef: String(c.subject_ref),
    period: String(c.period),
    snapshotVersion: Number(c.version),
    methodology: String(c.methodology),
    evidenceLevel: c.evidence_level as "SELF_DECLARED",
    dataOrigin: String(c.data_origin),
    daysInPeriod: Number(c.days_in_period),
    indicators,
  }, key);
  const { data: stored, error: storeError } = await db.rpc("passport_credential_complete", {
    p_id: c.id,
    p_sd_jwt: sdJwt,
    p_kid: key.kid,
    p_valid_from: now.toISOString(),
    p_valid_until: until.toISOString(),
  });
  if (storeError) throw new Error(`complete: ${storeError.message}`);
  return String(stored);
}

async function link(token: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ status: "not_found" }, 404);
  const key = signingKey();
  if (!key) return json({ status: "not_configured" }, 503);

  const { data, error } = await db.rpc("passport_link_open", { p_token: token });
  if (error) {
    console.error("link open failed", error.message);
    return json({ status: "error" }, 500);
  }
  const opened = data as {
    status: string;
    share?: Record<string, unknown> & { indicators: string[] };
    months?: {
      snapshot_id: string;
      period: string;
      version: number;
      superseded: boolean;
      sd_jwt: string | null;
      anchor: Record<string, unknown> | null;
    }[];
  };
  if (opened.status !== "live") return json({ status: opened.status }, opened.status === "not_found" ? 404 : 410);

  const share = opened.share!;
  const months = [];
  for (const m of opened.months ?? []) {
    const sdJwt = m.sd_jwt ?? await credentialOf(m.snapshot_id, key);
    months.push({
      period: m.period,
      version: m.version,
      superseded: m.superseded,
      // The same signed credential, showing only what she authorised.
      presentation: present(sdJwt, share.indicators),
      // The confirmed batch its credential is in, with the path to the root;
      // null until the next daily batch confirms.
      anchor: m.anchor,
    });
  }
  return json({
    status: "live",
    passport_version: PASSPORT_VERSION,
    issuer: ISSUER,
    jwks: `${ISSUER}/jwks`,
    anchoring: `${ISSUER}/anchoring`,
    share,
    months,
  });
}

async function statusList(): Promise<Response> {
  const key = signingKey();
  if (!key) return json({ status: "not_configured" }, 503);
  const { data, error } = await db.rpc("passport_status_revoked");
  if (error) {
    console.error("status list failed", error.message);
    return json({ status: "error" }, 500);
  }
  const now = new Date();
  const jwt = await issueStatusList({
    issuer: ISSUER,
    url: STATUS_URL,
    validFrom: now.toISOString(),
    validUntil: new Date(now.getTime() + 86_400_000).toISOString(),
    revoked: (data as number[]) ?? [],
  }, key);
  return new Response(jwt, {
    headers: { ...CORS, "Content-Type": "application/vc+jwt", "Cache-Control": "public, max-age=300" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return json({ status: "method_not_allowed" }, 405);

  // The path arrives as /passport/… behind the gateway; read what follows the name.
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const at = parts.lastIndexOf("passport");
  const [what, arg] = parts.slice(at + 1);
  try {
    if (what === "jwks") return json({ keys: publishedKeys() }, 200, "public, max-age=300");
    if (what === "anchoring") {
      return json({
        authority: Deno.env.get("PASSPORT_ANCHOR_AUTHORITY") ?? null,
        cluster: "devnet",
        memo_program: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
        memo: "EMPOWERFI:PASSPORT_BATCH:v1:<batch>:<size>:<root hex>",
        tree: "RFC 9162",
        leaf: "SHA-256(\"EMPOWERFI:PASSPORT_CREDENTIAL:v1\" 0x00 issuer-signed JWT)",
      }, 200, "public, max-age=300");
    }
    if (what === "status" && arg === "1") return await statusList();
    if (what === "link" && arg) return await link(arg);
    return json({ status: "not_found" }, 404);
  } catch (error) {
    console.error("passport failed", String(error));
    return json({ status: "error" }, 500);
  }
});
