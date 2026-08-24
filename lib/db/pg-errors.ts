/**
 * Postgres driver error shape helpers.
 *
 * postgres-js stamps the server's 5-character SQLSTATE on the thrown error's
 * `code` property (e.g. "23505" for unique_violation). Parse the shape once
 * here instead of scattering `(error as { code?: string })` casts across routes.
 */
import { z } from "zod";

const pgSqlStateSchema = z.object({ code: z.string() });

/** SQLSTATE for unique constraint violations (duplicate key). */
export const PG_UNIQUE_VIOLATION = "23505";

/**
 * True when a caught value is a Postgres unique-constraint violation:
 * either the driver surfaced SQLSTATE 23505 on `code`, or (fallback for
 * drivers/intermediaries that drop `code`) the classic duplicate-key message.
 */
export function isUniqueViolation(error: Error): boolean {
  const sqlState = pgSqlStateSchema.safeParse(error);
  if (sqlState.success && sqlState.data.code === PG_UNIQUE_VIOLATION) return true;
  return error.message.includes("duplicate key value");
}
