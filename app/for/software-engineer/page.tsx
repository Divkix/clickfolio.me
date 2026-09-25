import type { Metadata } from "next";
import Link from "next/link";
import { RoleFaqSection } from "@/components/Faq";
import { RoleGuides, RoleSection } from "@/components/role/RoleSection";
import { Button } from "@/components/ui/button";
import {
  buildRolePageMetadata,
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

const title = "Resume Website for Software Engineers";

const description =
  "Showcase your code, projects, and experience with a free resume website. 10 templates including DevTerminal, GitHub & LinkedIn integration, and AI-powered PDF parsing.";

const path = "/for/software-engineer";

export const metadata: Metadata = buildRolePageMetadata({ title, description, path });

const faqs = [
  {
    q: "Is clickfolio.me really free for software engineers?",
    a: "Yes. You can upload your resume, get a hosted developer portfolio, and use all 10 templates with no payment ever. There is no paid tier, no premium lock, and no credit card. The project is open source under the MIT license.",
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

          <RoleSection
            heading="Why Software Engineers Love clickfolio.me"
            items={[
              {
                lead: "DevTerminal template",
                body: "a GitHub-inspired dark terminal aesthetic built for developers. Monospace typography, console-style sections, and syntax highlighting vibes.",
              },
              {
                lead: "GitHub & LinkedIn links",
                body: "add your social profiles directly to your portfolio. Recruiters get one-click access to your repos and professional network.",
              },
              {
                lead: "Structured skills & projects",
                body: "AI extracts your tech stack, languages, frameworks, and side projects from your resume. Display them in clean, scannable sections.",
              },
              {
                lead: "ATS-friendly templates",
                body: "Classic ATS and Minimalist Editorial templates are optimized for applicant tracking systems. One PDF, two outputs.",
              },
            ]}
          />

          <RoleSection
            heading="Built for Engineers, by Engineers"
            intro="clickfolio.me is open source (MIT), deployed on Cloudflare Workers, and built with modern tools. No bloated page builders, no WYSIWYG clutter, just a clean, fast-loading software engineer portfolio from your existing PDF resume."
            outro="The AI parser understands technical resumes. It correctly identifies programming languages, frameworks, databases, and cloud platforms, and tells your work experience apart from your side projects."
          />

          <RoleSection
            heading="What to put on a software engineer portfolio"
            intro="Recruiters spend about 7.4 seconds on a first resume scan (The Ladders, 2018), so your page has to answer their questions fast. Lead with the work that shows judgment, not just a list of tools."
            items={[
              {
                lead: "Shipped projects with outcomes",
                body: "what you built, the stack, and the result. A link to a live demo or repo beats a paragraph of description.",
              },
              {
                lead: "Your core stack",
                body: "the 5 to 8 languages and frameworks you actually reach for, separated from things you have only touched once.",
              },
              {
                lead: "Scope and impact",
                body: "team size, traffic served, latency cut, or money saved. Numbers make a senior engineer look senior.",
              },
              {
                lead: "Links that prove it",
                body: "GitHub, a personal site, or a package you maintain. Evidence does more than adjectives.",
              },
            ]}
          />

          <RoleSection
            heading="Which template fits a developer"
            intro="Pick the look that matches the roles you want. You can switch any time with one click, so it costs nothing to try a few."
            items={[
              {
                lead: "DevTerminal",
                body: 'a dark, terminal-style theme with monospace type. Signals "engineer" before anyone reads a word.',
              },
              {
                lead: "Classic ATS",
                body: "clean and parser-friendly for when a recruiter wants something plain to forward internally.",
              },
              {
                lead: "Minimalist Editorial",
                body: "quiet, readable, and project-first when you want the work to carry the page.",
              },
            ]}
          />

          <RoleSection
            heading={'"I already have a GitHub. Why a portfolio?"'}
            intro="A GitHub profile shows code; it does not frame the story. A portfolio puts your best work first, explains the impact in plain language, and gives non-technical recruiters a way in. It takes one link instead of asking them to dig through repos."
            outro={
              <>
                Want examples and a step-by-step walkthrough? Read{" "}
                <Link className="underline" href="/blog/resume-website-examples">
                  our roundup of resume website examples
                </Link>{" "}
                for ideas you can copy in minutes.
              </>
            }
          />

          <RoleFaqSection items={faqs} />

          <RoleGuides slugs={["best-resume-website-builders", "personal-resume-website"]} />

          <Button asChild size="lg">
            <Link href="/">Create Your Free Resume Website</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
