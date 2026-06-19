import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("best-resume-website-builders")!;
const relatedPosts = ["pdf-resume-to-website", "clickfolio-templates-showcase"]
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

export default function BestResumeWebsiteBuildersPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          Most "best resume website builder" lists compare tools that do completely different jobs.
          A resume builder that exports a PDF is not the same as a one-page site builder, and
          neither is the same as a tool that turns your existing resume into a hosted portfolio. The
          right pick depends on what you already have and what you want to end up with.
        </p>
        <p>
          This guide compares seven tools that real people actually use in 2026, plus one that
          recently shut down. For each one we cover what it is, what the free tier gives you,
          whether you can use your own domain, and whether it can import a resume you already wrote.
          We build{" "}
          <Link href="/" className="text-brand font-semibold">
            clickfolio.me
          </Link>
          , so treat us as a biased-but-honest source: we have noted where we fall short, including
          the fact that we do not support custom domains yet.
        </p>
      </section>

      <section>
        <h2>The comparison at a glance</h2>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr className="bg-surface-2 text-foreground">
                <th className="border border-border p-3 text-left font-semibold">Tool</th>
                <th className="border border-border p-3 text-left font-semibold">What it is</th>
                <th className="border border-border p-3 text-left font-semibold">Free tier</th>
                <th className="border border-border p-3 text-left font-semibold">Custom domain</th>
                <th className="border border-border p-3 text-left font-semibold">
                  Imports your resume?
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="bg-card">
                <td className="border border-border p-3 font-semibold text-foreground">
                  clickfolio.me
                </td>
                <td className="border border-border p-3">AI resume-to-website</td>
                <td className="border border-border p-3 text-brand font-semibold">Free forever</td>
                <td className="border border-border p-3">Not yet (clickfolio.me/@handle)</td>
                <td className="border border-border p-3">Yes — PDF, parsed by AI</td>
              </tr>
              <tr>
                <td className="border border-border p-3 font-semibold text-foreground">
                  Standard Resume
                </td>
                <td className="border border-border p-3">Resume builder + hosted web resume</td>
                <td className="border border-border p-3">Free Basic</td>
                <td className="border border-border p-3">Custom slug only (Pro $19/mo)</td>
                <td className="border border-border p-3">LinkedIn import</td>
              </tr>
              <tr className="bg-card">
                <td className="border border-border p-3 font-semibold text-foreground">Carrd</td>
                <td className="border border-border p-3">General one-page site builder</td>
                <td className="border border-border p-3">3 sites on a subdomain</td>
                <td className="border border-border p-3">Yes, Pro Standard $19/yr</td>
                <td className="border border-border p-3">No — build by hand</td>
              </tr>
              <tr>
                <td className="border border-border p-3 font-semibold text-foreground">Super.so</td>
                <td className="border border-border p-3">Notion-to-website builder</td>
                <td className="border border-border p-3">1 site on super.site</td>
                <td className="border border-border p-3">Yes, from $16/mo</td>
                <td className="border border-border p-3">No — content lives in Notion</td>
              </tr>
              <tr className="bg-card">
                <td className="border border-border p-3 font-semibold text-foreground">
                  Reactive Resume
                </td>
                <td className="border border-border p-3">Open-source resume builder</td>
                <td className="border border-border p-3">Free / self-hostable</td>
                <td className="border border-border p-3">Only if self-hosted</td>
                <td className="border border-border p-3">JSON / LinkedIn</td>
              </tr>
              <tr>
                <td className="border border-border p-3 font-semibold text-foreground">
                  JSON Resume
                </td>
                <td className="border border-border p-3">Open JSON standard + themes</td>
                <td className="border border-border p-3">Free</td>
                <td className="border border-border p-3">Depends on where you deploy</td>
                <td className="border border-border p-3">JSON / CLI / gists</td>
              </tr>
              <tr className="bg-card">
                <td className="border border-border p-3 font-semibold text-foreground">
                  Kickresume
                </td>
                <td className="border border-border p-3">AI resume builder + website feature</td>
                <td className="border border-border p-3">Free plan (Premium ~$8/mo)</td>
                <td className="border border-border p-3">Not clearly documented</td>
                <td className="border border-border p-3">AI-assisted entry</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Read.cv used to belong on this list. It was acquired by Perplexity in January 2025 and
          wound down through the year, with data export ending May 16, 2025. It is no longer
          available, so if you had a profile there, head to our{" "}
          <Link href="/blog/read-cv-alternatives" className="text-brand font-semibold">
            Read.cv alternatives guide
          </Link>{" "}
          instead.
        </p>
      </section>

      <section>
        <h2>The reviews</h2>

        <h3>clickfolio.me — best for turning an existing resume into a hosted site for free</h3>
        <p>
          If you already have a PDF resume, clickfolio.me is the fastest way to get a hosted site
          out of it. You upload the PDF, the AI reads it into structured sections, and about thirty
          seconds later you have a live page at clickfolio.me/@yourhandle. There are ten templates
          (six free, four unlocked through referrals rather than money), field-level privacy toggles
          so you can hide a phone number or address, and built-in analytics. Hosting runs on
          Cloudflare, and the project is open source under the MIT license.
        </p>
        <p>
          The honest weaknesses: there is no custom-domain support yet, so every site lives on a
          clickfolio.me/@handle URL for now. And the nicest four templates require you to refer
          other people before they unlock. If a personal domain is a hard requirement today, one of
          the paid tools below will serve you better. If free hosting and a thirty-second setup
          matter more, start with{" "}
          <Link href="/" className="text-brand font-semibold">
            the builder
          </Link>{" "}
          and read{" "}
          <Link href="/blog/how-to-make-a-resume-website" className="text-brand font-semibold">
            how to make a resume website
          </Link>{" "}
          if you want the full walkthrough.
        </p>

        <h3>Standard Resume — clean recruiter-friendly web resume</h3>
        <p>
          Standard Resume builds a polished single-page web resume from your details and can pull
          from a LinkedIn import to save typing. The templates look great in front of recruiters,
          which is the whole point. The catch is that the web features sit behind the Pro plan at
          $19/month, including the custom web-resume URL and view tracking. The free Basic tier is
          usable, but the result is a web resume rather than a customizable portfolio with multiple
          sections. Good fit if you want a tidy online version of your resume and do not mind the
          monthly cost.
        </p>

        <h3>Carrd — cheap and flexible, but you design everything</h3>
        <p>
          Carrd is a general one-page site builder, not a resume tool. You get three sites free on a
          Carrd subdomain with light branding, and a custom domain starts at $19/year on the Pro
          Standard plan (the $9/year Pro Lite tier does not include a custom domain). It is
          genuinely cheap and very flexible. The trade-off is that there is no resume import at all.
          You start from a blank canvas and lay out every block yourself, so plan for an afternoon
          of design work if you go this route.
        </p>

        <h3>Super.so — fast pages if you already live in Notion</h3>
        <p>
          Super.so turns a Notion workspace into a website, so if your resume and projects already
          live in Notion, you can publish quickly and keep editing in a tool you know. Free sites
          run on a super.site subdomain with a small badge, and a custom domain starts at $16/month
          on the Personal plan. It is not resume-specific and it assumes you are comfortable
          structuring content in Notion, which makes it a better fit for people who already use
          Notion daily than for someone starting from a PDF.
        </p>

        <h3>Reactive Resume — free and private, but the output is a resume</h3>
        <p>
          Reactive Resume is a well-regarded open-source resume builder. It is free to use, you can
          self-host it, and it imports from JSON or LinkedIn. For privacy-minded people who want
          full control, it is hard to beat on principle. The thing to understand is what it
          produces: a resume document or a shareable link and PDF, not a full portfolio site. The
          hosted version has no custom domain, and a custom domain is only possible if you
          self-host. Pick it if a clean, free resume is the goal rather than a website.
        </p>

        <h3>JSON Resume — an open standard for developers</h3>
        <p>
          JSON Resume is a community-built open standard: you describe your resume in a JSON file
          and render it with any of 400-plus themes. It is free and refreshingly portable, since
          your data is not locked into one company. It is also clearly a developer workflow built
          around JSON, a CLI, and gists, with no polished AI parsing or PDF import. If you are
          technical and want a format you fully own, it is excellent. Everyone else will find the
          setup fiddly.
        </p>

        <h3>Kickresume — resume builder with a website add-on</h3>
        <p>
          Kickresume is primarily an AI resume builder with strong writing help and ATS-oriented
          features, and it includes a one-click personal website option. There is a free plan, with
          Premium starting around $8/month. The website is a secondary feature rather than the main
          event, and custom-domain support is not clearly documented, since published sites appear
          on a Kickresume URL. Worth a look if you want resume writing help first and a simple
          website second.
        </p>
      </section>

      <section>
        <h2>How to choose</h2>
        <ul>
          <li>
            <strong>You already have a PDF resume and want it hosted for free:</strong> start with{" "}
            <Link href="/" className="text-brand font-semibold">
              clickfolio.me
            </Link>
            . Just know the URL stays on clickfolio.me/@handle for now.
          </li>
          <li>
            <strong>You need a personal domain today:</strong> Carrd ($19/year) is the cheapest
            path, with Standard Resume and Super.so as paid alternatives.
          </li>
          <li>
            <strong>You want a resume document, not a website:</strong> Reactive Resume or JSON
            Resume, both free and open source.
          </li>
          <li>
            <strong>You want help writing the resume itself:</strong> Kickresume leans into AI
            writing and ATS checks.
          </li>
          <li>
            <strong>You came from Read.cv:</strong> it is gone, so see our{" "}
            <Link href="/blog/read-cv-alternatives" className="text-brand font-semibold">
              Read.cv alternatives guide
            </Link>
            .
          </li>
        </ul>
        <p>
          If your starting point is LinkedIn rather than a PDF, our guide on{" "}
          <Link href="/blog/linkedin-to-portfolio" className="text-brand font-semibold">
            turning a LinkedIn profile into a portfolio
          </Link>{" "}
          covers that path, and you can browse{" "}
          <Link href="/explore" className="text-brand font-semibold">
            real published sites
          </Link>{" "}
          to see what each style looks like in practice.
        </p>
      </section>

      <section>
        <h2>Try it yourself</h2>
        <p>
          The fastest way to compare these tools is to publish with one and judge the result. With a
          PDF in hand, clickfolio.me gets you a live page in about thirty seconds, free, with no
          credit card, and you can delete everything whenever you want.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and compare for yourself →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
