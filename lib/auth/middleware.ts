/**
 * Authentication middleware utilities for API routes
 * Provides reusable authentication helpers for Better Auth
 */

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { User as SchemaUser } from "@/lib/db/schema";
import { createErrorResponse, ERROR_CODES } from "@/lib/utils/security-headers";

/**
 * User type with Better Auth custom fields
 */
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
  privacySettings: string;
  onboardingCompleted: boolean;
  role: SchemaUser["role"];
}

/**
 * Session type returned by Better Auth
 */
interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Helper to get the current session from Better Auth
 * Must be called within a server context (API route or server component)
 *
 * @returns The session if authenticated, null otherwise
 */
async function getSession(): Promise<AuthSession | null> {
  try {
    const auth = await getAuth();
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });
    return session as AuthSession | null;
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

/**
 * Helper to require authentication with custom error message
 *
 * @param errorMessage Custom error message for unauthorized access
 * @returns Promise containing either the authenticated user or an error response
 *
 * @example
 * ```ts
 * export async function GET() {
 *   const { user, error } = await requireAuthWithMessage("Must be logged in to view this");
 *   if (error) return error;
 *
 *   // user is guaranteed to be defined here
 *   return Response.json({ userId: user.id });
 * }
 * ```
 */
export async function requireAuthWithMessage(
  errorMessage: string,
): Promise<{ user: AuthUser; error: null } | { user: null; error: Response }> {
  try {
    const session = await getSession();

    if (!session?.user) {
      return {
        user: null,
        error: createErrorResponse(errorMessage, ERROR_CODES.UNAUTHORIZED, 401),
      };
    }

    return { user: session.user, error: null };
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return {
      user: null,
      error: createErrorResponse("Authentication failed", ERROR_CODES.INTERNAL_ERROR, 500),
    };
  }
}
