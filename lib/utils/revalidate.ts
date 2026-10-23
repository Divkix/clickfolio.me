import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { revalidatePath } from "next/cache";

/**
 * Flushes the public surfaces a profile change can affect: the directory, the
 * profile pages, the example galleries, and the sitemap index.
 *
 * Each call queues an edge purge of the matching Workers Cache tags
 * (lib/cache/queued-cdn-adapter.ts); vinext sends them once per request.
 *
 * Best-effort by design: a cache purge must never fail the write that triggered
 * it, and `revalidatePath` throws when no Next request store is active (unit
 * tests, scripts).
 */
export function revalidatePublicProfilePages(
  handles: ReadonlyArray<string | null | undefined>,
): void {
  try {
    revalidatePath("/explore");

    for (const handle of handles) {
      if (handle) revalidatePath(`/@${handle}`);
    }

    // Every /examples/<slug> page lists directory profiles.
    revalidatePath("/examples/[slug]", "page");
    revalidatePath("/sitemap.xml");
  } catch (error) {
    log("error", "Failed to revalidate public profile pages", { ...errorFields(error) });
  }
}
