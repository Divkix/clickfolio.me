// PROTOTYPE (throwaway) — variant A "Credential". Security-print / official-document
// language (navy ink, guilloche) carrying drop_first's conversion mechanics:
// dropzone as the hero with the spinning glow ring, PDF→site proof, theme
// marquee, repeat CTA band and the mobile sticky upload bar.

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { PROFESSIONS } from "@/lib/config/professions";
import { THEME_COUNT, ThemeMarquee } from "./ThemeMarquee";
import { PdfToSite } from "./PdfToSite";
import { ProtoUploadButton } from "./ProtoUploadButton";

const THEME_CSS = `
.proto-a {
  --background: #f4f6f8; --foreground: #13233a; --surface-2: #e9edf1;
  --card: #ffffff; --card-foreground: #13233a; --popover: #ffffff; --popover-foreground: #13233a;
  --muted: #e9edf1; --muted-foreground: #556275; --secondary: #e9edf1; --secondary-foreground: #13233a;
  --brand: #1d3a5f; --brand-hover: #173150; --brand-active: #122741; --brand-subtle: #e3eaf2; --brand-foreground: #ffffff;
  --primary: #1d3a5f; --primary-foreground: #ffffff; --accent: #e3eaf2; --accent-foreground: #1d3a5f;
  --success: #1f6a5e; --border: #d7dee6; --border-strong: #b9c4d0; --input: #b9c4d0; --ring: #1f6a5e;
  --chart-2: #c9a55a;
  --radius: 0.375rem;
  font-family: 'Public Sans', ui-sans-serif, system-ui, sans-serif;
  color: var(--foreground); background: var(--background);
}
.proto-a :is(h1, h2, h3) { font-family: 'Newsreader', Georgia, serif; font-optical-sizing: auto; font-weight: 500; letter-spacing: -0.01em; }
/* Glow ring in foil colours: teal into gold, like the strip on a banknote. */
.proto-a .landing-glow { background: conic-gradient(from var(--landing-glow-angle), transparent 0 55%, #5fb3a3 70%, #c9a55a 85%, transparent 100%); }
`;

// Deterministic guilloche: rotated ellipses, like the fine-line pattern on banknotes.
const GUILLOCHE = Array.from({ length: 36 }, (_, i) => i * 5);

const steps = [
  {
    title: "Upload without an account",
    body: "Your PDF goes to temporary storage. If you never sign in, it is deleted automatically after 24 hours.",
  },
  {
    title: "Sign in to claim it",
    body: "Only once you sign in is the file attached to you. Nobody else can claim it.",
  },
  {
    title: "Review the draft",
    body: "AI reads the PDF and fills in your site. Every field is editable before and after you publish.",
  },
  {
    title: "Publish your link",
    body: "Your site goes live at clickfolio.me/@yourname. Unpublish or delete it whenever you like.",
  },
];

const defaults = [
  { field: "Name, headline, experience, education", visibility: "Shown" },
  { field: "Phone number", visibility: "Hidden until you turn it on" },
  { field: "Full street address", visibility: "Hidden until you turn it on" },
  { field: "Search engine indexing", visibility: "On, one switch turns it off" },
  { field: "Listing in the Explore directory", visibility: "On, one switch turns it off" },
];

export function CredentialLanding() {
  return (
    <div className="proto-a flex min-h-screen flex-col">
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Public+Sans:wght@400..700&display=swap" />
      <style>{THEME_CSS}</style>
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        <section className="relative overflow-hidden bg-[#13233a] text-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 800 800"
            className="pointer-events-none absolute top-1/2 -right-40 size-[900px] -translate-y-1/2 opacity-[0.14]"
          >
            {GUILLOCHE.map((angle) => (
              <ellipse
                key={angle}
                cx="400"
                cy="400"
                rx="380"
                ry="140"
                fill="none"
                stroke="#9fd3c7"
                strokeWidth="0.8"
                transform={`rotate(${angle} 400 400)`}
              />
            ))}
          </svg>

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:px-8 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#5fb3a3] opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#5fb3a3]" />
                </span>
                Free forever, no sign-up to start
              </p>
              <h1 className="mt-6 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">
                Your résumé, live as a website in 30 seconds.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
                Drop the PDF you already have. You get clickfolio.me/@yourname to put on every
                application, and you decide exactly what is public.
              </p>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-6 text-sm">
                <div>
                  <dt className="text-white/55">Cost</dt>
                  <dd className="mt-1 font-semibold">Free, no paid plan</dd>
                </div>
                <div>
                  <dt className="text-white/55">Source code</dt>
                  <dd className="mt-1 font-semibold">Public on GitHub</dd>
                </div>
                <div>
                  <dt className="text-white/55">Unclaimed files</dt>
                  <dd className="mt-1 font-semibold">Deleted in 24 hours</dd>
                </div>
              </dl>
            </div>

            <div id="upload-card" className="relative rounded-lg p-[2px]">
              <div aria-hidden="true" className="landing-glow absolute inset-0 rounded-lg" />
              <div className="relative rounded-[calc(0.5rem-2px)] bg-card p-5 text-foreground shadow-2xl sm:p-7">
                <FileDropzone />
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="mx-auto max-w-2xl text-center text-4xl sm:text-5xl">
              From a PDF nobody opens to a link everybody clicks.
            </h2>
            <div className="mt-14">
              <PdfToSite />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <h2 className="max-w-xl text-4xl">What happens to your file</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t-2 border-brand pt-5">
                <span className="font-['Newsreader'] text-3xl text-brand">{i + 1}</span>
                <h3 className="mt-2 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
            <div>
              <h2 className="text-4xl">You decide what is public</h2>
              <p className="mt-4 max-w-sm leading-relaxed text-muted-foreground">
                These are the settings every new site starts with. Change any of them from your
                dashboard.
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-success">
                <ShieldCheck className="size-4" /> Your résumé is never sold or shared.
              </p>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-strong text-muted-foreground">
                  <th className="py-3 font-medium">On your site</th>
                  <th className="py-3 font-medium">Default</th>
                </tr>
              </thead>
              <tbody>
                {defaults.map((row) => (
                  <tr key={row.field} className="border-b border-border">
                    <td className="py-4 pr-4 font-medium">{row.field}</td>
                    <td className="py-4 text-muted-foreground">{row.visibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="py-20 lg:py-28">
          <div className="mx-auto mb-10 max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl">{THEME_COUNT} designs. Switch in one click, any time.</h2>
            <p className="mt-3 text-muted-foreground">
              Same résumé, {THEME_COUNT} personalities. All of them work on phones.
            </p>
          </div>
          <ThemeMarquee />
          <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center gap-2 px-4 text-sm sm:px-6 lg:px-8">
            <span className="mr-2 text-muted-foreground">Built for</span>
            {PROFESSIONS.map((role) => (
              <Link
                key={role.slug}
                href={`/for/${role.slug}`}
                className="rounded-full border border-border-strong px-3 py-1.5 font-medium transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground"
              >
                {role.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#13233a] text-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 800 800"
            className="pointer-events-none absolute -bottom-96 -left-40 size-[800px] opacity-[0.1]"
          >
            {GUILLOCHE.map((angle) => (
              <ellipse
                key={angle}
                cx="400"
                cy="400"
                rx="380"
                ry="140"
                fill="none"
                stroke="#c9a55a"
                strokeWidth="0.8"
                transform={`rotate(${angle} 400 400)`}
              />
            ))}
          </svg>
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <h2 className="text-4xl sm:text-6xl">Still reading? You could be live by now.</h2>
            <p className="mx-auto mt-4 max-w-md text-white/70">
              One PDF. Thirty seconds. A link you will use for years.
            </p>
            <ProtoUploadButton className="mt-10 inline-flex h-13 items-center rounded-md bg-white px-8 text-lg font-semibold text-[#13233a] shadow-lg transition hover:scale-[1.03] motion-reduce:hover:scale-100">
              Upload my résumé
            </ProtoUploadButton>
            <div className="mt-5 flex justify-center gap-2 text-sm">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center px-3 text-white/75 underline underline-offset-4 hover:text-white"
              >
                Browse published sites
              </Link>
              <a
                href="https://github.com/divkix/clickfolio.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center px-3 text-white/75 underline underline-offset-4 hover:text-white"
              >
                Read the code on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyUpload />
    </div>
  );
}
