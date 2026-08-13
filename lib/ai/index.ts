import { type ResumeContentFormData, resumeContentSchema } from "@/lib/schemas/resume";
import { z } from "zod";
import type { JsonValue, UnknownRecord } from "@/lib/types/json";
import { sanitizeEmail } from "@/lib/utils/sanitization";
import { parseWithAi } from "./ai-parser";
import { extractPdfText } from "./pdf-extract";
import { truncateResumeText } from "./truncate";
import { normalizeEndDate, transformAiOutput, transformAiResponse, validateUrl } from "./transform";

/**
 * Result shape from AI resume parsing.
 * Contains the serialized JSON string, an optional error message, and an optional
 * inferred professional level (e.g. "entry_level", "mid_level", "senior_level").
 */
export interface ParseResumeResult {
  success: boolean;
  parsedContent: string;
  error?: string;
  professionalLevel?: string;
}

/**
 * Normalize extracted PDF text for consistent AI input.
 * Converts CRLF to LF, collapses extra spaces/tabs, and trims.
 */
function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ValidateParseResult =
  | { success: true; data: UnknownRecord }
  | { success: false; errors: string };

/**
 * Validate AI-parsed data against the resume content schema.
 *
 * Dual-path logic:
 * - **Structured output**: schema was already enforced by the AI SDK; only apply
 *   lightweight security sanitization (URL validation, email sanitization, end-date
 *   normalization) and inject default empty arrays.
 * - **Fallback path**: run the full `transformAiResponse` pipeline (garbage filtering,
 *   truncation, URL validation) before Zod validation.
 *
 * Returns `{ success: true, data }` or `{ success: false, errors }` with
 * human-readable Zod issue messages.
 */
function validateParseResult(data: JsonValue, structuredOutput?: boolean): ValidateParseResult {
  let withDefaults: UnknownRecord;

  if (structuredOutput) {
    // Structured output was schema-validated by the SDK — skip heavy transformAiResponse.
    // Only apply lightweight security sanitization.
    // SAFETY: object guard above ensures data is a non-null object; UnknownRecord is the safe JSON object type for validated AI output. Outer cast preserves UnknownRecord after conditional default.
    withDefaults = (
      data instanceof Object &&
      !Array.isArray(data) &&
      z.record(z.string(), z.unknown()).safeParse(data).success
        ? { ...(data as UnknownRecord) }
        : {}
    ) as UnknownRecord;

    // Security: validate URLs to block javascript: protocol
    if (
      withDefaults.contact &&
      withDefaults.contact instanceof Object &&
      !Array.isArray(withDefaults.contact)
    ) {
      // SAFETY: object guard above ensures withDefaults.contact is a non-null object; UnknownRecord is safe for security sanitization of AI contact fields.
      const c = withDefaults.contact as UnknownRecord;
      for (const urlField of ["linkedin", "github", "website", "behance", "dribbble"]) {
        if (c[urlField]) c[urlField] = validateUrl(c[urlField]);
      }
      if (c.email) {
        // SAFETY: truthy guard above ensures c.email is present and AI-normalized to string; cast preserves string type for sanitization.
        c.email = sanitizeEmail(c.email as string);
      }
    }

    // Normalize "Present"/"Current" end dates
    if (Array.isArray(withDefaults.experience)) {
      // SAFETY: Array.isArray guard above ensures withDefaults.experience is an array; UnknownRecord[] is the safe type for AI experience entries.
      for (const exp of withDefaults.experience as UnknownRecord[]) {
        if (exp.end_date) exp.end_date = normalizeEndDate(exp.end_date);
      }
    }
  } else {
    // Fallback path: full transformation with garbage filtering and truncation
    const transformed = transformAiResponse(data);
    withDefaults = transformed;
  }

  // Inject default empty arrays for optional fields
  for (const key of ["education", "skills", "certifications", "projects"]) {
    if (!Array.isArray(withDefaults[key])) withDefaults[key] = [];
  }

  const result = resumeContentSchema.safeParse(withDefaults);
  if (result.success) {
    // SAFETY: resumeContentSchema.safeParse success guarantees result.data matches ResumeContent shape; UnknownRecord is the safe JSON representation for validated resume data.
    return { success: true, data: result.data as UnknownRecord };
  }
  const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  return { success: false, errors };
}

/**
 * Parse a PDF resume using AI
 *
 * Pipeline:
 * 1. Extract text from PDF using unpdf
 * 2. Parse text with AI using Vercel AI SDK (structured output)
 * 3. Transform and validate the AI response
 * 4. Return JSON string of parsed content
 *
 * Accepts ArrayBuffer directly from R2 to avoid intermediate buffer copies.
 */
export async function parseResumeWithAi(
  pdfBuffer: ArrayBuffer,
  env: Partial<CloudflareEnv>,
): Promise<ParseResumeResult> {
  try {
    // Step 1: Extract text from PDF — pass ArrayBuffer directly, no copies
    const extractResult = await extractPdfText(pdfBuffer);

    if (!extractResult.success || !extractResult.text) {
      return {
        success: false,
        parsedContent: "",
        error: extractResult.error || "PDF extraction failed",
      };
    }

    const normalizedText = normalizeResumeText(extractResult.text);
    const resumeText = truncateResumeText(normalizedText);

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

    // Step 3: Validate (transform → defaults → Zod)
    // Clone data before validation — transformAiResponse mutates in-place,
    // and we need the original for retry context if validation fails
    const dataForRetry = structuredClone(parseResult.data);
    let validation = validateParseResult(parseResult.data, parseResult.structuredOutput);

    // Step 3b: Retry with error feedback if validation failed
    if (!validation.success && validation.errors) {
      console.warn("[ai-parse] Schema validation failed, retrying with error feedback", {
        errors: validation.errors,
      });

      const retryResult = await parseWithAi(resumeText, env, undefined, {
        previousOutput: JSON.stringify(dataForRetry),
        errors: validation.errors,
      });

      if (retryResult.success && retryResult.data) {
        validation = validateParseResult(retryResult.data);
        if (validation.success) {
          console.info("[ai-parse] Retry with error feedback succeeded");
        }
      }
    }

    if (!validation.success) {
      return {
        success: false,
        parsedContent: "",
        error: "AI response failed schema validation",
      };
    }

    // Step 4: Final cleanup
    // SAFETY: resumeContentSchema validation above guarantees validation.data matches ResumeContentFormData; cast preserves type for final cleanup.
    const finalData = transformAiOutput(validation.data as ResumeContentFormData);

    // Extract professional_level before serializing — it goes to user.role, not siteData.content
    // SAFETY: professional_level is an optional string field from AI extraction; string | undefined is the correct union for role level extraction.
    const professionalLevel = finalData.professional_level as string | undefined;
    delete finalData.professional_level;

    return {
      success: true,
      parsedContent: JSON.stringify(finalData),
      professionalLevel,
    };
  } catch (error) {
    return {
      success: false,
      parsedContent: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
