import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("personal-resume-website")!;

const relatedPosts = ["resume-website-vs-linkedin", "pdf-resume-to-website"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function PersonalResumeWebsitePage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          A personal resume website is a web page you own that presents your career — experience,
          skills, projects, and contact info — at your own URL. Unlike a PDF, it's always current
          and shareable with a single link. Unlike LinkedIn, you control the design, the content,
          and the analytics. It's the professional home base that everything else points to.
        </p>
        <p>
          Most people have a resume PDF and a LinkedIn profile and assume that's enough. It usually
          isn't. Here's what a personal resume website actually does for you, and how to make one
          free without touching code.
        </p>
      </section>

      <section>
        <h2>What is a personal resume website?</h2>
        <p>
          Think of it as the live, web-native version of your resume. Instead of attaching a file or
          sending someone to a profile that looks like everyone else's, you share one link that
          opens a fast, well-designed page about you. It holds the same information a resume does —
          but it's easier to read, works on any device, and never sits stale in a downloads folder.
        </p>
        <p>
          The "personal" part matters. The site is yours. You decide what's on it, how it looks, and
          who you send it to. No algorithm ranks it. No platform can change its layout overnight.
        </p>
      </section>

      <PostSection
        heading="Why you need one in 2026"
        intro="Employers look you up online before they ever reply. A personal site shapes what they find:"
      >
        <PostList
          items={[
            {
              lead: "You control the first impression.",
              body: " A 2017 CareerBuilder/Harris Poll survey found 70% of employers research candidates online during hiring. A polished site decides what that search turns up.",
            },
            {
              lead: "It's a professional link for everything.",
              body: " Applications, your email signature, your LinkedIn headline, a business card. One URL, always ready.",
            },
            {
              lead: "It can rank for your name.",
              body: " With your name in the URL, title, and headings, your site can show up when someone Googles you — and build its own authority over time.",
            },
            {
              lead: "You see who's interested.",
              body: " Built-in analytics tell you how many people viewed your page. A PDF attachment tells you nothing.",
            },
          ]}
        />
      </PostSection>

      <section>
        <h2>Personal website vs PDF vs LinkedIn</h2>
        <ComparisonTable
          headers={["Feature", "Personal site", "PDF resume", "LinkedIn"]}
          rows={[
            ["You own it", "Yes", "Yes", "No (rented)"],
            ["Custom design", "Yes", "Limited", "No"],
            ["Always current", "Yes, edit anytime", "No, goes stale", "Yes"],
            ["Ranks for your name", "Yes", "No", "Shared domain only"],
            ["View analytics", "Yes", "No", "Partial"],
          ]}
        />
        <p>
          None of these replaces the others. Keep the PDF for ATS uploads, keep LinkedIn for
          networking, and use your personal site as the full, curated story. For a deeper look at
          the trade-offs, read{" "}
          <Link href="/blog/resume-website-vs-linkedin">resume website vs LinkedIn</Link>.
        </p>
      </section>

      <PostSection heading="What to put on your personal resume website">
        <PostList
          ordered
          items={[
            {
              lead: "A hero with your name and role.",
              body: " Plus a one-line summary of what you do.",
            },
            {
              lead: "Experience with outcomes.",
              body: " Lead with results, not just responsibilities.",
            },
            {
              lead: "Skills.",
              body: " Grouped and honest — the tools and areas you actually work in.",
            },
            {
              lead: "Projects or portfolio links.",
              body: " Proof of the work behind the claims.",
            },
            {
              lead: "Education and credentials.",
              body: " Brief, unless they're central to your field.",
            },
            {
              lead: "Contact.",
              body: " One clear way to reach you.",
            },
          ]}
        />
        <p>Keep it scannable. Recruiters skim before they read, so make the important parts pop.</p>
      </PostSection>

      <section>
        <h2>How to make one free</h2>
        <p>
          You don't need to design or code anything. Upload your resume PDF to{" "}
          <Link href="/">clickfolio.me</Link> and the AI reads your experience, education, and
          skills, then rebuilds them on a professional template. Review the result, pick one of 10
          layouts, and publish at clickfolio.me/@yourname in about 30 seconds. It's free forever,
          with privacy controls and built-in analytics. If you already have a PDF, the{" "}
          <Link href="/blog/pdf-resume-to-website">PDF resume to website</Link> guide shows exactly
          how the conversion works.
        </p>
        <p>
          One honest note: every site lives at clickfolio.me/@yourname. Custom domains aren't
          available yet — they're on the roadmap — but a clean handle URL is plenty professional for
          applications and your LinkedIn.
        </p>
      </section>

      <section>
        <h2>Own your professional presence</h2>
        <p>
          A personal resume website is the one professional asset you fully control. It outlasts any
          single job, any platform, and any algorithm change — and it's working for you every time
          someone looks you up. The setup cost is minutes; the upside compounds for years.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and build your site →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
