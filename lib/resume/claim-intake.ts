import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import type { Database } from "@/lib/db";
import { resumes, user } from "@/lib/db/schema";
import { R2 } from "@/lib/r2";
import { enforceRateLimit } from "@/lib/rate-limit/user";
import { shouldSyncDisplayName } from "@/lib/resume/completion";
import type { ResumeContent } from "@/lib/types/database";
import { sha256Hex } from "@/lib/utils/hash";
import { ERROR_CODES } from "@/lib/utils/security-headers";
import { log } from "@/lib/utils/log";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from "@/lib/utils/validation";
import { deleteR2Objects, type R2DeleteWorkflowBinding } from "@/lib/workflows/r2-delete";
import {
  parseInstanceId,
  startResumeParse,
  type ResumeParseWorkflowBinding,
} from "@/lib/workflows/resume-parse";

// One in-flight claim per (user, file hash) is arbitrated by the narrow unique
// index resumes_user_hash_pending_uidx (migrations_pg/0006): only a pending_claim
// row blocks a new claim, so queued/processing/waiting_for_cache rows coexist
// with the waiting_for_cache clone created by a duplicate claim.

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
  parseWorkflow: ResumeParseWorkflowBinding | null | undefined;
  r2DeleteWorkflow?: R2DeleteWorkflowBinding;
  env?: Pick<CloudflareEnv, "HYPERDRIVE">;
  userId: string;
  tempKey: string;
};

function isLikelyMissingObjectError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;

  return /not\s*found|no\s*such\s*key|does\s*not\s*exist|404/i.test(cause.message);
}

// A failed temp/ delete needs no follow-up: the bucket's temp/ lifecycle rule
// (r2-lifecycle.json) expires it.
async function deleteTempObject(r2: R2Bucket, key: string): Promise<void> {
  await R2.delete(r2, key).catch((error) => {
    log("warn", "temp R2 delete failed; lifecycle rule will expire it", {
      key,
      error: String(error),
    });
  });
}

// Unified R2 failure policy: the object write must succeed or the intake fails;
// temp-cleanup failure is left to the lifecycle rule and the intake proceeds.
async function moveTempFile(
  r2: R2Bucket,
  tempKey: string,
  newKey: string,
  fileBuffer: ArrayBuffer,
): Promise<void> {
  await R2.put(r2, newKey, fileBuffer, { contentType: "application/pdf" });
  await deleteTempObject(r2, tempKey);
}

export async function runClaimIntake(deps: ClaimIntakeDeps): Promise<ClaimIntakeOutcome> {
  const { db, r2, parseWorkflow, r2DeleteWorkflow, env, userId, tempKey } = deps;

  // Only a row that still names this temp key is this claim. A newer resume
  // created in the same window is a different upload.
  const findExistingClaim = async () => {
    const byTempKey = await db
      .select({ id: resumes.id, status: resumes.status })
      .from(resumes)
      .where(and(eq(resumes.userId, userId), eq(resumes.r2Key, tempKey)))
      .orderBy(desc(resumes.createdAt))
      .limit(1);

    return byTempKey[0] ?? null;
  };

  let fileBuffer: ArrayBuffer;
  let computedFileHash: string;

  try {
    const buffer = await R2.getAsArrayBuffer(r2, tempKey);

    if (!buffer) {
      const existing = await findExistingClaim();

      if (existing) {
        return {
          kind: "already_claimed",
          resumeId: existing.id,
          status: existing.status,
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
        const existing = await findExistingClaim();

        if (existing) {
          return {
            kind: "already_claimed",
            resumeId: existing.id,
            status: existing.status,
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

  const filename = tempKey.split("/").pop();
  const resumeId = crypto.randomUUID();
  const newKey = `users/${userId}/${resumeId}/${filename}`;
  const now = new Date().toISOString();

  // Arbitration row first: it claims the pending_claim slot with r2Key still
  // pointing at the temp object, so a parse run can never target a key whose bytes
  // were never written. The per-user row lock serializes the dedup insert with
  // the rate-limit count. A conflicting pending row comes back from the same
  // statement (no-op DO UPDATE) instead of a follow-up SELECT that could miss a
  // status flip; that statement also locks the conflicting row, which a
  // concurrent completion txn can deadlock against — Postgres aborts one side
  // and the caller retries.
  const arbitration = await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");

    const pending = await tx
      .select({ id: resumes.id, status: resumes.status })
      .from(resumes)
      .where(
        and(
          eq(resumes.userId, userId),
          eq(resumes.fileHash, computedFileHash),
          eq(resumes.status, "pending_claim"),
        ),
      )
      .limit(1);

    if (pending[0]) {
      return { kind: "duplicate" as const, existing: pending[0] };
    }

    const rateLimitResponse = await enforceRateLimit(userId, "resume_upload", env);

    if (rateLimitResponse) {
      return { kind: "rate_limited" as const, response: rateLimitResponse };
    }

    const arbitrated = await tx
      .insert(resumes)
      .values({
        id: resumeId,
        userId,
        r2Key: tempKey,
        fileHash: computedFileHash,
        status: "pending_claim",
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [resumes.userId, resumes.fileHash],
        targetWhere: sql`${resumes.fileHash} IS NOT NULL AND ${resumes.status} = 'pending_claim'`,
        set: { updatedAt: sql`${resumes.updatedAt}` },
      })
      .returning({ id: resumes.id, status: resumes.status });

    const row = arbitrated[0];

    if (row.id === resumeId) {
      return { kind: "inserted" as const };
    }

    return { kind: "duplicate" as const, existing: row };
  });

  if (arbitration.kind === "rate_limited") {
    return { kind: "rate_limited", response: arbitration.response };
  }

  if (arbitration.kind === "duplicate") {
    // The conflicting row satisfies the pending_claim predicate by construction
    // (the no-op DO UPDATE returns the locked row), so a claim of the same file is
    // already underway: report it instead of inserting a second row or burning
    // quota on its behalf.
    return {
      kind: "already_claimed",
      resumeId: arbitration.existing.id,
      status: arbitration.existing.status,
    };
  }

  const failResume = async (errorMessage: string): Promise<void> => {
    await db
      .update(resumes)
      .set({ status: "failed", errorMessage })
      .where(eq(resumes.id, resumeId));
  };

  // Account deletion can remove the row mid-claim; nothing references the temp
  // copy or the final copy then, and the account sweep may already have run, so
  // drop both objects. Returns true when the row was gone.
  const discardObjectsIfRowGone = async (): Promise<boolean> => {
    const self = await db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (self[0]) return false;

    await deleteR2Objects(r2, r2DeleteWorkflow, [newKey]);
    await deleteTempObject(r2, tempKey);

    return true;
  };

  // Shared by the cache-hit branch and the post-move recheck: the arbitration row
  // becomes the completed copy of an identical earlier file.
  const completeFromCachedContent = async (content: ResumeContent): Promise<boolean> => {
    try {
      const userRow = await db
        .select({ handle: user.handle, name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      const hasHandle = !!userRow[0]?.handle;
      const currentName = userRow[0]?.name;
      const cachedName = content.full_name?.trim();
      // Same rule as fresh parses (single owner: shouldSyncDisplayName):
      // career level iff AI-provided, display name iff currently missing.
      const cachedLevel = content.professional_level ?? undefined;
      const shouldUpdateName = shouldSyncDisplayName(cachedName, currentName);

      let completed = false;

      await db.transaction(async (tx) => {
        const updated = await tx
          .update(resumes)
          .set({
            status: "completed",
            r2Key: newKey,
            fileHash: computedFileHash,
            parsedAt: now,
            parsedContent: content,
          })
          .where(eq(resumes.id, resumeId))
          .returning({ id: resumes.id });

        // Row gone (account deletion cascade): skip the site-data and user writes.
        if (updated.length === 0) return;
        completed = true;

        await buildSiteDataUpsert(tx, userId, resumeId, content, {
          publish: hasHandle,
          // Same snapshot as this row's createdAt: a site_data row written after
          // the claim started is newer content and must win.
          onlyIfUpdatedAtLte: now,
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

      return completed;
    } catch (updateError) {
      console.error("Failed to update resume with cached content:", updateError);

      return false;
    }
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

  // SAFETY: parsedContent is schema-validated JSONB written only by the parse pipeline; cast bridges the column's wide Record type to ResumeContent.
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

    if (await completeFromCachedContent(cachedContent)) {
      return { kind: "cached", resumeId };
    }
  }

  const processing = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(
      and(
        eq(resumes.userId, userId),
        eq(resumes.fileHash, computedFileHash),
        inArray(resumes.status, ["queued", "processing", "waiting_for_cache"]),
        ne(resumes.id, resumeId),
      ),
    )
    .limit(1);

  if (processing[0]) {
    // Put the final object first. The row keeps the temp key until that put
    // succeeds, so a failed copy never points at a key that was not written.
    try {
      await R2.put(r2, newKey, fileBuffer, { contentType: "application/pdf" });
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
      const waiting = await db
        .update(resumes)
        .set({ status: "waiting_for_cache", fileHash: computedFileHash, r2Key: newKey })
        .where(and(eq(resumes.id, resumeId), eq(resumes.status, "pending_claim")))
        .returning({ id: resumes.id });

      if (waiting.length === 0) {
        await discardObjectsIfRowGone();

        return {
          kind: "error",
          message: "Resume was removed while claiming it",
          code: "NOT_FOUND",
          httpStatus: 404,
        };
      }

      await deleteTempObject(r2, tempKey);
    } catch (waitError) {
      console.error("Failed to set waiting_for_cache status:", waitError);
      await deleteR2Objects(r2, r2DeleteWorkflow, [newKey]);
      await failResume("Failed to prepare resume for processing");

      return {
        kind: "error",
        message: "Failed to prepare resume for processing",
        code: "DATABASE_ERROR",
        httpStatus: 500,
      };
    }

    // The producer may have completed mid-move: complete inline instead of waiting
    // for a fan-out that already ran.
    const completed = await db
      .select({ parsedContent: resumes.parsedContent })
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

    // SAFETY: parsedContent is schema-validated JSONB written only by the parse pipeline; cast bridges the column's wide Record type to ResumeContent.
    const completedContent = (completed[0]?.parsedContent as ResumeContent | null) ?? null;

    if (completedContent && (await completeFromCachedContent(completedContent))) {
      return { kind: "cached", resumeId };
    }

    // The row itself may have been deleted mid-move (account deletion cascade):
    // the sweep may already have run, so drop the copy instead of orphaning it.
    if (await discardObjectsIfRowGone()) {
      return {
        kind: "error",
        message: "Resume was removed while claiming it",
        code: "NOT_FOUND",
        httpStatus: 404,
      };
    }

    // Durable timer: fails the row if no identical parse completes it in time.
    // Best-effort — the status view already presents the timeout virtually.
    if (parseWorkflow) {
      await startResumeParse(parseWorkflow, parseInstanceId(resumeId), {
        kind: "await-cache",
        resumeId,
      }).catch((error) => {
        log("error", "failed to start waiting_for_cache timer", {
          resumeId,
          error: String(error),
        });
      });
    }

    return { kind: "waiting_for_cache", resumeId };
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

  try {
    const queued = await db
      .update(resumes)
      .set({ r2Key: newKey, status: "queued", queuedAt: now })
      .where(and(eq(resumes.id, resumeId), eq(resumes.status, "pending_claim")))
      .returning({ id: resumes.id });

    if (queued.length === 0) {
      // Row deleted mid-claim (account deletion cascade) after the bytes landed:
      // the account sweep may already have missed the object, so remove it.
      await discardObjectsIfRowGone();
      await failResume("Failed to update resume status");

      return {
        kind: "error",
        message: "Failed to update resume status",
        code: "DATABASE_ERROR",
        httpStatus: 500,
      };
    }
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

  const failUnstarted = async (): Promise<ClaimIntakeOutcome> => {
    // `failed` with no lastAttemptError stays manually retryable.
    await failResume("Failed to start processing. Please try again.");

    return {
      kind: "error",
      message: "Failed to start resume processing",
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 500,
    };
  };

  if (!parseWorkflow) {
    console.error("CLICKFOLIO_PARSE_WORKFLOW binding not available");

    return failUnstarted();
  }

  try {
    await startResumeParse(parseWorkflow, parseInstanceId(resumeId), {
      kind: "parse",
      resumeId,
      userId,
      r2Key: newKey,
      fileHash: computedFileHash,
    });
  } catch (workflowError) {
    console.error("Failed to start resume parse workflow:", workflowError);

    return failUnstarted();
  }

  return { kind: "queued", resumeId };
}
