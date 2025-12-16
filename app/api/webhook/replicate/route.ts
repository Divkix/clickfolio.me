import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { getResumeCacheTag } from "@/lib/data/resume";
import { resumes, siteData, user } from "@/lib/db/schema";
import { getSessionDbForWebhook } from "@/lib/db/session";
import { normalizeResumeData } from "@/lib/replicate";
import { verifyReplicateWebhook } from "@/lib/utils/webhook-verification";

/**
 * Convert technical validation errors to user-friendly messages
 */
function makeUserFriendlyError(rawMessage: string): string {
  if (rawMessage.includes("Invalid email")) {
    return "We couldn't extract a valid email from your resume. Please ensure your email address is complete and clearly visible.";
  }
  if (rawMessage.includes("Invalid LinkedIn URL")) {
    return "The LinkedIn URL in your resume couldn't be parsed correctly. Please ensure it's a complete URL.";
  }
  if (rawMessage.includes("Invalid GitHub URL")) {
    return "The GitHub URL in your resume couldn't be parsed correctly. Please ensure it's a complete URL.";
  }
  if (rawMessage.includes("is required")) {
    const match = rawMessage.match(/Invalid resume data structure: (.+) is required/);
    if (match) {
      return `We couldn't find the ${match[1].toLowerCase()} in your resume. Please ensure it's clearly visible.`;
    }
  }
  // Default: strip technical prefix and return
  return rawMessage.replace("Invalid resume data structure: ", "Parsing issue: ");
}

/**
 * Upsert site_data with UNIQUE constraint handling
 * Handles race conditions where another request may have inserted between SELECT and INSERT
 */
async function upsertSiteData(
  db: ReturnType<typeof getSessionDbForWebhook>["db"],
  userId: string,
  resumeId: string,
  content: string,
  now: string,
): Promise<void> {
  // First check if record exists
  const existingSiteData = await db
    .select({ id: siteData.id })
    .from(siteData)
    .where(eq(siteData.userId, userId))
    .limit(1);

  if (existingSiteData.length > 0) {
    await db
      .update(siteData)
      .set({
        resumeId,
        content,
        lastPublishedAt: now,
        updatedAt: now,
      })
      .where(eq(siteData.userId, userId));
  } else {
    // Try to insert, handle UNIQUE constraint race condition
    try {
      await db.insert(siteData).values({
        id: crypto.randomUUID(),
        userId,
        resumeId,
        content,
        lastPublishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        // Another request inserted between our SELECT and INSERT, update instead
        await db
          .update(siteData)
          .set({
            resumeId,
            content,
            lastPublishedAt: now,
            updatedAt: now,
          })
          .where(eq(siteData.userId, userId));
      } else {
        throw error;
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    // 1. Verify webhook signature
    const { isValid, body } = await verifyReplicateWebhook(request);

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Parse payload
    const payload = JSON.parse(body);
    const { id: replicateJobId, status, output, error } = payload;

    console.log(`Webhook received: job=${replicateJobId}, status=${status}`);

    // 3. Only process completed events
    if (status !== "succeeded" && status !== "failed" && status !== "canceled") {
      return new Response("OK", { status: 200 });
    }

    // 4. Get database connection (no auth session, webhook uses signature verification)
    const { env } = await getCloudflareContext({ async: true });
    const { db } = getSessionDbForWebhook(env.DB);

    // 5. Find resume by replicate_job_id
    const resumeResult = await db
      .select({
        id: resumes.id,
        userId: resumes.userId,
        status: resumes.status,
        fileHash: resumes.fileHash,
      })
      .from(resumes)
      .where(eq(resumes.replicateJobId, replicateJobId))
      .limit(1);

    if (!resumeResult.length) {
      console.error("Resume not found for job:", replicateJobId);
      return new Response("Resume not found", { status: 404 });
    }

    const resume = resumeResult[0];

    // 6. Skip if already processed (idempotency)
    if (resume.status === "completed" || resume.status === "failed") {
      console.log("Resume already processed, skipping");
      return new Response("OK", { status: 200 });
    }

    // 7. Handle success
    if (status === "succeeded") {
      if (!output?.extraction_schema_json) {
        console.error("Missing extraction_schema_json in output");
        await db
          .update(resumes)
          .set({
            status: "failed",
            errorMessage: "Missing parsed data in Replicate output",
          })
          .where(eq(resumes.id, resume.id));
        return new Response("OK", { status: 200 });
      }

      // Normalize and validate parsed data
      let normalizedContent;
      try {
        normalizedContent = normalizeResumeData(output.extraction_schema_json);
      } catch (validationError) {
        const rawMessage =
          validationError instanceof Error
            ? validationError.message
            : "Failed to parse resume data";

        // Make error message user-friendly
        const userMessage = makeUserFriendlyError(rawMessage);

        console.error("Validation failed:", rawMessage);

        await db
          .update(resumes)
          .set({
            status: "failed",
            errorMessage: userMessage,
          })
          .where(eq(resumes.id, resume.id));

        return new Response("OK", { status: 200 });
      }

      // Serialize content to JSON string for D1
      const contentJson = JSON.stringify(normalizedContent);
      const now = new Date().toISOString();

      // Upsert site_data with race condition handling
      await upsertSiteData(db, resume.userId, resume.id, contentJson, now);

      // Update resume status with optimistic lock to prevent race conditions
      // Only update if status is still "processing" - another process may have completed it
      // D1 doesn't return affected rows, but if status wasn't "processing", this is a no-op
      await db
        .update(resumes)
        .set({
          status: "completed",
          parsedAt: now,
          parsedContent: contentJson,
        })
        .where(and(eq(resumes.id, resume.id), eq(resumes.status, "processing")));

      // Fan out to all resumes waiting for this file hash
      if (resume.fileHash) {
        // Get full resume data to check status
        const waitingResumesFull = await db
          .select({ id: resumes.id, userId: resumes.userId, status: resumes.status })
          .from(resumes)
          .where(eq(resumes.fileHash, resume.fileHash));

        const resumesToUpdate = waitingResumesFull.filter(
          (r) => r.id !== resume.id && r.status === "waiting_for_cache",
        );

        if (resumesToUpdate.length > 0) {
          // Batch-fetch ALL siteData records for waiting users in ONE query
          // This eliminates the N+1 query pattern
          const userIds = resumesToUpdate.map((r) => r.userId);
          const allSiteData = await db
            .select({ userId: siteData.userId, id: siteData.id })
            .from(siteData)
            .where(inArray(siteData.userId, userIds));

          // Create a Map for O(1) lookups
          const siteDataMap = new Map(allSiteData.map((sd) => [sd.userId, sd.id]));

          const updatePromises = resumesToUpdate.map(async (waiting) => {
            try {
              // Update resume status
              await db
                .update(resumes)
                .set({
                  status: "completed",
                  parsedAt: now,
                  parsedContent: contentJson,
                })
                .where(eq(resumes.id, waiting.id));

              // Upsert site_data for waiting user using the pre-fetched map
              const existingSiteDataId = siteDataMap.get(waiting.userId);

              if (existingSiteDataId) {
                await db
                  .update(siteData)
                  .set({
                    resumeId: waiting.id,
                    content: contentJson,
                    lastPublishedAt: now,
                    updatedAt: now,
                  })
                  .where(eq(siteData.userId, waiting.userId));
              } else {
                // Handle UNIQUE constraint race condition in fan-out
                try {
                  await db.insert(siteData).values({
                    id: crypto.randomUUID(),
                    userId: waiting.userId,
                    resumeId: waiting.id,
                    content: contentJson,
                    lastPublishedAt: now,
                    createdAt: now,
                    updatedAt: now,
                  });
                } catch (insertError) {
                  if (
                    insertError instanceof Error &&
                    insertError.message.includes("UNIQUE constraint failed")
                  ) {
                    await db
                      .update(siteData)
                      .set({
                        resumeId: waiting.id,
                        content: contentJson,
                        lastPublishedAt: now,
                        updatedAt: now,
                      })
                      .where(eq(siteData.userId, waiting.userId));
                  } else {
                    throw insertError;
                  }
                }
              }

              return { success: true, id: waiting.id };
            } catch (updateError) {
              console.error(`Failed to update waiting resume ${waiting.id}:`, updateError);
              return { success: false, id: waiting.id, error: updateError };
            }
          });

          const results = await Promise.allSettled(updatePromises);
          const failed = results.filter(
            (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success),
          );
          if (failed.length > 0) {
            console.error(
              `Fan-out: ${failed.length}/${resumesToUpdate.length} updates failed for hash ${resume.fileHash}`,
            );
          } else {
            console.log(
              `Fan-out: Updated ${resumesToUpdate.length} waiting resumes for hash ${resume.fileHash}`,
            );
          }
        }
      }

      // Invalidate cache for public resume page
      const profile = await db
        .select({ handle: user.handle })
        .from(user)
        .where(eq(user.id, resume.userId))
        .limit(1);

      if (profile.length > 0 && profile[0].handle) {
        revalidateTag(getResumeCacheTag(profile[0].handle));
      }

      console.log("Resume processing completed successfully");
    }

    // 8. Handle failure
    else if (status === "failed" || status === "canceled") {
      await db
        .update(resumes)
        .set({
          status: "failed",
          errorMessage: error || "AI parsing failed",
        })
        .where(eq(resumes.id, resume.id));

      console.log("Resume processing failed:", error);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
