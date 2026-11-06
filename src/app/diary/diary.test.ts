import { describe, expect, it } from "vitest";
import { addDays, breakEven, brl, cachedToday, dayMoney, dayName, diaryErrorText, mondayOf, parseReais, progressIcon, PROGRESS_ICONS, signedBrl, spToday, weekSpan } from "./diary";
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
  it("offers EmpowerFI's five icons, and the first for anything else", () => {
    expect(new Set(PROGRESS_ICONS.map((i) => i.code)).size).toBe(5);
    expect(progressIcon("calendar")).toBe("calendar");
    expect(progressIcon("🌱")).toBe("growth");
    expect(progressIcon(undefined)).toBe("growth");
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

describe("weekSpan", () => {
  it("names a week by its days, across months too", () => {
    setCurrentLocale("pt");
    expect(weekSpan("2026-11-02")).toBe("2 a 8/11");
    expect(weekSpan("2026-12-28")).toBe("28/12 a 3/1");
  });
});

describe("profit and the month's break-even", () => {
  const e = (kind: "sale" | "expense", amount_cents: number, category: string | null = null, voided = false) => ({ kind, amount_cents, category, voided });

  it("takes home apart from the business's expenses", () => {
    const m = dayMoney([e("sale", 50_000), e("expense", 20_000, "stock"), e("expense", 10_000, "withdrawal"), e("sale", 9_999, null, true)]);
    expect(m).toEqual({ sales: 50_000, expenses: 20_000, profit: 30_000, takenHome: 10_000 });
    expect(dayMoney([e("sale", 1_000), e("expense", 3_000, "rent_utilities")]).profit).toBe(-2_000);
  });

  it("says a loss with a real minus sign", () => {
    expect(signedBrl(-30_000)).toBe("−R$ 300,00");
    expect(signedBrl(30_000)).toBe("R$ 300,00");
  });

  it("measures the month against what she needs, per open day left", () => {
    // Wednesday 4 Nov 2026, open Mon–Fri, today not recorded yet: 4..30 Nov has 19 weekdays.
    const be = breakEven({ profit_cents: 120_000, monthly_need_cents: 200_000, today: "2026-11-04" }, [1, 2, 3, 4, 5], false)!;
    expect(be.covered).toBeCloseTo(0.6);
    expect(be.missing).toBe(80_000);
    expect(be.openDaysLeft).toBe(19);
    expect(be.perOpenDay).toBe(Math.ceil(80_000 / 19));
    // Today recorded: from tomorrow.
    expect(breakEven({ profit_cents: 0, monthly_need_cents: 100, today: "2026-11-04" }, [1, 2, 3, 4, 5], true)!.openDaysLeft).toBe(18);
  });

  it("is covered, with what is left over, and never below nothing", () => {
    const over = breakEven({ profit_cents: 250_000, monthly_need_cents: 200_000, today: "2026-11-30" }, [1, 2, 3, 4, 5, 6, 7], true)!;
    expect([over.covered, over.missing, over.surplus, over.perOpenDay]).toEqual([1, 0, 50_000, null]);
    const loss = breakEven({ profit_cents: -20_000, monthly_need_cents: 200_000, today: "2026-11-04" }, [1, 2, 3, 4, 5, 6, 7], false)!;
    expect([loss.covered, loss.missing]).toEqual([0, 220_000]);
    expect(breakEven({ profit_cents: 1, monthly_need_cents: null, today: "2026-11-04" }, [1], false)).toBeNull();
  });
});
