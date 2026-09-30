// PROTOTYPE (throwaway) — variant C "Curriculum". The page is typeset like a
// well-made CV: a narrow label column and a content column, section by section.
// Neutral grey paper, oxblood accent, Literata headings over Instrument Sans.

import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";

const THEME_CSS = `
.proto-c {
  --background: #f1f1ef; --foreground: #1e1e22; --surface-2: #e8e8e5;
  --card: #ffffff; --card-foreground: #1e1e22; --popover: #ffffff; --popover-foreground: #1e1e22;
  --muted: #e8e8e5; --muted-foreground: #5e5e66; --secondary: #e8e8e5; --secondary-foreground: #1e1e22;
  --brand: #7a1f2b; --brand-hover: #661a24; --brand-active: #52151d; --brand-subtle: #f4e8e9; --brand-foreground: #ffffff;
  --primary: #7a1f2b; --primary-foreground: #ffffff; --accent: #f4e8e9; --accent-foreground: #7a1f2b;
  --success: #2f6b4f; --border: #dadad6; --border-strong: #c4c4bf; --input: #c4c4bf; --ring: #7a1f2b;
  --radius: 0.25rem;
  font-family: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
  color: var(--foreground); background: var(--background);
}
.proto-c :is(h1, h2, h3) { font-family: 'Literata', Georgia, serif; font-optical-sizing: auto; font-weight: 500; }
`;

const themes = DEMO_PROFILES.map((profile) => ({ id: profile.id, ...THEME_METADATA[profile.id] }));

function Entry({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border-strong py-12 md:grid-cols-[11rem_1fr] md:gap-10">
      <h2 className="text-lg text-brand italic">{label}</h2>
      <div>{children}</div>
    </section>
  );
}

export function CurriculumLanding() {
  return (
    <div className="proto-c flex min-h-screen flex-col">
      <TemplateFontLinks href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400..600;1,7..72,400..500&family=Instrument+Sans:wght@400..700&display=swap" />
      <style>{THEME_CSS}</style>
      <SiteHeader />

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 lg:px-8">
        <header className="grid gap-4 pt-16 pb-12 md:grid-cols-[11rem_1fr] md:gap-10 lg:pt-24">
          <span aria-hidden="true" />
          <div>
            <h1 className="text-5xl leading-[1.08] sm:text-6xl">
              A personal website, made from your résumé.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Upload the PDF you send to employers. clickfolio.me lays it out as a site you can link
              from applications, email signatures and LinkedIn.
            </p>
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-semibold">clickfolio.me/@yourname</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Price</dt>
                <dd className="font-semibold">Free</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Licence</dt>
                <dd className="font-semibold">Open source</dd>
              </div>
            </dl>
          </div>
        </header>

        <Entry label="Begin">
          <div
            id="upload"
            className="max-w-xl rounded border border-border-strong bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.18)] sm:p-7"
          >
            <FileDropzone />
          </div>
        </Entry>

        <Entry label="Result">
          <figure>
            <img
              src="/previews/minimalist.webp"
              alt="Sarah Chen's résumé published in the Minimalist Editorial design"
              loading="lazy"
              decoding="async"
              className="aspect-16/10 w-full rounded border border-border-strong object-cover object-top"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Sarah Chen, Product Designer. Published at clickfolio.me/@sarahchen in the Minimalist
              Editorial design.
            </figcaption>
          </figure>
        </Entry>

        <Entry label="Process">
          <ol className="space-y-6">
            {[
              [
                "Upload",
                "Your PDF is held in temporary storage. Unclaimed files are deleted after 24 hours.",
              ],
              ["Claim", "Sign in and the upload becomes yours. No one else can claim it."],
              [
                "Review",
                "AI drafts every section from the PDF. Correct anything before you publish.",
              ],
              ["Publish", "Your site goes live. Edit, switch designs or unpublish at any time."],
            ].map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[2rem_1fr] gap-2">
                <span className="font-['Literata'] text-muted-foreground">{i + 1}.</span>
                <div>
                  <h3 className="text-xl">{title}</h3>
                  <p className="mt-1 max-w-xl leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Entry>

        <Entry label="Privacy">
          <p className="max-w-xl text-lg leading-relaxed">
            Your phone number and street address are hidden on every new site. You choose whether
            search engines index your page and whether it appears in the public directory. You can
            delete your account, and every file with it, from Settings.
          </p>
        </Entry>

        <Entry label="Designs">
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {themes.map((theme) => (
              <li key={theme.id} className="flex gap-4">
                <img
                  src={theme.preview}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-24 shrink-0 rounded-sm border border-border object-cover object-top"
                />
                <div>
                  <h3 className="text-base font-semibold">{theme.name}</h3>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Entry>

        <Entry label="Questions">
          <dl className="space-y-8">
            {FAQ_ITEMS.slice(0, 4).map((faq) => (
              <div key={faq.q}>
                <dt className="font-semibold">{faq.q}</dt>
                <dd className="mt-1 max-w-xl leading-relaxed text-muted-foreground">{faq.a}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/faq"
            className="mt-8 inline-block text-sm font-semibold text-brand underline underline-offset-4"
          >
            All questions
          </Link>
        </Entry>

        <Entry label="Source">
          <p className="max-w-xl leading-relaxed">
            The code that stores, reads and publishes your résumé is public.{" "}
            <a
              href="https://github.com/divkix/clickfolio.me"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand underline underline-offset-4"
            >
              Read it on GitHub
            </a>
            .
          </p>
        </Entry>
      </main>

      <Footer />
    </div>
  );
}
