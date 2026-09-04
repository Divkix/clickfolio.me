import { render } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { BentoGrid } from "@/components/templates/BentoGrid";
import { BoldCorporate } from "@/components/templates/BoldCorporate";
import { ClassicATS } from "@/components/templates/ClassicATS";
import { DesignFolio } from "@/components/templates/DesignFolio";
import { DevTerminal } from "@/components/templates/DevTerminal";
import { GlassMorphic } from "@/components/templates/GlassMorphic";
import { Midnight } from "@/components/templates/Midnight";
import { MinimalistEditorial } from "@/components/templates/MinimalistEditorial";
import { NeoBrutalist } from "@/components/templates/NeoBrutalist";
import { Spotlight } from "@/components/templates/Spotlight";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

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

const defaultProfile: TemplateProps["profile"] = {
  handle: "testuser",
  avatar_url: null,
};

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

const missingOptionalArraysContent: ResumeContent = {
  full_name: "Missing Arrays",
  headline: "Dev",
  summary: "Test content",
  contact: {
    email: "test@example.com",
  },
  experience: [],
};

const missingContactFieldsContent: ResumeContent = {
  full_name: "No Contact",
  headline: "Ghost",
  summary: "No contact info.",
  contact: {
    email: "ghost@example.com",
  },
  experience: [],
  education: [],
};

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

const profileNoAvatar: TemplateProps["profile"] = {
  handle: "noavatar",
  avatar_url: null,
};

const profileWithAvatar: TemplateProps["profile"] = {
  handle: "hasavatar",
  avatar_url: "https://example.com/avatar.jpg",
};

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
      items: ["TypeScript", "Python", ""],
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

function testTemplateRenders(
  component: React.ComponentType<TemplateProps>,
  content: ResumeContent,
  profile: TemplateProps["profile"] = defaultProfile,
) {
  return render(React.createElement(component, { content, profile }));
}

import React from "react";

describe("Template edge case rendering", () => {
  describe("bare minimum content (name + email only)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, bareMinimumContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Minimal");
    });
  });

  describe("missing optional arrays (education, skills, certifications, projects undefined)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingOptionalArraysContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Missing");
      expect(container.textContent).toContain("Arrays");
    });
  });

  describe("missing contact fields (only email present)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingContactFieldsContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Ghost");
    });
  });

  describe("missing full_name (empty string)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, missingFullNameContent);
      expect(container).toBeTruthy();
    });
  });

  describe("missing avatar_url (null)", () => {
    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with null avatar_url",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, bareMinimumContent, profileNoAvatar);
        expect(container).toBeTruthy();
      },
    );
  });

  describe("present avatar_url (non-null)", () => {
    test.each(ALL_TEMPLATES)("$name renders with a present avatar_url", ({ Component }) => {
      const { container } = testTemplateRenders(Component, bareMinimumContent, profileWithAvatar);
      expect(container).toBeTruthy();
    });
  });

  describe("malformed date strings", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing with bad dates", ({ Component }) => {
      const { container } = testTemplateRenders(Component, malformedDatesContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Date");
      expect(container.textContent).toContain("Tester");
    });
  });

  describe("zero-item arrays (empty arrays present)", () => {
    test.each(ALL_TEMPLATES)("$name renders without crashing", ({ Component }) => {
      const { container } = testTemplateRenders(Component, zeroItemsContent);
      expect(container).toBeTruthy();
      expect(container.textContent).toContain("Zero");
      expect(container.textContent).toContain("Items");
    });
  });

  describe("nullish/empty items in array fields", () => {
    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with empty strings in data",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, nullishItemsContent);
        expect(container).toBeTruthy();
        expect(container.textContent).toContain("Nullish");
        expect(container.textContent).toContain("Items");
      },
    );
  });

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

    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with very long fields",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, longFields);
        expect(container).toBeTruthy();
      },
    );
  });

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

    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with single-char fields",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, singleChar);
        expect(container).toBeTruthy();
      },
    );
  });

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

    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with unicode content",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, unicodeContent);
        expect(container).toBeTruthy();
      },
    );
  });

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

    test.each(ALL_TEMPLATES)(
      "$name renders without executing HTML-like content",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, htmlLikeContent);
        expect(container).toBeTruthy();
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("iframe")).toBeNull();
        const images = container.querySelectorAll("img");
        for (const img of images) {
          const src = img.getAttribute("src") || "";
          expect(src).not.toContain("onerror");
          expect(src).not.toContain("<script>");
        }
      },
    );
  });

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

    test.each(ALL_TEMPLATES)(
      "$name renders without crashing with extreme minimal data",
      ({ Component }) => {
        const { container } = testTemplateRenders(Component, combinedExtreme);
        expect(container).toBeTruthy();
      },
    );
  });
});
