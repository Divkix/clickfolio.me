import { publicProfileTargets } from "@/lib/cache/public-profile-paths";
import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { revalidatePath } from "next/cache";

/**
 * Flushes the public surfaces a profile change can affect: the directory, the
 * profile pages and the example galleries.
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
    for (const { path, type } of publicProfileTargets(handles)) {
      if (type) revalidatePath(path, type);
      else revalidatePath(path);
    }
  } catch (error) {
    log("error", "Failed to revalidate public profile pages", { ...errorFields(error) });
  }
}
