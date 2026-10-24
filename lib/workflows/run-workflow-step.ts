import { Cause, Effect, Exit } from "effect";
import { NonRetryableError } from "cloudflare:workflows";
import { failureDetailFields } from "@/lib/effect/failure-fields";
import { describeFailure } from "@/lib/effect/failure-map";
import type { ServerFailure } from "@/lib/effect/failures";
import type { UnknownRecord } from "@/lib/types/json";
import { isParseFailure, toParseErrorJson, type ParseFailure } from "@/lib/parse/failures";
import { log } from "@/lib/utils/log";

/**
 * The one adapter between an Effect and `step.do`. Execute only inside step.do: Workflows owns
 * retries and the journal, so nothing here retries. A retryable failure throws a plain Error
 * (the engine retries it); anything else throws NonRetryableError, which ends the step. Defects
 * keep their identity.
 *
 * A ParseFailure keeps its wire metadata in `cause` (`toParseErrorJson`), which the parse
 * workflow's failure handler reads back to store the error type; it is not logged here because
 * that handler logs the outcome once. Any other failure is logged through the same detail
 * fields as the route edge.
 */
export async function runWorkflowStep<A>(
  effect: Effect.Effect<A, ServerFailure | ParseFailure>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) return exit.value;

  for (const reason of exit.cause.reasons) {
    if (Cause.isDieReason(reason)) throw reason.defect;
  }

  for (const reason of exit.cause.reasons) {
    if (!Cause.isFailReason(reason)) continue;
    const failure = reason.error;

    if (isParseFailure(failure)) {
      const error = failure.retryable
        ? new Error(failure.message)
        : new NonRetryableError(`${failure.wireType}: ${failure.message}`);

      // Keep the engine's default NonRetryableError name; the cause also retains the wire
      // metadata if recording the parse attempt failed.
      error.cause = toParseErrorJson(failure);
      throw error;
    }

    const { retryable, logLevel } = describeFailure(failure);
    const fields = { failure: failure._tag, retryable };
    const entry: UnknownRecord = { ...fields, ...failureDetailFields(failure) };

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
