import { and, eq } from "drizzle-orm";
import type { PgQueryable } from "@/lib/db";
import { type PrivacySettings, user } from "@/lib/db/schema";

interface PrivacySettingsWrite {
  userId: string;
  settings: PrivacySettings;
  /** Row version the client loaded (validated by rowVersionSchema); null writes unconditionally. */
  expectedUpdatedAt: string | null;
  now: string;
}

/**
 * Writes the privacy jsonb and its `show_in_directory` column twin in one UPDATE. The expected
 * version goes to Postgres as text, so it is compared at full (microsecond) precision. Returns
 * false when no row matched, which with a version means someone else saved first.
 */
export async function updatePrivacySettings(
  db: PgQueryable,
  { userId, settings, expectedUpdatedAt, now }: PrivacySettingsWrite,
): Promise<boolean> {
  const updated = await db
    .update(user)
    .set({
      privacySettings: settings,
      showInDirectory: settings.show_in_directory,
      updatedAt: now,
    })
    .where(
      expectedUpdatedAt === null
        ? eq(user.id, userId)
        : and(eq(user.id, userId), eq(user.updatedAt, expectedUpdatedAt)),
    )
    .returning({ id: user.id });

  return updated.length > 0;
}
