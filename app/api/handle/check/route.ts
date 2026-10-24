import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import type { ZodError } from "zod";
import { RateLimited, RateLimitUnavailable } from "@/lib/api/errors";
import { runRoute } from "@/lib/api/route";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { RESERVED_HANDLES } from "@/lib/rate-limit/handle-validation";
import {
  checkHandleRateLimit,
  getClientIP,
  HANDLE_CHECK_UNAVAILABLE_MESSAGE,
} from "@/lib/rate-limit/ip";
import { handleSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

function handleFormatErrorMessage(error: ZodError): string {
  const issues = error.issues;

  const failedPatterns = issues.flatMap((issue) =>
    issue.code === "invalid_format" && issue.pattern !== undefined
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

// The caller's id, or null when signed out. A failed lookup only loses the
// "this is your handle" hint, so it is logged and treated as anonymous.
function currentUserId(): Effect.Effect<string | null> {
  return Effect.tryPromise(() => getServerSession()).pipe(
    Effect.map((session) => session?.user?.id ?? null),
    Effect.catch((error) => {
      log("warn", "Session lookup failed during handle check; treating caller as anonymous", {
        ...errorFields(error.cause),
      });

      return Effect.succeed(null);
    }),
  );
}

export async function GET(request: Request) {
  return runRoute(
    request,
    Effect.gen(function* () {
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

      const rateLimit = yield* Effect.promise(() => checkHandleRateLimit(getClientIP(request)));

      if (rateLimit.unavailable) {
        return yield* new RateLimitUnavailable({
          message: rateLimit.message ?? HANDLE_CHECK_UNAVAILABLE_MESSAGE,
        });
      }

      if (!rateLimit.allowed) {
        return yield* new RateLimited({
          message: rateLimit.message ?? "Too many requests. Please try again later.",
        });
      }

      const db = getDb(env.HYPERDRIVE);

      const existingUser = yield* Effect.promise(() =>
        db.select({ id: user.id }).from(user).where(eq(user.handle, normalizedHandle)).limit(1),
      );

      if (existingUser.length === 0) {
        return createSuccessResponse({ available: true });
      }

      const callerId = yield* currentUserId();

      if (callerId !== null && existingUser[0].id === callerId) {
        return createSuccessResponse({ available: true, isCurrentHandle: true });
      }

      return createSuccessResponse({ available: false });
    }),
  );
}
