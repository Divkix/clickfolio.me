import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { siteConfig } from "@/lib/config/site";
import {
  generateFAQJsonLd,
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

/** Revalidate daily — static marketing content. */
export const revalidate = 86400;

const faqTitle = `FAQ - ${siteConfig.fullName}`;
const faqDescription = `Answers to common questions about ${siteConfig.fullName}: how the AI resume parsing works, pricing, privacy, customization, and more.`;

/** SEO metadata for the FAQ page. */
export const metadata: Metadata = {
  title: "FAQ",
  description: faqDescription,
  alternates: { canonical: `${siteConfig.url}/faq` },
  openGraph: {
    title: faqTitle,
    description: faqDescription,
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: faqTitle,
    description: faqDescription,
  },
};

/**
 * Full FAQ page — server-rendered accordion (native <details>) plus FAQPage,
 * WebPage, and BreadcrumbList structured data.
 */
export default function FAQPage() {
  const faqJsonLd = generateFAQJsonLd();
  const breadcrumb = generatePageBreadcrumbJsonLd("FAQ", "/faq");
  const webPage = generateWebPageJsonLd("FAQ", "/faq", faqDescription);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }}
      />

      <SiteHeader />

      <main className="flex-1 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Support</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Frequently asked questions
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Everything you need to know about turning your resume into a portfolio. Can&apos;t
              find an answer?{" "}
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                Email us
              </a>
              .
            </p>
          </div>

          {/* Accordion */}
          <div className="mt-12 space-y-3">
            {FAQ_ITEMS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-border bg-card shadow-sm transition-colors open:border-border-strong"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown
                    className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-6 pb-6 leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl border border-border bg-brand-subtle p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ready to build yours?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Upload your resume and get a polished portfolio in about a minute — free forever.
            </p>
            <div className="mt-6">
              <Button asChild size="lg">
                <Link href="/">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
