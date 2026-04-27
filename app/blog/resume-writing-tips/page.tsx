import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("resume-writing-tips")!;
const relatedPosts = ["ai-resume-parsing-accuracy", "pdf-resume-vs-portfolio"]
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

export default function ResumeWritingTipsPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          The fundamentals of a great resume haven't changed much in decades: clear structure,
          quantified achievements, relevant keywords. But how resumes are <em>consumed</em> has
          changed dramatically. Today, your resume might be read by an ATS algorithm, skimmed by a
          recruiter on their phone during a commute, reviewed by a hiring manager on a desktop, or
          displayed as a portfolio website.
        </p>
        <p>
          Writing a resume that converts across all these contexts requires understanding both the
          old rules and the new realities. Here's how to write a resume that works in 2026.
        </p>
      </section>

      <section>
        <h2>Structure That Works</h2>
        <p>
          There's a reason the standard resume structure has endured: it works. Both ATS systems and
          human readers expect information in a predictable order. Here's the optimal flow:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Contact Information.</strong> Name, email, phone (optional if you have privacy
            concerns), location (city + state is sufficient), portfolio URL, LinkedIn URL. Keep it
            clean — no "Email:" or "Phone:" labels. The format is self-evident.
          </li>
          <li>
            <strong>Professional Summary.</strong> 2-4 sentences that answer three questions: Who
            are you? What do you do? What makes you effective? Avoid buzzwords like "passionate,"
            "motivated," or "results-driven" — they mean nothing without evidence. Instead: "Senior
            frontend engineer with 7 years of experience shipping accessible component libraries
            used by 2M+ monthly users."
          </li>
          <li>
            <strong>Experience.</strong> Reverse chronological. Each entry should have: company
            name, job title, dates, location (optional), and 2-4 bullet points per role. Put the
            most recent, most relevant role first. For roles older than 7-10 years, consider 1-2
            bullets instead of full detail.
          </li>
          <li>
            <strong>Education.</strong> School, degree, field of study, graduation year. Include GPA
            only if it's above 3.5 and you graduated within the last 3 years. Include relevant
            coursework only if you're early career.
          </li>
          <li>
            <strong>Skills.</strong> Group by category: Languages, Frameworks, Tools, Platforms. Be
            specific. "JavaScript" is better than "Programming Languages." "React, Next.js,
            TypeScript" is better than "Frontend Development." ATS systems match exact keywords — be
            precise.
          </li>
          <li>
            <strong>Optional sections.</strong> Certifications, languages (human ones), projects,
            publications, volunteer work. Include only if they strengthen your candidacy for the
            specific role.
          </li>
        </ol>
      </section>

      <section>
        <h2>Quantify Everything</h2>
        <p>
          The single highest-impact improvement you can make to any resume: replace vague
          descriptions with numbers. Hiring managers see hundreds of resumes claiming "improved
          efficiency" or "increased revenue." Almost none provide evidence. The ones that do — with
          specific metrics — stand out immediately.
        </p>
        <p>
          Every bullet point should answer: what did you do, and how do you know it worked? If you
          can't answer the second part, dig deeper:
        </p>
        <ul>
          <li>
            <strong>Before:</strong> "Managed a team of engineers"
            <br />
            <strong>After:</strong> "Led a team of 5 engineers delivering 14 product features across
            3 quarters, reducing time-to-ship by 40%"
          </li>
          <li>
            <strong>Before:</strong> "Improved website performance"
            <br />
            <strong>After:</strong> "Reduced page load time from 4.2s to 1.1s, increasing conversion
            rate by 18%"
          </li>
          <li>
            <strong>Before:</strong> "Responsible for customer support"
            <br />
            <strong>After:</strong> "Resolved 200+ support tickets monthly with 97% customer
            satisfaction rating"
          </li>
        </ul>
        <p>
          Metrics don't have to be revenue. They can be: users, percentages, time saved, team size,
          budget managed, satisfaction scores, error rates, deployment frequency, or any objective
          measure of impact. If you truly can't find a number, ask yourself: was the work measurable
          at all? If not, describe the
          <em>scope</em> — the scale of the problem or the breadth of your responsibility.
        </p>
      </section>

      <section>
        <h2>Keywords for ATS and AI</h2>
        <p>
          Modern resume screening involves two types of machine readers: traditional ATS keyword
          matchers and LLM-based AI screeners. They look for different things:
        </p>
        <h3>ATS Keywords</h3>
        <p>
          Traditional ATS systems match keywords from the job description against your resume. The
          strategy is straightforward: mirror the language of the job posting. If the job asks for
          "cross-functional collaboration," use that phrase — not "worked with different teams." If
          they list "AWS, Docker, Kubernetes," include those exact terms — not "cloud
          infrastructure." Customize your resume for each application. Generic resumes fail ATS
          screening.
        </p>
        <h3>AI Screeners</h3>
        <p>
          LLM-based screeners go beyond keywords. They evaluate narrative coherence, evidence
          density, and role alignment. They can distinguish between "was involved in" (weak) and
          "led" (strong). They penalize buzzword stuffing and reward concrete examples. The best
          strategy for both systems: write for humans first, then check for keyword alignment
          second. Good human writing passes AI screening naturally — keyword-stuffed writing fails
          with both.
        </p>
      </section>

      <section>
        <h2>The Visual Resume</h2>
        <p>
          Design matters — even for ATS filtering. A well-designed resume isn't just about
          aesthetics; it's about scannability. A busy hiring manager spends 6-7 seconds on a
          first-pass scan. In that time, they need to absorb your name, current role, and one
          standout achievement. Good design makes that possible.
        </p>
        <p>Key design principles:</p>
        <ul>
          <li>
            <strong>Hierarchy.</strong> Section headers should be visually distinct from body text.
            Use font size, weight, and spacing — not color (ATS may strip color).
          </li>
          <li>
            <strong>Whitespace.</strong> Generous margins and line spacing. A cramped resume signals
            disorganization before anyone reads a word.
          </li>
          <li>
            <strong>Consistency.</strong> All dates formatted the same way. All bullet points
            indented the same. All section headers matching in size and style.
          </li>
          <li>
            <strong>One page.</strong> For most professionals with under 10 years of experience, one
            page is sufficient. Two pages for senior roles with extensive experience. Never three.
          </li>
          <li>
            <strong>File format.</strong> PDF, always. Never send a Word document — formatting
            breaks across systems.
          </li>
        </ul>
        <p>
          This is where templates shine. clickfolio.me's templates handle all the design decisions —
          typography, spacing, hierarchy, mobile responsiveness — so your content looks polished by
          default. And because your website is separate from your PDF, you can have an ATS-optimized
          template for applications and a creative template for social sharing.
        </p>
      </section>

      <section>
        <h2>Common Mistakes</h2>
        <ul>
          <li>
            <strong>Too long.</strong> Your resume is a highlight reel, not a documentary. Every
            line should earn its place. If a bullet point doesn't make you a stronger candidate for
            the specific role, remove it.
          </li>
          <li>
            <strong>Generic language.</strong> "Team player," "hard worker," "good communicator" —
            these phrases appear on virtually every resume and convey zero information. Show, don't
            tell. Instead of "good communicator," write "Presented quarterly results to C-suite
            stakeholders across 5 business units."
          </li>
          <li>
            <strong>No metrics.</strong> If your entire resume has zero numbers, it's not a resume —
            it's a job description. Fix this first.
          </li>
          <li>
            <strong>Responsibilities over achievements.</strong> A job title already implies
            responsibilities. Your bullets should describe achievements — what you accomplished in
            the role, not what the role required of you.
          </li>
          <li>
            <strong>Outdated information.</strong> That part-time retail job from 2012? Unless it's
            relevant to your target role, drop it. GPA from 10 years ago? Drop it. "References
            available upon request"? Always drop it — it's assumed.
          </li>
          <li>
            <strong>Neglecting the portfolio link.</strong> Your resume PDF is the appetizer. Your
            portfolio website is the main course. If your resume doesn't include a link to your
            portfolio, you're missing the most powerful conversion tool you have.
          </li>
        </ul>
      </section>

      <section>
        <h2>One Resume, Multiple Formats</h2>
        <p>
          The ultimate approach in 2026: maintain one source of truth for your resume content, then
          deploy it across multiple formats based on context. A PDF for ATS applications. A
          portfolio website for networking and social sharing. A scannable one-pager for career
          fairs. All powered by the same data, updated in one place, instantly reflected everywhere.
        </p>
        <p>
          clickfolio.me makes this possible. Upload your resume once, and you have both a
          downloadable PDF and a hosted portfolio website. Edit your content, and both formats
          update. Switch templates to match the context. It's resume writing reimagined for the way
          hiring actually works.
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Upload your resume and deploy it everywhere →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
