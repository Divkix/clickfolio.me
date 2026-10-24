import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { Effect } from "effect";
import { buildSiteDataUpsert } from "@/lib/data/site-data-upsert";
import { resumes, siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { R2Store } from "@/lib/effect/services/r2-store";
import { WorkflowStarter } from "@/lib/effect/services/workflow-starter";
import { readQuotaIn, requireQuota } from "@/lib/rate-limit/user";
import { shouldSyncDisplayName } from "@/lib/resume/completion";
import { isIndexableProfile } from "@/lib/seo/profile-indexability";
import type { ResumeContent } from "@/lib/types/database";
import { sha256Hex } from "@/lib/utils/hash";
import { ERROR_CODES } from "@/lib/utils/security-headers";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { normalizePrivacySettings } from "@/lib/utils/privacy";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL, tempUploadId } from "@/lib/utils/validation";
import { purgeR2Keys } from "@/lib/workflows/r2-purge";
import { parseInstanceId } from "@/lib/workflows/resume-parse";

// One in-flight claim per (user, file hash) is arbitrated by the narrow unique
// index resumes_user_hash_pending_uidx (migrations_pg/0006): only a pending_claim
// row blocks a new claim, so queued/processing/waiting_for_cache rows coexist
// with the waiting_for_cache clone created by a duplicate claim.

export type ClaimIntakeOutcome =
  | { kind: "already_claimed"; resumeId: string; status: string }
  | {
      kind: "cached";
      resumeId: string;
      /** The published profile this claim rewrote, for the route to refresh; null if none. */
      rewritten: { handle: string; indexable: boolean } | null;
    }
  | { kind: "waiting_for_cache"; resumeId: string }
  | { kind: "queued"; resumeId: string }
  | {
      kind: "error";
      message: string;
      code: keyof typeof ERROR_CODES;
      httpStatus: number;
    };

type ClaimError = Extract<ClaimIntakeOutcome, { kind: "error" }>;

type CachedOutcome = Extract<ClaimIntakeOutcome, { kind: "cached" }>;

function claimError(message: string, code: ClaimError["code"], httpStatus: number): ClaimError {
  return { kind: "error", message, code, httpStatus };
}

function alreadyClaimed(existing: { id: string; status: string }): ClaimIntakeOutcome {
  return { kind: "already_claimed", resumeId: existing.id, status: existing.status };
}

const rowRemoved = (): ClaimError =>
  claimError("Resume was removed while claiming it", "NOT_FOUND", 404);

/** What every step after the arbitration row needs to know about this claim. */
type Claim = {
  readonly userId: string;
  readonly tempKey: string;
  readonly newKey: string;
  readonly resumeId: string;
  readonly now: string;
  readonly bytes: Uint8Array;
  readonly fileHash: string;
};

// Only a row that still names this temp key is this claim. A newer resume
// created in the same window is a different upload.
function findExistingClaim(userId: string, tempKey: string) {
  return Db.use((service) =>
    service.query("claim.find-existing", async (db) => {
      const byTempKey = await db
        .select({ id: resumes.id, status: resumes.status })
        .from(resumes)
        .where(and(eq(resumes.userId, userId), eq(resumes.r2Key, tempKey)))
        .orderBy(desc(resumes.createdAt))
        .limit(1);

      return byTempKey[0] ?? null;
    }),
  );
}

// A failed temp/ delete needs no follow-up: the bucket's temp/ lifecycle rule
// (r2-lifecycle.json) expires it.
function deleteTempObject(tempKey: string) {
  return R2Store.use((store) => store.delete(tempKey)).pipe(
    Effect.catchTag("R2Failed", (failure) =>
      Effect.sync(() => {
        log("warn", "temp R2 delete failed; lifecycle rule will expire it", {
          tempId: tempUploadId(tempKey),
          ...errorFields(failure.cause ?? failure),
        });
      }),
    ),
  );
}

// Unified R2 failure policy: the object write must succeed or the intake fails;
// temp-cleanup failure is left to the lifecycle rule and the intake proceeds. A timed-out put
// is not retried: the claim fails and the visitor starts over.
function moveTempFile(claim: Claim) {
  return R2Store.use((store) =>
    store.put(claim.newKey, claim.bytes, { contentType: "application/pdf" }),
  ).pipe(Effect.andThen(deleteTempObject(claim.tempKey)));
}

// Hands the copies to R2DeleteWorkflow after a failed inline delete. If that cannot be reached
// either, the objects stay behind (purgeR2Keys has logged it) and the claim still answers.
function discardObjects(keys: readonly string[]) {
  return purgeR2Keys(keys).pipe(
    Effect.asVoid,
    Effect.catchTags({
      WorkflowFailed: () => Effect.sync(() => logObjectsLeftBehind(keys.length)),
      InvalidInput: () => Effect.sync(() => logObjectsLeftBehind(keys.length)),
    }),
  );
}

function logObjectsLeftBehind(keyCount: number): void {
  log("error", "claim cleanup left R2 objects behind", { keyCount });
}

// Marks the row failed with the message the visitor can see on the status page. Best-effort:
// the failure the caller is already handling is what the visitor is told, and a row that could
// not be marked stays pending_claim, which is logged here.
function markFailed(resumeId: string, errorMessage: string) {
  const stuck = (failure: { message: string; cause?: unknown }) =>
    Effect.sync(() => {
      log("error", "claim row could not be marked failed", {
        resumeId,
        ...errorFields(failure.cause ?? failure),
      });
    });

  return Db.use((service) =>
    service.query("claim.fail", (db) =>
      db.update(resumes).set({ status: "failed", errorMessage }).where(eq(resumes.id, resumeId)),
    ),
  ).pipe(Effect.asVoid, Effect.catchTags({ DbFailed: stuck, DbConflict: stuck }));
}

// Fails the claim with the message the caller receives as an outcome.
function failClaim(claim: Claim, message: string, code: ClaimError["code"]) {
  return markFailed(claim.resumeId, message).pipe(Effect.as(claimError(message, code, 500)));
}

// An identical earlier file this user already parsed, if any.
function findCompletedContent(claim: Claim) {
  return Db.use((service) =>
    service.query("claim.find-cached", async (db) => {
      const completed = await db
        .select({ parsedContent: resumes.parsedContent })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, claim.userId),
            eq(resumes.fileHash, claim.fileHash),
            eq(resumes.status, "completed"),
            isNotNull(resumes.parsedContent),
            ne(resumes.id, claim.resumeId),
          ),
        )
        .limit(1);

      return completed[0]?.parsedContent ?? null;
    }),
  );
}

// Account deletion can remove the row mid-claim; nothing references the temp
// copy or the final copy then, and the account sweep may already have run, so
// drop both objects. Returns true when the row was gone.
function discardObjectsIfRowGone(claim: Claim) {
  return Effect.gen(function* () {
    const self = yield* Db.use((service) =>
      service.query("claim.row-exists", (db) =>
        db.select({ id: resumes.id }).from(resumes).where(eq(resumes.id, claim.resumeId)).limit(1),
      ),
    );

    if (self[0]) return false;

    yield* discardObjects([claim.newKey]);
    yield* deleteTempObject(claim.tempKey);

    return true;
  });
}

// Shared by the cache-hit branch and the post-move recheck: the arbitration row
// becomes the completed copy of an identical earlier file. A database failure here is logged
// and answers null, so the claim falls back to a normal parse.
function completeFromCachedContent(
  claim: Claim,
  content: ResumeContent,
): Effect.Effect<CachedOutcome | null, never, Db> {
  const { userId, resumeId, newKey, fileHash, now } = claim;

  const notCompleted = (failure: { message: string; cause?: unknown }) =>
    Effect.sync(() => {
      log("error", "Failed to update resume with cached content", {
        ...errorFields(failure.cause ?? failure),
      });

      return null;
    });

  return Effect.gen(function* () {
    const [owner] = yield* Db.use((service) =>
      service.query("claim.cache.user", (db) =>
        db
          .select({ handle: user.handle, name: user.name, privacySettings: user.privacySettings })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1),
      ),
    );

    const currentName = owner?.name;
    const cachedName = content.full_name?.trim();
    // Same name rule as fresh parses (single owner: shouldSyncDisplayName). Career is
    // classified once per fresh parse, so a cache hit leaves it untouched.
    const shouldUpdateName = shouldSyncDisplayName(cachedName, currentName);

    const completed = yield* Db.use((service) =>
      service.transaction("claim.cache.complete", async (tx) => {
        const updated = await tx
          .update(resumes)
          .set({
            status: "completed",
            r2Key: newKey,
            fileHash,
            parsedAt: now,
            parsedContent: content,
          })
          .where(eq(resumes.id, resumeId))
          .returning({ id: resumes.id });

        // Row gone (account deletion cascade): skip the site-data and user writes.
        if (updated.length === 0) return null;

        // No row back means the guard kept a newer site_data row: nothing public changed.
        const written = await buildSiteDataUpsert(tx, userId, resumeId, content, {
          publish: !!owner?.handle,
          // Same snapshot as this row's createdAt: a site_data row written after
          // the claim started is newer content and must win.
          onlyIfUpdatedAtLte: now,
        }).returning({ id: siteData.id });

        if (shouldUpdateName) {
          await tx
            .update(user)
            .set({ name: cachedName, updatedAt: now })
            .where(eq(user.id, userId));
        }

        return { siteRewritten: written.length > 0 };
      }),
    );

    if (!completed) return null;

    const rewritten =
      completed.siteRewritten && owner?.handle
        ? {
            handle: owner.handle,
            indexable: isIndexableProfile(content, normalizePrivacySettings(owner.privacySettings)),
          }
        : null;

    return { kind: "cached", resumeId, rewritten } satisfies CachedOutcome;
  }).pipe(Effect.catchTags({ DbFailed: notCompleted, DbConflict: notCompleted }));
}

/** The temp upload's bytes and hash, or the outcome that ends the claim before any row exists. */
function loadTempFile(userId: string, tempKey: string) {
  return Effect.gen(function* () {
    const bytes = yield* R2Store.use((store) => store.get(tempKey)).pipe(
      Effect.catchTag("R2ObjectMissing", () => Effect.succeed(null)),
    );

    if (!bytes) {
      const existing = yield* findExistingClaim(userId, tempKey);

      if (existing) return alreadyClaimed(existing);

      return claimError("File not found. The upload may have expired.", "VALIDATION_ERROR", 404);
    }

    if (bytes.byteLength > MAX_FILE_SIZE) {
      return claimError(
        `File size exceeds ${MAX_FILE_SIZE_LABEL} limit (${Math.round(bytes.byteLength / 1024 / 1024)}MB)`,
        "VALIDATION_ERROR",
        400,
      );
    }

    if (!String.fromCharCode(...bytes.slice(0, 5)).startsWith("%PDF-")) {
      return claimError("Invalid PDF format", "VALIDATION_ERROR", 400);
    }

    const fileHash = yield* Effect.promise(() => sha256Hex(bytes));

    return { kind: "loaded" as const, bytes, fileHash };
  });
}

// Arbitration row first: it claims the pending_claim slot with r2Key still
// pointing at the temp object, so a parse run can never target a key whose bytes
// were never written. The per-user row lock serializes the dedup insert with
// the rate-limit count. A conflicting pending row comes back from the same
// statement (no-op DO UPDATE) instead of a follow-up SELECT that could miss a
// status flip; that statement also locks the conflicting row, which a
// concurrent completion txn can deadlock against — Postgres aborts one side
// and the caller retries.
function arbitrate(claim: Claim) {
  const { userId, resumeId, tempKey, fileHash, now } = claim;

  return Effect.gen(function* () {
    const arbitration = yield* Db.use((service) =>
      service.transaction("claim.arbitrate", async (tx) => {
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");

        const pending = await tx
          .select({ id: resumes.id, status: resumes.status })
          .from(resumes)
          .where(
            and(
              eq(resumes.userId, userId),
              eq(resumes.fileHash, fileHash),
              eq(resumes.status, "pending_claim"),
            ),
          )
          .limit(1);

        if (pending[0]) {
          return { kind: "duplicate" as const, existing: pending[0] };
        }

        // Counted on the transaction handle, under the user-row lock taken above.
        const quota = await readQuotaIn(tx, userId, "resume_upload");

        if (!quota.allowed) {
          return { kind: "rate_limited" as const, quota };
        }

        const arbitrated = await tx
          .insert(resumes)
          .values({
            id: resumeId,
            userId,
            r2Key: tempKey,
            fileHash,
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
      }),
    );

    if (arbitration.kind === "rate_limited") {
      return yield* requireQuota(arbitration.quota).pipe(Effect.as(null));
    }

    // The conflicting row satisfies the pending_claim predicate by construction
    // (the no-op DO UPDATE returns the locked row), so a claim of the same file is
    // already underway: report it instead of inserting a second row or burning
    // quota on its behalf.
    if (arbitration.kind === "duplicate") return alreadyClaimed(arbitration.existing);

    return null;
  });
}

/** Runs a store step of the claim; on failure logs it and marks the row failed, keeping the failure. */
function guardStore<A, E extends { message: string; cause?: unknown }, R>(
  claim: Claim,
  logMessage: string,
  step: Effect.Effect<A, E, R>,
) {
  return step.pipe(
    Effect.tapError((failure) =>
      Effect.sync(() => {
        log("error", logMessage, { ...errorFields(failure.cause ?? failure) });
      }).pipe(Effect.andThen(markFailed(claim.resumeId, "Failed to store file for processing"))),
    ),
  );
}

// Another run of the same file is already in flight: store the copy and wait for it.
function waitForCache(claim: Claim) {
  const { resumeId, tempKey, newKey, fileHash } = claim;

  return Effect.gen(function* () {
    // Put the final object first. The row keeps the temp key until that put
    // succeeds, so a failed copy never points at a key that was not written.
    yield* guardStore(
      claim,
      "R2 operations failed for waiting resume",
      R2Store.use((store) => store.put(newKey, claim.bytes, { contentType: "application/pdf" })),
    );

    const waiting = yield* Db.use((service) =>
      service.query("claim.wait", (db) =>
        db
          .update(resumes)
          .set({ status: "waiting_for_cache", fileHash, r2Key: newKey })
          .where(and(eq(resumes.id, resumeId), eq(resumes.status, "pending_claim")))
          .returning({ id: resumes.id }),
      ),
    ).pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => {
          log("error", "Failed to set waiting_for_cache status", {
            ...errorFields(failure.cause ?? failure),
          });
        }).pipe(
          Effect.andThen(discardObjects([newKey])),
          Effect.andThen(markFailed(resumeId, "Failed to prepare resume for processing")),
        ),
      ),
    );

    if (waiting.length === 0) {
      yield* discardObjectsIfRowGone(claim);

      return rowRemoved();
    }

    yield* deleteTempObject(tempKey);

    // The producer may have completed mid-move: complete inline instead of waiting
    // for a fan-out that already ran.
    const completedContent = yield* findCompletedContent(claim);

    const cached = completedContent
      ? yield* completeFromCachedContent(claim, completedContent)
      : null;

    if (cached) return cached;

    // The row itself may have been deleted mid-move (account deletion cascade):
    // the sweep may already have run, so drop the copy instead of orphaning it.
    if (yield* discardObjectsIfRowGone(claim)) return rowRemoved();

    // Durable timer: fails the row if no identical parse completes it in time.
    // Best-effort — the status view already presents the timeout virtually.
    yield* WorkflowStarter.use((starter) =>
      starter.startResumeParse(parseInstanceId(resumeId), { kind: "await-cache", resumeId }),
    ).pipe(
      Effect.catchTag("WorkflowFailed", (failure) =>
        Effect.sync(() => {
          log("error", "failed to start waiting_for_cache timer", {
            resumeId,
            ...errorFields(failure.cause ?? failure),
          });
        }),
      ),
    );

    return { kind: "waiting_for_cache" as const, resumeId };
  });
}

// Nothing identical is in flight: store the copy, queue the row and start the parse.
function queueParse(claim: Claim) {
  const { userId, resumeId, newKey, fileHash, now } = claim;

  return Effect.gen(function* () {
    yield* guardStore(claim, "R2 put error", moveTempFile(claim));

    const queued = yield* Db.use((service) =>
      service.query("claim.queue", (db) =>
        db
          .update(resumes)
          .set({ r2Key: newKey, status: "queued", queuedAt: now })
          .where(and(eq(resumes.id, resumeId), eq(resumes.status, "pending_claim")))
          .returning({ id: resumes.id }),
      ),
    ).pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => {
          log("error", "Failed to update resume with queued status", {
            ...errorFields(failure.cause ?? failure),
          });
        }).pipe(Effect.andThen(markFailed(resumeId, "Failed to update resume status"))),
      ),
    );

    if (queued.length === 0) {
      // Row deleted mid-claim (account deletion cascade) after the bytes landed:
      // the account sweep may already have missed the object, so remove it.
      yield* discardObjectsIfRowGone(claim);

      return yield* failClaim(claim, "Failed to update resume status", "DATABASE_ERROR");
    }

    // `failed` with no lastAttemptError stays manually retryable. A timed-out start is given
    // up on the same way: the pipeline's status-guarded steps make a late-starting run a no-op.
    yield* WorkflowStarter.use((starter) =>
      starter.startResumeParse(parseInstanceId(resumeId), {
        kind: "parse",
        resumeId,
        userId,
        r2Key: newKey,
        fileHash,
        retryCount: 0,
      }),
    ).pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => {
          log("error", "Failed to start resume parse workflow", {
            ...errorFields(failure.cause ?? failure),
          });
        }).pipe(
          Effect.andThen(markFailed(resumeId, "Failed to start processing. Please try again.")),
        ),
      ),
    );

    return { kind: "queued" as const, resumeId };
  });
}

export function runClaimIntake(input: { readonly userId: string; readonly tempKey: string }) {
  const { userId, tempKey } = input;

  return Effect.gen(function* () {
    const loaded = yield* loadTempFile(userId, tempKey);

    if (loaded.kind !== "loaded") return loaded;

    const resumeId = crypto.randomUUID();

    const claim: Claim = {
      userId,
      tempKey,
      newKey: `users/${userId}/${resumeId}/${tempKey.split("/").pop()}`,
      resumeId,
      now: new Date().toISOString(),
      bytes: loaded.bytes,
      fileHash: loaded.fileHash,
    };

    const early = yield* arbitrate(claim);

    if (early) return early;

    const cachedContent = yield* findCompletedContent(claim);

    if (cachedContent) {
      yield* guardStore(claim, "R2 operations failed for cached resume", moveTempFile(claim));

      const cached = yield* completeFromCachedContent(claim, cachedContent);

      if (cached) return cached;
    }

    const processing = yield* Db.use((service) =>
      service.query("claim.find-processing", (db) =>
        db
          .select({ id: resumes.id })
          .from(resumes)
          .where(
            and(
              eq(resumes.userId, userId),
              eq(resumes.fileHash, claim.fileHash),
              inArray(resumes.status, ["queued", "processing", "waiting_for_cache"]),
              ne(resumes.id, resumeId),
            ),
          )
          .limit(1),
      ),
    );

    if (processing[0]) return yield* waitForCache(claim);

    return yield* queueParse(claim);
  });
}
