import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

const title = "Resume Website for Consultants";
const description =
  "Launch a professional consulting portfolio website from your PDF resume. Privacy controls, custom URL, 10 templates — free forever with no time limits.";
const path = "/for/consultant";

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

export default function ConsultantPage() {
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
            Resume Websites for Consultants
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your expertise deserves a professional online presence. Turn your PDF resume into a
            polished consulting portfolio with a custom @handle URL — free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Consultants Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Midnight template</strong> — dark minimal with serif headings and gold
                accents. Elegant and sophisticated, perfect for high-end consulting professionals.
              </li>
              <li>
                <strong>Minimalist Editorial template</strong> — clean, magazine-style layout that
                puts your track record in focus. No visual noise, just results.
              </li>
              <li>
                <strong>Granular privacy controls</strong> — toggle phone number and address
                visibility. Share a professional presence publicly while keeping personal contact
                details private until you choose to share them.
              </li>
              <li>
                <strong>Client engagement list</strong> — AI extracts and highlights the
                organizations you've worked with, presented in a clean timeline format that builds
                credibility instantly.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Your Digital Business Card</h2>
            <p className="text-muted-foreground mb-4">
              A clickfolio.me @handle URL is the modern consultant's business card. Put it on
              LinkedIn, in your email signature, and on proposals. Clients get a complete picture of
              your expertise before the first call.
            </p>
            <p className="text-muted-foreground">
              Rich Open Graph previews ensure your portfolio looks professional when shared. Every
              detail — from typography to layout — is designed to project competence and
              credibility.
            </p>
          </section>

          <Button asChild size="lg">
            <a href="/">Create Your Consulting Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
