import { encodeCloudflareCacheTag } from "@vinext/cloudflare/cache/cdn-adapter.runtime";

/** One `revalidatePath` call: the same arguments vinext tags a cached response with. */
export type RevalidateTarget = { readonly path: string; readonly type?: "page" };

/**
 * The public surfaces a profile change can affect: the directory, each profile page and the
 * example galleries. The single list behind `revalidatePublicProfilePages` (request context) and
 * `publicProfileTags` (Workflow, which has no request store to call it from).
 *
 * The sitemaps are deliberately absent: their routes set `Cache-Control` themselves, and vinext
 * only stamps `_N_T_` tags on a route handler that leaves the policy to the framework
 * (`shouldApplyAppRouteHandlerRevalidateHeader`), so a sitemap target would purge nothing and
 * still spend a tag slot from the per-batch purge budget. Their own `max-age` bounds staleness.
 */
export function publicProfileTargets(
  handles: ReadonlyArray<string | null | undefined>,
): RevalidateTarget[] {
  const targets: RevalidateTarget[] = [{ path: "/explore" }];

  for (const handle of handles) {
    if (handle) targets.push({ path: `/@${handle}` });
  }

  // Every /examples/<slug> page lists directory profiles.
  targets.push({ path: "/examples/[slug]", type: "page" });

  return targets;
}

/**
 * The encoded Cache-Tag digests `revalidatePath` would enqueue for `publicProfileTargets`,
 * built by hand for code that runs outside a request. Mirrors vinext's `revalidatePath` tag
 * derivation (`_N_T_<path>[/<type>]`); `tests/integration/cache/profile-tags.test.ts` runs the
 * real one and fails when the two diverge.
 */
export function publicProfileTags(handles: ReadonlyArray<string | null | undefined>): string[] {
  return publicProfileTargets(handles).map(({ path, type }) => {
    const stem = path.endsWith("/") ? path.slice(0, -1) : path;

    return encodeCloudflareCacheTag(type ? `_N_T_${stem}/${type}` : `_N_T_${stem || "/"}`);
  });
}
