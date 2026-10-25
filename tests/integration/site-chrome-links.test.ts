import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { renderWithRouter } from "@/tests/helpers/render-with-router";

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ data: null, isPending: false }),
  SignInButton: ({ children }: { children: ReactNode }) => children,
}));

function internalHrefs(markup: string): string[] {
  return [...markup.matchAll(/href="(\/[^"]*)"/g)].map(([, href]) => href);
}

describe("site chrome links", () => {
  // Pages are served at their slash-free path; `/blog/` also answers 200, so a slash link
  // points crawlers at a duplicate of the canonical URL.
  it.each([
    ["header", SiteHeader],
    ["footer", Footer],
  ])("%s links every page at its canonical path", (_, component) => {
    const hrefs = internalHrefs(renderWithRouter(createElement(component)));

    expect(hrefs).toEqual(expect.arrayContaining(["/templates", "/blog"]));
    expect(hrefs.filter((href) => href !== "/" && href.endsWith("/"))).toEqual([]);
  });
});
