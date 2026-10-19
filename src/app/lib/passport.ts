// The Business Passport as a recipient opens it: the link's JSON from the
// `passport` Edge Function of the credit platform, and every month checked
// here, in the browser, with the issuer's published keys and revocation list.
//
// The issuer is pinned by this deployment (VITE_PASSPORT_ISSUER), never taken
// from the response: a page that trusted the issuer a link names would verify
// anyone's credentials as EmpowerFI's.
import {
  checkMonth, type EcJwk, type MonthCheck, verifyStatusList,
} from "@empowerfi/passport";

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
  months: { period: string; version: number; superseded: boolean; presentation: string }[];
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

export interface CheckedMonth extends MonthCheck {
  period: string;
  version: number;
  superseded: boolean;
}

/** Signature, status and time of every month, against the pinned issuer only. */
export async function checkPassport(p: SharedPassport): Promise<CheckedMonth[]> {
  const issuer = passportIssuer!;
  const { keys } = (await (await fetch(`${issuer}/jwks`)).json()) as { keys: EcJwk[] };
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
    const c = await checkMonth(m.presentation, keys, statusList);
    if (c.month && c.month.credential.issuer !== issuer) {
      return { ...c, signature: "invalid" as const, error: "issued by someone else", period: m.period, version: m.version, superseded: m.superseded };
    }
    return { ...c, period: m.period, version: m.version, superseded: m.superseded };
  }));
}
