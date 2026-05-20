import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import type { ResumeContent } from "@/lib/types/database";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { isLocalEnvironment } from "@/lib/utils/environment";
import { classifyError, getErrorMessage, showErrorToast } from "@/lib/utils/errors";
import { formatRelativeTime, truncateText } from "@/lib/utils/format";
import { calculateCompleteness, getProfileSuggestions } from "@/lib/utils/profile-completeness";
import { generateReferralCode } from "@/lib/utils/referral-code";
import {
  generateTempKey,
  validatePDF,
  validatePDFBuffer,
  validateRequestSize,
} from "@/lib/utils/validation";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const completeResume: ResumeContent = {
  full_name: "Avery Quinn",
  headline: "Engineer",
  summary: "Builds products",
  contact: {
    email: "avery@example.com",
    linkedin: "https://linkedin.com/in/avery",
  },
  experience: [
    {
      title: "Engineer",
      company: "Acme",
      start_date: "2024-01",
      description: "Work",
      highlights: [],
    },
    {
      title: "Developer",
      company: "Beta",
      start_date: "2022-01",
      description: "Work",
      highlights: [],
    },
  ],
  education: [{ degree: "BS", institution: "State", graduation_date: "2020" }],
  skills: [{ category: "Languages", items: ["TypeScript"] }],
  certifications: [{ name: "Cert", issuer: "Org", date: "2024" }],
  projects: [],
};

describe("profile completeness utilities", () => {
  it("scores complete and sparse resumes and returns targeted suggestions", () => {
    expect(calculateCompleteness(completeResume)).toBe(100);
    expect(getProfileSuggestions(completeResume)).toEqual([]);

    const sparseResume: ResumeContent = {
      ...completeResume,
      full_name: "",
      headline: "",
      summary: "",
      contact: { email: "" },
      experience: [],
      education: [],
      skills: [],
      certifications: [],
    };

    expect(calculateCompleteness(sparseResume)).toBe(0);
    expect(getProfileSuggestions(sparseResume)).toEqual([
      "Add your education background",
      "List your technical skills",
      "Add certifications to stand out",
      "Add more work experience entries",
      "Link your professional social profiles",
    ]);
  });
});

describe("formatting utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats relative time across minute, hour, day, and date ranges", () => {
    expect(formatRelativeTime("2026-05-20T12:00:00Z")).toBe("Just now");
    expect(formatRelativeTime("2026-05-20T11:58:00Z")).toBe("2 minutes ago");
    expect(formatRelativeTime("2026-05-20T10:00:00Z")).toBe("2 hours ago");
    expect(formatRelativeTime("2026-05-18T12:00:00Z")).toBe("2 days ago");
    expect(formatRelativeTime("2026-02-01T12:00:00Z")).toBe("Feb 1, 2026");
  });

  it("truncates only when text exceeds the requested length", () => {
    expect(truncateText("short", 10)).toBe("short");
    expect(truncateText("a long sentence", 8)).toBe("a long s...");
  });
});

describe("upload validation utilities", () => {
  it("validates PDF files, filenames, buffers, and request sizes", () => {
    expect(validatePDF(new File(["x"], "resume.pdf", { type: "application/pdf" }))).toEqual({
      valid: true,
    });
    expect(validatePDF(new File(["x"], "resume.txt", { type: "text/plain" }))).toEqual({
      valid: false,
      error: "Only PDF files are allowed",
    });
    expect(
      validatePDF(new File([new Uint8Array(6_000_000)], "large.pdf", { type: "application/pdf" })),
    ).toEqual({
      valid: false,
      error: "File size must be less than 5MB",
    });

    expect(validatePDFBuffer(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer)).toEqual({
      valid: true,
    });
    expect(validatePDFBuffer(new Uint8Array([0x00, 0x50, 0x44, 0x46]).buffer)).toEqual({
      valid: false,
      error: "File is not a valid PDF (invalid magic number)",
    });

    const cleanKey = generateTempKey("../my resume!.txt");
    expect(cleanKey).toMatch(/^temp\/00000000-0000-0000-0000-000000000001\/my_resume_\.txt\.pdf$/);

    expect(validateRequestSize(new Request("https://example.com"))).toEqual({ valid: true });
    expect(
      validateRequestSize(
        new Request("https://example.com", { headers: { "content-length": "not-a-number" } }),
      ),
    ).toEqual({ valid: false, error: "Invalid content-length header" });
    expect(
      validateRequestSize(
        new Request("https://example.com", { headers: { "content-length": "6" } }),
        5,
      ),
    ).toEqual({
      valid: false,
      error: "Request body too large (0.0MB). Maximum size is 0.0MB.",
    });
    expect(
      validateRequestSize(
        new Request("https://example.com", { headers: { "content-length": "5" } }),
        5,
      ),
    ).toEqual({ valid: true });
  });
});

describe("clipboard utilities", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;
  let consoleError: MockInstance;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
    consoleError.mockRestore();
  });

  it("uses the Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand and reports failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyToClipboard("fallback")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");

    document.execCommand = vi.fn(() => {
      throw new Error("blocked");
    });
    await expect(copyToClipboard("blocked")).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("error and environment utilities", () => {
  const originalHref = window.location.href;
  const originalAuthUrl = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    toastError.mockClear();
    process.env.BETTER_AUTH_URL = originalAuthUrl;
    window.history.replaceState({}, "", originalHref);
  });

  it("classifies status codes and returns user-facing messages", () => {
    expect(classifyError(401)).toBe("auth");
    expect(classifyError(403)).toBe("auth");
    expect(classifyError(404)).toBe("fatal");
    expect(classifyError(422)).toBe("validation");
    expect(classifyError(400)).toBe("validation");
    expect(classifyError(429)).toBe("rate_limit");
    expect(classifyError(503)).toBe("transient");
    expect(classifyError(0)).toBe("transient");
    expect(classifyError(418)).toBe("fatal");

    expect(getErrorMessage(413)).toBe("File too large. Maximum size is 5MB.");
    expect(getErrorMessage(499, "upload")).toBe("Something went wrong with upload.");
  });

  it("shows category-specific toasts and detects local app URLs", () => {
    showErrorToast(401);
    const authToastOptions = toastError.mock.calls[0]?.[1] as { action?: { onClick: () => void } };
    authToastOptions.action?.onClick();
    expect(window.location.href).toBe("http://localhost:3000/");

    showErrorToast(429);
    expect(toastError).toHaveBeenCalledWith(expect.any(String), { duration: 10000 });

    showErrorToast(500, "profile");
    expect(toastError).toHaveBeenCalledWith("Server error. We're working on it.");

    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    expect(isLocalEnvironment()).toBe(true);
    process.env.BETTER_AUTH_URL = "https://clickfolio.me";
    expect(isLocalEnvironment()).toBe(false);
  });
});

describe("referral code generation", () => {
  it("generates alphabet-safe codes and falls back if Web Crypto fails", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const getRandomValues = vi.spyOn(crypto, "getRandomValues").mockImplementation(() => {
      throw new Error("no crypto");
    });
    const mathRandom = vi.spyOn(Math, "random").mockReturnValue(0.123456);
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(1_779_248_853_000);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(generateReferralCode()).toHaveLength(8);

    getRandomValues.mockRestore();
    mathRandom.mockRestore();
    dateNow.mockRestore();
    consoleError.mockRestore();
  });
});
