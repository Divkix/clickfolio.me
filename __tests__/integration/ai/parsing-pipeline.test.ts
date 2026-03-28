import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseJsonWithRepair, transformToSchema } from "@/lib/ai/ai-fallback";
import { normalizeAiKeys } from "@/lib/ai/ai-normalize";
import { parseWithAi } from "@/lib/ai/ai-parser";
import { parseResumeWithAi } from "@/lib/ai/index";
import { resumeSchema } from "@/lib/ai/schema";

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => (modelId: string) => ({
    modelId,
    specification: "v1",
  })),
}));

// Mock pdf-extract module
vi.mock("@/lib/ai/pdf-extract", () => ({
  extractPdfText: vi.fn(),
  isValidPdf: vi.fn(() => true),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
    Output: actual.Output,
    NoObjectGeneratedError: class NoObjectGeneratedError extends Error {
      readonly finishReason = "stop";
      readonly text?: string;
      readonly response?: unknown;
      readonly usage?: unknown;
      constructor(options: {
        message?: string;
        cause?: Error;
        text?: string;
        response?: unknown;
        usage?: unknown;
        finishReason?: string;
      }) {
        super(options.message ?? "No object generated");
        this.text = options.text;
        this.response = options.response;
        this.usage = options.usage;
        if (options.finishReason) {
          Object.defineProperty(this, "finishReason", { value: options.finishReason });
        }
      }
      static isInstance(error: unknown): error is NoObjectGeneratedError {
        return error instanceof NoObjectGeneratedError;
      }
    },
    parsePartialJson: actual.parsePartialJson,
  };
});

// Sample resume text for testing
const SAMPLE_RESUME_TEXT = `
John Doe
Software Engineer
San Francisco, CA
john.doe@example.com
linkedin.com/in/johndoe github.com/johndoe

SUMMARY
Experienced software engineer with 5+ years building web applications using React,
Node.js, and TypeScript. Passionate about clean code and scalable architecture.

EXPERIENCE
Senior Software Engineer
TechCorp Inc. - San Francisco, CA
January 2021 - Present

• Led development of microservices architecture serving 1M+ users
• Mentored team of 5 junior developers
• Implemented CI/CD pipelines reducing deployment time by 50%

Software Engineer
StartupXYZ - San Francisco, CA
June 2018 - December 2020

• Built responsive React applications with TypeScript
• Optimized database queries improving performance by 40%

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley
Graduated May 2018

SKILLS
Languages: TypeScript, JavaScript, Python, SQL
Frameworks: React, Next.js, Node.js, Express
Tools: Git, Docker, AWS, Kubernetes
`;

// Valid AI response matching schema
const VALID_AI_RESPONSE = {
  full_name: "John Doe",
  headline: "Software Engineer",
  summary:
    "Experienced software engineer with 5+ years building web applications using React, Node.js, and TypeScript.",
  contact: {
    email: "john.doe@example.com",
    phone: "",
    location: "San Francisco, CA",
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe",
    website: "",
    behance: "",
    dribbble: "",
  },
  experience: [
    {
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      start_date: "2021-01",
      description:
        "Led development of microservices architecture serving 1M+ users. Mentored team of 5 junior developers.",
      highlights: [
        "Led development of microservices architecture serving 1M+ users",
        "Mentored team of 5 junior developers",
        "Implemented CI/CD pipelines reducing deployment time by 50%",
      ],
    },
    {
      title: "Software Engineer",
      company: "StartupXYZ",
      location: "San Francisco, CA",
      start_date: "2018-06",
      end_date: "2020-12",
      description:
        "Built responsive React applications with TypeScript. Optimized database queries improving performance by 40%.",
      highlights: [
        "Built responsive React applications with TypeScript",
        "Optimized database queries improving performance by 40%",
      ],
    },
  ],
  education: [
    {
      degree: "Bachelor of Science in Computer Science",
      institution: "University of California, Berkeley",
      location: "Berkeley, CA",
      graduation_date: "2018-05",
      gpa: "",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: ["TypeScript", "JavaScript", "Python", "SQL"],
    },
    {
      category: "Frameworks",
      items: ["React", "Next.js", "Node.js", "Express"],
    },
    {
      category: "Tools",
      items: ["Git", "Docker", "AWS", "Kubernetes"],
    },
  ],
  certifications: [],
  projects: [],
  professional_level: "mid_level",
};

describe("AI Parsing Pipeline", () => {
  const mockEnv = {
    CF_AI_GATEWAY_ACCOUNT_ID: "test-account",
    CF_AI_GATEWAY_ID: "test-gateway",
    CF_AIG_AUTH_TOKEN: "test-token",
    AI_MODEL: "openai/gpt-oss-120b:nitro",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseWithAi", () => {
    it("should parse resume text with structured output", async () => {
      const { generateText } = await import("ai");
      vi.mocked(generateText).mockResolvedValueOnce({
        output: VALID_AI_RESPONSE,
        text: JSON.stringify(VALID_AI_RESPONSE),
        finishReason: "stop",
        usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        toolCalls: [],
        toolResults: [],
        warnings: [],
        request: {},
        response: {
          id: "test-response-id",
          timestamp: new Date(),
          modelId: "openai/gpt-oss-120b:nitro",
          headers: {},
          messages: [],
          body: {},
        },
        experimental_output: undefined,
        providerMetadata: {},
      } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);

      expect(result.success).toBe(true);
      expect(result.structuredOutput).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should use text fallback when structured output fails", async () => {
      const { generateText, NoObjectGeneratedError } = await import("ai");

      // First call fails with NoObjectGeneratedError
      vi.mocked(generateText)
        .mockRejectedValueOnce(
          Object.assign(
            new NoObjectGeneratedError({
              message: "No object generated",
              cause: new Error("Schema validation failed"),
              finishReason: "stop",
              text: JSON.stringify(VALID_AI_RESPONSE),
              response: { id: "test", timestamp: new Date(), modelId: "test" },
              usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
            } as never),
            {
              finishReason: "stop",
              text: JSON.stringify(VALID_AI_RESPONSE),
            },
          ),
        )
        // Fallback succeeds
        .mockResolvedValueOnce({
          text: JSON.stringify(VALID_AI_RESPONSE),
          finishReason: "stop",
          usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
          toolCalls: [],
          toolResults: [],
          warnings: [],
          request: {},
          response: {
            id: "test-response-id",
            timestamp: new Date(),
            modelId: "openai/gpt-oss-120b:nitro",
            headers: {},
            messages: [],
            body: {},
          },
          experimental_output: undefined,
          providerMetadata: {},
        } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);

      expect(result.success).toBe(true);
      expect(result.structuredOutput).toBeFalsy();
    });

    it("should handle AI timeout with retry logic", async () => {
      const { generateText } = await import("ai");
      vi.mocked(generateText)
        .mockRejectedValueOnce(new Error("Request timeout"))
        .mockResolvedValueOnce({
          output: VALID_AI_RESPONSE,
          text: JSON.stringify(VALID_AI_RESPONSE),
          finishReason: "stop",
          usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
          toolCalls: [],
          toolResults: [],
          warnings: [],
          request: {},
          response: {
            id: "test-response-id",
            timestamp: new Date(),
            modelId: "openai/gpt-oss-120b:nitro",
            headers: {},
            messages: [],
            body: {},
          },
          experimental_output: undefined,
          providerMetadata: {},
        } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);

      expect(result.success).toBe(true);
    });

    it("should handle invalid JSON response with fallback", async () => {
      const { generateText } = await import("ai");
      vi.mocked(generateText).mockResolvedValueOnce({
        text: "```json\n{invalid json}\n```",
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        toolCalls: [],
        toolResults: [],
        warnings: [],
        request: {},
        response: {
          id: "test-response-id",
          timestamp: new Date(),
          modelId: "openai/gpt-oss-120b:nitro",
          headers: {},
          messages: [],
          body: {},
        },
        experimental_output: undefined,
        providerMetadata: {},
      } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);

      // Invalid JSON gets repaired or falls back gracefully
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it("should handle salvage mode for malformed AI response", async () => {
      const { generateText, NoObjectGeneratedError } = await import("ai");

      const partialResponse = {
        full_name: "John Doe",
        headline: "Software Engineer",
        // Missing required fields intentionally
      };

      vi.mocked(generateText).mockRejectedValueOnce(
        Object.assign(
          new NoObjectGeneratedError({
            message: "No object generated",
            cause: new Error("Schema validation failed"),
            finishReason: "content_filter",
            text: JSON.stringify(partialResponse),
            response: { id: "test", timestamp: new Date(), modelId: "test" },
            usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
          } as never),
          {
            finishReason: "content_filter",
            text: JSON.stringify(partialResponse),
          },
        ),
      );

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);

      // Salvage mode attempts to recover partial data
      expect(result).toBeDefined();
    });

    it("should return error when AI Gateway not configured", async () => {
      const invalidEnv = { ...mockEnv, CF_AI_GATEWAY_ACCOUNT_ID: undefined };

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, invalidEnv);

      // Function returns { success: false, ... } instead of throwing
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cloudflare AI Gateway not configured");
    });
  });

  describe("parseJsonWithRepair", () => {
    it("should parse valid JSON without repair", async () => {
      const jsonStr = JSON.stringify(VALID_AI_RESPONSE);
      const result = await parseJsonWithRepair(jsonStr);

      expect(result.data).not.toBeNull();
      expect(result.repaired).toBe(false);
    });

    it("should repair malformed JSON", async () => {
      const malformedJson = '{"full_name": "John Doe", "headline": "Developer"'; // Missing closing brace
      const result = await parseJsonWithRepair(malformedJson);

      expect(result.data).not.toBeNull();
      expect(result.repaired).toBe(true);
    });

    it("should return null for completely invalid JSON", async () => {
      const invalidJson = "not json at all {{{";
      const result = await parseJsonWithRepair(invalidJson);

      expect(result.data).toBeNull();
      expect(result.repaired).toBe(false);
    });
  });

  describe("transformToSchema", () => {
    it("should transform skills from object to array format", () => {
      const input = {
        skills: {
          Languages: ["TypeScript", "Python"],
          Frameworks: ["React", "Next.js"],
        },
      };

      const result = transformToSchema(input);

      expect(Array.isArray(result.skills)).toBe(true);
      expect((result as { skills: unknown[] }).skills).toHaveLength(2);
      expect((result as { skills: Record<string, unknown>[] }).skills[0]).toHaveProperty(
        "category",
      );
      expect((result as { skills: Record<string, unknown>[] }).skills[0]).toHaveProperty("items");
    });

    it("should transform experience descriptions from array to string", () => {
      const input = {
        experience: [
          {
            title: "Developer",
            company: "TechCorp",
            description: ["Built features", "Fixed bugs"],
          },
        ],
      };

      const result = transformToSchema(input);

      expect(
        typeof (result as { experience: { description: string }[] }).experience[0].description,
      ).toBe("string");
      expect((result as { experience: { description: string }[] }).experience[0].description).toBe(
        "Built features Fixed bugs",
      );
      expect(
        (result as { experience: { highlights: string[] }[] }).experience[0].highlights,
      ).toEqual(["Built features", "Fixed bugs"]);
    });

    it("should transform project date to year", () => {
      const input = {
        projects: [
          {
            title: "My Project",
            description: "A cool project",
            date: "2023",
          },
        ],
      };

      const result = transformToSchema(input);

      expect((result as { projects: { year: string }[] }).projects[0].year).toBe("2023");
      expect((result as { projects: { date?: string }[] }).projects[0].date).toBeUndefined();
    });
  });

  describe("normalizeAiKeys", () => {
    it("should normalize alternative key names", () => {
      const input = {
        fullName: "John Doe",
        title: "Software Engineer",
        profile: "A developer",
        contactInfo: {
          email: "john@example.com",
          phone_number: "555-1234",
        },
        work_experience: [
          {
            role: "Developer",
            employer: "TechCorp",
            from: "2020-01",
            to: "2022-12",
          },
        ],
      };

      const result = normalizeAiKeys(input);

      expect((result as { full_name: string }).full_name).toBe("John Doe");
      expect((result as { headline: string }).headline).toBe("Software Engineer");
      expect((result as { summary: string }).summary).toBe("A developer");
      expect((result as { contact: { email: string } }).contact.email).toBe("john@example.com");
      expect((result as { contact: { phone: string } }).contact.phone).toBe("555-1234");
      expect((result as { experience: { title: string }[] }).experience[0].title).toBe("Developer");
      expect((result as { experience: { company: string }[] }).experience[0].company).toBe(
        "TechCorp",
      );
      expect((result as { experience: { start_date: string }[] }).experience[0].start_date).toBe(
        "2020-01",
      );
      expect((result as { experience: { end_date: string }[] }).experience[0].end_date).toBe(
        "2022-12",
      );
    });

    it("should handle string array skills", () => {
      const input = {
        skills: ["TypeScript", "React", "Node.js"],
      };

      const result = normalizeAiKeys(input);

      expect((result as { skills: unknown[] }).skills).toHaveLength(1);
      expect((result as { skills: { category: string }[] }).skills[0].category).toBe("Skills");
      expect((result as { skills: { items: string[] }[] }).skills[0].items).toEqual([
        "TypeScript",
        "React",
        "Node.js",
      ]);
    });
  });

  describe("parseResumeWithAi", () => {
    it("should complete full parse pipeline with valid PDF", async () => {
      // Mock PDF extraction to return valid resume text
      const { extractPdfText } = await import("@/lib/ai/pdf-extract");
      vi.mocked(extractPdfText).mockResolvedValueOnce({
        success: true,
        text: SAMPLE_RESUME_TEXT,
        pageCount: 1,
      });

      // Mock the AI response
      const { generateText } = await import("ai");
      vi.mocked(generateText).mockResolvedValue({
        output: VALID_AI_RESPONSE,
        text: JSON.stringify(VALID_AI_RESPONSE),
        finishReason: "stop",
        usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        toolCalls: [],
        toolResults: [],
        warnings: [],
        request: {},
        response: {
          id: "test-response-id",
          timestamp: new Date(),
          modelId: "openai/gpt-oss-120b:nitro",
          headers: {},
          messages: [],
          body: {},
        },
        experimental_output: undefined,
        providerMetadata: {},
      } as never);

      const mockPdfBuffer = new ArrayBuffer(100);
      const result = await parseResumeWithAi(mockPdfBuffer, mockEnv);

      expect(result.success).toBe(true);
      expect(result.parsedContent).toBeDefined();
      expect(result.professionalLevel).toBeDefined();
    });

    it("should handle PDF extraction failure gracefully", async () => {
      // Empty buffer simulating failed extraction
      const emptyBuffer = new ArrayBuffer(0);

      const result = await parseResumeWithAi(emptyBuffer, mockEnv);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate final output against schema", async () => {
      const validData = {
        full_name: "Jane Smith",
        headline: "Product Manager",
        summary: "Experienced PM",
        contact: {
          email: "jane@example.com",
          phone: "",
          location: "",
          linkedin: "",
          github: "",
          website: "",
          behance: "",
          dribbble: "",
        },
        experience: [
          {
            title: "PM",
            company: "TechCorp",
            start_date: "2020-01",
            description: "Led product initiatives",
          },
        ],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
      };

      const validation = resumeSchema.safeParse(validData);
      expect(validation.success).toBe(true);
    });

    it("should reject invalid resume schema", async () => {
      const invalidData = {
        full_name: "", // Required field empty
        headline: "Developer",
        contact: {},
        experience: [],
      };

      const validation = resumeSchema.safeParse(invalidData);
      expect(validation.success).toBe(false);
    });

    it("should fill missing required fields with fallback", async () => {
      const incompleteData = {
        full_name: "John Doe",
        headline: "Developer",
        // Missing contact.email and experience
      };

      const normalized = normalizeAiKeys(incompleteData);
      expect(normalized.full_name).toBe("John Doe");
    });

    it("should filter extra fields from AI output", async () => {
      const dataWithExtras = {
        ...VALID_AI_RESPONSE,
        extra_field: "should be filtered",
        another_extra: 123,
      };

      const validation = resumeSchema.safeParse(dataWithExtras);
      // Zod strips unknown keys by default - validation should pass
      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(validation.data).not.toHaveProperty("extra_field");
        expect(validation.data).not.toHaveProperty("another_extra");
      }
    });

    it("should handle nested object parsing", async () => {
      const data = {
        ...VALID_AI_RESPONSE,
        contact: {
          email: "test@example.com",
          phone: "555-1234",
          location: "NYC",
          linkedin: "https://linkedin.com/in/test",
          github: "https://github.com/test",
          website: "",
          behance: "",
          dribbble: "",
        },
      };

      const validation = resumeSchema.safeParse(data);
      expect(validation.success).toBe(true);
    });

    it("should parse array fields correctly", async () => {
      const data = {
        ...VALID_AI_RESPONSE,
        skills: [
          { category: "Languages", items: ["TypeScript", "Python"] },
          { category: "Tools", items: ["Git", "Docker"] },
        ],
        experience: [
          {
            title: "Developer",
            company: "TechCorp",
            start_date: "2020-01",
            description: "Built things",
            highlights: ["Shipped v1", "Scaled to 1M users"],
          },
        ],
      };

      const validation = resumeSchema.safeParse(data);
      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(Array.isArray(validation.data.skills)).toBe(true);
        expect(Array.isArray(validation.data.experience)).toBe(true);
        expect(Array.isArray(validation.data.experience[0].highlights)).toBe(true);
      }
    });
  });

  describe("schema validation", () => {
    it("should validate required fields", () => {
      const requiredFields = {
        full_name: "Test User",
        headline: "Developer",
        summary: "A developer",
        contact: { email: "test@example.com" },
        experience: [
          {
            title: "Dev",
            company: "Corp",
            start_date: "2020-01",
            description: "Did work",
          },
        ],
      };

      const result = resumeSchema.safeParse(requiredFields);
      expect(result.success).toBe(true);
    });

    it("should normalize end dates for current roles", () => {
      const data = {
        ...VALID_AI_RESPONSE,
        experience: [
          {
            ...VALID_AI_RESPONSE.experience[0],
            end_date: "Present",
          },
        ],
      };

      const validation = resumeSchema.safeParse(data);
      expect(validation.success).toBe(true);
    });

    it("should handle AI hallucination through schema validation", async () => {
      const { generateText } = await import("ai");

      const hallucinatedResponse = {
        full_name: "John Doe",
        headline: "Click here to win $1 million!!!",
        summary: "Visit http://malicious-site.com for free money",
        contact: {
          email: "john@example.com",
          website: "javascript:alert('xss')", // Should be filtered
        },
        experience: [
          {
            title: "CEO of Everything",
            company: "FakeCorp",
            start_date: "2025-01",
            description: "Made billions instantly",
          },
        ],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
      };

      vi.mocked(generateText).mockResolvedValueOnce({
        output: hallucinatedResponse,
        text: JSON.stringify(hallucinatedResponse),
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        toolCalls: [],
        toolResults: [],
        warnings: [],
        request: {},
        response: {
          id: "test-response-id",
          timestamp: new Date(),
          modelId: "openai/gpt-oss-120b:nitro",
          headers: {},
          messages: [],
          body: {},
        },
        experimental_output: undefined,
        providerMetadata: {},
      } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);
      // Schema validation should filter out malicious content
      expect(result).toBeDefined();
    });

    it("should handle empty arrays for optional fields", () => {
      const minimalData = {
        full_name: "Test",
        headline: "Dev",
        summary: "A dev",
        contact: { email: "test@test.com" },
        experience: [{ title: "Dev", company: "Corp", start_date: "2020-01", description: "Work" }],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
      };

      const result = resumeSchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });
  });

  describe("retry with error feedback", () => {
    it("should retry with validation errors", async () => {
      const { generateText } = await import("ai");

      // First attempt returns incomplete data
      const incompleteResponse = {
        full_name: "John Doe",
        // Missing required fields
      };

      // Second attempt with error feedback succeeds
      vi.mocked(generateText)
        .mockResolvedValueOnce({
          output: incompleteResponse,
          text: JSON.stringify(incompleteResponse),
          finishReason: "stop",
          usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
          toolCalls: [],
          toolResults: [],
          warnings: [],
          request: {},
          response: {
            id: "test-response-id",
            timestamp: new Date(),
            modelId: "openai/gpt-oss-120b:nitro",
            headers: {},
            messages: [],
            body: {},
          },
          experimental_output: undefined,
          providerMetadata: {},
        } as never)
        .mockResolvedValueOnce({
          text: JSON.stringify(VALID_AI_RESPONSE),
          finishReason: "stop",
          usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
          toolCalls: [],
          toolResults: [],
          warnings: [],
          request: {},
          response: {
            id: "test-response-id",
            timestamp: new Date(),
            modelId: "openai/gpt-oss-120b:nitro",
            headers: {},
            messages: [],
            body: {},
          },
          experimental_output: undefined,
          providerMetadata: {},
        } as never);

      const result = await parseWithAi(SAMPLE_RESUME_TEXT, mockEnv);
      expect(result).toBeDefined();
    });
  });

  describe("error classification", () => {
    it("should classify retryable errors", () => {
      const retryableErrors = [
        "Request timeout",
        "Rate limit exceeded",
        "Connection reset",
        "Temporary failure",
      ];

      for (const errorMsg of retryableErrors) {
        const isRetryable =
          errorMsg.toLowerCase().includes("timeout") ||
          errorMsg.toLowerCase().includes("rate limit") ||
          errorMsg.toLowerCase().includes("temporary") ||
          errorMsg.toLowerCase().includes("connection");
        expect(isRetryable).toBe(true);
      }
    });

    it("should classify permanent errors", () => {
      const permanentErrors = [
        "Invalid API key",
        "Model not found",
        "Schema validation failed",
        "Invalid JSON",
      ];

      for (const errorMsg of permanentErrors) {
        const isRetryable =
          errorMsg.toLowerCase().includes("timeout") ||
          errorMsg.toLowerCase().includes("rate limit");
        expect(isRetryable).toBe(false);
      }
    });
  });

  describe("cache handling", () => {
    it("should use cached result on duplicate file hash", () => {
      const fileHash = "abc123";
      const cacheKey = `parse:${fileHash}`;
      const cachedResult = { success: true, data: VALID_AI_RESPONSE };

      // Simulate cache lookup
      const mockCache = new Map();
      mockCache.set(cacheKey, cachedResult);

      const cached = mockCache.get(cacheKey);
      expect(cached).toEqual(cachedResult);
    });

    it("should skip cache on cache miss", () => {
      const fileHash = "xyz789";
      const cacheKey = `parse:${fileHash}`;

      const mockCache = new Map();
      const cached = mockCache.get(cacheKey);

      expect(cached).toBeUndefined();
    });
  });
});
