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

const title = "Resume Website for Consultants";
const description =
  "Launch a professional consulting portfolio website from your PDF resume. Privacy controls, custom URL, 10 templates — free forever with no time limits.";
const path = "/for/consultant";

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
    q: "My client work is under NDA. Can I still build a consultant portfolio website?",
    a: 'Yes. Describe engagements by industry, scope, and outcome without naming the client, for example "led a cost program for a mid-market retailer." Granular privacy controls also let you hide contact details. You keep the credibility of results while respecting every confidentiality agreement.',
  },
  {
    q: "Can I control what is public?",
    a: "Yes. You can toggle visibility for your phone number and address, so you present a professional page publicly while keeping personal contact details private until you choose to share them. That control matters when your profile is also your business front.",
  },
  {
    q: "Is clickfolio.me free?",
    a: "Yes. Six templates are free with no time limit and no credit card. Four more unlock through referrals rather than payment. There is no paid tier. The project is open source under the MIT license, so independent consultants can rely on it long term.",
  },
  {
    q: "What do I share with prospective clients?",
    a: "You get a clickfolio.me/@handle link hosted on Cloudflare that loads fast and previews cleanly in email and on LinkedIn. Use it on proposals and in your signature so clients see your track record before the first call. Custom domains are on the roadmap.",
  },
];

export default function ConsultantPage() {
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
            Resume Websites for Consultants
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your expertise deserves a professional online presence. Turn your PDF resume into a
            polished consulting portfolio with a custom @handle URL — free, in 30 seconds.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Consultants Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Midnight template</strong> — dark minimal with serif headings and gold
                accents. Elegant and sophisticated, perfect for high-end consulting professionals.
              </li>
              <li>
                <strong>Minimalist Editorial template</strong> — clean, magazine-style layout that
                puts your track record in focus. No visual noise, just results.
              </li>
              <li>
                <strong>Granular privacy controls</strong> — toggle phone number and address
                visibility. Share a professional presence publicly while keeping personal contact
                details private until you choose to share them.
              </li>
              <li>
                <strong>Client engagement list</strong> — AI extracts and highlights the
                organizations you've worked with, presented in a clean timeline format that builds
                credibility instantly.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Your Digital Business Card</h2>
            <p className="text-muted-foreground mb-4">
              A clickfolio.me @handle URL is the modern consultant portfolio website and business
              card in one. Put it on LinkedIn, in your email signature, and on proposals. Clients
              get a complete picture of your expertise before the first call.
            </p>
            <p className="text-muted-foreground">
              Rich Open Graph previews keep your page looking professional when shared. Typography
              and layout are tuned to project competence the moment someone clicks.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What to put on a consultant portfolio
            </h2>
            <p className="text-muted-foreground mb-4">
              Clients buy outcomes and trust. A first scan takes about 7.4 seconds (The Ladders,
              2018), so make your value obvious before anyone reads the detail.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Engagements with results</strong> — the problem, your approach, and the
                measurable outcome, framed by industry when names are confidential.
              </li>
              <li>
                <strong>Areas of expertise</strong> — the two or three problems you solve best, so
                clients self-qualify.
              </li>
              <li>
                <strong>Credibility markers</strong> — certifications, years in the field, and the
                kinds of organizations you serve.
              </li>
              <li>
                <strong>A clear next step</strong> — how to reach you, on your terms.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Templates that signal authority
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Midnight</strong> — dark and minimal with serif headings and gold accents
                for a high-end feel.
              </li>
              <li>
                <strong>Minimalist Editorial</strong> — magazine-clean, putting your track record in
                focus.
              </li>
              <li>
                <strong>Bold Corporate</strong> — executive typography for a confident, polished
                profile.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "Most of my work is confidential"
            </h2>
            <p className="text-muted-foreground mb-4">
              That is fine. You can describe each engagement by sector, scope, and result without
              naming the client, and the privacy controls let you hide contact details until you are
              ready. Your credibility comes through while every NDA stays intact.
            </p>
            <p className="text-muted-foreground">
              Want the full setup walkthrough? Read{" "}
              <a className="underline" href="/blog/personal-resume-website">
                our guide to a personal resume website
              </a>{" "}
              before you publish.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Create Your Consulting Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
