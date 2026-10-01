import { describe, expect, it } from "vitest";
import { one } from "./embed";

describe("one", () => {
  it("reads a to-one embed, which PostgREST sends as a bare object", () => {
    // The shape that caused the bug: typed as an array, indexing gave undefined.
    const loans = { status: "ACTIVE", term_months: 9 };
    expect(one(loans)).toEqual(loans);
  });

  it("reads a to-many embed, which it sends as an array", () => {
    expect(one([{ no: 1 }, { no: 2 }])).toEqual({ no: 1 });
  });

  it("is null when there is nothing embedded, in either shape", () => {
    expect(one([])).toBeNull();
    expect(one(null)).toBeNull();
    expect(one(undefined)).toBeNull();
  });

  it("does not mistake a falsy row for an absent one", () => {
    expect(one(0)).toBe(0);
    expect(one([0])).toBe(0);
    expect(one("")).toBe("");
  });
});
