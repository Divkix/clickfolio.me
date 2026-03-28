/**
 * Test setup file for vitest
 *
 * This creates a proper localStorage mock since bun's Node.js runtime
 * may interfere with jsdom's browser globals.
 */

import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, beforeEach, expect } from "vitest";
import { clearKeyCache } from "@/lib/utils/pending-upload-cookie";
import {
  mockDigest,
  mockGetRandomValues,
  mockImportKey,
  mockRandomUUID,
  mockSign,
} from "./mocks/crypto";

// Add jest-dom matchers
expect.extend(matchers);

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

// Set up crypto.subtle mock for jsdom environment
const subtleMock = {
  digest: mockDigest,
  importKey: mockImportKey,
  sign: mockSign,
};

Object.defineProperty(globalThis, "crypto", {
  value: {
    ...globalThis.crypto,
    subtle: subtleMock,
    randomUUID: mockRandomUUID,
    getRandomValues: mockGetRandomValues,
  },
  writable: true,
  configurable: true,
});

// Clear mocks and storage before each test
beforeEach(() => {
  localStorageMock.clear();
  mockDigest.mockClear();
  mockImportKey.mockClear();
  mockSign.mockClear();
  mockRandomUUID.mockClear();
  mockGetRandomValues.mockClear();
  clearKeyCache();
});

afterEach(() => {
  localStorageMock.clear();
});
