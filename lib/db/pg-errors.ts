import { z } from "zod";

const pgSqlStateSchema = z.object({ code: z.string() });

export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: Error): boolean {
  const sqlState = pgSqlStateSchema.safeParse(error);
  if (sqlState.success && sqlState.data.code === PG_UNIQUE_VIOLATION) return true;
  return error.message.includes("duplicate key value");
}
