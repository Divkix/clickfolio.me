import { and, eq, ne } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { handleSchema } from "@/lib/schemas/handle";

export const RESERVED_HANDLES = new Set(["api", "_next", "static", "public", "xmlrpc", "adminer"]);

export function isValidHandleFormat(handle: string): boolean {
  if (handle.includes(".")) return false;

  if (RESERVED_HANDLES.has(handle.toLowerCase())) return false;

  return handleSchema.safeParse(handle).success;
}

export async function isHandleTaken(
  db: PgQueryable,
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

/** Handle availability as an Effect for routes under `runRoute`; DB failures stay typed. */
export function isHandleTakenEffect(userId: string, handle: string) {
  return Db.use((service) =>
    service.query("handle.taken", (db) => isHandleTaken(db, userId, handle)),
  );
}
