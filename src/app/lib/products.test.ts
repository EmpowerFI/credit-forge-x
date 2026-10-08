// The matching rules, read back as sentences.
//
// Each case is a business a person can picture, and the expectation is the
// sentence the screen would say about her. The point of testing a rules engine
// is that the rules stay sayable: if a case here stops reading like something
// you could tell an entrepreneur, the rule behind it has drifted.
import { describe, expect, it } from "vitest";
import { matchProducts, PRODUCTS, type MatchInput } from "./products";

const of = (p: ReturnType<typeof matchProducts>, id: string) => p.find((m) => m.product.id === id)!;

/** Six months reported in a row, numbers that hold together, credit-ready. */
const prepared: MatchInput = {
  status: "CREDIT_READY",
  components: { preparation: 23, regularity: 25, data_quality: 25, business: 24 },
  missing: [],
  has_request: false,
};

/** Two months in, nothing wrong, simply not enough yet. */
const starting: MatchInput = {
  status: "NEEDS_MORE_DATA",
  components: { preparation: 12, regularity: 8, data_quality: 17, business: 10 },
  missing: ["INSUFFICIENT_HISTORY", "CORE_EDUCATION_INCOMPLETE"],
  has_request: false,
};

describe("matchProducts", () => {
  it("offers every product in the catalogue, every time", () => {
    for (const input of [prepared, starting]) {
      expect(matchProducts(input)).toHaveLength(PRODUCTS.length);
    }
  });

  it("puts a featured partner first, then sorts the rest by what fits", () => {
    const all = matchProducts(prepared);
    const pinned = all.filter((m) => m.featured);
    // Everything pinned is at the front, and says so on the match rather than
    // leaving the screen to guess why it is there.
    expect(all.slice(0, pinned.length).every((m) => m.featured)).toBe(true);
    expect(pinned.every((m) => m.product.featured)).toBe(true);

    const fits = all.slice(pinned.length).map((m) => m.fit);
    expect(fits).toEqual([...fits].sort((a, b) =>
      ["ready", "potential", "explore"].indexOf(a) - ["ready", "potential", "explore"].indexOf(b)));
  });

  it("pins the position and not the verdict", () => {
    // The pin is placement. If it could lift a fit too, the page would be
    // telling her a featured product suits her better than it does — so the
    // featured card is first and still says "explore" to a business it does
    // not suit, and still says "ready" only to one it does.
    const toABaker = of(matchProducts(prepared), "rental-guarantee");
    expect(toABaker.featured).toBe(true);
    expect(toABaker.fit).toBe("explore");
    expect(toABaker.because).toBe("RUNS_THROUGH_AGENCIES");

    const toAnAgency = of(matchProducts({ ...prepared, sector: "imobili\u00e1ria" }), "rental-guarantee");
    expect(toAnAgency.featured).toBe(true);
    expect(toAnAgency.fit).toBe("ready");
  });

  it("leaves everything it did not pin exactly where the rules put it", () => {
    // Removing the pin must change the order and nothing else, so the three
    // unpinned products carry the same verdicts they did before any of this.
    const unpinned = matchProducts(prepared).filter((m) => !m.featured);
    expect(unpinned.map((m) => [m.product.id, m.fit, m.because])).toEqual([
      ["productive-microloan", "ready", "READY_NOT_ASKED"],
      ["business-payments", "ready", "STEADY_AND_ORGANISED"],
      ["cross-border-payments", "explore", "SALES_ARE_LOCAL"],
    ]);
  });

  it("a credit-ready business is ready for a productive loan", () => {
    expect(of(matchProducts(prepared), "productive-microloan")).toMatchObject({
      fit: "ready", because: "READY_NOT_ASKED",
    });
  });

  it("and says so differently once she has asked", () => {
    expect(of(matchProducts({ ...prepared, has_request: true }), "productive-microloan").because)
      .toBe("READY_AND_ASKED");
  });

  it("a business still gathering months is not refused, it is told what is open", () => {
    const m = of(matchProducts(starting), "productive-microloan");
    expect(m.fit).toBe("potential");
    expect(m.gap).toBe("REQUIREMENTS_OPEN");
    expect(m.open_requirements).toBe(2);
  });

  it("with nothing open, the gap is simply another month", () => {
    const m = of(matchProducts({ ...starting, missing: [] }), "productive-microloan");
    expect(m.gap).toBe("ONE_MORE_MONTH");
    expect(m.open_requirements).toBeUndefined();
  });

  it("payments opens on regular months that hold together, not on being credit-ready", () => {
    // Not credit-ready, but reporting every month with clean numbers.
    const regular = { ...starting, components: { ...starting.components, regularity: 20, data_quality: 22 } };
    expect(of(matchProducts(regular), "business-payments").fit).toBe("ready");
  });

  it("and stays potential when the months are irregular, however good the rest is", () => {
    const patchy = { ...prepared, components: { ...prepared.components, regularity: 10 } };
    const m = of(matchProducts(patchy), "business-payments");
    expect(m.fit).toBe("potential");
    expect(m.gap).toBe("A_FEW_MORE_MONTHS");
  });

  it("and stays potential when the numbers do not hold together", () => {
    const noisy = { ...prepared, components: { ...prepared.components, data_quality: 9 } };
    expect(of(matchProducts(noisy), "business-payments").fit).toBe("potential");
  });

  it("never pushes a local business across a border, however prepared she is", () => {
    const m = of(matchProducts(prepared), "cross-border-payments");
    expect(m.fit).toBe("explore");
    expect(m.because).toBe("SALES_ARE_LOCAL");
    expect(m.gap).toBeUndefined();
  });

  it("promises nothing: no product carries a rate, a fee or an approval", () => {
    const text = JSON.stringify(PRODUCTS).toLowerCase();
    // Whole words, and "guarantee" is no longer among them: it used to stand
    // for "we guarantee you will get this", and it is now the name of a
    // product. "Guaranteed" is the promise; a guarantee is a thing you buy.
    for (const word of ["rates?", "apr", "approved", "approval", "guaranteed", "garantido"]) {
      expect(text, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    expect(text).not.toContain("%");
  });

  it("is connected to nothing, whether the provider exists or not", () => {
    // `none` is a real company with nothing built to it; `mock` is an invented
    // one, which cannot have an integration because it cannot have anything.
    expect(PRODUCTS.every((p) => p.integration === "none" || p.integration === "mock")).toBe(true);
  });

  it("names a real company only with an authorisation and a source for what it says about it", () => {
    for (const p of PRODUCTS.filter((x) => x.real)) {
      expect(p.real!.authorised, p.id).toMatch(/permission/i);
      expect(p.real!.source, p.id).toMatch(/^https:\/\//);
      expect(p.real!.logo, p.id).toBeTruthy();
      // A real company is not sold as a partner it is not.
      expect(p.integration, p.id).toBe("none");
    }
  });

  it("invents no mark for an invented provider, and claims no permission it has none of", () => {
    for (const p of PRODUCTS.filter((x) => !x.real)) {
      expect(p.integration, p.id).toBe("mock");
    }
  });

  describe("the rental guarantee, which her readiness cannot answer", () => {
    it("fits a business that lets property, which is who it is sold to", () => {
      const m = of(matchProducts({ ...prepared, sector: "imobili\u00e1ria" }), "rental-guarantee");
      expect(m.fit).toBe("ready");
      expect(m.because).toBe("LETTINGS_IS_THE_CUSTOMER");
    });

    it("reads the sector however the leader typed it, in either language", () => {
      for (const sector of ["Imobili\u00e1ria", "imoveis e locacao", "Real Estate", "lettings agency", "aluguel"]) {
        expect(of(matchProducts({ ...prepared, sector }), "rental-guarantee").fit, sector).toBe("ready");
      }
    });

    it("stays something to look at for every other business, however prepared she is", () => {
      for (const sector of ["food", "beauty", "retail", undefined, null, ""]) {
        const m = of(matchProducts({ ...prepared, sector }), "rental-guarantee");
        expect(m.fit, String(sector)).toBe("explore");
        expect(m.because).toBe("RUNS_THROUGH_AGENCIES");
      }
    });

    it("reads no component at all, so her months cannot move it either way", () => {
      const bare = { ...starting, sector: "padaria" };
      const strong = { ...prepared, sector: "padaria" };
      expect(of(matchProducts(bare), "rental-guarantee")).toEqual(of(matchProducts(strong), "rental-guarantee"));
      // And it never carries a gap: there is nothing she could do to close one.
      expect(of(matchProducts(bare), "rental-guarantee").gap).toBeUndefined();
    });
  });
});
