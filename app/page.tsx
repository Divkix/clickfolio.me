import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginButton } from "@/components/auth/LoginButton";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { ExamplesSection } from "@/components/home/ExamplesSection";
import { ScrollToTopButton } from "@/components/home/ScrollToTopButton";
import { Logo } from "@/components/Logo";
import { ReferralCapture } from "@/components/ReferralCapture";
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
        {/* Header - Bold, minimal */}
        <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <a href="/" aria-label="clickfolio.me home">
              <Logo size="md" />
            </a>
            <LoginButton />
          </div>
        </header>

        <main id="main-content" className="flex-1 relative overflow-hidden">
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

                  <div
                    className="
                    bg-lavender
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-300
                  "
                  >
                    <div className="font-black text-2xl sm:text-3xl text-ink">AI</div>
                    <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                      Powered
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Upload & Examples */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Upload Card */}
                <div
                  className="
                  bg-white
                  border-3
                  border-ink
                  shadow-brutal-md
                  animate-fade-in-up
                  delay-200
                "
                >
                  <div className="border-b-3 border-ink bg-ink text-cream px-4 py-2">
                    <span className="font-mono text-sm uppercase tracking-wider">
                      → Drop your resume (it&apos;s free)
                    </span>
                  </div>
                  <div className="p-4">
                    <FileDropzone />
                  </div>
                </div>

                {/* Social Proof */}
                <div
                  className="
                  bg-coral
                  border-3
                  border-ink
                  p-4
                  shadow-brutal-sm
                  animate-fade-in-up
                  delay-300
                  flex
                  items-center
                  gap-4
                "
                >
                  <div className="flex -space-x-3">
                    <div className="w-10 h-10 rounded-full bg-amber border-3 border-ink flex items-center justify-center font-black text-sm text-ink">
                      SC
                    </div>
                    <div className="w-10 h-10 rounded-full bg-mint border-3 border-ink flex items-center justify-center font-black text-sm text-ink">
                      JS
                    </div>
                    <div className="w-10 h-10 rounded-full bg-lavender border-3 border-ink flex items-center justify-center font-black text-sm text-ink">
                      MR
                    </div>
                  </div>
                  <div>
                    <div className="font-black text-xl text-white">1,000+</div>
                    <div className="font-mono text-xs text-white/80 uppercase tracking-wide">
                      Resumes published
                    </div>
                  </div>
                </div>

                {/* Tech Badges */}
                <div className="text-center text-xs text-[#6B6B6B] mt-2">
                  Powered by <span className="font-semibold">Cloudflare</span> •{" "}
                  <span className="font-semibold">OpenAI</span>
                </div>
              </div>
            </div>

            {/* Examples Section */}
            <ExamplesSection profiles={DEMO_PROFILES} />

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
                    desc: "Drop your PDF resume. No account needed to start.",
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

            {/* Testimonial */}
            <section className="mt-16 lg:mt-20">
              <div className="bg-mint border-3 border-ink p-6 shadow-brutal-md relative">
                <div className="absolute top-4 left-4 text-6xl text-ink/10 font-serif">"</div>
                <blockquote className="text-lg text-ink font-medium relative z-10 pl-8">
                  I spent 3 hours on my old portfolio. Clickfolio took 30 seconds.
                </blockquote>
                <footer className="mt-4 font-mono text-sm text-ink/70 pl-8">
                  — Marcus R., Software Engineer
                </footer>
              </div>
            </section>

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
                  <ScrollToTopButton />
                </div>
              </div>
            </section>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
