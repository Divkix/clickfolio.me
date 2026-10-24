import { Cause, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DbFailed, InvalidInput, R2Failed } from "@/lib/effect/failures";
import { AiProviderFailed, AiTimedOut, PdfInvalid, toParseErrorJson } from "@/lib/parse/failures";
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

  it("logs a timed-out step's message and flags that its outcome is unknown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const failure = new R2Failed({
      operation: "r2.delete_many",
      kind: "timeout",
      message: "r2.delete_many timed out after 30000ms",
    });

    await expect(runWorkflowStep(Effect.fail(failure))).rejects.toMatchObject({ name: "Error" });

    expect(logLines(error)[0]).toMatchObject({
      msg: "workflow step failed",
      failure: "R2Failed",
      operation: "r2.delete_many",
      kind: "timeout",
      outcome_unknown: true,
      "error.message": "r2.delete_many timed out after 30000ms",
    });
  });

  it("treats a client failure as permanent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      runWorkflowStep(Effect.fail(new InvalidInput({ message: "bad params" }))),
    ).rejects.toMatchObject({ name: "NonRetryableError", message: "InvalidInput: bad params" });

    expect(logLines(warn)[0]).toMatchObject({ "error.message": "bad params" });
  });

  it.each([new Error("defect"), "non-Error defect"])(
    "rethrows the identity of a defect: %s",
    async (defect) => {
      await expect(runWorkflowStep(Effect.die(defect))).rejects.toBe(defect);
    },
  );

  it("preserves a defect even when its Cause also has a typed failure", async () => {
    const defect = new Error("programming defect");

    const cause = Cause.combine(
      Cause.fail(new PdfInvalid({ message: "bad PDF", reason: "corrupt" })),
      Cause.die(defect),
    );

    await expect(runWorkflowStep(Effect.failCause(cause))).rejects.toBe(defect);
  });

  describe("with a ParseFailure", () => {
    it("uses the exact NonRetryableError name and keeps the wire metadata in the cause", async () => {
      const failure = new PdfInvalid({ message: "encrypted PDF", reason: "encrypted" });

      await expect(runWorkflowStep(Effect.fail(failure))).rejects.toMatchObject({
        name: "NonRetryableError",
        message: "invalid_pdf: encrypted PDF",
        cause: toParseErrorJson(failure),
      });
    });

    it("throws a plain Error for Workflows to retry", async () => {
      const failure = new AiProviderFailed({ message: "provider offline" });

      await expect(runWorkflowStep(Effect.fail(failure))).rejects.toMatchObject({
        name: "Error",
        message: "provider offline",
        cause: toParseErrorJson(failure),
      });
    });

    it("leaves logging to the parse failure handler", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(
        runWorkflowStep(Effect.fail(new AiTimedOut({ message: "AI timed out" }))),
      ).rejects.toBeInstanceOf(Error);
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
