import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { Effect } from "effect";
import { ParseErrorType } from "@/lib/parse/errors";
import {
  AiProviderFailed,
  PdfInvalid,
  R2ObjectMissing,
  UnknownParseFailure,
  toParseErrorJson,
} from "@/lib/parse/failures";
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
    classifyCareerEffect: vi.fn(),
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

vi.mock("@/lib/ai/career", () => ({ classifyCareerEffect: mocks.classifyCareerEffect }));

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
  mocks.parseResumeWithAi.mockReturnValue(Effect.succeed(VALID_CONTENT));
  mocks.classifyCareerEffect.mockReturnValue(
    Effect.succeed({ role: "mid_level", isFreelance: false }),
  );
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

    const parsed = await Effect.runPromise(parseResumePdf(JOB, ENV));

    expect(parsed?.parsedContent.full_name).toBe("Test User");
    expect(parsed?.career).toEqual({ role: "mid_level", isFreelance: false });
    expect(mocks.classifyCareerEffect).toHaveBeenCalledWith(parsed?.parsedContent, ENV);
    // Evaluated by the database so a replayed step cannot lose an attempt.
    expect(mocks.state.updateSets[0].totalAttempts).toHaveProperty("queryChunks");
  });

  it("returns null without parsing when the row is no longer processing", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([]);

    await expect(Effect.runPromise(parseResumePdf(JOB, ENV))).resolves.toBeNull();
    expect(mocks.parseResumeWithAi).not.toHaveBeenCalled();
  });

  it("throws a permanent tagged failure and records it when the PDF is missing", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");

    const failure = await Effect.runPromise(Effect.flip(parseResumePdf(JOB, ENV)));
    expect(failure).toBeInstanceOf(R2ObjectMissing);
    expect(failure.retryable).toBe(false);
    expect(mocks.state.updateSets).toContainEqual(
      expect.objectContaining({
        lastAttemptError: expect.stringContaining("Failed to fetch PDF"),
      }),
    );
  });

  it("records a friendly message when the AI reports failure", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(
      Effect.fail(new PdfInvalid({ message: "PDF is encrypted", reason: "encrypted" })),
    );

    await expect(Effect.runPromise(parseResumePdf(JOB, ENV))).rejects.toThrow("PDF is encrypted");
    expect(mocks.state.updateSets).toContainEqual(
      expect.objectContaining({
        errorMessage: "Your PDF is password-protected. Please upload an unprotected version.",
      }),
    );
  });

  it("throws a retryable tagged failure for a transient AI failure without failing the row", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(
      Effect.fail(new AiProviderFailed({ message: "AI provider timeout" })),
    );

    const failure = await Effect.runPromise(Effect.flip(parseResumePdf(JOB, ENV)));
    expect(failure).toBeInstanceOf(AiProviderFailed);
    expect(failure.retryable).toBe(true);
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
  it("fails the row and reports the attempt count without notifying or alerting", async () => {
    const { markResumeParseFailed } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([{ totalAttempts: 4 }], []);

    const stored = toParseErrorJson(
      new R2ObjectMissing({ message: "Failed to fetch PDF from R2" }),
    );

    const notice = await markResumeParseFailed(JOB, stored, ENV);

    expect(mocks.state.updateSets[0]).toMatchObject({ status: "failed" });
    // COALESCE keeps a friendlier message written by the parse step.
    expect(mocks.state.updateSets[0].errorMessage).toHaveProperty("queryChunks");
    expect(notice).toEqual({ failure: stored, totalAttempts: 4, waitingIds: [] });
    expect(mocks.notifyStatusChange).not.toHaveBeenCalled();
    expect(mocks.sendAlert).not.toHaveBeenCalled();
  });

  it("fails identical uploads waiting on this parse with the same message", async () => {
    const { markResumeParseFailed } = await import("@/lib/parse/pipeline");

    const friendly =
      "No text could be extracted from your scanned PDF. Try a clearer photo or export as text PDF.";

    mocks.state.updateReturning.push(
      [{ totalAttempts: 1, errorMessage: friendly }],
      [{ id: "waiting-1" }, { id: "waiting-2" }],
    );

    const notice = await markResumeParseFailed(
      JOB,
      toParseErrorJson(new PdfInvalid({ message: friendly, reason: "scanned-empty" })),
      ENV,
    );

    expect(mocks.state.updateSets[1]).toMatchObject({ status: "failed", errorMessage: friendly });
    expect(JSON.parse(String(mocks.state.updateSets[1].lastAttemptError))).toMatchObject({
      type: ParseErrorType.INVALID_PDF,
    });
    expect(notice).toMatchObject({ waitingIds: ["waiting-1", "waiting-2"] });
  });

  it("returns nothing to announce when the row is gone or already completed", async () => {
    const { markResumeParseFailed } = await import("@/lib/parse/pipeline");
    mocks.state.updateReturning.push([]);

    await expect(
      markResumeParseFailed(
        JOB,
        toParseErrorJson(new UnknownParseFailure({ message: "boom" })),
        ENV,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.state.updateSets).toHaveLength(1);
  });
});

describe("announceResumeParseFailure", () => {
  const failure = toParseErrorJson(new UnknownParseFailure({ message: "failure" }));

  it("notifies the row and its waiting rows, then alerts with the attempt count", async () => {
    const { announceResumeParseFailure } = await import("@/lib/parse/pipeline");

    await announceResumeParseFailure(
      JOB,
      { failure, totalAttempts: 4, waitingIds: ["waiting-1", "waiting-2"] },
      ENV,
    );

    for (const resumeId of [JOB.resumeId, "waiting-1", "waiting-2"]) {
      expect(mocks.notifyStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({ resumeId, status: "failed" }),
      );
    }

    expect(mocks.sendAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: JOB.resumeId, totalAttempts: 4 }),
      "logpush",
      ENV,
    );
  });

  it("still alerts when notifications reject, and resolves when alerting rejects", async () => {
    const { announceResumeParseFailure } = await import("@/lib/parse/pipeline");
    mocks.notifyStatusChange
      .mockRejectedValueOnce(new Error("DO unavailable"))
      .mockRejectedValueOnce(new Error("DO unavailable"));
    mocks.sendAlert.mockRejectedValueOnce(new Error("webhook unavailable"));

    await expect(
      announceResumeParseFailure(
        JOB,
        { failure, totalAttempts: 4, waitingIds: ["waiting-1"] },
        ENV,
      ),
    ).resolves.toBeUndefined();

    expect(mocks.sendAlert).toHaveBeenCalled();
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

describe("typed parse failure boundaries", () => {
  it.each([
    ["NoSuchKey", "R2ObjectMissing", false],
    ["R2 object does not exist", "R2ObjectMissing", false],
    ["object not found (404)", "R2ObjectMissing", false],
    ["R2 binding not available", "R2BindingMissing", false],
    ["R2 temporarily unavailable", "R2Throttled", true],
  ])("classifies R2 %s at its source", async (message, tag, retryable) => {
    const { R2 } = await import("@/lib/r2");
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    vi.mocked(R2.getAsArrayBuffer).mockRejectedValueOnce(new Error(message));
    await expect(Effect.runPromise(parseResumePdf(JOB, ENV))).rejects.toMatchObject({
      _tag: tag,
      retryable,
    });
  });

  it("records a defect while retaining its identity", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    const defect = new Error("unexpected transform bug");
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockReturnValue(Effect.die(defect));
    await expect(Effect.runPromise(parseResumePdf(JOB, ENV))).rejects.toBe(defect);
    expect(mocks.state.updateSets).toContainEqual(
      expect.objectContaining({
        lastAttemptError: expect.stringContaining("unexpected transform bug"),
      }),
    );
  });

  it("keeps the original failure when recording it also fails", async () => {
    const { parseResumePdf } = await import("@/lib/parse/pipeline");
    const failure = new PdfInvalid({ message: "encrypted", reason: "encrypted" });
    mocks.state.r2.set(JOB.r2Key, pdfBuffer());
    mocks.parseResumeWithAi.mockImplementationOnce(() => {
      mocks.db.update.mockImplementationOnce(() => {
        throw new Error("database connection reset");
      });

      return Effect.fail(failure);
    });
    await expect(Effect.runPromise(parseResumePdf(JOB, ENV))).rejects.toBe(failure);
  });
});
