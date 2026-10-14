import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { JsonValue } from "@/lib/types/json";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse";
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepRollbackOptions,
} from "cloudflare:workers";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(async () => "parse"),
  parse: vi.fn(async () => {
    throw new Error("Original parse failure");
  }),
  complete: vi.fn(),
  fail: vi.fn(),
  expire: vi.fn(async () => true),
  email: vi.fn(),
  log: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class {
    constructor(
      _ctx: ExecutionContext,
      public env: CloudflareEnv,
    ) {}
  },
}));

vi.mock("cloudflare:workflows", () => ({ NonRetryableError: class extends Error {} }));

vi.mock("@/lib/parse/pipeline", () => ({
  claimResumeForParse: mocks.claim,
  parseResumePdf: mocks.parse,
  completeParsedResume: mocks.complete,
  markResumeParseFailed: mocks.fail,
  expireWaitingForCache: mocks.expire,
}));

vi.mock("@/lib/parse/email", () => ({ sendResumeFailureEmail: mocks.email }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

const JOB: ResumeParseParams = {
  kind: "parse",
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "resume.pdf",
  fileHash: "hash",
};

async function runWorkflow(params = JOB, emailTimeout = false) {
  const { ResumeParseWorkflow } = await import("@/lib/workflows/resume-parse-workflow");
  const results = new Map<string, JsonValue | void>();

  const doStep = vi.fn();

  async function journal<T extends Rpc.Serializable<T>>(
    name: string,
    configOrCallback: WorkflowStepConfig | ((...args: never[]) => Promise<T>),
    callback?: ((...args: never[]) => Promise<T>) | WorkflowStepRollbackOptions<T>,
  ): Promise<T> {
    doStep(name, configOrCallback, callback);

    if (results.has(name)) {
      // SAFETY: a step name always reuses the result of the same callback.
      return results.get(name) as T;
    }

    if (emailTimeout && name === "email parse failure") throw new Error("Email step timed out");
    const execute = callback ?? configOrCallback;

    if (!(execute instanceof Function)) throw new Error("Missing workflow callback");
    const result = await execute();
    // SAFETY: mocked steps in this suite return only JSON values or void.
    results.set(name, result as JsonValue | void);

    return result;
  }

  // SAFETY: mocks supply all workflow steps and bindings exercised by this test.
  const workflow = new ResumeParseWorkflow({} as ExecutionContext, {} as CloudflareEnv);
  // SAFETY: run only reads payload; do/sleep are the only step methods used.
  const event = { payload: params } as WorkflowEvent<ResumeParseParams>;

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
