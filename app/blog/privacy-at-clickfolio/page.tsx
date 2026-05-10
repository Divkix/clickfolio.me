import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 3600;

const post = getPostBySlug("privacy-at-clickfolio")!;
const relatedPosts = ["pdf-resume-to-website", "best-resume-website-builders"]
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

export default function PrivacyAtClickfolioPage() {
  return (
    <BlogPostLayout post={post} relatedPosts={relatedPosts}>
      <section>
        <p>
          Most free online tools have a hidden cost: your data. Resume builders that sell your
          information to recruiters. Portfolio platforms that mine your content for ad targeting.
          "Free" services that turn your professional identity into someone else's product.
        </p>
        <p>
          At clickfolio.me, privacy isn't an afterthought or a checkbox. It's a core feature — one
          of the main reasons we built this platform. Here's exactly how we handle your data, what
          controls you have, and how we compare to the alternatives.
        </p>
      </section>

      <section>
        <h2>Privacy Controls</h2>
        <p>
          Your resume contains sensitive information. Your phone number, your home address, your
          employment history — this is personal data that deserves granular control. clickfolio.me
          gives you per-field privacy toggles:
        </p>
        <ul>
          <li>
            <strong>Show phone number.</strong> On by default. Toggle off to hide your phone from
            your public portfolio while keeping it in your account. Recruiters can still reach you
            via email.
          </li>
          <li>
            <strong>Show full address.</strong> On by default. Toggle off to show only city and
            state — enough for recruiters to know your general location without exposing your street
            address.
          </li>
          <li>
            <strong>Show in public directory.</strong> On by default. Toggle off to remove your
            portfolio from the Explore page and our public directory. Your portfolio still exists —
            it's just not listed alongside others. People can only find it if you share the link
            directly.
          </li>
        </ul>
        <p>
          These controls are accessible from your Settings page at any time. Changes take effect
          immediately. There's no delay, no review process, no "contact us to request removal." You
          control your visibility in real time.
        </p>
      </section>

      <section>
        <h2>Data Collection</h2>
        <p>We believe in minimal data collection. Here's what we do and don't collect:</p>
        <h3>What We Collect</h3>
        <ul>
          <li>
            <strong>Authentication data.</strong> When you sign in with Google, we receive your
            name, email, and profile picture URL. We don't store your Google password — we never see
            it.
          </li>
          <li>
            <strong>Resume content.</strong> Your uploaded PDF and the parsed, structured data
            extracted from it — including name, experience, education, skills, and contact
            information. This is the content of your portfolio.
          </li>
          <li>
            <strong>Usage analytics.</strong> Page views on your public portfolio — how many
            visitors, where they came from, what devices they use. This helps you understand your
            reach. It's also aggregated anonymously for our own platform analytics.
          </li>
        </ul>
        <h3>What We Don't Collect</h3>
        <ul>
          <li>
            <strong>Your contacts or address book.</strong> Never.
          </li>
          <li>
            <strong>Your browsing history on other sites.</strong> Never.
          </li>
          <li>
            <strong>Your location beyond what's in your resume.</strong> We use IP geolocation for
            analytics at the city level, but this is not stored or linked to your account.
          </li>
          <li>
            <strong>Your social media activity.</strong> We don't scrape, monitor, or analyze your
            social media presence.
          </li>
          <li>
            <strong>Payment information.</strong> clickfolio.me is free. We don't have payment
            processing, so there's no credit card data to collect.
          </li>
        </ul>
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>We use a minimal set of third-party services, chosen for their privacy posture:</p>
        <div className="space-y-4">
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">Google OAuth</h3>
            <p className="text-ink/70 text-sm">
              For authentication only. Google receives only the fact that you're signing into
              clickfolio.me. We don't access your Google Drive, contacts, or any other Google
              service.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">OpenRouter (AI API)</h3>
            <p className="text-ink/70 text-sm">
              Your resume PDF text is sent to an AI model through OpenRouter for parsing. OpenRouter
              does not store or train on API inputs. The AI reads your resume content to extract
              structured data and returns it — the content is not retained by the AI provider.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">Cloudflare</h3>
            <p className="text-ink/70 text-sm">
              All data — your account, your resume, your portfolio — is stored on Cloudflare's
              infrastructure (Workers, D1 database, R2 storage). Cloudflare is SOC 2 Type II and ISO
              27001 certified. They provide infrastructure-level encryption at rest. They do not
              access or use your data.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">Self-Hosted Analytics</h3>
            <p className="text-ink/70 text-sm">
              We run our own analytics instance (Umami, self-hosted). Unlike Google Analytics, Umami
              doesn't use cookies for tracking, doesn't collect personal data, and doesn't share
              data with third parties. All analytics data stays on our infrastructure.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>Data Retention &amp; Deletion</h2>
        <h3>Unclaimed Uploads</h3>
        <p>
          If you upload a resume but don't sign in to claim it within 30 days, the file and any
          associated data are automatically and permanently deleted. This ensures abandoned uploads
          don't linger on our servers indefinitely.
        </p>
        <h3>Account Deletion</h3>
        <p>You can delete your account at any time from the Settings page. When you do:</p>
        <ul>
          <li>All your personal data is permanently removed from our systems within 30 days</li>
          <li>Your uploaded PDF file is deleted from cloud storage</li>
          <li>Your parsed resume content is deleted from the database</li>
          <li>Your public portfolio URL becomes a 404 page immediately</li>
          <li>Your analytics data is deleted</li>
        </ul>
        <p>
          Some anonymized, aggregated data may be retained for platform analytics — for example, "X
          resumes were uploaded in April 2026." This data cannot be used to identify you or
          reconstruct your profile.
        </p>
        <h3>Session Data</h3>
        <p>
          Authentication sessions expire after a set period of inactivity. Expired sessions are
          automatically cleaned up by our scheduled maintenance process. You can also log out of all
          sessions from your Settings page.
        </p>
      </section>

      <section>
        <h2>Where Your Data Lives</h2>
        <p>All clickfolio.me data is stored on Cloudflare's global infrastructure:</p>
        <ul>
          <li>
            <strong>Cloudflare Workers.</strong> Your portfolio website is served from Cloudflare's
            edge network — over 330 cities worldwide. Requests are handled at the data center
            closest to your visitor, which means fast load times and reduced latency for everyone,
            everywhere.
          </li>
          <li>
            <strong>D1 (SQLite database).</strong> Your account data and parsed resume content are
            stored in Cloudflare D1, a globally distributed SQLite database. Data is replicated
            across Cloudflare's network for reliability.
          </li>
          <li>
            <strong>R2 (object storage).</strong> Your uploaded PDF files are stored in Cloudflare
            R2, designed for zero egress fees and S3-compatible object storage. Files are encrypted
            at rest.
          </li>
        </ul>
        <p>
          We chose Cloudflare specifically because they provide infrastructure-level security and
          encryption without requiring us to manage servers or implement our own encryption layer.
          This reduces the attack surface and means fewer opportunities for data exposure.
        </p>
      </section>

      <section>
        <h2>Comparison: clickfolio.me vs Other Tools</h2>
        <p>Privacy practices vary dramatically across resume and portfolio platforms:</p>
        <div className="space-y-4">
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">clickfolio.me</h3>
            <p className="text-ink/70 text-sm">
              No data selling. No ad targeting. Granular per-field privacy controls. Self-hosted
              analytics. 30-day auto-deletion for unclaimed data. Account deletion with full data
              removal.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">Typical Free Resume Builders</h3>
            <p className="text-ink/70 text-sm">
              Many free tools monetize by selling anonymized resume data to recruiters or job
              boards. Some embed third-party trackers from dozens of ad networks. Privacy controls
              are often limited to "public" or "private" — no per-field toggles. Account deletion
              may be opaque or unavailable.
            </p>
          </div>
          <div className="bg-cream/50 border-2 border-ink p-4">
            <h3 className="font-bold text-ink mb-1">LinkedIn</h3>
            <p className="text-ink/70 text-sm">
              LinkedIn's business model is data. They track your activity, profile views, and
              engagement to sell recruitment tools and advertising. Your profile data feeds their
              talent marketplace. You can control some visibility settings, but the platform
              fundamentally earns revenue from data about professionals like you.
            </p>
          </div>
        </div>
        <p>
          Our business model doesn't rely on selling data. Premium templates are unlocked through
          referrals. There's no advertising revenue, no recruiter marketplace, no data licensing.
          Your privacy isn't a compromise we make — it's a feature we built the product around.
        </p>
      </section>

      <section>
        <h2>Your Data, Your Control</h2>
        <p>
          The best privacy policy is one you don't have to read — because the controls are visible,
          understandable, and in your hands. We've tried to design clickfolio.me that way. Toggle
          your phone number off with one click. Hide your address just as easily. Delete your
          account and walk away with nothing left behind.
        </p>
        <p>
          For the full legal details, read our{" "}
          <Link href="/privacy" className="text-coral font-semibold">
            Privacy Policy
          </Link>
          . For questions about your data or our practices, email us at{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-coral font-semibold">
            {siteConfig.supportEmail}
          </a>
          .
        </p>
        <p>
          <Link href="/" className="text-coral font-semibold">
            Build your private, controlled portfolio →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
