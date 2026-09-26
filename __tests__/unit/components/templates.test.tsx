import { render } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { BentoGrid } from "@/components/templates/BentoGrid";
import { BoldCorporate } from "@/components/templates/BoldCorporate";
import { CaseFile } from "@/components/templates/CaseFile";
import { ClassicATS } from "@/components/templates/ClassicATS";
import { DesignFolio } from "@/components/templates/DesignFolio";
import { DevTerminal } from "@/components/templates/DevTerminal";
import { GlassMorphic } from "@/components/templates/GlassMorphic";
import { Midnight } from "@/components/templates/Midnight";
import { MinimalistEditorial } from "@/components/templates/MinimalistEditorial";
import { NeoBrutalist } from "@/components/templates/NeoBrutalist";
import { RetroOS } from "@/components/templates/RetroOS";
import { Spotlight } from "@/components/templates/Spotlight";
import type { ResumeContent } from "@/lib/types/database";
import type { TemplateProps } from "@/lib/types/template";

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
  ],
  education: [
    {
      degree: "M.S. Computer Science",
      institution: "Stanford University",
      location: "Stanford, CA",
      graduation_date: "2015-05",
      gpa: "3.9",
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
  ],
  certifications: [
    {
      name: "AWS Solutions Architect Professional",
      issuer: "Amazon Web Services",
      date: "2023-06",
      url: "https://aws.amazon.com/certification",
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

function testTemplate(
  _name: string,
  Component: React.ComponentType<TemplateProps>,
  content: ResumeContent,
  profile = mockProfile,
) {
  return render(<Component content={content} profile={profile} />);
}

describe("Template Component Tests", () => {
  describe("MinimalistEditorial Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        fullResumeContent,
      );

      expect(container.querySelector(".font-serif-me")).toBeInTheDocument();
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate(
        "MinimalistEditorial",
        MinimalistEditorial,
        minimalResumeContent,
      );

      expect(container.textContent).toContain("Jane");
      expect(container.textContent).toContain("Doe");
    });
  });

  describe("NeoBrutalist Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, fullResumeContent);
      expect(container.querySelector(".font-heading-nb")).toBeInTheDocument();
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("NeoBrutalist", NeoBrutalist, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("GlassMorphic Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, fullResumeContent);
      expect(container.textContent).toContain(fullResumeContent.full_name);
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("GlassMorphic", GlassMorphic, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("BentoGrid Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("BentoGrid", BentoGrid, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("ClassicATS Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("ClassicATS", ClassicATS, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("DevTerminal Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("DevTerminal", DevTerminal, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("DesignFolio Template (Premium)", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("DesignFolio", DesignFolio, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("Spotlight Template (Premium)", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("Spotlight", Spotlight, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("Spotlight", Spotlight, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("Midnight Template (Premium)", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("Midnight", Midnight, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("Midnight", Midnight, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("BoldCorporate Template (Premium)", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, fullResumeContent);
      expect(container.textContent).toContain("John");
      expect(container.textContent).toContain("Doe");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("BoldCorporate", BoldCorporate, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("CaseFile Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("CaseFile", CaseFile, fullResumeContent);
      expect(container.querySelector(".font-body-cf")).toBeInTheDocument();
      expect(container.textContent).toContain("John Alexander Doe");
    });

    test("letters exhibits only for sections that exist", () => {
      const { container } = testTemplate("CaseFile", CaseFile, fullResumeContent);

      const labels = [...container.querySelectorAll("section[id] header span")].map(
        (node) => node.textContent,
      );

      expect(labels).toEqual(["Exhibit A", "Exhibit B", "Exhibit C", "Exhibit D", "Exhibit E"]);

      const { container: sparse } = testTemplate("CaseFile", CaseFile, {
        ...minimalResumeContent,
        skills: [{ category: "Languages", items: ["TypeScript"] }],
      });

      expect(sparse.querySelector("#skills")?.textContent).toContain("Exhibit A");
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("CaseFile", CaseFile, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
      expect(container.querySelector("#experience")).toBeNull();
    });
  });

  describe("RetroOS Template", () => {
    test("renders without error with mock resume data", () => {
      const { container } = testTemplate("RetroOS", RetroOS, fullResumeContent);
      expect(container.querySelector(".ros-desktop")).toBeInTheDocument();
      expect(container.textContent).toContain("John Alexander Doe");
    });

    test("desktop icons only link to windows that render", () => {
      const { container } = testTemplate("RetroOS", RetroOS, minimalResumeContent);

      const targets = [...container.querySelectorAll("nav[aria-label='Desktop'] a")].map((a) =>
        a.getAttribute("href"),
      );

      expect(targets).toEqual(["#about"]);

      for (const href of targets) {
        expect(container.querySelector(href ?? "")).toBeInTheDocument();
      }
    });

    test("handles missing sections gracefully", () => {
      const { container } = testTemplate("RetroOS", RetroOS, minimalResumeContent);
      expect(container.textContent).toContain(minimalResumeContent.full_name);
    });
  });

  describe("Template Switching", () => {
    test("renders distinct output per template", () => {
      const { container: minimalist } = render(
        <MinimalistEditorial content={fullResumeContent} profile={mockProfile} />,
      );

      const { container: neoBrutalist } = render(
        <NeoBrutalist content={fullResumeContent} profile={mockProfile} />,
      );

      expect(minimalist.innerHTML).not.toEqual(neoBrutalist.innerHTML);
    });
  });
});
