import { Effect } from "effect";
import { generateText, type GenerateTextResult, type ToolSet } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { generateAiText, parseWithAiEffect } from "@/lib/ai/ai-parser";
import { parseResumeWithAi } from "@/lib/ai";
import { extractPdfTextEffect } from "@/lib/ai/pdf-extract";
import { classifyCareerEffect } from "@/lib/ai/career";

const mocks = vi.hoisted(() => {
  const pdf = { numPages: 1, getMetadata: vi.fn(async () => ({ info: {} })) };

  return {
    pdf,
    document: vi.fn(async () => pdf),
    extract: vi.fn(async () => ({
      text: "Resume text with enough detail about professional experience and education.",
      totalPages: 1,
    })),
    log: vi.fn(),
  };
});

vi.mock("unpdf", () => ({ getDocumentProxy: mocks.document, extractText: mocks.extract }));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => (modelId: string) => ({ modelId })),
}));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

const ENV = {
  CF_AI_GATEWAY_ACCOUNT_ID: "test",
  CF_AI_GATEWAY_ID: "test",
  CF_AIG_AUTH_TOKEN: "test",
};

const CONTENT = {
  full_name: "Test User",
  headline: "Software Engineer",
  summary: "Experienced software engineer building useful systems.",
  contact: { email: "test@example.com" },
  experience: [
    { title: "Engineer", company: "Example", start_date: "2020", description: "Build systems" },
  ],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

function pdfBuffer() {
  return new TextEncoder().encode("%PDF-1.4 original bytes").buffer;
}

function textResult(text: string): GenerateTextResult<ToolSet, never, never> {
  // SAFETY: the production adapter only reads text from the SDK result.
  return { text } as GenerateTextResult<ToolSet, never, never>;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pdf.numPages = 1;
  mocks.pdf.getMetadata.mockResolvedValue({ info: {} });
  mocks.document.mockResolvedValue(mocks.pdf);
  mocks.extract.mockResolvedValue({
    text: "Resume text with enough detail about professional experience and education.",
    totalPages: 1,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Effect PDF failures", () => {
  it("rejects a non-PDF before invoking pdf.js", async () => {
    expect(
      await Effect.runPromise(Effect.flip(extractPdfTextEffect(new ArrayBuffer(0)))),
    ).toMatchObject({ _tag: "PdfInvalid", reason: "corrupt", retryable: false });
    expect(mocks.document).not.toHaveBeenCalled();
  });

  it.each(["encrypted PDF", "password protected", "PDF is encrypted"])(
    "tags %s",
    async (message) => {
      mocks.document.mockRejectedValueOnce(new Error(message));
      expect(await Effect.runPromise(Effect.flip(extractPdfTextEffect(pdfBuffer())))).toMatchObject(
        { _tag: "PdfInvalid", reason: "encrypted" },
      );
    },
  );

  it("rejects excessive pages before extracting text", async () => {
    mocks.pdf.numPages = 51;
    expect(await Effect.runPromise(Effect.flip(extractPdfTextEffect(pdfBuffer())))).toMatchObject({
      reason: "too-many-pages",
    });
    expect(mocks.extract).not.toHaveBeenCalled();
  });

  it("continues without optional metadata", async () => {
    mocks.pdf.getMetadata.mockRejectedValueOnce(new Error("metadata unavailable"));
    expect(await Effect.runPromise(extractPdfTextEffect(pdfBuffer()))).toMatchObject({
      pageCount: 1,
      source: "generic",
    });
  });
});

describe("Effect AI boundaries", () => {
  it("aborts the SDK request when its Effect times out", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(generateText).mockImplementation((options) => {
      signal = options.abortSignal;

      return new Promise<GenerateTextResult<ToolSet, never, never>>(() => {});
    });

    const failure = await Effect.runPromise(
      Effect.flip(generateAiText({ model: "test", prompt: "resume" }, 5)),
    );

    expect(failure).toMatchObject({ _tag: "AiTimedOut", retryable: true });
    expect(signal?.aborted).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it.each(["AI_APICallError", "NoObjectGeneratedError"])(
    "keeps %s retryable even with schema wording",
    async (name) => {
      const error = new Error("invalid JSON schema from provider");
      error.name = name;
      vi.mocked(generateText).mockRejectedValue(error);
      const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
      expect(failure).toMatchObject({ _tag: "AiProviderFailed", retryable: true });
      expect(generateText).toHaveBeenCalledTimes(2);
    },
  );

  it("returns typed resume content without serializing it", async () => {
    vi.mocked(generateText).mockResolvedValue(textResult(JSON.stringify(CONTENT)));
    expect(await Effect.runPromise(parseResumeWithAi(pdfBuffer(), ENV))).toMatchObject({
      full_name: "Test User",
    });
  });

  it("sends one schema-feedback attempt then fails permanently", async () => {
    vi.mocked(generateText).mockResolvedValue(
      textResult(
        JSON.stringify({
          ...CONTENT,
          education: Array.from({ length: 11 }, () => ({ degree: "BSc", institution: "Example" })),
        }),
      ),
    );
    const failure = await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)));
    expect(failure).toMatchObject({ _tag: "SchemaRejected", retryable: false });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateText).mock.calls[1][0].system).toContain("Validation errors found");
  });

  it("uses vision for scanned PDFs and sends the intact original bytes", async () => {
    mocks.extract.mockResolvedValue({ text: "", totalPages: 1 });
    vi.mocked(generateText).mockResolvedValue(textResult(JSON.stringify(CONTENT)));
    const buffer = pdfBuffer();
    expect(await Effect.runPromise(parseResumeWithAi(buffer, ENV))).toMatchObject({
      full_name: "Test User",
    });
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(vi.mocked(generateText).mock.calls[0][0].messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "file",
              mediaType: "application/pdf",
              data: btoa("%PDF-1.4 original bytes"),
            }),
          ]),
        }),
      ]),
    );
  });

  it("rejects an unreadable scan instead of accepting an empty portfolio", async () => {
    mocks.extract.mockResolvedValue({ text: "", totalPages: 1 });
    vi.mocked(generateText).mockResolvedValue(textResult("{}"));
    expect(await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)))).toMatchObject(
      { _tag: "PdfInvalid", reason: "scanned-empty" },
    );
  });

  it("leaves career unchanged when classification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await Effect.runPromise(classifyCareerEffect(CONTENT, ENV))).toBeNull();
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "career classification failed",
      expect.objectContaining({ error: "offline" }),
    );
  });
});

describe("Effect input and cancellation regressions", () => {
  it("keeps malformed external fields in the typed failure channel", async () => {
    vi.mocked(generateText).mockResolvedValue(
      textResult(JSON.stringify({ ...CONTENT, full_name: { toString: 42 } })),
    );
    expect(await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)))).toMatchObject(
      { _tag: "AiOutputInvalid", retryable: false },
    );
  });

  it("does not log response excerpts when JSON parsing fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(generateText).mockResolvedValue(textResult("PRIVATE_RESUME_MARKER not json"));
    await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_RESUME_MARKER");
    warn.mockRestore();
  });

  it("aborts a career response whose body stalls after headers arrive", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const response = new Response("{}");
    vi.spyOn(response, "json").mockReturnValue(new Promise(() => {}));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
        signal = options?.signal;

        return response;
      }),
    );
    const result = Effect.runPromise(classifyCareerEffect(CONTENT, ENV));
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await result).toBeNull();
    expect(signal?.aborted).toBe(true);
    expect(mocks.log).toHaveBeenCalledTimes(1);
  });
});
