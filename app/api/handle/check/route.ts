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

export async function GET(request: Request) {
  try {
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

    if (RESERVED_HANDLES.has(normalizedHandle)) {
      return createSuccessResponse({ available: false, reason: "reserved" });
    }

    const clientIP = getClientIP(request);
    const rateLimitResult = await checkHandleRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
      return createErrorResponse(
        rateLimitResult.message || "Too many requests. Please try again later.",
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        429,
      );
    }

    const db = getDb(env.HYPERDRIVE);

    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.handle, normalizedHandle))
      .limit(1);

    if (existingUser.length === 0) {
      return createSuccessResponse({ available: true });
    }

    let currentUserId: string | null = null;
    try {
      const session = await getServerSession();
      currentUserId = session?.user?.id ?? null;
    } catch {}

    if (currentUserId && existingUser[0].id === currentUserId) {
      return createSuccessResponse({ available: true, isCurrentHandle: true });
    }

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
