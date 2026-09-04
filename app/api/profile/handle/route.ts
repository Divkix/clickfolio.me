import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

import { isUniqueViolation } from "@/lib/db/pg-errors";
import { handleChanges, user } from "@/lib/db/schema";
import { isHandleTaken } from "@/lib/rate-limit/handle-validation";
import { countHandleChangesInWindow } from "@/lib/rate-limit/user";
import { handleUpdateSchema } from "@/lib/schemas/profile";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

export async function PUT(request: Request) {
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
    async ({ user: authUser, db }) => {
      const changesIn24h = await countHandleChangesInWindow(db, authUser.id);

      if (changesIn24h >= 3) {
        return createErrorResponse(
          "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          429,
        );
      }

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

      if (oldHandle === newHandle) {
        return createErrorResponse(
          "Handle is already set to this value",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }

      const handleTaken = await isHandleTaken(db, authUser.id, newHandle);

      if (handleTaken) {
        return createErrorResponse(
          "This handle is already taken. Please choose a different one.",
          ERROR_CODES.CONFLICT,
          409,
        );
      }

      const now = new Date().toISOString();

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(user)
            .set({
              handle: newHandle,
              updatedAt: now,
            })
            .where(eq(user.id, authUser.id));
          await tx.insert(handleChanges).values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            oldHandle: oldHandle,
            newHandle: newHandle,
            createdAt: now,
          });
        });
      } catch (error) {
        // Unique constraint violation (race condition): Postgres SQLSTATE 23505 → 409.
        if (error instanceof Error && isUniqueViolation(error)) {
          return createErrorResponse(
            "This handle was just taken. Please choose a different one.",
            ERROR_CODES.CONFLICT,
            409,
          );
        }
        throw error;
      }

      captureServerEvent(authUser.id, "handle_changed", {
        new_handle: newHandle,
      });

      return createSuccessResponse({
        success: true,
        handle: newHandle,
        old_handle: oldHandle,
      });
    },
    "You must be logged in to update your handle",
  );
}
