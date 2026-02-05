import { describe, expect, it } from "vitest";
import {
  captureReferralCode,
  clearStoredReferralCode,
  getStoredReferralCode,
} from "@/lib/referral";

const REFERRAL_CODE_KEY = "referral_code";

describe("referral client-side utilities", () => {
  describe("captureReferralCode", () => {
    it("stores code in localStorage", () => {
      captureReferralCode("ABC12345");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("ABC12345");
    });

    it("converts code to uppercase", () => {
      captureReferralCode("abc12345");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("ABC12345");
    });

    it("trims whitespace from code", () => {
      captureReferralCode("  ABC12345  ");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("ABC12345");
    });

    it("does not overwrite existing code (first ref wins)", () => {
      captureReferralCode("FIRSTREF");
      captureReferralCode("SECNDREF");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBe("FIRSTREF");
    });

    it("ignores empty string code", () => {
      captureReferralCode("");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull();
    });

    it("ignores whitespace-only code", () => {
      captureReferralCode("   ");
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull();
    });
  });

  describe("getStoredReferralCode", () => {
    it("returns stored code", () => {
      localStorage.setItem(REFERRAL_CODE_KEY, "ABC12345");
      expect(getStoredReferralCode()).toBe("ABC12345");
    });

    it("returns null when no code is stored", () => {
      expect(getStoredReferralCode()).toBeNull();
    });
  });

  describe("clearStoredReferralCode", () => {
    it("removes code from localStorage", () => {
      localStorage.setItem(REFERRAL_CODE_KEY, "ABC12345");
      clearStoredReferralCode();
      expect(localStorage.getItem(REFERRAL_CODE_KEY)).toBeNull();
    });

    it("does not throw when no code exists", () => {
      expect(() => clearStoredReferralCode()).not.toThrow();
    });
  });
});
