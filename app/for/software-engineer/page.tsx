import type { Metadata } from "next";
import { RoleFaqSection } from "@/components/Faq";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

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

const faqs = [
  {
    q: "Is clickfolio.me really free for software engineers?",
    a: "Yes. You can upload your resume, get a hosted developer portfolio, and use 6 templates with no payment ever. Four more templates unlock through referrals, not money. There is no paid tier and no credit card. The project is open source under the MIT license.",
  },
  {
    q: "Can I link my GitHub and LinkedIn?",
    a: "Yes. Add your GitHub, LinkedIn, and other profile links directly to your portfolio. Recruiters get one-click access to your repositories and professional network, so your code and contribution history back up the claims on your resume without extra effort.",
  },
  {
    q: "Will the AI read a technical resume correctly?",
    a: "It is built for technical resumes. The parser identifies programming languages, frameworks, databases, and cloud platforms, and separates work experience from side projects. You can review and adjust everything after the import, so nothing important gets mislabeled.",
  },
  {
    q: "Do I get a real URL I can share?",
    a: "Every portfolio gets a clickfolio.me/@handle address hosted on Cloudflare. Put it on your resume, GitHub profile, or job applications. Custom bring-your-own domains are on the roadmap, but your @handle link is permanent and ready to share right away.",
  },
];

export default function SoftwareEngineerPage() {
  const webPageJsonLd = generateWebPageJsonLd(title, path, description);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd(title, path);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen bg-background" id="main-content">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="font-extrabold text-3xl sm:text-4xl text-foreground mb-4">
            Resume Websites for Software Engineers
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your code speaks for itself. Let your resume website do the same. Upload your PDF and
            get a developer-ready portfolio with a custom @handle URL in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Software Engineers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>DevTerminal template</strong> — a GitHub-inspired dark terminal aesthetic
                built for developers. Monospace typography, console-style sections, and syntax
                highlighting vibes.
              </li>
              <li>
                <strong>GitHub & LinkedIn links</strong> — add your social profiles directly to your
                portfolio. Recruiters get one-click access to your repos and professional network.
              </li>
              <li>
                <strong>Structured skills & projects</strong> — AI extracts your tech stack,
                languages, frameworks, and side projects from your resume. Display them in clean,
                scannable sections.
              </li>
              <li>
                <strong>ATS-friendly templates</strong> — Classic ATS and Minimalist Editorial
                templates are optimized for applicant tracking systems. One PDF, two outputs.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Built for Engineers, by Engineers
            </h2>
            <p className="text-muted-foreground mb-4">
              clickfolio.me is open source (MIT), deployed on Cloudflare Workers, and built with
              modern tools. No bloated page builders, no WYSIWYG clutter, just a clean, fast-loading
              software engineer portfolio from your existing PDF resume.
            </p>
            <p className="text-muted-foreground">
              The AI parser understands technical resumes. It correctly identifies programming
              languages, frameworks, databases, and cloud platforms, and tells your work experience
              apart from your side projects.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What to put on a software engineer portfolio
            </h2>
            <p className="text-muted-foreground mb-4">
              Recruiters spend about 7.4 seconds on a first resume scan (The Ladders, 2018), so your
              page has to answer their questions fast. Lead with the work that shows judgment, not
              just a list of tools.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Shipped projects with outcomes</strong> — what you built, the stack, and the
                result. A link to a live demo or repo beats a paragraph of description.
              </li>
              <li>
                <strong>Your core stack</strong> — the 5 to 8 languages and frameworks you actually
                reach for, separated from things you have only touched once.
              </li>
              <li>
                <strong>Scope and impact</strong> — team size, traffic served, latency cut, or money
                saved. Numbers make a senior engineer look senior.
              </li>
              <li>
                <strong>Links that prove it</strong> — GitHub, a personal site, or a package you
                maintain. Evidence does more than adjectives.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Which template fits a developer
            </h2>
            <p className="text-muted-foreground mb-4">
              Pick the look that matches the roles you want. You can switch any time with one click,
              so it costs nothing to try a few.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>DevTerminal</strong> — a dark, terminal-style theme with monospace type.
                Signals "engineer" before anyone reads a word.
              </li>
              <li>
                <strong>Classic ATS</strong> — clean and parser-friendly for when a recruiter wants
                something plain to forward internally.
              </li>
              <li>
                <strong>Minimalist Editorial</strong> — quiet, readable, and project-first when you
                want the work to carry the page.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "I already have a GitHub. Why a portfolio?"
            </h2>
            <p className="text-muted-foreground mb-4">
              A GitHub profile shows code; it does not frame the story. A portfolio puts your best
              work first, explains the impact in plain language, and gives non-technical recruiters
              a way in. It takes one link instead of asking them to dig through repos.
            </p>
            <p className="text-muted-foreground">
              Want examples and a step-by-step walkthrough? Read{" "}
              <a className="underline" href="/blog/resume-website-examples">
                our roundup of resume website examples
              </a>{" "}
              for ideas you can copy in minutes.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Create Your Free Resume Website</a>
          </Button>
        </div>
      </main>
    </>
  );
}
