// The diary's Web Push: what a notification says, and how a push service's
// answer is read. Kept apart from diary-push so the rules can be tested
// without a network.
//
// A notification carries no figure and no name: a lock screen is read by
// whoever holds the phone.

export type ReminderKind = "daily" | "pause";

export interface Notification {
  title: string;
  body: string;
  /** Where a tap takes her: inside the diary, with the reminder's id when there is one. */
  url: string;
  /** One reminder at a time on her screen: a newer one replaces an older one. */
  tag: string;
}

export function reminderNotification(kind: ReminderKind, reminderId: string): Notification {
  const url = `/app/diario?lembrete=${encodeURIComponent(reminderId)}`;
  if (kind === "pause") {
    return {
      title: "Vamos pausar os lembretes",
      body: "Faz uma semana sem registro. Quando quiser voltar, é só abrir o diário.",
      url,
      tag: "diario-lembrete",
    };
  }
  return {
    title: "Como foram suas vendas hoje? 💜",
    body: "Registre seu dia na EmpowerFI. Leva menos de 1 minuto!",
    url,
    tag: "diario-lembrete",
  };
}

export function testNotification(): Notification {
  return {
    title: "Notificações ativadas ✅",
    body: "É assim que o lembrete do diário vai chegar neste celular.",
    url: "/app/diario/lembretes",
    tag: "diario-teste",
  };
}

/** How long a push service should keep trying: a reminder about today is no use tomorrow. */
export const REMINDER_TTL_SECONDS = 4 * 60 * 60;
export const TEST_TTL_SECONDS = 10 * 60;

export type PushOutcome = "accepted" | "failed" | "gone";

/**
 * A push service's HTTP answer, as diary_push_finished records it. 404 and
 * 410 mean the subscription no longer exists (she uninstalled, cleared the
 * site, or the browser rotated it): it is dropped. Anything else that is not
 * a success counts as a failure; five in a row and the device is dropped.
 * Accepted is all a 201 says -- not delivered, not seen.
 */
export function outcomeOf(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "accepted";
  if (status === 404 || status === 410) return "gone";
  return "failed";
}

/** The same list as private.is_push_service: never POST to an address that is not a push service. */
export function isPushService(endpoint: string): boolean {
  let host: string;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.port !== "") return false;
    host = url.hostname;
  } catch {
    return false;
  }
  return /^(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/
    .test(host);
}

/** VAPID_KEYS_B64: the JWK pair from scripts/diary/generate-push-keys.mts, base64url of its JSON. */
export function decodeVapidKeys(b64: string): { publicKey: JsonWebKey; privateKey: JsonWebKey } {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const parsed = JSON.parse(atob(padded));
  if (parsed?.publicKey?.kty !== "EC" || parsed?.privateKey?.kty !== "EC" || !parsed.privateKey.d) {
    throw new Error("VAPID_KEYS_B64 is not a P-256 key pair");
  }
  return parsed;
}
