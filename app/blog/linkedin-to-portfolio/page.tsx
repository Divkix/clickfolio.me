import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("linkedin-to-portfolio")!;

export function generateMetadata(): Metadata {
  if (!post) return {};
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
    robots: { index: true, follow: true },
  };
}

export default function LinkedInToPortfolioPage() {
  return (
    <BlogPostLayout post={post}>
      <section>
        <p>
          LinkedIn is a powerful professional network — but it's rented land. You don't own your
          LinkedIn profile. LinkedIn controls how it looks, who sees it, what features are
          available, and ultimately whether it exists at all. If LinkedIn changes its algorithm
          tomorrow, your visibility could drop to zero. If they remove a feature you rely on,
          there's nothing you can do about it.
        </p>
        <p>
          A portfolio website, on the other hand, is land you own. You control the design, the
          content, the URL, and the analytics. No algorithm decides whether someone sees it. No
          platform limits what you can show. This guide shows you how to have both — LinkedIn for
          networking, and your own website for ownership.
        </p>
      </section>

      <section>
        <h2>Why LinkedIn Isn't Enough</h2>
        <p>LinkedIn is essential — but it's not sufficient. Here's why:</p>
        <ul>
          <li>
            <strong>Algorithm dependence.</strong> Your profile's visibility depends on LinkedIn's
            algorithm. Post views, profile appearances, and search rankings within LinkedIn are all
            gatekept by a system you don't control. A website ranks on Google — a fundamentally more
            open and predictable system.
          </li>
          <li>
            <strong>Limited customization.</strong> Your LinkedIn profile looks like everyone else's
            LinkedIn profile. Same layout, same blue-and-white color scheme, same typography. A
            portfolio website lets you express personality, taste, and professional identity through
            design.
          </li>
          <li>
            <strong>No custom domain.</strong> Your LinkedIn URL is{" "}
            <code>linkedin.com/in/yourname</code>. Your portfolio can be <code>yourname.com</code> —
            which looks infinitely more professional on a resume, business card, or email signature.
          </li>
          <li>
            <strong>Competition for attention.</strong> On LinkedIn, your profile competes with job
            ads, sponsored content, and LinkedIn's own "People Also Viewed" recommendations. On your
            own site, you're the only thing a visitor sees.
          </li>
          <li>
            <strong>No analytics.</strong> LinkedIn tells you who viewed your profile — sometimes. A
            website gives you real analytics: how many visitors, where they came from, what pages
            they read, and how long they stayed.
          </li>
        </ul>
      </section>

      <section>
        <h2>The LinkedIn + Portfolio Combo</h2>
        <p>
          The smartest strategy isn't LinkedIn <em>or</em> a portfolio — it's LinkedIn <em>and</em>{" "}
          a portfolio. They serve different purposes and complement each other:
        </p>
        <ul>
          <li>
            <strong>LinkedIn is your networking hub.</strong> Connect with colleagues, recruiters,
            and industry peers. Engage with content. Build your professional network. LinkedIn is
            where people discover you.
          </li>
          <li>
            <strong>Your portfolio is your destination.</strong> When someone wants to learn more
            about you — your work, your projects, your full career story — send them to your
            portfolio. It's your curated, designed, controlled showcase. LinkedIn introduces you;
            your portfolio closes the deal.
          </li>
        </ul>
        <p>LinkedIn is the handshake. Your portfolio is the conversation.</p>
      </section>

      <section>
        <h2>How to Turn Your LinkedIn Profile into a Website</h2>
        <p>
          If your LinkedIn profile is your most up-to-date professional record, you can use it to
          create your portfolio website in two ways:
        </p>
        <h3>Method 1: Export LinkedIn as PDF, Upload to clickfolio.me</h3>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>Export your LinkedIn profile as a PDF.</strong> Go to your LinkedIn profile,
            click "More..." under your headline, and select "Save to PDF." LinkedIn generates a PDF
            of your entire profile.
          </li>
          <li>
            <strong>Upload the PDF to clickfolio.me.</strong> The AI parser reads your LinkedIn PDF
            and extracts your experience, education, skills, and contact information — same as any
            resume PDF.
          </li>
          <li>
            <strong>Review and edit.</strong> LinkedIn's PDF format is unconventional, so the parser
            may need slightly more cleanup than a standard resume. The editor makes this fast.
          </li>
          <li>
            <strong>Publish.</strong> Your portfolio is live at <code>clickfolio.me/@yourname</code>
            . Add your portfolio link to your LinkedIn profile's Featured section, Contact Info, and
            About section.
          </li>
        </ol>

        <h3>Method 2: Use Your Resume PDF</h3>
        <p>
          If you have a resume PDF that mirrors your LinkedIn profile (as most professionals do),
          upload that instead. Resume PDFs are formatted for the AI parser and typically produce
          more accurate results than LinkedIn's exported PDF. Either method works — use whichever is
          more up-to-date.
        </p>
      </section>

      <section>
        <h2>Adding Your Portfolio Link to LinkedIn</h2>
        <p>Once your portfolio is live, make sure LinkedIn visitors can find it:</p>
        <h3>Featured Section</h3>
        <p>
          The Featured section is the most prominent spot on your LinkedIn profile — it sits right
          below your About section and supports links. Add your portfolio URL here with a
          description like "My professional portfolio — see my full experience, projects, and
          skills." This is the first thing visitors see after your headline.
        </p>
        <h3>Contact Info</h3>
        <p>
          Edit your contact information and add your portfolio URL under "Website." LinkedIn lets
          you add up to three websites. Use labels like "Portfolio" or "Personal Website" so
          visitors know what they're clicking.
        </p>
        <h3>About Section</h3>
        <p>
          Mention your portfolio in your About section with a direct link. Something like: "Learn
          more about my work and experience at [your portfolio URL]." This gives context to the link
          and encourages clicks.
        </p>
        <h3>Email Signature</h3>
        <p>
          Add your portfolio link to your email signature. Every email you send becomes a potential
          portfolio view. A simple line like "View my portfolio: [your URL]" works.
        </p>
      </section>

      <section>
        <h2>SEO Benefits</h2>
        <p>
          Here's something LinkedIn can't do: rank your name on Google. When someone searches for
          you, your LinkedIn profile will typically appear in results — but so will other people
          with similar names, your Twitter profile, and random mentions. A portfolio website with
          your name in the URL, title, and heading has a much better chance of ranking for your name
          specifically.
        </p>
        <p>
          And it compounds over time. Every view, every link from another site, every share on
          social media signals to Google that your portfolio is the authoritative source for your
          professional identity. LinkedIn profiles come and go in search rankings based on
          LinkedIn's domain authority — your own domain builds its own authority.
        </p>
      </section>

      <section>
        <h2>Own Your Presence</h2>
        <p>
          LinkedIn is where you network. Your portfolio is where you own. Together, they're the most
          powerful combination for building your professional online presence. The best part?
          Setting up a portfolio takes less than a minute if you already have a resume or LinkedIn
          PDF.
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Upload your resume and build your portfolio now →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
