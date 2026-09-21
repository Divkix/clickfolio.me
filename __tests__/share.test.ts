import { describe, expect, it } from "vite-plus/test";
import {
  generateLinkedInShareUrl,
  generateShareText,
  generateTwitterShareUrl,
  generateWhatsAppShareUrl,
} from "@/lib/utils/share";

describe("generateTwitterShareUrl", () => {
  it("generates a tweet-intent URL carrying the text and url params", () => {
    const result = generateTwitterShareUrl("Check out my portfolio!", "https://clickfolio.me/john");
    expect(result).toContain("https://twitter.com/intent/tweet?");
    expect(result).toContain("text=Check+out+my+portfolio");
    expect(result).toContain("url=https%3A%2F%2Fclickfolio.me%2Fjohn");
  });

  it("encodes special characters to prevent XSS", () => {
    const result = generateTwitterShareUrl('<script>alert("xss")</script>', "https://example.com");
    expect(result).toContain("%3Cscript%3E");
    expect(result).toContain("%3C%2Fscript%3E");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });
});

describe("generateLinkedInShareUrl", () => {
  it("generates a share-offsite URL carrying the url param", () => {
    const result = generateLinkedInShareUrl("https://clickfolio.me/john");
    expect(result).toContain("https://www.linkedin.com/sharing/share-offsite/?url=");
    expect(result).toContain("url=https%3A%2F%2Fclickfolio.me%2Fjohn");
  });
});

describe("generateWhatsAppShareUrl", () => {
  it("generates a wa.me URL with text and url combined", () => {
    const result = generateWhatsAppShareUrl(
      "Check out my portfolio!",
      "https://clickfolio.me/john",
    );

    expect(result).toContain("https://wa.me/?text=");
    expect(result).toContain("Check+out+my+portfolio%21+https%3A%2F%2Fclickfolio.me%2Fjohn");
  });

  it("encodes special characters to prevent XSS", () => {
    const result = generateWhatsAppShareUrl(
      '<img onerror="alert(1)" src=x>',
      "https://example.com",
    );

    expect(result).toContain("%3Cimg");
    expect(result).not.toContain("<img");
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
});
