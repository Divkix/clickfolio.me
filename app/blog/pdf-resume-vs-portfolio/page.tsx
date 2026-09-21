import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("pdf-resume-vs-portfolio")!;

// SAFETY: getPostBySlug returns BlogPostMeta | undefined; filter(Boolean) removes undefined, so remaining are BlogPostMeta. Related slugs are static and validated against BLOG_POSTS.
const relatedPosts = ["pdf-resume-to-website", "resume-writing-tips"]
  .map((slug) => getPostBySlug(slug))
  .filter(Boolean) as (typeof post)[];

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function PdfResumeVsPortfolioPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          The PDF-vs-portfolio debate has a false premise: that you have to choose one. You don't.
          They serve entirely different purposes, and the most effective professionals use both —
          strategically, in different contexts, for different audiences. Here's how to think about
          each format and when to deploy it.
        </p>
      </section>

      <PostSection
        heading="When to Use a PDF Resume"
        intro="The PDF resume isn't dead — it's the standard format for specific, high-stakes scenarios:"
      >
        <PostList
          items={[
            {
              lead: "ATS applications.",
              body: " Most large companies use Applicant Tracking Systems that expect a file attachment. PDFs preserve formatting across systems and are universally accepted. A portfolio URL in your application won't get parsed — the PDF will. Use a PDF when submitting through job portals, corporate career pages, or recruiter platforms.",
            },
            {
              lead: "Email applications.",
              body: ' When a recruiter says "send me your resume," they expect an attachment. Attach the PDF and include your portfolio URL in the email body as a bonus — you\'ve satisfied the expectation and added value.',
            },
            {
              lead: "Formal settings.",
              body: " Law firms, government agencies, academic institutions, and traditional corporations expect documents. A portfolio link is a nice addition, but the PDF is the table stakes.",
            },
            {
              lead: "Offline sharing.",
              body: " Career fairs, in-person interviews, networking events — sometimes you need something you can print or attach. A PDF is reliable offline. A QR code linking to your portfolio is a powerful complement.",
            },
            {
              lead: "Reference checks.",
              body: " When someone needs to quickly verify your employment history, a clean, single-page PDF is faster to scan than navigating a website.",
            },
          ]}
        />
      </PostSection>

      <PostSection
        heading="When to Use a Portfolio Website"
        intro="A portfolio website excels where a PDF falls short:"
      >
        <PostList
          items={[
            {
              lead: "Social media and networking.",
              body: " Twitter bio, Instagram link, LinkedIn featured section, Discord profile — every platform accepts a URL. None accept a PDF. A portfolio link turns every social profile into a gateway to your professional story.",
            },
            {
              lead: "Personal branding.",
              body: " Your portfolio is your professional home on the internet. It's where you control the narrative — the design, the content, the messaging. A PDF is a document. A portfolio is a presence.",
            },
            {
              lead: "Search engine discovery.",
              body: ' Recruiters search for "[skill] [location]" on Google. A PDF won\'t appear in those results. A portfolio website with relevant keywords will.',
            },
            {
              lead: "Analytics and iteration.",
              body: " Your portfolio tells you how many people viewed it, where they came from, and what they looked at. This data helps you optimize — maybe your skills section gets the most views, or your project descriptions need work. A PDF gives you zero insight.",
            },
            {
              lead: "QR codes and print materials.",
              body: " Put a QR code on your business card, printed resume, or conference badge. One scan takes someone directly to your full portfolio. This bridges the gap between physical and digital presence elegantly.",
            },
            {
              lead: "Dynamic updates.",
              body: " Changed jobs on Monday? Update your portfolio in 30 seconds and it's live. No need to re-send PDFs to everyone who has the old version.",
            },
          ]}
        />
      </PostSection>

      <PostSection
        heading="The Hybrid Approach"
        intro="The optimal strategy uses both formats, linked together:"
      >
        <PostList
          ordered
          className="list-decimal pl-6 space-y-3"
          items={[
            {
              lead: "Maintain a single source of truth.",
              body: " Your resume content — experience, education, skills — lives in one place: your clickfolio.me account. From there, it powers both your portfolio website and can be exported for PDF use.",
            },
            {
              lead: "Include your portfolio URL on your PDF.",
              body: " Add your portfolio URL to the header or contact section of your resume PDF. Anyone who receives your PDF is one click away from your full portfolio, with additional details, projects, and interactive elements.",
            },
            {
              lead: "Use the right format for each channel.",
              body: " Job portal? Attach PDF, include portfolio link in cover letter. LinkedIn message? Send portfolio link. Career fair? Hand over a printed PDF with a QR code to your portfolio. Conference talk? Put your portfolio URL on your last slide.",
            },
            {
              lead: "Match your template to the context.",
              body: " Use the ClassicATS template on clickfolio.me for a portfolio that mirrors your ATS-optimized PDF. Switch to a more creative template (NeoBrutalist, Spotlight) when sharing on social media. Same content, different presentation — appropriate for different audiences.",
            },
          ]}
        />
      </PostSection>

      <section>
        <h2>ATS-Friendly Templates</h2>
        <p>
          If you're actively job hunting, you need a resume that works for both ATS systems and
          human readers. clickfolio.me's ClassicATS template is specifically designed for this dual
          purpose:
        </p>
        <ul>
          <li>Single-column layout — no columns that confuse parsers</li>
          <li>
            Standard section headings — "Experience," "Education," "Skills" are machine-recognizable
          </li>
          <li>
            Clean typography and font rendering — no fancy ligatures that break text extraction
          </li>
          <li>Web-standard HTML semantics — screen-reader friendly and SEO-optimized</li>
        </ul>
        <p>
          When you use ClassicATS, your portfolio website <em>is</em> an ATS-friendly format. You
          can maintain one source of truth that works for both machine screening and human browsing.
          No need to maintain separate documents.
        </p>
      </section>

      <section>
        <h2>QR Code Strategy</h2>
        <p>
          One innovative approach: include a QR code on your PDF resume that links to your portfolio
          website.
        </p>
        <p>
          When a recruiter prints your resume for an interview panel (which still happens), the QR
          code gives everyone in the room instant access to your full portfolio on their phones.
          Your name, face, and experience are already in front of them — the QR code makes your
          entire professional story one scan away. It also signals tech-savviness and attention to
          detail.
        </p>
        <p>
          QR codes are free to generate and take seconds to add to a PDF. They cost nothing and add
          a subtle competitive advantage. If 50 candidates submit PDFs and you're the only one with
          a QR code to a professional portfolio, you stand out — even before anyone reads a word.
        </p>
      </section>

      <section>
        <h2>The Bottom Line</h2>
        <p>
          A PDF resume is essential. A portfolio website is transformational. Together, they're the
          complete professional presence — covering every channel from ATS applications to social
          media sharing to Google search. The best part: with AI-powered tools, you can maintain
          both from a single source of truth, with zero duplication of effort.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and get both a PDF and a portfolio →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
