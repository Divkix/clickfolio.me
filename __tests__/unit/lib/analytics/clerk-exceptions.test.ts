import { describe, expect, it } from "vite-plus/test";

import {
  CLERK_NETWORK_EXCEPTION_FINGERPRINT,
  groupClerkNetworkException,
} from "@/lib/analytics/clerk-exceptions";

function exceptionEvent(values: string[]) {
  return {
    uuid: "event-1",
    event: "$exception",
    properties: {
      $exception_list: values.map((value) => ({ type: "Error", value })),
    },
  };
}

describe("groupClerkNetworkException", () => {
  it("groups Clerk script-load failures for every Clerk host into one issue", () => {
    for (const host of ["clerk.clickfolio.me", "example-dev.clerk.accounts.dev"]) {
      const event = groupClerkNetworkException(
        exceptionEvent([
          `Clerk: Failed to load Clerk JS, failed to load script: https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js\n\n(code="failed_to_load_clerk_js")`,
          `failed to load script: https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
        ]),
      );

      expect(event.properties.$exception_fingerprint).toBe(CLERK_NETWORK_EXCEPTION_FINGERPRINT);
      expect(event.properties.$issue_name).toBe("Clerk network error");
    }
  });

  it("groups Clerk FAPI network errors that embed a session id", () => {
    const event = groupClerkNetworkException(
      exceptionEvent([
        'ClerkJS: Network error at "https://clerk.clickfolio.me/v1/client/sessions/sess_abc/touch" - TypeError: Load failed. Please try again.',
      ]),
    );

    expect(event.properties.$exception_fingerprint).toBe(CLERK_NETWORK_EXCEPTION_FINGERPRINT);
  });

  it("leaves other exceptions on the default fingerprint", () => {
    const event = groupClerkNetworkException(exceptionEvent(["TypeError: x is undefined"]));

    expect(event.properties.$exception_fingerprint).toBeUndefined();
    expect(event.properties.$issue_name).toBeUndefined();
  });

  it("ignores non-exception events and exceptions without a list", () => {
    const pageview = {
      uuid: "event-2",
      event: "$pageview",
      properties: { $exception_list: [{ value: "failed_to_load_clerk_js" }] },
    };

    const noList = { uuid: "event-3", event: "$exception", properties: {} };

    expect(groupClerkNetworkException(pageview).properties.$exception_fingerprint).toBeUndefined();
    expect(groupClerkNetworkException(noList).properties.$exception_fingerprint).toBeUndefined();
  });
});
