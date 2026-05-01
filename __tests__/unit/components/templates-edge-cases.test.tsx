/**
 * Template edge case tests — minimal/missing data rendering
 *
 * Tests that all 10 templates render without crashing when presented with:
 * - Missing optional arrays (experience, education, skills, certifications, projects are undefined)
 * - Missing contact object entirely (only email present)
 * - Empty arrays
 * - Malformed date strings
 * - Missing avatar_url
 * - Missing full_name
 *
 * The "happy path" tests are in templates.test.tsx — this file covers edge cases only.
 */

import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import BentoGrid from "@/components/templates/BentoGrid";
import BoldCorporate from "@/components/templates/BoldCorporate";
import ClassicATS from "@/components/templates/ClassicATS";
import DesignFolio from "@/components/templates/DesignFolio";
import DevTerminal from "@/components/templates/DevTerminal";
import GlassMorphic from "@/components/templates/GlassMorphic";
import Midnight from "@/components/templates/Midnight";
import MinimalistEditorial from "@/components/templates/MinimalistEditorial";
import NeoBrutalist from "@/components/templates/NeoBrutalist";
import Spotlight from "@/components/templates/Spotlight";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

// ============================================================================
// All 10 template components for iteration
// ============================================================================

const ALL_TEMPLATES: { name: string; Component: React.ComponentType<TemplateProps> }[] = [
  { name: "MinimalistEditorial", Component: MinimalistEditorial },
  { name: "NeoBrutalist", Component: NeoBrutalist },
  { name: "GlassMorphic", Component: GlassMorphic },
  { name: "BentoGrid", Component: BentoGrid },
  { name: "ClassicATS", Component: ClassicATS },
  { name: "DevTerminal", Component: DevTerminal },
  { name: "DesignFolio", Component: DesignFolio },
  { name: "Spotlight", Component: Spotlight },
  { name: "Midnight", Component: Midnight },
  { name: "BoldCorporate", Component: BoldCorporate },
];

// ============================================================================
// Mock profile
// ============================================================================

const defaultProfile: TemplateProps["profile"] = {
  handle: "testuser",
  avatar_url: null,
};

// ============================================================================
// Edge case content fixtures
// ============================================================================

/** Absolute minimum: only required fields */
const bareMinimumContent: ResumeContent = {
  full_name: "Minimal User",
  headline: "",
  summary: "",
  contact: {
    email: "min@example.com",
  },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

/** Missing optional arrays entirely (undefined, not empty) */
const missingOptionalArraysContent: ResumeContent = {
  full_name: "Missing Arrays",
  headline: "Dev",
  summary: "Test content",
  contact: {
    email: "test@example.com",
  },
  experience: [],
  // education is optional — omit it
  // skills is optional — omit it
  // certifications is optional — omit it
  // projects is optional — omit it
};

/** Missing contact fields (only email + phone) */
const missingContactFieldsContent: ResumeContent = {
  full_name: "No Contact",
  headline: "Ghost",
  summary: "No contact info.",
  contact: {
    email: "ghost@example.com",
    // phone is missing
    // location is missing
    // linkedin is missing
    // github is missing
    // website is missing
  },
  experience: [],
  education: [],
};

/** Missing full_name */
const missingFullNameContent: ResumeContent = {
  full_name: "",
  headline: "Anonymous Developer",
  summary: "No name provided.",
  contact: {
    email: "anon@example.com",
  },
  experience: [],
  education: [],
};

/** Missing avatar_url in profile */
const profileNoAvatar: TemplateProps["profile"] = {
  handle: "noavatar",
  avatar_url: null,
};

const profileWithAvatar: TemplateProps["profile"] = {
  handle: "hasavatar",
  avatar_url: "https://example.com/avatar.jpg",
};

/** Malformed date strings */
const malformedDatesContent: ResumeContent = {
  full_name: "Date Tester",
  headline: "Broken Dates",
  summary: "Testing malformed date strings.",
  contact: {
    email: "dates@example.com",
  },
  experience: [
    {
      title: "Position 1",
      company: "Company A",
      start_date: "not-a-date",
      end_date: "also-not-a-date",
      description: "Malformed dates test.",
    },
    {
      title: "Position 2",
      company: "Company B",
      start_date: "",
      end_date: "",
      description: "Empty dates test.",
    },
    {
      title: "Position 3",
      company: "Company C",
      start_date: "2020-01",
      end_date: "invalid-format",
      description: "One valid, one invalid date.",
    },
  ],
  education: [
    {
      degree: "Degree 1",
      institution: "University A",
      graduation_date: "garbage-date",
    },
    {
      degree: "Degree 2",
      institution: "University B",
      graduation_date: "",
    },
    {
      degree: "Degree 3",
      institution: "University C",
      graduation_date: "null-value",
    },
  ],
  certifications: [
    {
      name: "Cert 1",
      issuer: "Issuer A",
      date: "bad-date",
    },
    {
      name: "Cert 2",
      issuer: "Issuer B",
      date: "",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: ["TypeScript", "Python", ""], // empty string in items
    },
  ],
  projects: [
    {
      title: "Project 1",
      description: "With bad year",
      year: "not-a-year",
    },
    {
      title: "Project 2",
      description: "With empty year",
      year: "",
    },
  ],
};

/** Empty arrays with zero items */
const zeroItemsContent: ResumeContent = {
  full_name: "Zero Items",
  headline: "Empty Everything",
  summary: "All arrays are present but empty.",
  contact: {
    email: "zero@example.com",
  },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

/** Null/empty strings in array items */
const nullishItemsContent: ResumeContent = {
  full_name: "Nullish Items",
  headline: "Edge Case Tester",
  summary: "Testing nulls and empty strings in arrays.",
  contact: {
    email: "nullish@example.com",
  },
  experience: [
    {
      title: "",
      company: "",
      start_date: "",
      end_date: "",
      description: "",
      highlights: [],
    },
  ],
  education: [
    {
      degree: "",
      institution: "",
      location: "",
      graduation_date: "",
      gpa: "",
    },
  ],
  skills: [
    {
      category: "",
      items: [],
    },
  ],
  certifications: [
    {
      name: "",
      issuer: "",
      date: "",
    },
  ],
  projects: [
    {
      title: "",
      description: "",
      year: "",
      technologies: [],
    },
  ],
};

// ============================================================================
// Helper
// ============================================================================

function testTemplateRenders(
  component: React.ComponentType<TemplateProps>,
  content: ResumeContent,
  profile: TemplateProps["profile"] = defaultProfile,
) {
  return render(React.createElement(component, { content, profile }));
}

// Need React for createElement
import React from "react";

// ============================================================================
// Tests
// ============================================================================

describe("Template edge case rendering", () => {
  // ── Bare minimum content ────────────────────────────────────────

  describe("bare minimum content (name + email only)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, bareMinimumContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Minimal");
    });
  });

  // ── Missing optional arrays ─────────────────────────────────────

  describe("missing optional arrays (education, skills, certifications, projects undefined)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingOptionalArraysContent);
      expect(container).toBeTruthy();
      // Templates may split names into separate elements — textContent may concatenate
      expect(container.textContent).toContain("Missing");
      expect(container.textContent).toContain("Arrays");
    });
  });

  // ── Missing contact fields ──────────────────────────────────────

  describe("missing contact fields (only email present)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingContactFieldsContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Ghost");
    });
  });

  // ── Missing full_name ───────────────────────────────────────────

  describe("missing full_name (empty string)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingFullNameContent);
      expect(container).toBeTruthy();
      // Template should handle empty name without crashing
    });
  });

  // ── Missing avatar_url ──────────────────────────────────────────

  describe("missing avatar_url (null)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing with null avatar_url", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, bareMinimumContent, profileNoAvatar);
      expect(container).toBeTruthy();
    });
  });

  describe("present avatar_url (non-null)", () => {
    test.each(ALL_TEMPLATES)("$name renders with a present avatar_url", ({ Component }) => {
      const { container } = testTemplateRenders(Component, bareMinimumContent, profileWithAvatar);
      expect(container).toBeTruthy();
    });
  });

  // ── Malformed date strings ──────────────────────────────────────

  describe("malformed date strings", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing with bad dates", ({ Component }) => {
      const { container } = testTemplateRenders(Component, malformedDatesContent);
      expect(container).toBeTruthy();
      // Templates may split names — check for word parts
      expect(container.textContent).toContain("Date");
      expect(container.textContent).toContain("Tester");
    });
  });

  // ── Zero-item arrays ────────────────────────────────────────────

  describe("zero-item arrays (empty arrays present)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, zeroItemsContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Zero");
      expect(container.textContent).toContain("Items");
    });
  });

  // ── Nullish/empty items in arrays ───────────────────────────────

  describe("nullish/empty items in array fields", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing with empty strings in data", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, nullishItemsContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Nullish");
      expect(container.textContent).toContain("Items");
    });
  });

  // ── Summary contains only whitespace ────────────────────────────

  describe("whitespace-only summary", () => {
    const whitespaceSummary: ResumeContent = {
      ...bareMinimumContent,
      full_name: "Whitespace Test",
      summary: "   \n\t  ",
    };

    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, whitespaceSummary);
      expect(container).toBeTruthy();
    });
  });

  // ── Very long strings in specific fields ────────────────────────

  describe("very long strings in fields", () => {
    const longFields: ResumeContent = {
      full_name: "X".repeat(500),
      headline: "Y".repeat(1000),
      summary: "Z".repeat(5000),
      contact: {
        email: `${"a".repeat(200)}@example.com`,
        location: "b".repeat(300),
      },
      experience: [
        {
          title: "c".repeat(200),
          company: "d".repeat(200),
          start_date: "2020-01",
          description: "e".repeat(2000),
        },
      ],
      education: [],
    };

    test.each(ALL_TEMPLATES)("$name renders without crashing with very long fields", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, longFields);
      expect(container).toBeTruthy();
    });
  });

  // ── Single-character fields ─────────────────────────────────────

  describe("single-character fields", () => {
    const singleChar: ResumeContent = {
      full_name: "X",
      headline: "Y",
      summary: "Z",
      contact: {
        email: "a@b.c",
      },
      experience: [
        {
          title: "A",
          company: "B",
          start_date: "C",
          description: "D",
        },
      ],
      education: [],
    };

    test.each(ALL_TEMPLATES)("$name renders without crashing with single-char fields", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, singleChar);
      expect(container).toBeTruthy();
    });
  });

  // ── Unicode/emoji content ───────────────────────────────────────

  describe("unicode and emoji content", () => {
    const unicodeContent: ResumeContent = {
      full_name: "José María 官话",
      headline: "🎨 Designer 🚀",
      summary: "Special chars: ñ, é, ü, 汉字, العَرَبِيَّة, 🎉",
      contact: {
        email: "test@example.com",
        location: "München, Бээжин, 東京都",
      },
      experience: [
        {
          title: "エンジニア 🧑‍💻",
          company: "株式会社",
          start_date: "2020-01",
          description: "日本語の経験",
        },
      ],
      education: [],
    };

    test.each(ALL_TEMPLATES)("$name renders without crashing with unicode content", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, unicodeContent);
      expect(container).toBeTruthy();
    });
  });

  // ── HTML-like content in fields (XSS safety) ────────────────────

  describe("HTML-like content in data fields", () => {
    const htmlLikeContent: ResumeContent = {
      full_name: "<script>alert('xss')</script>",
      headline: "<b>Bold</b> not here",
      summary: "Click <a href='evil.com'>here</a> for more",
      contact: {
        email: "test@example.com",
      },
      experience: [
        {
          title: "<img src=x onerror=alert(1)>",
          company: "<iframe src='bad.com'></iframe>",
          start_date: "<script>",
          description: "<svg onload=alert(1)>",
          highlights: ["<style>body{display:none}</style>", "<marquee>bad</marquee>"],
        },
      ],
      education: [],
      skills: [
        {
          category: "<script>",
          items: ["<div onclick='alert(1)'>click</div>"],
        },
      ],
    };

    test.each(ALL_TEMPLATES)("$name renders without executing HTML-like content", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, htmlLikeContent);
      expect(container).toBeTruthy();
      // HTML-like content should appear as text, not as DOM elements.
      // Templates may legitimately include <img> tags (LinkedIn icons, theme assets),
      // so we check that no <script>, <iframe>, or malicious <img> elements exist.
      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("iframe")).toBeNull();
      // Verify no <img> with data-derived src exists
      const images = container.querySelectorAll("img");
      for (const img of images) {
        const src = img.getAttribute("src") || "";
        expect(src).not.toContain("onerror");
        expect(src).not.toContain("<script>");
      }
    });
  });

  // ── Combined extreme edge case ──────────────────────────────────

  describe("combined extreme edge case (everything missing/broken)", () => {
    const combinedExtreme: ResumeContent = {
      full_name: "",
      headline: "",
      summary: "",
      contact: {
        email: "",
      },
      experience: [
        {
          title: "",
          company: "",
          start_date: "",
          description: "",
        },
      ],
      education: [
        {
          degree: "",
          institution: "",
        },
      ],
      skills: [
        {
          category: "",
          items: [""],
        },
      ],
      certifications: [
        {
          name: "",
          issuer: "",
        },
      ],
      projects: [
        {
          title: "",
          description: "",
        },
      ],
    };

    test.each(ALL_TEMPLATES)("$name renders without crashing with extreme minimal data", ({
      Component,
    }) => {
      const { container } = testTemplateRenders(Component, combinedExtreme);
      expect(container).toBeTruthy();
    });
  });
});
