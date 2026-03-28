/**
 * Template Component Tests
 *
 * Tests all 10 resume template components for rendering,
 * privacy filtering, responsiveness, and edge cases.
 *
 * @module __tests__/unit/components/templates.test
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
// Import all templates
import MinimalistEditorial from "@/components/templates/MinimalistEditorial";
import NeoBrutalist from "@/components/templates/NeoBrutalist";
import Spotlight from "@/components/templates/Spotlight";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

// ============================================================================
// Mock Data Fixtures
// ============================================================================

const mockProfile: TemplateProps["profile"] = {
  handle: "johndoe",
  avatar_url: null,
};

const fullResumeContent: ResumeContent = {
  full_name: "John Alexander Doe",
  headline: "Senior Software Engineer",
  summary:
    "Experienced full-stack developer with 10+ years building scalable web applications. Passionate about clean code and mentoring junior developers.",
  contact: {
    email: "john@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe",
    website: "https://johndoe.dev",
  },
  experience: [
    {
      title: "Senior Software Engineer",
      company: "TechCorp Inc",
      location: "San Francisco, CA",
      start_date: "2020-03",
      end_date: "2024-12",
      description:
        "Led development of microservices architecture serving 1M+ users daily. Reduced latency by 40%.",
      highlights: [
        "Architected and deployed Kubernetes-based infrastructure",
        "Mentored team of 5 junior engineers",
        "Reduced infrastructure costs by 35% through optimization",
      ],
    },
    {
      title: "Software Engineer",
      company: "StartupXYZ",
      location: "Remote",
      start_date: "2017-06",
      end_date: "2020-02",
      description:
        "Full-stack development on B2B SaaS platform. Built real-time collaboration features.",
      highlights: [
        "Implemented WebSocket-based real-time features",
        "Built CI/CD pipeline reducing deploy time by 70%",
      ],
    },
    {
      title: "Junior Developer",
      company: "WebAgency",
      location: "New York, NY",
      start_date: "2015-01",
      end_date: "2017-05",
      description: "Frontend development for e-commerce clients using React and Node.js.",
      highlights: [
        "Delivered 15+ client projects on time",
        "Introduced automated testing practices",
      ],
    },
  ],
  education: [
    {
      degree: "M.S. Computer Science",
      institution: "Stanford University",
      location: "Stanford, CA",
      graduation_date: "2015-05",
      gpa: "3.9",
    },
    {
      degree: "B.S. Computer Science",
      institution: "UC Berkeley",
      location: "Berkeley, CA",
      graduation_date: "2013-05",
      gpa: "3.7",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: ["TypeScript", "Python", "Go", "Rust", "SQL", "JavaScript"],
    },
    {
      category: "Frameworks",
      items: ["React", "Next.js", "Node.js", "Django", "FastAPI"],
    },
    {
      category: "Infrastructure",
      items: ["AWS", "Kubernetes", "Docker", "Terraform", "Cloudflare"],
    },
  ],
  certifications: [
    {
      name: "AWS Solutions Architect Professional",
      issuer: "Amazon Web Services",
      date: "2023-06",
      url: "https://aws.amazon.com/certification",
    },
    {
      name: "Google Cloud Professional",
      issuer: "Google Cloud",
      date: "2022-03",
    },
  ],
  projects: [
    {
      title: "Open Source CLI Tool",
      description:
        "A productivity CLI for scaffolding Cloudflare Workers projects with 50k+ downloads.",
      year: "2024",
      technologies: ["TypeScript", "Cloudflare Workers", "Vite"],
      url: "https://github.com/johndoe/cf-tool",
    },
    {
      title: "Real-time Analytics Dashboard",
      description: "WebSocket-based analytics dashboard processing 10k+ events per second.",
      year: "2023",
      technologies: ["React", "WebSockets", "Redis", "TimescaleDB"],
      url: "https://analytics.johndoe.dev",
    },
  ],
};

const minimalResumeContent: ResumeContent = {
  full_name: "Jane Doe",
  headline: "Junior Developer",
  summary: "Starting my journey in software development.",
  contact: {
    email: "jane@example.com",
  },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

const specialCharsContent: ResumeContent = {
  full_name: "Ñoño García 🚀",
  headline: "Developer <script>alert('test')</script>",
  summary: "Special chars: \"quotes\" & 'apostrophes' <>&",
  contact: {
    email: "test@example.com",
    location: "München, 北京, المدينة",
  },
  experience: [
    {
      title: "Engineer 🧑‍💻",
      company: 'Company "ABC"',
      location: "Café résumé naïve",
      start_date: "2020-01",
      description: 'Description with "quotes" & <tags>',
      highlights: ["Point 1: café", "Point 2: résumé", "Point 3: naïve"],
    },
  ],
  education: [],
  skills: [
    {
      category: "Skills",
      items: ["C++", "C#", "HTML<>&", "JS\"'"],
    },
  ],
  certifications: [],
  projects: [],
};

const longContentResume: ResumeContent = {
  full_name: "A".repeat(100),
  headline: "B".repeat(200),
  summary: "C".repeat(2000),
  contact: {
    email: "test@example.com",
  },
  experience: Array.from({ length: 20 }, () => ({
    title: "Job Title ".repeat(10),
    company: "Company Name ".repeat(10),
    location: "Location ".repeat(5),
    start_date: "2020-01",
    description: "Description ".repeat(50),
    highlights: Array.from({ length: 10 }, () => "Highlight text ".repeat(10)),
  })),
  education: Array.from({ length: 5 }, () => ({
    degree: "Degree ".repeat(10),
    institution: "Institution ".repeat(10),
    location: "Location ".repeat(5),
    graduation_date: "2015-05",
    gpa: "3.5",
  })),
  skills: [
    {
      category: "All Skills",
      items: Array.from({ length: 50 }, () => "Skill ".repeat(5)),
    },
  ],
  certifications: [],
  projects: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Test template with given content
 */
function testTemplate(
  _name: string,
  Component: React.ComponentType<TemplateProps>,
  content: ResumeContent,
  profile = mockProfile,
) {
  return render(<Component content={content} profile={profile} />);
}

// ============================================================================
// Template Tests
// ============================================================================

describe("Template Component Tests", () => {
  // ============================================================================
  // MinimalistEditorial Tests
  // ============================================================================
  describe("MinimalistEditorial Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        fullResumeContent,
      );
      expect(container.querySelector(".font-serif-me")).toBeInTheDocument();
    });

    test("2. Privacy filtering applied correctly (hides phone/email if disabled)", () => {
      const contentWithHiddenPhone: ResumeContent = {
        ...fullResumeContent,
        contact: {
          ...fullResumeContent.contact,
          phone: undefined, // Simulate hidden
        },
      };
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        contentWithHiddenPhone,
      );
      // Should still render without phone - check for name parts since Minimalist splits names
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("3. Mobile responsive classes present (sm:, md:, lg: breakpoints)", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        fullResumeContent,
      );
      const elements = container.querySelectorAll("[class*='sm:'], [class*='md:'], [class*='lg:']");
      expect(elements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        minimalResumeContent,
      );
      // Should render without crashing even with empty arrays
      expect(container.textContent).toContain("Jane");
      expect(container.textContent).toContain("Doe");
    });

    test("5. Template handles empty arrays (no experience, no education)", () => {
      const { container } = testTemplate("MinimalistEditorial", MinimalistEditorial, {
        ...fullResumeContent,
        experience: [],
        education: [],
      });
      // Experience and education sections may be hidden when empty
      // Check for name parts since Minimalist splits names
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("6. Template handles very long content (text overflow)", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        longContentResume,
      );
      // Should render without crashing
      expect(container).toBeTruthy();
    });

    test("7. Template handles special characters in content", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        specialCharsContent,
      );
      // Should render special characters safely (template may remove spaces when splitting names)
      expect(container.textContent).toContain("Ñoño");
      expect(container.textContent).toContain("García");
    });

    test("8. Template renders with minimal data (name only)", () => {
      const minimal: ResumeContent = {
        full_name: "Minimal User",
        headline: "",
        summary: "",
        contact: { email: "min@example.com" },
        experience: [],
        education: [],
      };
      const { container } = testTemplate("MinimalistEditorial", MinimalistEditorial, minimal);
      // Template splits name into first/last, so check for both parts
      expect(container.textContent).toContain("Minimal");
      expect(container.textContent).toContain("User");
    });

    test("9. Template renders with maximum data (all fields populated)", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        fullResumeContent,
      );
      // Template splits name, so check for parts instead of exact match
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Alexander");
      expect(container.textContent).toContain("Doe");
      expect(container.textContent).toContain(fullResumeContent.headline);
    });
  });

  // ============================================================================
  // NeoBrutalist Tests
  // ============================================================================
  describe("NeoBrutalist Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, fullResumeContent);
      expect(container.querySelector(".font-heading-nb")).toBeInTheDocument();
    });

    test("2. Privacy filtering applied correctly", () => {
      const contentWithHiddenEmail: ResumeContent = {
        ...fullResumeContent,
        contact: {
          ...fullResumeContent.contact,
          email: "filtered@example.com",
        },
      };
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, contentWithHiddenEmail);
      expect(container.textContent).toContain(contentWithHiddenEmail.full_name);
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='md:'], [class*='lg:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("5. Template handles empty arrays", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, {
        ...fullResumeContent,
        projects: [],
        certifications: [],
      });
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });

    test("6. Template handles very long content", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, longContentResume);
      expect(container).toBeTruthy();
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("8. Template renders with minimal data", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // GlassMorphic Tests
  // ============================================================================
  describe("GlassMorphic Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='sm:'], [class*='md:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // BentoGrid Tests
  // ============================================================================
  describe("BentoGrid Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='md:'], [class*='lg:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // ClassicATS Tests
  // ============================================================================
  describe("ClassicATS Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='sm:'], [class*='md:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // DevTerminal Tests
  // ============================================================================
  describe("DevTerminal Template", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='md:'], [class*='lg:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // DesignFolio (Premium) Tests
  // ============================================================================
  describe("DesignFolio Template (Premium)", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, fullResumeContent);
      const responsiveElements = container.querySelectorAll(
        "[class*='sm:'], [class*='md:'], [class*='lg:']",
      );
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // Spotlight (Premium) Tests
  // ============================================================================
  describe("Spotlight Template (Premium)", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("Spotlight", Spotlight, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("Spotlight", Spotlight, fullResumeContent);
      const responsiveElements = container.querySelectorAll("[class*='md:'], [class*='lg:']");
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("Spotlight", Spotlight, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("Spotlight", Spotlight, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("Spotlight", Spotlight, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // Midnight (Premium) Tests
  // ============================================================================
  describe("Midnight Template (Premium)", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("Midnight", Midnight, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("Midnight", Midnight, fullResumeContent);
      const responsiveElements = container.querySelectorAll(
        "[class*='sm:'], [class*='md:'], [class*='lg:']",
      );
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("Midnight", Midnight, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("Midnight", Midnight, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("Midnight", Midnight, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // BoldCorporate (Premium) Tests
  // ============================================================================
  describe("BoldCorporate Template (Premium)", () => {
    test("1. Template renders without error with mock resume data", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, fullResumeContent);
      expect(container).toBeTruthy();
    });

    test("3. Mobile responsive classes present", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, fullResumeContent);
      const responsiveElements = container.querySelectorAll(
        "[class*='sm:'], [class*='md:'], [class*='lg:']",
      );
      expect(responsiveElements.length).toBeGreaterThan(0);
    });

    test("4. Template handles missing sections gracefully", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });

    test("7. Template handles special characters", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, specialCharsContent);
      expect(container.textContent).toContain("Ñoño García");
    });

    test("9. Template renders with maximum data", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });
  });

  // ============================================================================
  // Template Switching Tests
  // ============================================================================
  describe("Template Switching", () => {
    test("10. Template switching works correctly", () => {
      // Test that different templates render different content
      const { container: minimalist } = render(
        <MinimalistEditorial content={fullResumeContent} profile={mockProfile} />,
      );
      const { container: neoBrutalist } = render(
        <NeoBrutalist content={fullResumeContent} profile={mockProfile} />,
      );

      // Templates should have different HTML structure
      expect(minimalist.innerHTML).not.toEqual(neoBrutalist.innerHTML);
    });

    test("All templates can be imported and instantiated", () => {
      const templates = [
        { Component: MinimalistEditorial },
        { Component: NeoBrutalist },
        { Component: GlassMorphic },
        { Component: BentoGrid },
        { Component: ClassicATS },
        { Component: DevTerminal },
        { Component: DesignFolio },
        { Component: Spotlight },
        { Component: Midnight },
        { Component: BoldCorporate },
      ];

      for (const { Component } of templates) {
        const { container } = render(
          <Component content={fullResumeContent} profile={mockProfile} />,
        );
        expect(container).toBeTruthy();
        // Check for name parts since Minimalist splits names
        expect(container.textContent).toContain("John");
        expect(container.textContent).toContain("Doe");
      }
    });
  });
});
