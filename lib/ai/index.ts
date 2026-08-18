import { type ResumeContentFormData, resumeContentSchema } from "@/lib/schemas/resume";
import type { JsonValue, UnknownRecord } from "@/lib/types/json";
import { log } from "@/lib/utils/log";
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

function extractProfessionalLevel(data: UnknownRecord): string | undefined {
  // eslint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-unsafe-dictionary-type -- dynamic professional_level access
  const raw = (data as unknown as Record<string, unknown>)["professional_level"];
  // eslint-disable-next-line anti-slop/no-runtime-typeof -- runtime string check for optional professional_level
  const level = typeof raw === "string" ? raw : undefined;
  // eslint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-unsafe-dictionary-type -- delete requires record narrow
  delete (data as unknown as Record<string, unknown>)["professional_level"];
  return level;
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

    // Scanned-image fallback: unpdf returns empty/short text but pageCount>0.
    // No new infra — reuse same Luna model via inline file part (ai-vision.ts).
    const rawText = extractResult.text ?? "";
    const trimmedForScanCheck = rawText.trim();
    const MIN_CHARS_PER_PAGE = 30;
    const VISION_MAX_PAGES = 50;
    const isScanned =
      extractResult.success &&
      extractResult.pageCount > 0 &&
      (trimmedForScanCheck.length === 0 ||
        trimmedForScanCheck.length < extractResult.pageCount * MIN_CHARS_PER_PAGE);

    if (isScanned) {
      log("info", "scanned PDF detected, falling back to Luna vision", {
        pageCount: extractResult.pageCount,
        charCount: trimmedForScanCheck.length,
      });
      if (extractResult.pageCount > VISION_MAX_PAGES) {
        return {
          success: false,
          parsedContent: "",
          error: `Scanned PDF has ${extractResult.pageCount} pages (maximum ${VISION_MAX_PAGES} for scanned). Please upload a shorter document or export as text PDF.`,
        };
      }

      try {
        // Lazy-load vision: scanned PDFs are rare; keep unpdf/text path bundle small.
        // Dynamic import avoids bundling `ai` file-part handling into page/queue hot paths (same pattern as consumer.ts lazy AI import).
        const { parsePdfWithVision } = await import("./ai-vision");
        const visionResult = await parsePdfWithVision(pdfBuffer, env);

        if (visionResult.success && visionResult.data) {
          // Hallucination guard: Luna vision never returns "" — it invents JSON.
          // If core fields are both empty, treat as OCR failure, not success.
          // eslint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-unsafe-dictionary-type -- JsonValue to UnknownRecord for hallucination check
          const raw = visionResult.data as unknown as UnknownRecord;
          const fullNameUnknown = raw["full_name"];
          // eslint-disable-next-line anti-slop/no-runtime-typeof -- runtime string check for hallucination guard
          const hasName = typeof fullNameUnknown === "string" && fullNameUnknown.trim().length > 0;
          const expUnknown = raw["experience"];
          const hasExp = Array.isArray(expUnknown) && expUnknown.length > 0;
          if (!hasName && !hasExp) {
            return {
              success: false,
              parsedContent: "",
              error:
                "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.",
            };
          }
          const dataForRetry = structuredClone(visionResult.data);
          let validation = validateParseResult(visionResult.data);

          if (!validation.success && validation.errors) {
            log("warn", "Vision schema validation failed, retrying with error feedback", {
              errors: validation.errors,
            });
            // Reuse text error-feedback path by feeding vision JSON as previousOutput.
            // Resume text is empty for scanned, so retry uses vision output + errors only.
            const retryResult = await parseWithAi("", env, undefined, {
              previousOutput: JSON.stringify(dataForRetry),
              errors: validation.errors,
            });
            if (retryResult.success && retryResult.data) {
              validation = validateParseResult(retryResult.data);
              if (validation.success) log("info", "Vision retry with error feedback succeeded");
            }
          }

          if (!validation.success) {
            return {
              success: false,
              parsedContent: "",
              error: "AI response failed schema validation",
            };
          }
          // SAFETY: validation guarantees ResumeContentFormData shape; cast preserves type for final cleanup
          const finalData = transformAiOutput(validation.data as ResumeContentFormData);
          // eslint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion -- helper handles dynamic access
          const professionalLevel = extractProfessionalLevel(finalData as unknown as UnknownRecord);
          return {
            success: true,
            parsedContent: JSON.stringify(finalData),
            professionalLevel,
          };
        }

        return {
          success: false,
          parsedContent: "",
          error:
            visionResult.error ||
            "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.",
        };
      } catch (error) {
        return {
          success: false,
          parsedContent: "",
          error: error instanceof Error ? error.message : "Vision parsing failed",
        };
      }
    }

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
      log("warn", "Schema validation failed, retrying with error feedback", {
        errors: validation.errors,
      });

      const retryResult = await parseWithAi(resumeText, env, undefined, {
        previousOutput: JSON.stringify(dataForRetry),
        errors: validation.errors,
      });

      if (retryResult.success && retryResult.data) {
        validation = validateParseResult(retryResult.data);
        if (validation.success) log("info", "Retry with error feedback succeeded");
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
    // eslint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion -- helper handles dynamic access
    const professionalLevel2 = extractProfessionalLevel(finalData as unknown as UnknownRecord);
    return {
      success: true,
      parsedContent: JSON.stringify(finalData),
      professionalLevel: professionalLevel2,
    };
  } catch (error) {
    return {
      success: false,
      parsedContent: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
