import { type ResumeContentFormData, resumeContentSchema } from "@/lib/schemas/resume";
import type { JsonValue, UnknownRecord } from "@/lib/types/json";
import { parseWithAi } from "./ai-parser";
import { extractPdfText } from "./pdf-extract";
import { truncateResumeText } from "./truncate";
import { transformAiOutput, transformAiResponse } from "./transform";

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
 * Single universal path: always run the full `transformAiResponse` pipeline
 * (garbage filtering, caps, URL validation) before Zod validation.
 * Returns `{ success: true, data }` or `{ success: false, errors }`.
 */
function validateParseResult(data: JsonValue): ValidateParseResult {
  const withDefaults: UnknownRecord = transformAiResponse(data);

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
    let validation = validateParseResult(parseResult.data);

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
