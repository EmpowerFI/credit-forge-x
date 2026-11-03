// The diary's service worker, registered with scope /app/diario.
//
// It keeps two things and nothing else:
//   * the page itself (index.html, the same for every route), so the diary
//     opens on a weak or absent signal; and
//   * the build's hashed files under /assets/, which never change under a
//     given name.
// It never stores an answer from Supabase -- those are another origin and go
// straight to the network -- so no figure of hers is ever written to the
// phone by this file. Only GET requests from this origin are looked at.
//
// The page is network-first: online, she always gets the latest build. If
// the network has not answered in a few seconds, the kept copy opens instead
// and the network's answer, when it comes, replaces it for next time.
//
// It also shows the daily reminder (Web Push, sent by the diary-push
// function) and opens the diary when she taps it.

const SHELL = "diario-shell-v1";
const ASSETS = "diario-assets-v1";
const PAGE = "/app/diario";
const PAGE_TIMEOUT_MS = 3500;
const MAX_ASSETS = 120;

const inScope = (path) => path === PAGE || path.startsWith(`${PAGE}/`);
const isAsset = (path) => path.startsWith("/assets/") || path.startsWith("/app/diario-icons/");

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const res = await fetch(PAGE, { cache: "no-store" });
      if (res.ok) {
        const html = await res.clone().text();
        await (await caches.open(SHELL)).put(PAGE, res);
        const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await keep(urls);
      }
    } catch {
      // Offline while installing: the next visit fills the caches.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("diario-") && n !== SHELL && n !== ASSETS).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// The page tells us which build files it already loaded before this worker
// was in control, so they are kept too.
self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  const data = event.data;
  if (data?.type === "keep-assets" && Array.isArray(data.paths)) {
    event.waitUntil(keep(data.paths.filter((p) => typeof p === "string" && p.startsWith("/assets/")).slice(0, MAX_ASSETS)));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (inScope(url.pathname)) event.respondWith(page(event));
    return;
  }
  if (isAsset(url.pathname)) event.respondWith(asset(req));
});

async function page(event) {
  const shell = await caches.open(SHELL);
  const network = fetch(event.request).then(async (res) => {
    if (res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) {
      await shell.put(PAGE, res.clone());
    }
    return res;
  });
  event.waitUntil(network.catch(() => undefined));
  const kept = await shell.match(PAGE);
  if (!kept) return network;
  const late = new Promise((resolve) => setTimeout(() => resolve(kept), PAGE_TIMEOUT_MS));
  return Promise.race([network.catch(() => kept), late]);
}

async function asset(req) {
  const cache = await caches.open(ASSETS);
  // ignoreVary: a module script is asked for with an Origin header, the
  // copy was kept without one, and a server that answers "Vary: Origin"
  // would make them miss each other. The file is the same either way.
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    await trim(cache);
  }
  return res;
}

async function keep(paths) {
  const cache = await caches.open(ASSETS);
  await Promise.all(paths.map(async (p) => {
    if (!(await cache.match(p, { ignoreVary: true }))) await cache.add(p).catch(() => undefined);
  }));
  await trim(cache);
}

// Oldest first: every deploy brings new names, and old ones are never asked for again.
async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

// ------------------------------------------------------------------ reminders

const ICON = "/app/diario-icons/icon-192.png";

self.addEventListener("push", (event) => {
  let n = {};
  try {
    n = event.data ? event.data.json() : {};
  } catch {
    // Not ours to read: still show something, because a push that shows
    // nothing teaches the browser to stop delivering them.
  }
  const url = typeof n.url === "string" && inScope(new URL(n.url, self.location.origin).pathname) ? n.url : PAGE;
  event.waitUntil(self.registration.showNotification(n.title || "EmpowerFI", {
    body: n.body || "Registre seu dia no diário.",
    icon: ICON,
    tag: n.tag || "diario-lembrete",
    data: { url },
    lang: "pt-BR",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || PAGE, self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const diary = open.find((c) => inScope(new URL(c.url).pathname));
    if (diary) {
      // The page navigates itself (pwa.ts): WindowClient.navigate is not everywhere.
      diary.postMessage({ type: "open", url });
      return diary.focus();
    }
    return self.clients.openWindow(url);
  })());
});
