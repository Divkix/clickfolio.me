import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 3600;

const post = getPostBySlug("resume-website-vs-linkedin")!;
const relatedPosts = ["linkedin-to-portfolio", "personal-resume-website"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function ResumeWebsiteVsLinkedinPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>Resume website or LinkedIn: which do you need?</h2>
        <p>
          You need both, because they do different jobs. LinkedIn gives you reach and recruiter
          discovery on a network of about 1.3 billion users (2026). A resume website gives you
          control, custom design, your own analytics, and a real shot at ranking in Google for your
          name. One helps people find you; the other decides what they see.
        </p>
        <p>
          Treating it as a choice is the mistake. The strongest setup uses LinkedIn for distribution
          and a site you own for the full, curated story of your work.
        </p>
      </section>

      <section>
        <h2>How are a resume website and LinkedIn different?</h2>
        <p>
          They optimize for opposite things. LinkedIn optimizes for the network — its layout, its
          algorithm, its features. A resume website optimizes for you. Here's how they compare on
          the factors that affect a job search:
        </p>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Factor</th>
                <th className="border border-border p-3 text-left font-semibold">Resume website</th>
                <th className="border border-border p-3 text-left font-semibold">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">Ownership</td>
                <td className="border border-border p-3">You own the page and its content</td>
                <td className="border border-border p-3">LinkedIn owns and controls it</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Design</td>
                <td className="border border-border p-3">Your choice of template and layout</td>
                <td className="border border-border p-3">Same look as every other profile</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Reach</td>
                <td className="border border-border p-3">You drive the traffic</td>
                <td className="border border-border p-3">Built-in network of ~1.3B users</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Recruiter discovery</td>
                <td className="border border-border p-3">Limited without promotion</td>
                <td className="border border-border p-3">Strong; recruiters search here</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Google ranking for your name</td>
                <td className="border border-border p-3">Strong with your name in the URL</td>
                <td className="border border-border p-3">Competes with every other profile</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Analytics</td>
                <td className="border border-border p-3">Full view data on your visitors</td>
                <td className="border border-border p-3">Partial, and gated by plan</td>
              </tr>
              <tr>
                <td className="border border-border p-3">Cost</td>
                <td className="border border-border p-3">Free on clickfolio.me</td>
                <td className="border border-border p-3">Free; some features paid</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>What does a resume website do better?</h2>
        <p>It gives you control of the things LinkedIn keeps for itself:</p>
        <ul>
          <li>
            <strong>You own it.</strong> Your site doesn't disappear if a platform changes its rules
            or removes a feature you relied on. What you build stays yours.
          </li>
          <li>
            <strong>You design it.</strong> Pick from 10 templates and shape the layout. On LinkedIn
            your profile looks like everyone else's.
          </li>
          <li>
            <strong>You see real analytics.</strong> Know how many people opened your site and which
            applications actually got read — not a partial, gated view.
          </li>
          <li>
            <strong>You can rank for your name.</strong> A page with your name in the URL, title,
            and headings has a real shot at appearing when someone Googles you.
          </li>
        </ul>
        <p>
          That last point compounds. Every visit and every link to your site builds its authority
          over time, while a LinkedIn profile's ranking rides on LinkedIn's domain, not yours.
        </p>
      </section>

      <section>
        <h2>What does LinkedIn do better?</h2>
        <p>
          Reach and discovery, full stop. Recruiters live on LinkedIn and search it daily, and its
          ~1.3 billion users make it the default place people look you up. You can't replicate that
          network with a standalone site, and you shouldn't try. LinkedIn is how people find you
          before they've ever heard your name.
        </p>
        <p>
          The catch is that everything LinkedIn shows runs through its algorithm and its template.
          You get the audience, but you give up the controls. That's exactly the gap a resume
          website fills.
        </p>
      </section>

      <section>
        <h2>Why using both wins</h2>
        <p>
          Use LinkedIn to be discovered and to connect. Use your website as the destination — the
          place you send anyone who wants the full story. LinkedIn is the introduction; your site is
          the conversation. Put your site link in your LinkedIn Featured section, your contact info,
          and your email signature, so the reach you get on LinkedIn flows to the page you control.
        </p>
        <p>
          If your LinkedIn profile is your most current record, you can turn it into a site in
          minutes — export it as a PDF and upload it. We walk through the exact steps in{" "}
          <Link href="/blog/linkedin-to-portfolio">turning LinkedIn into a portfolio</Link>, and you
          can see how a focused personal site is built in{" "}
          <Link href="/blog/personal-resume-website">our guide to personal resume websites</Link>.
        </p>
      </section>

      <section>
        <h2>Claim the part you can own</h2>
        <p>
          You can't control LinkedIn, but you can control your own site — and the professionals who
          stand out are the ones who own both ends of their presence. Keep LinkedIn for reach, and
          build the page that's entirely yours.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Build the resume website you actually own →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
