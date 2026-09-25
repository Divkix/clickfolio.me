import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("cv-website-builder")!;

const relatedPosts = ["best-resume-website-builders", "how-to-make-a-resume-website"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

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

      <PostSection
        heading="What features actually matter in a CV website builder?"
        intro="Most builders list dozens of features. Only a few change whether you finish and whether the result helps you get hired:"
      >
        <PostList
          items={[
            {
              lead: "CV import.",
              body: " Can it read your PDF and fill the page for you, or do you retype everything? Import is the single biggest time-saver.",
            },
            {
              lead: "Free hosting and a real URL.",
              body: " A site you can't share isn't a site. Check whether the link is free or paywalled.",
            },
            {
              lead: "Mobile-ready templates.",
              body: " Recruiters open links on phones. The layout has to hold up on a small screen.",
            },
            {
              lead: "Editing without code.",
              body: " You should be able to fix a job title or reorder sections in seconds.",
            },
            {
              lead: "Privacy controls and analytics.",
              body: " Decide who sees your contact details, and see how many people viewed your page.",
            },
          ]}
        />
      </PostSection>

      <PostSection
        heading="How do CV website builders compare?"
        intro="Here's an honest look at common options. The right pick depends on whether you value speed or a hand-built design."
      >
        <ComparisonTable
          headers={["Tool", "Imports your CV?", "Cost", "Best for"]}
          rows={[
            [
              "clickfolio.me",
              "Yes — AI reads your PDF",
              "Free",
              "Turning an existing CV into a site fast",
            ],
            [
              "Carrd",
              "No — build by hand",
              "~$19/yr for a custom domain",
              "Hand-built one-page sites",
            ],
            ["General site builders", "No", "Often paid plans", "Full design control, more setup"],
          ]}
        />
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
      </PostSection>

      <PostSection
        heading="How do you turn your CV into a website?"
        intro="With an AI builder, the process is short:"
      >
        <PostList
          ordered
          items={[
            {
              lead: "Export your CV as a PDF.",
              body: " Use the version you already send to employers.",
            },
            {
              lead: "Upload it.",
              body: " The parser extracts your roles, education, skills, and contact info.",
            },
            {
              lead: "Choose a template and edit.",
              body: " Pick from 10 designs and fix anything the parser missed.",
            },
            {
              lead: "Publish and share.",
              body: " Your site is live at a clean handle you can paste anywhere.",
            },
          ]}
        />
        <p>
          If you'd rather see the full manual walkthrough, our{" "}
          <Link href="/blog/how-to-make-a-resume-website">
            step-by-step guide to making a resume website
          </Link>{" "}
          covers both paths.
        </p>
      </PostSection>

      <section>
        <h2>Are CV website builders free?</h2>
        <p>
          Some are. clickfolio.me is free forever for its core features — hosting, AI import, 10
          templates, privacy controls, and analytics. There's no paid tier; premium templates unlock
          with no payment and no referral locks. Many other tools call themselves free but charge
          for the parts you need: a custom domain, branding removal, or extra pages.
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
          If you send a CV with every client proposal, see how it works as a{" "}
          <Link href="/for/consultant">portfolio website for consultants</Link>.
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
