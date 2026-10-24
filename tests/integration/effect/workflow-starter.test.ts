import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InvalidInput, WorkflowFailed } from "@/lib/effect/failures";
import { WorkflowStarter } from "@/lib/effect/services/workflow-starter";
import type { ResumeParseParams } from "@/lib/workflows/resume-parse-params";
import { logLines } from "../../helpers/log-lines";

type Binding = NonNullable<Parameters<typeof WorkflowStarter.layerFrom>[0]>;

const PARSE: ResumeParseParams = {
  kind: "parse",
  resumeId: "r1",
  userId: "u1",
  r2Key: "users/u1/r1/cv.pdf",
  fileHash: "abc",
};

const AWAIT_CACHE: ResumeParseParams = { kind: "await-cache", resumeId: "r1" };

function binding(overrides: Partial<Binding> = {}): Binding {
  return {
    create: async () => ({ id: "r1" }),
    get: async () => {
      throw new Error("instance.not_found");
    },
    ...overrides,
  };
}

function start(workflow: Binding | undefined, params: ResumeParseParams = PARSE) {
  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        WorkflowStarter.use((starter) => starter.startResumeParse("r1", params)),
        WorkflowStarter.layerFrom(workflow),
      ),
    ),
  );
}

function startOk(workflow: Binding, params: ResumeParseParams = PARSE) {
  return Effect.runPromise(
    Effect.provide(
      WorkflowStarter.use((starter) => starter.startResumeParse("r1", params)),
      WorkflowStarter.layerFrom(workflow),
    ),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkflowStarter.startResumeParse", () => {
  it("creates the instance under the given id with the validated params", async () => {
    const create = vi.fn<Binding["create"]>(async () => ({ id: "r1" }));

    await startOk(binding({ create }), AWAIT_CACHE);

    expect(create).toHaveBeenCalledWith({ id: "r1", params: AWAIT_CACHE });
  });

  it("treats a create that failed after the instance was persisted as started", async () => {
    const get = vi.fn<Binding["get"]>(async () => ({ id: "r1" }));

    await startOk(
      binding({
        create: async () => {
          throw new Error("instance.already_exists");
        },
        get,
      }),
    );

    expect(get).toHaveBeenCalledWith("r1");
  });

  it("fails with the create error when the instance does not exist, and logs the lookup", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const failure = await start(
      binding({
        create: async () => {
          throw new Error("Workflows unavailable");
        },
      }),
    );

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ operation: "workflow.resume_parse.create" });
    expect(logLines(warn)[0]).toMatchObject({
      level: "warn",
      msg: "resume parse instance not found after create failed",
    });
  });

  it("fails with a timeout kind when create hangs, after checking the instance", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const get = vi.fn<Binding["get"]>(async () => {
        throw new Error("instance.not_found");
      });

      const pending = start(binding({ create: () => new Promise(() => {}), get }));

      await vi.advanceTimersByTimeAsync(8_001);

      expect(await pending).toMatchObject({
        kind: "timeout",
        operation: "workflow.resume_parse.create",
      });
      expect(get).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails as unavailable when the binding is missing", async () => {
    const failure = await start(undefined);

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ kind: "unavailable" });
  });

  it("refuses a malformed payload without calling the workflow", async () => {
    const create = vi.fn<Binding["create"]>(async () => ({ id: "r1" }));

    // SAFETY: a non-string hash is the malformed payload this test sends on purpose.
    const malformed = { ...PARSE, fileHash: 7 as never };

    const failure = await start(binding({ create }), malformed);

    expect(failure).toBeInstanceOf(InvalidInput);
    expect(create).not.toHaveBeenCalled();
  });
});
