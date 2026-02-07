import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { BottomCTAButton } from "@/components/home/BottomCTAButton";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { WhatYouGetSection } from "@/components/home/WhatYouGetSection";
import { ReferralCapture } from "@/components/ReferralCapture";
import { SiteHeader } from "@/components/SiteHeader";
import { siteConfig } from "@/lib/config/site";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { generateHomepageJsonLd, serializeJsonLd } from "@/lib/utils/json-ld";

const pageTitle = `${siteConfig.fullName} — ${siteConfig.tagline}`;
const pageDescription =
  "Drop your PDF résumé and get a shareable website in seconds. Free, fast, and AI-powered.";

export const metadata: Metadata = {
  title: pageTitle,
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
    description: "Drop your PDF résumé and get a shareable website in seconds.",
    images: [`${siteConfig.url}/api/og/home`],
  },
};

export default function Home() {
  const homepageJsonLd = generateHomepageJsonLd();
  return (
    <>
      {homepageJsonLd.map((schema, i) => (
        <script
          key={`homepage-jsonld-${i}`}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from hardcoded siteConfig, serializeJsonLd escapes XSS vectors
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      {/* Capture referral handle from ?ref= parameter */}
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <div className="min-h-screen bg-cream flex flex-col paper-texture">
        <SiteHeader />

        <main id="main-content" className="flex-1 relative overflow-hidden pb-20 lg:pb-0">
          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-amber rounded-full opacity-20 blur-3xl" />
          <div className="absolute bottom-40 right-10 w-40 h-40 bg-coral rounded-full opacity-20 blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-mint rounded-full opacity-15 blur-2xl" />

          {/* Hero Section - Asymmetric Bento Layout */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left Column - Main headline */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Hero Card */}
                <div
                  className="
                  bg-white
                  border-3
                  border-ink
                  p-8
                  lg:p-12
                  shadow-brutal-lg
                  animate-fade-in-up
                  relative
                  overflow-hidden
                "
                >
                  {/* Folded corner effect */}
                  <div className="absolute top-0 right-0 w-16 h-16">
                    {/* Shadow under the fold */}
                    <div
                      className="absolute top-0 right-0 w-0 h-0"
                      style={{
                        borderLeft: "64px solid transparent",
                        borderTop: "64px solid rgba(0,0,0,0.06)",
                      }}
                    />
                    {/* The fold crease - subtle white */}
                    <div
                      className="absolute top-0 right-0 w-0 h-0"
                      style={{
                        borderLeft: "60px solid transparent",
                        borderTop: "60px solid #ffffff",
                      }}
                    />
                    {/* Underside of fold (brand accent) */}
                    <div
                      className="absolute bottom-0 left-0 w-0 h-0"
                      style={{
                        borderRight: "64px solid transparent",
                        borderBottom: "64px solid #D94E4E",
                      }}
                    />
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink leading-[1.1] tracking-tight mb-6">
                    Your Resume
                    <br />
                    <span className="relative inline-block">
                      is already a
                      <svg
                        className="absolute -bottom-2 left-0 w-full h-3 text-coral"
                        viewBox="0 0 200 12"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M0,8 Q50,0 100,8 T200,8"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <br />
                    <span className="inline-block bg-ink text-cream px-4 py-2 -rotate-1 mt-2">
                      Website
                    </span>
                  </h1>

                  <p className="text-lg sm:text-xl text-[#6B6B6B] max-w-lg font-medium leading-relaxed">
                    Drop your PDF. Get a shareable link in{" "}
                    <span className="font-mono text-ink">30 seconds.</span>
                  </p>

                  {/* Portfolio preview mockups */}
                  <div className="flex items-end gap-3 mt-8">
                    {[
                      { src: "/previews/minimalist.png", rotate: "-rotate-3" },
                      { src: "/previews/brutalist.png", rotate: "rotate-1" },
                      { src: "/previews/glass.png", rotate: "rotate-3" },
                    ].map((preview) => (
                      <div
                        key={preview.src}
                        className={`${preview.rotate} border-3 border-ink shadow-brutal-sm bg-white overflow-hidden w-20 sm:w-24`}
                      >
                        <div className="bg-ink flex items-center gap-1 px-1.5 py-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-coral" />
                          <div className="w-1.5 h-1.5 rounded-full bg-amber" />
                          <div className="w-1.5 h-1.5 rounded-full bg-mint" />
                        </div>
                        <img
                          src={preview.src}
                          alt=""
                          aria-hidden="true"
                          loading="eager"
                          className="aspect-3/4 object-cover object-top w-full"
                        />
                      </div>
                    ))}
                    <span className="hidden sm:block font-mono text-xs text-ink/50 ml-2 pb-1">
                      ← Your resume, {DEMO_PROFILES.length} ways
                    </span>
                  </div>
                </div>

                {/* Stats Row - Reordered: Free → ~30s → AI-Powered */}
                <div className="grid grid-cols-3 gap-4">
                  <div
                    className="
                    bg-mint
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-100
                  "
                  >
                    <div className="font-black text-2xl sm:text-3xl text-ink">Free</div>
                    <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                      Forever
                    </div>
                  </div>

                  <div
                    className="
                    bg-amber
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-200
                  "
                  >
                    <div className="font-black text-2xl sm:text-3xl text-ink">~30s</div>
                    <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                      Setup
                    </div>
                  </div>

                  <a
                    href="https://github.com/divkix/clickfolio.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                    bg-lavender
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-300
                    block
                  "
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-6 w-6 sm:h-7 sm:w-7 text-ink"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <div>
                        <div className="font-black text-lg sm:text-xl text-ink leading-tight">
                          Open
                        </div>
                        <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                          Source
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Right Column - Upload & Examples */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Upload Card */}
                <div
                  id="upload-card"
                  className="
                  bg-white
                  border-3
                  border-ink
                  shadow-brutal-md
                  animate-fade-in-up
                  delay-200
                "
                >
                  <div className="border-b-3 border-ink bg-ink text-cream px-4 py-2 flex items-center justify-between">
                    <span className="font-mono text-sm uppercase tracking-wider">
                      → Drop your resume
                    </span>
                    <span className="bg-mint text-ink px-2 py-0.5 border-2 border-ink font-bold font-mono text-xs uppercase">
                      No sign-up to upload
                    </span>
                  </div>
                  <div className="p-4">
                    <FileDropzone />
                  </div>
                </div>

                {/* Templates Feature Anchor */}
                <a
                  href="#examples"
                  className="
                  bg-coral
                  border-3
                  border-ink
                  p-4
                  shadow-brutal-sm
                  hover-brutal-shift
                  animate-fade-in-up
                  delay-300
                  flex
                  items-center
                  gap-4
                  block
                "
                >
                  <div className="flex gap-1.5">
                    <div className="w-6 h-6 bg-amber border-2 border-ink" />
                    <div className="w-6 h-6 bg-mint border-2 border-ink" />
                    <div className="w-6 h-6 bg-lavender border-2 border-ink" />
                  </div>
                  <div>
                    <div className="font-black text-xl text-white">
                      {DEMO_PROFILES.length} Templates
                    </div>
                    <div className="font-mono text-xs text-white/80 uppercase tracking-wide">
                      Choose your style
                    </div>
                  </div>
                </a>

                {/* Tech Badges */}
                <div className="text-center text-xs text-[#6B6B6B] mt-2">
                  Powered by <span className="font-semibold">Cloudflare</span> •{" "}
                  <span className="font-semibold">OpenAI</span>
                </div>
              </div>
            </div>

            {/* Examples Section */}
            <ExamplesSection profiles={DEMO_PROFILES} />

            {/* Explore Bridge — from demos to real portfolios */}
            <section className="mt-12 lg:mt-16">
              <Link
                href="/explore"
                className="group block bg-lavender border-3 border-ink p-6 shadow-brutal-md hover-brutal-shift"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <div className="font-black text-xl sm:text-2xl text-ink mb-1">
                      Browse Real Portfolios
                    </div>
                    <div className="font-mono text-sm text-ink/70 uppercase tracking-wide">
                      Discover professionals in our directory
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-ink font-mono text-sm font-bold uppercase tracking-wide shrink-0">
                    <span>Explore</span>
                    <svg
                      className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            </section>

            {/* How it works - Horizontal steps */}
            <section className="mt-16 lg:mt-20">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-black text-2xl sm:text-3xl text-ink">How it works</h2>
                <div className="flex-1 h-1 bg-ink" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    step: "01",
                    title: "Upload",
                    desc: "Drop your PDF resume. No sign-up to start.",
                    color: "bg-amber",
                  },
                  {
                    step: "02",
                    title: "AI Parses",
                    desc: "AI extracts your experience, skills, and achievements.",
                    color: "bg-mint",
                  },
                  {
                    step: "03",
                    title: "Publish",
                    desc: "Get your own clickfolio.me/@yourname URL in 30 seconds.",
                    color: "bg-coral",
                  },
                ].map((item, index) => (
                  <div
                    key={item.step}
                    className={`
                    ${item.color}
                    border-3
                    border-ink
                    p-6
                    shadow-brutal-md
                    hover-brutal-shift
                    animate-fade-in-up
                  `}
                    style={{ animationDelay: `${(index + 8) * 100}ms` }}
                  >
                    <div className="font-mono text-4xl font-black text-ink/30 mb-2">
                      {item.step}
                    </div>
                    <h3 className="font-black text-xl text-ink mb-2">{item.title}</h3>
                    <p className="font-medium text-ink/80">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <WhatYouGetSection />

            {/* Bottom CTA */}
            <section className="mt-16 lg:mt-20">
              <div
                className="
                bg-ink
                border-3
                border-ink
                p-8
                lg:p-12
                shadow-brutal-lg
                text-center
              "
              >
                <h2 className="font-black text-3xl sm:text-4xl text-cream mb-4">
                  Your resume deserves
                  <br />
                  <span className="inline-block bg-coral text-white px-3 py-1 rotate-1 mt-2">
                    its own URL.
                  </span>
                </h2>
                <p className="font-mono text-cream/70 mb-8 max-w-md mx-auto">
                  Give it a permanent home on the web. Free forever.
                </p>
                <div className="flex justify-center">
                  <BottomCTAButton />
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
