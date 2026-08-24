import { describe, expect, it } from "vite-plus/test";
import nextConfig from "@/next.config";

describe("bare-handle redirect configuration", () => {
  it("excludes route names without blocking valid prefixed handles", async () => {
    const [redirect] = await nextConfig.redirects!();
    const source = redirect?.source ?? "";

    expect(source).toContain(
      "(?:api|_next|admin|about|blog|dashboard|edit|explore|faq|settings|themes|waiting|wizard|privacy|terms|preview|sitemap|for|ingest|ws|robots\\.txt|manifest\\.webmanifest|favicon\\.ico)(?![a-z0-9-])",
    );

    const handlePattern = source.match(/^\/:handle\((.*)\)$/s)?.[1];
    expect(handlePattern).toBeDefined();
    const matcher = new RegExp(`^(?:${handlePattern})$`);
    expect(matcher.test("for")).toBe(false);
    expect(matcher.test("forrest")).toBe(true);
    expect(matcher.test("ws")).toBe(false);
    expect(matcher.test("wsj")).toBe(true);
  });
});
