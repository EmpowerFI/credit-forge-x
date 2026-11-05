import { describe, expect, it } from "vitest";
import { addDays, brl, cachedToday, dayName, diaryErrorText, mondayOf, parseReais, PROGRESS_EMOJIS, spToday } from "./diary";
import { setCurrentLocale } from "../i18n";

describe("parseReais", () => {
  it("reads what she types the Brazilian way", () => {
    expect(parseReais("250")).toBe(25_000);
    expect(parseReais("250,5")).toBe(25_050);
    expect(parseReais("250,50")).toBe(25_050);
    expect(parseReais("1.250,00")).toBe(125_000);
    expect(parseReais("R$ 1.250")).toBe(125_000);
    expect(parseReais("12.500")).toBe(1_250_000);
    expect(parseReais("1250.75")).toBe(125_075);
    expect(parseReais(" 80 ")).toBe(8_000);
  });

  it("refuses what is not an amount", () => {
    for (const bad of ["", "abc", "0", "0,00", "1,2,3", "1.25.0", "12,345", "-5", "1.2345"]) {
      expect(parseReais(bad), bad).toBeNull();
    }
  });
});

describe("days and money", () => {
  it("writes reais with the comma", () => {
    expect(brl(125_050)).toBe("R$ 1.250,50");
  });

  it("names today and yesterday", () => {
    setCurrentLocale("pt");
    expect(dayName("2026-11-02", "2026-11-02")).toBe("hoje");
    expect(dayName("2026-11-01", "2026-11-02")).toBe("ontem");
    expect(dayName("2026-10-30", "2026-11-02")).toBe("30/10");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("diaryErrorText", () => {
  it("turns the database's refusals into her words", () => {
    setCurrentLocale("pt");
    expect(diaryErrorText(new Error("a day is written on the day or the day after, not on 2026-10-01")))
      .toBe("Só dá para registrar hoje ou ontem.");
    expect(diaryErrorText(new Error("month_closed"))).toBe("Esse mês já foi fechado.");
    expect(diaryErrorText(new Error("anything else"))).toBe("Algo deu errado. Tente de novo daqui a pouco.");
  });

  it("says so when there is no signal, rather than that something went wrong", () => {
    setCurrentLocale("pt");
    expect(diaryErrorText(new Error("TypeError: Failed to fetch"))).toMatch(/^Sem internet agora/);
    expect(diaryErrorText(new Error("Load failed"))).toMatch(/^Sem internet agora/);
  });
});

describe("her week", () => {
  it("starts on Monday", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // a Wednesday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // a Sunday
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // across the year
  });
  it("offers twelve distinct emojis", () => {
    expect(new Set(PROGRESS_EMOJIS).size).toBe(12);
  });
});

describe("today, where she is", () => {
  it("is São Paulo's date, not UTC's, late in the evening", () => {
    // 22:30 in São Paulo on 4 Nov is already 5 Nov in UTC.
    expect(spToday(new Date("2026-11-05T01:30:00Z"))).toBe("2026-11-04");
    expect(spToday(new Date("2026-11-05T03:30:00Z"))).toBe("2026-11-05");
  });

  it("takes the server's date from whichever cached profile has it", () => {
    const queries = [[["diary", "profile", "open-campaigns"], []], [["diary", "profile", "u1"], { today: "2026-11-04" }]] as const;
    expect(cachedToday(queries)).toBe("2026-11-04");
    expect(cachedToday([[["x"], undefined]])).toBe(spToday());
  });
});
