"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LoginButton } from "@/components/auth/LoginButton";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Toaster } from "@/components/ui/sonner";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";

const TemplatePreviewModal = dynamic(
  () =>
    import("@/components/templates/TemplatePreviewModal").then(
      (module) => module.TemplatePreviewModal,
    ),
  { ssr: false },
);

export default function Home() {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-cream flex flex-col paper-texture">
      <Toaster />

      {/* Header - Bold, minimal */}
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <a href="/" aria-label="webresume.now home">
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
                  {/* Underside of fold (coral accent) */}
                  <div
                    className="absolute bottom-0 left-0 w-0 h-0"
                    style={{
                      borderRight: "64px solid transparent",
                      borderBottom: "64px solid #FF6B6B",
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
                  Drop your PDF. Get a shareable link.
                  <br />
                  <span className="font-mono text-ink">It takes less than a minute.</span>
                </p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div
                  className="
                    bg-amber
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-100
                  "
                >
                  <div className="font-black text-2xl sm:text-3xl text-ink">~30s</div>
                  <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                    Setup
                  </div>
                </div>

                <div
                  className="
                    bg-mint
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    animate-fade-in-up
                    delay-200
                  "
                >
                  <div className="font-black text-2xl sm:text-3xl text-ink">AI</div>
                  <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                    Parsing
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
                  <div className="font-black text-2xl sm:text-3xl text-ink">Free</div>
                  <div className="font-mono text-xs sm:text-sm text-ink/80 uppercase tracking-wide">
                    Forever
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
                    → Drop your resume
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
            </div>
          </div>

          {/* Examples Section */}
          <section className="mt-16 lg:mt-20">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-black text-2xl sm:text-3xl text-ink">See live examples</h2>
              <div className="flex-1 h-1 bg-ink" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEMO_PROFILES.map((profile, index) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setPreviewIndex(index)}
                  className={`
                    group
                    bg-white
                    border-3
                    border-ink
                    p-4
                    shadow-brutal-sm
                    hover-brutal-shift
                    text-left
                    animate-fade-in-up
                    focus:outline-none
                    focus:ring-4
                    focus:ring-coral
                  `}
                  style={{ animationDelay: `${(index + 4) * 100}ms` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`
                        w-12
                        h-12
                        rounded-full
                        border-3
                        border-ink
                        flex
                        items-center
                        justify-center
                        font-black
                        text-sm
                        ${
                          index === 0
                            ? "bg-coral text-white"
                            : index === 1
                              ? "bg-mint text-ink"
                              : index === 2
                                ? "bg-lavender text-white"
                                : "bg-amber text-ink"
                        }
                      `}
                    >
                      {profile.initials}
                    </div>
                    <div>
                      <div className="font-bold text-ink">{profile.name}</div>
                      <div className="font-mono text-xs text-[#6B6B6B]">{profile.role}</div>
                    </div>
                  </div>
                  <div
                    className={`
                      inline-block
                      px-2
                      py-1
                      border-2
                      border-ink
                      font-mono
                      text-xs
                      uppercase
                      tracking-wide
                      ${
                        index === 0
                          ? "bg-coral/10 text-coral"
                          : index === 1
                            ? "bg-mint/10 text-ink"
                            : index === 2
                              ? "bg-lavender/10 text-lavender"
                              : "bg-amber/10 text-ink"
                      }
                    `}
                  >
                    {profile.badgeLabel}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[#6B6B6B] group-hover:text-ink transition-colors">
                    <span className="font-mono text-xs">View template</span>
                    <svg
                      className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
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
                  desc: "Drop your PDF resume. No account needed.",
                  color: "bg-amber",
                },
                {
                  step: "02",
                  title: "AI Parses",
                  desc: "We extract your experience, skills, and achievements.",
                  color: "bg-mint",
                },
                {
                  step: "03",
                  title: "Publish",
                  desc: "Get a beautiful shareable link in seconds.",
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
                  <div className="font-mono text-4xl font-black text-ink/30 mb-2">{item.step}</div>
                  <h3 className="font-black text-xl text-ink mb-2">{item.title}</h3>
                  <p className="font-medium text-ink/80">{item.desc}</p>
                </div>
              ))}
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
                Your resume shouldn&apos;t
                <br />
                <span className="inline-block bg-coral text-white px-3 py-1 rotate-1 mt-2">
                  blend in.
                </span>
              </h2>
              <p className="font-mono text-cream/70 mb-8 max-w-md mx-auto">
                Neither should we. Start building your web portfolio today.
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="
                    inline-block
                    bg-coral
                    text-white
                    font-black
                    text-lg
                    px-8
                    py-4
                    border-3
                    border-cream
                    shadow-[5px_5px_0px_#FDF8F3]
                    hover:-translate-x-0.5
                    hover:-translate-y-0.5
                    hover:shadow-[7px_7px_0px_#FDF8F3]
                    active:translate-x-0
                    active:translate-y-0
                    active:shadow-[3px_3px_0px_#FDF8F3]
                    transition-all
                    duration-150
                  "
                >
                  Upload your resume →
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>

      <Footer />

      {/* Template Preview Modal */}
      {previewIndex !== null && (
        <TemplatePreviewModal
          isOpen
          onClose={() => setPreviewIndex(null)}
          selectedIndex={previewIndex}
          onNavigate={setPreviewIndex}
        />
      )}
    </div>
  );
}
