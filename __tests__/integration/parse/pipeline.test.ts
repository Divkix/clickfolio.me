import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ParseError, ParseErrorType } from "@/lib/parse/errors";
import type { UnknownRecord } from "@/lib/types/json";

// Step bodies of ResumeParseWorkflow, driven against an in-memory Drizzle stand-in.

const mocks = vi.hoisted(() => {
  // selectResults: each select() call takes the next queued result, in call order.
  // updateReturning: each update().returning() takes the next one; default is one row.
  const state = {
    selectResults: new Array<UnknownRecord[]>(),
    updateReturning: new Array<UnknownRecord[]>(),
    updateSets: new Array<UnknownRecord>(),
    r2: new Map<string, ArrayBuffer>(),
  };

  const selectChain = () => {
    const rows = state.selectResults.shift() ?? [];

    const where = vi.fn(() => ({
      limit: vi.fn(async () => rows),
      then: (onFulfilled: (value: UnknownRecord[]) => void, onRejected?: (e: Error) => void) =>
        Promise.resolve(rows).then(onFulfilled, onRejected),
    }));

    return { from: vi.fn(() => ({ where })) };
  };

  const updateChain = () => ({
    set: vi.fn((values: UnknownRecord) => {
      state.updateSets.push(values);

      return {
        where: vi.fn(() => ({
          returning: vi.fn(async () => state.updateReturning.shift() ?? [{ id: "row" }]),
          then: (onFulfilled: (value: { count: number }) => void) =>
            Promise.resolve({ count: 1 }).then(onFulfilled),
        })),
      };
    }),
  });

  const db = {
    select: vi.fn(selectChain),
    update: vi.fn(updateChain),
  };

  return {
    state,
    db,
    completeResumes: vi.fn(async (_input: UnknownRecord) => undefined),
    notifyStatusChange: vi.fn(async (_input: UnknownRecord) => undefined),
    sendAlert: vi.fn(async (_payload: UnknownRecord) => undefined),
    parseResumeWithAi: vi.fn(),
    classifyCareer: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mocks.db) }));

vi.mock("@/lib/r2", () => ({
  getR2Binding: vi.fn(() => ({})),
  R2: {
    getAsArrayBuffer: vi.fn(async (_binding: R2Bucket, key: string) => mocks.state.r2.get(key)),
  },
}));

vi.mock("@/lib/resume/completion", () => ({ completeResumes: mocks.completeResumes }));

vi.mock("@/lib/parse/notify-status", () => ({ notifyStatusChange: mocks.notifyStatusChange }));

vi.mock("@/lib/parse/alert", () => ({
  getAlertChannel: vi.fn(() => "logpush"),
  sendAlert: mocks.sendAlert,
}));

vi.mock("@/lib/ai", () => ({ parseResumeWithAi: mocks.parseResumeWithAi }));

vi.mock("@/lib/ai/career", () => ({ classifyCareer: mocks.classifyCareer }));

const VALID_CONTENT = {
  full_name: "Test User",
  headline: "Developer",
  summary: "Experienced developer.",
  contact: { email: "test@example.com" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

const JOB = {
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "users/user-1/resume-1/resume.pdf",
  fileHash: "a".repeat(64),
};

// SAFETY: getDb, R2, notify-status and alerting are module-mocked, so the steps never
// touch a binding; the env only has to exist.
const ENV = {} as CloudflareEnv;

function pdfBuffer(): ArrayBuffer {
  const bytes = new TextEncoder().encode("%PDF-1.4 test");

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.selectResults = [];
  mocks.state.updateReturning = [];
  mocks.state.updateSets = [];
  mocks.state.r2.clear();
  mocks.parseResumeWithAi.mockResolvedValue({
    success: true,
    parsedContent: JSON.stringify(VALID_CONTENT),
  });
  mocks.classifyCareer.mockResolvedValue({ role: "mid_level", isFreelance: false });
});

describe("claimResumeForParse", () => {
  it("moves a queued row to processing and notifies", async () => {
    const { claimResumeForParse } = await import("@/lib/parse/pipeline");
    mocks.state.selectResults.push([{ status: "queued" }], []);

    await expect(claimResumeForParse(JOB, ENV)).resolves.toBe("parse");

    expect(mocks.state.updateSets).toEqual([expect.objectContaining({ status: "processing" })]);
    expect(mocks.notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: JOB.resumeId, status: "processing" }),
    );
  });

  it.each([
    ["missing", []],
    ["already completed", [{ status: "completed" }]],
  ])("skips a %s row without writing", async (_label, current) => {
    const { claimResumeForParse } = await import("@/lib/parse/pipeline");
    mocks.state.selectResults.push(current, []);

    await expect(claimResumeForParse(JOB, ENV)).resolves.toBe("skipped");
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("skips when the row left a claimable status before the UPDATE", async () => {
    const { claimResumeForParse } = await import("@/lib/parse/pipeline");
    mocks.state.selectResults.push([{ status: "queued" }], []);
    mocks.state.updateReturning.push([]);

    await expect(claimResumeForParse(JOB, ENV)).resolves.toBe("skipped");
    expect(mocks.notifyStatusChange).not.toHaveBeenCalled();
  });

  it("completes from an identical earlier parse without calling the AI", async () => {
    const { claimResumeForParse } = await import("@/lib/parse/pipeline");
    const cached = { ...VALID_CONTENT };
    mocks.state.selectResults.push([{ status: "queued" }], [{ parsedContent: cached }]);

    await expect(claimResumeForParse(JOB, ENV)).resolves.toBe("cached");

    expect(mocks.completeResumes).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ resumeId: JOB.resumeId, userId: JOB.userId }],
        parsedContent: cached,
      }),
    );
    expect(mocks.completeResumes.mock.calls[0][0]).not.toHaveProperty("career");
    expect(mocks.completeResumes.mock.calls[0][0]).not.toHaveProperty("professionalLevel");
    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
  });
});

describe("parseResumePdf", () => {
  it("returns validated content and counts the attempt in SQL", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());

    const parsed = await parseResumePdf(JOB, ENV);

    expect(parsed?.parsedContent.full_name).toBe("Test User");
    expect(parsed?.career).toEqual({ role: "mid_level", isFreelance: false });
    expect(mocks.classifyCareer).toHaveBeenCalledWith(parsed?.parsedContent, ENV);
    // Evaluated by the database so a replayed step cannot lose an attempt.
    expect(mocks.state.updateSets[0].totalAttempts).toHaveProperty("queryChunks");
  });

  it("returns null without parsing when the row is no longer processing", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([]);

    await expect(parseResumePdf(JOB, ENV)).resolves.toBeNull();
    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
  });

  it("throws a permanent ParseError and records it when the PDF is missing", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");

    await expect(parseResumePdf(JOB, ENV)).rejects.toSatisfy(
      (error: ParseError) => error instanceof ParseError && !error.isRetryable(),
    );
    expect(mocks.state.updateSets).toContainEqual({
      lastAttemptError: expect.stringContaining("Failed to fetch PDF"),
    });
  });

  it("records a friendly message when the AI reports failure", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockResolvedValue({ success: false, error: "PDF is encrypted" });

    await expect(parseResumePdf(JOB, ENV)).rejects.toThrow("PDF is encrypted");
    expect(mocks.state.updateSets).toContainEqual({
      errorMessage: "Your PDF is password-protected. Please upload an unprotected version.",
    });
  });

  it("throws a retryable ParseError for a transient AI failure without failing the row", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockRejectedValue(
      new ParseError(ParseErrorType.AI_PROVIDER_ERROR, "AI provider timeout"),
    );

    await expect(parseResumePdf(JOB, ENV)).rejects.toSatisfy(
      (error: ParseError) => error instanceof ParseError && error.isRetryable(),
    );
    expect(mocks.state.updateSets).not.toContainEqual(
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("completeParsedResume", () => {
  const parsed = {
    parsedContent: VALID_CONTENT,
    career: { role: "senior" as const, isFreelance: true },
  };

  it("completes the row and fans out to identical uploads waiting on it", async () => {
    const { completeParsedResume } = await import("@/lib/parse/pipeline");
    mocks.state.selectResults.push([{ id: "waiting-1", userId: JOB.userId }]);

    await completeParsedResume(JOB, parsed, ENV);

    expect(mocks.completeResumes).toHaveBeenCalledTimes(2);
    expect(mocks.completeResumes).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ career: parsed.career }),
    );
    expect(mocks.completeResumes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [{ resumeId: "waiting-1", userId: JOB.userId }],
        career: parsed.career,
        fanOut: true,
      }),
    );
  });

  it("completes only the row itself when nothing is waiting", async () => {
    const { completeParsedResume } = await import("@/lib/parse/pipeline");

    await completeParsedResume(JOB, { ...parsed, career: null }, ENV);

    expect(mocks.completeResumes).toHaveBeenCalledTimes(1);
    expect(mocks.completeResumes).toHaveBeenCalledWith(expect.objectContaining({ career: null }));
  });
});

describe("markResumeParseFailed", () => {
  it("fails the row, notifies, and alerts with the attempt count", async () => {
    const { markResumeParseFailed } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([{ totalAttempts: 4 }]);

    await markResumeParseFailed(JOB, "Failed to fetch PDF from R2: key", ENV);

    expect(mocks.state.updateSets[0]).toMatchObject({ status: "failed" });
    // COALESCE keeps a friendlier message written by the parse step.
    expect(mocks.state.updateSets[0].errorMessage).toHaveProperty("queryChunks");
    expect(mocks.notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(mocks.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: JOB.resumeId, totalAttempts: 4 }),
      "logpush",
      ENV,
    );
  });

  it("does nothing more when the row is gone or already completed", async () => {
    const { markResumeParseFailed } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([]);

    await markResumeParseFailed(JOB, "boom", ENV);

    expect(mocks.notifyStatusChange).not.toHaveBeenCalled();
    expect(mocks.sendAlert).not.toHaveBeenCalled();
  });
});

describe("expireWaitingForCache", () => {
  it("persists the timeout and notifies when the row is still waiting", async () => {
    const { expireWaitingForCache } = await import("@/lib/parse/pipeline");

    await expect(expireWaitingForCache(JOB.resumeId, ENV)).resolves.toBe(true);
    expect(mocks.state.updateSets[0]).toMatchObject({ status: "failed" });
    expect(mocks.notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: JOB.resumeId, status: "failed" }),
    );
  });

  it("leaves a row that already resolved alone", async () => {
    const { expireWaitingForCache } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([]);

    await expect(expireWaitingForCache(JOB.resumeId, ENV)).resolves.toBe(false);
    expect(mocks.notifyStatusChange).not.toHaveBeenCalled();
  });
});
