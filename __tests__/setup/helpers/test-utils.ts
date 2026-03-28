/**
 * Common test utilities — assertion helpers, mock cleanup, and
 * setup/teardown convenience wrappers for vitest.
 */

import { afterEach, beforeEach, vi } from "vitest";

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

// ---------------------------------------------------------------------------
// Async test helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a promise so it can be asserted on with a timeout.
 * Rejects the test if the promise doesn't settle within `ms`.
 *
 * ```ts
 * it("resolves within 1s", async () => {
 *   await assertResolves(someAsyncOp(), 1000);
 * });
 * ```
 */
export async function assertResolves<T>(
  promise: Promise<T>,
  ms = 5000,
  message = "Operation did not resolve in time",
): Promise<T> {
  let settled = false;
  let result!: T;
  let error!: unknown;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );

  try {
    result = await Promise.race([promise, timeout]);
    settled = true;
  } catch (e) {
    error = e;
  }

  if (!settled) throw error;
  return result;
}

/**
 * Assert that a promise rejects with a specific message substring.
 *
 * ```ts
 * await expectRejects(
 *   someFailingOp(),
 *   "rate limit exceeded",
 * );
 * ```
 */
export async function expectRejects(
  promise: Promise<unknown>,
  messageSubstring?: string,
): Promise<Error> {
  let caughtError: Error;
  try {
    await promise;
    throw new Error("Expected promise to reject but it resolved");
  } catch (e) {
    if (e instanceof Error && e.message === "Expected promise to reject but it resolved") {
      throw e;
    }
    caughtError = e as Error;
  }
  if (messageSubstring && !caughtError.message.includes(messageSubstring)) {
    throw new Error(
      `Expected error message to include "${messageSubstring}" but got "${caughtError.message}"`,
    );
  }
  return caughtError;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Return a fixed ISO date string for deterministic test data.
 * Useful for createdAt / updatedAt fields.
 */
export function fixedDate(offset = 0): string {
  const base = new Date("2026-01-15T12:00:00.000Z");
  return new Date(base.getTime() + offset).toISOString();
}

/**
 * Return a date string in the past by `ms` milliseconds from now.
 */
export function pastDate(ms = 86_400_000): string {
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Return a date string in the future by `ms` milliseconds from now.
 */
export function futureDate(ms = 86_400_000): string {
  return new Date(Date.now() + ms).toISOString();
}

// ---------------------------------------------------------------------------
// Request / Response helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock `Request` with JSON body.
 */
export function createJsonRequest<T>(body: T, init: RequestInit = {}): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...init.headers },
    body: JSON.stringify(body),
    ...init,
  });
}

/**
 * Parse a `Response` body as JSON.
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Module mock setup helpers
// ---------------------------------------------------------------------------

/**
 * Mock a module and restore it after each test.
 * Convenience wrapper around `vi.mock()`.
 *
 * Note: `vi.mock()` is hoisted, so call this at module scope, not inside `beforeEach`.
 * This helper exists for documentation / discoverability — use `vi.mock()` directly.
 *
 * ```ts
 * // At top of test file:
 * vi.mock("@/lib/r2", () => ({
 *   R2: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
 * }));
 * ```
 */

/**
 * Reset modules between tests (useful when testing module-level state).
 */
export function setupModuleReset() {
  beforeEach(() => {
    vi.resetModules();
  });
}
