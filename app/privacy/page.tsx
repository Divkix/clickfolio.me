import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { siteConfig } from "@/lib/config/site";

const privacyTitle = `Privacy Policy - ${siteConfig.fullName}`;
const privacyDescription = `Privacy Policy for ${siteConfig.fullName}. Learn how we collect, use, and protect your personal information.`;

export const metadata: Metadata = {
  title: privacyTitle,
  description: privacyDescription,
  openGraph: {
    title: privacyTitle,
    description: privacyDescription,
    siteName: siteConfig.fullName,
  },
  twitter: {
    card: "summary",
    title: privacyTitle,
    description: privacyDescription,
  },
};

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-ink/70 text-sm">Last updated: February 2026</p>
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
                  "Introduction",
                  "Information We Collect",
                  "How We Use Your Information",
                  "Third-Party Services",
                  "Data Storage and Security",
                  "Data Retention",
                  "Your Rights (GDPR/CCPA)",
                  "Cookies & Analytics",
                  "Children's Privacy",
                  "Changes to This Policy",
                  "Contact Us",
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
                  Introduction
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  {siteConfig.fullName} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is
                  committed to protecting your privacy. This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your personal information when you use our service.
                  Please read this policy carefully. By using the Service, you consent to the data
                  practices described in this policy.
                </p>
              </section>

              <section id="section-2" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    2
                  </span>
                  Information We Collect
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We collect several types of information to provide and improve our Service:
                </p>

                <h3 className="text-lg font-semibold text-ink mb-3 mt-6">Account Information</h3>
                <ul className="list-disc pl-6 space-y-2 text-ink/70 mb-4">
                  <li>Email address (obtained from Google OAuth)</li>
                  <li>Name (obtained from Google OAuth)</li>
                  <li>Profile picture URL (obtained from Google OAuth)</li>
                  <li>Chosen username/handle for your public profile</li>
                </ul>

                <h3 className="text-lg font-semibold text-ink mb-3">Resume Content</h3>
                <ul className="list-disc pl-6 space-y-2 text-ink/70 mb-4">
                  <li>Uploaded PDF files (stored securely in cloud storage)</li>
                  <li>Extracted text and structured data from your resume, including:</li>
                  <ul className="list-circle pl-6 space-y-1 text-ink/70 mt-2">
                    <li>Professional summary and headline</li>
                    <li>Work experience and employment history</li>
                    <li>Education and certifications</li>
                    <li>Skills and competencies</li>
                    <li>Contact information (phone, email, location)</li>
                  </ul>
                </ul>

                <h3 className="text-lg font-semibold text-ink mb-3">Usage Information</h3>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Pages visited and actions taken within the Service</li>
                  <li>Device information (operating system, device type)</li>
                  <li>Timestamps of your interactions</li>
                </ul>
              </section>

              <section id="section-3" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    3
                  </span>
                  How We Use Your Information
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We use the information we collect for the following purposes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
                  <li>
                    <strong>Authentication:</strong> To verify your identity and manage your account
                  </li>
                  <li>
                    <strong>Service Delivery:</strong> To parse your resume and display your content
                    on your public profile
                  </li>
                  <li>
                    <strong>Improvement:</strong> To analyze usage patterns and improve the Service
                  </li>
                  <li>
                    <strong>Communication:</strong> To send you important updates about your account
                    or the Service
                  </li>
                  <li>
                    <strong>Security:</strong> To detect, prevent, and address fraud, abuse, or
                    technical issues
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> To comply with legal obligations and enforce
                    our Terms of Service
                  </li>
                </ul>
              </section>

              <section id="section-4" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    4
                  </span>
                  Third-Party Services
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We use the following third-party services to operate our platform. Each has their
                  own privacy policy governing how they handle your data:
                </p>

                <div className="space-y-4">
                  <div className="bg-cream/50 border-2 border-ink rounded-lg p-4">
                    <h4 className="font-semibold text-ink mb-1">Google OAuth</h4>
                    <p className="text-ink/70 text-sm mb-2">
                      Used for authentication and account creation
                    </p>
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-coral hover:text-coral text-sm font-medium transition-colors duration-300"
                    >
                      View Privacy Policy
                    </a>
                  </div>

                  <div className="bg-cream/50 border-2 border-ink rounded-lg p-4">
                    <h4 className="font-semibold text-ink mb-1">OpenAI (via OpenRouter)</h4>
                    <p className="text-ink/70 text-sm mb-2">
                      Used for AI-powered PDF parsing and data extraction
                    </p>
                    <a
                      href="https://openrouter.ai/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-coral hover:text-coral text-sm font-medium transition-colors duration-300"
                    >
                      View OpenRouter Privacy Policy
                    </a>
                    <span className="mx-2 text-ink/50">|</span>
                    <a
                      href="https://openai.com/policies/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-coral hover:text-coral text-sm font-medium transition-colors duration-300"
                    >
                      View OpenAI Privacy Policy
                    </a>
                  </div>

                  <div className="bg-cream/50 border-2 border-ink rounded-lg p-4">
                    <h4 className="font-semibold text-ink mb-1">Cloudflare</h4>
                    <p className="text-ink/70 text-sm mb-2">
                      Used for hosting, storage (R2), database (D1), and content delivery
                    </p>
                    <a
                      href="https://www.cloudflare.com/privacypolicy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-coral hover:text-coral text-sm font-medium transition-colors duration-300"
                    >
                      View Privacy Policy
                    </a>
                  </div>
                </div>
              </section>

              <section id="section-5" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    5
                  </span>
                  Data Storage and Security
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We take the security of your data seriously and implement industry-standard
                  measures:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
                  <li>
                    Your data is stored on Cloudflare&apos;s global network infrastructure (SOC 2
                    Type II, ISO 27001 certified)
                  </li>
                  <li>
                    Cloudflare provides infrastructure-level encryption at rest for all stored data
                  </li>
                  <li>All data in transit is encrypted using TLS 1.3</li>
                  <li>
                    Database access is restricted to our application only — no direct external
                    access
                  </li>
                  <li>We implement access controls and regularly review our security practices</li>
                  <li>
                    <strong>We do not sell your personal information to third parties</strong>
                  </li>
                </ul>
              </section>

              <section id="section-6" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    6
                  </span>
                  Data Retention
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  We retain your personal data for as long as your account is active or as needed to
                  provide you with the Service. Upon account deletion, all your data&mdash;including
                  uploaded files, extracted content, and profile information&mdash;is permanently
                  removed from our systems within 30 days. Some anonymized, aggregated data may be
                  retained for analytical purposes but cannot be used to identify you.
                </p>
              </section>

              <section id="section-7" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    7
                  </span>
                  Your Rights (GDPR/CCPA)
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  Depending on your location, you may have the following rights regarding your
                  personal data:
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-coral"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink">Right to Access</h4>
                      <p className="text-ink/70 text-sm">
                        View your data anytime in the Settings page of your dashboard
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-coral"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink">Right to Deletion</h4>
                      <p className="text-ink/70 text-sm">
                        Delete your account and all associated data through the Settings page
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-coral"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink">Right to Correction</h4>
                      <p className="text-ink/70 text-sm">
                        Edit your resume content at any time through the Edit page
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-ink/10 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-ink"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-ink">Right to Portability</h4>
                      <p className="text-ink/70 text-sm">Export your resume data (coming soon)</p>
                    </div>
                  </div>
                </div>

                <p className="text-ink/70 leading-relaxed mt-4">
                  To exercise any of these rights, visit your Settings page or contact us at{" "}
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="text-coral hover:text-coral font-medium transition-colors duration-300"
                  >
                    {siteConfig.supportEmail}
                  </a>
                </p>
              </section>

              <section id="section-8" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    8
                  </span>
                  Cookies & Analytics
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We use only essential cookies necessary for the operation of our Service:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
                  <li>
                    <strong>Session cookies:</strong> Required for authentication and maintaining
                    your logged-in state
                  </li>
                  <li>
                    <strong>Temporary upload tracking:</strong> Used to associate anonymous uploads
                    with your account after login
                  </li>
                </ul>

                <h3 className="text-lg font-semibold text-ink mb-3 mt-6">First-Party Analytics</h3>
                <p className="text-ink/70 leading-relaxed mb-4">
                  We use self-hosted, privacy-focused analytics to understand how our service is
                  used and to provide portfolio traffic insights to users:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-ink/70">
                  <li>Page views and referral sources (where visitors came from)</li>
                  <li>Device type (mobile, tablet, or desktop)</li>
                  <li>Aggregated visitor counts for your public portfolio</li>
                </ul>

                <div className="bg-coral/10 border-2 border-ink rounded-lg p-4 mt-4">
                  <p className="text-ink text-sm font-medium mb-2">Privacy-preserving design:</p>
                  <ul className="list-disc pl-6 space-y-1 text-ink/70 text-sm">
                    <li>No raw IP addresses are stored</li>
                    <li>Visitor identifiers rotate daily (no long-term tracking)</li>
                    <li>No cross-site tracking or advertising cookies</li>
                    <li>
                      All analytics are self-hosted on our infrastructure — no data shared with
                      third parties
                    </li>
                  </ul>
                </div>
              </section>

              <section id="section-9" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    9
                  </span>
                  Children&apos;s Privacy
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  Our Service is not intended for children under 13 years of age. We do not
                  knowingly collect personal information from children under 13. If you are a parent
                  or guardian and believe your child has provided us with personal information,
                  please contact us immediately at{" "}
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="text-coral hover:text-coral font-medium transition-colors duration-300"
                  >
                    {siteConfig.supportEmail}
                  </a>
                  . We will take steps to remove such information from our systems.
                </p>
              </section>

              <section id="section-10" className="mb-10">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    10
                  </span>
                  Changes to This Policy
                </h2>
                <p className="text-ink/70 leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our
                  practices or for other operational, legal, or regulatory reasons. We will notify
                  users of material changes at least 30 days in advance by posting the updated
                  policy on this page and updating the &quot;Last updated&quot; date. We encourage
                  you to review this Privacy Policy periodically. Your continued use of the Service
                  after any changes indicates your acceptance of the updated policy.
                </p>
              </section>

              <section id="section-11" className="mb-4">
                <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-r from-coral/20 to-coral/20 text-coral text-sm font-bold">
                    11
                  </span>
                  Contact Us
                </h2>
                <p className="text-ink/70 leading-relaxed mb-4">
                  If you have any questions or concerns about this Privacy Policy or our data
                  practices, please contact us:
                </p>
                <div className="bg-cream/50 border-2 border-ink rounded-lg p-4">
                  <p className="text-ink/70 mb-2">
                    <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${siteConfig.supportEmail}`}
                      className="text-coral hover:text-coral font-medium transition-colors duration-300"
                    >
                      {siteConfig.supportEmail}
                    </a>
                  </p>
                  <p className="text-ink/70 text-sm">
                    For data deletion requests, please use the account deletion feature in your
                    Settings page.
                  </p>
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
