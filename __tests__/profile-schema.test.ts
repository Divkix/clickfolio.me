import { describe, expect, it } from "vitest";
import { handleSchema, handleUpdateSchema, privacySettingsSchema } from "@/lib/schemas/profile";

// ── handleSchema ─────────────────────────────────────────────────────

describe("handleSchema", () => {
  it("accepts a valid lowercase handle", () => {
    const result = handleSchema.safeParse("john-doe");
    expect(result.success).toBe(true);
  });

  it("accepts numeric handles", () => {
    const result = handleSchema.safeParse("user123");
    expect(result.success).toBe(true);
  });

  it("rejects handles shorter than 3 characters", () => {
    const result = handleSchema.safeParse("ab");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least 3");
    }
  });

  it("rejects handles longer than 30 characters", () => {
    const result = handleSchema.safeParse("a".repeat(31));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("30");
    }
  });

  it("rejects uppercase characters", () => {
    const result = handleSchema.safeParse("JohnDoe");
    expect(result.success).toBe(false);
  });

  it("rejects special characters", () => {
    const result = handleSchema.safeParse("john_doe");
    expect(result.success).toBe(false);
  });

  it("rejects handle starting with hyphen", () => {
    const result = handleSchema.safeParse("-john");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((e) => e.message.includes("start with"))).toBe(true);
    }
  });

  it("rejects handle ending with hyphen", () => {
    const result = handleSchema.safeParse("john-");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((e) => e.message.includes("end with"))).toBe(true);
    }
  });

  it("rejects consecutive hyphens", () => {
    const result = handleSchema.safeParse("john--doe");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((e) => e.message.includes("consecutive"))).toBe(true);
    }
  });

  it("rejects XSS in handle", () => {
    const result = handleSchema.safeParse('<script>alert("x")</script>');
    expect(result.success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = handleSchema.safeParse("  john  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("john");
    }
  });
});

// ── handleUpdateSchema ───────────────────────────────────────────────

describe("handleUpdateSchema", () => {
  it("accepts a valid handle update", () => {
    const result = handleUpdateSchema.safeParse({ handle: "new-handle" });
    expect(result.success).toBe(true);
  });

  it("rejects missing handle field", () => {
    const result = handleUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── privacySettingsSchema ────────────────────────────────────────────

describe("privacySettingsSchema", () => {
  it("accepts all boolean fields", () => {
    const result = privacySettingsSchema.safeParse({
      show_phone: true,
      show_address: false,
      hide_from_search: false,
      show_in_directory: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean show_phone", () => {
    const result = privacySettingsSchema.safeParse({
      show_phone: "yes",
      show_address: false,
      hide_from_search: false,
      show_in_directory: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = privacySettingsSchema.safeParse({
      show_phone: true,
    });
    expect(result.success).toBe(false);
  });
});
