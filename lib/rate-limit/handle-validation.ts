import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { handleSchema } from "@/lib/schemas/profile";

export const RESERVED_HANDLES = new Set(["api", "_next", "static", "public", "xmlrpc", "adminer"]);

export function isValidHandleFormat(handle: string): boolean {
  if (handle.includes(".")) return false;

  if (RESERVED_HANDLES.has(handle.toLowerCase())) return false;

  return handleSchema.safeParse(handle).success;
}

export async function isHandleTaken(
  db: Database,
  userId: string,
  handle: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.handle, handle), ne(user.id, userId)))
    .limit(1);
  return existing.length > 0;
}
