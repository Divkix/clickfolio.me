/**
 * Common test utilities — assertion helpers, mock cleanup, and
 * setup/teardown convenience wrappers for vitest.
 */

import { afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock cleanup
// ---------------------------------------------------------------------------

/**
 * Call `vi.restoreAllMocks()` and `vi.clearAllMocks()` in `afterEach`.
 * Import and call once at the top of any test file that creates mocks.
 *
 * ```ts
 * import { setupMockCleanup } from "@/__tests__/setup/helpers/test-utils";
 * setupMockCleanup();
 * ```
 */
export function setupMockCleanup() {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
}

// ---------------------------------------------------------------------------
// Console spy helpers
// ---------------------------------------------------------------------------

/**
 * Suppress console output during a test (error, warn, log).
 * Returns a spy that can be inspected for call arguments.
 *
 * ```ts
 * it("logs an error on failure", () => {
 *   const spy = suppressConsole("error");
 *   doSomethingThatErrors();
 *   expect(spy).toHaveBeenCalledOnce();
 * });
 * ```
 */
export function suppressConsole(method: "error" | "warn" | "log" | "info" | "debug" = "error") {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  return spy;
}
