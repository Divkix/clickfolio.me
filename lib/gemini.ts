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
  institution?: string;
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
  issuer?: string;
  date?: string;
  url?: string;
};

type ResumeProject = {
  title: string;
  description: string;
  year?: string;
  technologies?: string[];
  url?: string;
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
      description: "A concise 10-word professional headline/title",
      maxLength: 100,
    },
    summary: {
      type: "string",
      description: "Professional summary or objective statement",
      maxLength: 500,
    },
    contact: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string", format: "email" },
        phone: { type: "string" },
        location: {
          type: "string",
          description: "City, State format preferred",
        },
        linkedin: { type: "string", format: "uri" },
        github: { type: "string", format: "uri" },
        website: { type: "string", format: "uri" },
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
          description: { type: "string" },
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
        required: ["degree"],
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
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
          items: { type: "array", items: { type: "string" } },
        },
      },
    },
    certifications: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          issuer: { type: "string" },
          date: { type: "string" },
          url: { type: "string", format: "uri" },
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
            maxLength: 200,
            description: "Brief description of the project and its impact",
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
            description: "Project URL or demo link if available",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are an expert resume parser. Extract ALL available information from the resume into the JSON schema.

EXTRACTION RULES:
1. Be thorough - extract every piece of information, even for optional fields
2. Dates: Use YYYY-MM format (e.g., 2023-08 for August 2023)
3. URLs: Include full URLs with https:// prefix
4. Locations: Use "City, State" format when possible

SECTION HINTS:
- certifications: Look for Certifications, Licenses, Courses, Awards, Achievements, Honors, Competitions
- projects: Extract technologies/tools mentioned in project descriptions into the technologies array
- education: Always include graduation_date (expected or completed)
- skills: Group into logical categories (e.g., Programming Languages, Frameworks, Tools)

IMPORTANT:
- Do NOT omit optional sections if data exists in the resume
- If unsure about a field, make a best-effort extraction rather than omitting
- Only use empty arrays for truly absent sections
- Return ONLY valid JSON matching the schema`;

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
    const error = await response.text();
    return { success: false, text: "", pageCount: 0, error };
  }

  return response.json() as Promise<PdfExtractResponse>;
}

/**
 * Parse text with AI using ai-parser-worker
 */
async function parseWithAi(text: string, env: Partial<CloudflareEnv>): Promise<AiParseResponse> {
  const worker = env.AI_PARSER_WORKER;
  if (!worker) {
    return { success: false, data: null, error: "AI parser not available" };
  }

  const response = await worker.fetch("https://internal/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      schema: RESUME_EXTRACTION_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
      model: "google/gemini-2.5-flash-lite",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, data: null, error };
  }

  return response.json() as Promise<AiParseResponse>;
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

    // Step 3: Transform and return
    const transformed = transformGeminiOutput(parseResult.data as ResumeSchema);

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
