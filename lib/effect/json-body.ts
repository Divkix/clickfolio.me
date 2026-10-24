import { Effect } from "effect";
import type { z } from "zod";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";
import { InvalidInput, PayloadTooLarge } from "./failures";

/**
 * The 413 for a request that declares a body over the limit, or `null` when it is fine. A plain
 * header check that needs no auth or database: routes run it before they authenticate.
 */
export function oversizedBodyResponse(request: Request): Response | null {
  const sizeCheck = validateRequestSize(request);

  if (sizeCheck.valid) return null;

  return createErrorResponse(
    sizeCheck.error || "Request body too large",
    ERROR_CODES.BAD_REQUEST,
    413,
  );
}

/**
 * The request body as JSON, validated by `schema`. Bad JSON and a body that fails validation are
 * `InvalidInput` (400, with `invalidMessage` for the latter); a body past the limit is
 * `PayloadTooLarge` (413). The issues of a failed validation are not echoed back.
 */
export function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  invalidMessage: string,
): Effect.Effect<z.output<S>, InvalidInput | PayloadTooLarge> {
  return Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => readJsonWithLimit(request),
      // The stream broke mid-read: the client went away, or the body was already consumed and
      // something server-side failed. Keep the cause: `logFailure` logs it, the visitor only sees
      // the fixed message.
      catch: (cause) => new InvalidInput({ message: "Could not read the request body", cause }),
    });

    if (!body.ok) {
      if (body.reason === "too_large") {
        return yield* Effect.fail(new PayloadTooLarge({ message: body.error }));
      }

      return yield* Effect.fail(new InvalidInput({ message: body.error }));
    }

    const parsed = schema.safeParse(body.data);

    if (!parsed.success) return yield* Effect.fail(new InvalidInput({ message: invalidMessage }));

    return parsed.data;
  });
}
