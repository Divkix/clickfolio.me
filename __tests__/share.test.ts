import { describe, expect, it } from "vitest";
import {
  generateLinkedInShareUrl,
  generateShareText,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
} from "@/lib/utils/share";

describe("generateTwitterShareUrl", () => {
  it("generates correct URL with basic text and url", () => {
    const result = generateTwitterShareUrl("Check out my portfolio!", "https://webresume.now/john");
    expect(result).toBe(
      "https://twitter.com/intent/tweet?text=Check+out+my+portfolio%21&url=https%3A%2F%2Fwebresume.now%2Fjohn",
    );
  });

  it("encodes special characters to prevent XSS", () => {
    const result = generateTwitterShareUrl('<script>alert("xss")</script>', "https://example.com");
    // URL-encoded angle brackets and quotes
    expect(result).toContain("%3Cscript%3E");
    expect(result).toContain("%3C%2Fscript%3E");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });

  it("handles unicode characters", () => {
    const result = generateTwitterShareUrl("Hello World!", "https://example.com");
    expect(result).toContain("Hello");
  });

  it("handles empty text", () => {
    const result = generateTwitterShareUrl("", "https://example.com");
    expect(result).toBe("https://twitter.com/intent/tweet?text=&url=https%3A%2F%2Fexample.com");
  });

  it("handles empty url", () => {
    const result = generateTwitterShareUrl("Check this out", "");
    expect(result).toBe("https://twitter.com/intent/tweet?text=Check+this+out&url=");
  });

  it("handles URLs with query parameters", () => {
    const result = generateTwitterShareUrl("Check out", "https://example.com?foo=bar&baz=qux");
    expect(result).toContain("url=https%3A%2F%2Fexample.com%3Ffoo%3Dbar%26baz%3Dqux");
  });

  it("handles text with ampersands", () => {
    const result = generateTwitterShareUrl("Tom & Jerry", "https://example.com");
    expect(result).toContain("text=Tom+%26+Jerry");
    expect(result).not.toContain("&Jerry");
  });
});

describe("generateLinkedInShareUrl", () => {
  it("generates correct URL with basic url", () => {
    const result = generateLinkedInShareUrl("https://webresume.now/john");
    expect(result).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwebresume.now%2Fjohn",
    );
  });

  it("encodes URL-unsafe characters", () => {
    const result = generateLinkedInShareUrl("https://example.com/path?key=value&other=123");
    expect(result).toContain("url=https%3A%2F%2Fexample.com%2Fpath%3Fkey%3Dvalue%26other%3D123");
  });

  it("handles empty url", () => {
    const result = generateLinkedInShareUrl("");
    expect(result).toBe("https://www.linkedin.com/sharing/share-offsite/?url=");
  });
});

describe("generateWhatsAppShareUrl", () => {
  it("generates correct URL with text and url combined", () => {
    const result = generateWhatsAppShareUrl(
      "Check out my portfolio!",
      "https://webresume.now/john",
    );
    expect(result).toContain("https://wa.me/?text=");
    expect(result).toContain("Check+out+my+portfolio%21+https%3A%2F%2Fwebresume.now%2Fjohn");
  });

  it("encodes special characters to prevent XSS", () => {
    const result = generateWhatsAppShareUrl(
      '<img onerror="alert(1)" src=x>',
      "https://example.com",
    );
    expect(result).toContain("%3Cimg");
    expect(result).not.toContain("<img");
  });

  it("handles empty text", () => {
    const result = generateWhatsAppShareUrl("", "https://example.com");
    expect(result).toBe("https://wa.me/?text=+https%3A%2F%2Fexample.com");
  });

  it("handles newlines in text", () => {
    const result = generateWhatsAppShareUrl("Line 1\nLine 2", "https://example.com");
    expect(result).toContain("%0A"); // URL-encoded newline
  });
});

describe("generateShareText", () => {
  it("returns text with name", () => {
    const result = generateShareText("John Doe");
    expect(result).toBe("Check out John Doe's portfolio");
  });

  it("falls back to handle when name is empty", () => {
    const result = generateShareText("", "johndoe");
    expect(result).toBe("Check out johndoe's portfolio");
  });

  it("falls back to 'someone' when both are empty", () => {
    const result = generateShareText("", "");
    expect(result).toBe("Check out someone's portfolio");
  });

  it("falls back to 'someone' when both are undefined", () => {
    const result = generateShareText("");
    expect(result).toBe("Check out someone's portfolio");
  });

  it("prefers name over handle", () => {
    const result = generateShareText("John Doe", "johndoe");
    expect(result).toBe("Check out John Doe's portfolio");
  });

  it("handles names with special characters", () => {
    const result = generateShareText("O'Brien & Associates");
    expect(result).toBe("Check out O'Brien & Associates's portfolio");
  });
});
