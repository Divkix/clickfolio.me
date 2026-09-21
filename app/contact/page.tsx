import { Bug, Clock, Mail, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicPageMetadata } from "@/lib/seo/page-metadata";

export const revalidate = 86400;

const GITHUB_REPO = "https://github.com/Divkix/clickfolio.me";

const GITHUB_NEW_BUG = `${GITHUB_REPO}/issues/new?template=bug.md`;

/** Document title — no brand; root layout template is `%s | clickfolio.me`. */
const contactTitle = "Contact & support";

/** OG/Twitter skip the HTML title template, so they keep the brand. */
const contactOgTitle = `Contact ${siteConfig.fullName} — support, bug reports, and page removal`;

const contactDescription = `Reach the ${siteConfig.fullName} team: email ${siteConfig.supportEmail}, file a bug report on GitHub, learn what to include in a report, and request removal of a portfolio page.`;

export const metadata: Metadata = buildPublicPageMetadata({
  title: contactTitle,
  ogTitle: contactOgTitle,
  description: contactDescription,
  path: "/contact",
});

const BUG_REPORT_CHECKLIST = [
  "What you expected to happen, and what happened instead.",
  "The steps to reproduce it, numbered, starting from the page you opened.",
  "The URL involved — for example https://clickfolio.me/@yourhandle, or the dashboard screen you were on.",
  "Your browser, operating system, and device (for example: Safari 18, iOS 19, iPhone 15).",
  "A screenshot or the exact error message, if one is shown.",
  "For resume parsing problems: whether the PDF was exported from Word, Google Docs, or a design tool, and roughly how it is laid out. Please don't send us the resume text itself — a screenshot is enough.",
];

export default function ContactPage() {
  const breadcrumb = generatePageBreadcrumbJsonLd("Contact", "/contact");
  const webPage = generateWebPageJsonLd(contactTitle, "/contact", contactDescription);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }}
      />

      <SiteHeader />

      <main className="flex-1">
        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Support</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Contact &amp; support
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              {siteConfig.fullName} is built and run by a small, independent team. Whether something
              is broken, your resume parsed badly, or you want a page taken down, here is how to
              reach a human — and what to include so we can fix it fast.
            </p>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Mail className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-foreground">Email support</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Best for account problems, privacy questions, and removal requests. Write to{" "}
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  {siteConfig.supportEmail}
                </a>{" "}
                from the email address on your account so we can find your profile.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Bug className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-foreground">GitHub issues</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                The code is open source, so bug reports and feature requests are public. Open a{" "}
                <a
                  href={GITHUB_NEW_BUG}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  bug report
                </a>{" "}
                or browse{" "}
                <a
                  href={`${GITHUB_REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  existing issues
                </a>{" "}
                to see if yours is already tracked.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface-2 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              What to include in a bug report
            </h2>
            <p className="mt-2 text-muted-foreground">
              A report with these details usually gets fixed without a back-and-forth:
            </p>
            <ul className="mt-6 space-y-3">
              {BUG_REPORT_CHECKLIST.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Clock className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-foreground">How fast we reply</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Support is handled by the maintainer, not a ticket queue. We aim to answer email and
                GitHub issues within two business days, Monday to Friday. Reports that include the
                details above, and issues reproduced on the live site, come first.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
                <Trash2 className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-foreground">Removing a portfolio page</h2>
              <div className="mt-1 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Your own page:</span> sign in and
                  open{" "}
                  <Link
                    href="/settings"
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Settings
                  </Link>
                  . Turning off Search and Directory unlists it from search engines and from{" "}
                  <Link
                    href="/explore"
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    /explore
                  </Link>
                  . To erase the page and everything behind it, use Delete account — profile,
                  resumes, uploads, and the published page are permanently removed, which our
                  privacy policy completes within 30 days.
                </p>
                <p>
                  <span className="font-medium text-foreground">A page you don&apos;t own:</span>{" "}
                  email {siteConfig.supportEmail} with the page URL and what should come down. We
                  review every request and remove pages that violate our terms or expose personal
                  information.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-brand-subtle p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Check the FAQ first
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Pricing, privacy, upload formats, and custom domains are answered there — and it is
              faster than waiting on us.
            </p>
            <div className="mt-6">
              <Link
                href="/faq"
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                Read the FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
