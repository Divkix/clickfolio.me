import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export const revalidate = 3600;

const title = "Portfolio Website for Product Managers";
const description =
  "Showcase your product launches, roadmaps, and impact with a free portfolio website. 10 templates, AI-powered parsing from PDF, custom @handle URL.";
const path = "/for/product-manager";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteConfig.url}${path}` },
  openGraph: {
    title,
    description,
    siteName: siteConfig.fullName,
    images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function ProductManagerPage() {
  const webPageJsonLd = generateWebPageJsonLd(title, path, description);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(title, path);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from hardcoded config, serializeJsonLd escapes XSS vectors
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Breadcrumb JSON-LD from hardcoded path, no user input
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen bg-cream paper-texture" id="main-content">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="font-black text-3xl sm:text-4xl text-ink mb-4">
            Portfolio Websites for Product Managers
          </h1>
          <p className="text-lg text-[#6B6B6B] mb-8">
            You ship products. Now ship your personal brand. Upload your PDF resume and get a
            polished portfolio website with a custom @handle URL, free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">
              Why Product Managers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-[#6B6B6B] list-disc pl-5">
              <li>
                <strong>Bento Grid template</strong>: modern mosaic layout that organizes your
                product launches, metrics, and cross-functional wins into visually distinct,
                scannable cards.
              </li>
              <li>
                <strong>Spotlight template</strong>: warm, animated portfolio that gives each
                product or initiative the dedicated space it deserves. Tell your product stories
                with impact.
              </li>
              <li>
                <strong>Structured project highlights</strong>: AI extracts and organizes your
                product launches, roadmaps, and cross-functional collaborations into clear,
                results-focused sections.
              </li>
              <li>
                <strong>Metrics-forward design</strong>: templates emphasize numbers, impact
                metrics, and outcomes. Show the ROI you delivered, not just what you did.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Your Portfolio Is a Product</h2>
            <p className="text-[#6B6B6B] mb-4">
              As a PM, you know that presentation matters. Your clickfolio.me portfolio is the
              product that sells you: fast-loading, well-structured, and designed to convert
              recruiters and hiring managers into interview requests.
            </p>
            <p className="text-[#6B6B6B]">
              Switch between 10 templates to find the one that best represents your style. Every
              template is mobile-responsive and optimized for rich link previews on LinkedIn, Slack,
              and email.
            </p>
          </section>

          <Link
            href="/"
            className="inline-block bg-ink text-cream font-bold px-6 py-3 border-3 border-ink shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-transform"
          >
            Create Your Free PM Portfolio →
          </Link>
        </div>
      </main>
    </>
  );
}
