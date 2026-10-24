import { Effect } from "effect";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { decodeJsonBody, decodeWith, runRoute } from "@/lib/api/route";
import { type AuthedUserContext, withUser } from "@/lib/auth/with-auth";

import { siteData, user } from "@/lib/db/schema";
import { resumeContentSchemaStrict, resumeUpdateRequestSchema } from "@/lib/schemas/resume";
import { shouldSyncDisplayName } from "@/lib/resume/completion";
import type { ResumeContent } from "@/lib/types/database";
import { notifyIndexNowForProfiles } from "@/lib/seo/indexnow-runtime";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
import { siteDataContentColumns } from "@/lib/data/site-data-content";
import { revalidatePublicProfilePages } from "@/lib/utils/revalidate";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { validateRequestSize } from "@/lib/utils/validation";

const VALIDATION_FAILED = { message: "Validation failed. Please check your input." };

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
    (context) =>
      runRoute(
        request,
        Effect.gen(function* () {
          const body = yield* decodeJsonBody(request, resumeUpdateRequestSchema, VALIDATION_FAILED);

          const content = yield* decodeWith(
            resumeContentSchemaStrict,
            body.content,
            VALIDATION_FAILED,
          );

          return yield* Effect.promise(() => updateResume(context, content));
        }),
      ),
    "You must be logged in to update your resume",
  );
}

async function updateResume(
  { user: authUser, db, dbUser }: AuthedUserContext,
  content: ResumeContent,
): Promise<Response> {
  const userId = authUser.id;
  const now = new Date().toISOString();

  const previewFields = extractPreviewFields(content);

  const siteDataRow = await db
    .select({ updatedAt: siteData.updatedAt })
    .from(siteData)
    .where(eq(siteData.userId, userId))
    .limit(1);

  const expectedUpdatedAt = siteDataRow[0]?.updatedAt;

  const updateResult = await db
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
    });

  if (updateResult.length === 0) {
    if (!expectedUpdatedAt) {
      return createErrorResponse(
        "Resume data not found. Please upload a resume first.",
        ERROR_CODES.NOT_FOUND,
        404,
      );
    }

    return createErrorResponse(
      "Resume changed elsewhere. Please reload and try again.",
      ERROR_CODES.CONFLICT,
      409,
    );
  }

  const data = updateResult[0];

  const updatedName = content.full_name?.trim();

  if (updatedName) {
    const userRow = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const currentName = userRow[0]?.name;

    if (shouldSyncDisplayName(updatedName, currentName)) {
      await db
        .update(user)
        .set({ name: updatedName, updatedAt: now })
        .where(
          and(
            eq(user.id, userId),
            // Same missing-name rule as shouldSyncDisplayName, enforced atomically so a concurrent set survives.
            or(isNull(user.name), eq(user.name, "Unnamed"), sql`trim(${user.name}) = ''`),
          ),
        );
    }
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
}
