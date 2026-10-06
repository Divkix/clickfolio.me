import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { PROFESSIONS } from "@/lib/config/professions";
import { EXAMPLE_GALLERIES } from "@/lib/examples/galleries";
import {
  generateBreadcrumbListJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";
import {
  THEME_IDS,
  THEME_METADATA,
  themeIdFromSlug,
  themeSlug,
  TEMPLATE_COUNT,
} from "@/lib/templates/theme-ids";
import { THEME_PAGE_COPY } from "@/lib/templates/theme-pages";

export const revalidate = 86400;

type ThemePageProps = { params: Promise<{ theme: string }> };

export function generateStaticParams() {
  return THEME_IDS.map((id) => ({ theme: themeSlug(id) }));
}

export async function generateMetadata({ params }: ThemePageProps): Promise<Metadata> {
  const { theme } = await params;
  const id = themeIdFromSlug(theme);

  if (!id || theme !== themeSlug(id)) notFound();

  return buildPublicPageMetadata({
    title: `${THEME_METADATA[id].name} Resume Website Template`,
    description: THEME_PAGE_COPY[id].description,
    path: `/templates/${themeSlug(id)}`,
  });
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { theme } = await params;
  const id = themeIdFromSlug(theme);

  if (!id || theme !== themeSlug(id)) notFound();

  const details = THEME_METADATA[id];
  const copy = THEME_PAGE_COPY[id];
  const title = `${details.name} Resume Website Template`;
  const path = `/templates/${themeSlug(id)}`;
  const professions = PROFESSIONS.filter((profession) => profession.themes.includes(id));
  const relatedGalleries = EXAMPLE_GALLERIES.filter((gallery) => gallery.themes.includes(id));
  const galleries = relatedGalleries.length > 0 ? relatedGalleries : EXAMPLE_GALLERIES;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            generateWebPageJsonLd(title, path, copy.description),
            generateBreadcrumbListJsonLd([
              { name: "Home", path: "/" },
              { name: "Resume Website Templates", path: "/templates" },
              { name: title, path },
            ]),
          ]),
        }}
      />
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Link href="/templates" className="text-sm underline underline-offset-4">
            All resume website templates
          </Link>
          <header className="mb-8 mt-6 max-w-3xl">
            <h1 className="mb-4 text-3xl font-extrabold text-foreground sm:text-4xl">{title}</h1>
            <p className="text-lg leading-relaxed text-muted-foreground">{details.description}</p>
          </header>
          <figure className="mb-12">
            <img
              src={details.preview}
              alt={`${details.name} resume website preview: ${details.description}`}
              width={2560}
              height={1600}
              fetchPriority="high"
              decoding="async"
              className="h-auto w-full rounded-md border border-border"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              {details.name} shown with demo resume content. Your portfolio uses your own resume.
            </figcaption>
          </figure>
          <div className="max-w-3xl">
            <section aria-labelledby="template-layout" className="mb-10">
              <h2 id="template-layout" className="mb-4 text-2xl font-bold text-foreground">
                A closer look at {details.name}
              </h2>
              <div className="space-y-5 text-muted-foreground">
                {copy.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
              <p className="mt-6">
                <Link href={`/preview/${id}`} className="underline underline-offset-4">
                  Open the {details.name} live demo
                </Link>
              </p>
            </section>
            <section aria-labelledby="best-for" className="mb-10">
              <h2 id="best-for" className="mb-4 text-2xl font-bold text-foreground">
                Best for
              </h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {professions.map((profession) => (
                  <li key={profession.slug}>
                    <Link href={`/for/${profession.slug}`} className="underline underline-offset-4">
                      {profession.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="portfolio-examples" className="mb-10">
              <h2 id="portfolio-examples" className="mb-4 text-2xl font-bold text-foreground">
                {relatedGalleries.length > 0
                  ? "Related portfolio examples"
                  : "Explore portfolio examples"}
              </h2>
              <p className="mb-4 leading-relaxed text-muted-foreground">
                See how people present their resume content in a hosted portfolio. These galleries
                feature real portfolios across different themes.
              </p>
              <ul className="space-y-3">
                {galleries.map((gallery) => (
                  <li key={gallery.slug}>
                    <Link
                      href={`/examples/${gallery.slug}`}
                      className="underline underline-offset-4"
                    >
                      {gallery.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section
              aria-labelledby="start-portfolio"
              className="mb-12 border-t border-border pt-8"
            >
              <h2 id="start-portfolio" className="mb-4 text-2xl font-bold text-foreground">
                Make this template your own
              </h2>
              <p className="mb-6 leading-relaxed text-muted-foreground">
                Upload your PDF resume and let AI parse it into a hosted portfolio at
                clickfolio.me/@handle. {details.name} is one of {TEMPLATE_COUNT} free themes you can
                choose for your resume website.
              </p>
              <Button asChild size="lg">
                <Link href="/">Create Your Free Portfolio</Link>
              </Button>
            </section>
            <nav aria-labelledby="other-templates" className="border-t border-border pt-8">
              <h2 id="other-templates" className="mb-4 text-2xl font-bold text-foreground">
                Other templates
              </h2>
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {THEME_IDS.filter((otherId) => otherId !== id).map((otherId) => (
                  <li key={otherId}>
                    <Link
                      href={`/templates/${themeSlug(otherId)}`}
                      className="underline underline-offset-4"
                    >
                      {THEME_METADATA[otherId].name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
