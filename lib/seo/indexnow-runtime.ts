import { waitUntil } from "cloudflare:workers";
import { Cause, Exit } from "effect";
import { siteConfig } from "@/lib/config/site";
import { runBackground } from "@/lib/effect/edges";
import { IndexNow } from "@/lib/effect/services/indexnow";
import { profileUrls } from "@/lib/seo/indexnow";
import { submitProfiles } from "@/lib/seo/indexnow-profiles";
import { errorFields } from "@/lib/utils/error-fields";
import { log } from "@/lib/utils/log";

/** Only the production Worker pings; local dev and `wrangler dev` override APP_URL. */
function isProductionSite(): boolean {
  return process.env.APP_URL === siteConfig.url;
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
