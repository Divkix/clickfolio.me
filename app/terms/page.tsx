import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

/** Revalidate terms page daily since it's static content. */
export const revalidate = 86400;

const termsTitle = `Terms of Service - ${siteConfig.fullName}`;
const termsDescription = `Terms of Service for ${siteConfig.fullName}. Read our terms and conditions for using the service.`;

/** SEO metadata for the terms of service page. */
export const metadata: Metadata = {
  title: "Terms of Service",
  description: termsDescription,
  alternates: { canonical: `${siteConfig.url}/terms` },
  openGraph: {
    title: termsTitle,
    description: termsDescription,
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: termsTitle,
    description: termsDescription,
  },
};

/**
 * Terms of service page — full legal terms with structured data and breadcrumbs.
 */
export default function TermsOfServicePage() {
  const breadcrumb = generatePageBreadcrumbJsonLd("Terms of Service", "/terms");
  const webPage = generateWebPageJsonLd(
    "Terms of Service",
    "/terms",
    termsDescription,
    "2025-12-01",
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
            aria-label="clickfolio.me home"
          >
            <Logo size="md" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Terms of Service", href: "/terms" },
        ]}
      />
      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-muted-foreground text-sm">Last updated: December 2025</p>
          </div>

          {/* Content Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-8 sm:p-12">
            {/* Table of Contents */}
            <nav
              className="mb-10 p-6 rounded-lg bg-surface-2 border border-border"
              aria-label="Table of contents"
            >
              <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
                Contents
              </h2>
              <ol className="space-y-2 text-sm">
                {[
                  "Service Description",
                  "Eligibility",
                  "Account Responsibilities",
                  "Acceptable Use",
                  "Content Ownership",
                  "AI Processing",
                  "Limitation of Liability",
                  "Termination",
                  "Changes to Terms",
                  "Governing Law",
                  "Contact",
                ].map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <a
                      href={`#section-${index + 1}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {index + 1}. {item}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Sections */}
            <div className="prose max-w-none">
              <section id="section-1" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    1
                  </span>
                  Service Description
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {siteConfig.fullName} (&quot;Service&quot;) provides a platform to convert PDF
                  resumes into hosted web portfolios. By using our Service, you agree to these
                  Terms. The Service allows users to upload PDF documents, which are then processed
                  using artificial intelligence to extract structured information and generate a
                  shareable web page.
                </p>
              </section>

              <section id="section-2" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    2
                  </span>
                  Eligibility
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  You must be at least 13 years old to use this Service. By using the Service, you
                  represent that you meet this requirement. If you are under 18, you represent that
                  you have obtained parental or guardian consent to use the Service.
                </p>
              </section>

              <section id="section-3" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    3
                  </span>
                  Account Responsibilities
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  When you create an account with us, you agree to the following:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    You are responsible for maintaining the security of your account credentials
                  </li>
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>You must provide accurate information when creating your account</li>
                  <li>You must not share your account with others</li>
                  <li>You must notify us immediately of any unauthorized use of your account</li>
                </ul>
              </section>

              <section id="section-4" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    4
                  </span>
                  Acceptable Use
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">You agree NOT to:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Upload content that violates any laws or regulations</li>
                  <li>Upload content that infringes on intellectual property rights</li>
                  <li>Use the Service for harassment, spam, or impersonation</li>
                  <li>Attempt to gain unauthorized access to the Service or its systems</li>
                  <li>Use automated tools to scrape or abuse the Service</li>
                  <li>Upload malicious files, viruses, or harmful code</li>
                  <li>Interfere with or disrupt the integrity or performance of the Service</li>
                  <li>Use the Service to distribute unsolicited commercial communications</li>
                </ul>
              </section>

              <section id="section-5" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    5
                  </span>
                  Content Ownership
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Your content remains yours:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    You retain all ownership rights to your resume content and any information you
                    upload
                  </li>
                  <li>
                    By uploading content, you grant us a limited, non-exclusive license to host,
                    display, and process your content solely as needed to provide the Service
                  </li>
                  <li>
                    You may delete your content at any time through the account deletion feature in
                    Settings
                  </li>
                  <li>We do not claim any ownership over your content</li>
                </ul>
              </section>

              <section id="section-6" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    6
                  </span>
                  AI Processing
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your uploaded PDF resumes are processed using artificial intelligence
                  (specifically, OpenAI via OpenRouter) to extract structured information such as
                  your name, contact details, work experience, education, and skills. By using the
                  Service, you explicitly consent to this automated processing. The AI may
                  occasionally make errors in extraction; you have the ability to review and edit
                  all extracted information before publishing.
                </p>
              </section>

              <section id="section-7" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    7
                  </span>
                  Limitation of Liability
                </h2>
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                  <p className="text-foreground leading-relaxed font-medium">
                    THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                    WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
                    WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                    NON-INFRINGEMENT.
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  We are not liable for any damages arising from your use of the Service, including
                  but not limited to: loss of data, business interruption, loss of profits, or any
                  indirect, incidental, special, consequential, or punitive damages. Our total
                  liability shall not exceed the amount you paid us in the twelve (12) months
                  preceding the claim.
                </p>
              </section>

              <section id="section-8" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    8
                  </span>
                  Termination
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Regarding account termination:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>You may delete your account at any time through the Settings page</li>
                  <li>
                    We reserve the right to suspend or terminate accounts that violate these Terms
                    without prior notice
                  </li>
                  <li>
                    We may terminate or suspend access to the Service immediately, without prior
                    notice or liability, for any reason
                  </li>
                  <li>
                    Upon termination, your data will be permanently deleted from our systems within
                    30 days
                  </li>
                </ul>
              </section>

              <section id="section-9" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    9
                  </span>
                  Changes to Terms
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will provide notice of
                  material changes at least 30 days in advance by posting the updated Terms on this
                  page and updating the &quot;Last updated&quot; date. Your continued use of the
                  Service after such modifications constitutes your acceptance of the revised Terms.
                  If you do not agree to the new Terms, you must stop using the Service.
                </p>
              </section>

              <section id="section-10" className="mb-10">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    10
                  </span>
                  Governing Law
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the
                  State of Wyoming, United States of America, without regard to its conflict of law
                  provisions. Any disputes arising under or in connection with these Terms shall be
                  subject to the exclusive jurisdiction of the courts located in Wyoming, USA.
                </p>
              </section>

              <section id="section-11" className="mb-4">
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-subtle text-brand-active text-sm font-semibold">
                    11
                  </span>
                  Contact
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  For questions about these Terms of Service, please contact us at:
                </p>
                <div className="rounded-lg border border-border bg-card p-4">
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="text-brand hover:text-brand-active font-medium transition-colors"
                  >
                    {siteConfig.supportEmail}
                  </a>
                </div>
              </section>
            </div>
          </div>

          {/* Back to top */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </article>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
