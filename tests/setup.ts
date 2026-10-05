import { beforeEach, vi } from "vite-plus/test";
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

beforeEach(() => {
  mockDigest.mockClear();
  mockImportKey.mockClear();
  mockSign.mockClear();
  mockRandomUUID.mockClear();
  mockGetRandomValues.mockClear();
  clearKeyCache();
});
