/**
 * The one edge that runs a route's Effect. Handlers keep the
 * `export async function METHOD(request)` form (see lib/auth/with-auth.ts):
 *
 *   return withUser(request, (ctx) => runRoute(request, program(ctx)), "…");
 *
 * Public routes call `runRoute` directly. Failures implement `HttpFailure`
 * (lib/api/errors.ts); a defect or interruption becomes a logged 500.
 */
import { Cause, Effect, Exit } from "effect";
import type { z } from "zod";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";
import { InvalidInput, PayloadTooLarge, type HttpFailure, type InvalidInputCode } from "./errors";

const UNEXPECTED_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

function pathnameOf(request: Request | undefined): string {
  if (!request) return "unknown path";

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

// A caught error never reaches onRequestError, so log it here (with its stack)
// to keep the 500 diagnosable in HyperDX.
export function reportUnhandledError(request: Request | undefined, cause: unknown): void {
  log("error", "Unhandled API route error", {
    ...errorFields(cause),
    path: pathnameOf(request),
    method: request?.method ?? "unknown",
  });
}

export function unexpectedErrorResponse(): Response {
  return createErrorResponse(UNEXPECTED_ERROR_MESSAGE, ERROR_CODES.INTERNAL_ERROR, 500);
}

/**
 * Runs `program` and answers with its Response, or maps its typed failure to
 * `createErrorResponse`. Routes don't retry and never pass `request.signal`
 * (Workers only fires it with the `enable_request_signal` flag).
 */
export async function runRoute<E extends HttpFailure>(
  request: Request,
  program: Effect.Effect<Response, E>,
): Promise<Response> {
  const exit = await Effect.runPromiseExit(program);

  if (Exit.isSuccess(exit)) return exit.value;

  const defect = exit.cause.reasons.find(Cause.isDieReason);
  const failure = exit.cause.reasons.find(Cause.isFailReason)?.error;

  if (defect || !failure) {
    reportUnhandledError(request, defect ? defect.defect : Cause.squash(exit.cause));

    return unexpectedErrorResponse();
  }

  const causeFields =
    failure.cause === undefined ? { "error.message": failure.message } : errorFields(failure.cause);

  log(failure.logLevel, "API route failure", {
    errorType: failure._tag,
    code: failure.code,
    status: failure.httpStatus,
    path: pathnameOf(request),
    method: request.method,
    ...causeFields,
  });

  return createErrorResponse(
    failure.userMessage,
    failure.code,
    failure.httpStatus,
    failure.details,
    failure.headers,
  );
}

interface DecodeOptions {
  /** Sent to the client when validation fails. */
  readonly message: string;
  readonly code?: InvalidInputCode;
}

/** Validates a header, query or body value with Zod; issues become `InvalidInput.details`. */
export function decodeWith<S extends z.ZodType, I>(
  schema: S,
  input: I,
  options: DecodeOptions,
): Effect.Effect<z.output<S>, InvalidInput> {
  return Effect.suspend(() => {
    const parsed = schema.safeParse(input);

    return parsed.success
      ? Effect.succeed(parsed.data)
      : Effect.fail(
          new InvalidInput({
            message: options.message,
            errorCode: options.code,
            issues: parsed.error.issues,
          }),
        );
  });
}

/**
 * Reads a JSON body under the size cap and validates it. A missing, empty or
 * `null` body fails the schema (400), never a property access (500).
 */
export function decodeJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  options: DecodeOptions & { readonly maxBytes?: number },
): Effect.Effect<z.output<S>, InvalidInput | PayloadTooLarge> {
  const { maxBytes } = options;

  return Effect.gen(function* () {
    const sizeCheck = validateRequestSize(request, maxBytes);

    if (!sizeCheck.valid) {
      return yield* new PayloadTooLarge({ message: sizeCheck.error ?? "Request body too large" });
    }

    const body = yield* Effect.tryPromise({
      try: () => readJsonWithLimit(request, maxBytes),
      catch: (cause) =>
        new InvalidInput({ message: "Invalid request body", errorCode: "BAD_REQUEST", cause }),
    });

    if (body.ok) return yield* decodeWith(schema, body.data, options);

    if (body.reason === "too_large") return yield* new PayloadTooLarge({ message: body.error });

    return yield* new InvalidInput({ message: body.error, errorCode: "BAD_REQUEST" });
  });
}
