import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("how-to-make-a-resume-website")!;

const relatedPosts = ["pdf-resume-to-website", "cv-website-builder"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function HowToMakeAResumeWebsitePage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>How do you make a resume website?</h2>
        <p>
          To make a resume website, upload your resume PDF to an AI builder, let it read your
          experience and skills, pick a template, then publish to a shareable link. With{" "}
          <Link href="/">clickfolio.me</Link> the whole thing takes about 30 seconds and costs
          nothing. No coding, no design work, no retyping your career into a form.
        </p>
        <p>
          The slow way still works too: write the content, choose a layout, build the page, and host
          it yourself. Below is both the fast path and the manual path, so you can pick the one that
          fits how much time you want to spend.
        </p>
      </section>

      <section>
        <h2>The fastest way: turn your resume PDF into a site</h2>
        <p>
          If you already have a resume, you have everything you need. Here are the steps, start to
          finish:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Export your resume as a PDF.</strong> Use the resume you already send to
            employers. If you only have a LinkedIn profile, open it, click "More," and choose "Save
            to PDF." Our guide to{" "}
            <Link href="/blog/linkedin-to-portfolio">
              turning LinkedIn into a portfolio website
            </Link>{" "}
            walks through that path.
          </li>
          <li>
            <strong>Upload the PDF.</strong> Drop it into clickfolio.me. The AI reads your work
            history, education, skills, and contact details and maps them onto the page for you.
          </li>
          <li>
            <strong>Pick a template.</strong> Choose from 12 designs — clean and minimal for
            corporate roles, bolder layouts for creative ones. You can switch any time without
            losing content.
          </li>
          <li>
            <strong>Review and edit.</strong> Fix any detail the parser missed, reorder sections,
            and tighten your headline. This is the only manual part, and it's fast.
          </li>
          <li>
            <strong>Publish.</strong> Your site goes live at <code>clickfolio.me/@yourhandle</code>.
            Copy the link into your applications, email signature, and LinkedIn.
          </li>
        </ol>
        <p>
          That's it. You skip the blank page entirely because your resume already contains the
          content — the builder just rebuilds it as a web page.
        </p>
      </section>

      <section>
        <h2>What should a resume website include?</h2>
        <p>
          Recruiters spend about 7.4 seconds on a first resume scan (The Ladders eye-tracking study,
          2018), so your site has to answer "who is this and are they a fit?" before anyone scrolls.
          Lead with the essentials:
        </p>
        <PostList
          items={[
            {
              lead: "Name and headline.",
              body: " Your name, current role or target role, and one line on what you do.",
            },
            {
              lead: "Summary.",
              body: " Two or three sentences on your focus and strongest results.",
            },
            {
              lead: "Experience.",
              body: " Roles with outcomes, not just duties. Numbers beat adjectives.",
            },
            {
              lead: "Skills.",
              body: " The tools and abilities that match the jobs you want.",
            },
            {
              lead: "Projects or work samples.",
              body: " Especially useful for engineers, designers, and writers.",
            },
            {
              lead: "Contact.",
              body: " One obvious way to reach you, plus links to relevant profiles.",
            },
          ]}
        />
        <p>
          If you want to see how this looks in practice, browse the{" "}
          <Link href="/explore">live examples on Explore</Link> or our roundup of{" "}
          <Link href="/blog/resume-website-examples">resume website examples</Link> before you build
          your own.
        </p>
      </section>

      <PostSection
        heading="Should you build it yourself or use a builder?"
        intro="Both produce a real website. The difference is how much time and skill you spend getting there."
      >
        <ComparisonTable
          headers={["Approach", "Time", "Coding needed", "Cost"]}
          rows={[
            ["Upload PDF to clickfolio.me", "~30 seconds", "None", "Free"],
            ["Drag-and-drop site builder", "A few hours", "None", "Often paid for a custom URL"],
            ["Code it from scratch", "Days", "Yes", "Hosting + your time"],
          ]}
        />
        <p>
          Coding your own site is worth it if you're a developer who wants total control and treats
          the site as a portfolio piece in itself. For everyone else, importing a PDF gets you a
          professional result without the work. If you want to weigh specific tools, see our{" "}
          <Link href="/blog/best-resume-website-builders">
            comparison of resume website builders
          </Link>
          .
        </p>
      </PostSection>

      <section>
        <h2>How to pick your URL and keep it professional</h2>
        <p>
          Your link is the part people actually see and remember. A clean handle like{" "}
          <code>clickfolio.me/@yourname</code> reads well on a resume, in an email signature, and on
          LinkedIn. Custom domains aren't available yet — they're on the roadmap — but a tidy handle
          is more than credible enough for applications and outreach today.
        </p>
        <p>
          Keep the handle short, use your real name where you can, and reuse the same handle across
          platforms so people find the right you. The goal is a single link you can paste anywhere
          without explaining it.
        </p>
      </section>

      <section>
        <h2>After you publish: make the site work for you</h2>
        <p>
          Publishing is the start, not the finish. Once your site is live, put the link everywhere a
          PDF used to go: applications, your LinkedIn "Featured" section, your email signature, and
          your social bios. A site nobody can find doesn't help you.
        </p>
        <p>
          clickfolio.me includes built-in analytics, so you can see how many people viewed your page
          — something a PDF attachment can never tell you. You also control privacy: hide contact
          details, unlist the page, or keep it fully public. And because the project is open source
          (MIT) and hosted on Cloudflare, your site is fast and you can verify exactly how it works.
        </p>
        <p>
          If you're an engineer and want role-specific guidance, our{" "}
          <Link href="/for/software-engineer">guide for software engineers</Link> covers what to
          highlight, and the <Link href="/for/designer">resume website guide for designers</Link>{" "}
          does the same for creative roles.
        </p>
      </section>

      <section>
        <h2>The short version</h2>
        <p>
          Making a resume website used to mean choosing between a weekend of design work and a
          monthly subscription. It doesn't anymore. If you have a PDF, you're 30 seconds from a
          hosted site you control, for free. Write the content well, pick a template that fits your
          field, claim a clean handle, and share the link.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and build your site in 30 seconds →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
