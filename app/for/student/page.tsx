import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export const revalidate = 3600;

const title = "Free Resume Website for Students";
const description =
  "Build your first online portfolio as a student — free, with no signup. Upload your PDF resume and get a shareable website with education, projects, and skills sections.";
const path = "/for/student";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteConfig.url}${path}` },
  openGraph: {
    title,
    description,
    siteName: siteConfig.fullName,
    images: [{ url: `${siteConfig.url}/api/og/home`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function StudentPage() {
  const webPageJsonLd = generateWebPageJsonLd(title, path, description);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(title, path);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from hardcoded config, serializeJsonLd escapes XSS vectors
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Breadcrumb JSON-LD from hardcoded path, no user input
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen bg-cream paper-texture" id="main-content">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="font-black text-3xl sm:text-4xl text-ink mb-4">
            Free Resume Websites for Students
          </h1>
          <p className="text-lg text-[#6B6B6B] mb-8">
            Your first online portfolio shouldn't cost anything. Upload your PDF resume and get a
            shareable website with a custom @handle URL — completely free, no time limits.
          </p>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Why Students Love clickfolio.me</h2>
            <ul className="space-y-3 text-[#6B6B6B] list-disc pl-5">
              <li>
                <strong>100% free, forever</strong> — all 6 base templates have no time limits, no
                trials, and no credit card requirements. Perfect for students building their first
                online presence.
              </li>
              <li>
                <strong>Classic ATS template</strong> — optimized for applicant tracking systems
                used by internship and entry-level job portals. Your portfolio works as both a
                website and a resume.
              </li>
              <li>
                <strong>Education-first layout</strong> — AI automatically surfaces your education,
                coursework, GPA, and academic projects. Ideal for students with limited work
                experience.
              </li>
              <li>
                <strong>Bento Grid template</strong> — modern mosaic layout that organizes your
                coursework, projects, skills, and extracurriculars into visually distinct,
                impressive cards.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Stand Out from the Stack</h2>
            <p className="text-[#6B6B6B] mb-4">
              Most students apply with a PDF. You'll apply with a live website. Share your @handle
              URL on internship applications, LinkedIn, and with recruiters at career fairs. It
              shows initiative, technical skill, and attention to detail.
            </p>
            <p className="text-[#6B6B6B]">
              No design skills? No problem. Drop your existing resume PDF and the AI handles
              everything. Switch templates anytime as you discover your style. Your portfolio grows
              with you.
            </p>
          </section>

          <a
            href="/"
            className="inline-block bg-ink text-cream font-bold px-6 py-3 border-3 border-ink shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-transform"
          >
            Build Your Free Student Portfolio →
          </a>
        </div>
      </main>
    </>
  );
}
