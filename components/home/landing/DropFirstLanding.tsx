// Landing variant `drop_first` (ADR-0027): the dropzone is the hero — one job
// per screen, before→after proof, template marquee, objection answers, repeat CTA.

import { ArrowRight, FileText, Lock, Palette, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { FAQSection } from "@/components/home/FAQSection";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { PROFESSIONS } from "@/lib/config/professions";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { LandingExperimentTracker } from "./LandingExperimentTracker";
import { UploadCTA } from "./UploadCTA";

const VARIANT = "drop_first";

const previews = DEMO_PROFILES.map((profile) => ({
  src: THEME_METADATA[profile.id].preview,
  theme: THEME_METADATA[profile.id].name,
  name: profile.name,
}));

const objections = [
  {
    icon: Sparkles,
    question: "“What’s the catch?”",
    answer: "None. It’s free forever and open source. No trial, no watermark upsell.",
  },
  {
    icon: Lock,
    question: "“Is my info public?”",
    answer: "Phone and address are hidden by default. Hide from search with one toggle.",
  },
  {
    icon: Palette,
    question: "“What if the AI gets it wrong?”",
    answer: "Edit every field before and after publishing. Changes save automatically.",
  },
];

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      {[false, true].map((duplicate) => (
        <ul
          key={String(duplicate)}
          aria-hidden={duplicate || undefined}
          className={`flex shrink-0 gap-5 pr-5 group-hover:[animation-play-state:paused] ${
            reverse ? "animate-landing-marquee-reverse" : "animate-landing-marquee"
          }`}
        >
          {previews.map((item) => (
            <li
              key={item.src}
              className="w-64 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:w-80"
            >
              <img
                src={item.src}
                alt={duplicate ? "" : `${item.theme} theme example`}
                loading="lazy"
                decoding="async"
                className="aspect-16/10 w-full object-cover object-top"
              />
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
                <span className="font-medium">{item.theme}</span>
                <span className="text-muted-foreground">{item.name}</span>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function DropFirstLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingExperimentTracker variant={VARIANT} />
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[500px] max-w-4xl rounded-full bg-brand/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-3xl px-4 pt-14 pb-10 text-center sm:px-6 lg:pt-20">
            <p className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium shadow-xs">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Free forever · No sign-up to start
            </p>
            <h1 className="animate-fade-in-up mt-6 font-display font-extrabold tracking-tight">
              <span className="block text-base font-semibold tracking-normal text-brand sm:text-lg">
                Free resume website builder
              </span>
              <span className="mt-3 block text-4xl leading-[1.02] sm:text-6xl lg:text-7xl">
                Your resume, live on the web in{" "}
                <span className="whitespace-nowrap text-brand">30 seconds</span>.
              </span>
            </h1>
            <p className="animate-fade-in-up mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Drop your PDF. AI builds your portfolio. You get{" "}
              <span className="font-mono text-foreground">clickfolio.me/@you</span> to put on every
              application.
            </p>
          </div>

          <div className="relative mx-auto max-w-2xl px-4 pb-6 sm:px-6">
            <div id="upload-card" className="relative rounded-2xl p-[2px]">
              <div aria-hidden="true" className="landing-glow absolute inset-0 rounded-2xl" />
              <div className="relative rounded-[calc(1rem-2px)] bg-card p-4 shadow-xl sm:p-6">
                <FileDropzone />
              </div>
            </div>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-success" /> No credit card
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="size-4 text-success" /> Phone &amp; address hidden by default
              </li>
              <li className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-success" /> Open source
              </li>
            </ul>
          </div>

          <div className="mx-auto mt-6 flex max-w-2xl items-center justify-center gap-3 px-4 pb-16">
            <div className="flex -space-x-2" aria-hidden="true">
              {DEMO_PROFILES.slice(0, 5).map((profile) => (
                <span
                  key={profile.id}
                  className="flex size-8 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-bold text-brand-active ring-2 ring-background"
                >
                  {profile.initials}
                </span>
              ))}
            </div>
            <p className="text-left text-sm text-muted-foreground">
              Made for engineers, designers, PMs, marketers &amp; students.
            </p>
          </div>
        </section>

        <section className="border-y border-border bg-surface-2/60 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-semibold tracking-widest text-brand uppercase">
              What happens when you drop it
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
              From a PDF nobody opens to a link everybody clicks.
            </h2>

            <div className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_auto_1.6fr]">
              <div
                aria-hidden="true"
                className="mx-auto w-full max-w-xs -rotate-3 rounded-lg border border-border bg-card p-5 shadow-md"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-4" /> sarah_chen_resume_FINAL_v3.pdf
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-foreground/80" />
                  <div className="h-2 w-1/2 rounded bg-muted-foreground/40" />
                  {[92, 70, 85, 64, 97, 76, 88, 61, 80].map((width) => (
                    <div
                      key={width}
                      className="h-1.5 rounded bg-muted-foreground/20"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Attached to email. Downloaded. Forgotten.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2 text-brand" aria-hidden="true">
                <div className="relative h-1 w-24 overflow-hidden rounded-full bg-brand/20 max-lg:rotate-90">
                  <div className="animate-landing-flow absolute inset-y-0 w-1/2 rounded-full bg-brand" />
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold">
                  <Zap className="size-3.5" /> AI parse · ~30s
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
                  <span className="size-2.5 rounded-full bg-red-400" />
                  <span className="size-2.5 rounded-full bg-yellow-400" />
                  <span className="size-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 flex-1 truncate rounded-md bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
                    clickfolio.me/<span className="text-foreground">@sarahchen</span>
                  </span>
                </div>
                <img
                  src="/previews/minimalist.webp"
                  alt="Sarah Chen's portfolio built with the Minimalist Editorial theme"
                  className="aspect-16/10 w-full object-cover object-top"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="examples" className="py-16 lg:py-24">
          <div className="mx-auto mb-10 max-w-3xl px-4 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {previews.length} themes. Switch in one click, any time.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Same resume, {previews.length} personalities. All mobile-ready.
            </p>
          </div>
          <div className="space-y-5">
            <MarqueeRow />
            <MarqueeRow reverse />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {objections.map(({ icon: Icon, question, answer }) => (
              <div key={question} className="bg-card p-8">
                <Icon className="size-5 text-brand" />
                <h3 className="mt-4 font-display text-lg font-bold">{question}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-2 text-muted-foreground">Built for</span>
            {PROFESSIONS.map((role) => (
              <Link
                key={role.slug}
                href={`/for/${role.slug}`}
                className="rounded-full border border-border px-3 py-1.5 font-medium transition-colors hover:border-brand hover:text-brand"
              >
                {role.label}
              </Link>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <FAQSection />
        </div>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center text-brand-foreground">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.25),transparent_50%)]"
            />
            <h2 className="relative font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
              Still reading? You could be live by now.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-brand-foreground/80">
              One PDF. Thirty seconds. A link you’ll use for years.
            </p>
            <UploadCTA
              variant={VARIANT}
              location="footer_cta"
              className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-background px-7 font-semibold text-foreground shadow-lg transition hover:scale-[1.03] motion-reduce:hover:scale-100"
            >
              Upload my resume <ArrowRight className="size-4" />
            </UploadCTA>
            <div className="relative mt-4 flex justify-center gap-2 text-sm">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center px-3 text-brand-foreground/85 underline underline-offset-4 hover:text-brand-foreground"
              >
                Browse real portfolios
              </Link>
              <Link
                href="/blog"
                className="inline-flex min-h-11 items-center px-3 text-brand-foreground/85 underline underline-offset-4 hover:text-brand-foreground"
              >
                Read our guides
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyUpload />
    </div>
  );
}
