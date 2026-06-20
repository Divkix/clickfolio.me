import type { Metadata } from "next";
import { RoleFaqSection } from "@/components/Faq";
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
    a: "Yes. Six templates are free with no time limit and no credit card. Four more unlock through referrals rather than payment. There is no paid plan. The whole project is open source under the MIT license, so there is no catch.",
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

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Designers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>DesignFolio template</strong> — digital brutalism meets Swiss typography.
                Dark theme with acid lime accents. Bold, distinctive, and impossible to ignore.
              </li>
              <li>
                <strong>Spotlight template</strong> — warm creative portfolio with animated
                sections. Designed to give your work the breathing room it needs.
              </li>
              <li>
                <strong>Visual-first layouts</strong> — every template prioritizes typography,
                whitespace, and visual hierarchy. Your portfolio looks like it was custom-built.
              </li>
              <li>
                <strong>Project gallery display</strong> — AI extracts your projects from your
                resume and presents them in structured, scannable layouts with role, timeline, and
                description.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              From PDF to Published in 30 Seconds
            </h2>
            <p className="text-muted-foreground mb-4">
              Drop the PDF resume you already have. The AI extracts your experience, education,
              skills, and projects. In about 30 seconds you have a live designer portfolio website
              you can send to studios, agencies, and clients.
            </p>
            <p className="text-muted-foreground">
              Not happy with the first look? Switch between 10 themes with one click. You never
              touch a layout grid or a font menu unless you want to.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What hiring designers look for
            </h2>
            <p className="text-muted-foreground mb-4">
              Recruiters spend about 7.4 seconds on a first scan (The Ladders, 2018). For design
              roles, that glance is about taste and clarity, so your page has to look intentional in
              the first second.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>A clear point of view</strong> — a few strong projects beat a wall of
                thumbnails. Lead with the work you want more of.
              </li>
              <li>
                <strong>Context per project</strong> — your role, the problem, and the outcome.
                Designers get hired on thinking, not just pixels.
              </li>
              <li>
                <strong>Craft in the details</strong> — consistent type, spacing, and alignment. A
                tidy page signals a tidy designer.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Templates with a designer's eye
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>DesignFolio</strong> — digital brutalism with Swiss typography and acid lime
                accents. Bold and memorable.
              </li>
              <li>
                <strong>Spotlight</strong> — warm and animated, with room for each project to
                breathe.
              </li>
              <li>
                <strong>Glass Morphic</strong> — soft, layered, and modern when you want a lighter
                feel.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "Shouldn't I hand-build my own site?"
            </h2>
            <p className="text-muted-foreground mb-4">
              You can, and some designers do. But a hand-built site is a project that competes with
              your actual work. clickfolio.me gives you a clean, fast page today, so your time goes
              into the portfolio pieces instead of CSS.
            </p>
            <p className="text-muted-foreground">
              Looking for inspiration first? Browse{" "}
              <a className="underline" href="/blog/resume-website-examples">
                resume website examples
              </a>{" "}
              to see layouts you can recreate in minutes.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Create Your Free Design Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
