import { revalidatePath } from "next/cache";

/**
 * Flushes the public surfaces a profile change can affect: the directory, the
 * profile pages, and the sitemap index.
 *
 * Best-effort by design: a cache purge must never fail the write that triggered
 * it, and `revalidatePath` throws when no Next request store is active (unit
 * tests, scripts).
 */
export function revalidatePublicProfilePages(handles: Array<string | null>): void {
  try {
    revalidatePath("/explore");

    for (const handle of handles) {
      if (handle) revalidatePath(`/@${handle}`);
    }

    revalidatePath("/sitemap.xml");
  } catch (error) {
    console.error("Failed to revalidate public profile pages:", error);
  }
}
