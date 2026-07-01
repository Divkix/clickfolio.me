import { and, eq, gte, sql } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { handleChanges, user } from "@/lib/db/schema";
import { isHandleTaken } from "@/lib/rate-limit/handle-validation";
import { handleUpdateSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

/**
 * PUT /api/profile/handle
 * Update user's handle (old handle becomes immediately available).
 *
 * Rate limit: 3 handle changes per 24 hours (prevent abuse).
 *
 * Request body:
 *   { handle: string }
 *
 * Response:
 *   { success: true, handle: string, old_handle: string | null }
 *
 * Error codes:
 *   - 400: invalid JSON, invalid handle format, or handle already set to this value
 *   - 409: handle is already taken by another user
 *   - 413: request body too large
 *   - 429: rate limit exceeded (3 changes per 24 hours)
 *   - 500: database error or unexpected error
 */
export async function PUT(request: Request) {
  // Validate request size before parsing (prevent DoS)
  const sizeCheck = validateRequestSize(request);
  if (!sizeCheck.valid) {
    return createErrorResponse(
      sizeCheck.error || "Request body too large",
      ERROR_CODES.BAD_REQUEST,
      413,
    );
  }

  return withUser(
    request,
    async ({ user: authUser, db, captureBookmark }) => {
      // Check rate limit (3 handle changes per 24 hours)
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Count changes in SQL instead of fetching all rows
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(handleChanges)
        .where(
          and(
            eq(handleChanges.userId, authUser.id),
            gte(handleChanges.createdAt, windowStart.toISOString()),
          ),
        );

      const changesIn24h = result[0]?.count ?? 0;

      if (changesIn24h >= 3) {
        return createErrorResponse(
          "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          429,
        );
      }

      // Parse and validate request body (size-capped read, no trust in Content-Length)
      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }

      const validation = handleUpdateSchema.safeParse(rawBodyResult.data);

      if (!validation.success) {
        return createErrorResponse(
          "Invalid handle format",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const { handle: newHandle } = validation.data;

      // Fetch current profile to get old handle
      const currentUser = await db
        .select({ handle: user.handle })
        .from(user)
        .where(eq(user.id, authUser.id))
        .limit(1);

      if (!currentUser.length) {
        return createErrorResponse(
          "Failed to fetch current profile",
          ERROR_CODES.DATABASE_ERROR,
          500,
        );
      }

      const oldHandle = currentUser[0].handle;

      // Check if handle is already the same
      if (oldHandle === newHandle) {
        return createErrorResponse(
          "Handle is already set to this value",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }

      // Check if new handle is already taken by another user
      const handleTaken = await isHandleTaken(db, authUser.id, newHandle);

      if (handleTaken) {
        return createErrorResponse(
          "This handle is already taken. Please choose a different one.",
          ERROR_CODES.CONFLICT,
          409,
        );
      }

      // Atomically update handle and record the change
      const now = new Date().toISOString();

      try {
        await db.batch([
          db
            .update(user)
            .set({
              handle: newHandle,
              updatedAt: now,
            })
            .where(eq(user.id, authUser.id)),
          db.insert(handleChanges).values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            oldHandle: oldHandle,
            newHandle: newHandle,
            createdAt: now,
          }),
        ]);
      } catch (error) {
        // Check if it's a unique constraint violation (race condition)
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
          return createErrorResponse(
            "This handle was just taken. Please choose a different one.",
            ERROR_CODES.CONFLICT,
            409,
          );
        }
        throw error; // Re-throw other errors
      }

      await captureBookmark();

      return createSuccessResponse({
        success: true,
        handle: newHandle,
        old_handle: oldHandle,
      });
    },
    "You must be logged in to update your handle",
  );
}
