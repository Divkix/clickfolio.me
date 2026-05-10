import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import { serializeJsonLd } from "@/lib/utils/json-ld";

interface BlogPostLayoutProps {
  post: BlogPostMeta;
  children: React.ReactNode;
  relatedPosts?: BlogPostMeta[];
}

function generateArticleJsonLd(post: BlogPostMeta): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${siteConfig.url}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: `${siteConfig.url}/blog/${post.slug}`,
    keywords: post.keywords?.join(", "),
    author: {
      "@type": "Organization",
      name: siteConfig.fullName,
      url: siteConfig.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.fullName,
      url: siteConfig.url,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/icon-512.png`,
      },
    },
    isPartOf: {
      "@type": "Blog",
      "@id": `${siteConfig.url}/blog#blog`,
      name: `${siteConfig.fullName} Blog`,
      url: `${siteConfig.url}/blog`,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/blog/${post.slug}#webpage`,
      url: `${siteConfig.url}/blog/${post.slug}`,
    },
  };
}

function generateBlogBreadcrumbJsonLd(post: BlogPostMeta): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteConfig.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteConfig.url}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${siteConfig.url}/blog/${post.slug}`,
      },
    ],
  };
}

export function BlogPostLayout({ post, children, relatedPosts }: BlogPostLayoutProps) {
  const articleJsonLd = generateArticleJsonLd(post);
  const breadcrumbJsonLd = generateBlogBreadcrumbJsonLd(post);

  return (
    <div className="min-h-screen bg-cream paper-texture flex flex-col">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from hardcoded blog post data, serializeJsonLd escapes XSS vectors
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Breadcrumb JSON-LD from blog post data, serializeJsonLd escapes XSS vectors
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
            href="/blog"
            className="text-sm font-medium text-ink/70 hover:text-coral transition-colors duration-300"
          >
            All Posts
          </Link>
        </div>
      </header>

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title, href: `/blog/${post.slug}` },
        ]}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto">
          <header className="mb-12">
            <span className="inline-block bg-ink text-cream text-sm font-bold px-3 py-1 mb-4">
              {post.category}
            </span>
            <h1 className="font-black text-3xl sm:text-4xl lg:text-5xl text-ink mb-4 leading-tight tracking-tight">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-ink/60 text-sm">
              <time dateTime={post.date} suppressHydrationWarning>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span aria-hidden="true">·</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          <div className="bg-cream border-3 border-ink shadow-brutal-md p-8 sm:p-12 [&_section]:mb-16 [&_section:last-child]:mb-0">
            <div
              className="prose max-w-none
              prose-headings:text-ink prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b-2 prose-h2:border-ink prose-h2:pb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-ink/85 prose-p:leading-[1.8]
              prose-ul:space-y-3 prose-ol:space-y-3
              prose-li:text-ink/85
              prose-strong:text-ink prose-strong:font-bold
              prose-a:text-coral prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-4 prose-blockquote:border-coral prose-blockquote:pl-6
              prose-blockquote:py-2 prose-blockquote:bg-ink/5 prose-blockquote:text-ink/80
              prose-blockquote:italic prose-blockquote:rounded-r-lg
            "
            >
              {children}
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 hover:text-coral transition-colors duration-300"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Blog
            </Link>
          </div>

          {relatedPosts && relatedPosts.length > 0 && (
            <section className="mt-12 border-t-3 border-ink pt-8">
              <h2 className="font-black text-2xl text-ink mb-6">Related Posts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group block bg-cream border-3 border-ink p-5 shadow-brutal-sm hover:shadow-brutal-md hover:border-coral/30 transition-shadow transition-colors duration-200"
                  >
                    <span className="inline-block bg-ink text-cream text-xs font-bold px-2 py-0.5 mb-2">
                      {related.category}
                    </span>
                    <h3 className="font-bold text-lg text-ink mb-1 group-hover:text-coral transition-colors">
                      {related.title}
                    </h3>
                    <p className="text-sm text-ink/60">{related.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <Footer />
    </div>
  );
}
