import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { resumes, siteData } from "@/lib/db/schema";
import { getSessionDb } from "@/lib/db/session";
import { getParseStatus, normalizeResumeData } from "@/lib/replicate";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "@/lib/utils/security-headers";

export async function GET(request: Request) {
  try {
    // 1. Get D1 database binding and typed env for Replicate
    const { env } = await getCloudflareContext({ async: true });
    const typedEnv = env as Partial<CloudflareEnv>;
    const { db, captureBookmark } = await getSessionDb(env.DB);

    // 2. Check authentication via Better Auth
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return createErrorResponse(
        "You must be logged in to check resume status",
        ERROR_CODES.UNAUTHORIZED,
        401,
      );
    }

    const userId = session.user.id;

    // 3. Get resume_id from query params
    const { searchParams } = new URL(request.url);
    const resumeId = searchParams.get("resume_id");

    if (!resumeId) {
      return createErrorResponse("resume_id parameter is required", ERROR_CODES.BAD_REQUEST, 400);
    }

    // 4. Fetch resume from database (include fileHash for fan-out)
    const resume = await db.query.resumes.findFirst({
      where: eq(resumes.id, resumeId),
    });

    if (!resume) {
      return createErrorResponse("Resume not found", ERROR_CODES.NOT_FOUND, 404);
    }

    // 5. Verify ownership
    if (resume.userId !== userId) {
      return createErrorResponse(
        "You do not have permission to access this resume",
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }

    // 6. If not processing, return current status
    if (resume.status !== "processing") {
      return createSuccessResponse({
        status: resume.status,
        progress_pct: resume.status === "completed" ? 100 : 0,
        error: resume.errorMessage,
        can_retry: resume.status === "failed" && resume.retryCount < 2,
      });
    }

    // 7. Check if we have a replicate job ID
    if (!resume.replicateJobId) {
      return createSuccessResponse({
        status: "processing",
        progress_pct: 10,
        error: null,
        can_retry: false,
      });
    }

    // 8. Poll Replicate for status (pass env for AI Gateway credentials)
    let prediction;
    try {
      prediction = await getParseStatus(resume.replicateJobId, typedEnv);
    } catch (error) {
      console.error("Replicate API error:", error);
      // Return processing status on network errors - client will retry
      return createSuccessResponse({
        status: "processing",
        progress_pct: 30,
        error: null,
        can_retry: false,
      });
    }

    // 9. Handle Replicate status
    if (prediction.status === "succeeded") {
      try {
        // IDEMPOTENCY: Re-check status to handle race condition with webhook
        const currentResume = await db.query.resumes.findFirst({
          where: eq(resumes.id, resumeId),
          columns: { status: true },
        });

        if (currentResume?.status === "completed" || currentResume?.status === "failed") {
          // Already processed (likely by webhook), return current status
          return createSuccessResponse({
            status: currentResume.status,
            progress_pct: currentResume.status === "completed" ? 100 : 0,
            error: null,
            can_retry: false,
          });
        }

        // Extract and normalize data
        if (!prediction.output?.extraction_schema_json) {
          throw new Error("Missing extraction_schema_json in Replicate output");
        }

        const normalizedContent = normalizeResumeData(prediction.output.extraction_schema_json);
        const contentAsJson = JSON.parse(JSON.stringify(normalizedContent));
        const now = new Date().toISOString();

        // Check if site_data exists for this user
        const existingSiteData = await db.query.siteData.findFirst({
          where: eq(siteData.userId, userId),
          columns: { id: true },
        });

        if (existingSiteData) {
          // Update existing site_data
          await db
            .update(siteData)
            .set({
              resumeId: resumeId,
              content: JSON.stringify(contentAsJson),
              lastPublishedAt: now,
              updatedAt: now,
            })
            .where(eq(siteData.userId, userId));
        } else {
          // Insert new site_data
          await db.insert(siteData).values({
            id: crypto.randomUUID(),
            userId: userId,
            resumeId: resumeId,
            content: JSON.stringify(contentAsJson),
            lastPublishedAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Update resume status to completed WITH parsed_content for cache lookup
        // Use optimistic locking (only update if still processing) to prevent race conditions
        await db
          .update(resumes)
          .set({
            status: "completed",
            parsedAt: now,
            parsedContent: JSON.stringify(contentAsJson),
          })
          .where(and(eq(resumes.id, resumeId), eq(resumes.status, "processing")));

        // Fan out to all resumes waiting for this file hash (same pattern as webhook)
        if (resume.fileHash) {
          const waitingResumes = await db.query.resumes.findMany({
            where: and(
              eq(resumes.fileHash, resume.fileHash),
              eq(resumes.status, "waiting_for_cache"),
            ),
            columns: { id: true, userId: true },
          });

          if (waitingResumes.length > 0) {
            const updatePromises = waitingResumes.map(async (waiting) => {
              try {
                await db
                  .update(resumes)
                  .set({
                    status: "completed",
                    parsedAt: now,
                    parsedContent: JSON.stringify(contentAsJson),
                  })
                  .where(eq(resumes.id, waiting.id));

                // Check if site_data exists for waiting user
                const waitingSiteData = await db.query.siteData.findFirst({
                  where: eq(siteData.userId, waiting.userId),
                  columns: { id: true },
                });

                if (waitingSiteData) {
                  await db
                    .update(siteData)
                    .set({
                      resumeId: waiting.id,
                      content: JSON.stringify(contentAsJson),
                      lastPublishedAt: now,
                      updatedAt: now,
                    })
                    .where(eq(siteData.userId, waiting.userId));
                } else {
                  await db.insert(siteData).values({
                    id: crypto.randomUUID(),
                    userId: waiting.userId,
                    resumeId: waiting.id,
                    content: JSON.stringify(contentAsJson),
                    lastPublishedAt: now,
                    createdAt: now,
                    updatedAt: now,
                  });
                }

                return { success: true, id: waiting.id };
              } catch (error) {
                console.error(`Failed to update waiting resume ${waiting.id}:`, error);
                return { success: false, id: waiting.id, error };
              }
            });

            const results = await Promise.allSettled(updatePromises);
            const failed = results.filter(
              (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
            );
            if (failed.length > 0) {
              console.error(
                `Fan-out (polling): ${failed.length}/${waitingResumes.length} updates failed for hash ${resume.fileHash}`,
              );
            } else {
              console.log(
                `Fan-out (polling): Updated ${waitingResumes.length} waiting resumes for hash ${resume.fileHash}`,
              );
            }
          }
        }

        await captureBookmark();
        return createSuccessResponse({
          status: "completed",
          progress_pct: 100,
          error: null,
          can_retry: false,
        });
      } catch (error) {
        console.error("Resume normalization error:", error);

        const errorMessage =
          error instanceof Error
            ? `AI parsing validation failed: ${error.message}`
            : "Failed to process resume data";

        // Mark resume as failed
        await db
          .update(resumes)
          .set({
            status: "failed",
            errorMessage: errorMessage,
          })
          .where(eq(resumes.id, resumeId));

        // Return failed status (not error - allows UI to show retry)
        await captureBookmark();
        return createSuccessResponse({
          status: "failed",
          progress_pct: 0,
          error: errorMessage,
          can_retry: resume.retryCount < 2,
        });
      }
    } else if (
      prediction.status === "failed" ||
      prediction.status === "canceled" ||
      prediction.status === "aborted"
    ) {
      // Mark as failed
      const errorMessage = prediction.error || "AI parsing failed";

      await db
        .update(resumes)
        .set({
          status: "failed",
          errorMessage: errorMessage,
        })
        .where(eq(resumes.id, resumeId));

      await captureBookmark();
      return createSuccessResponse({
        status: "failed",
        progress_pct: 0,
        error: errorMessage,
        can_retry: resume.retryCount < 2,
      });
    } else {
      // Still processing or starting
      const progressMap: Record<string, number> = {
        starting: 20,
        processing: 50,
      };

      return createSuccessResponse({
        status: "processing",
        progress_pct: progressMap[prediction.status] || 30,
        error: null,
        can_retry: false,
      });
    }
  } catch (error) {
    console.error("Error checking resume status:", error);
    return createErrorResponse(
      "An unexpected error occurred while checking status",
      ERROR_CODES.INTERNAL_ERROR,
      500,
    );
  }
}
