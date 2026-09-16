import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { initialLocale, setCurrentLocale, STORAGE_KEY, type Locale } from "./index";
import { LocaleContext } from "./useLocale";

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (locale: Locale) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private windows may refuse storage; the choice then lasts the visit.
  }
};

/** Holds the app's language. PlatformApp keys the pages on it, so a switch re-renders every text. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(() => {
    const first = initialLocale(window.location.search, readStored(), navigator.languages ?? [navigator.language]);
    // Before the first render, so no text paints in the wrong language.
    setCurrentLocale(first);
    if (new URLSearchParams(window.location.search).has("lang")) store(first);
    return first;
  });

  const setLocale = useCallback((next: Locale) => {
    setCurrentLocale(next);
    store(next);
    setState(next);
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const before = html.lang;
    html.lang = locale === "pt" ? "pt-BR" : "en";
    return () => {
      html.lang = before;
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
