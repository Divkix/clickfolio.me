import { Effect } from "effect";
import { purgeEdgeTags } from "@/lib/cache/edge-purge";
import { publicProfileTags } from "@/lib/cache/public-profile-paths";
import { siteConfig } from "@/lib/config/site";
import type { EdgePurgeQueue } from "@/lib/effect/services/edge-purge-queue";
import type { IndexNow } from "@/lib/effect/services/indexnow";
import { profileUrls } from "@/lib/seo/indexnow";
import { submitProfiles } from "@/lib/seo/indexnow-profiles";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/**
 * After a parse rewrote public site-data: purge the edge-cached pages and tell search engines.
 * A Workflow has no request store, so the purge enqueues the encoded tags itself instead of
 * calling `revalidatePath`. Best effort: a failure is logged and never fails the run. A timed-out
 * enqueue is not resent (it may have landed). The IndexNow ping only runs on the production site
 * (`appUrl`), as it does for request-time changes.
 */
export function refreshPublicProfiles(
  handles: readonly string[],
  appUrl: string | undefined,
): Effect.Effect<void, never, EdgePurgeQueue | IndexNow> {
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
    appUrl === siteConfig.url ? submitProfiles(profileUrls(handles), false) : Effect.void;

  return Effect.all([purge, ping], { discard: true });
}
