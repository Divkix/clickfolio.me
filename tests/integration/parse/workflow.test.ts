import { Effect } from "effect";
import {
  AiProviderFailed,
  PdfInvalid,
  UnknownParseFailure,
  toParseErrorJson,
} from "@/lib/parse/failures";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_AI_MODEL } from "@/lib/ai/prompt-config";
import type { JsonValue } from "@/lib/types/json";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse";
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepContext,
  WorkflowStepRollbackOptions,
} from "cloudflare:workers";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(async () => "parse"),
  parse: vi.fn(),
  readFailure: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  announce: vi.fn(),
  expire: vi.fn(async () => true),
  email: vi.fn(),
  log: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class {
    constructor(
      _ctx: ExecutionContext,
      public env: CloudflareEnv,
    ) {}
  },
}));

vi.mock("cloudflare:workflows", () => ({
  NonRetryableError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NonRetryableError";
    }
  },
}));

vi.mock("@/lib/parse/pipeline", () => ({
  claimResumeForParse: mocks.claim,
  parseResumePdf: mocks.parse,
  readLastParseFailure: mocks.readFailure,
  completeParsedResume: mocks.complete,
  markResumeParseFailed: mocks.fail,
  announceResumeParseFailure: mocks.announce,
  expireWaitingForCache: mocks.expire,
}));

vi.mock("@/lib/parse/email", () => ({ sendResumeFailureEmail: mocks.email }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log, logEvent: mocks.logEvent }));

const JOB: ResumeParseParams = {
  kind: "parse",
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "resume.pdf",
  fileHash: "hash",
};

async function runWorkflow(
  params = JOB,
  emailTimeout = false,
  replayedParseError?: Error,
  retryParseOnce = false,
) {
  const { ResumeParseWorkflow } = await import("@/lib/workflows/resume-parse-workflow");
  const results = new Map<string, JsonValue | void>();

  const doStep = vi.fn();

  async function journal<T extends Rpc.Serializable<T>>(
    name: string,
    configOrCallback: WorkflowStepConfig | ((context: WorkflowStepContext) => Promise<T>),
    callback?: ((context: WorkflowStepContext) => Promise<T>) | WorkflowStepRollbackOptions<T>,
  ): Promise<T> {
    doStep(name, configOrCallback, callback);

    if (results.has(name)) {
      // SAFETY: a step name always reuses the result of the same callback.
      return results.get(name) as T;
    }

    if (name === "parse" && replayedParseError) throw replayedParseError;

    if (emailTimeout && name === "email parse failure") throw new Error("Email step timed out");
    const execute = callback ?? configOrCallback;

    if (!(execute instanceof Function)) throw new Error("Missing workflow callback");

    const context = (attempt: number): WorkflowStepContext => ({
      step: { name, count: 1 },
      attempt,
      config: {},
    });

    const result = await Promise.resolve(execute(context(1))).catch((error: Error) => {
      if (name === "parse" && retryParseOnce && error.name === "Error") return execute(context(2));

      throw error;
    });

    // SAFETY: mocked steps in this suite return only JSON values or void.
    results.set(name, result as JsonValue | void);

    return result;
  }

  // SAFETY: mocks supply all workflow steps and bindings exercised by this test.
  const workflow = new ResumeParseWorkflow({} as ExecutionContext, {} as CloudflareEnv);
  // SAFETY: run only reads payload and timestamp; do/sleep are the only step methods used.
  const event = { payload: params, timestamp: new Date() } as WorkflowEvent<ResumeParseParams>;

  const step: WorkflowStep = {
    do: journal,
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
    waitForEvent: vi.fn(),
  };

  return { run: () => workflow.run(event, step), doStep };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claim.mockResolvedValue("parse");
  mocks.parse.mockReturnValue(
    Effect.fail(new UnknownParseFailure({ message: "Original parse failure" })),
  );
  mocks.readFailure.mockResolvedValue(null);
  mocks.expire.mockResolvedValue(true);
});

describe("resume failure email workflow step", () => {
  it("sends after terminal updates, uses no retries, and reuses the journal on replay", async () => {
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(mocks.fail.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.email.mock.invocationCallOrder[0],
    );
    expect(workflow.doStep).toHaveBeenCalledWith(
      "email parse failure",
      expect.objectContaining({ retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" }),
      expect.any(Function),
    );
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });

  it("announces the failure in its own no-retry step between the DB write and the email", async () => {
    const notice = { failure: toParseErrorJson(new UnknownParseFailure({ message: "x" })) };
    mocks.fail.mockResolvedValueOnce({ ...notice, totalAttempts: 2, waitingIds: [] });
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(workflow.doStep).toHaveBeenCalledWith(
      "announce parse failure",
      expect.objectContaining({ retries: { limit: 0, delay: "1 second" }, timeout: "30 seconds" }),
      expect.any(Function),
    );
    expect(mocks.announce).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: "resume-1" }),
      expect.objectContaining({ totalAttempts: 2, waitingIds: [] }),
      expect.any(Object),
    );
    expect(mocks.fail.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.announce.mock.invocationCallOrder[0],
    );
    expect(mocks.announce.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.email.mock.invocationCallOrder[0],
    );
  });

  it("does not announce when the row was already gone, and survives a failed announcement", async () => {
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(mocks.announce).not.toHaveBeenCalled();

    mocks.fail.mockResolvedValueOnce({ failure: {}, totalAttempts: 1, waitingIds: [] });
    mocks.announce.mockRejectedValueOnce(new Error("announce exploded"));
    const second = await runWorkflow();
    await expect(second.run()).rejects.toThrow("Original parse failure");
    expect(mocks.announce).toHaveBeenCalledTimes(1);
    // Once per run: the failed announcement did not stop the second run's email.
    expect(mocks.email).toHaveBeenCalledTimes(2);
  });

  it("logs each failed attempt and the terminal failure with its type and stack", async () => {
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("Original parse failure");

    expect(mocks.logEvent).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "resume parse attempt failed",
      expect.objectContaining({ resumeId: "resume-1", errorType: "unknown", retryable: false }),
    );
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "resume_parse_failed",
      expect.objectContaining({
        resumeId: "resume-1",
        attempts: 1,
        duration_ms: expect.any(Number),
        errorType: "unknown",
        "error.message": expect.stringContaining("Original parse failure"),
        stack: expect.stringContaining("at "),
      }),
      "error",
    );
  });

  it("waits for failed-status work to succeed before emailing", async () => {
    mocks.fail.mockRejectedValueOnce(new Error("Waiting-row update failed"));
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("Waiting-row update failed");
    expect(mocks.email).not.toHaveBeenCalled();
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });

  it("preserves the original parse failure when the email step times out", async () => {
    const workflow = await runWorkflow(JOB, true);
    await expect(workflow.run()).rejects.toThrow("Original parse failure");
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each([true, false])("emails an await-cache job only if it expired: %s", async (expired) => {
    mocks.expire.mockResolvedValue(expired);
    const workflow = await runWorkflow({ kind: "await-cache", resumeId: "resume-1" });
    await expect(workflow.run()).resolves.toBe(expired ? "expired" : "resolved");
    expect(mocks.email).toHaveBeenCalledTimes(expired ? 1 : 0);
  });

  it("skips emails for a cached parse", async () => {
    mocks.claim.mockResolvedValue("cached");
    const workflow = await runWorkflow();
    await expect(workflow.run()).resolves.toBe("cached");
    expect(mocks.email).not.toHaveBeenCalled();
  });
});

describe("Workflow failure metadata and successful replay", () => {
  it("uses the stored wire error when a replay loses the thrown error metadata", async () => {
    const stored = toParseErrorJson(
      new PdfInvalid({ message: "old encrypted PDF", reason: "encrypted" }),
    );

    mocks.readFailure.mockResolvedValue(stored);
    const workflow = await runWorkflow(JOB, false, new Error("serialized workflow failure"));
    await expect(workflow.run()).rejects.toThrow("serialized workflow failure");
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({ resumeId: "resume-1" }),
      stored,
      expect.any(Object),
    );
  });

  it("prefers the current typed failure when its DB write failed and the row is stale", async () => {
    const current = new PdfInvalid({ message: "current encrypted PDF", reason: "encrypted" });
    mocks.parse.mockReturnValue(Effect.fail(current));
    mocks.readFailure.mockResolvedValue(
      toParseErrorJson(new AiProviderFailed({ message: "previous failure" })),
    );
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toMatchObject({ name: "NonRetryableError" });
    expect(mocks.fail.mock.calls[0][1]).toEqual(toParseErrorJson(current));
  });

  it("replays a successful parse payload unchanged when complete must retry", async () => {
    const parsed = { parsedContent: { full_name: "Legacy User" } };
    mocks.parse.mockReturnValue(Effect.succeed(parsed));
    mocks.complete.mockRejectedValueOnce(new Error("ECONNRESET"));
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("ECONNRESET");
    expect(mocks.readFailure).not.toHaveBeenCalled();
    expect(mocks.fail.mock.calls[0][1]).toMatchObject({
      type: "db_connection_error",
      isRetryable: true,
    });
    await expect(workflow.run()).resolves.toBe("completed");
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.complete).toHaveBeenLastCalledWith(expect.any(Object), parsed, expect.any(Object));
    expect(workflow.doStep).toHaveBeenCalledWith(
      "parse",
      { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" },
      expect.any(Function),
    );
  });
});

describe("parse outcome events", () => {
  it("counts the parse step's attempts in the run's one completion event", async () => {
    mocks.parse
      .mockReturnValueOnce(Effect.fail(new AiProviderFailed({ message: "provider down" })))
      .mockReturnValueOnce(Effect.succeed({ parsedContent: { full_name: "User" }, career: null }));
    const workflow = await runWorkflow(JOB, false, undefined, true);
    await expect(workflow.run()).resolves.toBe("completed");
    expect(mocks.logEvent).toHaveBeenCalledOnce();
    expect(mocks.logEvent).toHaveBeenCalledWith("resume_parse_completed", {
      resumeId: "resume-1",
      model: DEFAULT_AI_MODEL,
      attempts: 2,
      duration_ms: expect.any(Number),
    });
  });

  it("leaves attempts unknown when the parse result is replayed from the journal", async () => {
    mocks.parse.mockReturnValue(Effect.succeed({ parsedContent: { full_name: "User" } }));
    mocks.complete.mockRejectedValueOnce(new Error("ECONNRESET"));
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toThrow("ECONNRESET");
    mocks.logEvent.mockClear();
    await expect(workflow.run()).resolves.toBe("completed");
    expect(mocks.logEvent).toHaveBeenCalledWith(
      "resume_parse_completed",
      expect.objectContaining({ attempts: undefined }),
    );
  });
});

describe("current defects", () => {
  it("does not replace a fresh defect with a previous attempt's stored error", async () => {
    const defect = new Error("current programming defect");
    mocks.parse.mockReturnValue(Effect.die(defect));
    mocks.readFailure.mockResolvedValue(
      toParseErrorJson(new AiProviderFailed({ message: "previous provider failure" })),
    );
    const workflow = await runWorkflow();
    await expect(workflow.run()).rejects.toBe(defect);
    expect(mocks.fail.mock.calls[0][1]).toMatchObject({
      message: "current programming defect",
      type: "unknown",
    });
    expect(mocks.readFailure).not.toHaveBeenCalled();
  });
});

describe("latest Workflow failure", () => {
  it("forgets a recovered parse failure before marking a completion failure", async () => {
    mocks.parse
      .mockReturnValueOnce(
        Effect.fail(new AiProviderFailed({ message: "recovered provider failure" })),
      )
      .mockReturnValueOnce(Effect.succeed({ parsedContent: { full_name: "User" }, career: null }));
    mocks.complete.mockRejectedValueOnce(new Error("ECONNRESET"));
    const workflow = await runWorkflow(JOB, false, undefined, true);
    await expect(workflow.run()).rejects.toThrow("ECONNRESET");
    expect(mocks.parse).toHaveBeenCalledTimes(2);
    expect(mocks.fail.mock.calls[0][1]).toMatchObject({
      type: "db_connection_error",
      message: "ECONNRESET",
    });
  });

  it("uses a replayed database failure instead of an older stored parse failure", async () => {
    mocks.readFailure.mockResolvedValue(
      toParseErrorJson(new PdfInvalid({ message: "old PDF failure", reason: "corrupt" })),
    );
    const workflow = await runWorkflow(JOB, false, new Error("ECONNRESET"));
    await expect(workflow.run()).rejects.toThrow("ECONNRESET");
    expect(mocks.fail.mock.calls[0][1]).toMatchObject({
      type: "db_connection_error",
      message: "ECONNRESET",
    });
  });
});
