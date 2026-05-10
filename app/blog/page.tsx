import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/utils/json-ld";

export const revalidate = 1800;

const blogTitle = `Blog | ${siteConfig.fullName}`;
const blogDescription =
  "Guides, comparisons, and tips for building your online portfolio. Learn how to turn your PDF resume into a professional website.";

export const metadata: Metadata = {
  title: "Blog",
  description: blogDescription,
  alternates: { canonical: `${siteConfig.url}/blog` },
  openGraph: {
    title: blogTitle,
    description: blogDescription,
    siteName: siteConfig.fullName,
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: blogTitle,
    description: blogDescription,
  },
};

const sortedPosts = [...BLOG_POSTS].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);

export default function BlogPage() {
  const blogJsonLd = generateWebPageJsonLd("Blog", "/blog", blogDescription);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd("Blog", "/blog");

  return (
    <div className="min-h-screen bg-cream paper-texture flex flex-col">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from hardcoded config, serializeJsonLd escapes XSS vectors
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Breadcrumb JSON-LD from hardcoded path, no user input
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <header className="sticky top-0 z-50 border-b-3 border-ink bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
            aria-label="clickfolio.me home"
          >
            <Logo size="md" />
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-ink/70 hover:text-coral transition-colors duration-300"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
        ]}
      />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink mb-4 tracking-tight">Blog</h1>
          <p className="text-lg text-ink/70 max-w-2xl mx-auto">
            Guides, comparisons, and tips for building your online portfolio.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {sortedPosts.map((post) => (
            <article key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block bg-cream border-3 border-ink shadow-brutal-sm p-6 sm:p-8 hover:shadow-brutal-md hover:border-coral/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block bg-ink text-cream text-xs font-bold px-2 py-0.5">
                    {post.category}
                  </span>
                  <time
                    dateTime={post.date}
                    className="text-sm text-ink/50"
                    suppressHydrationWarning
                  >
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-ink mb-2 group-hover:text-coral transition-colors tracking-tight">
                  {post.title}
                </h2>
                <p className="text-ink/70 leading-relaxed mb-3">{post.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink/50">{post.readTime}</span>
                  <span className="text-sm font-bold text-ink group-hover:text-coral transition-colors">
                    Read more →
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center bg-linear-to-r from-coral/10 to-coral/10 rounded-xl border border-coral/20 p-8">
          <h2 className="text-2xl font-bold text-ink mb-3">Build Your Portfolio</h2>
          <p className="text-ink/70 mb-6 max-w-xl mx-auto">
            Ready to turn your PDF resume into a professional website? Upload it now and get a live
            portfolio in under 30 seconds.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-ink text-cream font-semibold rounded-lg hover:bg-ink/90 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
