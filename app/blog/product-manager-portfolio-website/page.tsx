import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("product-manager-portfolio-website")!;
const relatedPosts = ["resume-website-examples", "best-resume-website-builders"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function ProductManagerPortfolioWebsitePage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>What is a product manager portfolio website?</h2>
        <p>
          A product manager portfolio website is a hosted page that shows how you think, not just
          what you shipped. It walks recruiters through the problems you found, the decisions you
          made, and the outcomes you drove. A resume lists your titles. A portfolio proves your
          judgment.
        </p>
        <p>
          That distinction matters because PM hiring is a judgment test. Anyone can claim they
          "owned a roadmap." A portfolio lets a hiring manager watch you reason: how you framed a
          problem, what you cut, and why your bet paid off. That is the case you can't make in six
          bullet points.
        </p>
      </section>

      <section>
        <h2>Do product managers really need a portfolio?</h2>
        <p>
          More and more, yes. PM roles attract hundreds of applicants who all have similar resumes:
          a few shipped features, a metric or two, the right keywords. Recruiters spend about{" "}
          <strong>7.4 seconds</strong> on an initial resume scan (The Ladders eye-tracking, 2018),
          so you have almost no time to separate yourself on paper.
        </p>
        <p>
          A portfolio gives you a second surface — one you control. When a recruiter is interested
          enough to click your link, you get their full attention for the first time. That is where
          a strong case study turns a "maybe" into an interview. You don't need a portfolio to
          apply. You need one to stand out once you do.
        </p>
      </section>

      <section>
        <h2>What should a product manager portfolio include?</h2>
        <p>
          The goal is to show your product thinking end to end. A strong PM portfolio usually
          includes:
        </p>
        <ul>
          <li>
            <strong>A short positioning statement.</strong> One or two lines on the kind of products
            you build, the stage you thrive in, and the outcomes you care about.
          </li>
          <li>
            <strong>Two or three case studies.</strong> Depth beats breadth. A few deep stories
            prove more than a long list of shallow ones.
          </li>
          <li>
            <strong>Measurable outcomes.</strong> Activation, retention, revenue, time-to-ship —
            whatever your work actually moved. Numbers earn trust.
          </li>
          <li>
            <strong>Your process.</strong> How you discover problems, validate them, and prioritize.
            This is the part interviewers probe hardest.
          </li>
          <li>
            <strong>Skills and tools.</strong> Discovery methods, analytics, experimentation, and
            the cross-functional work you led.
          </li>
          <li>
            <strong>A clear way to reach you.</strong> Email and LinkedIn, easy to find.
          </li>
        </ul>
      </section>

      <section>
        <h2>How do you structure a PM case study?</h2>
        <p>Treat each case study like a product decision you can defend. A reliable structure:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>The problem and who had it.</strong> Name the user and the pain. Make the stakes
            obvious before you mention any feature.
          </li>
          <li>
            <strong>The evidence.</strong> The research, data, and signals that told you this was
            worth solving. Show that you didn't guess.
          </li>
          <li>
            <strong>The decision.</strong> What you prioritized, what you cut, and the tradeoff you
            accepted. This is where your judgment shows.
          </li>
          <li>
            <strong>The work.</strong> What you actually shipped, plus how you aligned engineering,
            design, and stakeholders to get there.
          </li>
          <li>
            <strong>The outcome.</strong> The measurable result, what you learned, and what you'd do
            differently. Honesty about a miss often reads stronger than a flawless win.
          </li>
        </ol>
        <p>
          Building these out is real work — and that effort pays off twice. The writing forces you
          to sharpen your own story, so you walk into interviews able to defend every decision. The
          portfolio you assemble yourself is one you're proud to send, because you know exactly
          what's behind every line.
        </p>
      </section>

      <section>
        <h2>How do I build a PM portfolio if my work is under NDA?</h2>
        <p>
          This stops a lot of PMs before they start, but it's a smaller problem than it looks. You
          can show your thinking without leaking anything confidential:
        </p>
        <ul>
          <li>
            <strong>Use ranges, not exact figures.</strong> "Improved activation by roughly 20–30%"
            communicates impact without exposing internal numbers.
          </li>
          <li>
            <strong>Describe the problem space generically.</strong> "A B2B onboarding flow with
            high drop-off" tells the story without naming the product.
          </li>
          <li>
            <strong>Lean on public work.</strong> Side projects, product teardowns, and analyses of
            apps you admire all demonstrate your process with zero NDA risk.
          </li>
          <li>
            <strong>Focus on reasoning over specifics.</strong> Interviewers care more about how you
            decided than the exact metric you moved.
          </li>
        </ul>
        <p>
          A teardown of a product everyone knows can be as convincing as a confidential case study,
          because it shows the same muscle: spotting a problem, weighing options, and arguing for a
          path.
        </p>
      </section>

      <section>
        <h2>How to publish a product manager portfolio fast</h2>
        <p>
          You don't need to code or pay a designer. If you already have a resume, you can be live in
          about 30 seconds:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Upload your resume PDF</strong> to <Link href="/">clickfolio.me</Link>. The AI
            reads your experience, skills, and education and builds a structured site.
          </li>
          <li>
            <strong>Pick a template.</strong> There are 10 to choose from, so you can match the tone
            you want.
          </li>
          <li>
            <strong>Add your case studies and outcomes</strong> in the editor, then refine the
            wording.
          </li>
          <li>
            <strong>Publish</strong> to <code>clickfolio.me/@yourhandle</code> and share the link.
          </li>
        </ol>
        <p>
          It's free forever — no paid tier — and built-in analytics show you how many people opened
          your portfolio, so you can tell which applications actually got read. Custom domains
          aren't available yet; your site lives at your clickfolio.me handle for now. If you want to
          see how others structure theirs, browse{" "}
          <Link href="/blog/resume-website-examples">resume website examples</Link> or read the role
          guide for <Link href="/for/product-manager">product managers</Link> before you start.
        </p>
      </section>

      <section>
        <h2>Make your thinking the thing they remember</h2>
        <p>
          Every PM applicant has shipped something. Far fewer can show how they think. A portfolio
          closes that gap, and the act of building it makes you a sharper candidate before you ever
          send the link. Start with the resume you already have and turn it into a site you're proud
          to share.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Turn your resume into a PM portfolio in about 30 seconds →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
