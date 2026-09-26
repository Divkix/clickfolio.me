import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("consultant-portfolio-website")!;

const relatedPosts = ["resume-website-examples", "how-to-make-a-resume-website"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function ConsultantPortfolioWebsitePage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>What is a consultant portfolio website?</h2>
        <p>
          A consultant portfolio website is a single page that shows a prospective client or hiring
          manager what problems you solve, who you have solved them for, and what changed as a
          result. For an individual consultant, it is usually a resume plus a handful of short
          engagement summaries, published at a link you can put in proposals and your email
          signature.
        </p>
        <p>
          That is a different job from a consulting firm website. A firm site sells a team, a
          method, and a brand. Yours sells you: your judgment, your track record, and the kind of
          work you want more of. Most of the "consulting website examples" galleries you will find
          are agency sites with service pages and team photos. If you are an independent, freelance,
          or in-between-roles consultant, you need far less than that, and it should be easier to
          scan.
        </p>
        <p>
          We build clickfolio.me, so we are biased toward the fast path. We will still tell you
          where it falls short for consultants, mainly around custom domains.
        </p>
      </section>

      <PostSection
        heading="What does a consultant portfolio need to prove?"
        intro="Clients hiring a consultant are buying reduced risk. Every section of your site should answer one of four questions a buyer is already asking:"
      >
        <PostList
          items={[
            {
              lead: "Outcomes.",
              body: " What measurably changed after you left? Cost, cycle time, revenue, adoption, audit findings closed. Use numbers you could defend on a reference call.",
            },
            {
              lead: "Client types.",
              body: " Which industries, company sizes, and functions you have worked with. A buyer at a regional bank wants to see that you have been inside a regulated financial business before.",
            },
            {
              lead: "Engagement scope.",
              body: " How big the work was and what your role was. Leading a six-month transformation is a different claim from advising on a two-week diagnostic, and both are worth stating plainly.",
            },
            {
              lead: "Credibility.",
              body: " Certifications, prior firms, years in the field, and published work. These let a stranger trust you before anyone has vouched for you.",
            },
          ]}
        />
        <p>
          The hard part is proving all of that without breaking a confidentiality agreement. That is
          the main thing separating a consultant portfolio from a designer or engineer portfolio,
          and it is covered in its own section below.
        </p>
      </PostSection>

      <PostSection
        heading="Recommended sections for a consultant portfolio website"
        intro="Keep it to one page. In order, top to bottom:"
      >
        <PostList
          ordered
          items={[
            {
              lead: "Positioning headline.",
              body: ' One line that names the problem and the client. "Supply chain consultant for mid-market manufacturers" beats "Strategic advisor | Transformation leader."',
            },
            {
              lead: "A short summary.",
              body: " Three or four sentences on how you work, what engagements you take, and whether you are open to new clients or full-time roles.",
            },
            {
              lead: "Engagement summaries.",
              body: " Three to six short case studies, each following problem, approach, outcome. This is the core of the page.",
            },
            {
              lead: "Industries and functions.",
              body: " A scannable list so buyers can self-qualify in seconds.",
            },
            {
              lead: "Experience timeline.",
              body: " Firms, roles, and dates. If you have been independent for years, list the independent practice as one role and let the engagements carry the detail.",
            },
            {
              lead: "Credentials.",
              body: " Certifications (PMP, SAP, AWS, CFA, and so on), degrees, and any talks or articles.",
            },
            {
              lead: "Contact.",
              body: " An email address and LinkedIn at minimum. Decide separately whether a phone number belongs on a public page.",
            },
          ]}
        />
        <p>
          The <Link href="/for/consultant">consultant resume website page</Link> covers which
          clickfolio.me templates suit this structure. For a general walkthrough of sections that
          applies to any profession, see{" "}
          <Link href="/blog/how-to-make-a-resume-website">how to make a resume website</Link>.
        </p>
      </PostSection>

      <section>
        <h2>What to lead with, by type of consultant</h2>
        <p>
          The sections stay the same across specialties. What changes is the evidence a buyer looks
          for first. Use this as a starting point, not a rule:
        </p>
        <ComparisonTable
          headers={["Consultant type", "Lead with", "Credibility markers"]}
          rows={[
            [
              "Management / strategy",
              "Business outcomes: cost, margin, growth, operating model changes",
              "Prior firm, industries served, board or exec-level work",
            ],
            [
              "IT / ERP / cloud",
              "Systems delivered, migrations completed, scale (users, sites, modules)",
              "Vendor certifications, platforms and versions, delivery role",
            ],
            [
              "Marketing / growth",
              "Pipeline, conversion, and channel results, stated as ranges or percentages",
              "Channels and tools, B2B vs B2C, company stages",
            ],
            [
              "HR / people",
              "Programs launched, hiring or retention changes, policy and compliance work",
              "Certifications, headcount ranges, industries",
            ],
            [
              "Freelance specialist",
              "Deliverables and repeat clients",
              "Portfolio links, tools, availability",
            ],
          ]}
        />
      </section>

      <PostSection
        heading="How to write engagement summaries (with examples)"
        intro="Each summary should fit in three to five lines: the situation, what you did, and what changed. Name the client only if you have written permission. Otherwise describe them by industry, size, and region."
      >
        <p>
          The snippets below are illustrative examples we wrote for this guide. They are not real
          clients or real results. Swap in your own work and your own numbers.
        </p>
        <PostList
          items={[
            {
              lead: "Example: management consultant.",
              body: ' "Regional grocery chain, roughly 200 stores. Store labor costs were rising faster than sales. I led a four-month scheduling redesign with operations and finance, piloted it in 12 stores, then rolled it out chain-wide. Labor as a share of sales fell by 1 to 2 points within two quarters."',
            },
            {
              lead: "Example: IT / ERP consultant.",
              body: ' "Mid-market industrial manufacturer, three plants. Migrated finance and procurement from an on-premise ERP to a cloud ERP. I owned data migration and cutover planning for a team of eight. Go-live landed on the planned date with month-end close running on the new system from the first period."',
            },
            {
              lead: "Example: freelance marketing consultant.",
              body: ' "Series A B2B SaaS company. Paid search was the main channel and cost per lead kept climbing. I rebuilt account structure and landing pages over six weeks. Cost per qualified lead dropped by roughly a third over the following quarter."',
            },
          ]}
        />
        <p>
          Notice what each one does. The client is recognizable as a type but not as a company. The
          scope (duration, team size, number of sites) tells the reader how big the work was. The
          outcome is a range or percentage, which is honest about measurement noise and does not
          expose a client's internal figures.
        </p>
      </PostSection>

      <PostSection
        heading="How do consultants show client work under an NDA?"
        intro="Most consulting work is confidential, and a portfolio that leaks a client's numbers is worse than no portfolio at all. A few habits keep you safe:"
      >
        <PostList
          items={[
            {
              lead: "Anonymize by default.",
              body: ' "A top-20 US health insurer" or "a European logistics company with about 5,000 employees" gives buyers enough context. Only name clients who have agreed to it in writing.',
            },
            {
              lead: "Use ranges and percentages.",
              body: " A relative change reveals far less than an absolute figure. Only publish a number you could personally verify if a prospect asked how you measured it.",
            },
            {
              lead: "Check your contract.",
              body: " Some agreements restrict even anonymized descriptions or the use of a client's industry. When in doubt, ask the client whether an anonymized summary is acceptable.",
            },
            {
              lead: "Make your role explicit.",
              body: ' If you were one of 30 people on a program, say "led the data workstream" rather than implying you ran the whole thing. Buyers check references, and inflated scope is easy to catch.',
            },
          ]}
        />
      </PostSection>

      <PostSection
        heading="Keep personal contact details private"
        intro="A consultant site is public by design, but that does not mean your home address and mobile number need to be. On clickfolio.me, privacy is set field by field:"
      >
        <PostList
          items={[
            {
              lead: "Hide your phone number",
              body: " and share it once a prospect has emailed you.",
            },
            {
              lead: "Hide your address.",
              body: " A city or region in your summary is usually enough for clients to know your time zone and travel range.",
            },
          ]}
        />
        <p>
          Everything else, including engagement summaries, stays editable after the AI parses your
          resume, so you can rewrite any line that says more than it should before you publish.
        </p>
      </PostSection>

      <section>
        <h2>Does a consultant need a custom domain?</h2>
        <p>
          It depends on how you use the site. If you are job hunting or moving between contract
          roles, a <code>clickfolio.me/@yourname</code> link does the job: it is short, it previews
          cleanly on LinkedIn and in email, and it costs nothing.
        </p>
        <p>
          If you run a business that invoices clients, a custom domain starts to matter. You likely
          want an email address at your own domain, and a proposal that points to{" "}
          <code>yourpractice.com</code> looks more established than any hosted handle. clickfolio.me
          does not support custom domains yet. It is on the roadmap, but we would rather say so than
          let you find out after publishing.
        </p>
        <p>
          A practical setup for billing consultants: register your own domain for email and your
          firm name, and use a clickfolio.me page as the detailed profile you link from it and from
          proposals. When custom domains ship, you can point the domain at the same page. If you
          need everything on your own domain today, a general website builder is the better fit.
        </p>
      </section>

      <section>
        <h2>Should your portfolio replace LinkedIn?</h2>
        <p>
          No. Keep both. LinkedIn is where people find you and check mutual connections. Your
          portfolio is where you control the story, with engagement summaries that would not fit
          LinkedIn's format. We compare the two in more detail in{" "}
          <Link href="/blog/resume-website-vs-linkedin">resume website vs LinkedIn</Link>. For
          layout ideas from other professions, browse these{" "}
          <Link href="/blog/resume-website-examples">resume website examples</Link>.
        </p>
      </section>

      <PostSection
        heading="Build a consultant portfolio in about 30 seconds"
        intro="If you already have a consulting CV or an up-to-date LinkedIn profile, you have most of the content. The steps:"
      >
        <PostList
          ordered
          items={[
            {
              lead: "Get a PDF.",
              body: (
                <>
                  {" Use your current resume, or export your LinkedIn profile with "}
                  <em>Save to PDF</em>. Our guide on{" "}
                  <Link href="/blog/linkedin-to-portfolio">turning LinkedIn into a portfolio</Link>{" "}
                  walks through the export.
                </>
              ),
            },
            {
              lead: "Upload it",
              body: (
                <>
                  {" to "}
                  <Link href="/">clickfolio.me</Link>. The AI parses your experience, skills, and
                  education into a structured site in about 30 seconds.
                </>
              ),
            },
            {
              lead: "Rewrite your engagements.",
              body: " Turn resume bullets into problem, approach, outcome summaries, and anonymize anything covered by an NDA.",
            },
            {
              lead: "Set privacy and pick a template.",
              body: " Hide your phone and address if you want, and choose one of the 12 free templates.",
            },
            {
              lead: "Publish and share.",
              body: " Add the link to your LinkedIn, proposals, and email signature. Built-in view analytics show whether prospects actually opened it.",
            },
          ]}
        />
        <p>
          It is free, with no paid tier, and the code is open source under the MIT license. For
          template picks and consultant-specific FAQs, see our{" "}
          <Link href="/for/consultant">portfolio website guide for consultants</Link>.
        </p>
      </PostSection>

      <section>
        <h2>Start with the work you can talk about</h2>
        <p>
          You do not need a dozen case studies. Three honest, anonymized engagement summaries with
          outcomes you can defend will do more than a long list of logos you cannot show. Write
          those first, then publish.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Turn your consulting resume into a portfolio site →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
