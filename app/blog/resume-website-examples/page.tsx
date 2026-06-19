import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("resume-website-examples")!;
const relatedPosts = ["clickfolio-templates-showcase", "how-to-make-a-resume-website"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${siteConfig.url}/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} | ${siteConfig.fullName}`,
      description: post.description,
      siteName: siteConfig.fullName,
      images: [{ url: "/api/og/home", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default function ResumeWebsiteExamplesPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          A good resume website example loads fast, works on mobile, and leads with your name, role,
          and strongest work above the fold. The best ones pick one clear layout, use readable type,
          and give recruiters a single obvious way to get in touch. Below are the styles that work,
          what makes each one effective, and how to build your own for free.
        </p>
        <p>
          You don't need to copy any single site. You need to see the patterns that repeat across
          good ones, then apply them to your own background. That's what these examples are for.
        </p>
      </section>

      <section>
        <h2>What makes a resume website example worth copying?</h2>
        <p>Before the styles, here's the shortlist every strong example shares:</p>
        <ul>
          <li>
            <strong>A clear hero.</strong> Name, current role, and a one-line summary you can read
            in two seconds.
          </li>
          <li>
            <strong>Scannable experience.</strong> Roles with outcomes, not just duties. Numbers
            where you have them.
          </li>
          <li>
            <strong>One focus per page.</strong> A designer shows craft; an engineer shows shipped
            projects. They don't try to be everything.
          </li>
          <li>
            <strong>Fast and mobile-friendly.</strong> Recruiters open links on their phones. A slow
            or broken layout loses them.
          </li>
          <li>
            <strong>An obvious contact path.</strong> Email or a button, not a buried footer.
          </li>
        </ul>
      </section>

      <section>
        <h2>Minimal resume website examples</h2>
        <p>
          Minimal sites win because they remove everything that competes with your content. Think
          plenty of whitespace, one accent color, and a single readable typeface. The hero states
          your name and role. Below it, experience and skills sit in clean sections with generous
          spacing.
        </p>
        <p>
          This style suits almost everyone — analysts, consultants, marketers, operations, finance.
          It reads as confident and current. If you're unsure where to start, start here. A minimal
          editorial layout makes average content look sharp and great content look exceptional.
        </p>
      </section>

      <section>
        <h2>Creative resume website examples</h2>
        <p>
          Creatives — designers, writers, art directors, photographers — can push further. Here the
          site itself is a work sample. Bolder type, a distinctive color palette, and visible
          project thumbnails do the talking. The risk is letting style bury substance, so the
          strongest creative examples still answer the basics fast: who you are, what you make, and
          how to reach you.
        </p>
        <p>
          A useful rule: if a recruiter can't tell what you do within five seconds, the design is
          working against you. Personality should frame your work, not hide it.
        </p>
      </section>

      <section>
        <h2>Developer resume website examples</h2>
        <p>
          Developer sites lead with shipped work. The best ones list projects with a short
          description, the stack, and links to live demos or GitHub. Experience comes next, then
          skills grouped by area. Clarity beats cleverness — a clean project list converts better
          than an over-animated landing page.
        </p>
        <p>
          If you're an engineer, our role-specific guide for the{" "}
          <Link href="/for/software-engineer">software engineer portfolio</Link> covers exactly
          which projects to feature and how to frame impact for technical hiring.
        </p>
      </section>

      <section>
        <h2>Resume website styles at a glance</h2>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Style</th>
                <th className="border border-border p-3 text-left font-semibold">Best for</th>
                <th className="border border-border p-3 text-left font-semibold">Leads with</th>
                <th className="border border-border p-3 text-left font-semibold">Watch out for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">Minimal</td>
                <td className="border border-border p-3">Most professionals</td>
                <td className="border border-border p-3">Name, role, summary</td>
                <td className="border border-border p-3">Looking too plain — add one accent</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Creative</td>
                <td className="border border-border p-3">Designers, writers</td>
                <td className="border border-border p-3">Visual work samples</td>
                <td className="border border-border p-3">Style burying substance</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Developer</td>
                <td className="border border-border p-3">Engineers</td>
                <td className="border border-border p-3">Projects + stack</td>
                <td className="border border-border p-3">Over-animation, slow load</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Corporate</td>
                <td className="border border-border p-3">PMs, execs, finance</td>
                <td className="border border-border p-3">Experience + outcomes</td>
                <td className="border border-border p-3">Reading like a dull PDF</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Want to see live layouts instead of descriptions? Browse the{" "}
          <Link href="/explore">explore page</Link> for real published sites, and the{" "}
          <Link href="/blog/clickfolio-templates-showcase">full template showcase</Link> to see all
          10 designs side by side.
        </p>
      </section>

      <section>
        <h2>What every resume website should include</h2>
        <p>Whatever style you pick, the content checklist is the same:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Name and headline.</strong> Your current or target role in plain words.
          </li>
          <li>
            <strong>Short summary.</strong> Two or three lines on what you do and the value you
            bring.
          </li>
          <li>
            <strong>Experience with outcomes.</strong> What changed because you were there.
          </li>
          <li>
            <strong>Skills and tools.</strong> Grouped, scannable, honest.
          </li>
          <li>
            <strong>Projects or work links.</strong> Proof, not just claims.
          </li>
          <li>
            <strong>Contact.</strong> One clear way to reach you.
          </li>
        </ol>
      </section>

      <section>
        <h2>How to build a site like these — free</h2>
        <p>
          You don't have to design from scratch to get an example-quality result. Upload your resume
          PDF to <Link href="/">clickfolio.me</Link> and the AI reads your details, then applies a
          professional template so your site comes out looking like the examples above in about 30
          seconds. Pick the style that fits your field, adjust a few lines, and publish at
          clickfolio.me/@yourname. If you'd rather follow each step, read{" "}
          <Link href="/blog/how-to-make-a-resume-website">how to make a resume website</Link>.
        </p>
      </section>

      <section>
        <h2>Stop bookmarking examples — build yours</h2>
        <p>
          The examples that impress you took their owners minutes, not weekends. Yours can too. Skip
          the blank-page problem and start from a template that already works.
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
