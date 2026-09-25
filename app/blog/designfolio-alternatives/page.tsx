import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("designfolio-alternatives")!;

const relatedPosts = ["product-manager-portfolio-website", "read-cv-alternatives"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function DesignfolioAlternativesPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          The best Designfolio alternative depends on what you need the site to do. If you want
          long-form UX case studies, UXfolio is the closest match; if you want full design control,
          Framer or Webflow; and if you want a free site built from the resume you already have,{" "}
          <Link href="/">clickfolio.me</Link> turns a PDF into a live page in about 30 seconds.
        </p>
        <p>
          We build clickfolio.me, so we're biased. We've tried to be straight about where
          Designfolio is the better pick, and there are several cases where it is. All prices below
          are as of September 2026 and come from each tool's own pricing page unless we say
          otherwise.
        </p>
        <p>
          A quick note on the name: "Designfolio" also refers to a design-news site at
          designfolio.co, a paid Framer template, several Webflow templates, and an old WordPress
          theme. This page is about <strong>designfolio.me</strong>, the portfolio and case-study
          builder for designers and product managers.
        </p>
      </section>

      <section>
        <h2>What is Designfolio?</h2>
        <p>
          Designfolio is a hosted, no-code portfolio builder aimed at UX designers, product
          designers, and PMs. You pick a template, write case studies in a Notion-like editor, embed
          Figma files, and get help from an AI writing assistant that nudges you to explain your
          process, decisions, and impact. Your portfolio publishes to yourname.designfolio.me, and
          Pro users can connect their own domain. It also advertises password-protected case
          studies, which matters if most of your best work sits under NDA.
        </p>
        <p>
          On the Pro plan, Designfolio adds AI job tools: job search and matching, tailored resumes
          and cover letters, and mock interviews. The product is actively developed, with new blog
          posts and a 2026 footer when we checked, and the homepage says it is "trusted by 31,000+
          designers."
        </p>
      </section>

      <section>
        <h2>Designfolio pricing: is Designfolio free?</h2>
        <p>
          Yes, there's a free plan, though it's tight. According to{" "}
          <a href="https://www.designfolio.me/pricing" rel="noopener">
            Designfolio's pricing page
          </a>
          , as of September 2026:
        </p>
        <ComparisonTable
          headers={["Plan", "Price", "What you get"]}
          rows={[
            [
              "Free",
              "$0",
              "2 case studies, 1 project, starter templates, Designfolio branding, no analytics, no custom domain",
            ],
            [
              "Pro Monthly",
              "$12/mo (₹599 in India)",
              "Unlimited case studies, custom domain, all templates, no branding, analytics, AI job tools",
            ],
            ["Pro Quarterly", "$29/quarter", "Same as Pro Monthly"],
            ["Pro Lifetime", "$69 one-time", "Same as Pro, no renewals"],
          ]}
        />
        <p>
          A few details from the pricing FAQ are worth knowing before you pay. There is no free
          trial of Pro; the free plan is the trial. If you downgrade, your portfolio stays live but
          case studies beyond the first two are hidden and your custom domain is removed.
          Subscription payments are non-refundable except for technical errors. The $69 lifetime
          option is a genuinely good deal if you plan to stay.
        </p>
      </section>

      <PostSection
        heading="Why people look for a Designfolio alternative"
        intro="Designfolio is a solid product. The reasons people shop around are usually about fit:"
      >
        <PostList
          items={[
            {
              lead: "The free plan runs out fast.",
              body: " Two case studies and one project is enough to test the editor, not always enough for a full portfolio. Analytics are Pro-only.",
            },
            {
              lead: "You don't have case studies written yet.",
              body: " Designfolio assumes you'll write your content in its editor. It doesn't advertise importing a resume or LinkedIn profile, so you start from scratch with AI help.",
            },
            {
              lead: "You aren't a designer.",
              body: " The templates and prompts are built around UX case studies. Engineers, marketers, and many PMs just need a clean page that summarizes their experience.",
            },
            {
              lead: "You want more design control.",
              body: " Structured templates are a strength until you want a layout they don't offer.",
            },
          ]}
        />
      </PostSection>

      <section>
        <h2>8 Designfolio alternatives compared</h2>
        <ComparisonTable
          headers={["Tool", "Best for", "Free plan", "Paid from", "Custom domain"]}
          rows={[
            [
              "Designfolio",
              "UX case studies with AI writing help",
              "Yes, 2 case studies + branding",
              "$12/mo or $69 lifetime",
              "Pro",
            ],
            [
              "UXfolio",
              "Structured UX case studies",
              "7-day trial, no live portfolio",
              "$9/mo billed yearly ($108/yr)",
              "Paid",
            ],
            [
              "Framer",
              "Custom design with a designer's toolset",
              "Yes, Framer subdomain",
              "$10/mo billed yearly",
              "Basic and up",
            ],
            [
              "Cargo",
              "Expressive, artsy portfolios",
              "Unclear, see below",
              "$14/mo yearly, $19/mo monthly",
              "1 included",
            ],
            [
              "Carrd",
              "Simple one-page sites",
              "Yes, up to 3 sites",
              "$19/yr for custom domain",
              "Pro Standard and up",
            ],
            [
              "Webflow",
              "Full custom builds",
              "Yes, 2 static pages",
              "$15/mo billed yearly",
              "Basic and up",
            ],
            [
              "Contra",
              "Freelancers who want to get hired",
              "Yes, commission-free",
              "$29/mo or $199/yr",
              "Pro",
            ],
            [
              "Adobe Portfolio",
              "Creative Cloud subscribers",
              "No standalone free plan",
              "Included with paid Creative Cloud",
              "Yes",
            ],
            [
              "clickfolio.me",
              "Turning a resume PDF into a site",
              "Everything is free",
              "No paid plan",
              "Not yet",
            ],
          ]}
        />
        <p>
          Two names you might expect here are missing on purpose. Read.cv was acquired by Perplexity
          in January 2025 and wound down later that year, and Bento.me shut down in February 2026
          with links redirecting to Linktree. If you were on either, our{" "}
          <Link href="/blog/read-cv-alternatives">guide to Read.cv alternatives</Link> covers the
          move.
        </p>
      </section>

      <section>
        <h2>The alternatives, one by one</h2>

        <h3>UXfolio: the closest like-for-like swap</h3>
        <p>
          UXfolio is the portfolio most like Designfolio. It's a case-study builder with templates
          based on UX research structure and AI writing help. The catch is the free option: a 7-day
          trial with drafts and a handful of AI actions, and no live public portfolio until you pay.
          Plans are $15/month or $108/year. Choose it if you want Designfolio's approach with a
          different editor.
        </p>

        <h3>Framer: for designers who want to design the site too</h3>
        <p>
          Framer feels like a design tool that happens to publish websites, and its template
          marketplace is huge. The free plan gives you a Framer subdomain, 1 GB of bandwidth, and AI
          credits. Custom domains start at Basic ($10/month billed yearly), with Pro at $30/month.
          Expect to spend real time on layout, which is either the fun part or the problem.
        </p>

        <h3>Cargo: for a more expressive look</h3>
        <p>
          Cargo is popular with visual designers who want something less template-shaped. Paid plans
          are $14/month billed yearly or $19/month monthly, with one custom domain included. We
          found conflicting information on the free tier: Cargo's docs describe public sites on a
          cargo.site address, while other sources say free sites stay private until you subscribe.
          Check before you build.
        </p>

        <h3>Carrd: the cheapest custom domain</h3>
        <p>
          Carrd builds simple one-page sites. Free covers up to three sites with Carrd branding. Pro
          Standard, at $19 a year, adds a custom domain. It's great for a tight landing page and
          weak for multi-page case studies.
        </p>

        <h3>Webflow: for full control</h3>
        <p>
          Webflow is a professional visual site builder. The free Starter plan allows two static
          pages on a webflow.io address. Basic is $15/month and Premium $25/month, both billed
          yearly. Pick it if you want to build exactly what you have in mind and don't mind the
          learning curve.
        </p>

        <h3>Contra: for freelancers</h3>
        <p>
          Contra is a freelancer network where your portfolio doubles as a hiring profile at
          yourname.contra.com. The free profile is commission-free, and Pro costs $29/month or
          $199/year; Contra's portfolio pages list custom domains under Pro. Its "Portfolio Magic"
          feature imports a URL, such as a LinkedIn or GitHub page, as a project. It doesn't parse a
          full resume.
        </p>

        <h3>Adobe Portfolio: if you already pay for Creative Cloud</h3>
        <p>
          Adobe Portfolio comes bundled with paid Creative Cloud plans and syncs with Behance, and
          you can connect your own domain. There's no standalone free tier. If you already pay for
          Creative Cloud, it costs nothing extra to try.
        </p>

        <h3>clickfolio.me: for turning your resume into a site</h3>
        <p>
          clickfolio.me takes a different route from everything above. Upload your resume PDF, or
          your LinkedIn "Save to PDF" export, and the AI parses it into a live site at
          clickfolio.me/@yourname in about 30 seconds. You can edit everything afterwards. All 10
          templates are free, view analytics are built in, and privacy toggles let you hide fields
          like your phone number. There's no paid tier, and the code is open source under the MIT
          license.
        </p>
        <p>
          It is weaker than Designfolio in several areas. There's no long-form case-study editor, no
          Figma embeds, and no password protection. Custom domains aren't available yet; they're on
          the roadmap. If your portfolio depends on three deep NDA case studies, Designfolio or
          UXfolio will serve you better.
        </p>
      </section>

      <section>
        <h2>Designfolio vs clickfolio.me: which should you pick?</h2>
        <p>
          <strong>Pick Designfolio</strong> if you're a UX or product designer whose hiring
          conversations hinge on case studies, you need Figma embeds or password-protected NDA work,
          or you want a custom domain and would pay $69 once for it.
        </p>
        <p>
          <strong>Pick clickfolio.me</strong> if you already have a resume and want it online today,
          for free, without writing anything new. It's also the better fit if you aren't a designer.
          Plenty of people run both: a resume site as the link on every application, and a
          case-study portfolio for the interview loop.
        </p>
        <p>
          For designers, our <Link href="/for/designer">portfolio website for designers</Link> page
          shows how the templates handle design roles. PMs deciding how much case-study depth they
          need should read{" "}
          <Link href="/blog/product-manager-portfolio-website">
            how to build a product manager portfolio website
          </Link>
          , or see the <Link href="/for/product-manager">product manager portfolio</Link> page.
        </p>
      </section>

      <PostSection
        heading="How to choose a portfolio like Designfolio"
        intro="Answer these before you pick a tool:"
      >
        <PostList
          ordered
          items={[
            {
              lead: "Do you need case studies or a summary?",
              body: " Case studies point to Designfolio or UXfolio. A clear summary of your experience points to a resume site.",
            },
            {
              lead: "How much do you want to design?",
              body: " If layout is part of the pitch, Framer, Webflow, or Cargo. If not, a template-based tool saves hours.",
            },
            {
              lead: "Does a custom domain matter right now?",
              body: " If it does, check which plan unlocks it. Carrd is the cheapest route at $19 a year.",
            },
            {
              lead: "What will you pay per year?",
              body: " Compare yearly totals, not monthly prices, and read the refund terms.",
            },
          ]}
        />
        <p>
          If you're comparing more resume-first tools, our roundup of the{" "}
          <Link href="/blog/best-resume-website-builders">best free resume website builders</Link>{" "}
          goes deeper on that category.
        </p>
      </PostSection>

      <section>
        <h2>How to get a site live from your resume in 30 seconds</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Grab your resume PDF.</strong> A LinkedIn "Save to PDF" export works too.
          </li>
          <li>
            <strong>Upload it to clickfolio.me.</strong> The AI reads your experience, education,
            and skills and builds your page.
          </li>
          <li>
            <strong>Review, pick a template, publish.</strong> Fix anything the parser missed, hide
            fields you'd rather keep private, and share your clickfolio.me/@handle link.
          </li>
        </ol>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and build your site →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
