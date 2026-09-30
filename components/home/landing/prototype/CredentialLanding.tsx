// PROTOTYPE (throwaway) — variant A "Credential". Security-print / official-document
// language: navy ink band with a guilloche pattern, split hero with the real
// dropzone, then the upload lifecycle and privacy defaults stated as plain facts.

import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const THEME_CSS = `
.proto-a {
  --background: #f4f6f8; --foreground: #13233a; --surface-2: #e9edf1;
  --card: #ffffff; --card-foreground: #13233a; --popover: #ffffff; --popover-foreground: #13233a;
  --muted: #e9edf1; --muted-foreground: #556275; --secondary: #e9edf1; --secondary-foreground: #13233a;
  --brand: #1d3a5f; --brand-hover: #173150; --brand-active: #122741; --brand-subtle: #e3eaf2; --brand-foreground: #ffffff;
  --primary: #1d3a5f; --primary-foreground: #ffffff; --accent: #e3eaf2; --accent-foreground: #1d3a5f;
  --success: #1f6a5e; --border: #d7dee6; --border-strong: #b9c4d0; --input: #b9c4d0; --ring: #1f6a5e;
  --radius: 0.375rem;
  font-family: 'Public Sans', ui-sans-serif, system-ui, sans-serif;
  color: var(--foreground); background: var(--background);
}
.proto-a :is(h1, h2, h3) { font-family: 'Newsreader', Georgia, serif; font-optical-sizing: auto; font-weight: 500; letter-spacing: -0.01em; }
`;

// Deterministic guilloche: rotated ellipses, like the fine-line pattern on banknotes.
const GUILLOCHE = Array.from({ length: 36 }, (_, i) => i * 5);

const themes = DEMO_PROFILES.slice(0, 6).map((profile) => ({
  ...THEME_METADATA[profile.id],
  person: profile.name,
  role: profile.role,
}));

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

      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden bg-[#13233a] text-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 800 800"
            className="pointer-events-none absolute top-1/2 -right-40 size-[900px] -translate-y-1/2 opacity-[0.12]"
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

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <h1 className="text-5xl leading-[1.05] sm:text-6xl">
                Your résumé, published as a website you control.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
                Upload the PDF you already have. We turn it into a clean personal site at
                clickfolio.me/@yourname. Free, open source, and private by default.
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

            <div id="upload" className="rounded-lg bg-card p-5 text-foreground shadow-2xl sm:p-7">
              <p className="mb-4 text-sm text-muted-foreground">
                PDF only. No account needed to upload.
              </p>
              <FileDropzone />
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

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl">Pick a design after you upload</h2>
            <Link
              href="/explore"
              className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              See published sites
            </Link>
          </div>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <li key={theme.name}>
                <img
                  src={theme.preview}
                  alt={`${theme.name} design`}
                  loading="lazy"
                  decoding="async"
                  className="aspect-16/10 w-full rounded-md border border-border object-cover object-top"
                />
                <p className="mt-3 font-semibold">{theme.name}</p>
                <p className="text-sm text-muted-foreground">{theme.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-[#13233a] text-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="max-w-xl">
              <h2 className="text-3xl">Read the code that handles your résumé</h2>
              <p className="mt-3 text-white/70">
                clickfolio.me is open source. Upload handling, parsing and privacy settings are all
                in the public repository.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/divkix/clickfolio.me"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/30 px-5 font-semibold hover:bg-white/10"
              >
                View on GitHub
              </a>
              <a
                href="#upload"
                className="inline-flex h-11 items-center rounded-md bg-white px-5 font-semibold text-[#13233a] hover:bg-white/90"
              >
                Upload your résumé
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
