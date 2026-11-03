import { useCallback, useEffect, useState } from "react";
import { diaryDb } from "./db";
import { diary } from "./diary";
import { useInstall } from "./pwa";

// Notifications on this phone: Web Push through the diary's service worker.
//
// Asked only when she taps "Ativar", never on its own. Safari counts the
// permission request as hers only if it happens in the tap itself, so the
// worker and the server's public key are fetched beforehand, and the tap
// goes straight to pushManager.subscribe, which asks for the permission.

const SCOPE = "/app/diario";

export type PushStatus =
  | "checking"
  /** iPhone, opened in the browser: iOS notifies only web apps on the home screen. */
  | "needs-install"
  /** iPhone with iOS older than 16.4, or a browser with no Web Push. */
  | "unsupported"
  | "denied"
  | "off"
  | "on";

let publicKey: Promise<string> | null = null;
function serverKey(): Promise<string> {
  publicKey ??= diaryDb.functions.invoke<{ public_key: string }>("diary-push", { method: "GET" }).then(({ data, error }) => {
    if (error || !data?.public_key) throw new Error("no_public_key");
    return data.public_key;
  });
  publicKey.catch(() => {
    publicKey = null;
  });
  return publicKey;
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function register(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("bad_subscription");
  await diary.pushSubscribe(json.endpoint, json.keys.p256dh, json.keys.auth);
}

/**
 * On every visit with notifications on: tells the server this device again,
 * in case the browser rotated its subscription or the server dropped it.
 */
export async function resyncPush() {
  if (!supported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration(SCOPE);
  const sub = await registration?.pushManager.getSubscription();
  if (sub) await register(sub).catch(() => undefined);
}

export function usePush() {
  const { installed, device } = useInstall();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [key, setKey] = useState<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!supported()) {
        setStatus(device === "ios" && !installed ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration(SCOPE) ?? null;
      const k = await serverKey().then(bytes).catch(() => null);
      let sub = await reg?.pushManager.getSubscription() ?? null;
      if (sub && k && !sameKey(sub, k)) {
        // Subscribed to keys this server no longer has: start over.
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
      if (!live) return;
      setRegistration(reg);
      setKey(k);
      setStatus(sub && Notification.permission === "granted" ? "on" : "off");
    })();
    return () => {
      live = false;
    };
  }, [device, installed]);

  /** Must be called straight from her tap. */
  const enable = useCallback(async () => {
    if (!registration || !key) throw new Error("not_ready");
    let sub: PushSubscription;
    try {
      sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch (e) {
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      throw e;
    }
    await register(sub);
    setStatus("on");
  }, [registration, key]);

  const disable = useCallback(async () => {
    const sub = await registration?.pushManager.getSubscription();
    if (sub) {
      await diary.pushUnsubscribe(sub.endpoint);
      await sub.unsubscribe().catch(() => undefined);
    }
    setStatus("off");
  }, [registration]);

  const test = useCallback(async () => {
    const { data, error } = await diaryDb.functions.invoke<{ devices: number; accepted: number }>("diary-push", {
      body: { action: "test" },
    });
    if (error) {
      const status = (error as { context?: Response }).context?.status;
      throw new Error(status === 429 ? "too_many_tests" : "test_failed");
    }
    return data ?? { devices: 0, accepted: 0 };
  }, []);

  return { status, ready: Boolean(registration && key), enable, disable, test };
}
