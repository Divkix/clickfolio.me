import { describe, expect, it } from "vite-plus/test";
import { assignLandingVariant, decideLandingVariant } from "@/lib/experiments/landing";

describe("assignLandingVariant", () => {
  it("splits the roll at CLAIM_HANDLE_SHARE", () => {
    expect(assignLandingVariant(0)).toBe("claim_handle");
    expect(assignLandingVariant(0.49)).toBe("claim_handle");
    expect(assignLandingVariant(0.5)).toBe("drop_first");
    expect(assignLandingVariant(0.99)).toBe("drop_first");
  });
});

describe("decideLandingVariant", () => {
  it("assigns and stamps a visitor without a cookie", () => {
    expect(decideLandingVariant({ override: null, cookie: undefined, roll: 0.1 })).toEqual({
      variant: "claim_handle",
      stamp: true,
    });
  });

  it("keeps an existing valid cookie regardless of the roll", () => {
    expect(decideLandingVariant({ override: null, cookie: "drop_first", roll: 0.1 })).toEqual({
      variant: "drop_first",
      stamp: false,
    });
  });

  it("reassigns an unknown cookie value (e.g. a retired variant)", () => {
    expect(decideLandingVariant({ override: null, cookie: "bold_claim", roll: 0.9 })).toEqual({
      variant: "drop_first",
      stamp: true,
    });
  });

  it("lets a valid override win and only stamps when it changes the cookie", () => {
    expect(
      decideLandingVariant({ override: "claim_handle", cookie: "drop_first", roll: 0.9 }),
    ).toEqual({ variant: "claim_handle", stamp: true });
    expect(
      decideLandingVariant({ override: "claim_handle", cookie: "claim_handle", roll: 0.9 }),
    ).toEqual({ variant: "claim_handle", stamp: false });
  });

  it("ignores an invalid override", () => {
    expect(decideLandingVariant({ override: "nope", cookie: "drop_first", roll: 0.1 })).toEqual({
      variant: "drop_first",
      stamp: false,
    });
  });
});
