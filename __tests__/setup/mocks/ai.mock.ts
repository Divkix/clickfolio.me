/**
 * AI SDK mock factories for resume parsing responses.
 *
 * Provides mock data matching the shapes produced by `lib/ai/schema.ts`
 * (ResumeSchema) and the Vercel AI SDK structured output helpers.
 */

import type { ResumeSchema } from "@/lib/ai/schema";

// ---------------------------------------------------------------------------
// Full parsed resume mock
// ---------------------------------------------------------------------------

interface CreateMockParsedResumeOverrides {
  full_name?: string;
  headline?: string;
  summary?: string;
}

/**
 * Create a complete mock parsed resume matching `ResumeSchema`.
 * All fields are populated with realistic test data.
 */
export function createMockParsedResume(
  overrides: CreateMockParsedResumeOverrides = {},
): ResumeSchema {
  return {
    full_name: overrides.full_name ?? "Jane Doe",
    headline: overrides.headline ?? "Senior Software Engineer",
    summary:
      "Experienced full-stack engineer with 8+ years building scalable web applications. Passionate about developer tooling and open source.",
    contact: {
      email: "jane@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      linkedin: "https://linkedin.com/in/janedoe",
      github: "https://github.com/janedoe",
      website: "https://janedoe.dev",
    },
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Acme Corp",
        location: "San Francisco, CA",
        start_date: "2022-03",
        description:
          "Led the frontend architecture migration to React, improving page load times by 40%.",
        highlights: [
          "Migrated 20+ legacy jQuery components to React",
          "Reduced build time by 60% with Vite",
        ],
      },
      {
        title: "Software Engineer",
        company: "StartupXYZ",
        location: "Remote",
        start_date: "2019-06",
        end_date: "2022-02",
        description: "Full-stack development on a B2B SaaS platform serving 10k+ users.",
        highlights: [
          "Built real-time collaboration features using WebSockets",
          "Implemented CI/CD pipeline reducing deploy time from 30min to 5min",
        ],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "University of California, Berkeley",
        location: "Berkeley, CA",
        graduation_date: "2019-05",
        gpa: "3.8",
      },
    ],
    skills: [
      {
        category: "Languages",
        items: ["TypeScript", "Python", "Go", "SQL"],
      },
      {
        category: "Frameworks",
        items: ["React", "Next.js", "Node.js", "Cloudflare Workers"],
      },
    ],
    certifications: [
      {
        name: "AWS Solutions Architect",
        issuer: "Amazon Web Services",
        date: "2023-06",
      },
    ],
    projects: [
      {
        title: "Open Source CLI Tool",
        description:
          "A developer productivity CLI for scaffolding and deploying Cloudflare Workers projects.",
        year: "2024",
        technologies: ["TypeScript", "Cloudflare Workers", "Vite"],
        url: "https://github.com/janedoe/cf-tool",
      },
    ],
    professional_level: "senior",
  };
}

// ---------------------------------------------------------------------------
// Minimal parsed resume (for edge cases)
// ---------------------------------------------------------------------------

/**
 * Create a minimal parsed resume with empty optional arrays.
 * Useful for testing edge cases (no experience, no skills, etc.).
 */
export function createMinimalParsedResume(): ResumeSchema {
  return {
    full_name: "Minimal User",
    headline: "Junior Developer",
    summary: "Just starting out in software development.",
    contact: {
      email: "minimal@example.com",
    },
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
  };
}

// ---------------------------------------------------------------------------
// AI SDK structured output mock
// ---------------------------------------------------------------------------

/**
 * Mock the shape returned by Vercel AI SDK's `generateObject()` / `generateText()`.
 * This wraps a parsed resume in the AI SDK response envelope.
 */
export function createMockAIResponse<T = ResumeSchema>(data: T) {
  return {
    text: JSON.stringify(data),
    object: data,
    usage: {
      promptTokens: 1500,
      completionTokens: 800,
      totalTokens: 2300,
    },
    finishReason: "stop" as const,
  };
}

// ---------------------------------------------------------------------------
// AI error response mock
// ---------------------------------------------------------------------------

export function createMockAIError(message = "AI provider error") {
  const error = new Error(message);
  return error;
}

// ---------------------------------------------------------------------------
// PDF extraction mock (the raw text that would come from unpdf)
// ---------------------------------------------------------------------------

export const MOCK_RAW_PDF_TEXT = `
JANE DOE
Senior Software Engineer | jane@example.com | +1 (555) 123-4567
San Francisco, CA | linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Experienced full-stack engineer with 8+ years building scalable web applications.

EXPERIENCE
Senior Software Engineer — Acme Corp (Mar 2022 – Present)
• Led frontend architecture migration to React
• Reduced build time by 60% with Vite

Software Engineer — StartupXYZ (Jun 2019 – Feb 2022)
• Full-stack development on B2B SaaS platform

EDUCATION
B.S. Computer Science — UC Berkeley (2019)
GPA: 3.8

SKILLS
TypeScript, Python, Go, React, Next.js, Node.js, SQL, Cloudflare Workers
`;
