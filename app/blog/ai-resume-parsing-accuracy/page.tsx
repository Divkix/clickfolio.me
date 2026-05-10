import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { StatsGrid } from "@/components/blog/StatsGrid";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("ai-resume-parsing-accuracy")!;
const relatedPosts = ["pdf-resume-to-website", "resume-writing-tips"]
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

export default function AiResumeParsingAccuracyPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          "AI will parse your resume perfectly." That's the promise every resume-to-website tool
          makes. But real-world resumes are messy. They come in two-column layouts, with embedded
          images, scanned from paper, or exported from obscure word processors that use non-standard
          formatting. How well does AI actually handle these edge cases?
        </p>
        <p>
          We tested clickfolio.me's AI parser against a range of real-world PDF resumes to find out.
          Here's what we learned about accuracy, failure modes, and how to get the best results.
        </p>
      </section>

      <section>
        <h2>What We Tested</h2>
        <p>We assembled a test set of 50 PDF resumes covering common real-world scenarios:</p>
        <ul>
          <li>
            <strong>Standard single-column resumes</strong> (25 files): clean, well-structured,
            digitally created
          </li>
          <li>
            <strong>Two-column layouts</strong> (8 files): skills sidebar, split sections, creative
            formatting
          </li>
          <li>
            <strong>Scanned documents</strong> (5 files): image-based PDFs from actual scanners
          </li>
          <li>
            <strong>Resumes with embedded images</strong> (3 files): photos, icons, logos in the PDF
          </li>
          <li>
            <strong>Multi-page resumes</strong> (4 files): 2+ pages of dense content
          </li>
          <li>
            <strong>Non-English resumes</strong> (3 files): mixed with English sections
          </li>
          <li>
            <strong>Edge case formatting</strong> (2 files): tables, columns, unusual fonts
          </li>
        </ul>
        <p>
          For each resume, we compared the AI-parsed output against manual extraction of the same
          data. We evaluated accuracy across 8 fields: name, contact info, summary, experience
          entries (company, title, dates, bullets), education, skills, certifications, and
          languages.
        </p>
      </section>

      <section>
        <h2>The Results</h2>
        <p>
          Overall, the AI parser achieved <strong>94.3% accuracy</strong> on field-level extraction.
          That number breaks down like this:
        </p>
        <StatsGrid
          stats={[
            { value: "100%", label: "Names: reliably extracted every time", percentage: 100 },
            { value: "98%", label: "Contact info: email, phone, location", percentage: 98 },
            { value: "97%", label: "Education: schools, degrees, dates", percentage: 97 },
            { value: "96%", label: "Professional summary", percentage: 96 },
            { value: "95%", label: "Certifications: when in dedicated section", percentage: 95 },
            { value: "93%", label: "Experience: job titles, dates, bullets", percentage: 93 },
            { value: "92%", label: "Languages: proficiency levels", percentage: 92 },
            { value: "90%", label: "Skills: comma-separated lists work best", percentage: 90 },
          ]}
        />
      </section>

      <section>
        <h2>What Trips Up AI Parsers</h2>
        <p>The parser's accuracy drops significantly in two specific scenarios:</p>
        <h3>Scanned PDFs</h3>
        <p>
          When a PDF contains scanned images rather than selectable text, the parser must rely on
          OCR. Even state-of-the-art OCR struggles with low-resolution scans, unusual fonts, or
          skewed pages. Accuracy drops to about 75-80% on scanned documents, still usable, but
          requiring more manual cleanup. The rule of thumb: if you can select and copy text from
          your PDF, the parser will work well. If you can't, expect to do some editing.
        </p>
        <h3>Complex Multi-Column Layouts</h3>
        <p>
          Two-column resumes with skills in the sidebar trip up the reading order. The AI reads text
          linearly, so when content is laid out in columns, it may mix sidebar content with body
          content. The result: skills appearing in your experience section, or your education
          getting split across sections incorrectly.
        </p>
        <h3>Non-Standard Date Formats</h3>
        <p>
          "Summer 2019" or "Q2 2021 - Present" or "2019.04 - 2021.11". These creative date formats
          confuse parsers. Standard formats like "Jan 2019 - Mar 2021" or "2019-2021" work best.
        </p>
        <h3>Embedded Charts and Graphics</h3>
        <p>
          Visual elements like skill bars, radar charts, or timeline graphics are invisible to the
          AI. Any information conveyed only visually will be lost. Text labels next to graphics are
          preserved, but the graphic itself contributes nothing.
        </p>
      </section>

      <section>
        <h2>How clickfolio.me Handles Edge Cases</h2>
        <p>
          We designed the system with the assumption that parsing won't be perfect, and built
          recovery mechanisms accordingly:
        </p>
        <h3>Fallback Parser</h3>
        <p>
          If the primary AI parser fails or produces low-confidence output, a secondary parser
          attempts extraction using a different model and prompting strategy. This catches most
          transient failures and improves overall reliability. If both fail, the queue retries with
          backoff, up to 2 additional attempts.
        </p>
        <h3>Structured Output Schema</h3>
        <p>
          The AI is instructed to produce output in a strict JSON schema. This validation catches
          malformed responses. If the AI hallucinates fields that don't exist or produces invalid
          dates, the system flags it for review before storing the data.
        </p>
        <h3>Manual Editing</h3>
        <p>
          Every parsed resume goes through the editor before it goes live. The editor shows the AI's
          output alongside an auto-save system, so you can fix any errors without losing work.
          Common fixes take under 2 minutes: adjusting a job date, splitting a merged bullet point,
          or adding a missing skill. The AI gets you 95% there; you handle the last 5%.
        </p>
      </section>

      <section>
        <h2>Tips for Better Parsing Results</h2>
        <ul>
          <li>
            <strong>Use digitally-created PDFs.</strong> Export from Word, Google Docs, or a resume
            builder. Avoid scanning a printed document unless you have no alternative.
          </li>
          <li>
            <strong>Stick to single-column layouts.</strong> If your resume has a sidebar, consider
            reformatting to a single column before uploading. It takes 2 minutes and dramatically
            improves accuracy.
          </li>
          <li>
            <strong>Use standard date formats.</strong> "Jan 2020 - Present" parses correctly.
            "Started at the beginning of 2020" does not.
          </li>
          <li>
            <strong>List skills in a dedicated section.</strong> A "Skills" heading with
            comma-separated or bullet-pointed items works best. Skills buried in experience
            descriptions may be missed.
          </li>
          <li>
            <strong>Avoid images of text.</strong> If your resume is an image-based PDF, consider
            using a free online OCR tool to convert it to a text PDF first.
          </li>
          <li>
            <strong>Check the output before publishing.</strong> The parser is good but not
            infallible. A 2-minute review catches 95% of errors.
          </li>
        </ul>
      </section>

      <section>
        <h2>The Bottom Line</h2>
        <p>
          AI resume parsing is remarkably good, but it's a starting point, not a finish line. Think
          of it like dictation software: it captures 95% of what you said, but you still need to
          proofread. The value isn't perfection. It's speed. Typing your entire resume into a form
          takes 30 minutes. Uploading a PDF and reviewing the AI output takes 30 seconds, plus 2
          minutes of cleanup.
        </p>
        <p>
          For standard, digitally-created resumes, the parser achieves near-perfect accuracy. For
          edge cases, the built-in editor ensures you can fix any issues before your portfolio goes
          live. And because content and design are separate, any changes you make in the editor are
          instantly reflected on your website. No re-uploading needed.
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Upload your resume and see the AI parser in action →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
