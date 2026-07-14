import { useEffect } from "react";
import { SITE_URL } from "@/config/company";

interface SeoProps {
  title: string;
  description: string;
  /** Route path, e.g. "/about". Used for the canonical and og:url. */
  path: string;
  lang: "pt-BR" | "en";
  /** Same document in other languages, for hreflang. */
  alternates?: { hreflang: string; path: string }[];
  /** JSON-LD objects to publish for this route, if any. */
  jsonLd?: Record<string, unknown>[];
}

/**
 * Per-route document head for this Vite SPA.
 *
 * There is a single static index.html for every route, so the title, meta and
 * canonical have to be written at runtime. index.html ships the home page's own
 * meta and the Organization markup — which is what a crawler that does not run
 * JavaScript reads — so this component has to *restore* whatever it overwrote
 * on unmount, not just delete its own tags. Otherwise a client-side navigation
 * back to the home page would leave it wearing /about's canonical.
 */
const Seo = ({ title, description, path, lang, alternates, jsonLd }: SeoProps) => {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const previousTitle = document.title;
    const previousLang = document.documentElement.lang;
    document.title = title;
    document.documentElement.lang = lang;

    // Elements we created outright — removed on cleanup.
    const created: Element[] = [];
    // Elements that already existed — attribute restored on cleanup.
    const patched: { el: Element; attr: string; previous: string | null }[] = [];

    const upsert = (selector: string, create: () => Element, attr: string, value: string) => {
      const existing = document.head.querySelector(selector);
      if (existing) {
        patched.push({ el: existing, attr, previous: existing.getAttribute(attr) });
        existing.setAttribute(attr, value);
        return;
      }
      const el = create();
      el.setAttribute(attr, value);
      document.head.appendChild(el);
      created.push(el);
    };

    const meta = (attr: "name" | "property", key: string, value: string) =>
      upsert(
        `meta[${attr}="${key}"]`,
        () => {
          const el = document.createElement("meta");
          el.setAttribute(attr, key);
          return el;
        },
        "content",
        value,
      );

    const image = `${SITE_URL}${lang === "pt-BR" ? "/og-image.png" : "/og-image-en.png"}`;

    meta("name", "description", description);
    meta("property", "og:title", title);
    meta("property", "og:description", description);
    meta("property", "og:url", url);
    meta("property", "og:type", "website");
    meta("property", "og:locale", lang === "pt-BR" ? "pt_BR" : "en_US");
    meta("property", "og:image", image);
    meta("property", "og:image:alt", title);
    meta("name", "twitter:card", "summary_large_image");
    meta("name", "twitter:title", title);
    meta("name", "twitter:description", description);
    meta("name", "twitter:image", image);

    upsert(
      'link[rel="canonical"]',
      () => {
        const el = document.createElement("link");
        el.setAttribute("rel", "canonical");
        return el;
      },
      "href",
      url,
    );

    // hreflang links are route-specific, so drop the static ones for the
    // lifetime of this route and restore them on the way out.
    const staticAlternates = Array.from(
      document.head.querySelectorAll('link[rel="alternate"][hreflang]'),
    );
    const alternateParent = staticAlternates[0]?.parentNode ?? null;
    const alternateAnchors = staticAlternates.map((el) => el.nextSibling);
    staticAlternates.forEach((el) => el.remove());

    const alternateLinks = (alternates ?? []).map(({ hreflang, path: altPath }) => {
      const el = document.createElement("link");
      el.setAttribute("rel", "alternate");
      el.setAttribute("hreflang", hreflang);
      el.setAttribute("href", `${SITE_URL}${altPath}`);
      document.head.appendChild(el);
      return el;
    });

    const scripts = (jsonLd ?? []).map((data) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo", "route");
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
      return script;
    });

    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLang;
      scripts.forEach((s) => s.remove());
      alternateLinks.forEach((l) => l.remove());
      staticAlternates.forEach((el, i) => {
        alternateParent?.insertBefore(el, alternateAnchors[i]);
      });
      created.forEach((el) => el.remove());
      patched.forEach(({ el, attr, previous }) => {
        if (previous === null) el.removeAttribute(attr);
        else el.setAttribute(attr, previous);
      });
    };
  }, [title, description, path, lang, alternates, jsonLd]);

  return null;
};

export default Seo;
