import { describe, expect, it } from "vite-plus/test";
import {
  generateBreadcrumbJsonLd,
  generateExploreJsonLd,
  generateFAQJsonLd,
  generateHomepageJsonLd,
  generatePageBreadcrumbJsonLd,
  generateResumeJsonLd,
  generateWebPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import type { ResumeContent } from "@/lib/types/database";

const fullContent: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Staff Product Engineer",
  summary: "Builds reliable product systems.",
  contact: {
    email: "avery@example.com",
    linkedin: " https://linkedin.com/in/avery-quinn ",
    github: "https://github.com/averyquinn",
    website: "https://avery.dev/work",
    dribbble: "https://dribbble.com/avery",
    behance: "https://behance.net/avery",
  },
  experience: [
    {
      title: "Staff Engineer",
      company: "Acme",
      location: "Remote",
      start_date: "2023-01",
      description: "Current role",
      highlights: [],
    },
    {
      title: "Lead Engineer",
      company: "Beta",
      location: "Phoenix",
      start_date: "2020-01",
      end_date: "2022-12",
      description: "Previous role",
      highlights: [],
    },
  ],
  education: [
    {
      degree: "BS Computer Science",
      institution: "State University",
      graduation_date: "2018",
    },
  ],
  skills: [
    { category: "Frontend", items: ["React", "TypeScript", "React", ""] },
    { category: "Platform", items: ["Cloudflare"] },
  ],
  certifications: [],
  projects: [],
};

describe("JSON-LD generators", () => {
  it("builds a rich public ProfilePage schema from resume content", () => {
    const jsonLd = generateResumeJsonLd(fullContent, {
      profileUrl: "https://clickfolio.me/@avery",
      avatarUrl: "https://cdn.example.com/avatar.png",
      dateCreated: "2026-01-02",
      dateModified: "2026-01-03",
      includeEmail: true,
    });

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "@id": "https://clickfolio.me/@avery#webpage",
      dateCreated: "2026-01-02",
      dateModified: "2026-01-03",
      mainEntity: {
        "@type": "Person",
        name: "Avery Quinn",
        url: "https://clickfolio.me/@avery",
        image: "https://cdn.example.com/avatar.png",
        jobTitle: "Staff Engineer",
        worksFor: { "@type": "Organization", name: "Acme" },
        email: "avery@example.com",
        description: "Builds reliable product systems.",
      },
    });
    expect(jsonLd.mainEntity.sameAs).toEqual([
      "https://linkedin.com/in/avery-quinn",
      "https://github.com/averyquinn",
      "https://avery.dev/work",
      "https://dribbble.com/avery",
      "https://behance.net/avery",
    ]);
    expect(jsonLd.mainEntity.knowsAbout).toEqual(["React", "TypeScript", "Cloudflare"]);
    expect(jsonLd.mainEntity.alumniOf).toEqual([
      { "@type": "EducationalOrganization", name: "State University" },
    ]);
    expect(jsonLd.mainEntity.hasOccupation).toHaveLength(2);
    expect(jsonLd.mainEntity.hasOccupation?.[0]).not.toHaveProperty("endDate");
    expect(jsonLd.mainEntity.hasOccupation?.[1]).toMatchObject({ endDate: "2022-12" });
  });

  it("omits optional person fields when resume data is empty or invalid", () => {
    const jsonLd = generateResumeJsonLd(
      {
        ...fullContent,
        summary: "   ",
        contact: {
          email: "avery@example.com",
          linkedin: "https://linkedin.com/feed",
          github: "https://github.com/org/repo",
          website: "javascript:alert(1)",
          dribbble: "https://example.com/avery",
          behance: "https://behance.net/",
        },
        experience: [],
        education: [{ degree: "BS", institution: "   ", graduation_date: "2018" }],
        skills: [{ category: "Empty", items: ["", "   "] }],
      },
      {
        profileUrl: "https://clickfolio.me/@avery",
      },
    );

    expect(jsonLd.mainEntity).not.toHaveProperty("image");
    expect(jsonLd.mainEntity).not.toHaveProperty("worksFor");
    expect(jsonLd.mainEntity).not.toHaveProperty("hasOccupation");
    expect(jsonLd.mainEntity).not.toHaveProperty("alumniOf");
    expect(jsonLd.mainEntity).not.toHaveProperty("sameAs");
    expect(jsonLd.mainEntity).not.toHaveProperty("knowsAbout");
    expect(jsonLd.mainEntity).not.toHaveProperty("email");
    expect(jsonLd.mainEntity).not.toHaveProperty("description");
  });

  it("escapes JSON-LD script-breakout characters during serialization", () => {
    const serialized = serializeJsonLd({
      text: "</script><script>alert(1)</script>",
      separator: "\u2028",
      paragraph: "\u2029",
    });

    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u003cscript\\u003e");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });

  it("builds site-level JSON-LD structures for public pages", () => {
    const homepage = generateHomepageJsonLd();
    expect(homepage.map((entry) => entry["@type"])).toEqual([
      "WebSite",
      "Organization",
      "SoftwareApplication",
    ]);

    expect(
      generateExploreJsonLd([{ handle: "avery", name: "Avery", headline: "Engineer" }]),
    ).toMatchObject({
      "@type": "CollectionPage",
      mainEntity: {
        numberOfItems: 1,
        itemListElement: [
          {
            position: 1,
            url: "https://clickfolio.me/@avery",
            name: "Avery",
            description: "Engineer",
          },
        ],
      },
    });

    expect(generateFAQJsonLd()).toMatchObject({
      "@type": "FAQPage",
      mainEntity: expect.arrayContaining([
        expect.objectContaining({
          "@type": "Question",
          acceptedAnswer: expect.objectContaining({ "@type": "Answer" }),
        }),
      ]),
    });

    expect(generatePageBreadcrumbJsonLd("Terms", "/terms")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({ position: 1, name: "Home" }),
        expect.objectContaining({
          position: 2,
          name: "Terms",
          item: "https://clickfolio.me/terms",
        }),
      ],
    });

    expect(
      generateWebPageJsonLd("Privacy", "/privacy", "Privacy policy", "2026-01-01"),
    ).toMatchObject({
      "@type": "WebPage",
      "@id": "https://clickfolio.me/privacy#webpage",
      dateModified: "2026-01-01",
    });

    expect(generateBreadcrumbJsonLd("avery", "Avery Quinn")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        expect.objectContaining({ name: "Home" }),
        expect.objectContaining({ name: "Explore" }),
        expect.objectContaining({ name: "Avery Quinn", item: "https://clickfolio.me/@avery" }),
      ],
    });
  });
});
