import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DbFailed, InvalidInput, R2Failed } from "@/lib/effect/failures";
import { runWorkflowStep } from "@/lib/workflows/run-workflow-step";
import { logLines } from "../../helpers/log-lines";

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

describe("runWorkflowStep", () => {
  it("returns the journal payload of a successful step", async () => {
    const value = { deleted: 3 };

    expect(await runWorkflowStep(Effect.succeed(value))).toBe(value);
  });

  it.each(["timeout", "unavailable"] as const)(
    "throws a plain Error for a %s failure so Workflows retries the step",
    async (kind) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = new R2Failed({ operation: "r2.delete_many", kind, message: "R2 down" });

      await expect(runWorkflowStep(Effect.fail(failure))).rejects.toMatchObject({
        name: "Error",
        message: "R2 down",
        cause: { failure: "R2Failed", retryable: true },
      });
      expect(logLines(error)[0]).toMatchObject({
        msg: "workflow step failed",
        operation: "r2.delete_many",
        kind,
      });
    },
  );

  it.each(["rejected", "invalid-response"] as const)(
    "throws NonRetryableError for a %s failure so the step gives up",
    async (kind) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = new DbFailed({ operation: "db.write", kind, message: "bad statement" });

      await expect(runWorkflowStep(Effect.fail(failure))).rejects.toMatchObject({
        name: "NonRetryableError",
        message: "DbFailed: bad statement",
        cause: { failure: "DbFailed", retryable: false },
      });
    },
  );

  it("treats a client failure as permanent", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      runWorkflowStep(Effect.fail(new InvalidInput({ message: "bad params" }))),
    ).rejects.toMatchObject({ name: "NonRetryableError", message: "InvalidInput: bad params" });
  });

  it.each([new Error("defect"), "non-Error defect"])(
    "rethrows the identity of a defect: %s",
    async (defect) => {
      await expect(runWorkflowStep(Effect.die(defect))).rejects.toBe(defect);
    },
  );
});
