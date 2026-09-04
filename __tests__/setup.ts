import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, beforeEach, expect, vi } from "vite-plus/test";
import { clearKeyCache } from "@/lib/utils/pending-upload-cookie";
import {
  mockDigest,
  mockGetRandomValues,
  mockImportKey,
  mockRandomUUID,
  mockSign,
} from "./mocks/crypto";

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function MockPostHog() {
    return {
      capture: vi.fn(),
      shutdown: vi.fn(async () => undefined),
    };
  }),
}));

expect.extend(matchers);

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

const localStorageMock = createLocalStorageMock();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

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

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width: 320, height: 160 } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

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
