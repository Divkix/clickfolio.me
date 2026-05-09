import { beforeEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";

describe("robots metadata", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("points sitemap to rewritten /sitemap.xml endpoint", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");

    const config = robots();

    expect(config.sitemap).toBe("https://example.com/sitemap.xml");
  });

  it("explicitly allows AI answer and preview crawlers on public pages", () => {
    const config = robots();

    expect(config.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "GPTBot", allow: ["/", "/explore", "/blog"] }),
        expect.objectContaining({ userAgent: "ChatGPT-User", allow: ["/", "/explore", "/blog"] }),
        expect.objectContaining({ userAgent: "ClaudeBot", allow: ["/", "/explore", "/blog"] }),
        expect.objectContaining({ userAgent: "PerplexityBot", allow: ["/", "/explore", "/blog"] }),
        expect.objectContaining({
          userAgent: "Google-Extended",
          allow: ["/", "/explore", "/blog"],
        }),
        expect.objectContaining({ userAgent: "GoogleOther", allow: ["/", "/explore", "/blog"] }),
      ]),
    );
  });
});
