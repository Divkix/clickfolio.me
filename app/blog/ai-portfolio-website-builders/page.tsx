import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { ComparisonTable } from "@/components/blog/ComparisonTable";
import { PostList, PostSection } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";

export const revalidate = 86400;

const post = getPostBySlug("ai-portfolio-website-builders")!;

const relatedPosts = ["best-resume-website-builders", "ai-resume-parsing-accuracy"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export function generateMetadata(): Metadata {
  return buildBlogPostMetadata(post);
}

export default function AiPortfolioWebsiteBuildersPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          If you want an AI tool to turn your resume or LinkedIn profile into a portfolio website
          for free, clickfolio.me, Butternut AI, linkfolio.net and Artfolio will all publish one on
          a free plan. If you need your own domain today, linkfolio.net (€4.99/month), Fastfolio
          ($8/month) and Butternut AI ($12/month) include one on paid plans.
        </p>
        <p>
          This page only covers tools that start from something you already have: a PDF resume, a
          LinkedIn profile, or a short chat about your career. General AI site builders that make
          you write everything from scratch are mentioned at the end for contrast. We build{" "}
          <Link href="/" className="text-brand font-semibold">
            clickfolio.me
          </Link>
          , so we are biased. We have tried to say plainly where other tools do something better,
          starting with the fact that clickfolio.me has no custom domain support yet. All prices and
          plan details below were checked as of September 2026.
        </p>
      </section>

      <section>
        <h2>AI portfolio website builders compared</h2>
        <ComparisonTable
          headers={["Tool", "Input", "Free tier", "Custom domain", "Price (Sept 2026)"]}
          rows={[
            [
              "clickfolio.me",
              "PDF resume or LinkedIn PDF export",
              "Yes, everything (10 templates)",
              "Not yet",
              "Free, open source (MIT)",
            ],
            [
              "Butternut AI",
              "Resume/CV PDF",
              "Yes, yourname.butternut.ai, 20 AI credits",
              "Yes, Pro",
              "Starter $5/mo, Pro $12/mo",
            ],
            [
              "Fastfolio",
              "Resume, LinkedIn, GitHub",
              "Yes, with watermark",
              "Yes, Pro and Lifetime",
              "Pro $8/mo or $96/yr; Lifetime $49",
            ],
            [
              "linkfolio.net",
              "Resume upload, chat or voice",
              "Yes, .linkfolio.net subdomain + watermark",
              "Yes, Basic and up",
              "Basic €4.99/mo, Pro €9.99/mo",
            ],
            [
              "linkfolio.cv",
              "PDF, DOCX or TXT (no AI claim)",
              "Yes, up to 5 portfolios",
              "Not mentioned",
              "Free",
            ],
            [
              "Kickresume",
              "LinkedIn import or a Kickresume resume",
              "1 basic website template",
              "Not stated",
              "$24/mo, or $8/mo billed yearly",
            ],
            [
              "Standard Resume",
              "LinkedIn import",
              "Yes, web resume + PDF",
              "Custom URL on Pro; own domain unconfirmed",
              "Pro $19/mo",
            ],
            [
              "Reactive Resume",
              "JSON, PDF or Word (AI with your own key)",
              "Entirely free",
              "Only if self-hosted",
              "Free, open source (MIT)",
            ],
            [
              "FolioResume",
              "PDF resume",
              "Prepare only; publishing is paid",
              "Not stated",
              "Not published",
            ],
            ["Artfolio", "PDF resume", "Free to publish, 8 designs", "Not stated", "Free"],
            [
              "Wix AI Portfolio Generator",
              "Prompts and your media (no resume import)",
              "Yes, free to publish",
              "Yes, paid plans",
              "From $17/mo",
            ],
          ]}
        />
        <p>
          &quot;Not stated&quot; means the tool&apos;s own site did not say either way when we
          checked. Treat it as a question to ask before you pay, not as a no.
        </p>
      </section>

      <section>
        <h2>Short reviews of each resume-to-portfolio AI tool</h2>

        <h3>clickfolio.me: free and fast, no custom domain yet</h3>
        <p>
          You upload a PDF resume, or the PDF LinkedIn gives you from &quot;Save to PDF&quot;, and
          the AI reads it into sections. About thirty seconds later there is a live site at
          clickfolio.me/@yourhandle. Every field stays editable, all 10 templates are free, you can
          hide your phone number or address with privacy toggles, and view analytics are built in.
          The code is MIT-licensed on GitHub, so you could self-host it if we ever disappeared. The
          gaps: no custom domain, no password protection, and no long-form case-study editor. Our{" "}
          <Link href="/blog/pdf-resume-to-website" className="text-brand font-semibold">
            PDF resume to website guide
          </Link>{" "}
          walks through the whole flow.
        </p>

        <h3>Butternut AI: cheap path to a custom domain</h3>
        <p>
          Butternut AI takes a resume or CV PDF and builds a portfolio on a yourname.butternut.ai
          subdomain. The free plan comes with 20 AI credits. Starter is $5/month and Pro is
          $12/month, and Pro is where a custom domain comes in. If you want AI generation plus your
          own domain from one company, this is one of the cheaper routes we found.
        </p>

        <h3>Fastfolio: a portfolio visitors can chat with</h3>
        <p>
          Fastfolio does something none of the others do. It builds an AI version of you that
          visitors can question about your work, and it can draw from your resume, LinkedIn and
          GitHub. It is aimed at developers, AI engineers and freelancers. The free plan carries a
          watermark. Pro costs $8/month or $96/year, and a $49 one-time Lifetime plan runs on your
          own OpenAI key. Both paid plans support a custom domain. Whether a recruiter wants to chat
          with a bot instead of skimming a page is a fair question, so look at a few live examples
          before you commit.
        </p>

        <h3>linkfolio.net and linkfolio.cv: two different Linkfolios</h3>
        <p>
          linkfolio.net builds a portfolio from a resume upload, a chat or a voice conversation. It
          also does AI translation, PDF export and a contact QR code. Free sites live on a
          .linkfolio.net subdomain with a watermark. Basic (€4.99/month) adds a custom domain and
          Pro (€9.99/month) adds more languages and analytics. linkfolio.cv is a separate product:
          free forever, up to five portfolios, resume import from PDF, DOCX or TXT, and URLs of the
          form linkfolio.cv/yourname. It makes no AI claims on its homepage. We compare both in more
          detail in our{" "}
          <Link href="/blog/linkfolio-alternatives" className="text-brand font-semibold">
            Linkfolio alternatives guide
          </Link>
          .
        </p>

        <h3>Kickresume and Standard Resume: resume builders with a web page</h3>
        <p>
          Both are resume builders first. Kickresume can import from LinkedIn and turn a Kickresume
          resume into a website. One basic website template is free. The paid plan is $24/month on
          monthly billing or $8/month billed yearly. Standard Resume also imports from LinkedIn,
          hosts a clean web resume on its free tier, and puts a custom URL behind its $19/month Pro
          plan. We could not confirm that Pro lets you connect a domain you own. Pick either one if
          you care most about the resume document and the website is a bonus.
        </p>

        <h3>Reactive Resume: open source, bring your own AI key</h3>
        <p>
          Reactive Resume is free, MIT-licensed and self-hostable. It imports JSON, JSON Resume, PDF
          and Word files, and the PDF and Word import uses AI through a key you supply (OpenAI,
          Anthropic, Gemini, OpenRouter or a local Ollama model). There is no native LinkedIn
          import: a GitHub issue asking for one was opened on September 22, 2026 and is still open.
          The public page is a shareable resume, optionally password-protected, not a multi-section
          portfolio.
        </p>

        <h3>FolioResume and Artfolio: PDF in, portfolio out</h3>
        <p>
          FolioResume parses a PDF resume with AI and lets you prepare the portfolio for free, but
          publishing it publicly requires a paid plan, and the price is not on the site. Artfolio
          also converts a PDF resume, offers 8 designs, and says publishing is free. Neither states
          whether you can use your own domain.
        </p>

        <h3>Wix AI and Copyfolio: AI help, but no resume import</h3>
        <p>
          The Wix AI Portfolio Generator creates layouts and copy from prompts and the media you
          upload. It is free to publish, paid plans start at $17/month, and a custom domain comes
          with paid plans. It does not read your resume. Copyfolio targets writers and marketers,
          has an AI branding coach called Brandi, and supports a custom domain on its $15/month
          Premium plan after a 7-day trial. It also has no resume import. Both are good if you want
          to design from scratch with some AI help. If you are comparing design-led portfolio tools
          in general, our{" "}
          <Link href="/blog/designfolio-alternatives" className="text-brand font-semibold">
            Designfolio alternatives roundup
          </Link>{" "}
          covers that side.
        </p>

        <h3>Jobfolio and Zapfolio: offline when we checked</h3>
        <p>
          Jobfolio.ai advertised a live portfolio link built from an old resume, a LinkedIn URL or
          notes. Zapfolio turned a pasted LinkedIn URL into a themed site. Both appeared offline
          when we checked in September 2026, and neither has posted a shutdown notice that we could
          find. The similarly named jobfolio.app is a job-application tracker, not a website
          builder.
        </p>
      </section>

      <PostSection
        heading="What does the AI actually do in these tools?"
        intro="Strip away the marketing and most resume-to-portfolio tools run the same three steps:"
      >
        <PostList
          ordered
          items={[
            {
              lead: "Extract the text.",
              body: " The tool pulls raw text out of your PDF, Word file or LinkedIn export. Scanned or image-only PDFs have no text layer, so this step can fail before any AI gets involved.",
            },
            {
              lead: "Map it to structured sections.",
              body: " A language model decides which lines are job titles, employers, dates, degrees and skills, and fills a schema. This is where multi-column layouts, unusual date formats and creative section headings cause mistakes.",
            },
            {
              lead: "Render a template.",
              body: " The structured data drops into a design. Some tools also write new copy at this stage, such as a bio or a tagline, and Fastfolio goes further by answering visitor questions.",
            },
          ]}
        />
        <p>
          The practical takeaway: always read the result before you share the link. A misread date
          or a job merged into the wrong employer is easy to miss and looks careless to a recruiter.
          We tested where parsing breaks in{" "}
          <Link href="/blog/ai-resume-parsing-accuracy" className="text-brand font-semibold">
            how accurate AI resume parsing really is
          </Link>
          . Also be wary of AI-written copy. Generated bios tend to sound the same across hundreds
          of sites, so rewrite the summary in your own words.
        </p>
        <p>
          LinkedIn input is its own problem. Tools that take a profile URL depend on being able to
          fetch that page, and that can stop working without warning. Exporting your profile with
          LinkedIn&apos;s &quot;Save to PDF&quot; option and uploading the file is the more reliable
          route. Our{" "}
          <Link href="/blog/linkedin-to-portfolio" className="text-brand font-semibold">
            LinkedIn to portfolio walkthrough
          </Link>{" "}
          shows the exact steps.
        </p>
      </PostSection>

      <PostSection heading="How to choose an AI portfolio generator">
        <PostList
          items={[
            {
              lead: "You want it free, fast and portable:",
              body: " clickfolio.me. Upload a PDF, get a site in about thirty seconds, and keep the option to self-host because the code is open source.",
            },
            {
              lead: "You need your own domain this week:",
              body: " linkfolio.net Basic (€4.99/mo), Fastfolio Pro ($8/mo) or Butternut AI Pro ($12/mo). clickfolio.me cannot do this yet.",
            },
            {
              lead: "You want visitors to talk to an AI version of you:",
              body: " Fastfolio is built around that idea.",
            },
            {
              lead: "You want full control and don't mind setup:",
              body: " Reactive Resume, self-hosted, with your own AI key.",
            },
            {
              lead: "You care more about the resume than the site:",
              body: " Kickresume or Standard Resume.",
            },
            {
              lead: "You would rather design from a blank canvas:",
              body: " Wix AI or Copyfolio, since neither reads your resume anyway.",
            },
          ]}
        />
        <p>
          A note on domains, since it decides a lot of these picks. A custom domain looks polished,
          but an application form or a LinkedIn profile only needs a link that works. A clean hosted
          URL like clickfolio.me/@yourname or yourname.butternut.ai does the job while you are job
          hunting. If you already own a domain and want it live now, pay for one of the tools that
          supports it. If not, start free and move later once you know which tool you like.
        </p>
        <p>
          Before paying for anything, check two things: whether the free tier lets you publish at
          all (FolioResume does not), and whether you can export your content if the service shuts
          down. Jobfolio and Zapfolio are recent reminders that small tools go offline. For a wider
          comparison that includes non-AI builders like Carrd, see our{" "}
          <Link href="/blog/best-resume-website-builders" className="text-brand font-semibold">
            best resume website builders roundup
          </Link>
          .
        </p>
      </PostSection>

      <section>
        <h2>Try it with the resume you already have</h2>
        <p>
          The quickest way to judge any of these tools is to feed it your real resume and read what
          comes out. clickfolio.me is free with no card required, and you can delete everything
          afterwards.
        </p>
        <p>
          <Link href="/" className="text-brand font-semibold">
            Turn your resume into a website →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
