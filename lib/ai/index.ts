import { parseWithAi } from "./ai-parser";
import { extractPdfText } from "./pdf-extract";
import { type ResumeSchema, resumeSchema } from "./schema";
import { transformAiOutput, transformAiResponse } from "./transform";

export interface ParseResumeResult {
  success: boolean;
  parsedContent: string;
  error?: string;
}

const MAX_RESUME_TEXT_CHARS = 60000;
const RESUME_HEAD_CHARS = 38000;
const RESUME_TAIL_CHARS = 18000;
const RESUME_TRUNCATION_MARKER = "\n\n...[truncated]...\n\n";

function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateResumeText(text: string): string {
  if (text.length <= MAX_RESUME_TEXT_CHARS) return text;
  const head = text.slice(0, RESUME_HEAD_CHARS);
  const tail = text.slice(-RESUME_TAIL_CHARS);
  return `${head}${RESUME_TRUNCATION_MARKER}${tail}`;
}

function validateParseResult(data: unknown): {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: string;
} {
  const transformed = transformAiResponse(data);
  const withDefaults = transformed as Record<string, unknown>;
  for (const key of ["education", "skills", "certifications", "projects"]) {
    if (!Array.isArray(withDefaults[key])) withDefaults[key] = [];
  }
  const result = resumeSchema.safeParse(withDefaults);
  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
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
    let validation = validateParseResult(parseResult.data);

    // Step 3b: Retry with error feedback if validation failed
    if (!validation.success && validation.errors) {
      console.warn("[ai-parse] Schema validation failed, retrying with error feedback", {
        errors: validation.errors,
      });

      const retryResult = await parseWithAi(resumeText, env, undefined, {
        previousOutput: JSON.stringify(parseResult.data),
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
    const finalData = transformAiOutput(validation.data as ResumeSchema);

    return {
      success: true,
      parsedContent: JSON.stringify(finalData),
    };
  } catch (error) {
    return {
      success: false,
      parsedContent: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
