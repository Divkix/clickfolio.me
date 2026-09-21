import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

import { isUniqueViolation } from "@/lib/db/pg-errors";
import { handleChanges, user } from "@/lib/db/schema";
import { isHandleTaken, isValidHandleFormat } from "@/lib/rate-limit/handle-validation";
import { countHandleChangesInWindow } from "@/lib/rate-limit/user";
import { handleUpdateSchema } from "@/lib/schemas/profile";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

type HandleUpdateOutcome =
  | { kind: "ok"; oldHandle: string | null }
  | { kind: "missing_user" }
  | { kind: "unchanged" }
  | { kind: "rate_limited" };

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

      if (!isValidHandleFormat(newHandle)) {
        return createErrorResponse(
          "This handle is reserved. Please choose a different one.",
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
        const outcome = await db.transaction(async (tx): Promise<HandleUpdateOutcome> => {
          // Row lock serializes quota counting, audit insert, and the write for this user.
          const locked = await tx
            .select({ handle: user.handle })
            .from(user)
            .where(eq(user.id, authUser.id))
            .limit(1)
            .for("update");

          if (!locked.length) return { kind: "missing_user" };

          const oldHandle = locked[0].handle;

          if (oldHandle === newHandle) return { kind: "unchanged" };

          const changesIn24h = await countHandleChangesInWindow(tx, authUser.id);

          if (changesIn24h >= 3) return { kind: "rate_limited" };

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
            oldHandle,
            newHandle,
            createdAt: now,
          });

          return { kind: "ok", oldHandle };
        });

        if (outcome.kind === "missing_user") {
          return createErrorResponse(
            "Failed to fetch current profile",
            ERROR_CODES.DATABASE_ERROR,
            500,
          );
        }

        if (outcome.kind === "unchanged") {
          return createErrorResponse(
            "Handle is already set to this value",
            ERROR_CODES.VALIDATION_ERROR,
            400,
          );
        }

        if (outcome.kind === "rate_limited") {
          return createErrorResponse(
            "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            429,
          );
        }

        revalidatePublicProfilePages([outcome.oldHandle, newHandle]);

        captureServerEvent(authUser.id, "handle_changed", {
          new_handle: newHandle,
        });

        return createSuccessResponse({
          success: true,
          handle: newHandle,
          old_handle: outcome.oldHandle,
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
    },
    "You must be logged in to update your handle",
  );
}
