import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WorkflowEvent, WorkflowStep, WorkflowStepConfig } from "cloudflare:workers";
import type { R2DeleteParams, R2DeleteWorkflowBinding } from "@/lib/workflows/r2-delete";

const mocks = vi.hoisted(() => ({
  r2Delete: vi.fn(async (_bucket: R2Bucket, _key: string) => undefined),
  log: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  WorkflowEntrypoint: class WorkflowEntrypoint {
    env: CloudflareEnv;

    constructor(_ctx: ExecutionContext, env: CloudflareEnv) {
      this.env = env;
    }
  },
}));

vi.mock("@/lib/r2", () => ({ R2: { delete: mocks.r2Delete } }));

vi.mock("@/lib/utils/log", () => ({ log: mocks.log }));

// SAFETY: deleteR2Objects hands the bucket only to the mocked R2.delete.
const BUCKET = {} as R2Bucket;

function makeWorkflowBinding(failCreate = false) {
  const create = vi.fn(async (_options: { params: R2DeleteParams }) => {
    if (failCreate) throw new Error("create failed");

    return { id: "r2-delete-1" };
  });

  // SAFETY: the helpers only call `create` on the binding, implemented above.
  const binding: R2DeleteWorkflowBinding = { create } as never;

  return { binding, create };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.r2Delete.mockResolvedValue(undefined);
});

describe("scheduleR2Deletion", () => {
  it("starts an instance with the keys and prefix", async () => {
    const { scheduleR2Deletion } = await import("@/lib/workflows/r2-delete");
    const { binding, create } = makeWorkflowBinding();

    await scheduleR2Deletion(binding, { keys: ["a"], prefix: "users/u1/" });

    expect(create).toHaveBeenCalledWith({ params: { keys: ["a"], prefix: "users/u1/" } });
  });

  it("throws when the binding is missing so callers can fall back", async () => {
    const { scheduleR2Deletion } = await import("@/lib/workflows/r2-delete");

    await expect(scheduleR2Deletion(undefined, { keys: ["a"] })).rejects.toThrow(
      "CLICKFOLIO_R2_DELETE_WORKFLOW",
    );
  });
});

describe("deleteR2Objects", () => {
  it("deletes inline and schedules nothing when every delete succeeds", async () => {
    const { deleteR2Objects } = await import("@/lib/workflows/r2-delete");
    const { binding, create } = makeWorkflowBinding();

    await expect(deleteR2Objects(BUCKET, binding, ["a", "b"])).resolves.toEqual([]);
    expect(mocks.r2Delete).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });

  it("hands only the failed keys to the workflow", async () => {
    const { deleteR2Objects } = await import("@/lib/workflows/r2-delete");
    const { binding, create } = makeWorkflowBinding();
    mocks.r2Delete.mockRejectedValueOnce(new Error("R2 timeout"));

    await expect(deleteR2Objects(BUCKET, binding, ["a", "b"])).resolves.toEqual(["a"]);
    expect(create).toHaveBeenCalledWith({ params: { keys: ["a"] } });
  });

  it("logs and still reports the failed keys when scheduling fails", async () => {
    const { deleteR2Objects } = await import("@/lib/workflows/r2-delete");
    const { binding } = makeWorkflowBinding(true);
    mocks.r2Delete.mockRejectedValueOnce(new Error("R2 timeout"));

    await expect(deleteR2Objects(BUCKET, binding, ["a"])).resolves.toEqual(["a"]);
    expect(mocks.log).toHaveBeenCalledWith(
      "error",
      "failed to schedule R2 deletion",
      expect.objectContaining({ keys: ["a"] }),
    );
  });
});

describe("R2DeleteWorkflow", () => {
  function makeStep() {
    const names: string[] = [];

    const step = {
      do: vi.fn(
        async <T>(name: string, _config: WorkflowStepConfig, callback: () => Promise<T>) => {
          names.push(name);

          return callback();
        },
      ),
    };

    // SAFETY: the workflow only calls step.do (always with a config), implemented above.
    const workflowStep: WorkflowStep = step as never;

    return { step: workflowStep, names };
  }

  async function run(payload: R2DeleteParams, bucket: Partial<R2Bucket>) {
    const { R2DeleteWorkflow } = await import("@/lib/workflows/r2-delete-workflow");
    // SAFETY: the workflow reads only env.CLICKFOLIO_R2_BUCKET; ctx is ignored by the mocked base.
    const env = { CLICKFOLIO_R2_BUCKET: bucket } as CloudflareEnv;
    // SAFETY: the mocked WorkflowEntrypoint base ignores ctx.
    const workflow = new R2DeleteWorkflow({} as ExecutionContext, env);
    const harness = makeStep();
    // SAFETY: the workflow reads only event.payload.
    const event = { payload } as WorkflowEvent<R2DeleteParams>;

    return { count: await workflow.run(event, harness.step), names: harness.names };
  }

  it("lists the prefix page by page, dedupes, and deletes in batches of 1000", async () => {
    const listed = Array.from({ length: 1500 }, (_, i) => ({ key: `users/u1/${i}.pdf` }));

    const list = vi
      .fn()
      .mockResolvedValueOnce({ objects: listed.slice(0, 1000), truncated: true, cursor: "c1" })
      .mockResolvedValueOnce({ objects: listed.slice(1000), truncated: false });

    const del = vi.fn(async (_keys: string[]) => undefined);

    const { count, names } = await run(
      { keys: ["users/u1/0.pdf", "users/u1/extra.pdf"], prefix: "users/u1/" },
      { list, delete: del },
    );

    expect(list).toHaveBeenLastCalledWith({ prefix: "users/u1/", limit: 1000, cursor: "c1" });
    expect(count).toBe(1501);
    expect(names).toEqual(["list users/u1/", "delete batch 0", "delete batch 1000"]);
    expect(del.mock.calls[0][0]).toHaveLength(1000);
    expect(del.mock.calls[1][0]).toHaveLength(501);
  });

  it("deletes the given keys without listing when no prefix is set", async () => {
    const list = vi.fn();
    const del = vi.fn(async (_keys: string[]) => undefined);

    const { count, names } = await run({ keys: ["a", "b"] }, { list, delete: del });

    expect(count).toBe(2);
    expect(list).not.toHaveBeenCalled();
    expect(names).toEqual(["delete batch 0"]);
    expect(del).toHaveBeenCalledWith(["a", "b"]);
  });
});
