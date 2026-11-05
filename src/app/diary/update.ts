import { useCallback, useEffect, useRef, useState } from "react";

// A new build of the diary, noticed while it is open.
//
// An installed diary is rarely opened from nothing: the phone brings it back
// from the background, still running the build it started with, and it stays
// there until something reloads it. So the page asks, now and then, which
// build the server would give it -- the hashed script named in the page --
// and compares it with the one it is running.
//
// When they differ, the new page goes straight into the service worker's
// copy (so a reload opens it even on a slow signal), and then:
//   * coming back after a while away (she is starting afresh), it reloads by
//     itself;
//   * otherwise a bar offers "Atualizar", and she chooses the moment.

const PAGE = "/app/diario";
/** The service worker's cache of the page: SHELL in public/app/diario-sw.js. */
const SHELL = "diario-shell-v1";
const CHECK_EVERY_MS = 30 * 60_000;
const MIN_GAP_MS = 60_000;
/** Away at least this long, and a waiting update is applied as she returns. */
const AWAY_LONG_MS = 10 * 60_000;

const BUILD = /<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/;

/** The build this page is running: its own hashed entry script. Null in development. */
function runningBuild(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return el ? new URL(el.src).pathname : null;
}

/** The build the server gives now, kept for the next opening. Null when it cannot tell. */
async function latestBuild(): Promise<string | null> {
  const res = await fetch(PAGE, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
  const html = await res.clone().text();
  const build = html.match(BUILD)?.[1] ?? null;
  if (build && "caches" in window) {
    try {
      await (await caches.open(SHELL)).put(PAGE, res);
    } catch {
      // No cache: the reload goes to the network, as any first visit does.
    }
  }
  return build;
}

export function useDiaryUpdate() {
  const [ready, setReady] = useState(false);
  const lastCheck = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  const check = useCallback(async (): Promise<boolean> => {
    const running = runningBuild();
    if (!running || !navigator.onLine) return false;
    if (Date.now() - lastCheck.current < MIN_GAP_MS) return ready;
    lastCheck.current = Date.now();
    try {
      const latest = await latestBuild();
      const differs = latest !== null && latest !== running;
      if (differs) setReady(true);
      return differs;
    } catch {
      return false;
    }
  }, [ready]);

  useEffect(() => {
    void check();
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      void check().then((differs) => {
        // Back after a long while: she is starting afresh, so start her on the new build.
        if (differs && away >= AWAY_LONG_MS) location.reload();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [check]);

  return { ready, apply: () => location.reload() };
}
