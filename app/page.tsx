import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { BottomCTAButton } from "@/components/home/BottomCTAButton";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { FAQSection } from "@/components/home/FAQSection";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { UsageStats } from "@/components/home/UsageStats";
import { WhatYouGetSection } from "@/components/home/WhatYouGetSection";
import { ReferralCapture } from "@/components/ReferralCapture";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/config/site";
import { generateFAQJsonLd, generateHomepageJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";

export const revalidate = 3600;

const pageTitle = `${siteConfig.fullName} — ${siteConfig.tagline}`;
const pageDescription =
  "Drop your PDF resume and get a shareable website in seconds. Free resume builder with 10 templates, @handle URLs, and privacy controls. No signup.";

/** SEO metadata for the marketing homepage. */
export const metadata: Metadata = {
  title: siteConfig.tagline,
  description: pageDescription,
  alternates: { canonical: siteConfig.url },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    images: [
      {
        url: `${siteConfig.url}/api/og/home`,
        width: 1200,
        height: 630,
        alt: siteConfig.fullName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [`${siteConfig.url}/api/og/home`],
  },
};

/**
 * Marketing homepage — landing page with hero, upload, examples, and FAQ.
 * Revalidated every hour for fresh content.
 */
export default function Home() {
  const homepageJsonLd = generateHomepageJsonLd();
  const faqJsonLd = generateFAQJsonLd();
  return (
    <>
      {homepageJsonLd.map((schema, i) => (
        <script
          key={`homepage-jsonld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      {/* Capture referral handle from ?ref= parameter */}
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />

        <main id="main-content" className="flex-1 pb-20 lg:pb-0">
          {/* Hero */}
          <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-20">
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left — headline */}
              <div className="flex flex-col gap-8 lg:col-span-7">
                <div className="animate-fade-in-up">
                  <Badge variant="brand" className="mb-5">
                    Free · No sign-up to start
                  </Badge>
                  <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                    Your resume is already a <span className="text-brand">website</span>.
                  </h1>
                  <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                    Drop your PDF and get a shareable portfolio link in about{" "}
                    <span className="font-medium text-foreground">30 seconds</span>.
                  </p>

                  {/* Preview mockups */}
                  <div className="mt-8 flex items-end gap-3">
                    {[
                      "/previews/minimalist.webp",
                      "/previews/brutalist.webp",
                      "/previews/glass.webp",
                    ].map((src, index) => (
                      <div
                        key={src}
                        className="w-20 overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:w-24"
                      >
                        <div className="flex items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
                          <span className="size-1.5 rounded-full bg-border-strong" />
                          <span className="size-1.5 rounded-full bg-border-strong" />
                          <span className="size-1.5 rounded-full bg-border-strong" />
                        </div>
                        <img
                          src={src}
                          alt=""
                          aria-hidden="true"
                          loading={index === 2 ? "eager" : "lazy"}
                          decoding="async"
                          {...(index === 2 ? { fetchPriority: "high" as const } : {})}
                          className="aspect-3/4 w-full object-cover object-top"
                        />
                      </div>
                    ))}
                    <span className="ml-2 hidden pb-1 text-xs text-muted-foreground sm:block">
                      Your resume, {DEMO_PROFILES.length} ways
                    </span>
                  </div>
                </div>

                {/* Stat row */}
                <dl className="grid grid-cols-3 gap-4">
                  {[
                    { value: "Free", label: "Forever" },
                    { value: "~30s", label: "Setup" },
                    { value: "10", label: "Templates" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <dt className="sr-only">{s.label}</dt>
                      <dd className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                        {s.value}
                      </dd>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Right — upload */}
              <div className="flex flex-col gap-4 lg:col-span-5 lg:pt-2">
                <div
                  id="upload-card"
                  className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-md delay-100"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-medium">Drop your resume</span>
                    <Badge variant="success">No sign-up to upload</Badge>
                  </div>
                  <div className="p-4">
                    <FileDropzone />
                  </div>
                </div>

                <a
                  href="#examples"
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border-strong"
                >
                  <span className="text-sm font-medium">
                    Browse {DEMO_PROFILES.length} templates
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </a>

                <p className="text-center text-xs text-muted-foreground">
                  Powered by <span className="font-medium text-foreground">Cloudflare</span> ·{" "}
                  <span className="font-medium text-foreground">OpenAI</span>
                </p>
              </div>
            </div>

            <ExamplesSection profiles={DEMO_PROFILES} />

            {/* Explore bridge */}
            <section className="mt-12 lg:mt-16">
              <Link
                href="/explore"
                className="group flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border-strong sm:flex-row sm:items-center"
              >
                <div>
                  <div className="font-display text-xl font-bold tracking-tight">
                    Browse real portfolios
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Discover professionals in our public directory.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-brand">
                  Explore
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </section>

            {/* How it works */}
            <section className="mt-20 lg:mt-28">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                How it works
              </h2>
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Upload",
                    desc: "Drop your PDF resume. No sign-up to start.",
                  },
                  {
                    step: "2",
                    title: "AI parses it",
                    desc: "AI extracts your experience, skills, and achievements.",
                  },
                  {
                    step: "3",
                    title: "Publish",
                    desc: "Get your own clickfolio.me/@yourname URL in seconds.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex size-9 items-center justify-center rounded-full bg-brand-subtle font-display text-lg font-bold text-brand-active">
                      {item.step}
                    </div>
                    <h3 className="mt-4 font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <WhatYouGetSection />

            <FAQSection />

            <UsageStats />

            {/* Bottom CTA */}
            <section className="mt-20 lg:mt-28">
              <div className="rounded-2xl bg-foreground px-6 py-14 text-center text-background lg:px-12">
                <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Your resume deserves its own URL.
                </h2>
                <p className="mx-auto mt-3 max-w-md text-background/70">
                  Give it a permanent home on the web. Free forever.
                </p>
                <div className="mt-8 flex flex-col items-center gap-4">
                  <BottomCTAButton />
                  <a
                    href="/blog"
                    className="text-sm text-background/70 underline underline-offset-4 transition-colors hover:text-background"
                  >
                    Read our guides
                  </a>
                </div>
              </div>
            </section>
          </section>
        </main>

        <Footer />
        <MobileStickyUpload />
      </div>
    </>
  );
}
