// The sponsor's dressing, read back as the claim it makes.
//
// One entry in SPONSORS names a real organisation as a hypothesis, so these
// cases are about the disclaimer rather than about the copy: that it exists,
// that it says the two things it has to say, and that the dressing is still
// found for the exact name the seed scripts write — because a name that drifts
// by one character leaves the dashboard showing a real foundation with no
// correction beside it, which is the one failure mode that matters here.
import { describe, expect, it } from "vitest";
import { SPONSORS, sponsorshipFor } from "./sponsorship";

const SPONSOR = "Solana Foundation";

describe("sponsorship dressing", () => {
  it("dresses the sponsor the seed scripts write, exactly as they write it", () => {
    // scripts/platform/seed-demo-accounts.mts and rename-demo-sponsor.mts both
    // write this string. Undressed, the dashboard prints the name alone.
    expect(sponsorshipFor(SPONSOR)).not.toBeNull();
  });

  it("finds it however the database spaced or cased it", () => {
    expect(sponsorshipFor("  solana foundation ")?.sponsor).toBe(SPONSOR);
    expect(sponsorshipFor("SOLANA FOUNDATION")?.sponsor).toBe(SPONSOR);
  });

  it("knows nothing about an unknown sponsor, and says so by returning nothing", () => {
    // The renderers fall back to the plain name, which is correct for a sponsor
    // this build has no opinion about.
    expect(sponsorshipFor("NOVA")).toBeNull();
    expect(sponsorshipFor(null)).toBeNull();
    expect(sponsorshipFor("")).toBeNull();
  });

  it("carries both labels for the real organisation, short and long", () => {
    const s = sponsorshipFor(SPONSOR)!;
    expect(s.hypothetical).toBeTruthy();
    expect(s.disclosure).toBeTruthy();
  });

  it("says the two things the disclaimer exists to say: not a sponsor, no relationship", () => {
    const d = sponsorshipFor(SPONSOR)!.disclosure!.toLowerCase();
    expect(d).toMatch(/does not sponsor|n[ãa]o patrocina/);
    expect(d).toMatch(/no relationship|n[ãa]o tem rela[çc][ãa]o/);
    // It names the organisation, so a cropped screenshot carries the name and
    // the correction together or neither.
    expect(d).toContain("solana foundation");
  });

  it("attributes no reason to an organisation that gave none", () => {
    const s = sponsorshipFor(SPONSOR)!;
    expect(s.because.toLowerCase()).toMatch(/example|exemplo/);
    expect(s.because.toLowerCase()).toMatch(/not a statement|n[ãa]o [ée] uma declara[çc][ãa]o/);
    expect(s.enables.toLowerCase()).toMatch(/in this example|neste exemplo/);
  });

  it("offers her nothing: no sponsor's dressing carries a product, a rate or a link", () => {
    const text = JSON.stringify(SPONSORS).toLowerCase();
    // Whole words: "the journey is offered" is the sponsor's absence of an
    // offer, not an offer, and a substring match cannot tell them apart.
    for (const word of ["http", "apply", "rates?", "offers?", "discounts?", "oferta", "desconto", "taxa"]) {
      expect(text, word).not.toMatch(new RegExp(`\b${word}\b`));
    }
  });
});
