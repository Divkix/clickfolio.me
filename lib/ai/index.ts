import { Effect } from "effect";
import { z } from "zod";
import { resumeContentSchema } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import type { JsonValue } from "@/lib/types/json";
import { log } from "@/lib/utils/log";
import { AiOutputInvalid, PdfInvalid, SchemaRejected, type ParseFailure } from "../parse/failures";
import { coerceRecord } from "./ai-normalize";
import { parseWithAiEffect } from "./ai-parser";
import { cleanLinkedInText } from "./linkedin";
import { extractPdfTextEffect, type ExtractedPdf } from "./pdf-extract";
import { truncateResumeText } from "./truncate";
import { transformAiOutput, transformAiResponse } from "./transform";

function normalizeResumeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateParseResult(
  data: JsonValue,
): Effect.Effect<ResumeContent, SchemaRejected | AiOutputInvalid> {
  return Effect.gen(function* () {
    // transformAiResponse can mutate its input; capture the original for feedback.
    const previousOutput = JSON.stringify(data);

    const withDefaults = yield* Effect.try({
      try: () => transformAiResponse(data),
      catch: (cause) => new AiOutputInvalid({ message: "Invalid AI resume fields", cause }),
    });

    for (const key of ["education", "skills", "certifications", "projects"]) {
      if (!Array.isArray(withDefaults[key])) withDefaults[key] = [];
    }

    const result = resumeContentSchema.safeParse(withDefaults);

    if (!result.success) {
      return yield* Effect.fail(
        new SchemaRejected({
          message: "AI response failed schema validation",
          previousOutput,
          errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
        }),
      );
    }

    return transformAiOutput(result.data);
  });
}

function validateWithFeedback(
  data: JsonValue,
  text: string,
  env: Partial<CloudflareEnv>,
  vision = false,
) {
  return validateParseResult(data).pipe(
    Effect.catchTag("SchemaRejected", (failure) => {
      log(
        "warn",
        vision
          ? "Vision schema validation failed, retrying with error feedback"
          : "Schema validation failed, retrying with error feedback",
        { errors: failure.errors },
      );

      return parseWithAiEffect(text, env, undefined, {
        previousOutput: failure.previousOutput ?? "",
        errors: failure.errors ?? "",
      }).pipe(
        Effect.flatMap(validateParseResult),
        // Retain the original validation failure when the feedback attempt also
        // produces unusable output. Provider and timeout failures stay retryable
        // so the Workflow can retry the step instead of failing the upload.
        Effect.catchTags({
          SchemaRejected: () => Effect.fail(failure),
          AiOutputInvalid: () => Effect.fail(failure),
        }),
        Effect.tap(() =>
          Effect.sync(() =>
            log(
              "info",
              vision
                ? "Vision retry with error feedback succeeded"
                : "Retry with error feedback succeeded",
            ),
          ),
        ),
      );
    }),
  );
}

function parseExtractedPdf(
  extracted: ExtractedPdf,
  pdfBuffer: ArrayBuffer,
  env: Partial<CloudflareEnv>,
): Effect.Effect<ResumeContent, ParseFailure> {
  const textPath = Effect.gen(function* () {
    const rawText = extracted.text.trim();

    if (extracted.pageCount > 0 && rawText.length < extracted.pageCount * 30) {
      return yield* new PdfInvalid({
        message: "Scanned PDF requires vision extraction",
        reason: "scanned-empty",
      });
    }

    const sourceText =
      extracted.source === "linkedin" ? cleanLinkedInText(extracted.text) : extracted.text;

    const resumeText = truncateResumeText(normalizeResumeText(sourceText));

    if (!resumeText.trim())
      return yield* new PdfInvalid({ message: "Extracted resume text is empty", reason: "empty" });

    if (extracted.source === "linkedin") log("info", "LinkedIn profile export detected");

    const data = yield* parseWithAiEffect(resumeText, env, undefined, undefined, extracted.source);

    return yield* validateWithFeedback(data, resumeText, env);
  });

  return textPath.pipe(
    Effect.catchTag("PdfInvalid", (failure) => {
      if (failure.reason !== "scanned-empty") return Effect.fail(failure);

      return Effect.gen(function* () {
        log("info", "scanned PDF detected, falling back to Luna vision", {
          pageCount: extracted.pageCount,
          charCount: extracted.text.trim().length,
        });
        // Preserve lazy vision loading and the original, undetached PDF bytes.
        const { parsePdfWithVisionEffect } = yield* Effect.promise(() => import("./ai-vision"));
        const data = yield* parsePdfWithVisionEffect(pdfBuffer, env);
        const raw = coerceRecord(data) ?? {};
        const name = z.string().safeParse(raw.full_name);
        const hasName = name.success && name.data.trim().length > 0;
        const hasExperience = Array.isArray(raw.experience) && raw.experience.length > 0;

        if (!hasName && !hasExperience) {
          return yield* new PdfInvalid({
            message:
              "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.",
            reason: "scanned-empty",
          });
        }

        return yield* validateWithFeedback(data, "", env, true);
      });
    }),
  );
}

export function parseResumeWithAi(
  pdfBuffer: ArrayBuffer,
  env: Partial<CloudflareEnv>,
): Effect.Effect<ResumeContent, ParseFailure> {
  return extractPdfTextEffect(pdfBuffer).pipe(
    Effect.flatMap((extracted) => parseExtractedPdf(extracted, pdfBuffer, env)),
  );
}
