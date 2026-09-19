import type { Metadata } from "next";
import Link from "next/link";
import { RoleFaqSection } from "@/components/Faq";
import { RoleSection } from "@/components/role/RoleSection";
import { Button } from "@/components/ui/button";
import {
  buildRolePageMetadata,
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

export const revalidate = 86400;

const title = "Free Resume Website for Students";
const description =
  "Build your first online portfolio as a student — free, with no signup. Upload your PDF resume and get a shareable website with education, projects, and skills sections.";
const path = "/for/student";

export const metadata: Metadata = buildRolePageMetadata({ title, description, path });

const faqs = [
  {
    q: "I have no work experience. Can I still build a student resume website?",
    a: "Yes. The layout surfaces your education, coursework, academic projects, and clubs, so a thin work history is not a problem. Recruiters for internships expect students to lead with projects and skills. A live site shows initiative that a plain PDF cannot.",
  },
  {
    q: "Is it free for students?",
    a: "Yes, and there is no trial clock. All 10 templates are free forever with no credit card and no premium lock. The project is open source under the MIT license, so it stays free.",
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

          <RoleSection
            heading="Why Students Love clickfolio.me"
            items={[
              {
                lead: "100% free, forever",
                body: "all 6 base templates have no time limits, no trials, and no credit card requirements. Perfect for students building their first online presence.",
              },
              {
                lead: "Classic ATS template",
                body: "optimized for applicant tracking systems used by internship and entry-level job portals. Your portfolio works as both a website and a resume.",
              },
              {
                lead: "Education-first layout",
                body: "AI automatically surfaces your education, coursework, GPA, and academic projects. Ideal for students with limited work experience.",
              },
              {
                lead: "Bento Grid template",
                body: "modern mosaic layout that organizes your coursework, projects, skills, and extracurriculars into visually distinct, impressive cards.",
              },
            ]}
          />

          <RoleSection
            heading="Stand Out from the Stack"
            intro="Most students apply with a PDF. You will apply with a live student resume website. Share your @handle URL on internship applications, LinkedIn, and with recruiters at career fairs. It shows initiative and attention to detail before you say a word."
            outro="No design skills? No problem. Drop your existing resume PDF and the AI handles the rest. Switch templates any time as you find your style. Your portfolio grows with you."
          />

          <RoleSection
            heading="What to put on it when you're just starting"
            intro="Recruiters spend about 7.4 seconds on a first scan (The Ladders, 2018), and for entry-level roles they look for potential, not a long career. Give them clear signals fast."
            items={[
              {
                lead: "Projects and coursework",
                body: "a capstone, a class build, or a hackathon entry. Show what you can do, not just what you studied.",
              },
              {
                lead: "Skills you actually use",
                body: "tools, languages, and software you are comfortable with.",
              },
              {
                lead: "Activities and leadership",
                body: "clubs, teams, and volunteer roles that show you follow through.",
              },
              {
                lead: "Education details",
                body: "major, expected graduation, and standout results worth highlighting.",
              },
            ]}
          />

          <RoleSection
            heading="Templates that fit a student"
            items={[
              {
                lead: "Classic ATS",
                body: "clean and parser-friendly for internship and entry-level portals.",
              },
              {
                lead: "Bento Grid",
                body: "a mosaic that turns coursework, projects, and clubs into impressive cards.",
              },
              {
                lead: "Minimalist Editorial",
                body: "simple and readable when you want the work to speak.",
              },
            ]}
          />

          <RoleSection
            heading={'"What if I have nothing to show yet?"'}
            intro="Everyone starts there. One class project, one internship, or one club role is enough to fill a page that looks intentional. The point is to look organized and motivated, and a clean site does that on its own."
            outro={
              <>
                New to all of this? Start with{" "}
                <Link className="underline" href="/blog/student-resume-website">
                  our guide to building a student resume website
                </Link>{" "}
                for a simple walkthrough.
              </>
            }
          />

          <RoleFaqSection items={faqs} />

          <Button asChild size="lg">
            <Link href="/">Build Your Free Student Portfolio</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
