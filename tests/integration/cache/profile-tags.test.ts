import { encodeCloudflareCacheTag } from "@vinext/cloudflare/cache/cdn-adapter.runtime";
import { revalidatePath } from "vinext/shims/cache";
import { setCdnCacheAdapter, type CdnCacheAdapter } from "vinext/shims/cdn-cache";
import { describe, expect, it } from "vite-plus/test";
import { publicProfileTags, publicProfileTargets } from "@/lib/cache/public-profile-paths";

// Runs vinext's real `revalidatePath` against a recording CDN adapter, so the hand-built tags a
// Workflow enqueues cannot drift from what a request would purge. The adapter receives raw tags
// and encodes them itself (`QueuedPurgeCdnCacheAdapter.revalidateTag`), so the recorder does too.
async function tagsVinextSends(handles: string[]): Promise<string[]> {
  const sent: string[] = [];

  const recorder: Pick<CdnCacheAdapter, "revalidateTag"> = {
    revalidateTag: async (tags) => {
      sent.push(...(Array.isArray(tags) ? tags : [tags]).map(encodeCloudflareCacheTag));
    },
  };

  // SAFETY: revalidatePath only calls revalidateTag on the registered adapter.
  setCdnCacheAdapter(recorder as CdnCacheAdapter);

  for (const { path, type } of publicProfileTargets(handles)) {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }

  await new Promise((resolve) => setTimeout(resolve, 20));

  return sent;
}

describe("publicProfileTags", () => {
  it("equals the tags vinext's revalidatePath sends for the same targets", async () => {
    const real = await tagsVinextSends(["alice", "bob"]);

    expect([...real].sort()).toEqual([...publicProfileTags(["alice", "bob"])].sort());
    expect(real).toHaveLength(4);
  });

  it("encodes the page tag of a profile as vinext does", () => {
    expect(publicProfileTags(["alice"])).toContain(encodeCloudflareCacheTag("_N_T_/@alice"));
  });

  it("skips missing handles but always includes the shared surfaces", () => {
    expect(publicProfileTags([null, undefined, ""])).toEqual(publicProfileTags([]));
    expect(publicProfileTags([])).toHaveLength(2);
  });
});
