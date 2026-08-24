/**
 * Theme access verification for protected routes.
 *
 * All themes are free, so verification always succeeds without touching the
 * database. Retained with the same signature for existing call sites.
 */

import type { Database } from "@/lib/db";
import type { ThemeId } from "./theme-ids";

/**
 * Check if a user has unlocked a theme.
 * Returns null (unlocked) or an error Response (blocked). All themes are
 * free, so this always returns null without querying the database.
 */
export async function verifyThemeUnlocked(
  _db: Database,
  _userId: string,
  _themeId: ThemeId,
): Promise<Response | null> {
  return null;
}
