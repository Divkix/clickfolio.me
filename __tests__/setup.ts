/**
 * Test setup file for vitest
 *
 * This creates a proper localStorage mock since bun's Node.js runtime
 * may interfere with jsdom's browser globals.
 */
import { afterEach, beforeEach } from "vitest";

// Create a proper localStorage mock
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string): string | null => {
      return store[key] ?? null;
    },
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    get length(): number {
      return Object.keys(store).length;
    },
    key: (index: number): string | null => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
};

// Set up localStorage mock before tests
const localStorageMock = createLocalStorageMock();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Clear localStorage before each test to ensure test isolation
beforeEach(() => {
  localStorageMock.clear();
});

afterEach(() => {
  localStorageMock.clear();
});
