import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/config/site";

const termsTitle = `Terms of Service - ${siteConfig.fullName}`;
const termsDescription = `Terms of Service for ${siteConfig.fullName}. Read our terms and conditions for using the service.`;

export const metadata: Metadata = {
  title: termsTitle,
  description: termsDescription,
  openGraph: {
    title: termsTitle,
    description: termsDescription,
    siteName: siteConfig.fullName,
  },
  twitter: {
    card: "summary",
    title: termsTitle,
    description: termsDescription,
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-cream paper-texture flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
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
            className="text-sm font-medium text-ink/70 hover:text-coral transition-colors duration-300"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-ink mb-4 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-ink/70 text-sm">Last updated: December 2025</p>
          </div>

          {/* Content Card */}
          <div className="bg-cream border-3 border-ink shadow-brutal-md p-8 sm:p-12">
            {/* Table of Contents */}
            <nav
              className="mb-10 p-6 bg-cream/50 border-2 border-ink"
              aria-label="Table of contents"
            >
              <h2 className="text-sm font-semibold text-ink mb-4 uppercase tracking-wide">
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
                  <li key={index}>
                    <a
                      href={`#section-${index + 1}`}
                      className="text-ink/70 hover:text-coral transition-colors duration-300"
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
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    1
                  </span>
                  Service Description
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  {siteConfig.fullName} (&quot;Service&quot;) provides a platform to convert PDF
                  resumes into hosted web portfolios. By using our Service, you agree to these
                  Terms. The Service allows users to upload PDF documents, which are then processed
                  using artificial intelligence to extract structured information and generate a
                  shareable web page.
                </p>
              </section>

              <section id="section-2" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    2
                  </span>
                  Eligibility
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  You must be at least 13 years old to use this Service. By using the Service, you
                  represent that you meet this requirement. If you are under 18, you represent that
                  you have obtained parental or guardian consent to use the Service.
                </p>
              </section>

              <section id="section-3" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    3
                  </span>
                  Account Responsibilities
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  When you create an account with us, you agree to the following:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
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
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    4
                  </span>
                  Acceptable Use
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">You agree NOT to:</p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
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
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    5
                  </span>
                  Content Ownership
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">Your content remains yours:</p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
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
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    6
                  </span>
                  AI Processing
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  Your uploaded PDF resumes are processed using artificial intelligence
                  (specifically, OpenAI via OpenRouter) to extract structured information such as
                  your name, contact details, work experience, education, and skills. By using the
                  Service, you explicitly consent to this automated processing. The AI may
                  occasionally make errors in extraction; you have the ability to review and edit
                  all extracted information before publishing.
                </p>
              </section>

              <section id="section-7" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    7
                  </span>
                  Limitation of Liability
                </h2>
                <div className="bg-coral/10 border-2 border-ink rounded-lg p-4 mb-4">
                  <p className="text-ink leading-relaxed font-medium">
                    THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                    WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
                    WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                    NON-INFRINGEMENT.
                  </p>
                </div>
                <p className="text-ink/70 leading-relaxed">
                  We are not liable for any damages arising from your use of the Service, including
                  but not limited to: loss of data, business interruption, loss of profits, or any
                  indirect, incidental, special, consequential, or punitive damages. Our total
                  liability shall not exceed the amount you paid us in the twelve (12) months
                  preceding the claim.
                </p>
              </section>

              <section id="section-8" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    8
                  </span>
                  Termination
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">Regarding account termination:</p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
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
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    9
                  </span>
                  Changes to Terms
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will provide notice of
                  material changes at least 30 days in advance by posting the updated Terms on this
                  page and updating the &quot;Last updated&quot; date. Your continued use of the
                  Service after such modifications constitutes your acceptance of the revised Terms.
                  If you do not agree to the new Terms, you must stop using the Service.
                </p>
              </section>

              <section id="section-10" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    10
                  </span>
                  Governing Law
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the
                  State of Wyoming, United States of America, without regard to its conflict of law
                  provisions. Any disputes arising under or in connection with these Terms shall be
                  subject to the exclusive jurisdiction of the courts located in Wyoming, USA.
                </p>
              </section>

              <section id="section-11" className="mb-4">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    11
                  </span>
                  Contact
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  For questions about these Terms of Service, please contact us at:
                </p>
                <div className="bg-cream/50 border-2 border-ink rounded-lg p-4">
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="text-coral hover:text-coral font-medium transition-colors duration-300"
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
              className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 hover:text-coral transition-colors duration-300"
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
