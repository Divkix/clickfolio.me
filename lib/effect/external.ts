import { Effect } from "effect";
import { z } from "zod";
import { errorFields } from "@/lib/utils/error-fields";
import { withSpan } from "@/lib/telemetry/spans";
import type { UpstreamDetails, UpstreamKind } from "./failures";

export type ExternalCall<A, E> = {
  /** Low-cardinality, PII-free label: it names the span, the log line and the failure. */
  readonly operation: string;
  readonly timeoutMs: number;
  /** The `AbortSignal` fires on interrupt and on timeout; pass it to anything that accepts one. */
  readonly run: (signal: AbortSignal) => PromiseLike<A>;
  /** Builds the dependency's own tagged error, so callers can `catchTag` per dependency. */
  readonly fail: (details: UpstreamDetails) => E;
  readonly classify?: (cause: unknown) => UpstreamKind;
  /** Postgres already traces every statement; the default is a span per call. */
  readonly span?: boolean;
};

const httpStatusSchema = z.object({ status: z.number() });

const timeoutNameSchema = z.object({ name: z.enum(["AbortError", "TimeoutError"]) });

/** Aborts and HTTP statuses; anything else is assumed transient and left for the retry owner to judge. */
export function classifyUpstreamCause(cause: unknown): UpstreamKind {
  if (timeoutNameSchema.safeParse(cause).success) return "timeout";

  const http = httpStatusSchema.safeParse(cause);

  if (http.success) {
    const { status } = http.data;

    if (status === 408 || status === 429 || status >= 500) return "unavailable";

    if (status >= 400) return "rejected";
  }

  return "unavailable";
}

/**
 * One external call with an explicit timeout and a tagged failure. A timeout interrupts the
 * wait only; bindings and `pg` finish on their own, so never retry a timed-out write here.
 */
export function externalCall<A, E>(call: ExternalCall<A, E>): Effect.Effect<A, E> {
  const classify = call.classify ?? classifyUpstreamCause;
  const withTracing = call.span ?? true;

  return Effect.tryPromise({
    try: (signal) => {
      const start = () => Promise.resolve(call.run(signal));

      return withTracing ? withSpan(call.operation, {}, start) : start();
    },
    catch: (cause) =>
      call.fail({
        operation: call.operation,
        kind: classify(cause),
        message: errorFields(cause)["error.message"],
        cause,
      }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: call.timeoutMs,
      orElse: () =>
        Effect.fail(
          call.fail({
            operation: call.operation,
            kind: "timeout",
            message: `${call.operation} timed out after ${call.timeoutMs}ms`,
          }),
        ),
    }),
  );
}
