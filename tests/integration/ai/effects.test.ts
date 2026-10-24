import { Effect } from "effect";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  APICallError,
  generateText,
  type GenerateTextResult,
  JSONParseError,
  type ToolSet,
} from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { textResult } from "@/tests/helpers/ai-result";
import { generateAiText, parseWithAiEffect } from "@/lib/ai/ai-parser";
import { parseResumeWithAi } from "@/lib/ai";
import * as transform from "@/lib/ai/transform";
import { extractPdfTextEffect } from "@/lib/ai/pdf-extract";
import { classifyCareerEffect } from "@/lib/ai/career";
import { DEFAULT_AI_MODEL } from "@/lib/ai/prompt-config";
import {
  AiOutputInvalid,
  AiProviderFailed,
  AiProviderRejected,
  AiTimedOut,
  PdfInvalid,
  SchemaRejected,
} from "@/lib/parse/failures";

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
    logEvent: vi.fn(),
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

vi.mock("@/lib/utils/log", () => ({ log: mocks.log, logEvent: mocks.logEvent }));

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
    const failure = await Effect.runPromise(Effect.flip(extractPdfTextEffect(new ArrayBuffer(0))));
    expect(failure).toBeInstanceOf(PdfInvalid);
    expect(failure).toMatchObject({ reason: "corrupt", retryable: false });
    expect(mocks.document).not.toHaveBeenCalled();
  });

  it.each(["encrypted PDF", "password protected", "PDF is encrypted"])(
    "tags %s",
    async (message) => {
      mocks.document.mockRejectedValueOnce(new Error(message));
      const failure = await Effect.runPromise(Effect.flip(extractPdfTextEffect(pdfBuffer())));
      expect(failure).toBeInstanceOf(PdfInvalid);
      expect(failure).toMatchObject({ reason: "encrypted" });
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
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "pdf metadata unreadable; detecting the source from text only",
      expect.objectContaining({ "error.message": "metadata unavailable" }),
    );
  });
});

describe("Effect AI boundaries", () => {
  it.each([400, 401, 413])("does not repeat a rejected HTTP %s request", async (statusCode) => {
    vi.mocked(generateText).mockRejectedValue(
      new APICallError({
        message: "rejected",
        url: "https://provider.test",
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      }),
    );
    const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(failure).toBeInstanceOf(AiProviderRejected);
    expect(failure.retryable).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("does not retry missing gateway configuration", async () => {
    const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", {})));
    expect(failure).toBeInstanceOf(AiProviderRejected);
    expect(failure.retryable).toBe(false);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("aborts the SDK request when its Effect times out", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(generateText).mockImplementation((options) => {
      signal = options.abortSignal;

      return new Promise<GenerateTextResult<ToolSet, never, never>>(() => {});
    });

    const failure = await Effect.runPromise(
      Effect.flip(generateAiText({ model: "test", prompt: "resume" }, 5)),
    );

    expect(failure).toBeInstanceOf(AiTimedOut);
    expect(failure.retryable).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "ai_generation_failed",
      { model: "test", errorType: "AiTimedOut", duration_ms: expect.any(Number) },
      "warn",
    );
  });

  it.each(["AI_APICallError", "NoObjectGeneratedError"])(
    "keeps %s retryable even with schema wording",
    async (name) => {
      const error = new Error("invalid JSON schema from provider");
      error.name = name;
      vi.mocked(generateText).mockRejectedValue(error);
      const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
      expect(failure).toBeInstanceOf(AiProviderFailed);
      expect(failure.retryable).toBe(true);
      expect(generateText).toHaveBeenCalledTimes(2);
    },
  );

  it("builds the gateway provider per call, so a rotated token is never served from a cache", async () => {
    vi.mocked(generateText).mockResolvedValue(textResult(JSON.stringify(CONTENT)));

    await Effect.runPromise(parseWithAiEffect("resume", ENV));
    await Effect.runPromise(parseWithAiEffect("resume", ENV));
    await Effect.runPromise(parseWithAiEffect("resume", { ...ENV, CF_AIG_AUTH_TOKEN: "rotated" }));

    expect(createOpenAICompatible).toHaveBeenCalledTimes(3);
    expect(createOpenAICompatible).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: { "cf-aig-authorization": "Bearer rotated" },
      }),
    );
  });

  it("returns typed resume content without serializing it", async () => {
    vi.mocked(generateText).mockResolvedValue(textResult(JSON.stringify(CONTENT)));
    expect(await Effect.runPromise(parseResumeWithAi(pdfBuffer(), ENV))).toMatchObject({
      full_name: "Test User",
    });
    expect(mocks.logEvent).toHaveBeenCalledWith("ai_generation_completed", {
      model: DEFAULT_AI_MODEL,
      response_model: "test-model",
      finish_reason: "stop",
      duration_ms: expect.any(Number),
      input_tokens: 1200,
      cached_input_tokens: 200,
      output_tokens: 800,
      reasoning_tokens: 200,
      total_tokens: 2000,
      cost_credits: 0.0042,
    });
  });

  it("tags a final output transform throw without repeating AI generation", async () => {
    const output = vi.spyOn(transform, "transformAiOutput").mockImplementationOnce(() => {
      throw new TypeError("deterministic transform failure");
    });

    vi.mocked(generateText).mockResolvedValue(textResult(JSON.stringify(CONTENT)));

    try {
      const failure = await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)));
      expect(failure).toBeInstanceOf(AiOutputInvalid);
      expect(failure.retryable).toBe(false);
      expect(generateText).toHaveBeenCalledTimes(1);
    } finally {
      output.mockRestore();
    }
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
    expect(failure).toBeInstanceOf(SchemaRejected);
    expect(failure.retryable).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(vi.mocked(generateText).mock.calls[1][0].system).toContain("Validation errors found");
  });

  it("keeps a provider failure retryable when the feedback attempt fails", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce(
        textResult(
          JSON.stringify({
            ...CONTENT,
            education: Array.from({ length: 11 }, () => ({
              degree: "BSc",
              institution: "Example",
            })),
          }),
        ),
      )
      .mockRejectedValueOnce(new Error("provider unavailable"));

    const failure = await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)));
    expect(failure).toBeInstanceOf(AiProviderFailed);
    expect(failure.retryable).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
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
    const failure = await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)));
    expect(failure).toBeInstanceOf(PdfInvalid);
    expect(failure).toMatchObject({ reason: "scanned-empty" });
  });

  it("leaves career unchanged when classification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await Effect.runPromise(classifyCareerEffect(CONTENT, ENV))).toBeNull();
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "career classification failed",
      expect.objectContaining({ "error.message": "offline", "error.name": "AiProviderFailed" }),
    );
  });
});

describe("Effect input and cancellation regressions", () => {
  it("keeps malformed external fields in the typed failure channel", async () => {
    vi.mocked(generateText).mockResolvedValue(
      textResult(JSON.stringify({ ...CONTENT, full_name: { toString: 42 } })),
    );
    const failure = await Effect.runPromise(Effect.flip(parseResumeWithAi(pdfBuffer(), ENV)));
    expect(failure).toBeInstanceOf(AiOutputInvalid);
    expect(failure.retryable).toBe(false);
  });

  it("does not log response excerpts when JSON parsing fails", async () => {
    vi.mocked(generateText).mockResolvedValue(textResult("PRIVATE_RESUME_MARKER not json"));
    await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "ai parse attempt failed",
      expect.objectContaining({ path: "text-fallback", errorType: "AiOutputInvalid" }),
    );
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("PRIVATE_RESUME_MARKER");
  });

  it("keeps response text out of the invalid-output error the Workflow logs", async () => {
    vi.mocked(generateText).mockResolvedValue(textResult("PRIVATE_RESUME_MARKER not json"));
    const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(failure).toBeInstanceOf(AiOutputInvalid);
    expect(`${failure.message} ${failure.stack}`).not.toContain("PRIVATE_RESUME_MARKER");
  });

  it("drops the response body an SDK parse error quotes", async () => {
    vi.mocked(generateText).mockRejectedValue(
      new JSONParseError({ text: "PRIVATE_RESUME_MARKER", cause: new SyntaxError("bad") }),
    );
    const failure = await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(failure).toBeInstanceOf(AiProviderFailed);
    expect(failure.message).toBe("AI_JSONParseError");
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("PRIVATE_RESUME_MARKER");
  });

  it("logs a provider failure through the scrubbed error fields", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("quota exceeded for jane@example.com"));
    await Effect.runPromise(Effect.flip(parseWithAiEffect("resume", ENV)));
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "ai parse attempt failed",
      expect.objectContaining({
        errorType: "AiProviderFailed",
        "error.message": "quota exceeded for [email]",
      }),
    );
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
