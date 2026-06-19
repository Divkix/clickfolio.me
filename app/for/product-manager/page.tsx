import type { Metadata } from "next";
import { RoleFaqSection } from "@/components/Faq";
import { Button } from "@/components/ui/button";
import {
  buildRolePageMetadata,
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 3600;

const title = "Portfolio Website for Product Managers";
const description =
  "Showcase your product launches, roadmaps, and impact with a free portfolio website. 10 templates, AI-powered parsing from PDF, custom @handle URL.";
const path = "/for/product-manager";

export const metadata: Metadata = buildRolePageMetadata({ title, description, path });

const faqs = [
  {
    q: "My product work is confidential. Can I still build a product manager portfolio website?",
    a: 'Yes. Frame launches by impact and context without exposing roadmaps under NDA, for example "led a checkout redesign that lifted conversion 12%." You control what is visible, so you keep the credibility of real outcomes while honoring every confidentiality agreement.',
  },
  {
    q: "Can I show metrics and outcomes, not just titles?",
    a: "Yes. The AI pulls your launches, metrics, and cross-functional wins from your resume, and the templates put numbers up front. PMs get hired on impact, so the page is built to lead with the ROI you delivered instead of a list of responsibilities.",
  },
  {
    q: "Is it free?",
    a: "Yes. Six templates are free with no credit card and no trial. Four more unlock through referrals, not payment. There is no paid tier. The project is open source under the MIT license, so there is nothing to buy and no upsell waiting later.",
  },
  {
    q: "What link do I put on my resume and LinkedIn?",
    a: "You get a clickfolio.me/@handle address hosted on Cloudflare. It loads fast and previews cleanly when shared on LinkedIn, Slack, or email. Use it on your resume and in your signature. Custom bring-your-own domains are on the roadmap for the future.",
  },
];

export default function ProductManagerPage() {
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
            Portfolio Websites for Product Managers
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            You ship products. Now ship your personal brand. Upload your PDF resume and get a
            polished portfolio website with a custom @handle URL — free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Product Managers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Bento Grid template</strong> — modern mosaic layout that organizes your
                product launches, metrics, and cross-functional wins into visually distinct,
                scannable cards.
              </li>
              <li>
                <strong>Spotlight template</strong> — warm, animated portfolio that gives each
                product or initiative the dedicated space it deserves. Tell your product stories
                with impact.
              </li>
              <li>
                <strong>Structured project highlights</strong> — AI extracts and organizes your
                product launches, roadmaps, and cross-functional collaborations into clear,
                results-focused sections.
              </li>
              <li>
                <strong>Metrics-forward design</strong> — templates emphasize numbers, impact
                metrics, and outcomes. Show the ROI you delivered — not just what you did.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Your Portfolio Is a Product</h2>
            <p className="text-muted-foreground mb-4">
              As a PM, you know presentation matters. Your product manager portfolio website is the
              product that sells you: fast-loading, well-structured, and built to turn recruiters
              and hiring managers into interview requests.
            </p>
            <p className="text-muted-foreground">
              Switch between 10 templates to find the one that fits your style. Each is
              mobile-responsive and tuned for rich link previews on LinkedIn, Slack, and email.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What hiring managers look for in a PM
            </h2>
            <p className="text-muted-foreground mb-4">
              A first scan takes about 7.4 seconds (The Ladders, 2018). For product roles, reviewers
              want evidence of judgment and impact, so make your strongest launch the first thing
              they see.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Outcomes over activity</strong> — the metric you moved and the decision
                behind it, not a list of meetings run.
              </li>
              <li>
                <strong>Product stories</strong> — the problem, your bet, the trade-offs, and the
                result. Show how you think.
              </li>
              <li>
                <strong>Cross-functional scope</strong> — who you led, the teams you aligned, and
                the size of the surface you owned.
              </li>
              <li>
                <strong>Customer and market sense</strong> — the insight that drove the work.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Templates built for impact</h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Bento Grid</strong> — a mosaic that turns launches and metrics into clean,
                scannable cards.
              </li>
              <li>
                <strong>Spotlight</strong> — warm and animated, giving each initiative room to tell
                its story.
              </li>
              <li>
                <strong>Bold Corporate</strong> — executive type that makes results impossible to
                skim past.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "My roadmaps are confidential"
            </h2>
            <p className="text-muted-foreground mb-4">
              You do not need to expose anything under NDA. Describe each launch by its impact and
              context, keep specifics general, and use the privacy controls to manage what is
              visible. The result still proves you ship, without breaking a single agreement.
            </p>
            <p className="text-muted-foreground">
              Want a deeper how-to first? Read{" "}
              <a className="underline" href="/blog/product-manager-portfolio-website">
                our guide to a product manager portfolio website
              </a>{" "}
              for examples and structure.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Create Your Free PM Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
