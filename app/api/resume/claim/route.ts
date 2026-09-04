import { and, desc, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import { captureServerEvent } from "@/lib/analytics/server";
import { withUser } from "@/lib/auth/with-auth";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { NewResume } from "@/lib/db/schema";
import { resumes, user } from "@/lib/db/schema";
import type { ResumeContent } from "@/lib/types/database";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import { getR2Binding, R2 } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/rate-limit/user";
import { claimRequestSchema } from "@/lib/schemas/resume";
import { sha256Hex } from "@/lib/utils/hash";
import { getOptionalEnvValue } from "@/lib/utils/env";
import { COOKIE_NAME, parseSignedCookieValue } from "@/lib/utils/pending-upload-cookie";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";
import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  readJsonWithLimit,
  validateRequestSize,
} from "@/lib/utils/validation";

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
    async ({ user: authUser, db, env }) => {
      const userId = authUser.id;

      const r2Binding = getR2Binding(env);
      if (!r2Binding) {
        return createErrorResponse(
          "Storage service unavailable",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
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

      const bodyResult = claimRequestSchema.safeParse(rawBodyResult.data);
      if (!bodyResult.success) {
        return createErrorResponse(
          "Invalid upload key. Must be a temporary upload.",
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }
      const body = bodyResult.data;
      const { key } = body;

      // SECURITY: Prevents unauthorized claims of leaked temp keys (Issue #89)
      const cookieHeader = request.headers.get("cookie");
      const pendingUploadCookie = cookieHeader
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${COOKIE_NAME}=`))
        ?.slice(`${COOKIE_NAME}=`.length);

      if (!pendingUploadCookie) {
        return createErrorResponse(
          "Unauthorized upload attempt. Upload verification cookie is missing.",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
      const cookieSecret = getOptionalEnvValue(env, "PENDING_UPLOAD_SECRET");
      if (!cookieSecret || !z.string().safeParse(cookieSecret).success) {
        return createErrorResponse(
          "Upload verification unavailable. Server configuration error.",
          ERROR_CODES.INTERNAL_ERROR,
          500,
        );
      }

      const parsedCookie = await parseSignedCookieValue(pendingUploadCookie, cookieSecret);
      if (!parsedCookie) {
        return createErrorResponse(
          "Unauthorized upload attempt. Invalid or expired upload verification.",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }

      if (parsedCookie.tempKey !== key) {
        return createErrorResponse(
          "Unauthorized upload attempt. Upload key mismatch.",
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }

      const findRecentResume = async () => {
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const recentResume = await db
          .select({ id: resumes.id, status: resumes.status })
          .from(resumes)
          .where(and(eq(resumes.userId, userId), gte(resumes.createdAt, twoMinAgo)))
          .orderBy(desc(resumes.createdAt))
          .limit(1);

        return recentResume[0] ?? null;
      };
      const isLikelyMissingObjectError = (cause: unknown): boolean => {
        if (!(cause instanceof Error)) return false;
        return /not\s*found|no\s*such\s*key|does\s*not\s*exist|404/i.test(cause.message);
      };

      let fileBuffer: ArrayBuffer;
      let computedFileHash: string;

      try {
        const buffer = await R2.getAsArrayBuffer(r2Binding, key);
        if (!buffer) {
          const recentResume = await findRecentResume();

          if (recentResume) {
            return createSuccessResponse({
              resume_id: recentResume.id,
              status: recentResume.status,
              already_claimed: true,
            });
          }

          return createErrorResponse(
            "File not found. The upload may have expired.",
            ERROR_CODES.VALIDATION_ERROR,
            404,
          );
        }
        fileBuffer = buffer;

        computedFileHash = await sha256Hex(fileBuffer);

        if (fileBuffer.byteLength > MAX_FILE_SIZE) {
          return createErrorResponse(
            `File size exceeds ${MAX_FILE_SIZE_LABEL} limit (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB)`,
            ERROR_CODES.VALIDATION_ERROR,
            400,
          );
        }

        const pdfBytes = new Uint8Array(fileBuffer.slice(0, 5));
        if (!String.fromCharCode(...pdfBytes).startsWith("%PDF-")) {
          return createErrorResponse("Invalid PDF format", ERROR_CODES.VALIDATION_ERROR, 400);
        }
      } catch (error) {
        console.error("Error fetching file from R2:", error);

        if (isLikelyMissingObjectError(error)) {
          try {
            const recentResume = await findRecentResume();
            if (recentResume) {
              return createSuccessResponse({
                resume_id: recentResume.id,
                status: recentResume.status,
                already_claimed: true,
              });
            }
          } catch (recentResumeError) {
            console.error(
              "Error checking recent resumes after R2 fetch failure:",
              recentResumeError,
            );
          }
        }

        return createErrorResponse(
          "Failed to retrieve file. The upload may have expired.",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      const rateLimitResponse = await enforceRateLimit(userId, "resume_upload", env);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const timestamp = Date.now();
      const filename = key.split("/").pop();
      const newKey = `users/${userId}/${timestamp}/${filename}`;
      const resumeId = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        await db.insert(resumes).values({
          id: resumeId,
          userId,
          r2Key: newKey,
          fileHash: computedFileHash,
          status: "pending_claim",
          createdAt: now,
        });
      } catch (insertError) {
        console.error("Database insert error:", insertError);
        return createErrorResponse(
          "Failed to create resume record. Please try again.",
          ERROR_CODES.DATABASE_ERROR,
          500,
        );
      }

      const cached = await db
        .select({ id: resumes.id, parsedContent: resumes.parsedContent })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, userId),
            eq(resumes.fileHash, computedFileHash),
            eq(resumes.status, "completed"),
            isNotNull(resumes.parsedContent),
            ne(resumes.id, resumeId),
          ),
        )
        .limit(1);

      // SAFETY: parsedContent is schema-validated JSONB written only by our queue consumer; cast bridges the column's wide Record type to ResumeContent.
      const cachedContent = (cached[0]?.parsedContent as ResumeContent | null) ?? null;

      if (cachedContent) {
        let r2PutSucceeded = false;
        try {
          await Promise.all([
            R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
            R2.delete(r2Binding, key).catch((err) =>
              console.warn("R2 delete failed for cached resume path:", err),
            ),
          ]);
          r2PutSucceeded = true;
        } catch (r2Error) {
          console.error("R2 operations failed for cached resume:", r2Error);
        }

        if (r2PutSucceeded) {
          try {
            const userRow = await db
              .select({ handle: user.handle, name: user.name })
              .from(user)
              .where(eq(user.id, userId))
              .limit(1);
            const hasHandle = !!userRow[0]?.handle;
            const currentName = userRow[0]?.name;
            const cachedName = cachedContent.full_name?.trim();
            const shouldUpdateName =
              cachedName &&
              cachedName !== "Pending" &&
              cachedName !== "Unnamed" &&
              (!currentName || currentName === "Unnamed" || currentName.trim() === "");

            await db.transaction(async (tx) => {
              await tx
                .update(resumes)
                .set({
                  status: "completed",
                  fileHash: computedFileHash,
                  parsedAt: now,
                  parsedContent: cachedContent,
                })
                .where(eq(resumes.id, resumeId));
              await buildSiteDataUpsert(tx, userId, resumeId, cachedContent, {
                publish: hasHandle,
              });
              if (shouldUpdateName) {
                await tx
                  .update(user)
                  .set({ name: cachedName, updatedAt: now })
                  .where(eq(user.id, userId));
              }
            });

            captureServerEvent(userId, "resume_claim_cached", {
              resume_id: resumeId,
            });
            return createSuccessResponse({
              resume_id: resumeId,
              status: "completed",
              cached: true,
            });
          } catch (updateError) {
            console.error("Failed to update resume with cached content:", updateError);
          }
        }
      }

      const processing = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, userId),
            eq(resumes.fileHash, computedFileHash),
            inArray(resumes.status, ["processing", "queued"]),
            ne(resumes.id, resumeId),
          ),
        )
        .limit(1);

      if (processing[0]) {
        let r2PutSucceeded = false;
        try {
          await Promise.all([
            R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
            R2.delete(r2Binding, key).catch((err) =>
              console.warn("R2 delete failed for waiting_for_cache path:", err),
            ),
          ]);
          r2PutSucceeded = true;
        } catch (error) {
          console.error("R2 operations failed for waiting resume:", error);
        }

        if (r2PutSucceeded) {
          try {
            await db
              .update(resumes)
              .set({
                status: "waiting_for_cache",
                fileHash: computedFileHash,
              })
              .where(eq(resumes.id, resumeId));

            return createSuccessResponse({
              resume_id: resumeId,
              status: "processing",
              waiting_for_cache: true,
            });
          } catch (waitError) {
            console.error("Failed to set waiting_for_cache status:", waitError);
          }
        }
      }

      const failResume = async (errorMessage: string, errorCode: string, statusCode: number) => {
        await db
          .update(resumes)
          .set({ status: "failed", errorMessage })
          .where(eq(resumes.id, resumeId));

        return createErrorResponse(errorMessage, errorCode, statusCode);
      };

      try {
        await Promise.all([
          R2.put(r2Binding, newKey, fileBuffer, { contentType: "application/pdf" }),
          R2.delete(r2Binding, key).catch((err) => console.error("R2 delete error:", err)),
        ]);
      } catch (error) {
        console.error("R2 put error:", error);
        return await failResume(
          "Failed to store file for processing",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      const updatePayload: Partial<NewResume> = {
        status: "queued",
        fileHash: computedFileHash,
      };

      try {
        await db.update(resumes).set(updatePayload).where(eq(resumes.id, resumeId));
      } catch (updateError) {
        console.error("Failed to update resume with queued status:", updateError);
        return await failResume("Failed to update resume status", ERROR_CODES.DATABASE_ERROR, 500);
      }

      const queue = env.CLICKFOLIO_PARSE_QUEUE;
      if (!queue) {
        try {
          await db.update(resumes).set({ status: "pending_claim" }).where(eq(resumes.id, resumeId));
        } catch {}
        return await failResume("Queue service unavailable", ERROR_CODES.INTERNAL_ERROR, 500);
      }

      try {
        await publishResumeParse(queue, {
          resumeId,
          userId,
          r2Key: newKey,
          fileHash: computedFileHash,
          attempt: 1,
        });
      } catch (queueError) {
        console.error("Failed to publish resume parse job:", queueError);
        try {
          await db.update(resumes).set({ status: "pending_claim" }).where(eq(resumes.id, resumeId));
        } catch {}
        return createErrorResponse(
          "Failed to queue resume for processing",
          ERROR_CODES.EXTERNAL_SERVICE_ERROR,
          500,
        );
      }

      captureServerEvent(userId, "resume_claimed", {
        resume_id: resumeId,
      });
      return createSuccessResponse({
        resume_id: resumeId,
        status: "queued",
      });
    },
    "You must be logged in to claim a resume",
  );
}
