import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMockCleanup } from "@/__tests__/setup/helpers/test-utils";
import { extractPdfText, isValidPdf } from "@/lib/ai/pdf-extract";

// Mock unpdf module
vi.mock("unpdf", () => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}));

import { extractText, getDocumentProxy } from "unpdf";

setupMockCleanup();

// Helper to create mock PDF with proper typing
function createMockPdf(numPages: number): { numPages: number } {
  return { numPages };
}

describe("isValidPdf", () => {
  it("returns true for valid PDF magic bytes", () => {
    const buffer = new ArrayBuffer(10);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

    expect(isValidPdf(buffer)).toBe(true);
  });

  it("returns false for buffer shorter than 5 bytes", () => {
    const buffer = new ArrayBuffer(3);
    expect(isValidPdf(buffer)).toBe(false);
  });

  it("returns false for non-PDF magic bytes", () => {
    const buffer = new ArrayBuffer(10);
    const view = new Uint8Array(buffer);
    view.set([0x48, 0x54, 0x4d, 0x4c, 0x20]); // "HTML "

    expect(isValidPdf(buffer)).toBe(false);
  });

  it("returns false for empty buffer", () => {
    const buffer = new ArrayBuffer(0);
    expect(isValidPdf(buffer)).toBe(false);
  });

  it("handles PDF version variations", () => {
    const buffer = new ArrayBuffer(10);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"

    expect(isValidPdf(buffer)).toBe(true);
  });
});

describe("extractPdfText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text successfully from valid PDF", async () => {
    const mockPdf = createMockPdf(2);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "Extracted resume text",
      totalPages: 2,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.text).toBe("Extracted resume text");
    expect(result.pageCount).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it("returns error for invalid PDF format", async () => {
    const buffer = new ArrayBuffer(10);
    const view = new Uint8Array(buffer);
    view.set([0x48, 0x54, 0x4d, 0x4c, 0x20]); // "HTML "

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.text).toBe("");
    expect(result.pageCount).toBe(0);
    expect(result.error).toBe("Invalid PDF format");
  });

  it("rejects PDFs exceeding 50 pages", async () => {
    const mockPdf = createMockPdf(51);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.pageCount).toBe(51);
    expect(result.error).toContain("50 pages");
    expect(result.error).toContain("maximum");
  });

  it("accepts PDFs with exactly 50 pages", async () => {
    const mockPdf = createMockPdf(50);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "Valid 50-page document",
      totalPages: 50,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(50);
  });

  it("handles empty PDF with no text", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "",
      totalPages: 1,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.text).toBe("");
    expect(result.pageCount).toBe(1);
  });

  it("handles password-protected PDF", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockRejectedValue(new Error("Password required to decrypt this PDF"));

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain("password-protected");
  });

  it("handles corrupted PDF", async () => {
    vi.mocked(getDocumentProxy).mockRejectedValue(
      new Error("Invalid PDF structure or corrupted data"),
    );

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain("corrupted");
  });

  it("handles generic extraction error", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockRejectedValue(new Error("Unknown extraction error"));

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown extraction error");
  });

  it("merges multiple pages by default", async () => {
    const mockPdf = createMockPdf(3);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "Page 1 content\n\nPage 2 content\n\nPage 3 content",
      totalPages: 3,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.text).toContain("Page 1");
    expect(result.text).toContain("Page 2");
    expect(result.text).toContain("Page 3");
  });

  it("handles non-Error rejection values", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockRejectedValue("String error message");

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toBe("String error message");
  });

  it("handles null rejection value", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockRejectedValue(null);

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toBe("null");
  });

  it("handles undefined text from extractText", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: undefined as unknown as string,
      totalPages: 1,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.text).toBe("");
  });

  it("detects encrypted PDF via error message", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockRejectedValue(
      new Error("This document is encrypted and requires a password"),
    );

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(false);
    expect(result.error).toContain("password-protected");
  });

  it("handles binary PDF data correctly", async () => {
    const mockPdf = createMockPdf(2);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "Resume with special chars: café résumé naïve",
      totalPages: 2,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(result.text).toContain("café");
    expect(result.text).toContain("résumé");
  });

  it("passes Uint8Array to getDocumentProxy", async () => {
    const mockPdf = createMockPdf(1);
    vi.mocked(getDocumentProxy).mockResolvedValue(mockPdf as never);
    vi.mocked(extractText).mockResolvedValue({
      text: "Test",
      totalPages: 1,
    });

    const buffer = new ArrayBuffer(100);
    const view = new Uint8Array(buffer);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d]);

    await extractPdfText(buffer);

    expect(getDocumentProxy).toHaveBeenCalledWith(expect.any(Uint8Array));
    const passedArg = vi.mocked(getDocumentProxy).mock.calls[0]?.[0];
    expect(passedArg).toBeInstanceOf(Uint8Array);
    expect((passedArg as Uint8Array).length).toBe(100);
  });
});
