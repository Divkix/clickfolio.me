import { Effect } from "effect";
import { z } from "zod";
import { and, eq, lte } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { Db } from "@/lib/effect/db";
import { Conflict, InvalidInput, NotFound } from "@/lib/effect/failures";
import { errorFields } from "@/lib/utils/error-fields";
import { logEvent } from "@/lib/utils/log";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { siteData } from "@/lib/db/schema";
import { isValidThemeId, THEME_IDS } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

const themeUpdateSchema = z.object({ theme_id: z.string().min(1) });

export async function POST(request: Request) {
  return withUserEffect(
    request,
    ({ user: authUser, dbUser }) =>
      Effect.gen(function* () {
        const userId = authUser.id;

        const sizeCheck = validateRequestSize(request);

        if (!sizeCheck.valid) {
          return createErrorResponse(
            sizeCheck.error || "Request body too large",
            ERROR_CODES.BAD_REQUEST,
            413,
          );
        }

        const rawBodyResult = yield* Effect.tryPromise({
          try: () => readJsonWithLimit(request),
          // The client went away mid-request.
          catch: (cause) =>
            new InvalidInput({
              message: "Could not read the request body",
              details: errorFields(cause),
            }),
        });

        if (!rawBodyResult.ok) {
          return createErrorResponse(
            rawBodyResult.error,
            ERROR_CODES.BAD_REQUEST,
            rawBodyResult.reason === "too_large" ? 413 : 400,
          );
        }

        const body = themeUpdateSchema.safeParse(rawBodyResult.data);

        if (!body.success) {
          return createErrorResponse(
            "theme_id is required and must be a string",
            ERROR_CODES.BAD_REQUEST,
            400,
          );
        }

        const { theme_id } = body.data;

        if (!isValidThemeId(theme_id)) {
          return createErrorResponse(
            "Invalid theme_id provided",
            ERROR_CODES.VALIDATION_ERROR,
            400,
            { valid_themes: [...THEME_IDS] },
          );
        }

        const siteDataRow = yield* Db.use((service) =>
          service.query("resume.theme.version", (db) =>
            db
              .select({ updatedAt: siteData.updatedAt })
              .from(siteData)
              .where(eq(siteData.userId, userId))
              .limit(1),
          ),
        );

        const expectedUpdatedAt = siteDataRow[0]?.updatedAt;

        const now = new Date().toISOString();

        const updateResult = yield* Db.use((service) =>
          service.query("resume.theme.update", (db) =>
            db
              .update(siteData)
              .set({
                themeId: theme_id,
                updatedAt: now,
              })
              .where(
                and(
                  eq(siteData.userId, userId),
                  // Only apply when no other writer moved the row past the version read at request start.
                  expectedUpdatedAt ? lte(siteData.updatedAt, expectedUpdatedAt) : undefined,
                ),
              )
              .returning({ themeId: siteData.themeId, content: siteData.content }),
          ),
        );

        const data = updateResult[0];

        if (!data) {
          if (!expectedUpdatedAt) {
            return yield* Effect.fail(
              new NotFound({ message: "Resume data not found. Please upload a resume first." }),
            );
          }

          return yield* Effect.fail(
            new Conflict({ message: "Theme changed elsewhere. Please reload and try again." }),
          );
        }

        if (isIndexableProfile(data.content, normalizePrivacySettings(authUser.privacySettings))) {
          notifyIndexNowForProfiles([dbUser.handle]);
        }

        logEvent("theme_changed", { userId, themeId: theme_id });

        revalidatePublicProfilePages([dbUser.handle]);

        return createSuccessResponse({
          success: true,
          theme_id: data.themeId,
          message: "Theme updated successfully",
        });
      }),
    "You must be logged in to update theme",
  );
}
