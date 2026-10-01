import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { PROFESSIONS } from "@/lib/config/professions";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { RATE_LIMITS } from "@/lib/rate-limit/user";
import { buildLlmsFullTxt, buildLlmsTxt, LLMS_TXT_FEATURED_POSTS } from "@/lib/seo/llms";
import { STATIC_PAGES } from "@/lib/seo/static-pages";
import { THEME_IDS, THEME_METADATA, themeSlug } from "@/lib/templates/theme-ids";
import { MAX_FILE_SIZE_MB } from "@/lib/utils/validation";

const root = process.cwd();

describe("production SEO and AI discovery assets", () => {
  it("generates llms.txt aligned with search-console demand and public landing pages", () => {
    const llms = buildLlmsTxt();

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

  it("links only llms.txt featured posts that still exist in BLOG_POSTS", () => {
    const slugs = new Set(BLOG_POSTS.map((post) => post.slug));
    const llms = buildLlmsTxt();

    for (const { slug } of LLMS_TXT_FEATURED_POSTS) {
      expect(slugs.has(slug), `featured slug ${slug} is not in BLOG_POSTS`).toBe(true);
      expect(llms).toContain(`https://clickfolio.me/blog/${slug})`);
    }
  });

  it("interpolates llms.txt facts from the code that owns them", () => {
    const llms = buildLlmsTxt();

    expect(llms).toContain(`**${THEME_IDS.length} Templates**`);
    expect(llms).toContain(`all ${THEME_IDS.length} templates are free`);
    expect(llms).toContain(
      `PDFs up to ${MAX_FILE_SIZE_MB} MB, ${RATE_LIMITS.resume_upload.limit} uploads per ${RATE_LIMITS.resume_upload.windowHours} hours`,
    );

    for (const profession of PROFESSIONS) {
      expect(llms).toContain(`https://clickfolio.me/for/${profession.slug}`);
    }

    for (const id of THEME_IDS) {
      expect(llms).toContain(
        `[${THEME_METADATA[id].name}](https://clickfolio.me/templates/${themeSlug(id)})`,
      );
    }

    for (const gallery of EXAMPLE_GALLERIES) {
      expect(llms).toContain(`[${gallery.title}](https://clickfolio.me/examples/${gallery.slug})`);
    }

    for (const page of STATIC_PAGES) {
      expect(llms).toContain(`(https://clickfolio.me${page.path === "/" ? "" : page.path})`);
    }
  });

  it("serves llms.txt from a route handler, not a shadowing static file", async () => {
    expect(existsSync(join(root, "public", "llms.txt"))).toBe(false);

    const { GET } = await import("@/app/llms.txt/route");
    const response = GET();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(buildLlmsTxt());
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
      expect(full).toContain(
        `${THEME_METADATA[id].name}: https://clickfolio.me/templates/${themeSlug(id)}`,
      );
    }

    for (const gallery of EXAMPLE_GALLERIES) {
      expect(full).toContain(`${gallery.title}: https://clickfolio.me/examples/${gallery.slug}`);
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

  it("keeps the hand-written pricing.md facts in sync with their constants", () => {
    // No /pricing page exists (it would redirect to /@pricing), so the static file is the only
    // pricing representation and cannot be replaced by an auto-generated .md twin.
    const pricing = readFileSync(join(root, "public", "pricing.md"), "utf8");

    expect(pricing).toContain(`(up to ${MAX_FILE_SIZE_MB} MB)`);
    expect(pricing).toContain(`All ${THEME_IDS.length} templates`);
    expect(pricing).toContain(
      `up to ${RATE_LIMITS.handle_change.limit} handle changes per ${RATE_LIMITS.handle_change.windowHours} hours`,
    );
    expect(pricing).toContain(
      `${RATE_LIMITS.resume_upload.limit} resume uploads per ${RATE_LIMITS.resume_upload.windowHours} hours`,
    );
    expect(existsSync(join(root, "app", "pricing"))).toBe(false);
  });

  it("uses an existing public logo asset in homepage Organization JSON-LD", () => {
    const jsonLdSource = readFileSync(join(root, "lib", "seo", "json-ld.ts"), "utf8");
    const logoMatch = jsonLdSource.match(/logo:\s*`\$\{siteConfig\.url\}\/([^`]+)`/);
    const logoPath = logoMatch?.[1] ?? "";

    expect(logoPath).not.toBe("");
    expect(existsSync(join(root, "public", logoPath))).toBe(true);
  });
});
