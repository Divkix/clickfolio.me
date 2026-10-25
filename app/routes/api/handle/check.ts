import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import type { $ZodError } from "zod/v4/core";
import { findSession } from "@/lib/auth/session";
import { runRoute } from "@/lib/effect/edges";
import { appLayer } from "@/lib/effect/layers";
import { isHandleTakenEffect, RESERVED_HANDLES } from "@/lib/rate-limit/handle-validation";
import { checkHandleRateLimitEffect, getClientIP } from "@/lib/rate-limit/ip";
import { handleSchema } from "@/lib/schemas/handle";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

function handleFormatErrorMessage(error: $ZodError): string {
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

// `isHandleTakenEffect` excludes one user id; no row has this one, so it asks "does anyone own it".
const NO_USER_ID = "";

export const Route = createFileRoute("/api/handle/check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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

        const program = Effect.gen(function* () {
          yield* checkHandleRateLimitEffect(getClientIP(request));

          const taken = yield* isHandleTakenEffect(NO_USER_ID, normalizedHandle);

          if (!taken) {
            return createSuccessResponse({ available: true });
          }

          // Only a taken handle needs the session, so typing a free one never reaches Clerk. An expired
          // token reads as signed out; Clerk or Postgres being down fails the check (503/504) instead
          // of answering "taken".
          const session = yield* findSession(request);

          if (session?.user.handle === normalizedHandle) {
            return createSuccessResponse({ available: true, isCurrentHandle: true });
          }

          return createSuccessResponse({ available: false });
        });

        return runRoute(request, program, appLayer(env));
      },
    },
  },
});
