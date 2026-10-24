import { waitUntil } from "cloudflare:workers";
import { Cause, Effect, Exit } from "effect";
import { siteConfig } from "@/lib/config/site";
import { runBackground } from "@/lib/effect/edges";
import { IndexNow } from "@/lib/effect/services/indexnow";
import { profileUrls } from "@/lib/seo/indexnow";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/** Only the production Worker pings; local dev and `wrangler dev` override APP_URL. */
function isProductionSite(): boolean {
  return process.env.APP_URL === siteConfig.url;
}

/**
 * Drops URLs pinged recently, submits the rest, and marks them only after an accepted
 * submission, so a rejected ping is retried on the next change instead of being suppressed. The
 * debounce is per-colo and best-effort: when it fails the ping goes ahead without it.
 */
function submitProfiles(
  urls: string[],
  skipDebounce: boolean,
): Effect.Effect<void, never, IndexNow> {
  return Effect.gen(function* () {
    const indexNow = yield* IndexNow;

    // A change that takes a page out of search (hide, delete, rename) must reach the engines even
    // right after a publish ping, so it skips the read. It still marks the URL afterwards.
    const fresh = yield* (skipDebounce ? Effect.succeed(urls) : indexNow.undebounced(urls)).pipe(
      Effect.catchTag("IndexNowDebounceFailed", (failure) =>
        Effect.sync(() => {
          log("warn", "indexnow debounce unavailable", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });

          return urls;
        }),
      ),
    );

    if (fresh.length === 0) return;

    yield* indexNow.submit(fresh);
    yield* indexNow.markDebounced(fresh).pipe(
      Effect.catchTag("IndexNowDebounceFailed", (failure) =>
        Effect.sync(() => {
          log("warn", "indexnow debounce write failed", {
            operation: failure.operation,
            kind: failure.kind,
            ...errorFields(failure.cause ?? failure),
          });
        }),
      ),
    );
    log("info", "indexnow submitted", { url_count: fresh.length });
  }).pipe(
    Effect.catchTag("HttpUpstreamFailed", (failure) =>
      Effect.sync(() => {
        log("warn", "indexnow submission failed", {
          operation: failure.operation,
          kind: failure.kind,
          host: failure.host,
          ...errorFields(failure.cause ?? failure),
        });
      }),
    ),
  );
}

/** Background edge: every typed failure is logged inside the program, defects here. */
async function runSubmission(urls: string[], skipDebounce: boolean): Promise<void> {
  const exit = await runBackground(submitProfiles(urls, skipDebounce), IndexNow.layer());

  if (Exit.isFailure(exit)) {
    log("warn", "indexnow submission failed", { ...errorFields(Cause.squash(exit.cause)) });
  }
}

/**
 * Pings IndexNow for portfolios whose public state changed (published, handle changed, privacy
 * changed, deleted). Runs after the response via waitUntil; never throws. Pass `skipDebounce` when
 * the change removes or hides a page, so a recent publish ping cannot suppress it.
 */
export function notifyIndexNowForProfiles(
  handles: ReadonlyArray<string | null | undefined>,
  { skipDebounce = false }: { skipDebounce?: boolean } = {},
): void {
  if (!isProductionSite()) return;

  const urls = profileUrls(handles);

  if (urls.length === 0) return;

  try {
    waitUntil(runSubmission(urls, skipDebounce));
  } catch (error) {
    log("warn", "indexnow waitUntil registration failed", { ...errorFields(error) });
  }
}
