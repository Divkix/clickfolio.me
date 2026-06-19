import { FileUp, Globe, Heart, Lock, Sparkles, Zap } from "lucide-react";
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

/** Revalidate daily — static marketing content. */
export const revalidate = 86400;

const aboutTitle = `About - ${siteConfig.fullName}`;
const aboutDescription = `${siteConfig.fullName} turns your PDF resume into a hosted web portfolio in seconds. Learn what we believe, how it works, and why it's free.`;

/** SEO metadata for the about page. */
export const metadata: Metadata = {
  title: "About",
  description: aboutDescription,
  alternates: { canonical: `${siteConfig.url}/about` },
  openGraph: {
    title: aboutTitle,
    description: aboutDescription,
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: aboutTitle,
    description: aboutDescription,
  },
};

const VALUES = [
  {
    icon: Zap,
    title: "Effortless by default",
    desc: "Upload a PDF and get a polished portfolio in about a minute. No builders, no blank canvas, no fuss.",
  },
  {
    icon: Lock,
    title: "Your data, your call",
    desc: "Granular privacy controls let you decide what's public. Delete everything permanently whenever you want.",
  },
  {
    icon: Heart,
    title: "Free, genuinely",
    desc: "All six base templates are free forever — no trials, no credit card. Premium themes unlock by sharing.",
  },
  {
    icon: Globe,
    title: "Open and portable",
    desc: "Transparent, open-source code and a clean @handle URL that's yours to share anywhere.",
  },
];

const STEPS = [
  {
    icon: FileUp,
    title: "Upload your resume",
    desc: "Drop in a PDF. Our AI reads your experience, education, skills, and projects.",
  },
  {
    icon: Sparkles,
    title: "Review and refine",
    desc: "Everything lands in an editor you control. Tweak the details and pick a template.",
  },
  {
    icon: Globe,
    title: "Share your link",
    desc: "Publish to clickfolio.me/@you and drop the link on LinkedIn, X, or your email signature.",
  },
];

/**
 * About page — mission, values, and how it works, in the bolder marketing register.
 */
export default function AboutPage() {
  const breadcrumb = generatePageBreadcrumbJsonLd("About", "/about");
  const webPage = generateWebPageJsonLd("About", "/about", aboutDescription);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }}
      />

      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Our mission</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Your resume deserves more than a PDF
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              {siteConfig.fullName} turns the document sitting in your downloads folder into a
              living web portfolio — fast, private, and free. We built it because a great career
              shouldn&apos;t be trapped in an attachment.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What we believe
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VALUES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border-strong"
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border bg-surface-2 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How it works
              </h2>
              <p className="mt-2 text-muted-foreground">
                Three steps from PDF to a portfolio you&apos;re proud to share.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground text-sm font-semibold">
                      {i + 1}
                    </span>
                    <Icon className="size-5 text-brand" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-brand-subtle p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Build your portfolio today
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Upload your resume and see it transform — free forever, no credit card.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/explore">Explore portfolios</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
