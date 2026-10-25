import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { z } from "zod";
import { and, eq, lte } from "drizzle-orm";
import { withUserEffect } from "@/lib/auth/with-auth";
import { Db } from "@/lib/effect/db";
import { Conflict, InvalidInput, NotFound } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { logEvent } from "@/lib/utils/log";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { siteData } from "@/lib/db/schema";
import { isValidThemeId } from "@/lib/templates/theme-ids";
import { createSuccessResponse } from "@/lib/utils/security-headers";

const themeUpdateSchema = z.object({ theme_id: z.string().min(1) });

export const Route = createFileRoute("/api/resume/update-theme")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const oversized = oversizedBodyResponse(request);

        if (oversized) return oversized;

        return withUserEffect(
          request,
          ({ user: authUser, dbUser }) =>
            Effect.gen(function* () {
              const userId = authUser.id;

              const { theme_id } = yield* readJsonBody(
                request,
                themeUpdateSchema,
                "theme_id is required and must be a string",
              );

              if (!isValidThemeId(theme_id)) {
                return yield* Effect.fail(
                  new InvalidInput({ message: "Invalid theme_id provided" }),
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
                    new NotFound({
                      message: "Resume data not found. Please upload a resume first.",
                    }),
                  );
                }

                return yield* Effect.fail(
                  new Conflict({
                    message: "Theme changed elsewhere. Please reload and try again.",
                  }),
                );
              }

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
          "You must be logged in to update theme",
        );
      },
    },
  },
});
