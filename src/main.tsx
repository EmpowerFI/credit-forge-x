import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// A tab left open across a deploy is holding a map to files that are gone. Its
// index.html names hashed chunks by the build that produced them, and the next
// build renames them, so the first `import()` after a deploy — clicking through
// to the platform, which is lazily loaded — asks for a chunk that no longer
// exists. The user sees a blank screen; the console says "MIME type" or "Failed
// to fetch dynamically imported module", neither of which is the problem. (The
// SPA rewrite in vercel.json excludes /assets/ so the request at least 404s
// instead of being answered with index.html.)
//
// Vite announces exactly this as `vite:preloadError`. Reloading fetches the
// current index.html — served `max-age=0, must-revalidate`, so the revalidation
// is real — and the chunk names line up again.
//
// A reload is allowed once per settling window, and never twice inside one:
// enough to recover from a deploy, and from the next deploy too, but not enough
// to turn a genuinely broken build into a refresh cycle that hides its own
// error. Where sessionStorage is unavailable the page's own age stands in for
// it, which is weaker — a tab that has only just loaded fetched its index.html
// along with it, so an error there is more likely a reload that did not help
// than a stale chunk — but it cannot throw and it cannot be cleared.
const SETTLED_MS = 15_000;
const MARK = "empowerfi:chunk-reload";

function mayReload(): boolean {
  const now = Date.now();
  try {
    if (now - Number(sessionStorage.getItem(MARK) ?? 0) < SETTLED_MS) return false;
    sessionStorage.setItem(MARK, String(now));
    return true;
  } catch {
    return performance.now() >= SETTLED_MS;
  }
}

window.addEventListener("vite:preloadError", (event) => {
  if (!mayReload()) return; // Let the real error through.
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
