import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { buildLlmsFullTxt } from "@/lib/seo/llms";
import { STATIC_PAGES } from "@/lib/seo/static-pages";
import { THEME_IDS, THEME_METADATA } from "@/lib/templates/theme-ids";

const root = process.cwd();

function readPublicFile(fileName: string): string {
  const filePath = join(root, "public", fileName);
  expect(existsSync(filePath), `${fileName} should be published from public/`).toBe(true);

  return readFileSync(filePath, "utf8");
}

describe("production SEO and AI discovery assets", () => {
  it("keeps llms.txt aligned with search-console demand and public landing pages", () => {
    const llms = readPublicFile("llms.txt");

    for (const text of [
      "# clickfolio.me",
      "PDF resume to website",
      "resume website builder",
      "resume website converter",
      "LinkedIn to portfolio",
      "DesignFolio resume",
      "https://clickfolio.me/blog/pdf-resume-to-website",
      "https://clickfolio.me/blog/best-resume-website-builders",
      "https://clickfolio.me/for/software-engineer",
      "https://clickfolio.me/for/designer",
      "https://clickfolio.me/explore",
    ]) {
      expect(llms).toContain(text);
    }
  });

  it("generates llms-full.txt with every blog post, profession, static page, and template", () => {
    const full = buildLlmsFullTxt();

    for (const post of BLOG_POSTS) {
      expect(full).toContain(`https://clickfolio.me/blog/${post.slug}`);
      expect(full).toContain(post.title);
    }

    for (const profession of PROFESSIONS) {
      expect(full).toContain(`https://clickfolio.me/for/${profession.slug}`);
    }

    for (const page of STATIC_PAGES) {
      expect(full).toContain(
        `${page.label}: https://clickfolio.me${page.path === "/" ? "" : page.path}`,
      );
    }

    for (const id of THEME_IDS) {
      expect(full).toContain(`**${THEME_METADATA[id].name}**`);
    }

    expect(full).toContain(`## All ${THEME_IDS.length} Templates`);
    expect(full).not.toMatch(/Cloudflare Queues|Email Service/);
  });

  it("serves llms-full.txt from a route handler, not a shadowing static file", async () => {
    expect(existsSync(join(root, "public", "llms-full.txt"))).toBe(false);

    const { GET } = await import("@/app/llms-full.txt/route");
    const response = GET();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
    expect(await response.text()).toBe(buildLlmsFullTxt());
  });

  it("uses an existing public logo asset in homepage Organization JSON-LD", () => {
    const jsonLdSource = readFileSync(join(root, "lib", "seo", "json-ld.ts"), "utf8");
    const logoMatch = jsonLdSource.match(/logo:\s*`\$\{siteConfig\.url\}\/([^`]+)`/);
    const logoPath = logoMatch?.[1] ?? "";

    expect(logoPath).not.toBe("");
    expect(existsSync(join(root, "public", logoPath))).toBe(true);
  });
});
