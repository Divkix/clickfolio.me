import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { publicProfileTags } from "@/lib/cache/edge-cache";
import { purgeEdgeTags } from "@/lib/cache/edge-purge";
import { siteConfig } from "@/lib/config/site";
import { indexableProfileCondition } from "@/lib/data/indexable-profiles";
import type { PgQueryable } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import type { EdgePurgeQueue } from "@/lib/effect/services/edge-purge-queue";
import { profileUrls } from "@/lib/seo/indexnow";
import { submitProfiles } from "@/lib/seo/indexnow-profiles";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/** The rewritten handles whose profile is indexable, from the SQL condition the list pages use. */
function findIndexableHandles(db: PgQueryable, handles: readonly string[]) {
  return db
    .select({ handle: user.handle })
    .from(user)
    .innerJoin(siteData, eq(siteData.userId, user.id))
    .where(and(inArray(user.handle, [...handles]), indexableProfileCondition()));
}

/**
 * IndexNow must only learn about pages that belong in a search index, so ask the persisted
 * content flag and privacy setting instead of pinging every rewritten handle. A failed lookup
 * skips the ping: the purge is already enqueued and stale results age out on their own.
 */
function indexableHandles(handles: readonly string[]): Effect.Effect<string[], never, Db> {
  return Db.use((db) =>
    db.query("public-refresh.indexable-handles", (query) => findIndexableHandles(query, handles)),
  ).pipe(
    Effect.map((rows) => rows.flatMap(({ handle }) => (handle === null ? [] : [handle]))),
    Effect.catchTags({
      DbFailed: (failure) =>
        Effect.sync(() => {
          log("error", "public page indexnow lookup failed", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });

          return [];
        }),
      DbConflict: (failure) =>
        Effect.sync(() => {
          log("error", "public page indexnow lookup failed", {
            failure: failure._tag,
            ...errorFields(failure.cause ?? failure.message),
          });

          return [];
        }),
    }),
  );
}

/**
 * After a parse rewrote public site-data: purge the edge-cached pages and tell search engines.
 * A Workflow has no request (no `waitUntil`), so this step enqueues the encoded tags itself
 * instead of calling `revalidatePublicProfilePages`. Best effort: a failure is logged and never
 * fails the run. A timed-out enqueue is not resent (it may have landed). The durable IndexNow
 * enqueue only runs on the production site (`appUrl`), as it does for request-time changes, and
 * only for profiles that are still indexable; the minute cron owns delivery and retries.
 */
export function refreshPublicProfiles(
  handles: readonly string[],
  appUrl: string | undefined,
): Effect.Effect<void, never, EdgePurgeQueue | Db> {
  if (handles.length === 0) return Effect.void;

  const purge = purgeEdgeTags(publicProfileTags(handles)).pipe(
    Effect.catchTags({
      InvalidInput: (failure) =>
        Effect.sync(() => {
          log("error", "public page purge enqueue failed", { ...errorFields(failure) });
        }),
      QueueFailed: (failure) =>
        Effect.sync(() => {
          log("error", "public page purge enqueue failed", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });
        }),
    }),
  );

  const ping =
    appUrl === siteConfig.url
      ? indexableHandles(handles).pipe(
          Effect.flatMap((indexable) => submitProfiles(profileUrls(indexable), false)),
        )
      : Effect.void;

  return Effect.all([purge, ping], { discard: true });
}
