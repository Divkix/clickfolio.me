import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ExploreFilters } from "@/components/explore/explore-filters";
import { ExploreHeader } from "@/components/explore/explore-header";
import { ExplorePagination } from "@/components/explore/explore-pagination";
import { NoResults } from "@/components/explore/no-results";
import { PersonCard } from "@/components/explore/person-card";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { explorePageData } from "@/lib/data/explore-page";
import { exploreSearchSchema } from "@/lib/data/explore-search";
import { ROLE_OPTIONS } from "@/lib/config/roles";
import { generateExploreJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { NOINDEX_FOLLOW, publicPageHead } from "@/lib/seo/page-metadata";

const exploreTitle = `Browse Professional Portfolios | ${siteConfig.fullName}`;

const exploreDescription =
  "Discover professionals in our community. Browse portfolios and connect with talented individuals.";

/** Matches the router's canonical form: defaults stripped, `page` before `role`. */
function exploreUrl(page: number, role: string): string {
  const url = new URL("/explore", siteConfig.url);

  if (page > 1) url.searchParams.set("page", String(page));

  if (role) url.searchParams.set("role", role);

  return url.toString();
}

const getExplore = createServerFn({ method: "GET" })
  .validator(exploreSearchSchema)
  .handler(({ data }) => explorePageData(data));

export const Route = createFileRoute("/explore")({
  validateSearch: exploreSearchSchema,
  search: { middlewares: [stripSearchParams(exploreSearchSchema.parse({}))] },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getExplore({ data: deps }),
  head: ({ match }) => {
    const { page, role: roleFilter } = match.search;
    const pageSuffix = page > 1 ? ` – Page ${page}` : "";

    const head = publicPageHead({
      title: `Browse Professional Portfolios${pageSuffix}`,
      ogTitle: pageSuffix ? `Browse Professional Portfolios${pageSuffix}` : exploreTitle,
      description: pageSuffix ? `${exploreDescription} Page ${page}.` : exploreDescription,
      path: "/explore",
      robots: roleFilter ? NOINDEX_FOLLOW : undefined,
    });

    head.links = [{ rel: "canonical", href: exploreUrl(page, roleFilter) }];

    return head;
  },
  component: ExplorePage,
});

function ExplorePage() {
  const { currentPage, roleFilter, directoryUsers, totalCount, totalPages } = Route.useLoaderData();

  const exploreJsonLd = generateExploreJsonLd(
    directoryUsers.map((u) => ({
      handle: u.handle,
      name: u.previewName || "Unknown",
      headline: u.previewHeadline,
    })),
  );

  const roleOptions = [
    { value: "", label: "All Roles" },
    ...ROLE_OPTIONS,
    { value: "freelance", label: "Freelance / Contract" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(exploreJsonLd) }}
      />
      {currentPage > 1 && <link rel="prev" href={exploreUrl(currentPage - 1, roleFilter)} />}
      {currentPage < totalPages && (
        <link rel="next" href={exploreUrl(currentPage + 1, roleFilter)} />
      )}
      <SiteHeader />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Explore Professionals", href: "/explore" },
        ]}
      />
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <ExploreHeader />

        <ExploreFilters roleFilter={roleFilter} roleOptions={roleOptions} totalCount={totalCount} />

        {/* Cards are h3; this keeps the outline h1 → h2 → h3. */}
        <h2 className="sr-only">Professionals</h2>

        {directoryUsers.length === 0 ? (
          <NoResults roleFilter={roleFilter} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {directoryUsers.map((person) => (
              <PersonCard key={person.handle} person={person} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <ExplorePagination
            currentPage={currentPage}
            totalPages={totalPages}
            roleFilter={roleFilter}
          />
        )}

        <div className="mt-16 text-center bg-brand-subtle rounded-xl border border-border p-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">Join Our Directory</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Want to be featured here? Enable &ldquo;Show in Directory&rdquo; in your privacy
            settings to get discovered by recruiters and collaborators.
          </p>
          <Button asChild size="lg">
            <Link to="/settings">Update Privacy Settings</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
