import { describe, expect, it } from "vite-plus/test";
import { BLOG_POSTS, buildBlogPostMetadata } from "@/lib/blog/posts";
import {
  buildProfileTitle,
  fitTitle,
  HOME_METADATA,
  MAX_TITLE_LENGTH,
  titleTag,
} from "@/lib/seo/page-metadata";

const MAX_DESCRIPTION_LENGTH = 160;

describe("fitTitle", () => {
  it("keeps the brand suffix when it fits", () => {
    expect(fitTitle("Blog")).toBe("Blog");
  });

  it("drops the suffix when title + suffix would exceed the limit", () => {
    const title = "Resume Website vs LinkedIn: Which Do You Need? (2026)";
    expect(fitTitle(title)).toEqual({ absolute: title });
  });
});

describe("buildProfileTitle", () => {
  it("returns the name alone without a headline", () => {
    expect(buildProfileTitle("Jane Doe", null)).toBe("Jane Doe");
  });

  it("keeps only the first segment of a keyword-list headline", () => {
    expect(
      buildProfileTitle(
        "Mohammad Alfez",
        "SEO & Digital Marketing Specialist | Content Creation · Social Media",
      ),
    ).toBe("Mohammad Alfez — SEO & Digital Marketing Specialist");
  });

  it("cuts a long headline on a word boundary", () => {
    const title = buildProfileTitle(
      "Adam Al Assaad",
      "Senior Full Stack Software Engineer and Cloud Infrastructure Architect",
    );

    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(title).toBe("Adam Al Assaad — Senior Full Stack Software Engineer and…");
  });

  it("falls back to the name when no headline word fits", () => {
    const name = "Abdulrahman Mohammed Abdullah Al Safi Al Hashimi Khan";
    expect(buildProfileTitle(name, "Engineering")).toBe(name);
  });

  it("truncates a name longer than the limit", () => {
    const title = buildProfileTitle("A".repeat(80), "Engineer");
    expect(title).toHaveLength(MAX_TITLE_LENGTH);
  });
});

describe("rendered title and description lengths", () => {
  it("home page", () => {
    expect(HOME_METADATA.title).toEqual({ absolute: expect.stringMatching(/^.{1,60}$/u) });

    expect(HOME_METADATA.description?.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });

  it.each(BLOG_POSTS.map((post) => [post.slug, post] as const))("blog/%s", (_slug, post) => {
    const title = post.metaTitle ?? post.title;

    expect(buildBlogPostMetadata(post).title).toEqual(fitTitle(title));
    expect(titleTag(title).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(post.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH);
  });
});
