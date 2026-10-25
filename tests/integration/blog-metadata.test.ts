import { describe, expect, it } from "vite-plus/test";
import { BLOG_POSTS, buildBlogPostMetadata } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import { titleTag } from "@/lib/seo/page-metadata";

describe("blog page heads", () => {
  it.each(BLOG_POSTS)("preserves metadata for $slug", (post) => {
    const head = buildBlogPostMetadata(post);
    const socialTitle = `${post.title} | ${siteConfig.fullName}`;
    const url = `${siteConfig.url}/blog/${post.slug}`;

    expect(head.links).toContainEqual({ rel: "canonical", href: url });
    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: titleTag(post.metaTitle ?? post.title) },
        { name: "description", content: post.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: socialTitle },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: siteConfig.fullName },
        { property: "og:image", content: `${siteConfig.url}/api/og/home` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: socialTitle },
        { name: "twitter:description", content: post.description },
        { name: "twitter:image", content: `${siteConfig.url}/api/og/home` },
      ]),
    );
  });
});
