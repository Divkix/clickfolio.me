import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { UnknownParseFailure } from "@/lib/parse/failures";
import type { JsonValue } from "@/lib/types/json";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse";
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepContext,
  WorkflowStepRollbackOptions,
} from "cloudflare:workers";

// The real pipeline and alert code behind a fake Workflow engine, to prove that a retry of the
// database step cannot send the failure alert (or the status push) a second time.

const WEBHOOK_URL = "https://hooks.example.test/secret-token";

const mocks = vi.hoisted(() => {
  const state = { updates: 0 };

  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          // Calls alternate primary row, waiting rows: the primary fails, nobody is waiting.
          returning: vi.fn(async () => {
            state.updates += 1;

            return state.updates % 2 === 1 ? [{ totalAttempts: 2, errorMessage: "failed" }] : [];
          }),
        })),
      })),
    })),
  };

  return { state, db, notify: vi.fn(async () => undefined), email: vi.fn() };
});

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

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => mocks.db) }));

vi.mock("@/lib/r2", () => ({ getR2Binding: vi.fn(() => ({})), R2: {} }));

vi.mock("@/lib/resume/completion", () => ({ completeResumes: vi.fn() }));

vi.mock("@/lib/parse/notify-status", () => ({ notifyStatusChange: mocks.notify }));

vi.mock("@/lib/parse/email", () => ({ sendResumeFailureEmail: mocks.email }));

vi.mock("@/lib/utils/log", () => ({ log: vi.fn(), logEvent: vi.fn() }));

vi.mock("@/lib/parse/pipeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/parse/pipeline")>()),
  claimResumeForParse: vi.fn(async () => "parse"),
  parseResumePdf: vi.fn(() => Effect.fail(new UnknownParseFailure({ message: "parse failed" }))),
  readLastParseFailure: vi.fn(async () => null),
}));

const JOB: ResumeParseParams = {
  kind: "parse",
  resumeId: "resume-1",
  userId: "user-1",
  r2Key: "resume.pdf",
  fileHash: "hash",
};

// SAFETY: db, notify-status and email are module-mocked; only the alert settings are read.
const ENV = Object.assign({} as CloudflareEnv, {
  ALERT_CHANNEL: "webhook",
  ALERT_WEBHOOK_URL: WEBHOOK_URL,
});

// A Workflow engine that retries a failing step up to `retries.limit` more times.
// `loseResultOf` runs that step's body to completion and then throws once, as a
// step timeout or a dropped connection does after the side effects already happened.
async function runWorkflow(loseResultOf: string) {
  const { ResumeParseWorkflow } = await import("@/lib/workflows/resume-parse-workflow");
  const journal = new Map<string, JsonValue | void>();
  const runs = new Array<string>();
  let lost = false;

  async function stepDo<T extends Rpc.Serializable<T>>(
    name: string,
    configOrCallback: WorkflowStepConfig | ((context: WorkflowStepContext) => Promise<T>),
    callback?: ((context: WorkflowStepContext) => Promise<T>) | WorkflowStepRollbackOptions<T>,
  ): Promise<T> {
    if (journal.has(name)) {
      // SAFETY: a step name always reuses the result of the same callback.
      return journal.get(name) as T;
    }

    const execute = callback ?? configOrCallback;

    if (!(execute instanceof Function)) throw new Error("Missing workflow callback");

    const config = configOrCallback instanceof Function ? {} : configOrCallback;
    const attempts = (config.retries?.limit ?? 0) + 1;
    let failure: Error = new Error("step never ran");

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      runs.push(name);

      try {
        const result = await execute({ step: { name, count: 1 }, attempt, config: {} });

        if (name === loseResultOf && !lost) {
          lost = true;
          throw new Error("step timed out after its side effects");
        }

        // SAFETY: the steps of this suite return only JSON values or void.
        journal.set(name, result as JsonValue | void);

        return result;
      } catch (error) {
        failure = error instanceof Error ? error : new Error("step failed");
      }
    }

    throw failure;
  }

  // SAFETY: the workflow never touches the execution context.
  const workflow = new ResumeParseWorkflow({} as ExecutionContext, ENV);
  // SAFETY: run only reads payload and timestamp; do/sleep are the only step methods used.
  const event = { payload: JOB, timestamp: new Date() } as WorkflowEvent<ResumeParseParams>;

  const step: WorkflowStep = {
    do: stepDo,
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
    waitForEvent: vi.fn(),
  };

  return { run: () => workflow.run(event, step), runs };
}

const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("ok"));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.updates = 0;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parse failure alert", () => {
  it("is sent once even when the database step is retried after its writes landed", async () => {
    const workflow = await runWorkflow("mark failed");
    await expect(workflow.run()).rejects.toThrow("parse failed");

    // The DB step really did run twice (the row update is idempotent) ...
    expect(workflow.runs.filter((name) => name === "mark failed")).toHaveLength(2);
    // ... but the webhook and the status push each went out once.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(WEBHOOK_URL);
  });

  it("gives the webhook request a timeout", async () => {
    const workflow = await runWorkflow("none");
    await expect(workflow.run()).rejects.toThrow("parse failed");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("is not retried when its own step is lost", async () => {
    const workflow = await runWorkflow("announce parse failure");
    await expect(workflow.run()).rejects.toThrow("parse failed");

    expect(workflow.runs.filter((name) => name === "announce parse failure")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The run still ends with the original failure and the email goes out.
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });
});
