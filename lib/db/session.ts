import { drizzle } from "drizzle-orm/d1";
import { cookies } from "next/headers";
import * as schema from "./schema";

const D1_BOOKMARK_COOKIE = "d1-session-bookmark";
const BOOKMARK_COOKIE_MAX_AGE = 30; // seconds

interface SessionDbResult {
  db: ReturnType<typeof drizzle<typeof schema>>;
  captureBookmark: () => Promise<void>;
}

/**
 * Read bookmark from cookie.
 * Returns null if not found or on error.
 */
async function readBookmarkFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(D1_BOOKMARK_COOKIE);
    return cookie?.value ?? null;
  } catch (error) {
    console.warn("[D1 Session] Failed to read bookmark cookie:", error);
    return null;
  }
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
 * Get a database instance with session consistency for authenticated routes.
 * Reads existing bookmark from cookie and provides a captureBookmark function
 * to store the bookmark after write operations.
 *
 * Usage:
 * ```typescript
 * const { db, captureBookmark } = await getSessionDb(env.DB);
 * await db.insert(users).values({ ... });
 * await captureBookmark(); // Store bookmark for read-your-own-writes
 * ```
 */
export async function getSessionDb(d1: D1Database): Promise<SessionDbResult> {
  const existingBookmark = await readBookmarkFromCookie();

  // Create session with existing bookmark or "first-unconstrained" for fresh sessions
  // D1 session API types are not yet available in @cloudflare/workers-types
  // biome-ignore lint/suspicious/noExplicitAny: D1 session API not typed
  const session = (d1 as any).withSession(existingBookmark ?? "first-unconstrained");

  const db = drizzle(session, { schema });

  const captureBookmark = async (): Promise<void> => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: D1 session API not typed
      const bookmark = (session as any).getBookmark?.();
      if (bookmark && typeof bookmark === "string") {
        await setBookmarkCookie(bookmark);
      }
    } catch (error) {
      console.warn("[D1 Session] Failed to capture bookmark:", error);
    }
  };

  return { db, captureBookmark };
}

/**
 * Get a database instance for webhook handlers where cookies are not available.
 * Uses "first-primary" to ensure writes go to primary and reads are consistent.
 *
 * Usage:
 * ```typescript
 * const { db } = getSessionDbForWebhook(env.DB);
 * await db.update(resumes).set({ status: "completed" }).where(...);
 * ```
 */
export function getSessionDbForWebhook(d1: D1Database): Pick<SessionDbResult, "db"> {
  // biome-ignore lint/suspicious/noExplicitAny: D1 session API not typed
  const session = (d1 as any).withSession("first-primary");
  const db = drizzle(session, { schema });

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
 * const { db, captureBookmark } = await getSessionDbWithPrimaryFirst(env.DB);
 * await db.insert(resumes).values({ userId: user.id, ... });
 * await captureBookmark();
 * ```
 */
export async function getSessionDbWithPrimaryFirst(d1: D1Database): Promise<SessionDbResult> {
  // Use "first-primary" to ensure reads/writes go to primary
  // This handles the case where user was just created and hasn't replicated
  // biome-ignore lint/suspicious/noExplicitAny: D1 session API not typed
  const session = (d1 as any).withSession("first-primary");
  const db = drizzle(session, { schema });

  const captureBookmark = async (): Promise<void> => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: D1 session API not typed
      const bookmark = (session as any).getBookmark?.();
      if (bookmark && typeof bookmark === "string") {
        await setBookmarkCookie(bookmark);
      }
    } catch (error) {
      console.warn("[D1 Session] Failed to capture bookmark:", error);
    }
  };

  return { db, captureBookmark };
}
