/**
 * Barrel export for the test setup package.
 *
 * Import everything from here:
 * ```ts
 * import { createMockUser, createMockDb, assertResolves } from "@/__tests__/setup";
 * ```
 */

export * from "./fixtures/index";
export {
  assertResolves,
  createJsonRequest,
  expectRejects,
  fixedDate,
  futureDate,
  parseJsonResponse,
  pastDate,
  setupMockCleanup,
  setupModuleReset,
  suppressConsole,
} from "./helpers/test-utils";
