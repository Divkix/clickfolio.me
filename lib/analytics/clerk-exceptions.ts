import type { CaptureResult } from "posthog-js/dist/module.no-external";

const CLERK_NETWORK_ERROR_MARKERS = ["failed_to_load_clerk_js", "ClerkJS: Network error"];

export const CLERK_NETWORK_EXCEPTION_FINGERPRINT = "clerk-network-error";

function isClerkNetworkError(value: string): boolean {
  return CLERK_NETWORK_ERROR_MARKERS.some((marker) => value.includes(marker));
}

/**
 * clerk-js loads on every page (ClerkProvider in the root layout), so a flaky
 * connection surfaces as a Clerk script-load or FAPI network error. The
 * messages embed the Clerk host or session id, which gives each failure its own
 * error tracking issue. Pin one fingerprint so they land in a single issue and
 * a real Clerk outage still shows as a spike there.
 */
export function groupClerkNetworkException(event: CaptureResult): CaptureResult {
  const exceptionList: { value?: string }[] | undefined = event.properties.$exception_list;

  if (event.event !== "$exception" || !Array.isArray(exceptionList)) {
    return event;
  }

  if (!exceptionList.some((exception) => isClerkNetworkError(exception?.value ?? ""))) {
    return event;
  }

  event.properties.$exception_fingerprint = CLERK_NETWORK_EXCEPTION_FINGERPRINT;
  event.properties.$issue_name = "Clerk network error";

  return event;
}
