import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { R2DeleteParams } from "@/lib/workflows/r2-delete-params";
import type {
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepContext,
  WorkflowStepRollbackOptions,
} from "cloudflare:workers";

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

afterEach(() => {
  vi.restoreAllMocks();
});

type Page = Awaited<ReturnType<R2Bucket["list"]>>;

async function setup(bucket: Pick<R2Bucket, "delete" | "list">) {
  const { R2DeleteWorkflow } = await import("@/lib/workflows/r2-delete-workflow");
  const names: string[] = [];

  async function journal<T extends Rpc.Serializable<T>>(
    name: string,
    configOrCallback: WorkflowStepConfig | ((context: WorkflowStepContext) => Promise<T>),
    callback?: ((context: WorkflowStepContext) => Promise<T>) | WorkflowStepRollbackOptions<T>,
  ): Promise<T> {
    names.push(name);
    const execute = callback ?? configOrCallback;

    if (!(execute instanceof Function)) throw new Error("Missing workflow callback");

    return execute({ step: { name, count: 1 }, attempt: 1, config: {} });
  }

  // SAFETY: the workflow only reads CLICKFOLIO_R2_BUCKET from env and never uses the context.
  const workflow = new R2DeleteWorkflow(
    {} as ExecutionContext,
    {
      CLICKFOLIO_R2_BUCKET: bucket,
    } as CloudflareEnv,
  );

  const step: WorkflowStep = {
    do: journal,
    sleep: vi.fn(),
    sleepUntil: vi.fn(),
    waitForEvent: vi.fn(),
  };

  return {
    names,
    run: (payload: R2DeleteParams) =>
      // SAFETY: run only reads the payload.
      workflow.run({ payload } as WorkflowEvent<R2DeleteParams>, step),
  };
}

function bucket(overrides: Partial<Pick<R2Bucket, "delete" | "list">> = {}) {
  return {
    delete: vi.fn(async () => {}),
    list: vi.fn(async (): Promise<Page> => ({
      objects: [],
      delimitedPrefixes: [],
      truncated: false,
    })),
    ...overrides,
  };
}

describe("R2DeleteWorkflow", () => {
  it("deletes explicit keys in one journaled batch step", async () => {
    const r2 = bucket();
    const { run, names } = await setup(r2);

    expect(await run({ keys: ["a", "b", "a"] })).toBe(2);
    expect(names).toEqual(["delete batch 0"]);
    expect(r2.delete).toHaveBeenCalledWith(["a", "b"]);
  });

  it("lists the prefix in a step and merges its keys with the explicit ones", async () => {
    const list = vi.fn(async (): Promise<Page> => {
      // SAFETY: the workflow reads only `key` from listed objects.
      const objects = [{ key: "users/u1/r1/a.pdf" }, { key: "b" }] as R2Object[];

      return { objects, delimitedPrefixes: [], truncated: false };
    });

    const r2 = bucket({ list });
    const { run, names } = await setup(r2);

    expect(await run({ keys: ["b", "c"], prefix: "users/u1/" })).toBe(3);
    expect(names).toEqual(["list users/u1/", "delete batch 0"]);
    expect(r2.delete).toHaveBeenCalledWith(["b", "c", "users/u1/r1/a.pdf"]);
  });

  it("rethrows an R2 outage as a plain Error so the step is retried", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const r2 = bucket({
      delete: vi.fn(async () => {
        throw new Error("R2 unavailable");
      }),
    });

    const { run } = await setup(r2);

    await expect(run({ keys: ["a"] })).rejects.toMatchObject({
      name: "Error",
      message: "R2 unavailable",
    });
  });

  it.each(["", "users/", "users/u1"])(
    "refuses the sweeping prefix %j without touching R2",
    async (prefix) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const r2 = bucket();
      const { run } = await setup(r2);

      await expect(run({ keys: ["a"], prefix })).rejects.toMatchObject({
        name: "NonRetryableError",
      });
      expect(r2.list).not.toHaveBeenCalled();
      expect(r2.delete).not.toHaveBeenCalled();
    },
  );
});
