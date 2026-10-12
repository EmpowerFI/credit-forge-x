// Which builds have demo doors.
//
// The showroom's password is public on purpose and its accounts switch
// personas in one click. Both are correct for a project holding simulated
// data and disqualifying for the corporate build, which reads the production
// database -- so the condition is the database the build points at, and these
// cases pin it, because a predicate that quietly returns true everywhere is
// indistinguishable from no predicate at all.
import { describe, expect, it } from "vitest";
import { isDemoDomain, isShowroom } from "./stories";

const SHOWROOM = "https://yuxrujoghizcfdmbkqfg.supabase.co";

describe("the demo doors belong to the showroom", () => {
  it("opens for the showroom project", () => {
    expect(isShowroom(SHOWROOM)).toBe(true);
    expect(isShowroom(`${SHOWROOM}/`)).toBe(true);
  });

  it("stays shut for every other database", () => {
    // Production and dev: where real women's figures are.
    expect(isShowroom("https://efylyaroluqatqmtuuml.supabase.co")).toBe(false);
    expect(isShowroom("https://boivrcjvsnrmzbregavl.supabase.co")).toBe(false);
    expect(isShowroom("http://127.0.0.1:55321")).toBe(false);
  });

  it("stays shut when nobody configured anything", () => {
    // The failure that matters: an unset variable must not read as the
    // showroom, or a half-configured corporate build opens every door.
    expect(isShowroom(undefined)).toBe(false);
    expect(isShowroom(null)).toBe(false);
    expect(isShowroom("")).toBe(false);
  });

  it("is not fooled by a project that merely mentions the showroom", () => {
    // Substring matching is deliberate -- the URL carries the ref -- so the
    // one thing to check is that the ref has to be the project's own.
    expect(isShowroom("https://supabase.co")).toBe(false);
    expect(isShowroom("https://yuxrujoghizcfdmbkqf.supabase.co")).toBe(false); // one character short
  });

  it("recognises a showroom address wherever it is typed", () => {
    // The corporate door refuses these outright, because the persona strings
    // survive into its bundle and the password that opens them is published.
    expect(isDemoDomain("sponsor@demo.empowerfi.io")).toBe(true);
    expect(isDemoDomain("  Sponsor@Demo.EmpowerFI.io  ")).toBe(true);
    expect(isDemoDomain("daniele@empowerfi.io")).toBe(false);
    expect(isDemoDomain("")).toBe(false);
    expect(isDemoDomain(undefined)).toBe(false);
  });
});
