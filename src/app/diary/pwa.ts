import { useEffect, useSyncExternalStore } from "react";

// The diary as an installable app: its manifest and icons in the page head
// while the diary is open, its service worker (public/app/diario-sw.js, which
// keeps the page and the build files, never her figures), and what the
// browser lets us do about installing it.
//
// The manifest is added here rather than in index.html because the same
// index.html serves the whole site: only /app/diario is meant to install.

const SW_URL = "/app/diario-sw.js";
const SCOPE = "/app/diario";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Device = "ios" | "android" | "other";

export interface InstallState {
  /** Already opened from the home screen. */
  installed: boolean;
  device: Device;
  /** The browser offered its own install dialog (Chrome and others on Android). */
  canPrompt: boolean;
}

// The install offer arrives once, early, and is ours to keep until she taps.
let offer: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    offer = e as BeforeInstallPromptEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    installedNow = true;
    changed();
  });
}

function device(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function standalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

let snapshot: InstallState | null = null;
function read(): InstallState {
  const next = { installed: installedNow || standalone(), device: device(), canPrompt: offer !== null };
  if (!snapshot || snapshot.installed !== next.installed || snapshot.canPrompt !== next.canPrompt || snapshot.device !== next.device) {
    snapshot = next;
  }
  return snapshot;
}

export function useInstall(): InstallState & { prompt: () => Promise<void> } {
  const state = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
  return {
    ...state,
    prompt: async () => {
      if (!offer) return;
      const shown = offer;
      offer = null;
      await shown.prompt();
      await shown.userChoice.catch(() => undefined);
      changed();
    },
  };
}

/** Puts the diary's manifest and icon in the head, and registers its service worker. Undone when the diary closes. */
export function useDiaryPwa(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const undo: (() => void)[] = [];
    const set = (selector: string, make: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      const created = !el;
      if (!el) {
        el = make();
        document.head.appendChild(el);
      }
      const before = el.getAttribute(attr);
      el.setAttribute(attr, value);
      undo.push(() => (created ? el!.remove() : before === null ? el!.removeAttribute(attr) : el!.setAttribute(attr, before)));
    };
    const link = (rel: string) => () => Object.assign(document.createElement("link"), { rel });
    const meta = (name: string) => () => Object.assign(document.createElement("meta"), { name });

    set('link[rel="manifest"]', link("manifest"), "href", "/app/diario.webmanifest");
    set('link[rel="apple-touch-icon"]', link("apple-touch-icon"), "href", "/app/diario-icons/apple-touch-icon.png");
    set('meta[name="theme-color"]', meta("theme-color"), "content", "#f6f4ef");
    set('meta[name="apple-mobile-web-app-title"]', meta("apple-mobile-web-app-title"), "content", "Diário");
    set('meta[name="apple-mobile-web-app-capable"]', meta("apple-mobile-web-app-capable"), "content", "yes");
    set('meta[name="mobile-web-app-capable"]', meta("mobile-web-app-capable"), "content", "yes");

    // Only in a production build: in development the worker would keep stale modules.
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SW_URL, { scope: SCOPE }).then(async (registration) => {
        // Files this page loaded before the worker was in control, so they are kept too.
        const paths = performance.getEntriesByType("resource")
          .map((e) => new URL(e.name, location.href))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/assets/"))
          .map((u) => u.pathname);
        const worker = registration.active ?? (await navigator.serviceWorker.ready).active;
        worker?.postMessage({ type: "keep-assets", paths });
      }).catch(() => undefined);
    }

    // A deploy replaced the build while an old page was open: its lazy files
    // are gone, so load the new page once instead of showing a broken one.
    const onStale = () => {
      try {
        if (sessionStorage.getItem("diary-reloaded")) return;
        sessionStorage.setItem("diary-reloaded", "1");
      } catch {
        return;
      }
      location.reload();
    };
    window.addEventListener("vite:preloadError", onStale);
    undo.push(() => window.removeEventListener("vite:preloadError", onStale));

    return () => undo.reverse().forEach((f) => f());
  }, [enabled]);
}
