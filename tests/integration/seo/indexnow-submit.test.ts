import { describe, expect, it } from "vite-plus/test";
import { submitToIndexNow } from "@/lib/seo/indexnow";

const SITE = "https://clickfolio.me";

describe("submitToIndexNow", () => {
  it("records the error of a batch whose request threw, with status 0", async () => {
    const result = await submitToIndexNow([`${SITE}/blog`], {
      siteUrl: SITE,
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(result.submitted).toBe(0);
    expect(result.statuses).toEqual([0]);
    expect(result.errors).toEqual(["TypeError: fetch failed"]);
  });

  it("counts accepted batches and records no errors", async () => {
    const result = await submitToIndexNow([`${SITE}/blog`], {
      siteUrl: SITE,
      fetchImpl: async () => new Response(null, { status: 202 }),
    });

    expect(result).toEqual({ submitted: 1, statuses: [202], errors: [] });
  });
});
