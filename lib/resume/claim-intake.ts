import { and, desc, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { Database } from "@/lib/db";
import type { NewResume } from "@/lib/db/schema";
import { resumes, user } from "@/lib/db/schema";
import { publishResumeParse } from "@/lib/queue/resume-parse";
import type { ResumeParseMessage } from "@/lib/queue/types";
import { R2 } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/rate-limit/user";
import { shouldSyncDisplayName } from "@/lib/resume/completion";
import type { ResumeContent } from "@/lib/types/database";
import { sha256Hex } from "@/lib/utils/hash";
import { ERROR_CODES } from "@/lib/utils/security-headers";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";

export type ClaimIntakeOutcome =
  | { kind: "already_claimed"; resumeId: string; status: string }
  | { kind: "cached"; resumeId: string }
  | { kind: "waiting_for_cache"; resumeId: string }
  | { kind: "queued"; resumeId: string }
  | { kind: "rate_limited"; response: Response }
  | {
      kind: "error";
      message: string;
      code: keyof typeof ERROR_CODES;
      httpStatus: number;
    };

export type ClaimIntakeDeps = {
  db: Database;
  r2: R2Bucket;
  queue: Queue<ResumeParseMessage> | null | undefined;
  env?: Pick<CloudflareEnv, "HYPERDRIVE">;
  userId: string;
  tempKey: string;
};

function isLikelyMissingObjectError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  return /not\s*found|no\s*such\s*key|does\s*not\s*exist|404/i.test(cause.message);
}

// Unified R2 failure policy: the object write must succeed or the intake fails;
// temp-cleanup failure only warns and the intake proceeds.
async function moveTempFile(
  r2: R2Bucket,
  tempKey: string,
  newKey: string,
  fileBuffer: ArrayBuffer,
): Promise<void> {
  await R2.put(r2, newKey, fileBuffer, { contentType: "application/pdf" });
  await R2.delete(r2, tempKey).catch((err) =>
    console.warn("R2 delete failed for claim temp key:", err),
  );
}

export async function runClaimIntake(deps: ClaimIntakeDeps): Promise<ClaimIntakeOutcome> {
  const { db, r2, queue, env, userId, tempKey } = deps;

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

  let fileBuffer: ArrayBuffer;
  let computedFileHash: string;

  try {
    const buffer = await R2.getAsArrayBuffer(r2, tempKey);
    if (!buffer) {
      const recentResume = await findRecentResume();

      if (recentResume) {
        return {
          kind: "already_claimed",
          resumeId: recentResume.id,
          status: recentResume.status,
        };
      }

      return {
        kind: "error",
        message: "File not found. The upload may have expired.",
        code: "VALIDATION_ERROR",
        httpStatus: 404,
      };
    }
    fileBuffer = buffer;

    computedFileHash = await sha256Hex(fileBuffer);

    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      return {
        kind: "error",
        message: `File size exceeds ${MAX_FILE_SIZE_LABEL} limit (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB)`,
        code: "VALIDATION_ERROR",
        httpStatus: 400,
      };
    }

    const pdfBytes = new Uint8Array(fileBuffer.slice(0, 5));
    if (!String.fromCharCode(...pdfBytes).startsWith("%PDF-")) {
      return {
        kind: "error",
        message: "Invalid PDF format",
        code: "VALIDATION_ERROR",
        httpStatus: 400,
      };
    }
  } catch (error) {
    console.error("Error fetching file from R2:", error);

    if (isLikelyMissingObjectError(error)) {
      try {
        const recentResume = await findRecentResume();
        if (recentResume) {
          return {
            kind: "already_claimed",
            resumeId: recentResume.id,
            status: recentResume.status,
          };
        }
      } catch (recentResumeError) {
        console.error("Error checking recent resumes after R2 fetch failure:", recentResumeError);
      }
    }

    return {
      kind: "error",
      message: "Failed to retrieve file. The upload may have expired.",
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 500,
    };
  }

  // The double-claim guard above stays ahead of rate-limiting.
  const rateLimitResponse = await enforceRateLimit(userId, "resume_upload", env);
  if (rateLimitResponse) {
    return { kind: "rate_limited", response: rateLimitResponse };
  }

  const timestamp = Date.now();
  const filename = tempKey.split("/").pop();
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
    return {
      kind: "error",
      message: "Failed to create resume record. Please try again.",
      code: "DATABASE_ERROR",
      httpStatus: 500,
    };
  }

  const failResume = async (errorMessage: string): Promise<void> => {
    await db
      .update(resumes)
      .set({ status: "failed", errorMessage })
      .where(eq(resumes.id, resumeId));
  };

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
    try {
      await moveTempFile(r2, tempKey, newKey, fileBuffer);
    } catch (r2Error) {
      console.error("R2 operations failed for cached resume:", r2Error);
      await failResume("Failed to store file for processing");
      return {
        kind: "error",
        message: "Failed to store file for processing",
        code: "EXTERNAL_SERVICE_ERROR",
        httpStatus: 500,
      };
    }

    try {
      const userRow = await db
        .select({ handle: user.handle, name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const hasHandle = !!userRow[0]?.handle;
      const currentName = userRow[0]?.name;
      const cachedName = cachedContent.full_name?.trim();
      // Same rule as fresh parses (single owner: shouldSyncDisplayName):
      // career level iff AI-provided, display name iff currently missing.
      const cachedLevel = cachedContent.professional_level ?? undefined;
      const shouldUpdateName = shouldSyncDisplayName(cachedName, currentName);

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
        if (shouldUpdateName || cachedLevel) {
          type IntakeUserUpdate = Partial<typeof user.$inferInsert>;
          const intakeUserUpdate: IntakeUserUpdate = { updatedAt: now };
          if (shouldSyncDisplayName(cachedName, currentName)) {
            intakeUserUpdate.name = cachedName;
          }
          if (cachedLevel) {
            intakeUserUpdate.role = cachedLevel;
            intakeUserUpdate.roleSource = "ai";
          }
          await tx.update(user).set(intakeUserUpdate).where(eq(user.id, userId));
        }
      });

      return { kind: "cached", resumeId };
    } catch (updateError) {
      console.error("Failed to update resume with cached content:", updateError);
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
    try {
      await moveTempFile(r2, tempKey, newKey, fileBuffer);
    } catch (error) {
      console.error("R2 operations failed for waiting resume:", error);
      await failResume("Failed to store file for processing");
      return {
        kind: "error",
        message: "Failed to store file for processing",
        code: "EXTERNAL_SERVICE_ERROR",
        httpStatus: 500,
      };
    }

    try {
      await db
        .update(resumes)
        .set({
          status: "waiting_for_cache",
          fileHash: computedFileHash,
        })
        .where(eq(resumes.id, resumeId));

      return { kind: "waiting_for_cache", resumeId };
    } catch (waitError) {
      console.error("Failed to set waiting_for_cache status:", waitError);
    }
  }

  try {
    await moveTempFile(r2, tempKey, newKey, fileBuffer);
  } catch (error) {
    console.error("R2 put error:", error);
    await failResume("Failed to store file for processing");
    return {
      kind: "error",
      message: "Failed to store file for processing",
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 500,
    };
  }

  const updatePayload: Partial<NewResume> = {
    status: "queued",
    fileHash: computedFileHash,
  };

  try {
    await db.update(resumes).set(updatePayload).where(eq(resumes.id, resumeId));
  } catch (updateError) {
    console.error("Failed to update resume with queued status:", updateError);
    await failResume("Failed to update resume status");
    return {
      kind: "error",
      message: "Failed to update resume status",
      code: "DATABASE_ERROR",
      httpStatus: 500,
    };
  }

  if (!queue) {
    try {
      await db.update(resumes).set({ status: "pending_claim" }).where(eq(resumes.id, resumeId));
    } catch {}
    await failResume("Queue service unavailable");
    return {
      kind: "error",
      message: "Queue service unavailable",
      code: "INTERNAL_ERROR",
      httpStatus: 500,
    };
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
    return {
      kind: "error",
      message: "Failed to queue resume for processing",
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 500,
    };
  }

  return { kind: "queued", resumeId };
}
