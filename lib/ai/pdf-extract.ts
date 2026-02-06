import { extractText, getDocumentProxy } from "unpdf";

/**
 * Check if buffer starts with PDF magic bytes (%PDF-)
 */
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
  error?: string;
}

/**
 * Extract text from PDF buffer using unpdf
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  if (!isValidPdf(buffer)) {
    return { success: false, text: "", pageCount: 0, error: "Invalid PDF format" };
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    if (pdf.numPages > 50) {
      return {
        success: false,
        text: "",
        pageCount: pdf.numPages,
        error: `PDF has ${pdf.numPages} pages (maximum 50). Please upload a shorter document.`,
      };
    }

    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { success: true, text: text ?? "", pageCount: totalPages };
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

    return { success: false, text: "", pageCount: 0, error: userError };
  }
}
