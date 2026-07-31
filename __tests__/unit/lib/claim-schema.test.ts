import { describe, expect, it } from "vite-plus/test";
import { claimRequestSchema } from "@/lib/schemas/resume";

describe("claimRequestSchema pre_auth", () => {
  it("accepts pre_auth: true", () => {
    const parsed = claimRequestSchema.safeParse({
      key: "temp/abc/resume.pdf",
      pre_auth: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pre_auth).toBe(true);
    }
  });

  it("defaults pre_auth to false when omitted", () => {
    const parsed = claimRequestSchema.safeParse({ key: "temp/abc/resume.pdf" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pre_auth).toBe(false);
    }
  });

  it("rejects a non-boolean pre_auth", () => {
    const parsed = claimRequestSchema.safeParse({
      key: "temp/abc/resume.pdf",
      pre_auth: "yes",
    });
    expect(parsed.success).toBe(false);
  });
});
