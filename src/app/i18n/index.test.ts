import { afterEach, describe, expect, it } from "vitest";
import { formatDate, formatNumber, initialLocale, localized, setCurrentLocale, tr } from "./index";

describe("i18n", () => {
  afterEach(() => setCurrentLocale("en"));

  it("starts in the language the site asked for, then the one chosen before, then the browser's", () => {
    expect(initialLocale("?lang=pt", "en", ["en-US"])).toBe("pt");
    expect(initialLocale("?lang=en", "pt", ["pt-BR"])).toBe("en");
    expect(initialLocale("?lang=fr", "pt", ["en-US"])).toBe("pt");
    expect(initialLocale("", null, ["pt-BR", "en"])).toBe("pt");
    expect(initialLocale("", null, ["en-GB"])).toBe("en");
    expect(initialLocale("", "xx", [])).toBe("en");
  });

  it("gives the text and the formats of the current language", () => {
    const text = { en: "Funded", pt: "Financiada" };
    expect(tr(text)).toBe("Funded");
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatDate("2026-09-16T12:00:00Z", { day: "2-digit", month: "short", year: "numeric" })).toBe("16 Sept 2026");

    setCurrentLocale("pt");
    expect(tr(text)).toBe("Financiada");
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatDate("2026-09-16T12:00:00Z", { day: "2-digit", month: "short", year: "numeric" })).toBe("16 de set. de 2026");
  });

  it("keeps labels' shape and reads them in the language of the moment", () => {
    const Icon = () => null;
    type Tone = "positive" | "caution";
    const POOLS: Record<"domestic" | "global", { name: string; tone: Tone; steps: string[]; icon: typeof Icon; count: number }> = localized({
      domestic: { name: { en: "Domestic P2P", pt: "P2P Doméstico" }, tone: "positive", steps: [{ en: "Pix", pt: "Pix" }, { en: "Repaid", pt: "Quitado" }], icon: Icon, count: 2 },
      global: { name: { en: "Global P2P", pt: "P2P Global" }, tone: "caution", steps: [], icon: Icon, count: 0 },
    });
    expect(POOLS.domestic.name).toBe("Domestic P2P");
    expect(POOLS.domestic.steps.map((s) => s)).toEqual(["Pix", "Repaid"]);
    expect(POOLS.domestic.icon).toBe(Icon);
    expect(POOLS.global.count).toBe(0);

    setCurrentLocale("pt");
    expect(POOLS.domestic.name).toBe("P2P Doméstico");
    expect(POOLS.domestic.steps.join(", ")).toBe("Pix, Quitado");
    expect(Object.values(POOLS).map((p) => p.name)).toEqual(["P2P Doméstico", "P2P Global"]);
    expect({ ...POOLS.global }.name).toBe("P2P Global");
  });
});
