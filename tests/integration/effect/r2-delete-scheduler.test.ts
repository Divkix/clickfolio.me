import { Effect, Exit, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InvalidInput, WorkflowFailed } from "@/lib/effect/failures";
import { R2DeleteScheduler } from "@/lib/effect/services/r2-delete-scheduler";
import { R2Store } from "@/lib/effect/services/r2-store";
import { purgeR2Keys } from "@/lib/workflows/r2-purge";
import { logLines } from "../../helpers/log-lines";

type Workflow = Parameters<typeof R2DeleteScheduler.layerFrom>[0];

type Bucket = Parameters<typeof R2Store.layerFrom>[0];

afterEach(() => {
  vi.restoreAllMocks();
});

function scheduleFailure(workflow: Workflow, params: { keys: string[]; prefix?: string }) {
  return Effect.runPromise(
    Effect.flip(
      Effect.provide(
        R2DeleteScheduler.use((scheduler) => scheduler.schedule(params)),
        R2DeleteScheduler.layerFrom(workflow),
      ),
    ),
  );
}

describe("R2DeleteScheduler", () => {
  it("creates the workflow instance with the validated params", async () => {
    const create = vi.fn(async () => ({ id: "i1" }));

    await Effect.runPromise(
      Effect.provide(
        R2DeleteScheduler.use((scheduler) =>
          scheduler.schedule({ keys: ["users/u1/r1/a.pdf"], prefix: "users/u1/" }),
        ),
        R2DeleteScheduler.layerFrom({ create }),
      ),
    );

    expect(create).toHaveBeenCalledWith({
      params: { keys: ["users/u1/r1/a.pdf"], prefix: "users/u1/" },
    });
  });

  it.each(["", "users/", "users/u1", "/", "users//"])(
    "never sends the sweeping prefix %j to the workflow",
    async (prefix) => {
      const create = vi.fn(async () => ({ id: "i1" }));

      const failure = await scheduleFailure({ create }, { keys: [], prefix });

      expect(failure).toBeInstanceOf(InvalidInput);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("rejects an empty key without sending anything", async () => {
    const create = vi.fn(async () => ({ id: "i1" }));

    const failure = await scheduleFailure({ create }, { keys: ["ok", ""] });

    expect(failure).toBeInstanceOf(InvalidInput);
    expect(create).not.toHaveBeenCalled();
  });

  it("fails as unavailable when the binding is missing", async () => {
    const failure = await scheduleFailure(undefined, { keys: ["k"] });

    expect(failure).toBeInstanceOf(WorkflowFailed);
    expect(failure).toMatchObject({ kind: "unavailable" });
  });

  it("fails with a timeout kind when create hangs", async () => {
    vi.useFakeTimers();

    try {
      const pending = scheduleFailure(
        { create: () => new Promise<{ id: string }>(() => {}) },
        { keys: ["k"] },
      );

      await vi.advanceTimersByTimeAsync(8_001);

      expect(await pending).toMatchObject({
        kind: "timeout",
        operation: "workflow.r2_delete.create",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("purgeR2Keys", () => {
  function bucket(del: Bucket["delete"]): Bucket {
    return {
      get: async () => null,
      put: async () => ({ size: 0, etag: "e" }),
      delete: del,
      head: async () => null,
      list: async () => ({ objects: [], truncated: false }),
    };
  }

  function purge(keys: string[], del: Bucket["delete"], workflow: Workflow) {
    const layer = Layer.mergeAll(
      R2Store.layerFrom(bucket(del)),
      R2DeleteScheduler.layerFrom(workflow),
    );

    return Effect.runPromiseExit(Effect.provide(purgeR2Keys(keys), layer));
  }

  it("does not schedule the workflow when every delete succeeds", async () => {
    const create = vi.fn(async () => ({ id: "i1" }));

    const exit = await purge(["a", "b"], async () => {}, { create });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("hands only the failed keys to the workflow and logs counts, not keys", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const create = vi.fn(async () => ({ id: "i1" }));

    const exit = await purge(
      ["good", "uploads/bad.pdf"],
      async (key) => {
        if (key === "uploads/bad.pdf") throw new Error("R2 unavailable");
      },
      { create },
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(create).toHaveBeenCalledWith({ params: { keys: ["uploads/bad.pdf"] } });
    expect(JSON.stringify(logLines(warn))).not.toContain("bad.pdf");
  });

  it("fails and logs when R2 and the workflow are both unreachable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const exit = await purge(
      ["a"],
      async () => {
        throw new Error("R2 unavailable");
      },
      undefined,
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(logLines(error)[0]).toMatchObject({ level: "error", keyCount: 1 });
  });
});
