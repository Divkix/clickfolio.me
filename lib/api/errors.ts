import { Data } from "effect";
import type { z } from "zod";
import type { UnknownRecord } from "@/lib/types/json";
import type { LogLevel } from "@/lib/utils/log";
import type { ERROR_CODES } from "@/lib/utils/security-headers";

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

type FailureDetails = ReadonlyArray<z.core.$ZodIssue> | UnknownRecord;

/**
 * The failure contract every tagged error a route can fail with implements.
 * `runRoute` (lib/api/route.ts) logs it at `logLevel` and answers with
 * `createErrorResponse(userMessage, code, httpStatus, details, headers)`.
 * `message` and `cause` are logged, never sent. `retryable` says whether the
 * same request can succeed later (Workflows and queues read it; routes never
 * retry).
 *
 * Data.TaggedError assigns constructor args in its base constructor; subclass
 * field initializers run afterwards and overwrite same-named args, so derived
 * members use their own names (`errorCode` → `code`, `issues` → `details`) and
 * getters.
 */
export interface HttpFailure {
  readonly _tag: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly httpStatus: number;
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly logLevel: LogLevel;
  readonly userMessage: string;
  readonly details?: FailureDetails;
  readonly headers?: Readonly<Record<string, string>>;
}

type FailureArgs = { readonly message: string; readonly cause?: unknown };

/** `VALIDATION_ERROR` unless the route's existing wire code is `BAD_REQUEST`. */
export type InvalidInputCode = "VALIDATION_ERROR" | "BAD_REQUEST";

/** A body, header or query value failed validation. `message` is shown to the client. */
export class InvalidInput
  extends Data.TaggedError("InvalidInput")<
    FailureArgs & {
      readonly errorCode?: InvalidInputCode;
      readonly issues?: ReadonlyArray<z.core.$ZodIssue>;
    }
  >
  implements HttpFailure
{
  readonly httpStatus = 400;
  readonly retryable = false;
  readonly logLevel: LogLevel = "info";

  get code(): ErrorCode {
    return this.errorCode ?? "VALIDATION_ERROR";
  }

  get userMessage(): string {
    return this.message;
  }

  get details(): ReadonlyArray<z.core.$ZodIssue> | undefined {
    return this.issues;
  }
}

/** The request body is over the route's size cap. `message` is shown to the client. */
export class PayloadTooLarge
  extends Data.TaggedError("PayloadTooLarge")<FailureArgs>
  implements HttpFailure
{
  readonly httpStatus = 413;
  readonly code: ErrorCode = "BAD_REQUEST";
  readonly retryable = false;
  readonly logLevel: LogLevel = "info";

  get userMessage(): string {
    return this.message;
  }
}
