import { describe, expect, it } from "vitest";
import {
  captureReferralHandle,
  clearStoredReferralHandle,
  getStoredReferralHandle,
} from "@/lib/referral";

const REFERRAL_KEY = "referral_handle";

describe("referral client-side utilities", () => {
  describe("captureReferralHandle", () => {
    it("stores handle in localStorage", () => {
      captureReferralHandle("johndoe");
      expect(localStorage.getItem(REFERRAL_KEY)).toBe("johndoe");
    });

    it("converts handle to lowercase", () => {
      captureReferralHandle("JohnDoe");
      expect(localStorage.getItem(REFERRAL_KEY)).toBe("johndoe");
    });

    it("trims whitespace from handle", () => {
      captureReferralHandle("  johndoe  ");
      expect(localStorage.getItem(REFERRAL_KEY)).toBe("johndoe");
    });

    it("does not overwrite existing handle (first ref wins)", () => {
      captureReferralHandle("firstref");
      captureReferralHandle("secondref");
      expect(localStorage.getItem(REFERRAL_KEY)).toBe("firstref");
    });

    it("ignores empty string handle", () => {
      captureReferralHandle("");
      expect(localStorage.getItem(REFERRAL_KEY)).toBeNull();
    });

    it("ignores whitespace-only handle", () => {
      captureReferralHandle("   ");
      expect(localStorage.getItem(REFERRAL_KEY)).toBeNull();
    });
  });

  describe("getStoredReferralHandle", () => {
    it("returns stored handle", () => {
      localStorage.setItem(REFERRAL_KEY, "johndoe");
      expect(getStoredReferralHandle()).toBe("johndoe");
    });

    it("returns null when no handle is stored", () => {
      expect(getStoredReferralHandle()).toBeNull();
    });
  });

  describe("clearStoredReferralHandle", () => {
    it("removes handle from localStorage", () => {
      localStorage.setItem(REFERRAL_KEY, "johndoe");
      clearStoredReferralHandle();
      expect(localStorage.getItem(REFERRAL_KEY)).toBeNull();
    });

    it("does not throw when no handle exists", () => {
      expect(() => clearStoredReferralHandle()).not.toThrow();
    });
  });
});
