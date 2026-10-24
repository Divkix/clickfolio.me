import { Cause, Effect, Exit } from "effect";
import { NonRetryableError } from "cloudflare:workflows";
import { describeFailure } from "@/lib/effect/failure-map";
import type { ServerFailure } from "@/lib/effect/failures";
import type { UnknownRecord } from "@/lib/types/json";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/**
 * `runStep` for steps that fail with a server failure rather than a ParseFailure. Execute
 * only inside step.do: Workflows owns retries and the journal, so nothing here retries.
 * A retryable failure throws a plain Error (the engine retries it); anything else throws
 * NonRetryableError, which ends the step. Defects keep their identity.
 */
export async function runWorkflowStep<A>(effect: Effect.Effect<A, ServerFailure>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) return exit.value;

  for (const reason of exit.cause.reasons) {
    if (Cause.isDieReason(reason)) throw reason.defect;
  }

  for (const reason of exit.cause.reasons) {
    if (!Cause.isFailReason(reason)) continue;
    const failure = reason.error;
    const { retryable, logLevel } = describeFailure(failure);
    const fields = { failure: failure._tag, retryable };
    const entry: UnknownRecord = { ...fields };

    if ("operation" in failure) {
      entry.operation = failure.operation;
      entry.kind = failure.kind;
    }

    Object.assign(
      entry,
      errorFields("cause" in failure && failure.cause ? failure.cause : failure),
    );
    log(logLevel, "workflow step failed", entry);

    const error = retryable
      ? new Error(failure.message)
      : new NonRetryableError(`${failure._tag}: ${failure.message}`);

    // Same shape on both branches so the engine's recorded error says why it gave up or retried.
    error.cause = fields;
    throw error;
  }

  throw Cause.squash(exit.cause);
}
