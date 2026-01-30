import { sanitizeEmail } from "@/lib/utils/sanitization";

/**
 * Response types for utility workers
 */
interface PdfExtractResponse {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

interface AiParseResponse {
  success: boolean;
  data: unknown;
  error?: string;
}

type ResumeContact = {
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  behance?: string;
  dribbble?: string;
};

type ResumeExperience = {
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  description: string;
  highlights?: string[];
};

type ResumeEducation = {
  degree: string;
  institution: string;
  location?: string;
  graduation_date?: string;
  gpa?: string;
};

type ResumeSkill = {
  category: string;
  items: string[];
};

type ResumeCertification = {
  name: string;
  issuer: string;
  date?: string;
  url?: string;
};

type ResumeProject = {
  title: string;
  description: string;
  year?: string;
  technologies?: string[];
  url?: string;
  image_url?: string;
};

type ResumeSchema = {
  full_name: string;
  headline: string;
  summary: string;
  contact: ResumeContact;
  experience: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: ResumeSkill[];
  certifications?: ResumeCertification[];
  projects?: ResumeProject[];
};

const RESUME_EXTRACTION_SCHEMA = {
  type: "object",
  required: ["full_name", "headline", "summary", "contact", "experience"],
  properties: {
    full_name: {
      type: "string",
      description: "Full name of the person",
    },
    headline: {
      type: "string",
      description: "A concise professional headline/title (max 10 words, under 100 characters)",
    },
    summary: {
      type: "string",
      description:
        "Professional summary or objective statement (2-4 sentences, max 500 characters)",
    },
    contact: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string", description: "Email address" },
        phone: { type: "string" },
        location: {
          type: "string",
          description: "City, State format preferred",
        },
        linkedin: {
          type: "string",
          description:
            "Full LinkedIn URL. Must start with https://linkedin.com/in/ or https://www.linkedin.com/in/",
        },
        github: {
          type: "string",
          description: "Full GitHub URL. Must start with https://github.com/",
        },
        website: {
          type: "string",
          description: "Full website URL. Must start with https:// or http://",
        },
        behance: {
          type: "string",
          description: "Full Behance URL. Must start with https://behance.net/",
        },
        dribbble: {
          type: "string",
          description: "Full Dribbble URL. Must start with https://dribbble.com/",
        },
      },
    },
    experience: {
      type: "array",
      description: "Work experience in reverse chronological order",
      items: {
        type: "object",
        required: ["title", "company", "start_date", "description"],
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          location: { type: "string" },
          start_date: {
            type: "string",
            description: "Format: YYYY-MM or Month YYYY",
          },
          end_date: {
            type: "string",
            description: "Format: YYYY-MM or Month YYYY. Omit for current role.",
          },
          description: {
            type: "string",
            description: "Role description (2-4 sentences, max 500 characters)",
          },
          highlights: {
            type: "array",
            items: { type: "string" },
            description: "Key achievements or responsibilities",
          },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        required: ["degree", "institution"],
        properties: {
          degree: { type: "string" },
          institution: {
            type: "string",
            description: "University or school name. Always include this field.",
          },
          location: { type: "string" },
          graduation_date: { type: "string" },
          gpa: { type: "string" },
        },
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "items"],
        properties: {
          category: {
            type: "string",
            description: "Skill category (e.g., Languages, Frameworks)",
          },
          items: {
            type: "array",
            items: { type: "string" },
            description: "List of skills in this category. Must have at least one item.",
          },
        },
      },
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "issuer"],
        properties: {
          name: { type: "string" },
          issuer: {
            type: "string",
            description: "Organization that issued the certification. Always include this field.",
          },
          date: { type: "string" },
          url: {
            type: "string",
            description: "Certification URL. Must start with https:// or http://",
          },
        },
      },
    },
    projects: {
      type: "array",
      description:
        "Personal projects, side work, portfolio pieces, or notable work mentioned in the resume",
      items: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: {
            type: "string",
            description: "Project name or title",
          },
          description: {
            type: "string",
            description:
              "Brief description of the project and its impact (1-2 sentences, max 200 characters)",
          },
          year: {
            type: "string",
            description: "Year completed or date range",
          },
          technologies: {
            type: "array",
            items: { type: "string" },
            description: "Technologies, frameworks, or tools used",
          },
          url: {
            type: "string",
            description: "Project URL or demo link. Must start with https:// or http://",
          },
          image_url: {
            type: "string",
            description:
              "URL to project screenshot or thumbnail image. Must start with https:// or http://",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are an expert resume parser. Extract information from resumes into structured JSON.

## REQUIRED FIELDS (must ALWAYS be present)
- full_name: Person's full name. If unclear, use the most prominent name at the top.
- headline: Professional title/role (e.g., "Senior Software Engineer"). Generate from most recent job title if not explicit.
- summary: 2-4 sentence professional summary. If no explicit summary exists, synthesize one from the person's experience and skills.
- contact.email: Primary email address. Required.
- experience: Work history array. Include ALL positions found.

## EXTRACTION RULES
1. Dates: YYYY-MM format (e.g., 2023-08). Use "Present" for current roles.
2. URLs: Full URLs with https:// prefix. Validate format before including.
3. Locations: "City, State" or "City, Country" format.
4. Descriptions: Preserve original wording. Do not embellish.

## FIELD-SPECIFIC GUIDANCE
- summary: CRITICAL - Never leave empty. If no explicit summary section exists, write one based on the person's experience, skills, and career trajectory.
- headline: If not stated, derive from most recent job title or primary skill area.
- skills: Group into logical categories (Languages, Frameworks, Tools, etc.)
- certifications: Include courses, licenses, awards, honors, competitions.
- projects: Extract technologies into the technologies array.

## OUTPUT RULES
- Return ONLY valid JSON matching the schema
- Never omit sections if data exists in the resume
- Use empty arrays [] only for truly absent sections
- Do not add fields not in the schema`;

/**
 * Sanitize raw error responses from service bindings into human-readable messages.
 * Service workers can return raw HTML (e.g. 504 gateway pages) or JSON error bodies
 * that should never be shown to users.
 */
function sanitizeServiceError(responseText: string, status: number): string {
  // HTTP status-specific friendly messages
  if (status === 504) return "Service timed out. Please try again.";
  if (status === 502) return "Service temporarily unavailable. Please try again.";
  if (status === 429) return "AI service rate limited. Please wait a moment and try again.";

  const text = responseText.trim();
  if (!text) return "An unexpected error occurred. Please try again.";

  // Detect HTML responses (raw gateway error pages)
  if (text.startsWith("<") || text.toLowerCase().includes("<html")) {
    return "Resume parsing service unavailable. Please try again.";
  }

  // Detect JSON responses — extract the .error field if present
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        // Truncate extracted error to 200 chars
        const msg = parsed.error.trim();
        return msg.length > 200 ? `${msg.slice(0, 200)}...` : msg;
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  // Truncate any remaining raw text to 200 chars
  if (text.length > 200) {
    return `${text.slice(0, 200)}...`;
  }

  return text;
}

/**
 * Extract text from PDF using pdf-text-worker
 */
async function extractPdfText(
  pdfBuffer: Uint8Array,
  env: Partial<CloudflareEnv>,
): Promise<PdfExtractResponse> {
  const worker = env.PDF_TEXT_WORKER;
  if (!worker) {
    return { success: false, text: "", pageCount: 0, error: "PDF worker not available" };
  }

  // Convert Uint8Array to a standard ArrayBuffer to satisfy BodyInit type
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;

  const response = await worker.fetch("https://internal/extract", {
    method: "POST",
    body: arrayBuffer,
  });

  if (!response.ok) {
    const error = sanitizeServiceError(await response.text(), response.status);
    return { success: false, text: "", pageCount: 0, error };
  }

  return response.json() as Promise<PdfExtractResponse>;
}

const DEFAULT_AI_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Parse text with AI using ai-parser-worker
 */
async function parseWithAi(text: string, env: Partial<CloudflareEnv>): Promise<AiParseResponse> {
  const worker = env.AI_PARSER_WORKER;
  if (!worker) {
    return { success: false, data: null, error: "AI parser not available" };
  }

  const model = env.AI_MODEL || DEFAULT_AI_MODEL;

  const response = await worker.fetch("https://internal/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      schema: RESUME_EXTRACTION_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
      model,
    }),
  });

  if (!response.ok) {
    const error = sanitizeServiceError(await response.text(), response.status);
    return { success: false, data: null, error };
  }

  return response.json() as Promise<AiParseResponse>;
}

/**
 * Normalize URL - add protocol if missing, return empty string if invalid
 */
function normalizeUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Already has valid protocol
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
    return trimmed;
  }
  // Block dangerous protocols
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return "";
  }
  // Add https:// to URLs without protocol
  return `https://${trimmed}`;
}

/**
 * Validate URL with garbage pattern detection
 * Detects pathological patterns like repeating path segments (divkix.me/divkix.me/divkix.me)
 */
function validateUrl(url: unknown): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Max length check - URLs shouldn't be this long
  if (trimmed.length > 500) return "";

  // Detect repeating path segments (the divkix.me/divkix.me/divkix.me pattern)
  // Match any segment that repeats consecutively: /foo/foo/ or /bar/bar/
  const repeatingSegmentPattern = /\/([^/]+)\/\1(?:\/|$)/;
  if (repeatingSegmentPattern.test(trimmed)) return "";

  // Check for excessive path depth (more than 10 segments is suspicious)
  const pathSegments = trimmed.split("/").filter(Boolean);
  if (pathSegments.length > 12) return "";

  // Normalize first
  const normalized = normalizeUrl(trimmed);
  if (!normalized) return "";

  // Validate URL structure
  try {
    const urlObj = new URL(normalized);

    // Must have a valid TLD (contains at least one dot in hostname)
    if (!urlObj.hostname.includes(".")) return "";

    // Hostname shouldn't be excessively long
    if (urlObj.hostname.length > 253) return "";

    // Re-check for repeating patterns in the final normalized URL
    if (repeatingSegmentPattern.test(urlObj.pathname)) return "";

    return normalized;
  } catch {
    return "";
  }
}

/**
 * Truncate string to max length with ellipsis
 */
function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Normalize string - convert null/undefined to empty string, trim
 */
function normalizeString(value: unknown, defaultVal = ""): string {
  if (value === null || value === undefined) return defaultVal;
  if (typeof value !== "string") return String(value);
  return value.trim() || defaultVal;
}

/**
 * Basic transforms for AI output - no strict validation
 * Lenient parsing that always produces usable output.
 * XSS sanitization + URL validation (with garbage detection) + null handling
 *
 * ## Design Rationale for AI Output Validation
 *
 * ### 1. No `sanitizeText()` on AI output
 * We intentionally avoid HTML-encoding text fields (like names, descriptions) at parse time.
 * React already escapes text content during render, so pre-encoding causes double-encoding:
 * - AI returns: "AT&T Corporation"
 * - sanitizeText(): "AT&amp;T Corporation" (stored in DB)
 * - React render: "AT&amp;amp;T Corporation" (visible in UI)
 *
 * ### 2. Model upgrades don't fix hallucination
 * All LLMs hallucinate URLs and data at similar rates regardless of model or provider.
 * More expensive models show only marginal improvement in extraction accuracy.
 * URL hallucination is a fundamental LLM limitation, not a model quality issue.
 *
 * ### 3. Correct pattern: defensive validation + edit-time sanitization
 * - **Parse-time (here)**: Validate structure, filter garbage entries, validate URLs
 *   (with garbage pattern detection like repeating segments), sanitize emails
 * - **Edit-time (/api/resume/update)**: Full XSS sanitization via Zod schema in
 *   `lib/schemas/resume.ts` when users modify content through the editor
 *
 * This split ensures AI-generated content displays correctly while user-edited
 * content is properly sanitized before storage.
 */
function transformAiResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return {
      full_name: "Unknown",
      headline: "Professional",
      summary: "",
      contact: { email: "" },
      experience: [],
    };
  }

  const data = raw as Record<string, unknown>;

  // Top-level fields - use empty strings as defaults (lenient) with max length
  data.full_name = truncateString(normalizeString(data.full_name, "Unknown"), 100);
  data.headline = truncateString(normalizeString(data.headline, "Professional"), 150);

  // Summary with fallback generation if AI didn't return one
  let summary = normalizeString(data.summary);

  if (!summary) {
    // Try to extract from first experience description
    if (Array.isArray(data.experience) && data.experience.length > 0) {
      const firstExp = data.experience[0] as Record<string, unknown>;
      if (firstExp?.description && typeof firstExp.description === "string") {
        const desc = firstExp.description.trim();
        if (desc.length > 0) {
          summary = desc.slice(0, 500);
        }
      }
    }
    // Fallback to headline-based summary
    if (!summary) {
      const headline = normalizeString(data.headline, "Professional");
      summary = `Experienced ${headline.toLowerCase()} with a proven track record.`;
    }
  }

  data.summary = truncateString(summary, 2000);

  // Contact - validate URLs (with garbage detection), sanitize email
  if (data.contact && typeof data.contact === "object") {
    const c = data.contact as Record<string, unknown>;
    c.email = sanitizeEmail(normalizeString(c.email));
    c.phone = truncateString(normalizeString(c.phone), 30);
    c.location = truncateString(normalizeString(c.location), 100);
    c.linkedin = validateUrl(c.linkedin);
    c.github = validateUrl(c.github);
    c.website = validateUrl(c.website);
    c.behance = validateUrl(c.behance);
    c.dribbble = validateUrl(c.dribbble);
  } else {
    data.contact = { email: "" };
  }

  // Experience - filter out garbage entries (must have title and company)
  if (Array.isArray(data.experience)) {
    data.experience = data.experience.filter((exp) => {
      if (!exp || typeof exp !== "object") return false;
      const e = exp as Record<string, unknown>;
      // Must have title and company as non-empty strings
      return (
        e.title &&
        typeof e.title === "string" &&
        e.title.trim().length > 0 &&
        e.company &&
        typeof e.company === "string" &&
        e.company.trim().length > 0
      );
    });
    // Truncate text fields in experience
    for (const exp of data.experience as Record<string, unknown>[]) {
      exp.title = truncateString(normalizeString(exp.title), 150);
      exp.company = truncateString(normalizeString(exp.company), 150);
      exp.location = truncateString(normalizeString(exp.location), 100);
      exp.description = truncateString(normalizeString(exp.description), 2000);
      if (Array.isArray(exp.highlights)) {
        exp.highlights = exp.highlights
          .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          .map((h) => truncateString(h.trim(), 500));
      }
    }
  } else {
    data.experience = [];
  }

  // Education - filter out garbage entries (must have degree)
  if (Array.isArray(data.education)) {
    data.education = data.education.filter((edu) => {
      if (!edu || typeof edu !== "object") return false;
      const e = edu as Record<string, unknown>;
      return e.degree && typeof e.degree === "string" && e.degree.trim().length > 0;
    });
    // Truncate text fields in education
    for (const edu of data.education as Record<string, unknown>[]) {
      edu.degree = truncateString(normalizeString(edu.degree), 150);
      edu.institution = truncateString(normalizeString(edu.institution), 150);
      edu.location = truncateString(normalizeString(edu.location), 100);
    }
  }

  // Skills - filter out garbage entries (must have category and items array)
  if (Array.isArray(data.skills)) {
    data.skills = data.skills.filter((skill) => {
      if (!skill || typeof skill !== "object") return false;
      const s = skill as Record<string, unknown>;
      return (
        s.category &&
        typeof s.category === "string" &&
        s.category.trim().length > 0 &&
        Array.isArray(s.items) &&
        s.items.length > 0
      );
    });
    // Truncate text fields in skills
    for (const skill of data.skills as Record<string, unknown>[]) {
      skill.category = truncateString(normalizeString(skill.category), 100);
      if (Array.isArray(skill.items)) {
        skill.items = skill.items
          .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
          .map((i) => truncateString(i.trim(), 100));
      }
    }
  }

  // Certifications - filter garbage, validate URLs
  if (Array.isArray(data.certifications)) {
    data.certifications = data.certifications.filter((cert) => {
      if (!cert || typeof cert !== "object") return false;
      const c = cert as Record<string, unknown>;
      return c.name && typeof c.name === "string" && c.name.trim().length > 0;
    });
    for (const cert of data.certifications as Record<string, unknown>[]) {
      cert.name = truncateString(normalizeString(cert.name), 150);
      cert.issuer = truncateString(normalizeString(cert.issuer), 150);
      cert.url = validateUrl(cert.url);
    }
  }

  // Projects - filter garbage, validate URLs
  if (Array.isArray(data.projects)) {
    data.projects = data.projects.filter((proj) => {
      if (!proj || typeof proj !== "object") return false;
      const p = proj as Record<string, unknown>;
      return p.title && typeof p.title === "string" && p.title.trim().length > 0;
    });
    for (const proj of data.projects as Record<string, unknown>[]) {
      proj.title = truncateString(normalizeString(proj.title), 150);
      proj.description = truncateString(normalizeString(proj.description), 1000);
      proj.url = validateUrl(proj.url);
      proj.image_url = validateUrl(proj.image_url);
      if (Array.isArray(proj.technologies)) {
        proj.technologies = proj.technologies
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => truncateString(t.trim(), 50));
      }
    }
  }

  return data;
}

function transformGeminiOutput(raw: ResumeSchema): ResumeSchema {
  const result = structuredClone(raw);

  const trimStrings = (obj: Record<string, unknown>): void => {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          trimStrings(item as Record<string, unknown>);
        }
      }
      return;
    }
    if (typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = (obj[key] as string).trim();
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          trimStrings(obj[key] as Record<string, unknown>);
        }
      }
    }
  };

  trimStrings(result);

  if (result.contact?.website?.includes("linkedin.com") && !result.contact.linkedin) {
    result.contact.linkedin = result.contact.website;
    delete result.contact.website;
  }

  if (result.contact) {
    for (const key of Object.keys(result.contact)) {
      if ((result.contact as Record<string, unknown>)[key] === "") {
        delete (result.contact as Record<string, unknown>)[key];
      }
    }
  }

  if (Array.isArray(result.projects)) {
    for (const project of result.projects) {
      if (project?.year) {
        const yearMatch = project.year.match(/(\d{4})/);
        if (yearMatch) {
          project.year = yearMatch[1];
        }
      }
    }
  }

  if (Array.isArray(result.experience)) {
    for (const exp of result.experience) {
      if (exp?.location === "") {
        delete exp.location;
      }
    }
  }

  if (Array.isArray(result.education)) {
    for (const edu of result.education) {
      if (edu?.location === "") {
        delete edu.location;
      }
      if (edu?.gpa === "") {
        delete edu.gpa;
      }
    }
  }

  for (const key of ["skills", "certifications", "projects", "education"] as const) {
    if (Array.isArray(result[key]) && result[key].length === 0) {
      delete result[key];
    }
  }

  if (result.contact?.website === result.contact?.linkedin) {
    delete result.contact.website;
  }

  return result;
}

export async function parseResumeWithGemini(
  pdfBuffer: Uint8Array,
  env: Partial<CloudflareEnv>,
): Promise<{ success: boolean; parsedContent: string; error?: string }> {
  try {
    // Step 1: Extract text from PDF
    const extractResult = await extractPdfText(pdfBuffer, env);

    if (!extractResult.success || !extractResult.text) {
      return {
        success: false,
        parsedContent: "",
        error: extractResult.error || "PDF extraction failed",
      };
    }

    const resumeText = extractResult.text.slice(0, 60000);

    if (!resumeText.trim()) {
      return {
        success: false,
        parsedContent: "",
        error: "Extracted resume text is empty",
      };
    }

    // Step 2: Parse with AI
    const parseResult = await parseWithAi(resumeText, env);

    if (!parseResult.success || !parseResult.data) {
      return {
        success: false,
        parsedContent: "",
        error: parseResult.error || "AI parsing failed",
      };
    }

    // Step 2.5: Basic transforms - lenient, no strict validation
    // Validation happens at edit-time in /api/resume/update, not here
    const transformedData = transformAiResponse(parseResult.data);

    // Step 3: Final cleanup and return
    const transformed = transformGeminiOutput(transformedData as ResumeSchema);

    return {
      success: true,
      parsedContent: JSON.stringify(transformed),
    };
  } catch (error) {
    return {
      success: false,
      parsedContent: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { RESUME_EXTRACTION_SCHEMA, transformGeminiOutput };
