import { eq } from "drizzle-orm";
import type { z } from "zod";
import { withUser } from "@/lib/auth/with-auth";
import { captureServerEvent } from "@/lib/analytics/server";

import { isUniqueViolation } from "@/lib/db/pg-errors";
import { handleChanges, siteData, user } from "@/lib/db/schema";
import { isHandleTaken } from "@/lib/rate-limit/handle-validation";
import { countHandleChangesInWindow } from "@/lib/rate-limit/user";
import { buildWizardCompleteSchema } from "@/lib/schemas/profile";
import { THEME_IDS, type ThemeId } from "@/lib/templates/theme-ids";
import type { ResumeContent } from "@/lib/types/database";
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
        .select({
          handle: user.handle,
          onboardingCompleted: user.onboardingCompleted,
        })
        .from(user)
        .where(eq(user.id, authUser.id))
        .limit(1);

      const currentHandle = currentUserRow[0]?.handle ?? null;
      const wasOnboarded = currentUserRow[0]?.onboardingCompleted === true;
      const isHandleChange = wasOnboarded && currentHandle !== body.handle;

      if (isHandleChange) {
        const changesIn24h = await countHandleChangesInWindow(db, authUser.id);

        if (changesIn24h >= 3) {
          return createErrorResponse(
            "Rate limit exceeded. Maximum 3 handle changes per 24 hours.",
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            429,
          );
        }
      }

      const now = new Date().toISOString();

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(user)
            .set({
              handle: body.handle,
              privacySettings: body.privacy_settings,
              showInDirectory: body.privacy_settings.show_in_directory,
              onboardingCompleted: true,
              updatedAt: now,
            })
            .where(eq(user.id, authUser.id));
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
              set: {
                themeId: body.theme_id,
                lastPublishedAt: now,
                updatedAt: now,
              },
            });
          if (isHandleChange) {
            await tx.insert(handleChanges).values({
              id: crypto.randomUUID(),
              userId: authUser.id,
              oldHandle: currentHandle,
              newHandle: body.handle,
              createdAt: now,
            });
          }
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

      captureServerEvent(authUser.id, "onboarding_completed", {
        handle: body.handle,
        theme_id: body.theme_id,
        show_in_directory: body.privacy_settings.show_in_directory,
      });

      return createSuccessResponse({
        success: true,
        handle: body.handle,
      });
    },
    "You must be logged in to complete onboarding",
  );
}
