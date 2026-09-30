// PROTOTYPE (throwaway) — variant C "Curriculum". The page is typeset like a
// well-made CV (label column + content column) but keeps drop_first's
// conversion mechanics: glowing dropzone first, PDF→site proof, profession
// chips, a loud closing CTA and the mobile sticky upload bar.

import Link from "next/link";
import { FileDropzone } from "@/components/FileDropzone";
import { Footer } from "@/components/Footer";
import { MobileStickyUpload } from "@/components/home/MobileStickyUpload";
import { SiteHeader } from "@/components/SiteHeader";
import { TemplateFontLinks } from "@/components/templates/shared/TemplateFontLinks";
import { FAQ_ITEMS } from "@/lib/config/faq";
import { PROFESSIONS } from "@/lib/config/professions";
import { DEMO_PROFILES } from "@/lib/templates/demo-data";
import { THEME_METADATA } from "@/lib/templates/theme-ids";
import { PdfToSite } from "./PdfToSite";
import { ProtoUploadButton } from "./ProtoUploadButton";

const THEME_CSS = `
.proto-c {
  --background: #f1f1ef; --foreground: #1e1e22; --surface-2: #e8e8e5;
  --card: #ffffff; --card-foreground: #1e1e22; --popover: #ffffff; --popover-foreground: #1e1e22;
  --muted: #e8e8e5; --muted-foreground: #5e5e66; --secondary: #e8e8e5; --secondary-foreground: #1e1e22;
  --brand: #7a1f2b; --brand-hover: #661a24; --brand-active: #52151d; --brand-subtle: #f4e8e9; --brand-foreground: #ffffff;
  --primary: #7a1f2b; --primary-foreground: #ffffff; --accent: #f4e8e9; --accent-foreground: #7a1f2b;
  --success: #2f6b4f; --border: #dadad6; --border-strong: #c4c4bf; --input: #c4c4bf; --ring: #7a1f2b;
  --chart-2: #d9a441;
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

      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 sm:px-6 lg:px-8 lg:pb-0"
      >
        <header className="grid gap-8 pt-14 pb-12 md:grid-cols-[1fr_1fr] md:items-center md:gap-12 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Free forever, no sign-up to start
            </p>
            <h1 className="mt-5 text-5xl leading-[1.05] sm:text-6xl">
              Your résumé, made into a website in 30 seconds.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Upload the PDF you send to employers. Get clickfolio.me/@yourname to link from
              applications, email signatures and LinkedIn.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden="true">
                {DEMO_PROFILES.slice(0, 5).map((profile) => (
                  <span
                    key={profile.id}
                    className="flex size-8 items-center justify-center rounded-full bg-brand-subtle text-[10px] font-bold text-brand ring-2 ring-background"
                  >
                    {profile.initials}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                For engineers, designers, PMs, marketers and students.
              </p>
            </div>
          </div>

          <div id="upload-card" className="relative rounded p-[2px]">
            <div aria-hidden="true" className="landing-glow absolute inset-0 rounded" />
            <div className="relative rounded-[2px] bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_-18px_rgba(0,0,0,0.25)] sm:p-6">
              <FileDropzone />
            </div>
          </div>
        </header>

        <section className="border-t border-border-strong py-12">
          <h2 className="text-lg text-brand italic">Result</h2>
          <div className="mt-8">
            <PdfToSite />
          </div>
        </section>

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
            search engines index your page and whether it appears in the public directory. Your
            résumé is never sold or shared, and you can delete your account, and every file with it,
            from Settings.
          </p>
        </Entry>

        <Entry label="Designs">
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {themes.map((theme) => (
              <li key={theme.id} className="group flex gap-4">
                <img
                  src={theme.preview}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-24 shrink-0 rounded-sm border border-border object-cover object-top transition-transform duration-300 group-hover:scale-[1.6] group-hover:shadow-xl motion-reduce:group-hover:scale-100"
                />
                <div>
                  <h3 className="text-base font-semibold">{theme.name}</h3>
                  <p className="text-sm text-muted-foreground">{theme.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Entry>

        <Entry label="For">
          <div className="flex flex-wrap gap-2 text-sm">
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

        <section className="my-16 rounded bg-brand px-6 py-14 text-brand-foreground sm:px-12 lg:my-24">
          <div className="md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-10">
            <div>
              <h2 className="text-4xl sm:text-5xl">Still reading? You could be live by now.</h2>
              <p className="mt-4 max-w-md text-brand-foreground/80">
                One PDF. Thirty seconds. A link you will use for years. The code is{" "}
                <a
                  href="https://github.com/divkix/clickfolio.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  open on GitHub
                </a>
                .
              </p>
            </div>
            <ProtoUploadButton className="mt-8 inline-flex h-13 items-center rounded bg-white px-8 text-lg font-semibold text-brand shadow-lg transition hover:scale-[1.03] motion-reduce:hover:scale-100 md:mt-0">
              Upload my résumé
            </ProtoUploadButton>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyUpload />
    </div>
  );
}
