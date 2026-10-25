import { describe, expect, it } from "vite-plus/test";
import { routesForChangedFiles } from "@/lib/seo/lastmod";

const TRACKED = [
  "/",
  "/about",
  "/blog",
  "/blog/cv-website-builder",
  "/llms.txt",
  "/templates/bento",
];

describe("routesForChangedFiles", () => {
  it.each([
    ["app/routes/index.tsx", ["/"]],
    ["app/routes/about.tsx", ["/about"]],
    ["app/routes/about/-parts/hero.tsx", ["/about"]],
    ["app/routes/blog/index.tsx", ["/blog"]],
    ["app/routes/blog/route.tsx", ["/blog"]],
    ["app/routes/blog/cv-website-builder.tsx", ["/blog/cv-website-builder"]],
    ["app/routes/llms[.]txt.ts", ["/llms.txt"]],
    ["app/routes/templates/$theme.tsx", ["/templates/bento"]],
    ["app/routes/__root.tsx", []],
    ["app/routes/_protected.tsx", []],
    ["app/routes/_protected/dashboard.tsx", []],
    ["app/routes/api/health.ts", []],
    ["app/routes/explore.tsx", []],
    ["app/globals.css", []],
  ])("%s → %j", (file, routes) => {
    expect(routesForChangedFiles([file], TRACKED)).toEqual(routes);
  });
});
