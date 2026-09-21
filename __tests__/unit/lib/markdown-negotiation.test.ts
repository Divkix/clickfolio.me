import { describe, expect, it } from "vite-plus/test";
import {
  appendLinkEntry,
  appendVary,
  htmlToMarkdown,
  isHtmlResponse,
  markdownResponse,
  markdownSourcePath,
  pageLinkHeader,
  prefersMarkdown,
} from "@/lib/worker/markdown-negotiation";

const BROWSER_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

describe("prefersMarkdown", () => {
  it("keeps HTML for browsers, wildcards, and clients that rank HTML higher", () => {
    expect(prefersMarkdown(BROWSER_ACCEPT)).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0.5, text/html")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
  });

  it("serves Markdown when it is the explicit top-ranked representation", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0.9, text/html;q=0.5")).toBe(true);
    expect(prefersMarkdown("text/x-markdown")).toBe(true);
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings, lists, tables, and links", () => {
    const markdown = htmlToMarkdown(`
      <html><body><main>
        <h1>Resume website builder</h1>
        <p>Upload a <a href="/blog/pdf-resume-to-website">PDF resume</a> and publish.</p>
        <ul><li>Ten free templates</li><li>Custom @handle</li></ul>
        <table>
          <tr><th>Plan</th><th>Price</th></tr>
          <tr><td>Free</td><td>$0</td></tr>
        </table>
      </main></body></html>
    `);

    expect(markdown).toContain("# Resume website builder");
    expect(markdown).toContain("[PDF resume](/blog/pdf-resume-to-website)");
    expect(markdown).toContain("- Ten free templates");
    expect(markdown).toContain("- Custom @handle");
    expect(markdown).toContain("| Plan | Price |");
    expect(markdown).toContain("| --- | --- |");
    expect(markdown).toContain("| Free | $0 |");
  });

  it("drops script contents and only converts the main content", () => {
    const markdown = htmlToMarkdown(
      `<html><body><nav>Skip me</nav><main><h2>Pricing</h2><script>window.tracker="x"</script></main></body></html>`,
    );

    expect(markdown).toContain("## Pricing");
    expect(markdown).not.toContain("window.tracker");
    expect(markdown).not.toContain("Skip me");
  });
});

describe("markdownResponse", () => {
  it("recasts an HTML response as Markdown and preserves the status", () => {
    const response = markdownResponse({
      response: new Response("<html><body><h1>Home</h1></body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", vary: "Accept-Encoding" },
      }),
      html: "<html><body><h1>Home</h1></body></html>",
      url: "https://clickfolio.me/",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
  });

  it("appends a sitemap link to the body of a missing page", async () => {
    const html = "<html><body><h1>404 — page not found</h1></body></html>";

    const response = markdownResponse({
      response: new Response(html, { status: 404, headers: { "content-type": "text/html" } }),
      html,
      url: "https://clickfolio.me/no-such-page",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    await expect(response.text()).resolves.toContain("https://clickfolio.me/sitemap.xml");
  });

  it("opens with the document title when the page starts with something else", async () => {
    const html =
      "<html><head><title>Clickfolio — your portfolio, one link</title></head><body><main><p>Free forever</p><h1>Build your page</h1></main></body></html>";

    const response = markdownResponse({
      response: new Response(html, { headers: { "content-type": "text/html" } }),
      html,
      url: "https://clickfolio.me/",
    });

    const body = await response.text();

    expect(body.startsWith("# Clickfolio — your portfolio, one link")).toBe(true);
    expect(body).toContain("Free forever");
  });
});

describe("markdownSourcePath", () => {
  it("maps a .md URL onto the page it names", () => {
    expect(markdownSourcePath("/index.md")).toBe("/");
    expect(markdownSourcePath("/@ada.md")).toBe("/@ada");
    expect(markdownSourcePath("/@ada")).toBeNull();
    expect(markdownSourcePath("/llms.txt")).toBeNull();
  });
});

describe("isHtmlResponse / appendVary", () => {
  it("detects the HTML content type", () => {
    expect(
      isHtmlResponse(new Response("", { headers: { "content-type": "text/html; charset=utf-8" } })),
    ).toBe(true);
    expect(
      isHtmlResponse(new Response("", { headers: { "content-type": "application/json" } })),
    ).toBe(false);
  });

  it("adds Accept to Vary once, keeping existing values", () => {
    const headers = new Headers({ vary: "accept-encoding" });

    appendVary(headers, "Accept");
    appendVary(headers, "Accept");

    expect(headers.get("vary")).toBe("accept-encoding, Accept");

    const empty = new Headers();
    appendVary(empty, "Accept");
    expect(empty.get("vary")).toBe("Accept");
  });
});

describe("pageLinkHeader / appendLinkEntry", () => {
  it("advertises the sitemap and the page markdown twin", () => {
    expect(pageLinkHeader("/")).toBe(
      '</sitemap.xml>; rel="sitemap", </index.md>; rel="alternate"; type="text/markdown"',
    );
    expect(pageLinkHeader("/@ada")).toContain('</@ada.md>; rel="alternate"');
    expect(pageLinkHeader("/pricing.md")).toBe('</sitemap.xml>; rel="sitemap"');
  });

  it("keeps the links the page already advertises", () => {
    const headers = new Headers({ link: '</previews/glass.webp>; rel="preload"' });

    appendLinkEntry(headers, pageLinkHeader("/"));

    expect(headers.get("link")).toBe(
      '</previews/glass.webp>; rel="preload", </sitemap.xml>; rel="sitemap", </index.md>; rel="alternate"; type="text/markdown"',
    );
  });
});
