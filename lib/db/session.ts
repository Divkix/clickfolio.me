import { drizzle } from "drizzle-orm/d1";
import { cookies } from "next/headers";
import { z } from "zod";
import * as schema from "./schema";
const D1_BOOKMARK_COOKIE = "d1-session-bookmark";
const BOOKMARK_COOKIE_MAX_AGE = 30; // seconds

interface SessionDbResult {
  db: ReturnType<typeof drizzle<typeof schema>>;
  captureBookmark: () => Promise<void>;
}

type D1SessionDatabase = D1Database & {
  getBookmark(): D1SessionBookmark | null;
};

function createSession(d1: D1Database, constraintOrBookmark: string): D1SessionDatabase {
  // SAFETY: withSession returns D1Database with getBookmark in Workers runtime; interface bridges the missing type.
  return d1.withSession(constraintOrBookmark) as D1SessionDatabase;
}

function createDb(session: D1SessionDatabase) {
  return drizzle(session, { schema });
}

function createCaptureBookmark(session: D1SessionDatabase) {
  return async (): Promise<void> => {
    try {
      const bookmark = session.getBookmark();
      if (bookmark != null && z.string().safeParse(bookmark).success) {
        // SAFETY: D1 bookmark is string from Workers runtime, validated via zod safeParse before cast.
        await setBookmarkCookie(bookmark as string);
      }
    } catch (error) {
      console.warn("[D1 Session] Failed to capture bookmark:", error);
    }
  };
}

/**
 * Set bookmark cookie with appropriate security settings.
 */
async function setBookmarkCookie(bookmark: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(D1_BOOKMARK_COOKIE, bookmark, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: BOOKMARK_COOKIE_MAX_AGE,
      path: "/",
    });
  } catch (error) {
    console.warn("[D1 Session] Failed to set bookmark cookie:", error);
  }
}

/**
 * Get a database instance for webhook handlers where cookies are not available.
 * Uses "first-primary" to ensure writes go to primary and reads are consistent.
 *
 * Usage:
 * ```typescript
 * const { db } = getSessionDbForWebhook(env.CLICKFOLIO_DB);
 * await db.update(resumes).set({ status: "completed" }).where(...);
 * ```
 */
export function getSessionDbForWebhook(d1: D1Database): Pick<SessionDbResult, "db"> {
  const session = createSession(d1, "first-primary");
  const db = createDb(session);

  return { db };
}

/**
 * Get a database instance with primary-first consistency for authenticated endpoints
 * that need immediate consistency after user creation (e.g., claim endpoint).
 *
 * Uses "first-primary" to ensure reads/writes go to primary, avoiding FK constraint
 * failures when user record hasn't replicated to all replicas yet.
 *
 * Usage:
 * ```typescript
 * const { db, captureBookmark } = await getSessionDbWithPrimaryFirst(env.CLICKFOLIO_DB);
 * await db.insert(resumes).values({ userId: user.id, ... });
 * await captureBookmark();
 * ```
 */
export async function getSessionDbWithPrimaryFirst(d1: D1Database): Promise<SessionDbResult> {
  // Use "first-primary" to ensure reads/writes go to primary
  // This handles the case where user was just created and hasn't replicated
  const session = createSession(d1, "first-primary");
  const db = createDb(session);
  const captureBookmark = createCaptureBookmark(session);

  return { db, captureBookmark };
}
