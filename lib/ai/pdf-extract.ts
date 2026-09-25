import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { detectResumeSource, type PdfInfo, type ResumeSource } from "./linkedin";

export function isValidPdf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  const magic = String.fromCharCode(...header);

  return magic.startsWith("%PDF-");
}

export interface PdfExtractResult {
  success: boolean;
  text: string;
  pageCount: number;
  source: ResumeSource;
  error?: string;
}

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

const pdfInfoSchema = z.object({
  Author: z.string().optional().catch(undefined),
  Subject: z.string().optional().catch(undefined),
});

async function readPdfInfo(pdf: PdfDocument): Promise<PdfInfo> {
  try {
    const { info } = await pdf.getMetadata();
    const parsed = pdfInfoSchema.safeParse(info);

    return parsed.success ? { author: parsed.data.Author, subject: parsed.data.Subject } : {};
  } catch {
    // Metadata is only a detection hint; text-based detection still runs without it.
    return {};
  }
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  if (!isValidPdf(buffer)) {
    return {
      success: false,
      text: "",
      pageCount: 0,
      source: "generic",
      error: "Invalid PDF format",
    };
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    if (pdf.numPages > 50) {
      return {
        success: false,
        text: "",
        pageCount: pdf.numPages,
        source: "generic",
        error: `PDF has ${pdf.numPages} pages (maximum 50). Please upload a shorter document.`,
      };
    }

    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const source = detectResumeSource(text ?? "", await readPdfInfo(pdf));

    return { success: true, text: text ?? "", pageCount: totalPages, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    let userError: string;

    if (/password|encrypted/.test(lower)) {
      userError = "This PDF is password-protected. Please upload an unprotected version.";
    } else if (/invalid pdf|corrupt|not a pdf/.test(lower)) {
      userError = "This PDF appears to be corrupted. Please upload a valid PDF file.";
    } else {
      userError = message || "PDF extraction failed";
    }

    return { success: false, text: "", pageCount: 0, source: "generic", error: userError };
  }
}
