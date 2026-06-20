import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import {
  generatePageBreadcrumbJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

/** Revalidate blog listing every 30 minutes for fresh content. */
export const revalidate = 86400;

const blogTitle = `Resume Website & Portfolio Guides | ${siteConfig.fullName}`;
const blogDescription =
  "Guides, comparisons, and tips on building a resume website and online portfolio. Compare builders, see examples, and learn how to turn your PDF resume into a site.";

/** SEO metadata for the blog listing page. */
export const metadata: Metadata = {
  title: "Resume Website & Portfolio Guides",
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

/**
 * Blog listing page — displays all published posts with structured data.
 */
export default function BlogPage() {
  const blogJsonLd = generateWebPageJsonLd("Blog", "/blog", blogDescription);
  const breadcrumbJsonLd = generatePageBreadcrumbJsonLd("Blog", "/blog");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
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
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Guides, comparisons, and tips for building your online portfolio.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {sortedPosts.map((post) => (
            <article key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block rounded-xl border border-border bg-card shadow-sm p-6 sm:p-8 transition-colors hover:bg-surface-2 hover:border-border-strong"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="brand">{post.category}</Badge>
                  <time
                    dateTime={post.date}
                    className="text-sm text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2 group-hover:text-brand transition-colors tracking-tight">
                  {post.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-3">{post.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{post.readTime}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                    Read more
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-16 text-center rounded-xl border border-border bg-card shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Build Your Portfolio</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Ready to turn your PDF resume into a professional website? Upload it now and get a live
            portfolio in under 30 seconds.
          </p>
          <Button asChild size="lg">
            <Link href="/">Get Started Free</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
