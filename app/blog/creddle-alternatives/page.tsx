import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("creddle-alternatives")!;

const relatedPosts = ["read-cv-alternatives", "best-resume-website-builders"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function CreddleAlternativesPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          Creddle shut down on December 1, 2024, and it is not coming back, so you need a new home
          for your resume. If you used Creddle for its free hosted web resume, a free resume website
          builder like <Link href="/">clickfolio.me</Link> is the closest replacement. If you mostly
          used it to produce a tidy PDF, Standard Resume or the open-source Reactive Resume will
          serve you better.
        </p>
        <p>
          We build clickfolio.me, so we are biased. This guide tries to be useful anyway: it covers
          what happened to Creddle, what it did well, which tools cover each of those jobs today,
          and where clickfolio.me falls short. Prices and plans below are as of September 2026.
        </p>
      </section>

      <section>
        <h2>What happened to Creddle?</h2>
        <p>
          Creddle (creddle.io) was a free resume builder run by its founder, Chris Carey. According
          to the{" "}
          <a
            href="http://web.archive.org/web/20250429144015/http://creddle.io/"
            rel="noopener"
            className="text-brand font-semibold"
          >
            shutdown notice archived on the Wayback Machine
          </a>
          , the service closed on December 1, 2024. The same notice says data export had closed and
          that all user data would be completely deleted in 2025. Users also shared the shutdown
          email on social media before the closing date.
        </p>
        <p>
          When we tried creddle.io in September 2026, the domain refused the connection entirely. We
          have found no way to recover a Creddle account or export an old resume after the deadline,
          and nothing in the archived notice suggests one exists. If you didn&apos;t download your
          resume before December 2024, plan to rebuild it from another source.
        </p>
      </section>

      <PostSection
        heading="What Creddle users actually miss"
        intro="Creddle's archived homepage described each resume as both a website and a paper résumé, and said building, customizing, linking, embedding, exporting, and printing were all free. That combination is what's hard to replace. Use it as your checklist:"
      >
        <PostList
          items={[
            {
              lead: "Free, for real.",
              body: " Many tools that call themselves free charge to download a PDF or to publish a web version. Creddle didn't.",
            },
            {
              lead: "One source, two outputs.",
              body: " You kept a single resume and got both a shareable web page and a printable PDF from it.",
            },
            {
              lead: "A one-page PDF that fit.",
              body: " Creddle automatically fit the paper version onto one page, which saved a lot of fiddling with margins.",
            },
            {
              lead: "A link you could paste anywhere.",
              body: " Applications, email signatures, and LinkedIn all got the same hosted resume URL. Creddle also let you embed it on your own website.",
            },
          ]}
        />
        <p>
          We didn&apos;t find a free tool that matches all four exactly. The practical answer is to
          pick the tool that covers the job you cared about most, and keep a PDF copy of your resume
          somewhere you control.
        </p>
      </PostSection>

      <section>
        <h2>The best Creddle alternatives compared</h2>
        <ComparisonTable
          headers={["Tool", "Web resume link", "PDF resume", "Imports your resume", "Price"]}
          rows={[
            [
              "clickfolio.me",
              "Yes, clickfolio.me/@handle",
              "No, it builds the site from your PDF",
              "Yes, AI parses a PDF or LinkedIn PDF",
              "Free, open source (MIT)",
            ],
            [
              "Standard Resume",
              "Yes (custom URL on Pro)",
              "Yes",
              "LinkedIn import",
              "Free Basic, Pro $19/mo",
            ],
            [
              "Reactive Resume",
              "Yes, public share link",
              "Yes",
              "JSON, JSON Resume, PDF/Word via AI (your own key)",
              "Free, open source (MIT)",
            ],
            [
              "Kickresume",
              "Yes, 1 basic website template free",
              "Not confirmed, check your plan",
              "LinkedIn import",
              "Free plan, Premium $8/mo yearly",
            ],
            [
              "JSON Resume",
              "Depends where you deploy",
              "Depends on theme and tooling",
              "JSON, CLI, gists",
              "Free",
            ],
            [
              "Carrd",
              "Yes, a site you design",
              "No",
              "No, you build it by hand",
              "Free, Pro from $9/yr",
            ],
          ]}
        />
        <p>
          Two notes on the table. Carrd&apos;s custom domain starts on Pro Standard at $19/year; the
          $9/year Pro Lite tier doesn&apos;t include one. And Reactive Resume has no native LinkedIn
          import at the moment, although there is an open request for it.
        </p>
      </section>

      <section>
        <h2>Is there a free resume builder like Creddle?</h2>
        <p>
          Yes, but it depends on which half of Creddle you mean. Plenty of popular resume builders
          show up in &quot;Creddle alternative&quot; lists, and several of them (Zety and Resume.io
          among them) put downloads or key features behind a paywall. That breaks the main reason
          people chose Creddle in the first place.
        </p>
        <p>
          If you split the job in two, the free options get much clearer. For the hosted web resume,
          clickfolio.me is free with no paid tier at all. For the PDF, Reactive Resume is free and
          open source, and Standard Resume&apos;s Basic plan costs nothing. Using one tool for each
          half is a small amount of extra upkeep, but it gets you back to what Creddle offered
          without a subscription. When you change jobs, update the PDF first, then upload the new
          version or edit the site directly so the two stay in sync.
        </p>
      </section>

      <section>
        <h2>Which Creddle replacement fits you?</h2>

        <h3>You want the free hosted web resume back: clickfolio.me</h3>
        <p>
          The web half of Creddle is the one most lists skip, and it is what we built clickfolio.me
          for. You upload a PDF resume, the AI reads your experience, education, and skills, and
          about 30 seconds later you have a live page at clickfolio.me/@yourname. Everything stays
          editable afterwards. You get 12 templates (all free), privacy toggles to hide your phone
          number or address, and built-in view analytics. There is no paid tier.
        </p>
        <p>
          Where it falls short for ex-Creddle users: clickfolio.me doesn&apos;t design or export a
          PDF resume for you, so keep your PDF in a separate tool or file. There is no custom domain
          yet either (it is on the roadmap), so your link lives on clickfolio.me/@handle. The{" "}
          <Link href="/blog/pdf-resume-to-website">PDF resume to website guide</Link> walks through
          the whole flow.
        </p>

        <h3>You want a clean PDF plus a web version: Standard Resume</h3>
        <p>
          Standard Resume is the closest match to Creddle&apos;s &quot;one resume, two outputs&quot;
          idea. You can import from LinkedIn on the free Basic plan, and you get a PDF and a
          shareable web resume. The custom web-resume URL and view tracking sit behind Pro at
          $19/month, which is a real step away from Creddle&apos;s free promise.
        </p>

        <h3>You never want to lose your resume to a shutdown again: Reactive Resume</h3>
        <p>
          Reactive Resume is free, open source under the MIT license, and self-hostable. It produces
          a resume PDF and a public link, with an optional password on that link. It can import
          JSON, JSON Resume files, and PDF or Word resumes through AI if you bring your own API key.
          The output is a resume document, not a full website, and a custom domain means running it
          yourself.
        </p>

        <h3>You want writing help first: Kickresume</h3>
        <p>
          Kickresume is an AI resume builder with a personal website feature on the side. The free
          plan includes one basic website template, and Premium costs $8/month billed yearly ($24 if
          you pay monthly). Pick it if you want help rewriting your bullets more than you want a
          polished site.
        </p>

        <h3>Developers and tinkerers: JSON Resume or Carrd</h3>
        <p>
          JSON Resume is an open standard. You write your resume once as a JSON file and render it
          with community themes, which makes it portable and free, but you handle the tooling and
          hosting. Carrd is the opposite: a cheap one-page site builder where you lay out every
          block yourself, with no resume import. For a longer look at all of these, see our roundup
          of the{" "}
          <Link href="/blog/best-resume-website-builders">best free resume website builders</Link>.
        </p>
      </section>

      <section>
        <h2>How to move your resume from Creddle</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Find a copy of your resume.</strong> Search your downloads, email attachments,
            and cloud drive for a PDF you exported from Creddle before it closed. If there
            isn&apos;t one, any recent resume PDF works. No resume at all? Use LinkedIn&apos;s
            &quot;Save to PDF&quot; option on your profile; our guide to turning a{" "}
            <Link href="/blog/linkedin-to-portfolio">
              LinkedIn profile into a portfolio website
            </Link>{" "}
            covers that export step.
          </li>
          <li>
            <strong>Upload it.</strong> Drop the PDF into <Link href="/">clickfolio.me</Link>. The
            AI parses it and builds your page in about 30 seconds, with no retyping.
          </li>
          <li>
            <strong>Check the details and pick a template.</strong> Fix anything the parser missed,
            hide fields you don&apos;t want public, and choose one of the 12 templates.
          </li>
          <li>
            <strong>Replace every old Creddle link.</strong> Old creddle.io URLs now lead nowhere.
            Update your LinkedIn profile, email signature, GitHub, job board profiles, and any site
            where you embedded your Creddle resume.
          </li>
        </ol>
        <p>
          Keep the PDF you uploaded. It is still your application document, and having it on your
          own drive is the simplest protection against the next shutdown.
        </p>
      </section>

      <section>
        <h2>Don&apos;t get caught by the next shutdown</h2>
        <p>
          Creddle ran for years before closing, and Read.cv went the same way in 2025 (our{" "}
          <Link href="/blog/read-cv-alternatives">Read.cv alternatives guide</Link> covers that
          one). Free services can end, and you should pick your next tool with that in mind:
        </p>
        <ul>
          <li>
            <strong>Keep your source file.</strong> A PDF or JSON copy on your own drive means a
            shutdown costs you an afternoon at most.
          </li>
          <li>
            <strong>Prefer open source.</strong> clickfolio.me and Reactive Resume are both MIT
            licensed, so the code can be self-hosted even if the hosted service ever changes.
          </li>
          <li>
            <strong>Know how you&apos;ll get your data out.</strong> Check a tool&apos;s export
            options before you invest time in it.
          </li>
        </ul>
        <p>
          If you mainly want a stable place for a shareable resume link, our guide to{" "}
          <Link href="/blog/resume-hosting">resume hosting</Link> compares the options, from a plain
          PDF link to a full resume site.
        </p>
      </section>

      <section>
        <h2>Replace Creddle in a few minutes</h2>
        <p>
          Creddle is gone, but the resume you built there probably still exists as a PDF somewhere.
          Upload it, and you&apos;ll have a free hosted resume link again in under a minute.
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
