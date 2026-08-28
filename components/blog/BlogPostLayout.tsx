import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FaqAccordion } from "@/components/Faq";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { authorPersona } from "@/lib/config/author";
import {
  generateBlogPostingJsonLd,
  generateFAQPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

interface BlogPostLayoutProps {
  post: BlogPostMeta;
  children: React.ReactNode;
  relatedPosts?: BlogPostMeta[];
}

export function BlogPostLayout({ post, children, relatedPosts }: BlogPostLayoutProps) {
  const postingJsonLd = generateBlogPostingJsonLd(post);
  const faqJsonLd = post.faq && post.faq.length > 0 ? generateFAQPageJsonLd(post.faq) : null;
  const updatedDate = post.dateModified ?? post.date;
  const wasUpdated = Boolean(post.dateModified && post.dateModified !== post.date);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(postingJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
      )}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title, href: `/blog/${post.slug}` },
        ]}
      />

      <main id="main-content" className="flex-1 px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto">
          <header className="mb-12">
            <Badge variant="brand" className="mb-4">
              {post.category}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight tracking-tight">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{authorPersona.name}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={updatedDate} suppressHydrationWarning>
                {wasUpdated ? "Updated " : ""}
                {new Date(updatedDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span aria-hidden="true">·</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          <div className="rounded-xl border border-border bg-card shadow-sm p-8 sm:p-12 [&_section]:mb-16 [&_section:last-child]:mb-0">
            <div
              className="prose max-w-none
              prose-headings:text-foreground prose-headings:font-semibold
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-border prose-h2:pb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-muted-foreground prose-p:leading-[1.8]
              prose-ul:space-y-3 prose-ol:space-y-3
              prose-li:text-muted-foreground
              prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-brand prose-a:no-underline hover:prose-a:underline
              prose-code:text-foreground prose-code:font-mono
              prose-blockquote:border-l-4 prose-blockquote:border-brand prose-blockquote:pl-6
              prose-blockquote:py-2 prose-blockquote:bg-surface-2 prose-blockquote:text-muted-foreground
              prose-blockquote:italic prose-blockquote:rounded-r-lg
            "
            >
              {children}
            </div>
          </div>

          {post.faq && post.faq.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Frequently asked questions
              </h2>
              <FaqAccordion items={post.faq} />
            </section>
          )}

          <section className="mt-12 border-t border-border pt-8">
            <div className="rounded-xl border border-border bg-surface-2 p-6">
              <p className="text-sm font-semibold text-foreground">{authorPersona.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {authorPersona.bio}
              </p>
            </div>
          </section>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Blog
            </Link>
          </div>

          {relatedPosts && relatedPosts.length > 0 && (
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Related Posts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-surface-2 hover:border-border-strong"
                  >
                    <Badge variant="brand" className="mb-2">
                      {related.category}
                    </Badge>
                    <h3 className="font-semibold text-lg text-foreground mb-1 group-hover:text-brand transition-colors">
                      {related.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{related.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    </>
  );
}
