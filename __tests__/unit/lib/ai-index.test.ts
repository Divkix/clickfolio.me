import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseResumeWithAi } from "@/lib/ai";

const mocks = vi.hoisted(() => ({
  extractPdfText: vi.fn(),
  parseWithAi: vi.fn(),
}));

vi.mock("@/lib/ai/pdf-extract", () => ({
  extractPdfText: (...args: unknown[]) => mocks.extractPdfText(...args),
}));

vi.mock("@/lib/ai/ai-parser", () => ({
  parseWithAi: (...args: unknown[]) => mocks.parseWithAi(...args),
}));

const validAiData = {
  full_name: "Avery Quinn",
  headline: "Staff Engineer",
  summary: "Builds reliable products.",
  contact: {
    email: " AVERY@EXAMPLE.COM ",
    linkedin: "javascript:alert(1)",
    github: "https://github.com/avery",
    website: "https://avery.dev",
  },
  experience: [
    {
      title: "Lead Engineer",
      company: "Acme",
      start_date: "2020",
      end_date: "Present",
      description: "Built systems.",
    },
  ],
  professional_level: "senior",
};

describe("parseResumeWithAi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractPdfText.mockResolvedValue({
      success: true,
      text: "Avery Quinn\n\nStaff Engineer",
    });
    mocks.parseWithAi.mockResolvedValue({
      success: true,
      data: structuredClone(validAiData),
      structuredOutput: true,
    });
  });

  it("returns extraction, empty-text, AI parse, and thrown errors without parsing content", async () => {
    mocks.extractPdfText.mockResolvedValueOnce({ success: false, error: "PDF failed" });
    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: false,
      error: "PDF failed",
    });

    mocks.extractPdfText.mockResolvedValueOnce({ success: true, text: " \n\t " });
    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: false,
      error: "Extracted resume text is empty",
    });

    mocks.parseWithAi.mockResolvedValueOnce({ success: false, error: "AI failed" });
    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: false,
      error: "AI failed",
    });

    mocks.extractPdfText.mockRejectedValueOnce(new Error("boom"));
    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: false,
      error: "boom",
    });
  });

  it("normalizes long resume text and validates structured AI output with safe defaults", async () => {
    mocks.extractPdfText.mockResolvedValueOnce({
      success: true,
      text: `Avery\r\n${" ".repeat(4)}Quinn\n\n\n${"x".repeat(70000)}`,
    });

    const result = await parseResumeWithAi(new ArrayBuffer(1), { CF_AI_GATEWAY_ID: "gateway" });

    expect(result.success).toBe(true);
    expect(result.professionalLevel).toBe("senior");
    expect(mocks.parseWithAi.mock.calls[0][0]).toContain("...[truncated]...");
    const parsed = JSON.parse(result.parsedContent);
    expect(parsed.professional_level).toBeUndefined();
    expect(parsed.contact.email).toBe("avery@example.com");
    expect(parsed.contact.linkedin).toBeUndefined();
    expect(parsed.experience[0].end_date).toBeUndefined();
    expect(parsed.education).toBeUndefined();
    expect(parsed.skills).toBeUndefined();
  });

  it("retries invalid AI output with validation feedback and reports final validation failure", async () => {
    mocks.parseWithAi
      .mockResolvedValueOnce({
        success: true,
        data: {
          full_name: "",
          headline: "",
          summary: "",
          contact: { email: "bad" },
          experience: [],
        },
        structuredOutput: true,
      })
      .mockResolvedValueOnce({
        success: true,
        data: structuredClone(validAiData),
        structuredOutput: false,
      });

    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: true,
    });
    expect(mocks.parseWithAi).toHaveBeenLastCalledWith(
      expect.any(String),
      {},
      undefined,
      expect.objectContaining({
        previousOutput: expect.stringContaining("full_name"),
        errors: expect.stringContaining("Full name is required"),
      }),
    );

    mocks.parseWithAi
      .mockResolvedValueOnce({
        success: true,
        data: {
          full_name: "",
          headline: "",
          summary: "",
          contact: { email: "bad" },
          experience: [],
        },
        structuredOutput: true,
      })
      .mockResolvedValueOnce({
        success: false,
        error: "retry failed",
      });

    await expect(parseResumeWithAi(new ArrayBuffer(1), {})).resolves.toMatchObject({
      success: false,
      error: "AI response failed schema validation",
    });
  });
});
