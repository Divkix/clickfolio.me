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
});
