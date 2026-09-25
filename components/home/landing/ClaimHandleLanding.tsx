// Landing variant `claim_handle` (ADR-0027): dark, type-led hero whose primary
// affordance is typing your @handle; the typed handle is carried into the wizard.

import { ArrowRight, BarChart3, Eye, EyeOff, Link2, Smartphone } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { FAQSection } from "@/components/home/FAQSection";
import { LinkedInExportHelp } from "@/components/LinkedInExportHelp";
import { SiteHeader } from "@/components/SiteHeader";
import { PROFESSIONS } from "@/lib/config/professions";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { HandleClaim } from "./HandleClaim";
import { LandingExperimentTracker } from "./LandingExperimentTracker";
import { UploadCTA } from "./UploadCTA";

const VARIANT = "claim_handle";

const collage = DEMO_PROFILES.slice(0, 6);

const tileClass = "rounded-3xl border border-white/10 bg-white/[0.03] p-6";

function ToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-white/80">
        {on ? <Eye className="size-4" /> : <EyeOff className="size-4 text-white/40" />} {label}
      </span>
      <span
        className={`flex h-5 w-9 items-center rounded-full p-0.5 ${on ? "justify-end bg-success" : "justify-start bg-white/20"}`}
      >
        <span className="size-4 rounded-full bg-white" />
      </span>
    </div>
  );
}

export function ClaimHandleLanding() {
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <LandingExperimentTracker variant={VARIANT} />
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_75%)]"
          />
          <div
            aria-hidden="true"
            className="absolute -top-48 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand/30 blur-[120px]"
          />
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-20 pb-24 text-center sm:px-6 lg:pt-28">
            <p className="animate-fade-in-up rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/70">
              Free · Open source · Live in ~30s
            </p>
            <h1 className="animate-fade-in-up mt-8 font-display font-extrabold text-white">
              <span className="block text-base font-semibold tracking-normal text-brand sm:text-lg">
                Free resume website builder
              </span>
              <span className="mt-4 block text-5xl leading-[0.95] tracking-tighter sm:text-7xl lg:text-8xl">
                Stop attaching.
                <br />
                <span className="bg-gradient-to-r from-brand via-chart-2 to-chart-5 bg-clip-text text-transparent">
                  Start linking.
                </span>
              </span>
            </h1>
            <p className="animate-fade-in-up mt-7 max-w-xl text-lg text-white/60">
              Your resume becomes a portfolio website at a URL that’s yours. Pick the handle now —
              we’ll build the site from your PDF.
            </p>
            <div className="animate-fade-in-up mt-10 flex w-full justify-center">
              <HandleClaim variant={VARIANT} />
            </div>
            {/* Same LinkedIn entry point drop_first shows in its hero dropzone (ADR-0027 parity). */}
            <LinkedInExportHelp />
          </div>

          <div className="relative mx-auto -mb-24 h-64 max-w-6xl px-4 sm:h-80" aria-hidden="true">
            {collage.map((profile, index) => {
              const offset = index - (collage.length - 1) / 2;

              return (
                <img
                  key={profile.id}
                  src={THEME_METADATA[profile.id].preview}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute top-0 left-1/2 w-56 rounded-xl border border-white/10 shadow-2xl sm:w-80"
                  style={{
                    transform: `translateX(calc(-50% + ${offset * 70}%)) translateY(${Math.abs(offset) * 22}px) rotate(${offset * 5}deg)`,
                    zIndex: 10 - Math.abs(Math.round(offset * 2)),
                  }}
                />
              );
            })}
          </div>
        </section>

        <section className="relative z-10 border-y border-white/10 bg-background pt-40 pb-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <p className="font-display text-8xl font-extrabold tracking-tighter text-brand">
                ~7s
              </p>
              <p className="mt-2 text-sm text-white/50">
                average first-pass resume skim (Ladders eye-tracking study)
              </p>
            </div>
            <div className="flex flex-col justify-center md:col-span-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                A PDF gets seven seconds. A link gets clicked, bookmarked, and forwarded.
              </h2>
              <p className="mt-4 text-white/60">
                Put <span className="font-mono text-white">clickfolio.me/@you</span> in your email
                signature, LinkedIn, GitHub and every application. It’s always your latest version —
                no more <span className="font-mono">resume_final_v7.pdf</span>.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything a PDF can’t do.
          </h2>
          <div className="mt-10 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
            <div
              className={`group relative overflow-hidden md:col-span-4 md:row-span-2 ${tileClass}`}
            >
              <h3 className="font-display text-xl font-bold text-white">
                {DEMO_PROFILES.length} themes, one click apart
              </h3>
              <p className="mt-1 max-w-sm text-sm text-white/55">
                From ATS-clean to terminal-hacker. Switch anytime, your content stays.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {collage.map((profile) => (
                  <img
                    key={profile.id}
                    src={THEME_METADATA[profile.id].preview}
                    alt={`${THEME_METADATA[profile.id].name} theme`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-4/3 w-full rounded-lg border border-white/10 object-cover object-top transition duration-500 group-hover:scale-[1.02] motion-reduce:group-hover:scale-100"
                  />
                ))}
              </div>
            </div>
            <div className={`md:col-span-2 ${tileClass}`}>
              <Link2 className="size-6 text-brand" />
              <h3 className="mt-4 font-display text-lg font-bold text-white">Your own URL</h3>
              <p className="mt-1 font-mono text-sm text-white/55">clickfolio.me/@you</p>
            </div>
            <div className={`md:col-span-2 ${tileClass}`}>
              <h3 className="font-display text-lg font-bold text-white">Private by default</h3>
              <div className="mt-4 space-y-2" aria-hidden="true">
                <ToggleRow label="Email" on />
                <ToggleRow label="Phone" on={false} />
                <ToggleRow label="Address" on={false} />
              </div>
            </div>
            <div className={`md:col-span-3 ${tileClass}`}>
              <BarChart3 className="size-6 text-chart-2" />
              <h3 className="mt-4 font-display text-lg font-bold text-white">See who’s looking</h3>
              <p className="mt-1 text-sm text-white/55">
                Built-in visitor analytics show how many people view your page.
              </p>
            </div>
            <div className={`md:col-span-3 ${tileClass}`}>
              <Smartphone className="size-6 text-chart-3" />
              <h3 className="mt-4 font-display text-lg font-bold text-white">Perfect on phones</h3>
              <p className="mt-1 text-sm text-white/55">
                Recruiters read on the go. Every theme is responsive and loads fast.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-2 text-sm text-white/50">
            <span className="mr-2">Made for</span>
            {PROFESSIONS.map((role) => (
              <Link
                key={role.slug}
                href={`/for/${role.slug}`}
                className="rounded-full border border-white/15 px-3 py-1 text-white/75 transition-colors hover:border-brand hover:text-white"
              >
                {role.label}
              </Link>
            ))}
          </div>

          <div className="mx-auto max-w-4xl">
            <FAQSection />
          </div>
        </section>

        <section className="relative isolate overflow-hidden border-t border-white/10 py-24">
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 translate-y-1/2 rounded-full bg-brand/30 blur-[120px]"
          />
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
            <h2 className="font-display text-4xl font-extrabold tracking-tighter text-white sm:text-6xl">
              Your name. Your link.
              <br />
              Thirty seconds.
            </h2>
            <UploadCTA
              variant={VARIANT}
              location="footer_cta"
              className="mt-10 inline-flex h-14 items-center gap-2 rounded-full bg-white px-8 text-lg font-semibold text-black transition hover:scale-[1.03] motion-reduce:hover:scale-100"
            >
              Upload resume &amp; claim handle <ArrowRight className="size-5" />
            </UploadCTA>
            <p className="mt-4 text-sm text-white/45">
              Free forever. No credit card. No sign-up to upload.
            </p>
            <div className="mt-2 flex gap-2 text-sm">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center px-3 text-white/60 underline underline-offset-4 hover:text-white"
              >
                Browse real portfolios
              </Link>
              <Link
                href="/blog"
                className="inline-flex min-h-11 items-center px-3 text-white/60 underline underline-offset-4 hover:text-white"
              >
                Read our guides
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
