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

const title = "Resume Website for Marketers";
const description =
  "Create a standout marketing portfolio website from your PDF resume. Highlight campaign metrics, brands you've worked with, and results — free, with 10 templates.";
const path = "/for/marketer";

export const metadata: Metadata = buildRolePageMetadata({ title, description, path });

const faqs = [
  {
    q: "I'm early in my marketing career. Is this worth it?",
    a: "Yes. A marketing portfolio website shows initiative even with one or two campaigns. You can feature class projects, internships, freelance work, or a side channel you grew. A clean page with real numbers beats a long resume of responsibilities every time.",
  },
  {
    q: "Can I highlight campaign metrics and results?",
    a: "Yes. The AI pulls your growth numbers, campaign results, and brand names from your resume and puts them front and center. Marketers get hired on outcomes, so the templates are built to make your metrics the first thing a recruiter sees.",
  },
  {
    q: "Is clickfolio.me free?",
    a: "Yes. Six templates are free forever with no credit card and no trial. Four more unlock through referrals, not payment. There is no paid tier. The project is open source under the MIT license, so you can even see how it works.",
  },
  {
    q: "Will my portfolio look good when I share the link?",
    a: "Yes. Every clickfolio.me/@handle page generates a rich Open Graph preview, so it unfurls cleanly on LinkedIn, Slack, and email. You get a permanent link to put in your bio and signature. Custom domains are planned for the future.",
  },
];

export default function MarketerPage() {
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
            Resume Websites for Marketers
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your resume should sell you as well as you sell products. Turn your PDF into a polished
            marketing portfolio with a custom @handle URL — free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Marketers Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Bold Corporate template</strong> — executive typography with numbered
                sections that make your achievements impossible to skim past. Premium look that
                commands attention.
              </li>
              <li>
                <strong>Neo Brutalist template</strong> — high-contrast, bold design that stands out
                in any link preview. Perfect for marketers who want to show personality.
              </li>
              <li>
                <strong>Results-focused structure</strong> — AI extracts and highlights your
                campaign metrics, growth numbers, and brand names. Your impact is front and center.
              </li>
              <li>
                <strong>Privacy controls</strong> — toggle what's visible to recruiters and the
                public. Share a polished version publicly while keeping sensitive details for direct
                conversations.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Your Portfolio, Your Brand</h2>
            <p className="text-muted-foreground mb-4">
              Every marketer knows the power of a strong landing page. Your marketing portfolio
              website is your personal landing page: a permanent @handle URL you can put on
              LinkedIn, in your email signature, and on your business cards.
            </p>
            <p className="text-muted-foreground">
              Rich Open Graph previews mean your page looks sharp when shared on social, in Slack,
              or anywhere links unfurl. Your personal brand gets the same polish you give your
              clients.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What to feature on a marketing portfolio
            </h2>
            <p className="text-muted-foreground mb-4">
              Recruiters spend about 7.4 seconds on a first scan (The Ladders, 2018). For marketing
              roles, they are hunting for proof you move numbers, so put the results where they land
              first.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Campaign outcomes</strong> — the goal, what you did, and the result. "Grew
                signups 38% in a quarter" beats "ran the email program."
              </li>
              <li>
                <strong>Channels and tools</strong> — paid, SEO, lifecycle, content, and the
                platforms you actually run.
              </li>
              <li>
                <strong>Brands and scope</strong> — the companies you supported and the audience
                size you reached.
              </li>
              <li>
                <strong>Samples worth clicking</strong> — a landing page, a post, or a deck that
                shows your taste.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Templates that command attention
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Bold Corporate</strong> — executive typography and numbered sections that
                make your wins hard to skim past.
              </li>
              <li>
                <strong>Neo Brutalist</strong> — high-contrast and confident, with personality that
                pops in a link preview.
              </li>
              <li>
                <strong>Bento Grid</strong> — a mosaic that turns campaigns and metrics into clean,
                scannable cards.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "I don't have a huge campaign list yet"
            </h2>
            <p className="text-muted-foreground mb-4">
              You do not need one. A focused page with two or three real results reads stronger than
              a padded resume. Show the work you are proud of, frame the outcome, and let the page
              do the convincing.
            </p>
            <p className="text-muted-foreground">
              Want a walkthrough before you start? Read{" "}
              <a className="underline" href="/blog/how-to-make-a-resume-website">
                how to make a resume website
              </a>{" "}
              for a step-by-step guide.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Create Your Free Marketing Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
