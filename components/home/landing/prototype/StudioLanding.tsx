"use client";

// PROTOTYPE (throwaway) — variant B "Studio". White + ultramarine, one grotesk.
// Merges both A/B arms: drop_first's glowing dropzone sits in the first
// viewport (it won uploads, 36% vs 22%), next to a live browser frame whose URL
// bar is claim_handle's handle input (37% of viewers engaged with it). The
// frame auto-cycles designs until the visitor touches it.

import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { PROFESSIONS } from "@/lib/config/professions";
import { saveDesiredHandle } from "@/lib/experiments/desired-handle";
import { handleSchema } from "@/lib/schemas/profile";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { ProtoUploadButton } from "./ProtoUploadButton";
import { THEME_COUNT, ThemeMarquee } from "./ThemeMarquee";

const THEME_CSS = `
.proto-b {
  --background: #ffffff; --foreground: #15171a; --surface-2: #f3f4f6;
  --card: #ffffff; --card-foreground: #15171a; --popover: #ffffff; --popover-foreground: #15171a;
  --muted: #f3f4f6; --muted-foreground: #5f646d; --secondary: #f3f4f6; --secondary-foreground: #15171a;
  --brand: #2a3fd1; --brand-hover: #2234b5; --brand-active: #1b2a93; --brand-subtle: #eceffd; --brand-foreground: #ffffff;
  --primary: #2a3fd1; --primary-foreground: #ffffff; --accent: #eceffd; --accent-foreground: #2a3fd1;
  --success: #1b7f5a; --border: #e5e7eb; --border-strong: #d1d5db; --input: #d1d5db; --ring: #2a3fd1;
  --chart-2: #7c8cff;
  --radius: 0.75rem;
  font-family: 'Onest', ui-sans-serif, system-ui, sans-serif;
  color: var(--foreground); background: var(--background);
}
.proto-b :is(h1, h2, h3) { font-family: 'Onest', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.035em; }
.dark .proto-b {
  --background: #0e0f14; --foreground: #eceef3; --surface-2: #181a22;
  --card: #14161d; --card-foreground: #eceef3; --popover: #14161d; --popover-foreground: #eceef3;
  --muted: #181a22; --muted-foreground: #9aa0ac; --secondary: #181a22; --secondary-foreground: #eceef3;
  --brand: #7c8cff; --brand-hover: #93a0ff; --brand-active: #6a7af0; --brand-subtle: #1b1f3d; --brand-foreground: #0e0f14;
  --primary: #7c8cff; --primary-foreground: #0e0f14; --accent: #1b1f3d; --accent-foreground: #7c8cff;
  --success: #4cc38a; --border: #262935; --border-strong: #343846; --input: #343846; --ring: #7c8cff;
  --chart-2: #b3bcff;
}
`;

const CYCLE_MS = 3200;

const themes = DEMO_PROFILES.map((profile) => ({
  id: profile.id,
  ...THEME_METADATA[profile.id],
  person: profile.name,
  role: profile.role,
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

type HandleStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "unknown";

function useHandleStatus(handle: string): HandleStatus {
  const [checked, setChecked] = useState<{ handle: string; status: HandleStatus } | null>(null);
  const valid = handle !== "" && handleSchema.safeParse(handle).success;

  useEffect(() => {
    if (!valid) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      let status: HandleStatus = "unknown";

      try {
        const response = await fetch(`/api/handle/check?handle=${encodeURIComponent(handle)}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          // SAFETY: 2xx bodies from /api/handle/check are `{available, reason?}` (see its route).
          const data = (await response.json()) as { available: boolean };
          status = data.available ? "available" : "taken";
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      setChecked({ handle, status });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [handle, valid]);

  if (!handle) return "idle";

  if (!valid) return "invalid";

  return checked?.handle === handle ? checked.status : "checking";
}

export function StudioLanding() {
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [handle, setHandle] = useState("");
  const status = useHandleStatus(handle);
  const selected = themes[index];

  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % themes.length),
      CYCLE_MS,
    );

    return () => window.clearInterval(timer);
  }, [touched]);

  return (
    <div className="proto-b flex min-h-screen flex-col">
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Onest:wght@400..800&display=swap" />
      <style>{THEME_CSS}</style>
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
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
                <ProtoUploadButton className="relative inline-flex h-14 items-center rounded-full bg-brand px-8 text-lg font-semibold text-brand-foreground transition hover:bg-brand-hover">
                  Upload your résumé
                </ProtoUploadButton>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Free. No account needed.</p>
            </div>

            <div onPointerEnter={() => setTouched(true)} onFocusCapture={() => setTouched(true)}>
              <figure className="overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-[0_40px_90px_-35px_rgba(42,63,209,0.45)]">
                <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-border-strong" />
                    <span className="size-2.5 rounded-full bg-border-strong" />
                    <span className="size-2.5 rounded-full bg-border-strong" />
                  </span>
                  <label className="flex min-w-0 flex-1 items-center rounded-md bg-surface-2 px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand">
                    <span className="text-muted-foreground">clickfolio.me/@</span>
                    <input
                      value={handle}
                      onChange={(event) =>
                        setHandle(event.target.value.toLowerCase().replace(/\s/g, ""))
                      }
                      placeholder={selected.handle}
                      aria-label="Try your handle"
                      aria-describedby="studio-handle-status"
                      maxLength={30}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="w-full min-w-0 bg-transparent font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
                    />
                    <span aria-hidden="true">
                      {status === "checking" && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                      {status === "available" && <Check className="size-4 text-success" />}
                      {(status === "taken" || status === "invalid") && (
                        <X className="size-4 text-destructive" />
                      )}
                    </span>
                  </label>
                </div>
                <img
                  key={selected.id}
                  src={selected.preview}
                  alt={`${selected.person}'s site in the ${selected.name} design`}
                  className="animate-fade-in-up aspect-16/10 w-full object-cover object-top"
                />
              </figure>

              <div className="mt-4 flex min-h-6 items-center justify-between gap-4 text-sm">
                <p id="studio-handle-status" aria-live="polite">
                  {status === "checking" && (
                    <span className="text-muted-foreground">Checking…</span>
                  )}
                  {status === "available" && (
                    <span className="font-medium text-success">
                      @{handle} is free.{" "}
                      <ProtoUploadButton
                        onBeforeOpen={() => saveDesiredHandle(handle)}
                        className="font-semibold text-brand underline underline-offset-4"
                      >
                        Claim it
                      </ProtoUploadButton>
                    </span>
                  )}
                  {status === "taken" && (
                    <span className="text-destructive">Already taken. Try another.</span>
                  )}
                  {status === "invalid" && (
                    <span className="text-destructive">
                      {handleSchema.safeParse(handle).error?.issues[0]?.message}
                    </span>
                  )}
                  {status === "unknown" && (
                    <span className="text-muted-foreground">You’ll confirm it after upload.</span>
                  )}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  {themes.map((theme, i) => (
                    <button
                      key={theme.id}
                      type="button"
                      aria-label={`Show the ${theme.name} design`}
                      aria-pressed={i === index}
                      onClick={() => {
                        setTouched(true);
                        setIndex(i);
                      }}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index
                          ? "w-5 bg-foreground"
                          : "w-1.5 bg-border-strong hover:bg-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
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
                href={`/for/${role.slug}`}
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
            <ProtoUploadButton className="relative mt-8 inline-flex h-13 items-center rounded-full bg-white px-8 text-lg font-semibold text-[#15171a] shadow-lg transition hover:scale-[1.03] motion-reduce:hover:scale-100">
              Upload my résumé
            </ProtoUploadButton>
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
