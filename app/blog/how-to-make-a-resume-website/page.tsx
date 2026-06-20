import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("how-to-make-a-resume-website")!;
const relatedPosts = ["pdf-resume-to-website", "cv-website-builder"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

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
            to PDF."
          </li>
          <li>
            <strong>Upload the PDF.</strong> Drop it into clickfolio.me. The AI reads your work
            history, education, skills, and contact details and maps them onto the page for you.
          </li>
          <li>
            <strong>Pick a template.</strong> Choose from 10 designs — clean and minimal for
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
        <ul>
          <li>
            <strong>Name and headline.</strong> Your name, current role or target role, and one line
            on what you do.
          </li>
          <li>
            <strong>Summary.</strong> Two or three sentences on your focus and strongest results.
          </li>
          <li>
            <strong>Experience.</strong> Roles with outcomes, not just duties. Numbers beat
            adjectives.
          </li>
          <li>
            <strong>Skills.</strong> The tools and abilities that match the jobs you want.
          </li>
          <li>
            <strong>Projects or work samples.</strong> Especially useful for engineers, designers,
            and writers.
          </li>
          <li>
            <strong>Contact.</strong> One obvious way to reach you, plus links to relevant profiles.
          </li>
        </ul>
        <p>
          If you want to see how this looks in practice, browse the{" "}
          <Link href="/explore">live examples on Explore</Link> before you build your own.
        </p>
      </section>

      <section>
        <h2>Should you build it yourself or use a builder?</h2>
        <p>
          Both produce a real website. The difference is how much time and skill you spend getting
          there.
        </p>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Approach</th>
                <th className="border border-border p-3 text-left font-semibold">Time</th>
                <th className="border border-border p-3 text-left font-semibold">Coding needed</th>
                <th className="border border-border p-3 text-left font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">Upload PDF to clickfolio.me</td>
                <td className="border border-border p-3">~30 seconds</td>
                <td className="border border-border p-3">None</td>
                <td className="border border-border p-3">Free</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Drag-and-drop site builder</td>
                <td className="border border-border p-3">A few hours</td>
                <td className="border border-border p-3">None</td>
                <td className="border border-border p-3">Often paid for a custom URL</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Code it from scratch</td>
                <td className="border border-border p-3">Days</td>
                <td className="border border-border p-3">Yes</td>
                <td className="border border-border p-3">Hosting + your time</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Coding your own site is worth it if you're a developer who wants total control and treats
          the site as a portfolio piece in itself. For everyone else, importing a PDF gets you a
          professional result without the work. If you want to weigh specific tools, see our{" "}
          <Link href="/blog/best-resume-website-builders">
            comparison of resume website builders
          </Link>
          .
        </p>
      </section>

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
          highlight.
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
