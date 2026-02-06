import { describe, expect, it } from "vitest";
import {
  containsXssPattern,
  noXssPattern,
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
  sanitizeUrl,
} from "@/lib/utils/sanitization";

// ── containsXssPattern ───────────────────────────────────────────────

describe("containsXssPattern", () => {
  it("returns false for plain text", () => {
    expect(containsXssPattern("Hello, World!")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsXssPattern("")).toBe(false);
  });

  it("detects <script> tags", () => {
    expect(containsXssPattern('<script>alert("xss")</script>')).toBe(true);
  });

  it("detects <iframe> tags", () => {
    expect(containsXssPattern("<iframe src=evil.com>")).toBe(true);
  });

  it("detects <embed> tags", () => {
    expect(containsXssPattern('<embed type="application/x-shockwave-flash">')).toBe(true);
  });

  it("detects <object> tags", () => {
    expect(containsXssPattern("<object data=evil.swf>")).toBe(true);
  });

  it("detects event handlers (onerror=, onclick=)", () => {
    expect(containsXssPattern('<img onerror="alert(1)" src=x>')).toBe(true);
    expect(containsXssPattern('<div onclick="steal()">')).toBe(true);
  });

  it("detects javascript: protocol", () => {
    expect(containsXssPattern("javascript:alert(1)")).toBe(true);
  });

  it("detects vbscript: protocol", () => {
    expect(containsXssPattern("vbscript:MsgBox")).toBe(true);
  });

  it("detects data:text/html payloads", () => {
    expect(containsXssPattern("data:text/html,<script>alert(1)</script>")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsXssPattern("<SCRIPT>alert(1)</SCRIPT>")).toBe(true);
    expect(containsXssPattern("JAVASCRIPT:void(0)")).toBe(true);
  });

  it("detects <meta> tags", () => {
    expect(containsXssPattern('<meta http-equiv="refresh">')).toBe(true);
  });

  it("detects <form> tags", () => {
    expect(containsXssPattern('<form action="evil.com">')).toBe(true);
  });

  it("allows safe strings containing colons (time, URLs in text)", () => {
    expect(containsXssPattern("Meeting at 3:00 PM")).toBe(false);
    expect(containsXssPattern("Visit https://example.com")).toBe(false);
  });
});

// ── noXssPattern (Zod refinement helper) ─────────────────────────────

describe("noXssPattern", () => {
  it("returns true for safe strings", () => {
    expect(noXssPattern("Regular text")).toBe(true);
  });

  it("returns false for XSS strings", () => {
    expect(noXssPattern("<script>alert(1)</script>")).toBe(false);
  });
});

// ── sanitizeText ─────────────────────────────────────────────────────

describe("sanitizeText", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("encodes ampersands", () => {
    expect(sanitizeText("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("encodes angle brackets", () => {
    expect(sanitizeText("<b>bold</b>")).toBe("&lt;b&gt;bold&lt;&#x2F;b&gt;");
  });

  it("encodes quotes", () => {
    expect(sanitizeText('He said "hello"')).toBe("He said &quot;hello&quot;");
    expect(sanitizeText("It's fine")).toBe("It&#x27;s fine");
  });

  it("encodes forward slashes", () => {
    expect(sanitizeText("path/to/file")).toBe("path&#x2F;to&#x2F;file");
  });

  it("leaves safe text unchanged", () => {
    expect(sanitizeText("Hello World 123")).toBe("Hello World 123");
  });
});

// ── sanitizeUrl ──────────────────────────────────────────────────────

describe("sanitizeUrl", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeUrl("")).toBe("");
  });

  it("allows https URLs as-is", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http URLs as-is", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto URLs as-is", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("prepends https:// when no protocol present", () => {
    expect(sanitizeUrl("example.com")).toBe("https://example.com");
  });

  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("blocks data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<script>")).toBe("");
  });

  it("blocks vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:MsgBox")).toBe("");
  });

  it("blocks file: protocol", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBe("");
  });

  it("blocks about: protocol", () => {
    expect(sanitizeUrl("about:blank")).toBe("");
  });

  it("trims whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("is case-insensitive for protocol blocking", () => {
    expect(sanitizeUrl("JAVASCRIPT:alert(1)")).toBe("");
    expect(sanitizeUrl("JaVaScRiPt:void(0)")).toBe("");
  });
});

// ── sanitizeEmail ────────────────────────────────────────────────────

describe("sanitizeEmail", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeEmail("")).toBe("");
  });

  it("lowercases and trims valid email", () => {
    expect(sanitizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("accepts email without TLD (AI-parsed)", () => {
    expect(sanitizeEmail("user@university")).toBe("user@university");
  });

  it("returns empty string for invalid format (no @)", () => {
    expect(sanitizeEmail("not-an-email")).toBe("");
  });

  it("returns empty string for email with spaces", () => {
    expect(sanitizeEmail("user @domain.com")).toBe("");
  });

  it("strips dangerous characters from valid email", () => {
    expect(sanitizeEmail("user'\"<>@example.com")).toBe("user@example.com");
  });
});

// ── sanitizePhone ────────────────────────────────────────────────────

describe("sanitizePhone", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizePhone("")).toBe("");
  });

  it("keeps digits, spaces, hyphens, parentheses, plus", () => {
    expect(sanitizePhone("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
  });

  it("strips letters and special characters", () => {
    expect(sanitizePhone("Call: 555-1234!@#")).toBe("555-1234");
  });

  it("trims result", () => {
    expect(sanitizePhone("  555-1234  ")).toBe("555-1234");
  });
});
