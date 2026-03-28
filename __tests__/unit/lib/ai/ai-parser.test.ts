import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMockCleanup, suppressConsole } from "@/__tests__/setup/helpers/test-utils";
import { type AiEnvVars, createAiProvider, parseWithAi } from "@/lib/ai/ai-parser";

// Mock AI SDK
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  NoObjectGeneratedError: {
    isInstance: vi.fn(),
  },
  Output: {
    object: vi.fn(),
  },
}));

// Mock fallback functions
vi.mock("@/lib/ai/ai-fallback", () => ({
  parseJsonWithRepair: vi.fn(),
  transformToSchema: vi.fn((data) => data),
}));

vi.mock("@/lib/ai/ai-normalize", () => ({
  normalizeAiKeys: vi.fn((data) => data),
}));

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, NoObjectGeneratedError } from "ai";
import { parseJsonWithRepair, transformToSchema } from "@/lib/ai/ai-fallback";
import { normalizeAiKeys } from "@/lib/ai/ai-normalize";

setupMockCleanup();

const mockEnv: AiEnvVars = {
  CF_AI_GATEWAY_ACCOUNT_ID: "test-account",
  CF_AI_GATEWAY_ID: "test-gateway",
  CF_AIG_AUTH_TOKEN: "test-token",
  AI_MODEL: "openai/gpt-oss-120b:nitro",
};

const mockProvider = vi.fn();

describe("createAiProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("creates provider with valid env vars", () => {
    const provider = createAiProvider(mockEnv);

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: "openrouter",
      baseURL: "https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/openrouter",
      headers: {
        "cf-aig-authorization": "Bearer test-token",
      },
      supportsStructuredOutputs: true,
    });
    expect(provider).toBe(mockProvider);
  });

  it("throws error when CF_AI_GATEWAY_ACCOUNT_ID is missing", () => {
    const env = { ...mockEnv, CF_AI_GATEWAY_ACCOUNT_ID: undefined };

    expect(() => createAiProvider(env)).toThrow("AI Gateway not configured");
  });

  it("throws error when CF_AI_GATEWAY_ID is missing", () => {
    const env = { ...mockEnv, CF_AI_GATEWAY_ID: undefined };

    expect(() => createAiProvider(env)).toThrow("AI Gateway not configured");
  });

  it("throws error when CF_AIG_AUTH_TOKEN is missing", () => {
    const env = { ...mockEnv, CF_AIG_AUTH_TOKEN: undefined };

    expect(() => createAiProvider(env)).toThrow("AI Gateway not configured");
  });
});

describe("parseWithAi - structured output path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("returns structured output on successful parse", async () => {
    const mockOutput = {
      full_name: "Jane Doe",
      headline: "Software Engineer",
      summary: "Experienced developer",
      contact: { email: "jane@example.com" },
      experience: [
        { title: "Engineer", company: "Acme", start_date: "2020-01", description: "Led team" },
      ],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Sample resume text", mockEnv);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockOutput);
    expect(result.structuredOutput).toBe(true);
  });

  it("uses default model when AI_MODEL not provided", async () => {
    const env = { ...mockEnv, AI_MODEL: undefined };
    const mockOutput = {
      full_name: "Test",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await parseWithAi("Resume text", env);

    expect(mockProvider).toHaveBeenCalledWith("openai/gpt-oss-120b:nitro");
  });

  it("uses custom model when provided", async () => {
    const env = { ...mockEnv, AI_MODEL: "custom/model" };
    const mockOutput = {
      full_name: "Test",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await parseWithAi("Resume text", env);

    expect(mockProvider).toHaveBeenCalledWith("custom/model");
  });

  it("falls back to text fallback when structured output fails", async () => {
    const noObjectError = new Error("No object generated");
    (noObjectError as Error & { finishReason: string }).finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
    expect(result.structuredOutput).toBeUndefined();
  });

  it("salvages JSON from NoObjectGeneratedError text", async () => {
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
      text: string;
    };
    noObjectError.finishReason = "length";
    noObjectError.text = JSON.stringify({
      full_name: "Jane",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    });

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText).mockRejectedValueOnce(noObjectError);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("continues to fallback when salvage fails", async () => {
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
      text: string;
    };
    noObjectError.finishReason = "length";
    noObjectError.text = "Not valid JSON";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({
        data: {
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        },
        repaired: false,
      });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("bubbles config errors immediately without fallback", async () => {
    const configError = new Error("AI Gateway not configured");

    vi.mocked(generateText).mockRejectedValue(configError);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain("AI Gateway not configured");
  });

  it("handles network errors with fallback", async () => {
    const networkError = new Error("Network timeout");

    vi.mocked(generateText)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });
});

describe("parseWithAi - text fallback path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
    // Reset and set default implementations to prevent leakage from previous tests
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({
      text: '{"full_name":"Default"}',
    } as unknown as Awaited<ReturnType<typeof generateText>>);
    vi.mocked(parseJsonWithRepair).mockReset();
    vi.mocked(parseJsonWithRepair).mockResolvedValue({ data: null, repaired: false });
    vi.mocked(normalizeAiKeys).mockReset();
    vi.mocked(normalizeAiKeys).mockImplementation((data) => data as Record<string, unknown>);
    vi.mocked(transformToSchema).mockReset();
    vi.mocked(transformToSchema).mockImplementation((data) => data as Record<string, unknown>);
  });

  it("extracts JSON from markdown code blocks", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n{"full_name": "Jane", "headline": "Dev", "summary": "", "contact": {"email": ""}, "experience": []}\n```',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("extracts JSON from plain text without code blocks", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '{"full_name": "Jane", "headline": "Dev", "summary": "", "contact": {"email": ""}, "experience": []}',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("retries with truncated text when first fallback fails", async () => {
    // First call: structured output fails with NoObjectGeneratedError
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError) // structured fails
      .mockResolvedValueOnce({
        text: "Invalid JSON",
      } as unknown as Awaited<ReturnType<typeof generateText>>) // first fallback returns invalid
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>); // retry succeeds

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // first fallback fails
      .mockResolvedValueOnce({
        data: {
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        },
        repaired: false,
      }); // retry succeeds

    const result = await parseWithAi("Very long resume text ".repeat(10000), mockEnv);

    expect(result.success).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(3);
  });

  it("returns error when fallback retry also fails", async () => {
    // First call: structured output fails with NoObjectGeneratedError
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: "Invalid JSON",
      } as unknown as Awaited<ReturnType<typeof generateText>>)
      .mockResolvedValueOnce({
        text: "Still invalid",
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({ data: null, repaired: false }) // first fallback fails
      .mockResolvedValueOnce({ data: null, repaired: false }); // retry also fails

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to parse AI response");
  });

  it("normalizes and transforms fallback data", async () => {
    const rawData = {
      full_name: "Jane",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    };
    const normalizedData = { ...rawData, full_name: "Jane Doe" };
    const transformedData = { ...normalizedData, processed: true };

    // First: structured output fails, then fallback succeeds
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: JSON.stringify(rawData),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({ data: rawData, repaired: false }); // fallback succeeds
    vi.mocked(normalizeAiKeys).mockReturnValue(normalizedData);
    vi.mocked(transformToSchema).mockReturnValue(transformedData);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(normalizeAiKeys).toHaveBeenCalledWith(rawData);
    expect(transformToSchema).toHaveBeenCalledWith(normalizedData);
    expect(result.data).toEqual(transformedData);
  });

  it("logs repaired status when JSON was repaired", async () => {
    const spy = suppressConsole("warn");

    // First: structured output fails, then fallback succeeds with repaired JSON
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({
        data: {
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        },
        repaired: true,
      });

    await parseWithAi("Resume text", mockEnv);

    // Should have logged with repaired flag
    expect(spy).toHaveBeenCalled();
  });
});

describe("parseWithAi - retry with error feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("successfully retries with validation errors", async () => {
    const retryContext = {
      previousOutput: JSON.stringify({ full_name: "Jane" }),
      errors: "headline: Required, summary: Required",
    };

    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        full_name: "Jane",
        headline: "Dev",
        summary: "Experienced",
        contact: { email: "jane@example.com" },
        experience: [],
      }),
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "Experienced",
        contact: { email: "jane@example.com" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv, undefined, retryContext);

    expect(result.success).toBe(true);
  });

  it("returns error when retry fails to produce valid JSON", async () => {
    const retryContext = {
      previousOutput: JSON.stringify({ full_name: "Jane" }),
      errors: "headline: Required",
    };

    vi.mocked(generateText).mockResolvedValue({
      text: "Not JSON",
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: null,
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv, undefined, retryContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Retry failed");
  });

  it("handles retry timeout", async () => {
    const retryContext = {
      previousOutput: JSON.stringify({ full_name: "Jane" }),
      errors: "headline: Required",
    };

    vi.mocked(generateText).mockRejectedValue(new Error("AbortError: Timeout"));

    const result = await parseWithAi("Resume text", mockEnv, undefined, retryContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timeout");
  });
});

describe("parseWithAi - edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("handles unicode in resume text", async () => {
    const mockOutput = {
      full_name: "陈明",
      headline: "软件工程师",
      summary: "经验丰富的开发者",
      contact: { email: "chen@example.com" },
      experience: [
        { title: "工程师", company: "公司", start_date: "2020-01", description: "工作" },
      ],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("简历内容", mockEnv);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockOutput);
  });

  it("handles special characters in resume text", async () => {
    const mockOutput = {
      full_name: "O'Connor & Smith-Jones",
      headline: "DevOps Engineer",
      summary: "CI/CD & Infrastructure",
      contact: { email: "test@example.com" },
      experience: [
        {
          title: "Engineer",
          company: "Acme",
          start_date: "2020-01",
          description: "Led $1M+ project",
        },
      ],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Resume with $pecial chars: <>&\"'", mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles empty resume text", async () => {
    const mockOutput = {
      full_name: "Unknown",
      headline: "Professional",
      summary: "",
      contact: { email: "" },
      experience: [],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("", mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles very long resume text", async () => {
    const longText = "Experience ".repeat(100000);
    const mockOutput = {
      full_name: "Jane",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [
        { title: "Engineer", company: "Acme", start_date: "2020-01", description: "Led team" },
      ],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi(longText, mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles malformed JSON in markdown block", async () => {
    // First: structured output fails, then fallback returns malformed JSON
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError)
      .mockResolvedValueOnce({
        text: "```json\n{invalid json here}\n```",
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({ data: null, repaired: false }); // fallback also fails

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(false);
  });

  it("handles nested markdown in JSON", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n{"full_name": "Jane", "summary": "Uses `code` in text"}\n```',
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: { full_name: "Jane", summary: "Uses `code` in text" },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });
});

describe("parseWithAi - error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("returns error for unexpected exceptions", async () => {
    // Use different env vars to bust the module-level cache
    const uniqueEnv = {
      ...mockEnv,
      CF_AI_GATEWAY_ACCOUNT_ID: "different-account",
      CF_AI_GATEWAY_ID: "different-gateway",
    };
    vi.mocked(createOpenAICompatible).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result = await parseWithAi("Resume text", uniqueEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unexpected error");
  });

  it("handles rate limit errors", async () => {
    const rateLimitError = new Error("Rate limit exceeded: 429");

    vi.mocked(generateText)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles quota exceeded errors", async () => {
    const quotaError = new Error("Quota exceeded");

    vi.mocked(generateText)
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles timeout errors with AbortSignal", async () => {
    const timeoutError = new Error("AbortError: The operation was aborted");

    vi.mocked(generateText).mockRejectedValue(timeoutError);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain("aborted");
  });

  it("handles provider unavailability", async () => {
    const unavailableError = new Error("Service temporarily unavailable: 503");

    // Provider error should trigger fallback path
    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(false);
    vi.mocked(generateText)
      .mockRejectedValueOnce(unavailableError)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
  });

  it("includes truncated error message for parse failures", async () => {
    // First: structured output fails, then fallback and retry return invalid text
    const noObjectError = new Error("No object generated") as Error & {
      finishReason: string;
    };
    noObjectError.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(noObjectError) // structured fails
      .mockResolvedValueOnce({
        text: "This is a very long invalid response that should be truncated in the error message for readability",
      } as unknown as Awaited<ReturnType<typeof generateText>>) // first fallback fails
      .mockResolvedValueOnce({
        text: "Also invalid and quite long indeed so it should be truncated",
      } as unknown as Awaited<ReturnType<typeof generateText>>); // retry also fails

    vi.mocked(parseJsonWithRepair)
      .mockResolvedValueOnce({ data: null, repaired: false }) // salvage fails
      .mockResolvedValueOnce({ data: null, repaired: false }) // first fallback fails
      .mockResolvedValueOnce({ data: null, repaired: false }); // retry also fails

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(false);
    expect(result.error).toContain("...");
    expect((result.error?.length ?? 0) < 250).toBe(true);
  });
});

describe("parseWithAi - logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("logs successful structured parse", async () => {
    const spy = suppressConsole("info");

    vi.mocked(generateText).mockResolvedValue({
      output: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await parseWithAi("Resume text", mockEnv);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[ai-parse:structured]"),
      expect.any(String),
    );
  });

  it("logs failed structured parse", async () => {
    const spy = suppressConsole("warn");
    const error = new Error("Failed") as Error & { finishReason: string };
    error.finishReason = "content-filter";

    vi.mocked(NoObjectGeneratedError.isInstance).mockReturnValue(true);
    vi.mocked(generateText)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          full_name: "Jane",
          headline: "Dev",
          summary: "",
          contact: { email: "" },
          experience: [],
        }),
      } as unknown as Awaited<ReturnType<typeof generateText>>);

    vi.mocked(parseJsonWithRepair).mockResolvedValue({
      data: {
        full_name: "Jane",
        headline: "Dev",
        summary: "",
        contact: { email: "" },
        experience: [],
      },
      repaired: false,
    });

    await parseWithAi("Resume text", mockEnv);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[ai-parse:structured]"),
      expect.stringContaining('"success":false'),
    );
  });
});

describe("parseWithAi - additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOpenAICompatible).mockReturnValue(
      mockProvider as unknown as ReturnType<typeof createOpenAICompatible>,
    );
  });

  it("handles null AI response data", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: null,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("handles AI response with unexpected data structure", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { unexpected: "data", format: true },
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ unexpected: "data", format: true });
  });

  it("processes resume text with special unicode characters", async () => {
    const mockOutput = {
      full_name: "Marie Curie",
      headline: "Physicist & Chemist",
      summary: "Pioneering researcher",
      contact: { email: "marie@science.com" },
      experience: [
        { title: "Scientist", company: "Lab", start_date: "1900", description: "Research" },
      ],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Resume with émojis 🎉 and ñoño", mockEnv);

    expect(result.success).toBe(true);
  });

  it("handles AI model specified in env but overridden by parameter", async () => {
    const customEnv = { ...mockEnv, AI_MODEL: "env-model" };
    const mockOutput = {
      full_name: "Test",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await parseWithAi("Resume", customEnv, "param-model");

    expect(mockProvider).toHaveBeenCalledWith("param-model");
  });

  it("validates that structuredOutput flag is set correctly on success", async () => {
    const mockOutput = {
      full_name: "Jane",
      headline: "Dev",
      summary: "",
      contact: { email: "" },
      experience: [],
    };

    vi.mocked(generateText).mockResolvedValue({
      output: mockOutput,
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const result = await parseWithAi("Resume text", mockEnv);

    expect(result.structuredOutput).toBe(true);
    expect(result.success).toBe(true);
  });
});
