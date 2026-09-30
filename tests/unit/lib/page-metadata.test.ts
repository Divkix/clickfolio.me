import { describe, expect, it } from "vite-plus/test";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as blogLayoutMetadata } from "@/app/blog/layout";
import { metadata as blogListingMetadata } from "@/app/blog/page";
import { metadata as faqMetadata } from "@/app/faq/page";
import { metadata as homeMetadata } from "@/app/page";
import { buildBlogPostMetadata } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/config/site";
import { buildRolePageMetadata } from "@/lib/seo/json-ld";
import { buildPublicPageMetadata, HOME_OG_IMAGE } from "@/lib/seo/page-metadata";

describe("public page social metadata", () => {
  it("sets og:url, og:type, and a large-image Twitter card with the PNG OG image", () => {
    const metadata = buildPublicPageMetadata({
      title: "FAQ",
      ogTitle: `FAQ - ${siteConfig.fullName}`,
      description: "Answers",
      path: "/faq",
    });

    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: `${siteConfig.url}/faq`,
      siteName: siteConfig.fullName,
      images: [HOME_OG_IMAGE],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [HOME_OG_IMAGE.url],
    });
    expect(HOME_OG_IMAGE.type).toBe("image/png");
    expect(HOME_OG_IMAGE.url).toMatch(/\/api\/og\/home$/);
  });

  it("marks blog posts as article with a canonical og:url", () => {
    const metadata = buildBlogPostMetadata({
      slug: "how-to-make-a-resume-website",
      title: "How to Make a Resume Website",
      description: "A guide.",
      date: "2026-01-01",
      readTime: "5 min",
      category: "Guides",
      keywords: [],
    });

    expect(metadata.openGraph).toMatchObject({
      type: "article",
      url: `${siteConfig.url}/blog/how-to-make-a-resume-website`,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [HOME_OG_IMAGE.url],
    });
  });

  it("gives role landing pages a per-route og:url instead of inheriting home", () => {
    const metadata = buildRolePageMetadata({
      title: "Resume Website for Designers",
      description: "Design portfolios.",
      path: "/for/designer",
    });

    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: `${siteConfig.url}/for/designer`,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [HOME_OG_IMAGE.url],
    });
  });

  it("keeps About and Blog titles specific, with complete share tags", () => {
    expect(String(aboutMetadata.title)).not.toMatch(/clickfolio\.me/i);
    expect(String(aboutMetadata.title)).toMatch(/from PDF resume to hosted portfolio/i);
    expect(String(aboutMetadata.title)).not.toBe("About");
    expect(aboutMetadata.openGraph).toMatchObject({
      type: "website",
      url: `${siteConfig.url}/about`,
      title: expect.stringMatching(/clickfolio\.me/i),
    });
    expect(aboutMetadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: expect.stringMatching(/clickfolio\.me/i),
    });

    expect(String(blogListingMetadata.title)).toMatch(/resume website/i);
    expect(blogListingMetadata.openGraph).toMatchObject({
      type: "website",
      url: `${siteConfig.url}/blog`,
    });
    expect(blogLayoutMetadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("does not leave FAQ on a summary card with a missing og:url", () => {
    expect(faqMetadata.openGraph).toMatchObject({
      type: "website",
      url: `${siteConfig.url}/faq`,
    });
    expect(faqMetadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps the homepage OG image typed as PNG", () => {
    const homeImages = homeMetadata.openGraph?.images;
    const image = Array.isArray(homeImages) ? homeImages[0] : homeImages;
    expect(image).toMatchObject({ url: HOME_OG_IMAGE.url, type: "image/png" });
  });
});
