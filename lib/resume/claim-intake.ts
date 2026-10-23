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
import { errorFields } from "@/lib/utils/error-fields";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL, tempUploadId } from "@/lib/utils/validation";
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

type ClaimError = Extract<ClaimIntakeOutcome, { kind: "error" }>;

function claimError(message: string, code: ClaimError["code"], httpStatus: number): ClaimError {
  return { kind: "error", message, code, httpStatus };
}

function alreadyClaimed(existing: { id: string; status: string }): ClaimIntakeOutcome {
  return { kind: "already_claimed", resumeId: existing.id, status: existing.status };
}

const rowRemoved = (): ClaimError =>
  claimError("Resume was removed while claiming it", "NOT_FOUND", 404);

function isLikelyMissingObjectError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;

  return /not\s*found|no\s*such\s*key|does\s*not\s*exist|404/i.test(cause.message);
}

// A failed temp/ delete needs no follow-up: the bucket's temp/ lifecycle rule
// (r2-lifecycle.json) expires it.
async function deleteTempObject(r2: R2Bucket, key: string): Promise<void> {
  await R2.delete(r2, key).catch((error) => {
    log("warn", "temp R2 delete failed; lifecycle rule will expire it", {
      tempId: tempUploadId(key),
      ...errorFields(error),
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

      if (existing) return alreadyClaimed(existing);

      return claimError("File not found. The upload may have expired.", "VALIDATION_ERROR", 404);
    }

    fileBuffer = buffer;

    computedFileHash = await sha256Hex(fileBuffer);

    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      return claimError(
        `File size exceeds ${MAX_FILE_SIZE_LABEL} limit (${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB)`,
        "VALIDATION_ERROR",
        400,
      );
    }

    const pdfBytes = new Uint8Array(fileBuffer.slice(0, 5));

    if (!String.fromCharCode(...pdfBytes).startsWith("%PDF-")) {
      return claimError("Invalid PDF format", "VALIDATION_ERROR", 400);
    }
  } catch (error) {
    log("error", "Error fetching file from R2", { ...errorFields(error) });

    if (isLikelyMissingObjectError(error)) {
      try {
        const existing = await findExistingClaim();

        if (existing) return alreadyClaimed(existing);
      } catch (recentResumeError) {
        log("error", "Error checking recent resumes after R2 fetch failure", {
          ...errorFields(recentResumeError),
        });
      }
    }

    return claimError(
      "Failed to retrieve file. The upload may have expired.",
      "EXTERNAL_SERVICE_ERROR",
      500,
    );
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
    return alreadyClaimed(arbitration.existing);
  }

  const failResume = async (errorMessage: string): Promise<void> => {
    await db
      .update(resumes)
      .set({ status: "failed", errorMessage })
      .where(eq(resumes.id, resumeId));
  };

  // Marks the row failed with the same message the caller receives.
  const failClaim = async (message: string, code: ClaimError["code"]): Promise<ClaimError> => {
    await failResume(message);

    return claimError(message, code, 500);
  };

  // An identical earlier file this user already parsed, if any.
  const findCompletedContent = async (): Promise<ResumeContent | null> => {
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
    return (completed[0]?.parsedContent as ResumeContent | null) ?? null;
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
      // Same name rule as fresh parses (single owner: shouldSyncDisplayName). Career is
      // classified once per fresh parse, so a cache hit leaves it untouched.
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

        if (shouldUpdateName) {
          await tx
            .update(user)
            .set({ name: cachedName, updatedAt: now })
            .where(eq(user.id, userId));
        }
      });

      return completed;
    } catch (updateError) {
      log("error", "Failed to update resume with cached content", { ...errorFields(updateError) });

      return false;
    }
  };

  const cachedContent = await findCompletedContent();

  if (cachedContent) {
    try {
      await moveTempFile(r2, tempKey, newKey, fileBuffer);
    } catch (r2Error) {
      log("error", "R2 operations failed for cached resume", { ...errorFields(r2Error) });

      return failClaim("Failed to store file for processing", "EXTERNAL_SERVICE_ERROR");
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
      log("error", "R2 operations failed for waiting resume", { ...errorFields(error) });

      return failClaim("Failed to store file for processing", "EXTERNAL_SERVICE_ERROR");
    }

    try {
      const waiting = await db
        .update(resumes)
        .set({ status: "waiting_for_cache", fileHash: computedFileHash, r2Key: newKey })
        .where(and(eq(resumes.id, resumeId), eq(resumes.status, "pending_claim")))
        .returning({ id: resumes.id });

      if (waiting.length === 0) {
        await discardObjectsIfRowGone();

        return rowRemoved();
      }

      await deleteTempObject(r2, tempKey);
    } catch (waitError) {
      log("error", "Failed to set waiting_for_cache status", { ...errorFields(waitError) });
      await deleteR2Objects(r2, r2DeleteWorkflow, [newKey]);

      return failClaim("Failed to prepare resume for processing", "DATABASE_ERROR");
    }

    // The producer may have completed mid-move: complete inline instead of waiting
    // for a fan-out that already ran.
    const completedContent = await findCompletedContent();

    if (completedContent && (await completeFromCachedContent(completedContent))) {
      return { kind: "cached", resumeId };
    }

    // The row itself may have been deleted mid-move (account deletion cascade):
    // the sweep may already have run, so drop the copy instead of orphaning it.
    if (await discardObjectsIfRowGone()) return rowRemoved();

    // Durable timer: fails the row if no identical parse completes it in time.
    // Best-effort — the status view already presents the timeout virtually.
    if (parseWorkflow) {
      await startResumeParse(parseWorkflow, parseInstanceId(resumeId), {
        kind: "await-cache",
        resumeId,
      }).catch((error) => {
        log("error", "failed to start waiting_for_cache timer", {
          resumeId,
          ...errorFields(error),
        });
      });
    }

    return { kind: "waiting_for_cache", resumeId };
  }

  try {
    await moveTempFile(r2, tempKey, newKey, fileBuffer);
  } catch (error) {
    log("error", "R2 put error", { ...errorFields(error) });

    return failClaim("Failed to store file for processing", "EXTERNAL_SERVICE_ERROR");
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

      return failClaim("Failed to update resume status", "DATABASE_ERROR");
    }
  } catch (updateError) {
    log("error", "Failed to update resume with queued status", { ...errorFields(updateError) });

    return failClaim("Failed to update resume status", "DATABASE_ERROR");
  }

  const failUnstarted = async (): Promise<ClaimIntakeOutcome> => {
    // `failed` with no lastAttemptError stays manually retryable.
    await failResume("Failed to start processing. Please try again.");

    return claimError("Failed to start resume processing", "EXTERNAL_SERVICE_ERROR", 500);
  };

  if (!parseWorkflow) {
    log("error", "CLICKFOLIO_PARSE_WORKFLOW binding not available");

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
    log("error", "Failed to start resume parse workflow", { ...errorFields(workflowError) });

    return failUnstarted();
  }

  return { kind: "queued", resumeId };
}
