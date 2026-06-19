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

const faqs = [
  {
    q: "I have no work experience. Can I still build a student resume website?",
    a: "Yes. The layout surfaces your education, coursework, academic projects, and clubs, so a thin work history is not a problem. Recruiters for internships expect students to lead with projects and skills. A live site shows initiative that a plain PDF cannot.",
  },
  {
    q: "Is it free for students?",
    a: "Yes, and there is no trial clock. Six templates are free forever with no credit card. Four more unlock when friends sign up through your referral, not by paying. The project is open source under the MIT license, so it stays free.",
  },
  {
    q: "How long does it take to make one?",
    a: "About 30 seconds. You upload the PDF resume you already have and the AI builds the site, pulling out your education, projects, and skills. You can review and tweak everything, then share your clickfolio.me/@handle link right away.",
  },
  {
    q: "Where can I use my portfolio link?",
    a: "Put your @handle URL on internship applications, your LinkedIn, your email signature, and the resume you hand out at career fairs. It loads fast and previews cleanly when shared, which helps you stand out from classmates who only send a PDF.",
  },
];

export default function StudentPage() {
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
            Free Resume Websites for Students
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your first online portfolio shouldn't cost anything. Upload your PDF resume and get a
            shareable website with a custom @handle URL — completely free, no time limits.
          </p>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              Why Students Love clickfolio.me
            </h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
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
            <h2 className="font-bold text-xl text-foreground mb-4">Stand Out from the Stack</h2>
            <p className="text-muted-foreground mb-4">
              Most students apply with a PDF. You will apply with a live student resume website.
              Share your @handle URL on internship applications, LinkedIn, and with recruiters at
              career fairs. It shows initiative and attention to detail before you say a word.
            </p>
            <p className="text-muted-foreground">
              No design skills? No problem. Drop your existing resume PDF and the AI handles the
              rest. Switch templates any time as you find your style. Your portfolio grows with you.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              What to put on it when you're just starting
            </h2>
            <p className="text-muted-foreground mb-4">
              Recruiters spend about 7.4 seconds on a first scan (The Ladders, 2018), and for
              entry-level roles they look for potential, not a long career. Give them clear signals
              fast.
            </p>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Projects and coursework</strong> — a capstone, a class build, or a hackathon
                entry. Show what you can do, not just what you studied.
              </li>
              <li>
                <strong>Skills you actually use</strong> — tools, languages, and software you are
                comfortable with.
              </li>
              <li>
                <strong>Activities and leadership</strong> — clubs, teams, and volunteer roles that
                show you follow through.
              </li>
              <li>
                <strong>Education details</strong> — major, expected graduation, and standout
                results worth highlighting.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">Templates that fit a student</h2>
            <ul className="space-y-3 text-muted-foreground list-disc pl-5">
              <li>
                <strong>Classic ATS</strong> — clean and parser-friendly for internship and
                entry-level portals.
              </li>
              <li>
                <strong>Bento Grid</strong> — a mosaic that turns coursework, projects, and clubs
                into impressive cards.
              </li>
              <li>
                <strong>Minimalist Editorial</strong> — simple and readable when you want the work
                to speak.
              </li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="font-bold text-xl text-foreground mb-4">
              "What if I have nothing to show yet?"
            </h2>
            <p className="text-muted-foreground mb-4">
              Everyone starts there. One class project, one internship, or one club role is enough
              to fill a page that looks intentional. The point is to look organized and motivated,
              and a clean site does that on its own.
            </p>
            <p className="text-muted-foreground">
              New to all of this? Start with{" "}
              <a className="underline" href="/blog/student-resume-website">
                our guide to building a student resume website
              </a>{" "}
              for a simple walkthrough.
            </p>
          </section>

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <a href="/">Build Your Free Student Portfolio</a>
          </Button>
        </div>
      </main>
    </>
  );
}
