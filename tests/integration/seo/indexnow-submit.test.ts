import { describe, expect, it } from "vite-plus/test";
import { filterSiteUrls, indexNowRetryAt } from "@/lib/seo/indexnow";

const NOW = Date.parse("2026-10-31T12:00:00Z");

describe("IndexNow Retry-After", () => {
  it("parses delay-seconds and HTTP dates against response receipt time", () => {
    expect(indexNowRetryAt("120", NOW)).toBe(NOW + 120_000);
    expect(indexNowRetryAt("Sat, 31 Oct 2026 12:10:00 GMT", NOW)).toBe(NOW + 600_000);
    expect(indexNowRetryAt("0", NOW)).toBe(NOW);
  });

  it("falls back for absent, invalid, negative, past or unrepresentable dates", () => {
    for (const value of [
      null,
      "",
      "invalid",
      "-10",
      "999999999999999999999999",
      "Fri, 30 Oct 2026 12:00:00 GMT",
    ]) {
      expect(indexNowRetryAt(value, NOW)).toBeUndefined();
    }
  });
});

describe("IndexNow URL boundary", () => {
  it("rejects foreign or malformed URLs and deduplicates before persisting", () => {
    expect(
      filterSiteUrls([
        "https://clickfolio.me/@alice",
        "https://clickfolio.me/@alice",
        "https://elsewhere.example/@alice",
        "not a URL",
      ]),
    ).toEqual(["https://clickfolio.me/@alice"]);
  });
});
