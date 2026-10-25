import { Cause, Effect, Exit, type Layer } from "effect";
import { errorFields } from "@/lib/utils/error-fields";
import type { UnknownRecord } from "@/lib/types/json";
import { log } from "@/lib/utils/log";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { describeFailure } from "./failure-map";
import { failureDetailFields } from "./failure-fields";
import type { ServerFailure } from "./failures";

// The request, page and background edges. Everything else yields services and returns Effects;
// a Workflow step runs its own Effect in `runWorkflowStep`. Layers are built here, once per
// invocation, so no pool, client or token outlives its request.

const UNEXPECTED_MESSAGE = "An unexpected error occurred. Please try again.";

type EdgeLogFields = { readonly path?: string; readonly method?: string };

function pathnameOf(request: Request | undefined): string {
  if (!request) return "unknown path";

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

/** Logs a typed failure at the level its description asks for; the cause is scrubbed first. */
export function logFailure(failure: ServerFailure, fields: EdgeLogFields = {}): void {
  const { logLevel, status, retryable } = describeFailure(failure);
  const entry: UnknownRecord = { failure: failure._tag, status, retryable, ...fields };

  Object.assign(entry, failureDetailFields(failure));

  log(logLevel, "request failed", entry);
}

export function failureResponse(failure: ServerFailure): Response {
  const { status, code, userMessage, retryAfterSeconds } = describeFailure(failure);

  return createErrorResponse(userMessage, code, status, undefined, retryAfterSeconds);
}

function failureOf<E>(exit: Exit.Exit<unknown, E>): E | null {
  if (Exit.isSuccess(exit)) return null;

  for (const reason of exit.cause.reasons) {
    if (Cause.isFailReason(reason)) return reason.error;
  }

  return null;
}

/** Server route edge: typed failures become the standard error body, defects a logged generic 500. */
export async function runRoute<R>(
  request: Request | undefined,
  program: Effect.Effect<Response, ServerFailure, R>,
  layer: Layer.Layer<R>,
): Promise<Response> {
  const exit = await Effect.runPromiseExit(Effect.provide(program, layer));

  if (Exit.isSuccess(exit)) return exit.value;

  const fields = { path: pathnameOf(request), method: request?.method ?? "unknown" };
  const failure = failureOf(exit);

  if (failure) {
    logFailure(failure, fields);

    return failureResponse(failure);
  }

  log("error", "Unhandled API route error", {
    ...errorFields(Cause.squash(exit.cause)),
    ...fields,
  });

  return createErrorResponse(UNEXPECTED_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
}

/**
 * Page loader edge (the server function behind a route loader): returns the value, or throws so
 * the route's error component renders. Throw `redirect()` / `notFound()` on the result, never
 * inside `program`.
 */
export async function runPage<A, R>(
  program: Effect.Effect<A, ServerFailure, R>,
  layer: Layer.Layer<R>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(Effect.provide(program, layer));

  if (Exit.isSuccess(exit)) return exit.value;

  const failure = failureOf(exit);

  if (failure) {
    logFailure(failure);

    throw new Error(describeFailure(failure).userMessage, { cause: failure });
  }

  throw Cause.squash(exit.cause);
}

/**
 * Background edge (cron tick, queue batch, Durable Object call): hands the `Exit` back so the
 * caller decides what to acknowledge, retry or rethrow for the platform to record.
 */
export function runBackground<A, E, R>(
  program: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>,
): Promise<Exit.Exit<A, E>> {
  return Effect.runPromiseExit(Effect.provide(program, layer));
}
