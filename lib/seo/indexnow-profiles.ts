import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { indexNowState, indexNowUrls } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { classifyUpstreamCause } from "@/lib/effect/external";
import { type DbConflict, type DbFailed, HttpUpstreamFailed } from "@/lib/effect/failures";
import { IndexNow, type IndexNowResponse } from "@/lib/effect/services/indexnow";
import { indexNowRetryAt, isIndexNowAccepted } from "@/lib/seo/indexnow";
import { enqueueIndexNowUrls } from "@/lib/seo/indexnow-outbox";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

const DEBOUNCE_MS = 10 * 60_000;
const MIN_INTERVAL_MS = 60_000;
const MAX_BATCH_SIZE = 1_000;
const MAX_BACKOFF_MS = 24 * 60 * 60_000;
const STATE_ID = "site";

interface SubmissionBatch {
  leaseId: string;
  failures: number;
  urls: Array<{ url: string; revision: number }>;
}

/** Persist first; pending URLs coalesce across isolates, deploys and callers, never disappear. */
export function enqueueIndexNow(
  urls: readonly string[],
  skipDebounce = false,
): Effect.Effect<void, DbFailed | DbConflict, Db> {
  return Db.use((db) =>
    db.query("indexnow.enqueue", (query) => enqueueIndexNowUrls(query, urls, skipDebounce)),
  );
}

/**
 * Request/Workflow entry: only enqueue, with no upstream fetch or sleeping request. Forced
 * removals bypass the per-URL delay, but not the global sender throttle or upstream cooldown.
 */
export function submitProfiles(
  urls: string[],
  skipDebounce: boolean,
): Effect.Effect<void, never, Db> {
  return enqueueIndexNow(urls, skipDebounce).pipe(
    Effect.catchTags({
      DbFailed: (failure) =>
        Effect.sync(() => {
          log("error", "indexnow enqueue failed", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });
        }),
      DbConflict: (failure) =>
        Effect.sync(() => {
          log("error", "indexnow enqueue failed", { ...errorFields(failure) });
        }),
    }),
  );
}

/** Claim under a row lock; do not hold a database transaction open during the HTTP request. */
function claimBatch(): Effect.Effect<SubmissionBatch | undefined, DbFailed | DbConflict, Db> {
  return Db.use((db) =>
    db.transaction("indexnow.claim", async (tx) => {
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();

      await tx
        .insert(indexNowState)
        .values({ id: STATE_ID, nextAttemptAt: now })
        .onConflictDoNothing();

      const [state] = await tx
        .select()
        .from(indexNowState)
        .where(eq(indexNowState.id, STATE_ID))
        .for("update");

      if (
        !state ||
        Date.parse(state.nextAttemptAt) > nowMs ||
        (state.leaseUntil !== null && Date.parse(state.leaseUntil) > nowMs)
      )
        return;

      const urls = await tx
        .select({ url: indexNowUrls.url, revision: indexNowUrls.revision })
        .from(indexNowUrls)
        .where(and(eq(indexNowUrls.pending, true), lte(indexNowUrls.dueAt, now)))
        .orderBy(asc(indexNowUrls.dueAt), asc(indexNowUrls.url))
        .limit(MAX_BATCH_SIZE);

      if (urls.length === 0) return;

      const leaseId = crypto.randomUUID();
      const next = new Date(nowMs + MIN_INTERVAL_MS).toISOString();

      await tx
        .update(indexNowState)
        .set({ leaseId, leaseUntil: next, nextAttemptAt: next })
        .where(eq(indexNowState.id, STATE_ID));

      return { leaseId, failures: state.failures, urls };
    }),
  );
}

/**
 * Fence completion by sender lease and each URL revision: edits arriving during fetch survive.
 * A crash or failed completion leaves pending work for the next cron after the lease expires.
 */
function finishBatch(
  batch: SubmissionBatch,
  response: IndexNowResponse | undefined,
): Effect.Effect<void, DbFailed | DbConflict, Db> {
  return Db.use((db) =>
    db.transaction("indexnow.finish", async (tx) => {
      const [state] = await tx
        .select()
        .from(indexNowState)
        .where(eq(indexNowState.id, STATE_ID))
        .for("update");

      if (state?.leaseId !== batch.leaseId) return;

      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const accepted = response !== undefined && isIndexNowAccepted(response.status);

      const retryable =
        !response || response.status === 408 || response.status === 429 || response.status >= 500;

      const fallback = retryable
        ? Math.min(DEBOUNCE_MS * 2 ** Math.min(batch.failures, 8), MAX_BACKOFF_MS)
        : MAX_BACKOFF_MS;

      const nextAttemptAt = accepted
        ? nowMs + MIN_INTERVAL_MS
        : Math.max(nowMs + fallback, indexNowRetryAt(response?.retryAfter ?? null, nowMs) ?? 0);

      if (accepted) {
        const urls = batch.urls.map(({ url }) => url);

        await tx
          .update(indexNowUrls)
          .set({ lastSubmittedAt: now })
          .where(inArray(indexNowUrls.url, urls));
        await tx
          .update(indexNowUrls)
          .set({ pending: false, urgent: false })
          .where(
            or(
              ...batch.urls.map(({ url, revision }) =>
                and(eq(indexNowUrls.url, url), eq(indexNowUrls.revision, revision)),
              ),
            ),
          );
        // An ordinary edit during fetch needs a trailing ping, not another immediate duplicate.
        await tx
          .update(indexNowUrls)
          .set({
            dueAt: sql`GREATEST(${indexNowUrls.dueAt}, ${new Date(nowMs + DEBOUNCE_MS).toISOString()}::timestamptz)`,
          })
          .where(
            and(
              inArray(indexNowUrls.url, urls),
              eq(indexNowUrls.pending, true),
              eq(indexNowUrls.urgent, false),
            ),
          );
      }

      await tx
        .update(indexNowState)
        .set({
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: new Date(nextAttemptAt).toISOString(),
          failures: accepted ? 0 : Math.min(batch.failures + 1, 31),
        })
        .where(eq(indexNowState.id, STATE_ID));
    }),
  );
}

/**
 * One minute-cron turn: at most one batch, globally serialized. 429/5xx/network failures remain
 * pending with exponential backoff; Retry-After may extend, never shorten, that cooldown.
 * Permanent refusals stay visible/pending and retry daily after configuration is repaired.
 */
export function drainIndexNow(): Effect.Effect<
  void,
  DbFailed | DbConflict | HttpUpstreamFailed,
  Db | IndexNow
> {
  return Effect.gen(function* () {
    const batch = yield* claimBatch();

    if (!batch) return;

    const indexNow = yield* IndexNow;

    type Outcome = { response: IndexNowResponse } | { failure: HttpUpstreamFailed };

    const outcome = yield* indexNow.submit(batch.urls.map(({ url }) => url)).pipe(
      Effect.map((response): Outcome => ({ response })),
      Effect.catchTag("HttpUpstreamFailed", (failure) => Effect.succeed<Outcome>({ failure })),
    );

    const response = "response" in outcome ? outcome.response : undefined;

    yield* finishBatch(batch, response);

    if ("failure" in outcome) return yield* Effect.fail(outcome.failure);

    if (!isIndexNowAccepted(outcome.response.status)) {
      return yield* Effect.fail(
        new HttpUpstreamFailed({
          operation: "indexnow.submit",
          kind: classifyUpstreamCause({ status: outcome.response.status }),
          message: `IndexNow responded ${outcome.response.status}; batch retained for retry`,
          host: "indexnow",
        }),
      );
    }

    log("info", "indexnow submitted", { url_count: batch.urls.length });
  });
}
