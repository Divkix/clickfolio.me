import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import { getThemeReferralRequirement, THEME_METADATA } from "@/lib/templates/theme-ids";

export const revalidate = 3600;

const post = getPostBySlug("clickfolio-templates-showcase");

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
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default function TemplatesShowcasePage() {
  return (
    <BlogPostLayout post={post!}>
      <section>
        <p>
          Your resume content deserves more than a plain text document. It deserves a design that
          matches your profession, personality, and ambition. clickfolio.me offers 10 distinct
          templates — each with its own typography, color scheme, and layout philosophy. Six are
          free. Four are premium, unlocked by sharing clickfolio.me with your network.
        </p>
        <p>Here's every template, what makes it unique, and who it's best for.</p>
      </section>

      <section>
        <h2>Free Templates (No Referrals Required)</h2>

        <h3>{THEME_METADATA.minimalist_editorial.name}</h3>
        <p>
          {THEME_METADATA.minimalist_editorial.description}. This is our default template — and for
          good reason. It uses a clean, magazine-inspired layout with serif typography that gives
          your resume the gravitas of a published article. The generous whitespace and restrained
          color palette let your content do the talking. Best for executives, consultants, and
          anyone who wants their experience to command attention without visual noise. If you're
          unsure which template to choose, start here.
        </p>

        <h3>{THEME_METADATA.neo_brutalist.name}</h3>
        <p>
          {THEME_METADATA.neo_brutalist.description}. This template embraces the neo-brutalist
          design movement — thick black borders, high-contrast colors, and unapologetically bold
          typography. It makes a statement before anyone reads a word. Best for designers,
          creatives, marketers, and anyone who wants their portfolio to scream personality. It's not
          subtle, and that's the point.
        </p>

        <h3>{THEME_METADATA.glass.name}</h3>
        <p>
          {THEME_METADATA.glass.description}. Set against a dark background, content cards appear to
          float with translucent, blurred edges — like frosted glass. The effect is sophisticated
          and modern, giving your resume a premium, almost app-like feel. Best for UI/UX designers,
          product managers, and anyone in tech who appreciates contemporary design language.
        </p>

        <h3>{THEME_METADATA.bento.name}</h3>
        <p>
          {THEME_METADATA.bento.description}. Inspired by Apple's design language, this template
          organizes your resume into a mosaic of colorful, rounded cards. Each section — experience,
          skills, education — gets its own visually distinct card. The result is scannable,
          engaging, and feels less like a document and more like a dashboard. Best for product
          designers, developers, and creative technologists.
        </p>

        <h3>{THEME_METADATA.classic_ats.name}</h3>
        <p>
          {THEME_METADATA.classic_ats.description}. This template is engineered for Applicant
          Tracking Systems. It uses a single-column layout with clear section headers, standard
          fonts, and no visual elements that confuse ATS parsers. Your content flows in a
          predictable, machine-readable hierarchy. Best for job seekers applying to large companies
          where ATS screening is the first filter. If you're actively job hunting, use this template
          — it gives you the SEO benefits of a website while maintaining ATS compatibility.
        </p>

        <h3>{THEME_METADATA.dev_terminal.name}</h3>
        <p>
          {THEME_METADATA.dev_terminal.description}. Your resume rendered as a terminal session —
          complete with a command prompt, monospace typography, and a dark theme. Sections look like
          terminal output, and your skills appear as command-line tools. Best for software
          engineers, DevOps professionals, and anyone whose target audience appreciates developer
          culture. It's a conversation starter and a portfolio piece in itself.
        </p>
      </section>

      <section>
        <h2>Premium Templates (Unlocked via Referrals)</h2>

        <p>
          Premium templates are a reward for sharing clickfolio.me with your network. When friends
          sign up through your referral link, you unlock access. No payment required — just word of
          mouth.
        </p>

        <h3>
          {THEME_METADATA.design_folio.name} ({getThemeReferralRequirement("design_folio")}{" "}
          referrals)
        </h3>
        <p>
          {THEME_METADATA.design_folio.description}. This is the template for designers, by
          designers. Dark background, neon green accents, oversized typography, and asymmetric
          layouts create a digital-brutalist aesthetic that feels like a design agency portfolio.
          It's bold, experimental, and unforgettable. Best for graphic designers, art directors, and
          creative professionals who want their portfolio to demonstrate taste — not just list it.
        </p>

        <h3>
          {THEME_METADATA.spotlight.name} ({getThemeReferralRequirement("spotlight")} referrals)
        </h3>
        <p>
          {THEME_METADATA.spotlight.description}. Warm color palette, smooth scroll animations, and
          a layout that feels like a narrative — not a document. Each section fades or slides into
          view as the reader scrolls, creating an engaging storytelling experience. Best for
          marketers, content creators, and anyone whose work is about narrative and engagement.
        </p>

        <h3>
          {THEME_METADATA.midnight.name} ({getThemeReferralRequirement("midnight")} referrals)
        </h3>
        <p>
          {THEME_METADATA.midnight.description}. This is the most elegant template in the
          collection. Dark background, serif headings in a refined weight, and subtle gold accents
          create a premium, editorial feel. It's minimal but luxurious — like a high-end magazine
          profile. Best for senior executives, consultants, and professionals in finance, law, or
          luxury industries where understated sophistication matters.
        </p>

        <h3>
          {THEME_METADATA.bold_corporate.name} ({getThemeReferralRequirement("bold_corporate")}{" "}
          referrals)
        </h3>
        <p>
          {THEME_METADATA.bold_corporate.description}. This template means business. Heavy
          sans-serif fonts, numbered sections, strong vertical rhythm, and a commanding presence
          that says "executive." It's the most structured template available — every element is
          deliberate and authoritative. Best for C-suite executives, board members, and senior
          leaders who want their portfolio to match their position. This is our most exclusive
          template and requires the most referrals to unlock — it's designed for our most connected
          users.
        </p>
      </section>

      <section>
        <h2>How to Unlock Premium Templates</h2>
        <p>Premium templates are unlocked through our referral system:</p>
        <ul>
          <li>
            <strong>3 referrals</strong> — Unlock DesignFolio and Spotlight
          </li>
          <li>
            <strong>5 referrals</strong> — Unlock Midnight
          </li>
          <li>
            <strong>10 referrals</strong> — Unlock Bold Corporate
          </li>
        </ul>
        <p>
          Each user gets a unique referral code on signup. Share your link with colleagues, on
          social media, or in your email signature. When someone signs up through your link, it
          counts toward your referral total. It's a win-win: your friends get a free portfolio, and
          you unlock premium designs.
        </p>
        <p>
          Your referral count is visible in your dashboard settings. Premium templates show a lock
          icon and the number of referrals needed. Once you hit the threshold, the lock disappears
          and you can switch instantly.
        </p>
      </section>

      <section>
        <h2>How to Switch Templates</h2>
        <p>
          Switching templates is instant and non-destructive. Your resume content lives separately
          from your design, so changing templates doesn't affect your data. Here's how:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to your dashboard and click "Themes"</li>
          <li>Browse the template gallery — each shows a preview thumbnail</li>
          <li>Click "Apply" on any unlocked template</li>
          <li>Your live site updates immediately</li>
        </ol>
        <p>
          You can switch as often as you like. Change templates for different audiences — use
          ClassicATS during a job search, then switch to NeoBrutalist when sharing on social media.
          There's no limit.
        </p>
      </section>

      <section>
        <h2>Which Template Should You Choose?</h2>

        <div className="space-y-4">
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Software Engineer / Developer</h3>
            <p className="text-ink/70">
              DevTerminal or Bento Grid — both speak to technical audiences in their own language.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Designer / Creative</h3>
            <p className="text-ink/70">
              DesignFolio or NeoBrutalist — your portfolio should demonstrate design taste.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Executive / Consultant</h3>
            <p className="text-ink/70">
              Midnight or Minimalist Editorial — gravitas and sophistication.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Active Job Seeker</h3>
            <p className="text-ink/70">
              ClassicATS — ATS-optimized for maximum compatibility with application systems.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Marketer / Content Creator</h3>
            <p className="text-ink/70">
              Spotlight or Bento Grid — visually engaging and narrative-driven.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="text-lg font-bold text-ink mb-1">Finance / Law / Traditional</h3>
            <p className="text-ink/70">
              Bold Corporate or ClassicATS — structured, authoritative, formal.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Start Building</h2>
        <p>
          All templates are available on your dashboard after uploading your resume. The default is
          Minimalist Editorial, but you can switch at any time. Premium templates are waiting —
          share with your network to unlock them.
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Upload your resume and try all 10 templates →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
