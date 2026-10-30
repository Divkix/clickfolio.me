import { Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";
import { AccountDeletedNotice } from "@/components/home/AccountDeletedNotice";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { PROFESSIONS } from "@/lib/config/professions";
import { DEMO_PROFILES } from "@/lib/templates/demo-profiles";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { HandlePreview } from "./HandlePreview";
import { UploadCTA } from "./UploadCTA";
import { THEME_COUNT, ThemeMarquee } from "./ThemeMarquee";

const themes = DEMO_PROFILES.map((profile) => ({
  id: profile.id,
  name: THEME_METADATA[profile.id].name,
  preview: THEME_METADATA[profile.id].preview,
  person: profile.name,
  handle: profile.name.toLowerCase().replace(/[^a-z]/g, ""),
}));

const facts = [
  { title: "Free", body: "No trial, no paid tier, no watermark." },
  { title: "Open source", body: "Every line that touches your résumé is on GitHub." },
  {
    title: "Private by default",
    body: "Phone and street address stay hidden until you show them.",
  },
  { title: "Yours to delete", body: "Remove your account and every file from Settings." },
];

export function HomeLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        <AccountDeletedNotice />
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 right-0 h-[560px] w-[760px] rounded-full bg-brand/10 blur-3xl"
          />
          <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-x-16 gap-y-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
            <div>
              <h1 className="text-5xl leading-[0.98] font-semibold sm:text-6xl xl:text-7xl">
                Your résumé, live on the web in 30 seconds.
              </h1>
              <div id="upload-card" className="relative mt-10 inline-flex rounded-full p-[2px]">
                <div aria-hidden="true" className="landing-glow absolute inset-0 rounded-full" />
                <UploadCTA
                  location="hero"
                  className="relative inline-flex h-14 items-center rounded-full bg-brand px-8 text-lg font-semibold text-brand-foreground transition hover:bg-brand-hover"
                >
                  Upload your résumé
                </UploadCTA>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Free. No account needed.</p>
            </div>

            <HandlePreview themes={themes} />
          </div>
        </section>

        <section className="border-y border-border bg-[#15171a] text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[auto_1fr] md:items-center md:gap-16 lg:px-8">
            <p className="text-8xl font-semibold tracking-tighter text-[#9aa6ff]">~7s</p>
            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">
                A PDF gets seven seconds. A link gets clicked, bookmarked and forwarded.
              </h2>
              <p className="mt-3 text-white/60">
                Average first-pass résumé skim, from the Ladders eye-tracking study. Put your link
                in your email signature, LinkedIn and every application; it is always your latest
                version.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-20 lg:pt-28">
          <div className="mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-semibold sm:text-5xl">
              {THEME_COUNT} designs. Switch in one click, any time.
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Same résumé, {THEME_COUNT} personalities. All of them work on phones.
            </p>
          </div>
          <ThemeMarquee />
        </section>

        <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <li key={fact.title} className="border-t border-foreground pt-4">
                <h2 className="text-xl font-semibold">{fact.title}</h2>
                <p className="mt-1 text-muted-foreground">{fact.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-2 text-muted-foreground">Built for</span>
            {PROFESSIONS.map((role) => (
              <Link
                key={role.slug}
                to={`/for/${role.slug}`}
                className="rounded-full border border-border px-3 py-1.5 font-medium transition-colors hover:border-brand hover:text-brand"
              >
                {role.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold">Questions people ask first</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {FAQ_ITEMS.slice(0, 6).map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="text-xl text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center text-brand-foreground sm:py-20">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.25),transparent_50%)]"
            />
            <h2 className="relative text-4xl font-semibold sm:text-6xl">
              Still reading? You could be live by now.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-brand-foreground/80">
              One PDF. Thirty seconds. A link you will use for years.
            </p>
            <UploadCTA
              location="footer_cta"
              className="relative mt-8 inline-flex h-13 items-center rounded-full bg-white px-8 text-lg font-semibold text-[#15171a] shadow-lg transition hover:scale-[1.03] motion-reduce:hover:scale-100"
            >
              Upload my résumé
            </UploadCTA>
            <div className="relative mt-4 flex justify-center gap-2 text-sm">
              <Link
                to="/explore"
                className="inline-flex min-h-11 items-center px-3 text-brand-foreground/85 underline underline-offset-4 hover:text-brand-foreground"
              >
                Browse real portfolios
              </Link>
              <Link
                to="/blog"
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
