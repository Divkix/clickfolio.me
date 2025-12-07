/**
 * Better Auth API route handler
 *
 * This catch-all route handles all Better Auth endpoints including:
 * - /api/auth/signin/* (OAuth flows)
 * - /api/auth/signout (Sign out)
 * - /api/auth/session (Session management)
 * - /api/auth/callback/* (OAuth callbacks)
 *
 * The auth instance is created per-request because the D1 database binding
 * is only available within the Cloudflare Workers request context.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

/**
 * GET handler for auth endpoints
 * Handles: session retrieval, OAuth redirects, callback processing
 */
export async function GET(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
}

/**
 * POST handler for auth endpoints
 * Handles: sign in, sign out, session updates
 */
export async function POST(request: Request) {
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
}
