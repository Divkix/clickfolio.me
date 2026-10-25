import { createFileRoute } from "@tanstack/react-router";
import { getPublicSiteUrl } from "@/lib/utils/site-url";

/** Protected app surfaces — AI crawler groups do not inherit `*`. */
const DISALLOW_PROTECTED = [
  "/admin/",
  "/dashboard/",
  "/edit/",
  "/preview/",
  "/settings/",
  "/waiting/",
  "/wizard/",
] as const;

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "GoogleOther",
] as const;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const rules = [
          { userAgent: "*", allow: ["/", "/api/og/"] },
          ...AI_CRAWLERS.map((userAgent) => ({
            userAgent,
            allow: ["/", "/explore", "/blog"],
          })),
        ];

        const groups = rules.map(({ userAgent, allow }) =>
          [
            `User-Agent: ${userAgent}`,
            ...allow.map((path) => `Allow: ${path}`),
            ...DISALLOW_PROTECTED.map((path) => `Disallow: ${path}`),
            "",
          ].join("\n"),
        );

        return new Response(`${groups.join("\n")}\nSitemap: ${getPublicSiteUrl()}/sitemap.xml\n`, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
