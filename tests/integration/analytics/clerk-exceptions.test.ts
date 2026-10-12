import type { CaptureResult } from "posthog-js/dist/module.no-external";
import { describe, expect, it } from "vite-plus/test";
import {
  CLERK_NETWORK_EXCEPTION_FINGERPRINT,
  groupClerkNetworkException,
} from "@/lib/analytics/clerk-exceptions";

function exceptionEvent(value: string): CaptureResult {
  return {
    uuid: "test-uuid",
    event: "$exception",
    properties: { $exception_list: [{ type: "ChunkLoadError", value }] },
  };
}

describe("groupClerkNetworkException", () => {
  it.each([
    "Loading chunk 7181 failed.\n(error: https://clerk.example.com/npm/@clerk/ui@1.40.0/dist/7181_ui_1.40.0.js)",
    "ClerkJS: Network error at https://clerk.example.com/v1/client",
    "failed_to_load_clerk_js",
  ])("groups a Clerk network failure: %s", (value) => {
    const { properties } = groupClerkNetworkException(exceptionEvent(value));

    expect(properties.$exception_fingerprint).toBe(CLERK_NETWORK_EXCEPTION_FINGERPRINT);
    expect(properties.$issue_name).toBe("Clerk network error");
  });

  it("leaves a chunk-load failure from our own bundle ungrouped", () => {
    const { properties } = groupClerkNetworkException(
      exceptionEvent(
        "Loading chunk 12 failed.\n(error: https://clickfolio.me/_next/static/chunks/12.js)",
      ),
    );

    expect(properties.$exception_fingerprint).toBeUndefined();
  });
});
