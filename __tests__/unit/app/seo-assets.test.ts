import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "@/lib/blog/posts";

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

  it("keeps llms-full.txt complete for blog and profession landing pages", () => {
    const full = readPublicFile("llms-full.txt");

    for (const post of BLOG_POSTS) {
      expect(full).toContain(`https://clickfolio.me/blog/${post.slug}`);
      expect(full).toContain(post.title);
    }

    for (const path of [
      "/for/software-engineer",
      "/for/designer",
      "/for/marketer",
      "/for/student",
      "/for/consultant",
      "/for/product-manager",
    ]) {
      expect(full).toContain(`https://clickfolio.me${path}`);
    }
  });

  it("uses an existing public logo asset in homepage Organization JSON-LD", () => {
    const jsonLdSource = readFileSync(join(root, "lib", "utils", "json-ld.ts"), "utf8");
    const logoMatch = jsonLdSource.match(/logo:\s*`\$\{siteConfig\.url\}\/([^`]+)`/);
    const logoPath = logoMatch?.[1] ?? "";

    expect(logoPath).not.toBe("");
    expect(existsSync(join(root, "public", logoPath))).toBe(true);
  });
});
