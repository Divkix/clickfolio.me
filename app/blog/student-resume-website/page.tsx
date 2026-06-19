import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("student-resume-website")!;
const relatedPosts = ["how-to-make-a-resume-website", "resume-writing-tips"]
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

export default function StudentResumeWebsitePage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <h2>Can a student make a resume website with no experience?</h2>
        <p>
          Yes. You don't need a job history to build a resume website — you need projects,
          coursework, activities, and a clear way to show them. Upload a one-page resume PDF to a
          free builder and you'll have a hosted site with a shareable link in about 30 seconds. No
          coding, no cost.
        </p>
        <p>
          Most students already have more to show than they think. The trick isn't inventing
          experience. It's framing what you've already built and learned so a recruiter can see it
          in seconds.
        </p>
      </section>

      <section>
        <h2>Should a student have a resume website?</h2>
        <p>
          It's one of the easiest ways to stand out for internships and entry-level roles. Most
          students send a PDF and stop there. A clean link on your application, your LinkedIn, and
          your career-fair conversations signals initiative and makes you easy to remember after a
          recruiter has met 40 people in a day.
        </p>
        <p>
          And it costs you nothing. A study from Workfolio found that 56% of hiring managers were
          more impressed by a personal website than any other branding tool, yet only 7% of job
          seekers had one (Forbes, 2013). For students, that gap is the opportunity: a small amount
          of effort puts you in a category almost no one else bothers to enter.
        </p>
      </section>

      <section>
        <h2>What do I put on a student resume website with no work experience?</h2>
        <p>
          Lead with what you have, and frame it around what you built and learned. A strong student
          site usually includes:
        </p>
        <ul>
          <li>
            <strong>Education.</strong> Your school, program, expected graduation, and relevant
            coursework. GPA if it helps you.
          </li>
          <li>
            <strong>Projects.</strong> Class projects, hackathons, personal builds, anything you
            made. Say what the goal was, what you did, and what came of it.
          </li>
          <li>
            <strong>Skills.</strong> Tools, languages, software, and methods you can actually use.
          </li>
          <li>
            <strong>Activities and leadership.</strong> Clubs, teams, student government, organizing
            — these show ownership and follow-through.
          </li>
          <li>
            <strong>Volunteering and part-time work.</strong> A campus job or tutoring gig
            demonstrates reliability and real responsibility.
          </li>
          <li>
            <strong>Freelance or personal work.</strong> A side project, a small client, a blog, a
            design you shipped. All of it counts.
          </li>
        </ul>
        <p>
          Notice that none of this requires a past internship. "No experience" usually means "no job
          title" — and a resume website is the format that lets your projects and coursework carry
          the weight instead.
        </p>
      </section>

      <section>
        <h2>How do I describe projects and coursework convincingly?</h2>
        <p>
          Use the same shape professionals use for jobs: what was the goal, what did you do, and
          what was the result. For a class project, that might be "Built a budgeting app for a
          software course; led the database design; the team scored in the top three of 30." For a
          club, it might be "Organized a 200-person event; managed a $2,000 budget; grew turnout 40%
          over the prior year."
        </p>
        <p>
          Specifics beat adjectives. "Hard-working team player" tells a recruiter nothing.
          "Coordinated five volunteers and shipped the event on time" shows it. For more on
          phrasing, see our <Link href="/blog/resume-writing-tips">resume writing tips</Link>.
        </p>
      </section>

      <section>
        <h2>How to make a free student resume website</h2>
        <p>You don't need design or coding skills. The fastest path:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Write a one-page resume PDF.</strong> List your education, projects, skills, and
            activities. Even a rough draft is enough to start.
          </li>
          <li>
            <strong>
              Upload it to <Link href="/">clickfolio.me</Link>.
            </strong>{" "}
            The AI reads your PDF and builds a structured site automatically.
          </li>
          <li>
            <strong>Pick a template.</strong> Choose from 10 designs to match the field you're
            applying into.
          </li>
          <li>
            <strong>Review and publish.</strong> Tidy up the wording in the editor and go live at{" "}
            <code>clickfolio.me/@yourhandle</code>.
          </li>
        </ol>
        <p>
          It's free forever — there's no paid tier — and you control what's visible. Built-in
          analytics even show how many people opened your site, which is oddly motivating during an
          internship hunt. Custom domains aren't available yet, so your site lives at your
          clickfolio.me handle for now. If you'd like a step-by-step walkthrough, read{" "}
          <Link href="/blog/how-to-make-a-resume-website">how to make a resume website</Link>, or
          check the guide built for <Link href="/for/student">students</Link>.
        </p>
      </section>

      <section>
        <h2>Make yourself easy to remember</h2>
        <p>
          You're competing for internships against classmates with nearly identical resumes. A
          shareable site is a small move that makes you memorable — at career fairs, in
          applications, and in the follow-up email after you meet a recruiter. It takes about a
          minute and costs nothing.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Build your free student resume website now →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
