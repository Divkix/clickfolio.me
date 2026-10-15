import { Cause, Effect, Exit } from "effect";
import { NonRetryableError } from "cloudflare:workflows";
import { toParseErrorJson, type ParseFailure } from "../parse/failures";

/** Execute only inside step.do: Cloudflare owns retries and the step journal. */
export async function runStep<A>(effect: Effect.Effect<A, ParseFailure>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) return exit.value;

  // Defects retain their identity, including mixed failure/defect causes.
  for (const reason of exit.cause.reasons) {
    if (Cause.isDieReason(reason)) throw reason.defect;
  }

  for (const reason of exit.cause.reasons) {
    if (!Cause.isFailReason(reason)) continue;
    const failure = reason.error;

    const error = failure.retryable
      ? new Error(failure.message)
      : new NonRetryableError(`${failure.wireType}: ${failure.message}`);

    // Preserve the engine's default NonRetryableError name. The explicit cause
    // also retains wire metadata if recording the parse attempt failed.
    error.cause = toParseErrorJson(failure);
    throw error;
  }

  throw Cause.squash(exit.cause);
}
