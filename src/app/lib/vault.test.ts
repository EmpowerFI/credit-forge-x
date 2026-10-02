import { describe, expect, it } from "vitest";
import { vaultOk, vaultStanding } from "./vault";

describe("vaultStanding", () => {
  it("is exact when the vault holds what the book accounts for", () => {
    expect(vaultStanding(145_000_000, 145_000_000)).toBe("exact");
  });

  it("is a surplus when the vault holds more, not a failure", () => {
    // The case that was reported with a red cross: 215.00 held, 145.00 booked.
    expect(vaultStanding(215_000_000, 145_000_000)).toBe("surplus");
    expect(vaultOk("surplus")).toBe(true);
  });

  it("is short when the vault holds less, which is the direction worth a look", () => {
    expect(vaultStanding(140_000_000, 145_000_000)).toBe("short");
    // Not a cross: a remainder waiting in the batch queue puts the book ahead
    // by design, so this is a caution until the carry can be read.
    expect(vaultOk("short")).toBeNull();
  });

  it("is unknown when the chain was not read or the vault has no account", () => {
    expect(vaultStanding(null, 145_000_000)).toBe("unknown");
    expect(vaultStanding(undefined, 145_000_000)).toBe("unknown");
    expect(vaultOk("unknown")).toBeNull();
  });

  it("reads a bigint balance, which is how the chain returns one", () => {
    expect(vaultStanding(215_000_000n, 145_000_000)).toBe("surplus");
    expect(vaultStanding(145_000_000n, 145_000_000)).toBe("exact");
  });

  it("does not call a zero vault short of a zero book", () => {
    expect(vaultStanding(0, 0)).toBe("exact");
    expect(vaultOk("exact")).toBe(true);
  });
});
