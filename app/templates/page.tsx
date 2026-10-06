import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import { THEME_IDS, THEME_METADATA, themeSlug, TEMPLATE_COUNT } from "@/lib/templates/theme-ids";

export const revalidate = 86400;

const title = "Resume Website Templates";

const description =
  "Explore 14 free resume website templates, from minimalist personal websites to developer portfolios. Turn your PDF resume into a hosted portfolio.";

const path = "/templates";

export const metadata: Metadata = buildPublicPageMetadata({ title, description, path });

export default function TemplatesPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: THEME_IDS.length,
    itemListElement: THEME_IDS.map((id, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: THEME_METADATA[id].name,
      url: `${siteConfig.url}/templates/${themeSlug(id)}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            generateWebPageJsonLd(title, path, description),
            generatePageBreadcrumbJsonLd(title, path),
            itemList,
          ]),
        }}
      />
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <header className="mb-12 max-w-3xl">
            <h1 className="mb-4 text-3xl font-extrabold text-foreground sm:text-5xl">
              Resume Website Templates
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Find a resume website template that fits the way you work. Explore 14 free personal
              website templates, from quiet editorial layouts to image-led portfolios and developer
              profiles. Every design turns your resume into a shareable website.
            </p>
          </header>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_IDS.map((id, index) => {
              const theme = THEME_METADATA[id];

              return (
                <article key={id}>
                  <Link
                    href={`/templates/${themeSlug(id)}`}
                    className="block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <img
                      src={theme.preview}
                      alt={`${theme.name} resume website preview: ${theme.description}`}
                      width={2560}
                      height={1600}
                      loading={index < 3 ? "eager" : "lazy"}
                      decoding="async"
                      className="mb-5 h-auto w-full rounded-md border border-border"
                    />
                    <h2 className="text-xl font-bold text-foreground underline-offset-4 hover:underline">
                      {theme.name}
                    </h2>
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{theme.category}</p>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{theme.description}</p>
                </article>
              );
            })}
          </div>
          <section
            aria-labelledby="getting-started"
            className="mt-16 max-w-3xl border-t border-border pt-10"
          >
            <h2 id="getting-started" className="mb-4 text-2xl font-bold text-foreground">
              One resume, your choice of presentation
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Start with your PDF resume. clickfolio.me uses AI to parse it into a hosted portfolio
              at clickfolio.me/@handle. Choose a layout that gives the right emphasis to your
              experience, skills, and projects. The preview on each template page uses demo content
              so you can compare designs before starting. All {TEMPLATE_COUNT} themes are free.
            </p>
            <Button asChild size="lg">
              <Link href="/">Create Your Free Portfolio</Link>
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
