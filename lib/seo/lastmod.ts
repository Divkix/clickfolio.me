import { PROFESSIONS } from "@/lib/config/professions";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import lastmod from "@/lib/seo/lastmod.json";
import { THEME_IDS, themeSlug } from "@/lib/templates/theme-ids";

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

const ALL_TEMPLATE_ROUTES = THEME_IDS.map((id) => `/templates/${themeSlug(id)}`);

const ALL_EXAMPLE_ROUTES = EXAMPLE_GALLERIES.map((gallery) => `/examples/${gallery.slug}`);

/**
 * Source files outside a route's own file that change what the route renders.
 * Shared chrome (header, footer, ui/) is deliberately absent: it touches every page equally and
 * says nothing about the page's content.
 */
const CONTENT_SOURCES: ReadonlyArray<{ prefix: string; routes: readonly string[] }> = [
  { prefix: "app/routes/templates/$theme.tsx", routes: ALL_TEMPLATE_ROUTES },
  { prefix: "app/routes/examples/$slug.tsx", routes: ALL_EXAMPLE_ROUTES },
  { prefix: "lib/data/example-page.ts", routes: ALL_EXAMPLE_ROUTES },
  { prefix: "lib/examples/galleries.ts", routes: ALL_EXAMPLE_ROUTES },
  {
    prefix: "lib/templates/theme-ids.ts",
    routes: ["/templates", ...ALL_TEMPLATE_ROUTES, ...ALL_EXAMPLE_ROUTES],
  },
  { prefix: "components/home/", routes: ["/"] },
  { prefix: "lib/config/faq.ts", routes: ["/", "/faq"] },
  { prefix: "components/legal/", routes: ["/privacy", "/terms"] },
  { prefix: "components/role/", routes: ALL_PROFESSION_ROUTES },
  { prefix: "lib/config/professions.ts", routes: ["/", ...ALL_PROFESSION_ROUTES] },
];

const ROUTES_DIR = "app/routes/";

/**
 * Tracked route owning a route file: `app/routes/about.tsx` → `/about`, `blog/index.tsx` and the
 * `blog/route.tsx` layout → `/blog`, `llms[.]txt.ts` → `/llms.txt`, and a file nested below a
 * tracked route (`about/-parts/x.tsx`) → `/about`. `(group)` and `_pathless` folders add no
 * segment; `__root.tsx` and pathless layout files wrap many pages and map to none.
 */
function appFileRoute(file: string, tracked: ReadonlySet<string>): string | null {
  if (!file.startsWith(ROUTES_DIR)) return null;

  const parts = file
    .slice(ROUTES_DIR.length)
    .replace(/\.tsx?$/, "")
    .split("/");

  const name = parts.pop() ?? "";

  if (name.startsWith("_")) return null;

  if (name !== "index" && name !== "route") parts.push(name);

  const segments = parts
    .filter((segment) => !segment.startsWith("_") && !/^\(.*\)$/.test(segment))
    .map((segment) => segment.replaceAll("[.]", "."));

  if (segments.length === 0) return tracked.has("/") ? "/" : null;

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
