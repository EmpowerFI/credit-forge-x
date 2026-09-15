import { describe, expect, it } from "vitest";
import { contains } from "./report";

describe("finding a commitment in bytes read from Solana", () => {
  const hay = new Uint8Array([9, 1, 2, 3, 4, 5, 6]);
  it("finds it anywhere, including at either end", () => {
    expect(contains(hay, new Uint8Array([3, 4, 5]))).toBe(true);
    expect(contains(hay, new Uint8Array([9, 1]))).toBe(true);
    expect(contains(hay, new Uint8Array([5, 6]))).toBe(true);
  });
  it("and never a partial or longer match", () => {
    expect(contains(hay, new Uint8Array([3, 5]))).toBe(false);
    expect(contains(hay, new Uint8Array([6, 7]))).toBe(false);
    expect(contains(new Uint8Array([1]), new Uint8Array([1, 1]))).toBe(false);
    expect(contains(hay, new Uint8Array([]))).toBe(false);
  });
});
