import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  WorkflowEvent,
  WorkflowSleepDuration,
  WorkflowStep,
  WorkflowStepConfig,
} from "cloudflare:workers";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse";

const mocks = vi.hoisted(() => ({
  claimResumeForParse: vi.fn(),
  parseResumePdf: vi.fn(),
  completeParsedResume: vi.fn(),
  markResumeParseFailed: vi.fn(),
  expireWaitingForCache: vi.fn(),
}));

// Runtime-only base class: it just keeps env. `cloudflare:workflows` resolves to
// lib/stubs/cloudflare-workflows-test-stub.mjs via the shared test alias.
vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class WorkflowEntrypoint {
    env: CloudflareEnv;

    constructor(_ctx: ExecutionContext, env: CloudflareEnv) {
      this.env = env;
    }
  },
}));

vi.mock("@/lib/parse/pipeline", () => mocks);

const JOB = {
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "users/user-1/resume-1/resume.pdf",
  fileHash: "a".repeat(64),
};

// SAFETY: every step body is module-mocked, so the env is only passed through.
const ENV = {} as CloudflareEnv;

type StepCall = { name: string; error?: Error };

/** Runs each step body once, recording names and what the body threw. */
function makeStep() {
  const calls: StepCall[] = [];
  const sleeps: Array<{ name: string; duration: WorkflowSleepDuration }> = [];

  // The workflow always passes a step config, so the callback is the third argument.
  const step = {
    do: vi.fn(async <T>(name: string, _config: WorkflowStepConfig, callback: () => Promise<T>) => {
      const call: StepCall = { name };
      calls.push(call);

      try {
        return await callback();
      } catch (error) {
        if (error instanceof Error) call.error = error;
        throw error;
      }
    }),
    sleep: vi.fn(async (name: string, duration: WorkflowSleepDuration) => {
      sleeps.push({ name, duration });
    }),
  };

  // SAFETY: the workflow only calls step.do (with a config) and step.sleep, both implemented above.
  const workflowStep: WorkflowStep = step as never;

  return { step: workflowStep, calls, sleeps };
}

async function run(payload: ResumeParseParams) {
  const { ResumeParseWorkflow } = await import("@/lib/workflows/resume-parse-workflow");
  // SAFETY: the mocked base class ignores ctx.
  const workflow = new ResumeParseWorkflow({} as ExecutionContext, ENV);
  const harness = makeStep();
  // SAFETY: the workflow reads only event.payload.
  const event = { payload } as WorkflowEvent<ResumeParseParams>;

  const result = await workflow.run(event, harness.step).catch((error: Error) => ({ error }));

  return { result, ...harness };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimResumeForParse.mockResolvedValue("parse");
  mocks.parseResumePdf.mockResolvedValue({ parsedContent: {}, career: null });
  mocks.completeParsedResume.mockResolvedValue(undefined);
  mocks.markResumeParseFailed.mockResolvedValue(undefined);
  mocks.expireWaitingForCache.mockResolvedValue(true);
});

describe("ResumeParseWorkflow — parse", () => {
  it("claims, parses, and completes", async () => {
    const { result, calls } = await run({ kind: "parse", ...JOB });

    expect(result).toBe("completed");
    expect(calls.map((c) => c.name)).toEqual(["claim", "parse", "complete"]);
    expect(mocks.completeParsedResume).toHaveBeenCalledWith(
      JOB,
      { parsedContent: {}, career: null },
      ENV,
    );
  });

  it.each(["cached", "skipped"])("stops after the claim when it returns %s", async (outcome) => {
    mocks.claimResumeForParse.mockResolvedValue(outcome);

    const { result, calls } = await run({ kind: "parse", ...JOB });

    expect(result).toBe(outcome);
    expect(calls.map((c) => c.name)).toEqual(["claim"]);
  });

  it("stops when the row left processing mid-run", async () => {
    mocks.parseResumePdf.mockResolvedValue(null);

    const { result, calls } = await run({ kind: "parse", ...JOB });

    expect(result).toBe("skipped");
    expect(calls.map((c) => c.name)).toEqual(["claim", "parse"]);
  });

  it("turns a permanent ParseError into NonRetryableError, then marks the row failed", async () => {
    const { ParseError, ParseErrorType } = await import("@/lib/parse/errors");
    const { NonRetryableError } = await import("cloudflare:workflows");
    mocks.parseResumePdf.mockRejectedValue(
      new ParseError(ParseErrorType.INVALID_PDF, "Invalid PDF structure"),
    );

    const { result, calls } = await run({ kind: "parse", ...JOB });

    const parseCall = calls.find((c) => c.name === "parse");
    expect(parseCall?.error).toBeInstanceOf(NonRetryableError);
    expect(calls.map((c) => c.name)).toEqual(["claim", "parse", "mark failed"]);
    expect(mocks.markResumeParseFailed).toHaveBeenCalledWith(JOB, "Invalid PDF structure", ENV);
    expect(result).toEqual({ error: parseCall?.error });
  });

  it("rethrows a transient ParseError as-is so the step retries it", async () => {
    const { ParseError, ParseErrorType } = await import("@/lib/parse/errors");
    const transient = new ParseError(ParseErrorType.AI_PROVIDER_ERROR, "AI provider timeout");
    mocks.parseResumePdf.mockRejectedValue(transient);

    const { calls } = await run({ kind: "parse", ...JOB });

    expect(calls.find((c) => c.name === "parse")?.error).toBe(transient);
    // The harness does not retry, so the spent step still ends in `mark failed`.
    expect(mocks.markResumeParseFailed).toHaveBeenCalledWith(JOB, "AI provider timeout", ENV);
  });

  it("marks the row failed when completion keeps failing", async () => {
    mocks.completeParsedResume.mockRejectedValue(new Error("db down"));

    const { calls } = await run({ kind: "parse", ...JOB });

    expect(calls.map((c) => c.name)).toEqual(["claim", "parse", "complete", "mark failed"]);
    expect(mocks.markResumeParseFailed).toHaveBeenCalledWith(JOB, "db down", ENV);
  });
});

describe("ResumeParseWorkflow — await-cache", () => {
  it("sleeps for the waiting_for_cache timeout, then expires the row", async () => {
    const { WAITING_FOR_CACHE_TIMEOUT_MS } = await import("@/lib/resume/lifecycle");

    const { result, sleeps } = await run({ kind: "await-cache", resumeId: "resume-2" });

    expect(sleeps).toEqual([
      { name: "wait for cached parse", duration: WAITING_FOR_CACHE_TIMEOUT_MS },
    ]);
    expect(mocks.expireWaitingForCache).toHaveBeenCalledWith("resume-2", ENV);
    expect(result).toBe("expired");
  });

  it("reports resolved when the row was completed while it slept", async () => {
    mocks.expireWaitingForCache.mockResolvedValue(false);

    const { result } = await run({ kind: "await-cache", resumeId: "resume-2" });

    expect(result).toBe("resolved");
  });
});
