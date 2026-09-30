"use client";

// PROTOTYPE (throwaway) — variant B "Studio". Show the product, not the promise:
// the hero is a live viewer of the real theme screenshots, headline is secondary.
// White + ultramarine, one grotesk family, no card grid.

import { useState } from "react";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const THEME_CSS = `
.proto-b {
  --background: #ffffff; --foreground: #15171a; --surface-2: #f3f4f6;
  --card: #ffffff; --card-foreground: #15171a; --popover: #ffffff; --popover-foreground: #15171a;
  --muted: #f3f4f6; --muted-foreground: #5f646d; --secondary: #f3f4f6; --secondary-foreground: #15171a;
  --brand: #2a3fd1; --brand-hover: #2234b5; --brand-active: #1b2a93; --brand-subtle: #eceffd; --brand-foreground: #ffffff;
  --primary: #2a3fd1; --primary-foreground: #ffffff; --accent: #eceffd; --accent-foreground: #2a3fd1;
  --success: #1b7f5a; --border: #e5e7eb; --border-strong: #d1d5db; --input: #d1d5db; --ring: #2a3fd1;
  --radius: 0.75rem;
  font-family: 'Onest', ui-sans-serif, system-ui, sans-serif;
  color: var(--foreground); background: var(--background);
}
.proto-b :is(h1, h2, h3) { font-family: 'Onest', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.035em; }
`;

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

export function StudioLanding() {
  const [selected, setSelected] = useState(themes[0]);

  return (
    <div className="proto-b flex min-h-screen flex-col">
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Onest:wght@400..800&display=swap" />
      <style>{THEME_CSS}</style>
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <h1 className="text-5xl leading-[0.98] font-semibold sm:text-7xl">
              Your résumé, as a website people actually open.
            </h1>
            <div className="lg:pb-2">
              <p className="text-lg text-muted-foreground">
                Upload a PDF, choose one of {themes.length} designs, and share
                clickfolio.me/@yourname. It takes about a minute.
              </p>
              <a
                href="#upload"
                className="mt-6 inline-flex h-12 items-center rounded-full bg-brand px-6 font-semibold text-brand-foreground hover:bg-brand-hover"
              >
                Upload your résumé
              </a>
            </div>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[15rem_1fr]">
            <div className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
              {themes.map((theme) => {
                const active = theme.id === selected.id;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(theme)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <span className="block font-semibold">{theme.name}</span>
                    <span
                      className={`hidden text-xs lg:block ${active ? "text-background/70" : ""}`}
                    >
                      {theme.person}, {theme.role}
                    </span>
                  </button>
                );
              })}
            </div>

            <figure className="overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-[0_30px_80px_-30px_rgba(21,23,26,0.35)]">
              <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-border-strong" />
                  <span className="size-2.5 rounded-full bg-border-strong" />
                  <span className="size-2.5 rounded-full bg-border-strong" />
                </span>
                <span className="flex-1 truncate rounded-md bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
                  clickfolio.me/<span className="text-foreground">@{selected.handle}</span>
                </span>
              </div>
              <img
                key={selected.id}
                src={selected.preview}
                alt={`${selected.person}'s site in the ${selected.name} design`}
                className="aspect-16/10 w-full object-cover object-top"
              />
              <figcaption className="border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                {selected.description}
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((fact) => (
              <li key={fact.title} className="border-t border-foreground pt-4">
                <h2 className="text-xl font-semibold">{fact.title}</h2>
                <p className="mt-1 text-muted-foreground">{fact.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="upload" className="mx-auto mt-28 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 rounded-3xl bg-brand-subtle p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:p-14">
            <div>
              <h2 className="text-4xl font-semibold sm:text-5xl">
                Start with the PDF you already have.
              </h2>
              <p className="mt-4 max-w-md text-lg text-muted-foreground">
                No account needed to upload. You sign in only to claim and publish, and you can edit
                every field the AI fills in.
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm sm:p-6">
              <FileDropzone />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-28 mb-24 max-w-3xl px-4 sm:px-6">
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
      </main>

      <Footer />
    </div>
  );
}
