import { eq } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { resumes } from "@/lib/db/schema";

/**
 * R2 keys owned by `userId`. Call while the resume rows still exist — the account
 * deletion cascade removes them, after which the key list is unrecoverable from the DB.
 */
export async function collectR2KeysForUser(db: PgQueryable, userId: string): Promise<string[]> {
  const rows = await db
    .select({ r2Key: resumes.r2Key })
    .from(resumes)
    .where(eq(resumes.userId, userId));

  return rows.map((row) => row.r2Key);
}
