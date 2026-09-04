import { eq } from "drizzle-orm";
import { withUser } from "@/lib/auth/with-auth";

import { siteData, user } from "@/lib/db/schema";
import { resumeContentSchemaStrict } from "@/lib/schemas/resume";
import type { ResumeContent } from "@/lib/types/database";
import { extractPreviewFields } from "@/lib/utils/preview-fields";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import { readJsonWithLimit, validateRequestSize } from "@/lib/utils/validation";

interface UpdateRequestBody {
  content?: ResumeContent;
}

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
      const userId = authUser.id;

      const rawBodyResult = await readJsonWithLimit(request);
      if (!rawBodyResult.ok) {
        return createErrorResponse(
          rawBodyResult.error,
          ERROR_CODES.BAD_REQUEST,
          rawBodyResult.reason === "too_large" ? 413 : 400,
        );
      }
      // SAFETY: rawBodyResult.data is bounded JSON from validated request; cast extracts UpdateRequestBody.
      const body = rawBodyResult.data as UpdateRequestBody;

      const validation = resumeContentSchemaStrict.safeParse(body.content);

      if (!validation.success) {
        return createErrorResponse(
          "Validation failed. Please check your input.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
          validation.error.issues,
        );
      }

      const content = validation.data;
      const now = new Date().toISOString();

      const previewFields = extractPreviewFields(content);

      const updateResult = await db
        .update(siteData)
        .set({
          content,
          ...previewFields,
          lastPublishedAt: now,
          updatedAt: now,
        })
        .where(eq(siteData.userId, userId))
        .returning({
          id: siteData.id,
          lastPublishedAt: siteData.lastPublishedAt,
        });

      if (updateResult.length === 0) {
        return createErrorResponse(
          "Resume data not found. Please upload a resume first.",
          ERROR_CODES.NOT_FOUND,
          404,
        );
      }

      const data = updateResult[0];

      const updatedName = content.full_name?.trim();
      if (updatedName && updatedName !== "Pending" && updatedName !== "Unnamed") {
        const userRow = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        const currentName = userRow[0]?.name;
        if (!currentName || currentName === "Unnamed" || currentName.trim() === "") {
          await db
            .update(user)
            .set({ name: updatedName, updatedAt: now })
            .where(eq(user.id, userId));
        }
      }

      return createSuccessResponse({
        success: true,
        data: {
          id: data.id,
          last_published_at: data.lastPublishedAt,
        },
      });
    },
    "You must be logged in to update your resume",
  );
}
