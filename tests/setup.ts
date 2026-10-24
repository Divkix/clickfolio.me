import { beforeEach } from "vite-plus/test";
import {
  mockDigest,
  mockGetRandomValues,
  mockImportKey,
  mockRandomUUID,
  mockSign,
} from "./mocks/crypto";

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
});
