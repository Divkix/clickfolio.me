import { describe, expect, it } from "vite-plus/test";
import { validatePDF, validatePDFBuffer } from "@/lib/utils/validation";

describe("empty PDF validation", () => {
  it("explains an empty file before the client starts an upload", () => {
    expect(validatePDF(new File([], "resume.pdf", { type: "application/pdf" }))).toEqual({
      valid: false,
      error: "This file is empty. Choose a different PDF.",
    });
  });

  it("uses the same message for an empty server-side buffer", () => {
    expect(validatePDFBuffer(new ArrayBuffer(0))).toEqual({
      valid: false,
      error: "This file is empty. Choose a different PDF.",
    });
  });

  it("still accepts a non-empty PDF", () => {
    const file = new File(["%PDF-1.4 test"], "resume.pdf", { type: "application/pdf" });

    expect(validatePDF(file)).toEqual({ valid: true });
    expect(validatePDFBuffer(new TextEncoder().encode("%PDF-1.4 test").buffer)).toEqual({
      valid: true,
    });
  });
});
