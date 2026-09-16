import { createContext, useContext } from "react";
import type { Locale } from "./index";

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue>({ locale: "en", setLocale: () => {} });

/** The app's language and the way to change it. */
export const useLocale = () => useContext(LocaleContext);
