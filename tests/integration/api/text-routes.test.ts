import { describe, expect, it } from "vite-plus/test";
import { Route as robots } from "@/app/routes/robots[.]txt";
import { Route as llms } from "@/app/routes/llms[.]txt";
import { Route as llmsFull } from "@/app/routes/llms-full[.]txt";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/seo/llms";
import { getPublicSiteUrl } from "@/lib/utils/site-url";
import { serverHandler } from "@/tests/helpers/server-route";

describe("crawler text routes", () => {
  it("preserves the robots serializer's directives, spacing and final newline", async () => {
    const protectedPaths = [
      "admin",
      "dashboard",
      "edit",
      "preview",
      "settings",
      "waiting",
      "wizard",
    ];

    const agents = [
      "*",
      "GPTBot",
      "ChatGPT-User",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
      "GoogleOther",
    ];

    const groups = agents.map((agent) => {
      const allows = agent === "*" ? ["/", "/api/og/"] : ["/", "/explore", "/blog"];

      return `User-Agent: ${agent}\n${allows.map((path) => `Allow: ${path}\n`).join("")}${protectedPaths.map((path) => `Disallow: /${path}/\n`).join("")}\n`;
    });

    const response = await serverHandler(
      robots,
      "GET",
    )(new Request("https://clickfolio.me/robots.txt"));

    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(
      `${groups.join("")}Sitemap: ${getPublicSiteUrl()}/sitemap.xml\n`,
    );
  });

  it.each([
    ["/llms.txt", llms, buildLlmsTxt],
    ["/llms-full.txt", llmsFull, buildLlmsFullTxt],
  ] as const)("preserves %s content and cache headers", async (path, route, buildText) => {
    const response = await serverHandler(route, "GET")(new Request(`https://clickfolio.me${path}`));
    expect(await response.text()).toBe(buildText());
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
  });
});
