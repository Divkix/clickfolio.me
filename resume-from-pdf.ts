import OpenAI from "openai";
import { extractText, getDocumentProxy } from "unpdf";

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

type Provider = "openai" | "openrouter" | "custom";
type OutputMode = "json" | "pretty";

type Args = {
  pdfPath: string;
  provider: Provider;
  api: "responses" | "chat";
  model: string;
  baseURL?: string;
  outPath?: string;
  mode: OutputMode;
  maxChars: number;
};

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: bun run resume-from-pdf.ts <file.pdf> [--provider openai|openrouter|custom] [--api responses|chat] [--model <id>] [--base-url <url>] [--out out.json] [--mode json|pretty] [--max-chars 60000]",
    );
    process.exit(1);
  }

  const out: Args = {
    pdfPath: args[0]!,
    provider: "openrouter",
    api: "chat",
    model: "google/gemini-2.5-flash-lite",
    mode: "json",
    maxChars: 60000,
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];

    if (a === "--provider" && next) out.provider = next as Provider;
    if (a === "--api" && next) out.api = next as "responses" | "chat";
    if (a === "--model" && next) out.model = next;
    if (a === "--base-url" && next) out.baseURL = next;
    if (a === "--out" && next) out.outPath = next;
    if (a === "--mode" && next) out.mode = next as OutputMode;
    if (a === "--max-chars" && next) out.maxChars = Number(next);

    if (
      a === "--provider" ||
      a === "--api" ||
      a === "--model" ||
      a === "--base-url" ||
      a === "--out" ||
      a === "--mode" ||
      a === "--max-chars"
    ) {
      i++;
    }
  }

  return out;
}

function buildClient(provider: Provider, baseURL?: string) {
  if (provider === "openai") {
    // Uses OPENAI_API_KEY by default (OpenAI SDK reads env).
    return new OpenAI();
  }

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENROUTER_API_KEY for --provider openrouter");
    }

    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      // Optional attribution headers (nice-to-have for OpenRouter).
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "",
        "X-Title": process.env.OPENROUTER_APP_TITLE ?? "",
      },
    });
  }

  // custom OpenAI-compatible endpoint
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LLM_API_KEY for --provider custom");
  }
  if (!baseURL) {
    throw new Error("Missing --base-url for --provider custom");
  }

  return new OpenAI({ baseURL, apiKey });
}

async function extractPdfText(pdfPath: string) {
  const ab = await Bun.file(pdfPath).arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(ab));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text ?? "", totalPages };
}

function clampText(s: string, maxChars: number) {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n[TRUNCATED]`;
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    // Try to salvage JSON if the model wraps it in text (rare with strict schema, but possible on non-supporting providers).
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

/**
 * Post-processing transforms to normalize LLM output quirks.
 * Handles: website→linkedin, empty strings, year format normalization.
 */
function transformResumeOutput(raw: any): any {
  const result = structuredClone(raw);

  // 1. Normalize contact - move website to linkedin if it contains linkedin.com
  if (result.contact) {
    // If website contains linkedin.com and linkedin is not set, move it
    if (
      result.contact.website?.includes("linkedin.com") &&
      !result.contact.linkedin
    ) {
      result.contact.linkedin = result.contact.website;
      delete result.contact.website;
    }

    // Ensure linkedin/github/website URLs have https:// prefix
    for (const field of ["linkedin", "github", "website"] as const) {
      if (result.contact[field] && !result.contact[field].startsWith("http")) {
        result.contact[field] = `https://${result.contact[field]}`;
      }
    }

    // Remove empty strings from contact
    for (const key of Object.keys(result.contact)) {
      if (result.contact[key] === "") {
        delete result.contact[key];
      }
    }
  }

  // 2. Normalize project years to just the starting year
  // Handles: "2023-2023" → "2023", "2023-12" → "2023", "Aug 2023 – Dec 2023" → "2023"
  if (Array.isArray(result.projects)) {
    for (const project of result.projects) {
      if (project.year) {
        const yearMatch = project.year.match(/(\d{4})/);
        if (yearMatch) {
          project.year = yearMatch[1];
        }
      }
    }
  }

  // 3. Remove empty location strings from experience
  if (Array.isArray(result.experience)) {
    for (const exp of result.experience) {
      if (exp.location === "") {
        delete exp.location;
      }
    }
  }

  // 4. Remove empty strings from education (location, gpa)
  if (Array.isArray(result.education)) {
    for (const edu of result.education) {
      if (edu.location === "") delete edu.location;
      if (edu.gpa === "") delete edu.gpa;
    }
  }

  // 5. Remove empty arrays
  for (const key of ["skills", "certifications", "projects", "education"]) {
    if (Array.isArray(result[key]) && result[key].length === 0) {
      delete result[key];
    }
  }

  // 6. Remove duplicate website if same as linkedin
  if (result.contact?.website === result.contact?.linkedin) {
    delete result.contact.website;
  }

  // 7. Trim whitespace from all string fields (recursive)
  trimStrings(result);

  return result;
}

function trimStrings(obj: any): void {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const item of obj) trimStrings(item);
  } else if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].trim();
      } else {
        trimStrings(obj[key]);
      }
    }
  }
}

function renderPretty(resume: any) {
  const lines: string[] = [];

  lines.push(`# ${resume.full_name ?? ""}`.trim());
  if (resume.headline) lines.push(resume.headline);
  lines.push("");

  if (resume.contact) {
    lines.push("## Contact");
    const c = resume.contact;
    const parts = [
      c.email ? `Email: ${c.email}` : null,
      c.phone ? `Phone: ${c.phone}` : null,
      c.location ? `Location: ${c.location}` : null,
      c.linkedin ? `LinkedIn: ${c.linkedin}` : null,
      c.github ? `GitHub: ${c.github}` : null,
      c.website ? `Website: ${c.website}` : null,
    ].filter(Boolean);
    lines.push(parts.join("\n"));
    lines.push("");
  }

  if (resume.summary) {
    lines.push("## Summary");
    lines.push(resume.summary);
    lines.push("");
  }

  if (Array.isArray(resume.experience) && resume.experience.length) {
    lines.push("## Experience");
    for (const e of resume.experience) {
      const dates = [e.start_date, e.end_date].filter(Boolean).join(" – ");
      lines.push(`### ${e.title ?? ""} | ${e.company ?? ""}`.trim());
      const meta = [dates || null, e.location || null].filter(Boolean).join(" | ");
      if (meta) lines.push(meta);
      if (e.description) lines.push(e.description);
      if (Array.isArray(e.highlights) && e.highlights.length) {
        for (const h of e.highlights) lines.push(`- ${h}`);
      }
      lines.push("");
    }
  }

  if (Array.isArray(resume.education) && resume.education.length) {
    lines.push("## Education");
    for (const ed of resume.education) {
      const meta = [
        ed.institution || null,
        ed.location || null,
        ed.graduation_date || null,
        ed.gpa ? `GPA: ${ed.gpa}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`- ${ed.degree}${meta ? ` (${meta})` : ""}`);
    }
    lines.push("");
  }

  if (Array.isArray(resume.skills) && resume.skills.length) {
    lines.push("## Skills");
    for (const s of resume.skills) {
      const items = Array.isArray(s.items) ? s.items.join(", ") : "";
      lines.push(`- ${s.category}: ${items}`);
    }
    lines.push("");
  }

  if (Array.isArray(resume.certifications) && resume.certifications.length) {
    lines.push("## Certifications");
    for (const c of resume.certifications) {
      const meta = [c.issuer || null, c.date || null, c.url || null].filter(Boolean).join(" | ");
      lines.push(`- ${c.name}${meta ? ` (${meta})` : ""}`);
    }
    lines.push("");
  }

  if (Array.isArray(resume.projects) && resume.projects.length) {
    lines.push("## Projects");
    for (const p of resume.projects) {
      const meta = [p.year || null, p.url || null].filter(Boolean).join(" | ");
      lines.push(`- ${p.title}${meta ? ` (${meta})` : ""}`);
      if (p.description) lines.push(`  - ${p.description}`);
      if (Array.isArray(p.technologies) && p.technologies.length) {
        lines.push(`  - Tech: ${p.technologies.join(", ")}`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function toSchemaJson({
  client,
  api,
  model,
  resumeText,
}: {
  client: OpenAI;
  api: "responses" | "chat";
  model: string;
  resumeText: string;
}) {
  const system = `You are an expert resume parser. Extract ALL available information from the resume into the JSON schema.

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

  if (api === "responses") {
    // Responses API uses text.format for structured outputs.  [oai_citation:2‡OpenAI Platform](https://platform.openai.com/docs/guides/structured-outputs)
    const resp = await client.responses.create({
      model,
      temperature: 0,
      max_output_tokens: 4096,
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Resume text:\n\n${resumeText}\n\nExtract ALL information thoroughly. Do not skip any sections.`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "resume_extraction",
          strict: true,
          schema: RESUME_EXTRACTION_SCHEMA as any,
        },
      },
    });

    const raw = resp.output_text ?? "";
    return safeJsonParse(raw);
  }

  // Chat Completions supports response_format json_schema.  [oai_citation:3‡OpenAI Platform](https://platform.openai.com/docs/api-reference/chat)
  const resp = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 4096,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Resume text:\n\n${resumeText}\n\nExtract ALL information thoroughly. Do not skip any sections.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "resume_extraction",
        strict: true,
        schema: RESUME_EXTRACTION_SCHEMA as any,
      },
    },
  });

  const raw = resp.choices?.[0]?.message?.content ?? "";
  return safeJsonParse(raw);
}

async function main() {
  const a = parseArgs(process.argv);
  const client = buildClient(a.provider, a.baseURL);

  const { text, totalPages } = await extractPdfText(a.pdfPath);
  if (!text.trim()) {
    console.error(
      `No selectable text found in PDF (pages=${totalPages}). If this is scanned, you need OCR.`,
    );
    process.exit(2);
  }

  const resumeText = clampText(text, a.maxChars);

  const rawJson = await toSchemaJson({
    client,
    api: a.api,
    model: a.model,
    resumeText,
  });

  // Apply post-processing transforms
  const json = transformResumeOutput(rawJson);

  const output = a.mode === "pretty" ? renderPretty(json) : `${JSON.stringify(json, null, 2)}\n`;

  if (a.outPath) {
    await Bun.write(a.outPath, output);
    console.log(`Wrote: ${a.outPath}`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
