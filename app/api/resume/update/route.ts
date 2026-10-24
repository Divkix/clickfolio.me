import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { z } from "zod";
import { withUserEffect } from "@/lib/auth/with-auth";
import { Db } from "@/lib/effect/db";
import { Conflict, InvalidInput, NotFound } from "@/lib/effect/failures";
import { oversizedBodyResponse, readJsonBody } from "@/lib/effect/json-body";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

import { siteData, user } from "@/lib/db/schema";
import { resumeContentSchemaStrict } from "@/lib/schemas/resume";
import { shouldSyncDisplayName } from "@/lib/resume/completion";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { createSuccessResponse } from "@/lib/utils/security-headers";

const updateRequestSchema = z.object({ content: z.json().optional() });

export async function PUT(request: Request) {
  const oversized = oversizedBodyResponse(request);

  if (oversized) return oversized;

  return withUserEffect(
    request,
    ({ user: authUser, dbUser }) =>
      Effect.gen(function* () {
        const userId = authUser.id;

        const body = yield* readJsonBody(request, updateRequestSchema, "Invalid request body");

        const validation = resumeContentSchemaStrict.safeParse(body.content);

        if (!validation.success) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Validation failed. Please check your input." }),
          );
        }

        const content = validation.data;
        const now = new Date().toISOString();

        const previewFields = extractPreviewFields(content);

        const siteDataRow = yield* Db.use((service) =>
          service.query("resume.update.version", (db) =>
            db
              .select({ updatedAt: siteData.updatedAt })
              .from(siteData)
              .where(eq(siteData.userId, userId))
              .limit(1),
          ),
        );

        const expectedUpdatedAt = siteDataRow[0]?.updatedAt;

        const updateResult = yield* Db.use((service) =>
          service.query("resume.update.content", (db) =>
            db
              .update(siteData)
              .set({
                ...siteDataContentColumns(content),
                ...previewFields,
                lastPublishedAt: now,
                updatedAt: now,
              })
              .where(
                and(
                  eq(siteData.userId, userId),
                  // Only apply when no other writer moved the row past the version read at request start.
                  expectedUpdatedAt ? lte(siteData.updatedAt, expectedUpdatedAt) : undefined,
                ),
              )
              .returning({
                id: siteData.id,
                lastPublishedAt: siteData.lastPublishedAt,
                content: siteData.content,
              }),
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
            new Conflict({ message: "Resume changed elsewhere. Please reload and try again." }),
          );
        }

        const updatedName = content.full_name?.trim();

        if (updatedName) {
          // The edit is already saved: a failed display-name sync must not hide that from the
          // visitor or skip the cache purge below, so it is logged and the response goes on.
          yield* syncDisplayName(userId, updatedName, now);
        }

        revalidatePublicProfilePages([dbUser.handle]);

        if (isIndexableProfile(data.content, normalizePrivacySettings(authUser.privacySettings))) {
          notifyIndexNowForProfiles([dbUser.handle]);
        }

        return createSuccessResponse({
          success: true,
          data: {
            id: data.id,
            last_published_at: data.lastPublishedAt,
          },
        });
      }),
    "You must be logged in to update your resume",
  );
}

function syncDisplayName(userId: string, updatedName: string, now: string) {
  return Effect.gen(function* () {
    const userRow = yield* Db.use((service) =>
      service.query("resume.update.name-read", (db) =>
        db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1),
      ),
    );

    if (!shouldSyncDisplayName(updatedName, userRow[0]?.name)) return;

    yield* Db.use((service) =>
      service.query("resume.update.name-write", (db) =>
        db
          .update(user)
          .set({ name: updatedName, updatedAt: now })
          .where(
            and(
              eq(user.id, userId),
              // Same missing-name rule as shouldSyncDisplayName, enforced atomically so a concurrent set survives.
              or(isNull(user.name), eq(user.name, "Unnamed"), sql`trim(${user.name}) = ''`),
            ),
          ),
      ),
    );
  }).pipe(
    Effect.catchTags({
      DbFailed: (failure) => logNameSyncFailure(failure),
      DbConflict: (failure) => logNameSyncFailure(failure),
    }),
  );
}

function logNameSyncFailure(failure: { message: string; cause?: unknown }) {
  return Effect.sync(() => {
    log("warn", "display name sync after resume update failed", {
      ...errorFields(failure.cause ?? failure),
    });
  });
}
