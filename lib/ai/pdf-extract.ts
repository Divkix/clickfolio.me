import { Effect } from "effect";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { PdfInvalid } from "../parse/failures";
import { detectResumeSource, type PdfInfo, type ResumeSource } from "./linkedin";

export function isValidPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));

  return String.fromCharCode(...header).startsWith("%PDF-");
}

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  source: ResumeSource;
}

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

const pdfInfoSchema = z.object({
  Author: z.string().optional().catch(undefined),
  Subject: z.string().optional().catch(undefined),
});

function readPdfInfo(pdf: PdfDocument): Effect.Effect<PdfInfo> {
  return Effect.tryPromise({
    try: () => pdf.getMetadata(),
    catch: () => null,
  }).pipe(
    Effect.map(({ info }) => {
      const parsed = pdfInfoSchema.safeParse(info);

      return parsed.success ? { author: parsed.data.Author, subject: parsed.data.Subject } : {};
    }),
    // Metadata is only a detection hint; text detection still runs without it.
    Effect.catch(() => Effect.succeed({})),
  );
}

function pdfFailure(cause: unknown): PdfInvalid {
  const message = cause instanceof Error ? cause.message : String(cause);
  const encrypted = /password|encrypted/i.test(message);

  return new PdfInvalid({
    message: encrypted
      ? "This PDF is password-protected. Please upload an unprotected version."
      : /invalid pdf|corrupt|not a pdf/i.test(message)
        ? "This PDF appears to be corrupted. Please upload a valid PDF file."
        : message || "PDF extraction failed",
    reason: encrypted ? "encrypted" : "corrupt",
    cause,
  });
}

export function extractPdfTextEffect(buffer: ArrayBuffer): Effect.Effect<ExtractedPdf, PdfInvalid> {
  return Effect.gen(function* () {
    if (!isValidPdf(buffer)) {
      return yield* new PdfInvalid({ message: "Invalid PDF format", reason: "corrupt" });
    }

    // pdf.js transfers/detaches its input; preserve the original for vision.
    const pdf = yield* Effect.tryPromise({
      try: () => getDocumentProxy(new Uint8Array(buffer.slice(0))),
      catch: pdfFailure,
    });

    if (pdf.numPages > 50) {
      return yield* new PdfInvalid({
        message: `PDF has ${pdf.numPages} pages (maximum 50). Please upload a shorter document.`,
        reason: "too-many-pages",
        pageCount: pdf.numPages,
      });
    }

    const { text, totalPages } = yield* Effect.tryPromise({
      try: () => extractText(pdf, { mergePages: true }),
      catch: pdfFailure,
    });

    const info = yield* readPdfInfo(pdf);

    return {
      text: text ?? "",
      pageCount: totalPages,
      source: detectResumeSource(text ?? "", info),
    };
  });
}
