import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PersonCard } from "@/components/explore/person-card";
import { Footer } from "@/components/Footer";
import { RoleSection } from "@/components/role/RoleSection";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { edgeCacheHeaders, EXAMPLES_CACHE_TAG } from "@/lib/cache/edge-cache";
import { examplePageData } from "@/lib/data/example-page";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import { NOINDEX_FOLLOW, publicPageHead } from "@/lib/seo/page-metadata";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { THEME_METADATA, themeSlug, TEMPLATE_COUNT } from "@/lib/templates/theme-ids";

const getGallery = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => examplePageData(data));

export const Route = createFileRoute("/examples/$slug")({
  loader: ({ params }) => getGallery({ data: params.slug }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const { gallery, indexable } = loaderData;

    return publicPageHead({
      title: gallery.title,
      description: gallery.description,
      path: `/examples/${gallery.slug}`,
      robots: indexable ? undefined : NOINDEX_FOLLOW,
    });
  },
  headers: () => edgeCacheHeaders(3600, [EXAMPLES_CACHE_TAG]),
  component: ExampleGalleryPage,
});

function ExampleGalleryPage() {
  const { gallery, profiles, copy } = Route.useLoaderData();
  const path = `/examples/${gallery.slug}`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: gallery.title,
    numberOfItems: profiles.length,
    itemListElement: profiles.map((profile, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteConfig.url}/@${profile.handle}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            generateWebPageJsonLd(gallery.title, path, gallery.description),
            generatePageBreadcrumbJsonLd(gallery.title, path),
            itemList,
          ]),
        }}
      />
      <SiteHeader />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: gallery.title, href: path },
        ]}
      />
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <h1 className="font-extrabold text-3xl sm:text-4xl text-foreground mb-4">
          {gallery.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-3xl">{copy.intro}</p>
        <section className="mb-12" aria-labelledby="gallery-profiles">
          <h2 id="gallery-profiles" className="sr-only">
            Public portfolio examples
          </h2>
          {profiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map((person) => (
                <PersonCard key={person.handle} person={person} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No curated profiles are currently public in this gallery. You can still browse the{" "}
              <Link className="underline" to="/explore">
                professional directory
              </Link>{" "}
              for inspiration.
            </p>
          )}
        </section>
        <RoleSection
          heading="What these portfolios do well"
          intro="Use the examples above as a starting point, not a checklist every person must meet. These are useful principles for shaping your own portfolio."
          items={copy.observations}
        />
        <section className="mb-12">
          <h2 className="font-bold text-xl text-foreground mb-4">
            Choose a template for your own portfolio
          </h2>
          <p className="text-muted-foreground mb-4">
            Start with your PDF resume: clickfolio.me uses AI to parse it into a hosted portfolio at
            clickfolio.me/@handle. All {TEMPLATE_COUNT} themes are free. These themes are starting
            points to consider, not a claim about which themes the examples above use.
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            {gallery.themes.map((id) => (
              <li key={id}>
                <Link
                  className="underline"
                  to="/templates/$theme"
                  params={{ theme: themeSlug(id) }}
                >
                  {THEME_METADATA[id].name}
                </Link>
              </li>
            ))}
          </ul>
          <Link className="underline" to={`/for/${gallery.forSlug}`}>
            Learn how to build a portfolio for your role
          </Link>
        </section>
        <section className="mb-12">
          <h2 className="font-bold text-xl text-foreground mb-4">More portfolio inspiration</h2>
          <ul className="list-disc pl-5 space-y-2">
            {EXAMPLE_GALLERIES.filter((entry) => entry.slug !== gallery.slug).map((entry) => (
              <li key={entry.slug}>
                <Link className="underline" to="/examples/$slug" params={{ slug: entry.slug }}>
                  {entry.title}
                </Link>
              </li>
            ))}
            <li>
              <Link className="underline" to="/explore">
                Browse all professional portfolios
              </Link>
            </li>
          </ul>
        </section>
        <Button asChild size="lg">
          <Link to="/">Create Your Free Portfolio</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
