// The app in English and Brazilian Portuguese. Every sentence is written in
// both, side by side where it is used: tr({ en: "…", pt: "…" }). The language
// lives here, in one place, so labels kept in lib/ modules and formatters read
// it without a hook; LocaleProvider re-renders the pages when it changes.

export type Locale = "en" | "pt";

/** A text, or any value, in both languages. */
export interface L<T = string> {
  en: T;
  pt: T;
}

export const LOCALES: Locale[] = ["en", "pt"];
export const STORAGE_KEY = "empowerfi.app.locale";

let current: Locale = "en";

export const getLocale = () => current;
export const setCurrentLocale = (locale: Locale) => {
  current = locale;
};

/** The text in the current language. Resolve it where it renders, never in a module-level constant. */
export const tr = <T>(text: L<T>): T => text[current];

// React elements are plain objects too; they are kept whole.
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype && !("$$typeof" in value);

const isText = (value: unknown): value is L<unknown> => {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 2 && "en" in value && "pt" in value;
};

/** A structure whose { en, pt } leaves read in the current language. */
export type Localized<T> =
  T extends L<infer U> ? U
  : T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer E)[] ? Localized<E>[]
  : T extends object ? { -readonly [K in keyof T]: Localized<T[K]> }
  : T;

/**
 * Labels kept in a module-level constant, written in both languages, that read
 * in the current one wherever they are used: POOL.domestic.name is a string,
 * and a switch of language changes it. Only plain objects and arrays are
 * walked; icons, components and functions are kept as they are.
 */
export function localized<const T>(value: T): Localized<T> {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    value.forEach((item, i) => {
      if (isText(item)) Object.defineProperty(out, i, { get: () => item[current], enumerable: true, configurable: true });
      else out[i] = localized(item);
    });
    return out as Localized<T>;
  }
  if (!isPlainObject(value)) return value as Localized<T>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isText(item)) Object.defineProperty(out, key, { get: () => item[current], enumerable: true, configurable: true });
    else out[key] = localized(item);
  }
  return out as Localized<T>;
}

export const isLocale = (value: unknown): value is Locale => value === "en" || value === "pt";

/**
 * Where the app starts: the language the site asked for (?lang=pt from the
 * Portuguese pages), then the one the person chose before, then the browser's.
 */
export function initialLocale(search: string, stored: string | null, browser: readonly string[]): Locale {
  const asked = new URLSearchParams(search).get("lang");
  if (isLocale(asked)) return asked;
  if (isLocale(stored)) return stored;
  return browser.some((l) => l.toLowerCase().startsWith("pt")) ? "pt" : "en";
}

// ------------------------------------------------------------------ format

/** Numbers: 1,234.5 in English, 1.234,5 in Portuguese. */
export const numberLocale = () => (current === "pt" ? "pt-BR" : "en-US");
/** Dates: 16 Sep 2026 in English, 16 de set. de 2026 in Portuguese. */
export const dateLocale = () => (current === "pt" ? "pt-BR" : "en-GB");

export const formatNumber = (value: number | bigint, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(numberLocale(), options).format(value);

export const formatDate = (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleDateString(dateLocale(), options);

export const formatDateTime = (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleString(dateLocale(), options);

export const formatTime = (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleTimeString(dateLocale(), options);
