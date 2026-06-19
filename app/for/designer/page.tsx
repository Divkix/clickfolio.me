import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

const title = "Portfolio Website for Designers";
const description =
  "Turn your PDF into a stunning design portfolio website. Showcase your work with 10 beautiful templates — free, no signup required. Custom @handle URL included.";
const path = "/for/designer";

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

export default function DesignerPage() {
  const webPageJsonLd = generateWebPageJsonLd(title, path, description);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(title, path);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen bg-background" id="main-content">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="font-extrabold text-3xl sm:text-4xl text-foreground mb-4">
            Portfolio Websites for Designers
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your work deserves a canvas, not a template. Upload your PDF resume and get a
            designer-quality portfolio website with a custom @handle URL — free, no signup needed.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Designers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>DesignFolio template</strong> — digital brutalism meets Swiss typography.
                Dark theme with acid lime accents. Bold, distinctive, and impossible to ignore.
              </li>
              <li>
                <strong>Spotlight template</strong> — warm creative portfolio with animated
                sections. Designed to give your work the breathing room it needs.
              </li>
              <li>
                <strong>Visual-first layouts</strong> — every template prioritizes typography,
                whitespace, and visual hierarchy. Your portfolio looks like it was custom-built.
              </li>
              <li>
                <strong>Project gallery display</strong> — AI extracts your projects from your
                resume and presents them in structured, scannable layouts with role, timeline, and
                description.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              From PDF to Published in 30 Seconds
            </h2>
            <p className="text-muted-foreground mb-4">
              Drop your existing PDF resume — the one you already have. Our AI extracts your
              experience, education, skills, and projects. In 30 seconds, you have a live portfolio
              you can share with studios, agencies, and clients.
            </p>
            <p className="text-muted-foreground">
              Not happy with the first template? Switch between 10 professionally designed themes
              with one click. No design skills needed to make your work look great.
            </p>
          </section>

          <Button asChild size="lg">
            <a href="/">Create Your Free Design Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
