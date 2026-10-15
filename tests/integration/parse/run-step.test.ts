import { Cause, Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { AiProviderFailed, PdfInvalid, toParseErrorJson } from "@/lib/parse/failures";
import { runStep } from "@/lib/workflows/run-step";

vi.mock("cloudflare:workflows", () => ({
  NonRetryableError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NonRetryableError";
    }
  },
}));

describe("Workflow Effect adapter", () => {
  it("preserves the successful journal payload", async () => {
    const value = { parsedContent: { full_name: "Test User" }, career: null };
    expect(await runStep(Effect.succeed(value))).toBe(value);
  });

  it("uses the exact NonRetryableError name for permanent failures", async () => {
    const failure = new PdfInvalid({ message: "encrypted PDF", reason: "encrypted" });
    await expect(runStep(Effect.fail(failure))).rejects.toMatchObject({
      name: "NonRetryableError",
      message: "invalid_pdf: encrypted PDF",
      cause: toParseErrorJson(failure),
    });
  });

  it("throws a plain Error for Workflows to retry", async () => {
    const failure = new AiProviderFailed({ message: "provider offline" });
    await expect(runStep(Effect.fail(failure))).rejects.toMatchObject({
      name: "Error",
      message: "provider offline",
      cause: toParseErrorJson(failure),
    });
  });

  it.each([new Error("defect"), "non-Error defect"])(
    "rethrows defect identity: %s",
    async (defect) => {
      await expect(runStep(Effect.die(defect))).rejects.toBe(defect);
    },
  );

  it("preserves a defect even when its Cause also has a typed failure", async () => {
    const defect = new Error("programming defect");

    const cause = Cause.combine(
      Cause.fail(new PdfInvalid({ message: "bad PDF", reason: "corrupt" })),
      Cause.die(defect),
    );

    await expect(runStep(Effect.failCause(cause))).rejects.toBe(defect);
  });
});
