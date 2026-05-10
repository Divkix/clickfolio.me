import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export const revalidate = 3600;

const title = "Resume Website for Software Engineers";
const description =
  "Showcase your code, projects, and experience with a free resume website. 10 templates including DevTerminal, GitHub & LinkedIn integration, and AI-powered PDF parsing.";
const path = "/for/software-engineer";

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

export default function SoftwareEngineerPage() {
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
            Resume Websites for Software Engineers
          </h1>
          <p className="text-lg text-[#6B6B6B] mb-8">
            Your code speaks for itself. Let your resume website do the same. Upload your PDF and
            get a developer-ready portfolio with a custom @handle URL in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">
              Why Software Engineers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-[#6B6B6B] list-disc pl-5">
              <li>
                <strong>DevTerminal template</strong>: a GitHub-inspired dark terminal aesthetic
                built for developers. Monospace typography, console-style sections, and syntax
                highlighting vibes.
              </li>
              <li>
                <strong>GitHub & LinkedIn links</strong>: add your social profiles directly to your
                portfolio. Recruiters get one-click access to your repos and professional network.
              </li>
              <li>
                <strong>Structured skills & projects</strong>: AI extracts your tech stack,
                languages, frameworks, and side projects from your resume. Display them in clean,
                scannable sections.
              </li>
              <li>
                <strong>ATS-friendly templates</strong>: Classic ATS and Minimalist Editorial
                templates are optimized for applicant tracking systems. One PDF, two outputs.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-black text-xl text-ink mb-4">Built for Engineers, by Engineers</h2>
            <p className="text-[#6B6B6B] mb-4">
              clickfolio.me is open source (MIT), deployed on Cloudflare Workers, and built with
              modern tools. No bloated page builders, no WYSIWYG clutter; just a clean, fast-loading
              portfolio from your existing PDF resume.
            </p>
            <p className="text-[#6B6B6B]">
              The AI parser understands technical resumes: it correctly identifies programming
              languages, frameworks, databases, cloud platforms, and distinguishes between work
              experience and side projects.
            </p>
          </section>

          <Link
            href="/"
            className="inline-block bg-ink text-cream font-bold px-6 py-3 border-3 border-ink shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-transform"
          >
            Create Your Free Resume Website →
          </Link>
        </div>
      </main>
    </>
  );
}
