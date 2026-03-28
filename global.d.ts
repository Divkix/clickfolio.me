declare module "*.css";

// Type declarations for vitest and jest-dom matchers
import type { matchers } from "@testing-library/jest-dom";

declare module "vitest" {
  // @ts-expect-error - vitest's interface merging
  interface Assertion<T = unknown>
    extends matchers.TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  // @ts-expect-error - vitest's interface merging
  interface AsymmetricMatchersContaining
    extends matchers.TestingLibraryMatchers<typeof expect.stringContaining, unknown> {}
}
