// The Business Passport as a recipient opens it: the link's JSON from the
// `passport` Edge Function of the credit platform, and every month checked
// here, in the browser, with the issuer's published keys and revocation list.
//
// The issuer is pinned by this deployment (VITE_PASSPORT_ISSUER), never taken
// from the response: a page that trusted the issuer a link names would verify
// anyone's credentials as EmpowerFI's.
import {
  type AnchorProof, checkMonth, credentialInBatch, type EcJwk, type MonthCheck, verifyStatusList,
} from "@empowerfi/passport";
import { rpc } from "./solana";

export const passportIssuer = (import.meta.env.VITE_PASSPORT_ISSUER as string | undefined)?.replace(/\/+$/, "") || null;

export interface SharedPassport {
  issuer: string;
  share: {
    recipient: string;
    purpose: string;
    purpose_text: string;
    subject_ref: string;
    indicators: string[];
    authorised_at: string;
    expires_at: string;
  };
  months: { period: string; version: number; superseded: boolean; presentation: string; anchor: AnchorProof | null }[];
}

export class PassportUnavailable extends Error {
  constructor(public reason: "not_found" | "expired" | "ended" | "not_configured" | "error") {
    super(reason);
  }
}

export async function fetchPassport(token: string): Promise<SharedPassport> {
  if (!passportIssuer) throw new PassportUnavailable("not_configured");
  const res = await fetch(`${passportIssuer}/link/${encodeURIComponent(token)}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({ status: "error" }));
  if (body.status !== "live") {
    const r = body.status;
    throw new PassportUnavailable(r === "not_found" || r === "expired" || r === "ended" || r === "not_configured" ? r : "error");
  }
  if (body.issuer !== passportIssuer) throw new PassportUnavailable("error");
  return body as SharedPassport;
}

export interface AnchorCheck {
  status: "anchored" | "pending" | "invalid" | "unchecked";
  batch?: number;
  at?: string | null;
  signature?: string;
  error?: string;
}

export interface CheckedMonth extends MonthCheck {
  period: string;
  version: number;
  superseded: boolean;
  anchor: AnchorCheck;
}

interface Anchoring {
  authority: string | null;
  memo_program: string;
}

/**
 * The anchor half: the credential is the leaf its proof names, under the
 * root that a Memo signed by the published authority carries, in the
 * transaction the proof names -- asked of Solana from this browser.
 */
async function checkAnchor(presentation: string, a: AnchorProof | null, anchoring: Anchoring): Promise<AnchorCheck> {
  if (!a) return { status: "pending" };
  const base = { batch: a.batch_no, at: a.block_time, signature: a.signature };
  if (!(await credentialInBatch(presentation, a))) return { ...base, status: "invalid", error: "not in its batch" };
  try {
    const tx = await rpc.getTransaction(a.signature as never, {
      encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed",
    }).send() as unknown as {
      meta: { err: unknown } | null;
      transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: { programId: string; parsed?: unknown }[] } };
    } | null;
    if (!tx || tx.meta?.err) return { ...base, status: "invalid", error: "transaction not found or failed" };
    const memo = `EMPOWERFI:PASSPORT_BATCH:v1:${a.batch_no}:${a.size}:${a.root}`;
    const said = tx.transaction.message.instructions.some((i) => i.programId === anchoring.memo_program && i.parsed === memo);
    const signed = tx.transaction.message.accountKeys.some((k) => k.pubkey === anchoring.authority && k.signer);
    if (!said) return { ...base, status: "invalid", error: "the memo is not this batch" };
    if (!signed || !anchoring.authority) return { ...base, status: "invalid", error: "not signed by the anchoring authority" };
    return { ...base, status: "anchored" };
  } catch (e) {
    return { ...base, status: "unchecked", error: String((e as Error).message ?? e) };
  }
}

/** Signature, status and time of every month, against the pinned issuer only. */
export async function checkPassport(p: SharedPassport): Promise<CheckedMonth[]> {
  const issuer = passportIssuer!;
  const { keys } = (await (await fetch(`${issuer}/jwks`)).json()) as { keys: EcJwk[] };
  const anchoring = (await (await fetch(`${issuer}/anchoring`)).json()) as Anchoring;
  const lists = new Map<string, Promise<Uint8Array>>();
  const statusList = (url: string) => {
    // Only the issuer's own list counts.
    if (!url.startsWith(`${issuer}/`)) return Promise.reject(new Error("status list from elsewhere"));
    if (!lists.has(url)) {
      lists.set(url, fetch(url).then((r) => r.text()).then((jwt) => verifyStatusList(jwt, keys, issuer)).then((l) => l.list));
    }
    return lists.get(url)!;
  };
  return Promise.all(p.months.map(async (m) => {
    const [c, anchor] = await Promise.all([checkMonth(m.presentation, keys, statusList), checkAnchor(m.presentation, m.anchor, anchoring)]);
    const month = { period: m.period, version: m.version, superseded: m.superseded, anchor };
    if (c.month && c.month.credential.issuer !== issuer) {
      return { ...c, ...month, signature: "invalid" as const, error: "issued by someone else" };
    }
    return { ...c, ...month };
  }));
}
