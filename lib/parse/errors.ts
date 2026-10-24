import { z } from "zod";
import {
  AiTimedOut,
  type ParseErrorJson,
  DbUnavailable,
  SchemaRejected,
  UnknownParseFailure,
  isParseFailure,
  type ParseFailure,
} from "./failures";
import { ParseErrorType } from "./error-types";

export type { ParseErrorJson } from "./failures";

/** The wire shape of a stored parse failure: a jsonb column, a step output and an error cause. */
export const storedErrorSchema = z.object({
  name: z.string(),
  type: z.enum(ParseErrorType),
  message: z.string(),
  isRetryable: z.boolean(),
  originalError: z.unknown().optional(),
});

export function decodeParseError(cause: unknown): ParseErrorJson | null {
  const parsed = storedErrorSchema.safeParse(cause);

  return parsed.success ? { ...parsed.data, originalError: parsed.data.originalError } : null;
}

export function readStoredParseError(raw: string | null): ParseErrorJson | null {
  if (!raw) return null;

  try {
    return decodeParseError(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Only foreign database/network errors reach this fallback. PDF, AI and R2
// failures are tagged at their own I/O boundaries instead of guessed from text.
export function classifyParseError(cause: unknown): ParseFailure {
  if (isParseFailure(cause)) return cause;
  const message = extractErrorMessage(cause);
  const details = { message, cause };

  if (
    /duplicate key value violates unique constraint|violates foreign key constraint|violates not-null constraint|violates check constraint|violates exclusion constraint|\[pg_code=(?:23000|23001|23502|23503|23505|23514)\]/i.test(
      message,
    )
  ) {
    return new SchemaRejected(details);
  }

  if (
    /\[pg_code=(?:08000|08001|08003|08004|08006|53300|53400|57P01|57P02|57P03|40001|40P01|55P03)\]|database.*connection|connection.*(?:refused|reset|terminated|closed|aborted|timed?\s*out)|server closed the connection|terminating connection|too many clients|too many connections|ECONNREFUSED|ECONNRESET|ECONNABORTED|EPIPE|ETIMEDOUT|ENOTFOUND|getaddrinfo|failed to connect|database.*unavailable|db.*timeout|transaction.*failed|deadlock detected|serialization failure|could not serialize|statement timeout|lock wait timeout/i.test(
      message,
    )
  ) {
    return new DbUnavailable(details);
  }

  if (
    /timeout|timed?\s*out|deadline.*exceeded|request.*took.*too.*long|exceeded.*time.*limit/i.test(
      message,
    )
  ) {
    return new AiTimedOut(details);
  }

  return new UnknownParseFailure(details);
}

function extractErrorMessage(cause: unknown, seen = new WeakSet<Error>()): string {
  if (cause instanceof Error) {
    if (seen.has(cause)) return cause.message;
    seen.add(cause);

    const code = z
      .string()
      .min(1)
      .safeParse("code" in cause ? cause.code : undefined);

    const codeTag = code.success ? ` [pg_code=${code.data}]` : "";
    const nested = cause.cause != null ? ` (cause: ${extractErrorMessage(cause.cause, seen)})` : "";

    return `${cause.message}${codeTag}${nested}`;
  }

  const text = z.string().safeParse(cause);

  if (text.success) return text.data;

  const record = z
    .object({
      message: z.string().optional(),
      error: z.string().optional(),
      status: z.number().optional(),
    })
    .safeParse(cause);

  if (record.success) {
    return (
      record.data.message ??
      record.data.error ??
      (record.data.status != null ? `HTTP ${record.data.status}` : "Unknown error")
    );
  }

  return "Unknown error";
}
