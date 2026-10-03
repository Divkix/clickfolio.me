import { describe, expect, it } from "vite-plus/test";
import { extractPdfText } from "@/lib/ai/pdf-extract";

const TEXTLESS_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

describe("extractPdfText", () => {
  it("leaves the caller's buffer usable so the vision fallback can read it", async () => {
    const bytes = new TextEncoder().encode(TEXTLESS_PDF);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const result = await extractPdfText(buffer);

    expect(result.success).toBe(true);
    expect(buffer.byteLength).toBe(bytes.byteLength);
    expect(() => new Uint8Array(buffer)).not.toThrow();
  });
});
