import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("best-resume-website-builders")!;

export function generateMetadata(): Metadata {
  if (!post) return {};
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
    robots: { index: true, follow: true },
  };
}

export default function BestResumeWebsiteBuildersPage() {
  return (
    <BlogPostLayout post={post}>
      <section>
        <p>
          The tool you choose to build your resume website matters. It affects how fast your site
          loads, how it looks on mobile, whether recruiters can find you on Google, and how much
          control you have over your data.
        </p>
        <p>
          We tested 8 resume-to-website tools — ranking them on template quality, ease of use,
          pricing, privacy, editing flexibility, and real web hosting. Here's what we found.
        </p>
      </section>

      <section>
        <h2>The Comparison at a Glance</h2>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse border-2 border-ink text-sm">
            <thead>
              <tr className="bg-ink text-cream">
                <th className="border-2 border-ink p-3 text-left font-bold">Tool</th>
                <th className="border-2 border-ink p-3 text-left font-bold">Templates</th>
                <th className="border-2 border-ink p-3 text-left font-bold">Free Tier</th>
                <th className="border-2 border-ink p-3 text-left font-bold">Real Hosting</th>
                <th className="border-2 border-ink p-3 text-left font-bold">Privacy Controls</th>
              </tr>
            </thead>
            <tbody className="text-ink/70">
              <tr className="bg-cream">
                <td className="border-2 border-ink p-3 font-semibold text-ink">clickfolio.me</td>
                <td className="border-2 border-ink p-3">10</td>
                <td className="border-2 border-ink p-3 text-coral font-semibold">Free forever</td>
                <td className="border-2 border-ink p-3">Yes (Cloudflare)</td>
                <td className="border-2 border-ink p-3">Granular field-level</td>
              </tr>
              <tr>
                <td className="border-2 border-ink p-3 font-semibold text-ink">Magic Self</td>
                <td className="border-2 border-ink p-3">3</td>
                <td className="border-2 border-ink p-3">Open source</td>
                <td className="border-2 border-ink p-3">Self-hosted only</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
              <tr className="bg-cream">
                <td className="border-2 border-ink p-3 font-semibold text-ink">DockPage</td>
                <td className="border-2 border-ink p-3">5</td>
                <td className="border-2 border-ink p-3">Limited</td>
                <td className="border-2 border-ink p-3">Yes</td>
                <td className="border-2 border-ink p-3">Basic</td>
              </tr>
              <tr>
                <td className="border-2 border-ink p-3 font-semibold text-ink">SpaceLoom</td>
                <td className="border-2 border-ink p-3">4</td>
                <td className="border-2 border-ink p-3">1 page free</td>
                <td className="border-2 border-ink p-3">Subdomain</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
              <tr className="bg-cream">
                <td className="border-2 border-ink p-3 font-semibold text-ink">EZfolio CV</td>
                <td className="border-2 border-ink p-3">6</td>
                <td className="border-2 border-ink p-3">Free</td>
                <td className="border-2 border-ink p-3">Subdomain</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
              <tr>
                <td className="border-2 border-ink p-3 font-semibold text-ink">Refolio</td>
                <td className="border-2 border-ink p-3">8</td>
                <td className="border-2 border-ink p-3">7-day trial</td>
                <td className="border-2 border-ink p-3">Yes</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
              <tr className="bg-cream">
                <td className="border-2 border-ink p-3 font-semibold text-ink">CVPage</td>
                <td className="border-2 border-ink p-3">3</td>
                <td className="border-2 border-ink p-3">Free</td>
                <td className="border-2 border-ink p-3">Subdomain</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
              <tr>
                <td className="border-2 border-ink p-3 font-semibold text-ink">Reactive Resume</td>
                <td className="border-2 border-ink p-3">2 (PDF only)</td>
                <td className="border-2 border-ink p-3">Open source</td>
                <td className="border-2 border-ink p-3">Self-hosted only</td>
                <td className="border-2 border-ink p-3">None</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Detailed Reviews</h2>

        <h3>clickfolio.me — Best Overall</h3>
        <p>
          clickfolio.me takes the top spot for one simple reason: it's the only tool that combines
          AI-powered PDF parsing, real web hosting, generous free tier, and granular privacy
          controls in one package. Upload your existing PDF resume, and within 30 seconds you have a
          live, hosted website at <code>@yourname</code>. Ten templates range from ATS-friendly
          classics to bold creative designs, and you can switch between them instantly without
          losing content. Built-in analytics show who's viewing your portfolio. Privacy controls let
          you toggle individual fields on or off. And it's free forever — premium templates unlock
          through referrals, not payment.
        </p>

        <h3>Magic Self — Best for Developers Who Want Full Control</h3>
        <p>
          Magic Self is an open-source project that generates a static portfolio site from your
          resume data. It's well-built, and if you're comfortable with Git, npm, and deploying to
          Vercel or Netlify, it works. But that's the catch — you need to be a developer. There's no
          hosted version, no AI parsing, and only 3 basic templates. It's a good starting point for
          a dev who wants to customize everything, but it's not a turnkey solution for most
          professionals.
        </p>

        <h3>DockPage — Good LinkedIn Integration, Weak Free Tier</h3>
        <p>
          DockPage's strength is LinkedIn import — it pulls your profile data and builds a page from
          it. This saves time if your LinkedIn is up to date. But the free tier is bare-bones:
          limited customization, watermarks, and no analytics. Templates feel dated compared to
          modern design standards. If you're willing to pay, the premium tier unlocks more, but for
          most users, a free alternative with more features makes more sense.
        </p>

        <h3>SpaceLoom — Fast, but Inflexible</h3>
        <p>
          SpaceLoom generates a portfolio quickly from your resume, and the templates are clean and
          modern. But once generated, editing is minimal — you can't add sections, rearrange
          content, or switch designs. You get one free page on a subdomain. For a quick one-off
          page, it works. For an ongoing professional presence you can update and control, it falls
          short.
        </p>

        <h3>EZfolio CV — Decent Free Option, Limited Polish</h3>
        <p>
          EZfolio CV offers 6 templates and a free tier, which is generous. But the hosting is on a
          subdomain (ezfolio.com/yourname), the templates lack polish, and there are no privacy
          controls or analytics. It's a step above a PDF, but not by much.
        </p>

        <h3>Refolio — Beautiful Designs, No Free Tier</h3>
        <p>
          Refolio has some of the best-looking templates in this comparison — they're modern,
          animated, and visually striking. But there's no free tier beyond a 7-day trial, and the
          pricing is steep for what you get. If design is your absolute priority and you don't mind
          paying, it's worth a look. For everyone else, free tools with comparable design quality
          exist.
        </p>

        <h3>CVPage — Basic but Functional</h3>
        <p>
          CVPage is a simple, free tool with 3 templates. It gets the job done if you want something
          basic. But it lacks AI parsing, so you're entering data manually. No privacy controls, no
          analytics, and templates that look like they're from 2019. Fine for a first portfolio, but
          you'll outgrow it quickly.
        </p>

        <h3>Reactive Resume — PDF Builder, Not a Portfolio Site</h3>
        <p>
          Reactive Resume is an excellent open-source resume builder — for PDFs. It creates
          beautiful resume documents with a drag-and-drop editor. But it doesn't create websites. If
          you need a PDF resume, it's one of the best tools out there. If you need a live portfolio
          website, it's not what you're looking for.
        </p>
      </section>

      <section>
        <h2>Why clickfolio.me Wins for Most People</h2>
        <ul>
          <li>
            <strong>10 templates</strong> — from ATS-optimized (ClassicATS) to bold creative
            (NeoBrutalist) to developer-focused (DevTerminal). Something for every profession.
          </li>
          <li>
            <strong>Real web hosting</strong> — your site lives on Cloudflare's global edge network,
            not a third-party subdomain. Fast load times everywhere.
          </li>
          <li>
            <strong>Privacy controls</strong> — granular toggles for phone, address, and directory
            visibility. No other free tool offers this.
          </li>
          <li>
            <strong>Free forever</strong> — core features are free. Premium templates unlock via
            referrals, not a credit card.
          </li>
          <li>
            <strong>AI parsing + editing</strong> — don't type anything. Upload your PDF, review the
            AI output, and publish. Full editor available for changes.
          </li>
        </ul>
      </section>

      <section>
        <h2>When to Choose Another Tool</h2>
        <p>clickfolio.me isn't for everyone. Here's when alternatives might be better:</p>
        <ul>
          <li>
            If you're a developer who wants complete code control and custom deployment, Magic Self
            gives you that.
          </li>
          <li>
            If your LinkedIn is your single source of truth and you never touch a PDF, DockPage's
            import might be faster.
          </li>
          <li>
            If you need a PDF resume (not a website), Reactive Resume builds beautiful documents.
          </li>
          <li>
            If you have budget for a paid tool and design is your top priority, Refolio's templates
            are gorgeous.
          </li>
        </ul>
        <p>
          For everyone else — especially if you already have a PDF resume — clickfolio.me is the
          fastest path from document to live portfolio.
        </p>
      </section>

      <section>
        <h2>Try It Yourself</h2>
        <p>
          The best way to compare tools is to try them. Upload your resume to clickfolio.me and see
          what you get in 30 seconds. It's free, no credit card required, and you can delete your
          account anytime.
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Upload your resume and build your portfolio →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
