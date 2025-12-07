import Replicate from "replicate";
import { z } from "zod";
import type { ResumeContent } from "@/lib/types/database";
import type { CloudflareEnv } from "./cloudflare-env";
import { ENV } from "./env";

// Singleton client cache
let _replicate: Replicate | null = null;
let _lastGatewayId: string | null = null;
let _lastGatewayToken: string | null = null;

/**
 * Get env value with Cloudflare binding fallback to ENV helpers
 *
 * Note: CF_AIG_AUTH_TOKEN is required for Cloudflare AI Gateway's "Authenticated Gateway" feature.
 * The gateway requires TWO auth headers:
 * - Authorization: Bearer {REPLICATE_API_TOKEN} - for the upstream Replicate API
 * - cf-aig-authorization: Bearer {CF_AIG_AUTH_TOKEN} - for the gateway itself
 * See: https://developers.cloudflare.com/ai-gateway/configuration/authentication/
 */
function getEnvValue(
  env: Partial<CloudflareEnv> | undefined,
  key:
    | "CF_AI_GATEWAY_ACCOUNT_ID"
    | "CF_AI_GATEWAY_ID"
    | "CF_AIG_AUTH_TOKEN"
    | "REPLICATE_API_TOKEN",
): string {
  if (env) {
    const cfValue = env[key];
    if (typeof cfValue === "string" && cfValue.trim() !== "") {
      return cfValue;
    }
  }
  // Fall back to ENV helper (which uses process.env)
  return ENV[key]();
}

/**
 * Get Replicate client instance
 *
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Configured Replicate client routed through AI Gateway
 */
function getReplicate(env?: Partial<CloudflareEnv>): Replicate {
  const accountId = getEnvValue(env, "CF_AI_GATEWAY_ACCOUNT_ID");
  const gatewayId = getEnvValue(env, "CF_AI_GATEWAY_ID");
  const gatewayToken = getEnvValue(env, "CF_AIG_AUTH_TOKEN");
  const replicateToken = getEnvValue(env, "REPLICATE_API_TOKEN");

  // Invalidate cache if gateway config changed
  if (
    _replicate &&
    (_lastGatewayId !== gatewayId || _lastGatewayToken !== gatewayToken)
  ) {
    _replicate = null;
  }

  if (!_replicate) {
    _replicate = new Replicate({
      auth: replicateToken,
      baseUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/replicate`,
      // Inject cf-aig-authorization header for Cloudflare AI Gateway authentication
      fetch: (url, options) => {
        const headers = new Headers(options?.headers);
        headers.set("cf-aig-authorization", `Bearer ${gatewayToken}`);
        return fetch(url, { ...options, headers });
      },
    });
    _lastGatewayId = gatewayId;
    _lastGatewayToken = gatewayToken;
  }

  return _replicate;
}

/**
 * Clear cached Replicate client (useful for testing)
 */
export function clearReplicateClient(): void {
  _replicate = null;
  _lastGatewayId = null;
  _lastGatewayToken = null;
}

/**
 * Clean email extracted from AI parsing
 * Handles common OCR artifacts and formatting issues
 */
function cleanExtractedEmail(email: string | null | undefined): string {
  if (!email) return "";

  const cleaned = email
    .trim()
    .toLowerCase()
    // Remove common OCR artifacts
    .replace(/\s+/g, "") // Remove all whitespace
    .replace(/[<>[\]{}()]/g, "") // Remove brackets
    .replace(/^mailto:/i, "") // Remove mailto: prefix
    .replace(/[,;:]+$/, "") // Remove trailing punctuation
    .replace(/\.{2,}/g, ".") // Collapse multiple dots
    .replace(/^\.+|\.+$/g, ""); // Remove leading/trailing dots

  // Basic structural validation - must have @ and .
  if (!cleaned.includes("@") || !cleaned.includes(".")) {
    return "";
  }

  return cleaned;
}

// Zod schemas for runtime validation
// NOTE: Email validation here is intentionally lenient compared to lib/schemas/resume.ts
// AI-extracted emails from PDFs often have OCR artifacts (extra spaces, brackets, etc.)
// that would fail strict RFC 5322 validation. We clean and validate loosely here,
// allowing users to fix any issues in the dashboard edit form which uses strict validation.
// See: https://github.com/colinhacks/zod/issues/2961 (Zod email regex strictness)
const ContactSchema = z.object({
  email: z
    .string()
    .nullable()
    .optional()
    .transform((val) => cleanExtractedEmail(val))
    .refine(
      (val) => {
        if (!val) return true; // Allow empty after cleaning (user can add in dashboard)
        // Basic email regex - more lenient than RFC 5322
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      },
      { message: "Invalid email address" },
    ),
  phone: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

const ExperienceItemSchema = z.object({
  title: z
    .string()
    .nullable()
    .transform((val) => val ?? "Position Not Specified"),
  company: z
    .string()
    .nullable()
    .transform((val) => val ?? "Company Not Specified"),
  location: z.string().optional().nullable(),
  start_date: z
    .string()
    .nullable()
    .transform((val) => val ?? "Date Not Specified"),
  end_date: z.string().optional().nullable(),
  description: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val ?? ""),
  highlights: z.array(z.string()).optional().nullable(),
});

const EducationItemSchema = z.object({
  degree: z
    .string()
    .nullable()
    .transform((val) => val ?? "Degree Not Specified"),
  institution: z
    .string()
    .nullable()
    .transform((val) => val ?? "Institution Not Specified"),
  location: z.string().optional().nullable(),
  graduation_date: z.string().optional().nullable(),
  gpa: z.string().optional().nullable(),
});

const SkillCategorySchema = z.object({
  category: z
    .string()
    .nullable()
    .transform((val) => val ?? "Uncategorized"),
  items: z.array(z.string()),
});

const CertificationSchema = z.object({
  name: z
    .string()
    .nullable()
    .transform((val) => val ?? "Certification Not Specified"),
  issuer: z
    .string()
    .nullable()
    .transform((val) => val ?? "Issuer Not Specified"),
  date: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});

const ProjectSchema = z.object({
  title: z
    .string()
    .nullable()
    .transform((val) => val ?? "Project Title Not Specified"),
  description: z
    .string()
    .nullable()
    .transform((val) => val ?? ""),
  year: z.string().optional().nullable(),
  technologies: z.array(z.string()).optional().nullable(),
  url: z.string().optional().nullable(),
});

const ResumeContentSchema = z.object({
  full_name: z.string(),
  headline: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  contact: ContactSchema,
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema).optional().nullable(),
  skills: z.array(SkillCategorySchema).optional().nullable(),
  certifications: z.array(CertificationSchema).optional().nullable(),
  projects: z.array(ProjectSchema).optional().nullable(),
});

// JSON schema for Replicate model
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
};

interface ParseResumeResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted";
}

interface ParseStatusResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted";
  output?: {
    extraction_schema_json?: string;
    [key: string]: unknown;
  };
  error?: string;
  logs?: string;
}

/**
 * Trigger AI parsing of a resume PDF
 *
 * @param presignedUrl - R2 presigned GET URL for the PDF file
 * @param webhookUrl - Optional webhook URL for completion notifications
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Prediction object with ID and initial status
 *
 * @example
 * ```ts
 * // In API route with Cloudflare context
 * const { env } = await getCloudflareContext({ async: true });
 * const result = await parseResume(presignedUrl, webhookUrl, env);
 * ```
 */
export async function parseResume(
  presignedUrl: string,
  webhookUrl?: string,
  env?: Partial<CloudflareEnv>,
): Promise<ParseResumeResult> {
  try {
    const replicate = getReplicate(env);
    const prediction = await replicate.predictions.create({
      model: "datalab-to/marker",
      input: {
        file: presignedUrl,
        use_llm: true,
        page_schema: JSON.stringify(RESUME_EXTRACTION_SCHEMA),
      },
      ...(webhookUrl && {
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      }),
    });

    return {
      id: prediction.id,
      status: prediction.status as ParseResumeResult["status"],
    };
  } catch (error) {
    console.error("Failed to start Replicate parsing:", error);
    throw new Error(
      `Replicate API error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Check status of a Replicate parsing job
 *
 * @param predictionId - Replicate prediction ID
 * @param env - Optional Cloudflare env bindings (from getCloudflareContext)
 * @returns Status result with output if completed
 *
 * @example
 * ```ts
 * // In API route with Cloudflare context
 * const { env } = await getCloudflareContext({ async: true });
 * const status = await getParseStatus(predictionId, env);
 * ```
 */
export async function getParseStatus(
  predictionId: string,
  env?: Partial<CloudflareEnv>,
): Promise<ParseStatusResult> {
  try {
    const replicate = getReplicate(env);
    const prediction = await replicate.predictions.get(predictionId);

    return {
      id: prediction.id,
      status: prediction.status as ParseStatusResult["status"],
      output: prediction.output as ParseStatusResult["output"],
      error: prediction.error ? String(prediction.error) : undefined,
      logs: prediction.logs,
    };
  } catch (error) {
    console.error("Failed to get Replicate status:", error);
    throw new Error(
      `Replicate API error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Sanitize URL strings - add https:// if missing, return undefined if invalid
 */
function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url || url === "") return undefined;

  // Try to parse as-is
  try {
    new URL(url);
    return url;
  } catch {
    // Try adding https:// prefix
    try {
      new URL(`https://${url}`);
      return `https://${url}`;
    } catch {
      // Invalid URL even with prefix - return undefined
      return undefined;
    }
  }
}

/**
 * Normalize and validate Replicate output into ResumeContent
 * @param extractionJson - JSON string from Replicate's extraction_schema_json
 * @returns Validated and normalized ResumeContent
 */
export function normalizeResumeData(extractionJson: string): ResumeContent {
  let rawData: unknown;

  // Parse JSON string
  try {
    rawData = JSON.parse(extractionJson);
  } catch (error) {
    throw new Error(
      `Invalid JSON from Replicate: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Validate against schema
  const validationResult = ResumeContentSchema.safeParse(rawData);

  if (!validationResult.success) {
    console.error("Validation errors:", validationResult.error.issues);
    throw new Error(
      `Invalid resume data structure: ${validationResult.error.issues[0]?.message || "Validation failed"}`,
    );
  }

  const data = validationResult.data;

  // Log if AI returned null values that were replaced with defaults
  const hasDefaults = data.experience.some(
    (exp) =>
      exp.title.includes("Not Specified") ||
      exp.company.includes("Not Specified") ||
      exp.start_date.includes("Not Specified"),
  );
  if (hasDefaults) {
    console.warn("AI parsing returned null values - defaults applied to experience entries");
  }

  // Log if email extraction failed
  if (!data.contact.email) {
    console.warn("AI parsing: email extraction failed or was invalid - user can add in dashboard");
  }

  // Apply defaults for nullable fields and sanitize URLs
  const normalized: ResumeContent = {
    full_name: data.full_name,
    headline: data.headline ?? "",
    summary: data.summary ?? "",
    contact: {
      email: data.contact.email || "", // May be empty if AI extraction failed
      phone: data.contact.phone ?? undefined,
      location: data.contact.location ?? undefined,
      linkedin: sanitizeUrl(data.contact.linkedin),
      github: sanitizeUrl(data.contact.github),
      website: sanitizeUrl(data.contact.website),
    },
    experience: data.experience.map((exp) => ({
      title: exp.title,
      company: exp.company,
      location: exp.location ?? undefined,
      start_date: exp.start_date,
      end_date: exp.end_date ?? undefined,
      description: exp.description,
      highlights: exp.highlights ?? undefined,
    })),
    education:
      data.education?.map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        location: edu.location ?? undefined,
        graduation_date: edu.graduation_date ?? undefined,
        gpa: edu.gpa ?? undefined,
      })) ?? undefined,
    skills: data.skills ?? undefined,
    certifications:
      data.certifications?.map((cert) => ({
        name: cert.name,
        issuer: cert.issuer,
        date: cert.date ?? undefined,
        url: sanitizeUrl(cert.url),
      })) ?? undefined,
    projects:
      data.projects?.map((project) => ({
        title: project.title,
        description: project.description,
        year: project.year ?? undefined,
        technologies: project.technologies ?? undefined,
        url: sanitizeUrl(project.url),
      })) ?? undefined,
  };

  // Normalize: Truncate summary to 500 chars
  if (normalized.summary && normalized.summary.length > 500) {
    normalized.summary = `${normalized.summary.substring(0, 497)}...`;
  }

  // Normalize: Limit experience to top 5 items
  if (normalized.experience.length > 5) {
    normalized.experience = normalized.experience.slice(0, 5);
  }

  return normalized;
}
