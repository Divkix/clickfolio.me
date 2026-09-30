import { PROFESSIONS } from "@/lib/config/professions";
import lastmod from "@/lib/seo/lastmod.json";

/**
 * Committed lastmod dates (YYYY-MM-DD) for static sitemap routes. `scripts/bump-lastmod.ts`
 * rewrites lastmod.json from the pre-commit hook, so builds never read git history
 * (Workers Builds clones shallowly).
 */
const STATIC_LASTMOD: Readonly<Record<string, string>> = lastmod;

export function getStaticLastmod(route: string): Date | undefined {
  const value = STATIC_LASTMOD[route];

  return value ? new Date(value) : undefined;
}

const ALL_PROFESSION_ROUTES = PROFESSIONS.map((profession) => `/for/${profession.slug}`);

/**
 * Source files outside a route's own `app/<route>/` folder that change what the route renders.
 * Shared chrome (header, footer, ui/) is deliberately absent: it touches every page equally and
 * says nothing about the page's content.
 */
const CONTENT_SOURCES: ReadonlyArray<{ prefix: string; routes: readonly string[] }> = [
  { prefix: "components/home/", routes: ["/"] },
  { prefix: "lib/config/faq.ts", routes: ["/", "/faq"] },
  { prefix: "components/legal/", routes: ["/privacy", "/terms"] },
  { prefix: "components/role/", routes: ALL_PROFESSION_ROUTES },
  { prefix: "lib/config/professions.ts", routes: ["/", ...ALL_PROFESSION_ROUTES] },
];

/**
 * Tracked route owning an `app/` file: `app/(group)/about/page.tsx` → `/about`, and a file nested
 * below a tracked route (`app/about/_parts/x.tsx`) → `/about`. Only `app/page.tsx` maps to `/`;
 * other root files (layout, error, globals.css) belong to every page.
 */
function appFileRoute(file: string, tracked: ReadonlySet<string>): string | null {
  if (!file.startsWith("app/")) return null;

  if (file === "app/page.tsx") return tracked.has("/") ? "/" : null;

  const segments = file
    .split("/")
    .slice(1, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment));

  if (segments[0] === "api") return null;

  for (let length = segments.length; length > 0; length -= 1) {
    const route = `/${segments.slice(0, length).join("/")}`;

    if (tracked.has(route)) return route;
  }

  return null;
}

/** Tracked routes whose rendered content a change to any of `files` may have altered. */
export function routesForChangedFiles(
  files: readonly string[],
  trackedRoutes: readonly string[] = Object.keys(STATIC_LASTMOD),
): string[] {
  const tracked = new Set(trackedRoutes);
  const routes = new Set<string>();

  for (const file of files) {
    const appRoute = appFileRoute(file, tracked);

    if (appRoute) routes.add(appRoute);

    for (const source of CONTENT_SOURCES) {
      if (!file.startsWith(source.prefix)) continue;

      for (const route of source.routes) {
        if (tracked.has(route)) routes.add(route);
      }
    }
  }

  return [...routes].sort();
}
