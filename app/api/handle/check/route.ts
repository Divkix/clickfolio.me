import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { ZodError } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { RESERVED_HANDLES } from "@/lib/rate-limit/handle-validation";
import { checkHandleRateLimit, getClientIP } from "@/lib/rate-limit/ip";
import { handleSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

/**
 * Map handleSchema issues onto the granular error messages this endpoint has
 * always returned. Buckets are evaluated in the same order as the previous
 * sequential guards so every invalid case produces the exact same response.
 */
function handleFormatErrorMessage(error: ZodError): string {
  const issues = error.issues;
  const failedPatterns = issues.flatMap((issue) =>
    // eslint-disable-next-line anti-slop/no-runtime-typeof -- ZodError issue.pattern is string | undefined at I/O boundary; typeof safely narrows to string before string ops
    issue.code === "invalid_format" && typeof issue.pattern === "string"
      ? [issue.pattern.replace(/^\//, "").replace(/\/$/, "")]
      : [],
  );

  if (issues.some((issue) => issue.code === "too_small")) {
    return "Handle must be at least 3 characters";
  }
  if (issues.some((issue) => issue.code === "too_big")) {
    return "Handle must be at most 30 characters";
  }
  if (failedPatterns.includes("^[a-z0-9-]+$")) {
    return "Handle can only contain lowercase letters, numbers, and hyphens";
  }
  if (failedPatterns.includes("^[a-z0-9]") || failedPatterns.includes("[a-z0-9]$")) {
    return "Handle cannot start or end with a hyphen";
  }
  return "Handle cannot contain consecutive hyphens";
}

/**
 * GET /api/handle/check?handle=example
 * Check if a handle is available (public endpoint)
 * Rate limited by IP to prevent username enumeration
 *
 * Optimization notes (this is the highest-volume endpoint, called every ~500ms while typing):
 * 1. Format validation runs BEFORE rate limiting — invalid handles never touch Postgres
 * 2. Auth (Clerk session verification + user-row lookup) is deferred — only resolved when
 *    the handle IS taken, to distinguish "yours" vs "taken". Available handles return
 *    immediately with zero auth cost.
 */
export async function GET(request: Request) {
  try {
    // 1. Parse and validate handle format BEFORE any database operations
    //    This rejects invalid input (bad chars, too short, reserved) for free.
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return createErrorResponse("handle parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    const normalizedHandle = handle.toLowerCase().trim();

    const parsedHandle = handleSchema.safeParse(normalizedHandle);
    if (!parsedHandle.success) {
      return createErrorResponse(
        handleFormatErrorMessage(parsedHandle.error),
        ERROR_CODES.BAD_REQUEST,
        400,
      );
    }

    // Check reserved handles — pure in-memory Set lookup, no DB
    if (RESERVED_HANDLES.has(normalizedHandle)) {
      return createSuccessResponse({ available: false, reason: "reserved" });
    }

    // 2. IP-based rate limiting (only reached for validly-formatted handles)
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkHandleRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        rateLimitResult.message || "Too many requests. Please try again later.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    // 3. Check if handle exists in the database.
    const db = getDb(env.HYPERDRIVE);

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    // 4. Handle is available — return immediately, skip auth entirely
    if (existingUser.length === 0) {
      return createSuccessResponse({ available: true });
    }

    // 5. Handle is taken — resolve auth only now to check "is it yours?"
    let currentUserId: string | null = null;
    try {
      const session = await getServerSession();
      currentUserId = session?.user?.id ?? null;
    } catch {
      // Not authenticated — continue as public endpoint
    }

    if (currentUserId && existingUser[0].id === currentUserId) {
      return createSuccessResponse({ available: true, isCurrentHandle: true });
    }

    // Taken by another user
    return createSuccessResponse({ available: false });
  } catch (err) {
    console.error("Error checking handle availability:", err);
    return createErrorResponse(
      "An unexpected error occurred. Please try again.",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
