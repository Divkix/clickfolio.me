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

const title = "Portfolio Website for Designers";

const description =
  "Turn your PDF into a stunning design portfolio website. Showcase your work with 10 beautiful templates — free, no signup required. Custom @handle URL included.";

const path = "/for/designer";

export const metadata: Metadata = buildRolePageMetadata({ title, description, path });

const faqs = [
  {
    q: "Do I need design skills to build a designer portfolio website?",
    a: "No. You upload your existing PDF resume and the AI lays out a polished site for you. Every template is built by designers, so the typography, spacing, and hierarchy are already handled. You just pick the look you like and publish.",
  },
  {
    q: "Can I show project work, not just a resume?",
    a: "Yes. The AI pulls your projects from your resume and presents each one with its role, timeline, and description in a structured gallery. You can edit the details after import, so your strongest work leads and the rest supports it.",
  },
  {
    q: "Is it actually free?",
    a: "Yes. All 12 templates are free with no time limit and no credit card. There is no paid plan and no premium lock. The whole project is open source under the MIT license, so you can inspect every line.",
  },
  {
    q: "What link do I share with studios and clients?",
    a: "You get a clickfolio.me/@handle address hosted on real Cloudflare infrastructure. It loads fast and shows a rich preview when pasted into messages or social posts. Custom domains are on the roadmap, but your @handle link is permanent today.",
  },
];

export default function DesignerPage() {
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
            Portfolio Websites for Designers
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your work deserves a canvas, not a template. Upload your PDF resume and get a
            designer-quality portfolio website with a custom @handle URL — free, no signup needed.
          </p>

          <RoleSection
            heading="Why Designers Love clickfolio.me"
            items={[
              {
                lead: "DesignFolio template",
                body: "digital brutalism meets Swiss typography. Dark theme with acid lime accents. Bold, distinctive, and impossible to ignore.",
              },
              {
                lead: "Spotlight template",
                body: "warm creative portfolio with animated sections. Designed to give your work the breathing room it needs.",
              },
              {
                lead: "Visual-first layouts",
                body: "every template prioritizes typography, whitespace, and visual hierarchy. Your portfolio looks like it was custom-built.",
              },
              {
                lead: "Project gallery display",
                body: "AI extracts your projects from your resume and presents them in structured, scannable layouts with role, timeline, and description.",
              },
            ]}
          />

          <RoleSection
            heading="From PDF to Published in 30 Seconds"
            intro="Drop the PDF resume you already have. The AI extracts your experience, education, skills, and projects. In about 30 seconds you have a live designer portfolio website you can send to studios, agencies, and clients."
            outro="Not happy with the first look? Switch between 12 themes with one click. You never touch a layout grid or a font menu unless you want to."
          />

          <RoleSection
            heading="What hiring designers look for"
            intro="Recruiters spend about 7.4 seconds on a first scan (The Ladders, 2018). For design roles, that glance is about taste and clarity, so your page has to look intentional in the first second."
            items={[
              {
                lead: "A clear point of view",
                body: "a few strong projects beat a wall of thumbnails. Lead with the work you want more of.",
              },
              {
                lead: "Context per project",
                body: "your role, the problem, and the outcome. Designers get hired on thinking, not just pixels.",
              },
              {
                lead: "Craft in the details",
                body: "consistent type, spacing, and alignment. A tidy page signals a tidy designer.",
              },
            ]}
          />

          <RoleSection
            heading="Templates with a designer's eye"
            items={[
              {
                lead: "DesignFolio",
                body: "digital brutalism with Swiss typography and acid lime accents. Bold and memorable.",
              },
              {
                lead: "Spotlight",
                body: "warm and animated, with room for each project to breathe.",
              },
              {
                lead: "Glass Morphic",
                body: "soft, layered, and modern when you want a lighter feel.",
              },
            ]}
          />

          <RoleSection
            heading={'"Shouldn\'t I hand-build my own site?"'}
            intro="You can, and some designers do. But a hand-built site is a project that competes with your actual work. clickfolio.me gives you a clean, fast page today, so your time goes into the portfolio pieces instead of CSS."
            outro={
              <>
                Looking for inspiration first? Browse{" "}
                <Link className="underline" href="/blog/resume-website-examples">
                  resume website examples
                </Link>{" "}
                to see layouts you can recreate in minutes.
              </>
            }
          />

          <RoleFaqSection items={faqs} />

          <RoleGuides slugs={["pdf-resume-vs-portfolio", "read-cv-alternatives"]} />

          <Button asChild size="lg">
            <Link href="/">Create Your Free Design Portfolio</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
