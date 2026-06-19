import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 3600;

const post = getPostBySlug("cv-website-builder")!;
const relatedPosts = ["best-resume-website-builders", "how-to-make-a-resume-website"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function CvWebsiteBuilderPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>What is a CV website builder?</h2>
        <p>
          A CV website builder is a tool that turns your CV into a hosted web page you can share
          with a link. The best ones read your existing CV and lay it out for you, so you don't
          rebuild your career by hand. <Link href="/">clickfolio.me</Link> does exactly this: upload
          a PDF, and it publishes a live site at <code>clickfolio.me/@yourhandle</code> in about 30
          seconds, free.
        </p>
        <p>
          There are two kinds of builders. Some give you a blank canvas and drag-and-drop blocks.
          The faster kind imports your CV automatically and skips the typing. This guide covers what
          to look for and how the options actually compare.
        </p>
      </section>

      <section>
        <h2>What features actually matter in a CV website builder?</h2>
        <p>
          Most builders list dozens of features. Only a few change whether you finish and whether
          the result helps you get hired:
        </p>
        <ul>
          <li>
            <strong>CV import.</strong> Can it read your PDF and fill the page for you, or do you
            retype everything? Import is the single biggest time-saver.
          </li>
          <li>
            <strong>Free hosting and a real URL.</strong> A site you can't share isn't a site. Check
            whether the link is free or paywalled.
          </li>
          <li>
            <strong>Mobile-ready templates.</strong> Recruiters open links on phones. The layout has
            to hold up on a small screen.
          </li>
          <li>
            <strong>Editing without code.</strong> You should be able to fix a job title or reorder
            sections in seconds.
          </li>
          <li>
            <strong>Privacy controls and analytics.</strong> Decide who sees your contact details,
            and see how many people viewed your page.
          </li>
        </ul>
      </section>

      <section>
        <h2>How do CV website builders compare?</h2>
        <p>
          Here's an honest look at common options. The right pick depends on whether you value speed
          or a hand-built design.
        </p>
        <div className="overflow-x-auto my-8 not-prose">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
            <thead>
              <tr>
                <th className="border border-border p-3 text-left font-semibold">Tool</th>
                <th className="border border-border p-3 text-left font-semibold">
                  Imports your CV?
                </th>
                <th className="border border-border p-3 text-left font-semibold">Cost</th>
                <th className="border border-border p-3 text-left font-semibold">Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3">clickfolio.me</td>
                <td className="border border-border p-3">Yes — AI reads your PDF</td>
                <td className="border border-border p-3">Free</td>
                <td className="border border-border p-3">
                  Turning an existing CV into a site fast
                </td>
              </tr>
              <tr>
                <td className="border border-border p-3">Carrd</td>
                <td className="border border-border p-3">No — build by hand</td>
                <td className="border border-border p-3">~$19/yr for a custom domain</td>
                <td className="border border-border p-3">Hand-built one-page sites</td>
              </tr>
              <tr>
                <td className="border border-border p-3">General site builders</td>
                <td className="border border-border p-3">No</td>
                <td className="border border-border p-3">Often paid plans</td>
                <td className="border border-border p-3">Full design control, more setup</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Carrd is genuinely good and cheap if you want to design a page block by block, and $19/yr
          for a custom domain is fair. But it won't read your CV — you build everything yourself.
          clickfolio.me trades some design freedom for speed: it imports the PDF and hosts the
          result free. For a fuller breakdown, see our{" "}
          <Link href="/blog/best-resume-website-builders">
            comparison of resume website builders
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>How do you turn your CV into a website?</h2>
        <p>With an AI builder, the process is short:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Export your CV as a PDF.</strong> Use the version you already send to employers.
          </li>
          <li>
            <strong>Upload it.</strong> The parser extracts your roles, education, skills, and
            contact info.
          </li>
          <li>
            <strong>Choose a template and edit.</strong> Pick from 10 designs and fix anything the
            parser missed.
          </li>
          <li>
            <strong>Publish and share.</strong> Your site is live at a clean handle you can paste
            anywhere.
          </li>
        </ol>
        <p>
          If you'd rather see the full manual walkthrough, our{" "}
          <Link href="/blog/how-to-make-a-resume-website">
            step-by-step guide to making a resume website
          </Link>{" "}
          covers both paths.
        </p>
      </section>

      <section>
        <h2>Are CV website builders free?</h2>
        <p>
          Some are. clickfolio.me is free forever for its core features — hosting, AI import, 10
          templates, privacy controls, and analytics. There's no paid tier; premium templates unlock
          through referrals, not payment. Many other tools call themselves free but charge for the
          parts you need: a custom domain, branding removal, or extra pages.
        </p>
        <p>
          One honest limit: custom domains aren't available on clickfolio.me yet. Your site lives at{" "}
          <code>clickfolio.me/@yourhandle</code>, which is on the roadmap to expand. For job
          applications and outreach, a clean handle does the job — and it costs nothing to claim
          yours.
        </p>
      </section>

      <section>
        <h2>Which builder should you choose?</h2>
        <p>
          If you want maximum design control and enjoy building pages, a hand-built tool like Carrd
          is a solid, affordable pick. If you want a professional CV site without the work, upload
          your PDF to clickfolio.me and you're done in under a minute. The fact that it's free and
          open source (MIT, hosted on Cloudflare) means there's little downside to trying it first.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Turn your CV into a website for free →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
