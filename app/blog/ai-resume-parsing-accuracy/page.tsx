import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { StatsGrid } from "@/components/blog/StatsGrid";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("ai-resume-parsing-accuracy")!;

const relatedPosts = ["pdf-resume-to-website", "resume-writing-tips"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
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

      <PostSection
        heading="What We Tested"
        intro="We assembled a test set of 50 PDF resumes covering common real-world scenarios:"
      >
        <PostList
          items={[
            {
              lead: "Standard single-column resumes",
              body: " (25 files) — clean, well-structured, digitally created",
            },
            {
              lead: "Two-column layouts",
              body: " (8 files) — skills sidebar, split sections, creative formatting",
            },
            {
              lead: "Scanned documents",
              body: " (5 files) — image-based PDFs from actual scanners",
            },
            {
              lead: "Resumes with embedded images",
              body: " (3 files) — photos, icons, logos in the PDF",
            },
            {
              lead: "Multi-page resumes",
              body: " (4 files) — 2+ pages of dense content",
            },
            {
              lead: "Non-English resumes",
              body: " (3 files) — mixed with English sections",
            },
            {
              lead: "Edge case formatting",
              body: " (2 files) — tables, columns, unusual fonts",
            },
          ]}
        />
        <p>
          For each resume, we compared the AI-parsed output against manual extraction of the same
          data. We evaluated accuracy across 8 fields: name, contact info, summary, experience
          entries (company, title, dates, bullets), education, skills, certifications, and
          languages.
        </p>
      </PostSection>

      <section>
        <h2>The Results</h2>
        <p>
          Overall, the AI parser achieved <strong>94.3% accuracy</strong> on field-level extraction.
          That number breaks down like this:
        </p>
        <StatsGrid
          stats={[
            { value: "100%", label: "Names — reliably extracted every time", percentage: 100 },
            { value: "98%", label: "Contact info — email, phone, location", percentage: 98 },
            { value: "97%", label: "Education — schools, degrees, dates", percentage: 97 },
            { value: "96%", label: "Professional summary", percentage: 96 },
            { value: "95%", label: "Certifications — when in dedicated section", percentage: 95 },
            { value: "93%", label: "Experience — job titles, dates, bullets", percentage: 93 },
            { value: "92%", label: "Languages — proficiency levels", percentage: 92 },
            { value: "90%", label: "Skills — comma-separated lists work best", percentage: 90 },
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
          skewed pages. Accuracy drops to about 75-80% on scanned documents — still usable, but
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
          "Summer 2019" or "Q2 2021 - Present" or "2019.04 - 2021.11" — these creative date formats
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
          We designed the system with the assumption that parsing won't be perfect — and built
          recovery mechanisms accordingly:
        </p>
        <h3>Fallback Parser</h3>
        <p>
          If the primary AI parser fails or produces low-confidence output, a secondary parser
          attempts extraction using a different model and prompting strategy. This catches most
          transient failures and improves overall reliability. If both fail, the parse job retries
          with exponential backoff — up to 3 additional attempts.
        </p>
        <h3>Structured Output Schema</h3>
        <p>
          The AI is instructed to produce output in a strict JSON schema. This validation catches
          malformed responses — if the AI hallucinates fields that don't exist or produces invalid
          dates, the system flags it for review before storing the data.
        </p>
        <h3>Manual Editing</h3>
        <p>
          Every parsed resume goes through the editor before it goes live. The editor shows the AI's
          output alongside an auto-save system, so you can fix any errors without losing work.
          Common fixes take under 2 minutes — adjusting a job date, splitting a merged bullet point,
          or adding a missing skill. The AI gets you 95% there; you handle the last 5%.
        </p>
      </section>

      <PostSection heading="Tips for Better Parsing Results">
        <PostList
          items={[
            {
              lead: "Use digitally-created PDFs.",
              body: " Export from Word, Google Docs, or a resume builder. Avoid scanning a printed document unless you have no alternative.",
            },
            {
              lead: "Stick to single-column layouts.",
              body: " If your resume has a sidebar, consider reformatting to a single column before uploading. It takes 2 minutes and dramatically improves accuracy.",
            },
            {
              lead: "Use standard date formats.",
              body: ' "Jan 2020 - Present" parses correctly. "Started at the beginning of 2020" does not.',
            },
            {
              lead: "List skills in a dedicated section.",
              body: ' A "Skills" heading with comma-separated or bullet-pointed items works best. Skills buried in experience descriptions may be missed.',
            },
            {
              lead: "Avoid images of text.",
              body: " If your resume is an image-based PDF, consider using a free online OCR tool to convert it to a text PDF first.",
            },
            {
              lead: "Check the output before publishing.",
              body: " The parser is good but not infallible. A 2-minute review catches 95% of errors.",
            },
          ]}
        />
      </PostSection>

      <PostSection
        heading="The Bottom Line"
        intro="AI resume parsing is remarkably good — but it's a starting point, not a finish line. Think of it like dictation software: it captures 95% of what you said, but you still need to proofread. The value isn't perfection — it's speed. Typing your entire resume into a form takes 30 minutes. Uploading a PDF and reviewing the AI output takes 30 seconds, plus 2 minutes of cleanup."
      >
        <p>
          For standard, digitally-created resumes, the parser achieves near-perfect accuracy. For
          edge cases, the built-in editor ensures you can fix any issues before your portfolio goes
          live. And because content and design are separate, any changes you make in the editor are
          instantly reflected on your website — no re-uploading needed.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Upload your resume and see the AI parser in action →
          </Link>
        </p>
      </PostSection>
    </BlogPostLayout>
  );
}
