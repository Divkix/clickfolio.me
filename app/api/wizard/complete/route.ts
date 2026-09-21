import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

import { isUniqueViolation } from "@/lib/db/pg-errors";
import { handleChanges, siteData, user } from "@/lib/db/schema";
import { isHandleTaken, isValidHandleFormat } from "@/lib/rate-limit/handle-validation";
import { countHandleChangesInWindow } from "@/lib/rate-limit/user";
import { buildWizardCompleteSchema } from "@/lib/schemas/profile";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

// SAFETY: THEME_IDS is non-empty const array of ThemeId strings; spread cast creates required tuple type for zod enum schema.
const wizardCompleteSchema = buildWizardCompleteSchema([...THEME_IDS] as [ThemeId, ...ThemeId[]]);

type WizardCompleteRequest = z.infer<typeof wizardCompleteSchema>;

const PENDING_RESUME_CONTENT: ResumeContent = {
  full_name: "Pending",
  headline: "Resume processing",
  summary: "Resume content is being processed.",
  contact: { email: "" },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  projects: [],
};

type WizardCompleteOutcome =
  | { kind: "ok"; oldHandle: string | null }
  | { kind: "missing_user" }
  | { kind: "stale" }
  | { kind: "rate_limited" };

export async function POST(request: Request) {
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

      const validation = wizardCompleteSchema.safeParse(rawBodyResult.data);

      if (!validation.success) {
        return createErrorResponse(
          "Validation failed. Please check your input.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const body: WizardCompleteRequest = validation.data;

      if (!isValidHandleFormat(body.handle)) {
        return createErrorResponse(
          "This handle is reserved. Please choose a different one.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          { field: "handle", message: "Handle is reserved" },
        );
      }

      const handleTaken = await isHandleTaken(db, authUser.id, body.handle);

      if (handleTaken) {
        return createErrorResponse(
          "This handle is already taken. Please choose another.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          { field: "handle", message: "Handle already taken" },
        );
      }

      const currentUserRow = await db
        .select({ handle: user.handle })
        .from(user)
        .where(eq(user.id, authUser.id))
        .limit(1);

      // Compare-and-swap expectation: the handle this request observed before the transaction.
      const expectedHandle = currentUserRow[0]?.handle ?? null;

      const siteDataRow = await db
        .select({ updatedAt: siteData.updatedAt })
        .from(siteData)
        .where(eq(siteData.userId, authUser.id))
        .limit(1);

      const siteDataSnapshot = siteDataRow[0]?.updatedAt;

      const now = new Date().toISOString();

      try {
        const outcome = await db.transaction(async (tx): Promise<WizardCompleteOutcome> => {
          // Row lock serializes concurrent completes for this user (quota count, audit, CAS write).
          const locked = await tx
            .select({ handle: user.handle })
            .from(user)
            .where(eq(user.id, authUser.id))
            .limit(1)
            .for("update");

          if (!locked.length) return { kind: "missing_user" };

          const oldHandle = locked[0].handle;
          const isHandleChange = oldHandle !== body.handle;

          if (isHandleChange) {
            const changesIn24h = await countHandleChangesInWindow(tx, authUser.id);

            if (changesIn24h >= 3) return { kind: "rate_limited" };
          }

          const updated = await tx
            .update(user)
            .set({
              handle: body.handle,
              privacySettings: body.privacy_settings,
              showInDirectory: body.privacy_settings.show_in_directory,
              onboardingCompleted: true,
              updatedAt: now,
            })
            .where(
              and(
                eq(user.id, authUser.id),
                expectedHandle === null
                  ? isNull(user.handle)
                  : or(isNull(user.handle), eq(user.handle, expectedHandle)),
              ),
            )
            .returning({ id: user.id });

          if (!updated.length) return { kind: "stale" };

          const conflictUpdate = {
            themeId: body.theme_id,
            lastPublishedAt: now,
            updatedAt: now,
          };

          if (siteDataSnapshot) {
            // Skip when the row moved past the snapshot read at request start (e.g. queue completion published).
            await tx
              .insert(siteData)
              .values({
                id: crypto.randomUUID(),
                userId: authUser.id,
                content: PENDING_RESUME_CONTENT,
                themeId: body.theme_id,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: siteData.userId,
                set: conflictUpdate,
                setWhere: sql`${siteData.updatedAt} <= ${siteDataSnapshot}`,
              });
          } else {
            await tx
              .insert(siteData)
              .values({
                id: crypto.randomUUID(),
                userId: authUser.id,
                content: PENDING_RESUME_CONTENT,
                themeId: body.theme_id,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({ target: siteData.userId, set: conflictUpdate });
          }

          if (isHandleChange) {
            await tx.insert(handleChanges).values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              oldHandle,
              newHandle: body.handle,
              createdAt: now,
            });
          }

          return { kind: "ok", oldHandle };
        });

        if (outcome.kind === "missing_user") {
          return createErrorResponse("Failed to load profile", ERROR_CODES.DATABASE_ERROR, 500);
        }

        if (outcome.kind === "stale") {
          return createErrorResponse(
            "Your profile was updated elsewhere. Please reload and try again.",
            ERROR_CODES.CONFLICT,
            409,
          );
        }

        if (outcome.kind === "rate_limited") {
          return createErrorResponse(
            "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            429,
          );
        }

        revalidatePublicProfilePages([outcome.oldHandle, body.handle]);

        captureServerEvent(authUser.id, "onboarding_completed", {
          handle: body.handle,
          theme_id: body.theme_id,
          show_in_directory: body.privacy_settings.show_in_directory,
        });

        return createSuccessResponse({
          success: true,
          handle: body.handle,
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
    "You must be logged in to complete onboarding",
  );
}
