import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export const revalidate = 3600;

const title = "Resume Website for Marketers";
const description =
  "Create a standout marketing portfolio website from your PDF resume. Highlight campaign metrics, brands you've worked with, and results — free, with 10 templates.";
const path = "/for/marketer";

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

export default function MarketerPage() {
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
            Resume Websites for Marketers
          </h1>
          <p className="text-lg text-[#6B6B6B] mb-8">
            Your resume should sell you as well as you sell products. Turn your PDF into a polished
            marketing portfolio with a custom @handle URL, free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Why Marketers Love clickfolio.me</h2>
            <ul className="space-y-3 text-[#6B6B6B] list-disc pl-5">
              <li>
                <strong>Bold Corporate template</strong>: executive typography with numbered
                sections that make your achievements impossible to skim past. Premium look that
                commands attention.
              </li>
              <li>
                <strong>Neo Brutalist template</strong>: high-contrast, bold design that stands out
                in any link preview. Perfect for marketers who want to show personality.
              </li>
              <li>
                <strong>Results-focused structure</strong>: AI extracts and highlights your campaign
                metrics, growth numbers, and brand names. Your impact is front and center.
              </li>
              <li>
                <strong>Privacy controls</strong>: toggle what's visible to recruiters and the
                public. Share a polished version publicly while keeping sensitive details for direct
                conversations.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Your Portfolio, Your Brand</h2>
            <p className="text-[#6B6B6B] mb-4">
              Every marketer knows the power of a strong landing page. Your clickfolio.me portfolio
              is your personal landing page: a permanent @handle URL you can put on LinkedIn, in
              your email signature, and on your business cards.
            </p>
            <p className="text-[#6B6B6B]">
              Rich Open Graph previews mean your portfolio looks great when shared on social media,
              Slack, or anywhere links are unfurled. Your personal brand, amplified.
            </p>
          </section>

          <Link
            href="/"
            className="inline-block bg-ink text-cream font-bold px-6 py-3 border-3 border-ink shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-transform"
          >
            Create Your Free Marketing Portfolio →
          </Link>
        </div>
      </main>
    </>
  );
}
