import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 3600;

const post = getPostBySlug("read-cv-alternatives")!;
const relatedPosts = ["best-resume-website-builders", "linkedin-to-portfolio"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function ReadCvAlternativesPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          The best Read.cv alternative depends on what you used it for. If you mainly hosted a clean
          professional profile, a free resume website builder like{" "}
          <Link href="/">clickfolio.me</Link> is the closest replacement — upload your resume PDF
          and get a hosted site at clickfolio.me/@yourname in about 30 seconds. For hand-built
          one-page sites, Carrd works. For a polished PDF-style resume, Standard Resume fits.
        </p>
        <p>
          Read.cv built a loyal following of designers, engineers, and writers who wanted a calm,
          well-designed place to show their work. Then it went away. This guide explains what
          happened and walks you through moving your profile somewhere you control — without losing
          momentum in your job search.
        </p>
      </section>

      <section>
        <h2>What happened to Read.cv?</h2>
        <p>
          Perplexity, the AI search company, acquired Read.cv on January 17, 2025. Shortly after,
          the team announced it would wind the product down. Users were given a window to export
          their data, which closed on May 16, 2025. The <code>.cv</code> domains and profiles
          migrated to Hello.cv starting around January 31, 2025, and the original profile and
          "Sites" features were discontinued.
        </p>
        <p>
          If you still have a Read.cv export sitting in a folder, you're in good shape. If you
          don't, you can rebuild from your existing resume — which is faster than it sounds.
        </p>
      </section>

      <section>
        <h2>What to look for in a replacement</h2>
        <p>
          Read.cv earned trust by doing a few things well. Use these as your checklist when picking
          where to go next:
        </p>
        <ul>
          <li>
            <strong>A clean, hosted profile.</strong> One link you can drop into applications, your
            email signature, and your LinkedIn.
          </li>
          <li>
            <strong>Low effort to set up.</strong> You shouldn't have to retype your whole career to
            get online again.
          </li>
          <li>
            <strong>You own the content.</strong> After a shutdown, the last thing you want is to be
            locked into another platform that might vanish.
          </li>
          <li>
            <strong>It stays current.</strong> A live page you can edit beats a static PDF that goes
            stale the moment you change jobs.
          </li>
        </ul>
      </section>

      <section>
        <h2>The best Read.cv alternatives compared</h2>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Tool</th>
                <th className="border border-border p-3 text-left font-semibold">Best for</th>
                <th className="border border-border p-3 text-left font-semibold">Imports resume</th>
                <th className="border border-border p-3 text-left font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">clickfolio.me</td>
                <td className="border border-border p-3">A hosted resume site from your PDF</td>
                <td className="border border-border p-3">Yes, AI parses your PDF</td>
                <td className="border border-border p-3">Free</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Standard Resume</td>
                <td className="border border-border p-3">A clean resume + simple web version</td>
                <td className="border border-border p-3">Partial (LinkedIn import)</td>
                <td className="border border-border p-3">Free + paid plans</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Carrd</td>
                <td className="border border-border p-3">A hand-built one-page site</td>
                <td className="border border-border p-3">No, you build it</td>
                <td className="border border-border p-3">Free + ~$19/yr Pro</td>
              </tr>
              <tr>
                <td className="border border-border p-3">About.me</td>
                <td className="border border-border p-3">A simple intro/bio page</td>
                <td className="border border-border p-3">No</td>
                <td className="border border-border p-3">Free + paid plans</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          One note: Bento.me, which some Read.cv users moved to, also shut down around February
          2026. Skip it. Pick a tool that's stable and gives you a portable copy of your content.
        </p>
      </section>

      <section>
        <h2>Why a resume website builder is the closest match</h2>
        <p>
          Read.cv's core appeal was a single, good-looking page that summarized your professional
          life. That's exactly what a resume website builder produces. With{" "}
          <Link href="/">clickfolio.me</Link>, you upload your resume PDF and the AI reads your
          experience, education, and skills, then rebuilds them as an editable page on one of 10
          templates. You get a real URL, built-in view analytics, and privacy controls — and it's
          free forever.
        </p>
        <p>
          The honest limit: every site lives at clickfolio.me/@yourname. Custom domains aren't
          available yet — they're on the roadmap. For most job seekers a clean hosted handle is more
          than professional enough for applications and your LinkedIn profile. If you want to
          compare your options first, our roundup of the{" "}
          <Link href="/blog/best-resume-website-builders">best free resume website builders</Link>{" "}
          breaks down each one.
        </p>
      </section>

      <section>
        <h2>How to migrate from Read.cv in three steps</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Find your content.</strong> If you exported your Read.cv data before May 2025,
            open it. If not, grab your most recent resume PDF — or export your LinkedIn profile as a
            PDF, which works just as well.
          </li>
          <li>
            <strong>Upload it.</strong> Drop the PDF into <Link href="/">clickfolio.me</Link>. The
            AI parses it and builds your page in about 30 seconds. No retyping.
          </li>
          <li>
            <strong>Review, pick a template, publish.</strong> Tidy any details the parser missed,
            choose a layout, and publish. Then update the link everywhere your old Read.cv URL
            lived: your resume, LinkedIn, GitHub, and email signature.
          </li>
        </ol>
        <p>
          If you came from LinkedIn rather than a resume file, our guide on turning your{" "}
          <Link href="/blog/linkedin-to-portfolio">LinkedIn profile into a portfolio website</Link>{" "}
          covers the export step in detail.
        </p>
      </section>

      <section>
        <h2>Don't leave the gap open</h2>
        <p>
          Every week your profile link points to a dead page is a week a recruiter, client, or
          hiring manager hits a wall instead of your work. A personal website still pays off: in a
          Workfolio survey reported by Forbes in 2013, 56% of hiring managers were more impressed by
          a personal website than any other branding tool — yet only 7% of job seekers had one.
          Rebuilding takes minutes, and you come out the other side owning your page instead of
          renting it.
        </p>
      </section>

      <section>
        <h2>Ready to move?</h2>
        <p>
          Read.cv is gone, but your work isn't. Rebuild it somewhere you control and never worry
          about another shutdown taking your profile down with it.
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
