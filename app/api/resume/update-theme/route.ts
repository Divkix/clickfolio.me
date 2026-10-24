import { Effect } from "effect";
import { and, eq, lte } from "drizzle-orm";
import { decodeJsonBody, runRoute } from "@/lib/api/route";
import { withUser } from "@/lib/auth/with-auth";
import { logEvent } from "@/lib/utils/log";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { siteData } from "@/lib/db/schema";
import { themeUpdateRequestSchema } from "@/lib/schemas/resume";
import { isValidThemeId, THEME_IDS } from "@/lib/templates/theme-ids";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function POST(request: Request) {
  return withUser(
    request,
    ({ user: authUser, db, dbUser }) =>
      runRoute(
        request,
        Effect.gen(function* () {
          const userId = authUser.id;

          const { theme_id } = yield* decodeJsonBody(request, themeUpdateRequestSchema, {
            message: "theme_id is required and must be a string",
            code: "BAD_REQUEST",
          });

          if (!isValidThemeId(theme_id)) {
            return createErrorResponse(
              "Invalid theme_id provided",
              ERROR_CODES.VALIDATION_ERROR,
              400,
              { valid_themes: [...THEME_IDS] },
            );
          }

          const siteDataRow = yield* Effect.promise(() =>
            db
              .select({ updatedAt: siteData.updatedAt })
              .from(siteData)
              .where(eq(siteData.userId, userId))
              .limit(1),
          );

          const expectedUpdatedAt = siteDataRow[0]?.updatedAt;

          const now = new Date().toISOString();

          const updateResult = yield* Effect.promise(() =>
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
          );

          if (updateResult.length === 0) {
            if (!expectedUpdatedAt) {
              return createErrorResponse(
                "Resume data not found. Please upload a resume first.",
                ERROR_CODES.NOT_FOUND,
                404,
              );
            }

            return createErrorResponse(
              "Theme changed elsewhere. Please reload and try again.",
              ERROR_CODES.CONFLICT,
              409,
            );
          }

          const data = updateResult[0];

          if (
            isIndexableProfile(data.content, normalizePrivacySettings(authUser.privacySettings))
          ) {
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
      ),
    "You must be logged in to update theme",
  );
}
