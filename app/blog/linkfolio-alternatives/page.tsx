import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("linkfolio-alternatives")!;

const relatedPosts = ["best-resume-website-builders", "linkedin-to-portfolio"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function LinkfolioAlternativesPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          If you want a free alternative to Linkfolio that turns your resume into a website,{" "}
          <Link href="/">clickfolio.me</Link> is the closest match: upload a PDF resume or your
          LinkedIn PDF export and get a hosted site at clickfolio.me/@yourname in about 30 seconds.
          If you need your own domain today, Linkfolio's own Basic plan, Butternut AI Pro, or
          Fastfolio Pro are better picks, because clickfolio.me doesn't support custom domains yet.
        </p>
        <p>
          We build clickfolio.me, so we're biased. We've tried to be fair anyway, including about
          the places where Linkfolio is ahead of us. All prices and plan details below were checked
          on the vendors' own sites in September 2026.
        </p>
      </section>

      <section>
        <h2>Which Linkfolio is this page about?</h2>
        <p>
          At least seven unrelated products use the Linkfolio name, which makes searching for
          alternatives confusing. Most "Linkfolio alternatives" articles you'll find are about a
          different product than the one you probably mean. This page covers the two that turn a
          resume into a portfolio website:
        </p>
        <PostList
          items={[
            {
              lead: "linkfolio.net",
              body: (
                <>
                  {" "}
                  (often searched as "Linkfolio AI"). An AI portfolio builder you feed by chat,
                  voice, or resume upload. See{" "}
                  <a href="https://linkfolio.net/" rel="noopener">
                    linkfolio.net
                  </a>
                  .
                </>
              ),
            },
            {
              lead: "linkfolio.cv",
              body: (
                <>
                  {" "}
                  A free portfolio builder with resume import from PDF, DOCX, or TXT. See{" "}
                  <a href="https://linkfolio.cv/" rel="noopener">
                    linkfolio.cv
                  </a>
                  .
                </>
              ),
            },
          ]}
        />
        <p>
          It doesn't cover the "LinkFolio AI" new-tab Chrome extension, the link-in-bio tools on
          linkfolio.io and linkfolio.ai, the older Famepick link-in-bio on linkfolio.org, or the
          hiring tool on linkfolio.live. If you were after a link-in-bio page, you want a different
          kind of tool than anything listed here.
        </p>
      </section>

      <section>
        <h2>What Linkfolio does well</h2>
        <p>
          Before switching, it's worth knowing what you'd give up. linkfolio.net has a few features
          we don't offer:
        </p>
        <PostList
          items={[
            {
              lead: "Custom domains.",
              body: " The Basic plan (€4.99/month) lets you connect your own domain. clickfolio.me can't do this yet; it's on our roadmap.",
            },
            {
              lead: "AI translation.",
              body: " Basic includes one translation language and Pro (€9.99/month) includes ten. Useful if you apply for jobs in more than one country.",
            },
            {
              lead: "PDF export and a contact QR code.",
              body: " You can export a PDF resume from your portfolio and share a QR code that saves you as a contact.",
            },
            {
              lead: "Several ways to start.",
              body: " Besides uploading a resume, you can build your portfolio by chatting or talking to the AI.",
            },
          ]}
        />
        <p>
          linkfolio.cv's strengths are different. It's free, it offers 14+ themes, and you can keep
          up to five portfolios on one free account, which helps if you want separate versions for
          different roles.
        </p>
      </section>

      <section>
        <h2>Why people look for a Linkfolio alternative</h2>
        <p>
          The common reasons are cost, branding, and fit. linkfolio.net's free plan puts your site
          on a .linkfolio.net subdomain with a "Made with Linkfolio" watermark; removing it and
          getting a custom domain means paying monthly in euros. linkfolio.cv is free, but its
          homepage makes no claims about AI parsing or custom domains, and your URL is a path on its
          domain (linkfolio.cv/yourname). And neither one says it imports LinkedIn directly.
          linkfolio.net's only LinkedIn mention is linking your profiles from your portfolio.
        </p>
      </section>

      <section>
        <h2>Linkfolio alternatives compared (September 2026)</h2>
        <ComparisonTable
          headers={["Tool", "Starts from", "Free plan", "Paid plans", "Custom domain"]}
          rows={[
            [
              "linkfolio.net",
              "Resume upload, chat, or voice",
              "Yes, .linkfolio.net subdomain with watermark",
              "€4.99/mo Basic, €9.99/mo Pro",
              "Yes, Basic and up",
            ],
            [
              "linkfolio.cv",
              "Resume (PDF, DOCX, TXT)",
              "Yes, up to 5 portfolios",
              "None listed",
              "Not mentioned (URL is linkfolio.cv/name)",
            ],
            [
              "clickfolio.me",
              "PDF resume or LinkedIn PDF export",
              "Yes, everything free, 10 templates",
              "None",
              "Not yet (on the roadmap)",
            ],
            [
              "Butternut AI",
              "Resume/CV PDF",
              "Yes, yourname.butternut.ai, 20 AI credits",
              "$5/mo Starter, $12/mo Pro",
              "Yes, Pro",
            ],
            [
              "Fastfolio",
              "Resume, LinkedIn, GitHub",
              "Yes, with watermark",
              "$8/mo Pro, $49 lifetime (your own OpenAI key)",
              "Yes, Pro and Lifetime",
            ],
            [
              "Kickresume",
              "LinkedIn import or a Kickresume resume",
              "1 basic website template",
              "$24/mo, or $8/mo billed yearly",
              "Not stated",
            ],
            [
              "Reactive Resume",
              "JSON, PDF, or Word (AI import with your own key)",
              "Entirely free, open source",
              "None",
              "Only if you self-host",
            ],
          ]}
        />
      </section>

      <section>
        <h2>What the comparison table doesn't show</h2>
        <p>
          Prices and plan names are the easy part. A few other things matter once your link is on a
          resume and in front of recruiters.
        </p>
        <p>
          <strong>Your URL.</strong> Subdomains (yourname.linkfolio.net, yourname.butternut.ai) and
          paths (linkfolio.cv/yourname, clickfolio.me/@yourname) both work fine on an application.
          What matters more is that the link won't change. If you think you'll want your own domain
          within a year, pick a tool that supports it now so you only update your links once.
        </p>
        <p>
          <strong>Watermarks.</strong> linkfolio.net and Fastfolio both put a "made with" badge on
          free sites. Most recruiters won't care, but some people find it looks unfinished on a
          personal brand page. clickfolio.me, linkfolio.cv, and Reactive Resume don't make you pay
          to remove one.
        </p>
        <p>
          <strong>How much retyping you'll do.</strong> Every tool here claims some kind of import,
          and parsing quality varies. Two-column layouts, tables, and unusual section headings trip
          up most parsers. Whichever tool you try, budget ten minutes to check dates, job titles,
          and bullet points after the import.
        </p>
        <p>
          <strong>What happens if the tool disappears.</strong> Small portfolio builders come and
          go. Keep an up-to-date PDF of your resume outside any platform, so rebuilding somewhere
          else takes minutes instead of an afternoon. Open-source tools also let you see exactly how
          your data is stored.
        </p>
      </section>

      <section>
        <h2>The alternatives, one by one</h2>

        <h3>clickfolio.me: free resume-to-website in about 30 seconds</h3>
        <p>
          Upload a PDF resume and our AI reads your experience, education, and skills, then builds
          an editable site on one of 10 templates. If your resume is out of date, export your
          LinkedIn profile with "Save to PDF" and upload that instead; our{" "}
          <Link href="/blog/linkedin-to-portfolio">LinkedIn to portfolio guide</Link> walks through
          it. Every feature is free, including field-level privacy toggles (hide your phone number
          or address) and built-in view analytics. The code is open source under the MIT license.
        </p>
        <p>
          The trade-offs: no custom domain yet, no translation, and no PDF export from your site.
          Your page lives at clickfolio.me/@yourname. If you're curious how well the parsing holds
          up on messy resumes, we published our{" "}
          <Link href="/blog/ai-resume-parsing-accuracy">AI resume parsing accuracy tests</Link>.
        </p>

        <h3>Butternut AI: closest to linkfolio.net's pricing model</h3>
        <p>
          Butternut builds a portfolio from an uploaded resume or CV PDF. The free plan gives you a
          yourname.butternut.ai subdomain and 20 AI credits. Starter is $5/month and Pro is
          $12/month, and Pro adds a custom domain. If you liked linkfolio.net's resume upload and
          want to pay in dollars, this is the most direct swap.
        </p>

        <h3>Fastfolio: an AI you can chat with about your work</h3>
        <p>
          Fastfolio takes a different angle. Visitors can ask an AI version of you questions about
          your experience. It imports from a resume, LinkedIn, or GitHub and is aimed at developers,
          AI engineers, and freelancers. The free plan carries a watermark; Pro is $8/month (or
          $96/year) and Lifetime is $49 once if you bring your own OpenAI key. Both paid plans
          support a custom domain.
        </p>

        <h3>Kickresume: resume builder first, website second</h3>
        <p>
          Kickresume is mainly a resume builder, but it can publish your resume as a website, and it
          imports from LinkedIn. One basic website template is free. Paid plans are $24/month, or
          $8/month billed yearly ($96). It makes sense if you'll also use it to write and design
          your PDF resume.
        </p>

        <h3>Reactive Resume: open source and self-hostable</h3>
        <p>
          Reactive Resume is free and MIT-licensed, like clickfolio.me. It can import JSON, JSON
          Resume, PDF, and Word files, with AI import powered by a key you supply (OpenAI,
          Anthropic, Gemini, OpenRouter, or Ollama). Public resumes can be password-protected. It
          has no native LinkedIn import as of September 2026, and the result looks like a resume
          more than a portfolio. Self-hosting is the route to your own domain.
        </p>
      </section>

      <PostSection
        heading="How to choose a Linkfolio alternative"
        intro="Start with the one thing you can't live without:"
      >
        <PostList
          items={[
            {
              lead: "You need your own domain now:",
              body: " stay on linkfolio.net Basic, or move to Butternut AI Pro or Fastfolio Pro.",
            },
            {
              lead: "You need your site in several languages:",
              body: " linkfolio.net is the only tool here with built-in AI translation.",
            },
            {
              lead: "You want it free with no watermark:",
              body: " clickfolio.me, linkfolio.cv, or Reactive Resume.",
            },
            {
              lead: "You're starting from LinkedIn:",
              body: " clickfolio.me (via the LinkedIn PDF), Fastfolio, or Kickresume.",
            },
            {
              lead: "You want to control the code:",
              body: " clickfolio.me or Reactive Resume, both MIT-licensed.",
            },
          ]}
        />
        <p>
          For a wider look beyond AI tools, including Carrd and Standard Resume, see our roundup of
          the{" "}
          <Link href="/blog/best-resume-website-builders">best free resume website builders</Link>.
        </p>
      </PostSection>

      <section>
        <h2>How to move from Linkfolio to clickfolio.me</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Get a PDF of your resume.</strong> Use your latest resume file, the PDF export
            from linkfolio.net Basic if you have it, or LinkedIn's "Save to PDF" export.
          </li>
          <li>
            <strong>Upload it.</strong> Drop the file into <Link href="/">clickfolio.me</Link>. The
            AI builds your page in about 30 seconds.
          </li>
          <li>
            <strong>Check, pick a template, publish.</strong> Fix anything the parser missed, choose
            one of the 10 templates, set which fields are private, and publish.
          </li>
          <li>
            <strong>Update your links.</strong> Replace your old Linkfolio URL on LinkedIn, in your
            email signature, and on your resume. If you had a custom domain pointing at
            linkfolio.net, keep that plan until you're ready to give the domain up, since we can't
            host it yet.
          </li>
        </ol>
        <p>
          Our <Link href="/blog/pdf-resume-to-website">PDF resume to website guide</Link> covers how
          to prepare your file so the parser gets the most out of it.
        </p>
      </section>

      <section>
        <h2>Try it with the resume you already have</h2>
        <p>
          You don't have to decide in the abstract. Upload your resume, see what the site looks
          like, and keep Linkfolio running until you're sure.
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
