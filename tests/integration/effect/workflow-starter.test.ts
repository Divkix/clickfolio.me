import { Effect } from "effect";
import { afterEach, describe, expect, it, vi, type Mock } from "vite-plus/test";
import { WorkflowFailed } from "@/lib/effect/failures";
import { WorkflowStarter } from "@/lib/effect/services/workflow-starter";
import { TIMEOUT_MS } from "@/lib/effect/timeouts";

type Workflow = Parameters<typeof WorkflowStarter.layerFrom>[0];

const PARAMS = { kind: "await-cache", resumeId: "resume_1" } as const;

afterEach(() => {
  vi.useRealTimers();
});

type Fake = {
  create: Mock<() => Promise<{ id: string }>>;
  get: Mock<() => Promise<{ id: string }>>;
};

function binding(overrides: Partial<Fake> = {}): Fake {
  return {
    create: vi.fn(async () => ({ id: "resume_1" })),
    get: vi.fn(async () => ({ id: "resume_1" })),
    ...overrides,
  };
}

function start(fake: Fake | undefined) {
  // SAFETY: the starter only calls create and get; the instances they resolve to are never read.
  const workflow = fake as Workflow;

  return Effect.provide(
    WorkflowStarter.use((starter) => starter.startResumeParse("resume_1", PARAMS)),
    WorkflowStarter.layerFrom(workflow),
  );
}

describe("WorkflowStarter", () => {
  it("creates the run under the given instance id", async () => {
    const workflow = binding();

    await Effect.runPromise(start(workflow));

    expect(workflow.create).toHaveBeenCalledWith({ id: "resume_1", params: PARAMS });
  });

  it("treats a create that errored after the instance was persisted as started", async () => {
    const workflow = binding({
      create: vi.fn(async () => {
        throw new Error("network reset");
      }),
      get: vi.fn(async () => ({ id: "resume_1" })),
    });

    await expect(Effect.runPromise(start(workflow))).resolves.toBeUndefined();
  });

  it("fails WorkflowFailed when create errors and no instance exists", async () => {
    const workflow = binding({
      create: vi.fn(async () => {
        throw new Error("workflow down");
      }),
      get: vi.fn(async () => {
        throw new Error("not found");
      }),
    });

    const failure = await Effect.runPromise(Effect.flip(start(workflow)));

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ operation: "workflow.create.resume_parse" });
  });

  it("fails as unavailable when the binding is missing", async () => {
    const failure = await Effect.runPromise(Effect.flip(start(undefined)));

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ kind: "unavailable" });
  });

  it("fails with a timeout kind when create hangs, without a second create", async () => {
    vi.useFakeTimers();

    const create = vi.fn(() => new Promise<{ id: string }>(() => {}));
    const pending = Effect.runPromise(Effect.flip(start(binding({ create }))));

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS.workflow + 1);

    const failure = await pending;

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ kind: "timeout" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
