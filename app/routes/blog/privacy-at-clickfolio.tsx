import { createFileRoute, Link } from "@tanstack/react-router";
import { edgeCacheHeaders } from "@/lib/cache/edge-cache";
import { BlogPostLayout } from "@/components/blog/BlogPostLayout";
import { PostList } from "@/components/blog/PostSection";
import { buildBlogPostMetadata, getPostBySlug } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import { TEMPLATE_COUNT } from "@/lib/templates/theme-ids";

const post = getPostBySlug("privacy-at-clickfolio")!;

const relatedPosts = ["pdf-resume-to-website", "best-resume-website-builders"].flatMap(
  (slug) => getPostBySlug(slug) ?? [],
);

export const Route = createFileRoute("/blog/privacy-at-clickfolio")({
  head: () => buildBlogPostMetadata(post),
  headers: () => edgeCacheHeaders(86400),
  component: PrivacyAtClickfolioPage,
});

function PrivacyAtClickfolioPage() {
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
        <PostList
          items={[
            {
              lead: "Show phone number.",
              body: " Hidden by default. Turn this on to show your phone number on your public portfolio.",
            },
            {
              lead: "Show full address.",
              body: " Hidden by default. Your general location can still appear; turn this on to include your street address.",
            },
            {
              lead: "Show in public directory.",
              body: " On by default. Turn this off to remove your portfolio from Explore. The page remains public to anyone with the link, and search indexing is controlled separately.",
            },
            {
              lead: "Hide from search engines.",
              body: " Off by default, so your page can appear in search results. Turn this on to ask search engines not to index it; this does not make the page private or immediately remove existing results.",
            },
          ]}
        />
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
        <PostList
          items={[
            {
              lead: "Authentication data.",
              body: " Clerk handles email/password or Google sign-up, email verification and sessions. Our database receives your Clerk account ID, email, verification status and any supplied name and profile picture. We do not store your password.",
            },
            {
              lead: "Resume content.",
              body: " Your uploaded PDF and the parsed, structured data extracted from it — including name, experience, education, skills, and contact information. This is the content of your portfolio.",
            },
            {
              lead: "Usage analytics.",
              body: " Page views on your public portfolio — how many visitors, where they came from, what devices they use. This helps you understand your reach. It's also aggregated anonymously for our own platform analytics.",
            },
          ]}
        />
        <h3>What We Don't Collect</h3>
        <PostList
          items={[
            {
              lead: "Your contacts or address book.",
              body: " Never.",
            },
            {
              lead: "Your browsing history on other sites.",
              body: " Never.",
            },
            {
              lead: "Your location beyond what's in your resume.",
              body: " We use IP geolocation for analytics at the city level, but this is not stored or linked to your account.",
            },
            {
              lead: "Your social media activity.",
              body: " We don't scrape, monitor, or analyze your social media presence.",
            },
            {
              lead: "Payment information.",
              body: " clickfolio.me is free. We don't have payment processing, so there's no credit card data to collect.",
            },
          ]}
        />
      </section>

      <section>
        <h2>Third-Party Services</h2>
        <p>We use a minimal set of third-party services, chosen for their privacy posture:</p>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">
              Clerk and optional Google sign-in
            </h3>
            <p className="text-muted-foreground text-sm">
              Clerk handles email/password and Google sign-up and sign-in, verification codes and
              sessions. Cloudflare Turnstile provides bot protection. Google is an optional sign-in
              method, not a requirement.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">
              OpenRouter and AI model providers
            </h3>
            <p className="text-muted-foreground text-sm">
              Resume content is sent to a configured AI model through OpenRouter and Cloudflare AI
              Gateway for parsing. The model and serving provider can change with our configuration.
              Processing is subject to OpenRouter&apos;s and the serving provider&apos;s policies;
              see our Privacy Policy for details.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">Cloudflare</h3>
            <p className="text-muted-foreground text-sm">
              Cloudflare provides hosting (Workers), file storage (R2), content delivery, AI Gateway
              routing and Turnstile bot protection. Account and portfolio data are stored in
              PlanetScale Postgres through Cloudflare Hyperdrive.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">Self-Hosted Analytics</h3>
            <p className="text-muted-foreground text-sm">
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
          Temporary PDFs, including their original filename and upload time, become eligible for
          automatic deletion after 24 hours under our R2 storage lifecycle rule; deletion runs
          asynchronously. The signed upload cookie expires after 30 minutes. There is no resume
          database record until you sign in and save the upload to your account.
        </p>
        <p>
          Upload rate limits separately store a one-way hash of your IP address, the action type and
          request timestamps. Those records expire after 24 hours and are removed by the next
          scheduled daily cleanup, not by account deletion. You can contact us about an abandoned
          upload without creating an account.
        </p>
        <h3>Account Deletion</h3>
        <p>You can delete your account at any time from the Settings page. When you do:</p>
        <ul>
          <li>Your profile, resume content and uploads are removed within 30 days</li>
          <li>Your uploaded PDF file is deleted from cloud storage</li>
          <li>Your parsed resume content is deleted from the database</li>
          <li>Your public portfolio URL becomes a 404 page immediately</li>
        </ul>
        <p>
          Diagnostics are an exception: account deletion does not remove them early. They expire
          automatically within 90 days after collection. Some anonymized, aggregated data may remain
          for platform analytics but cannot be used to identify you.
        </p>
        <h3>Session Data</h3>
        <p>Clerk manages authentication sessions. Sign out to end your session on this device.</p>
      </section>

      <section>
        <h2>Where Your Data Lives</h2>
        <p>We use Cloudflare for hosting and file storage, and PlanetScale for the database:</p>
        <PostList
          items={[
            {
              lead: "Cloudflare Workers.",
              body: " Your portfolio website is served from Cloudflare's edge network — over 330 cities worldwide. Requests are handled at the data center closest to your visitor, which means fast load times and reduced latency for everyone, everywhere.",
            },
            {
              lead: "Postgres database (PlanetScale).",
              body: " Your account data and parsed resume content are stored in a managed Postgres database hosted by PlanetScale, accessed securely through Cloudflare Hyperdrive. Data is backed up automatically for reliability.",
            },
            {
              lead: "R2 (object storage).",
              body: " Your uploaded PDF files are stored in Cloudflare R2, designed for zero egress fees and S3-compatible object storage. Files are encrypted at rest.",
            },
          ]}
        />
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
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">clickfolio.me</h3>
            <p className="text-muted-foreground text-sm">
              No data selling. No ad targeting. Granular per-field privacy controls. Self-hosted
              analytics. Temporary uploads expire under a 24-hour storage rule. Delete your account,
              resume and uploads from Settings; diagnostics are deleted automatically within 90
              days.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">Typical Free Resume Builders</h3>
            <p className="text-muted-foreground text-sm">
              Many free tools monetize by selling anonymized resume data to recruiters or job
              boards. Some embed third-party trackers from dozens of ad networks. Privacy controls
              are often limited to "public" or "private" — no per-field toggles. Account deletion
              may be opaque or unavailable.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-semibold text-foreground mb-1">LinkedIn</h3>
            <p className="text-muted-foreground text-sm">
              LinkedIn's business model is data. They track your activity, profile views, and
              engagement to sell recruitment tools and advertising. Your profile data feeds their
              talent marketplace. You can control some visibility settings, but the platform
              fundamentally earns revenue from data about professionals like you.
            </p>
          </div>
        </div>
        <p>
          Our business model doesn't rely on selling data. All {TEMPLATE_COUNT} templates are free
          with no premium locks and no referrals. There's no advertising revenue, no recruiter
          marketplace, no data licensing. Your privacy isn't a compromise we make — it's a feature
          we built the product around.
        </p>
      </section>

      <section>
        <h2>Your Data, Your Control</h2>
        <p>
          The best privacy policy is one you don't have to read — because the controls are visible,
          understandable, and in your hands. We've tried to design clickfolio.me that way. Toggle
          your phone number on or off. Hide your street address just as easily. Delete your account,
          resume and uploads in Settings; diagnostics are deleted automatically within 90 days.
        </p>
        <p>
          For the full legal details, read our{" "}
          <Link to="/privacy" className="text-brand font-semibold">
            Privacy Policy
          </Link>
          . For questions about your data or our practices, email us at{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-brand font-semibold">
            {siteConfig.supportEmail}
          </a>
          .
        </p>
        <p>
          <Link to="/" className="text-brand font-semibold">
            Build a portfolio with visibility controls →
          </Link>
        </p>
      </section>
    </BlogPostLayout>
  );
}
