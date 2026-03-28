/**
 * Shared crypto mock utilities for tests
 * Mocks SubtleCrypto methods that fail in jsdom environment
 */

import { vi } from "vitest";

/**
 * Creates a deterministic mock SHA-256 hash as ArrayBuffer
 * Returns a 32-byte buffer filled with predictable pattern
 */
export function createMockHash(): ArrayBuffer {
  return new Uint8Array(32).fill(0xab).buffer;
}

/**
 * Mock implementation of crypto.subtle.digest
 * Returns actual SHA-1/SHA-256 hashes using Bun's crypto for accuracy
 */
export const mockDigest = vi.fn(
  async (algorithm: string, data: BufferSource): Promise<ArrayBuffer> => {
    const input = new Uint8Array(data as ArrayBuffer);

    // Use Bun's crypto for accurate hashing
    if (algorithm === "SHA-1" || algorithm === "SHA-256") {
      const crypto = await import("node:crypto");
      const hash = crypto.createHash(algorithm.toLowerCase().replace("-", ""));
      hash.update(Buffer.from(input));
      const result = hash.digest();
      // Convert to ArrayBuffer
      const arrayBuffer = new Uint8Array(result).buffer;
      return arrayBuffer;
    }

    // Fallback for other algorithms
    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hash[i] = input[i % input.length] ^ (i * 17);
    }
    return hash.buffer;
  },
);

/**
 * Mock implementation of crypto.subtle.importKey
 */
export const mockImportKey = vi.fn(
  async (
    _format: string,
    keyData: BufferSource,
    _algorithm: string | object,
    _extractable: boolean,
    _keyUsages: string[],
  ): Promise<CryptoKey> => {
    // Store the key data for use in sign operations
    const secretBytes = new Uint8Array(keyData as ArrayBuffer);
    const secret = new TextDecoder().decode(secretBytes);
    return {
      type: "secret",
      extractable: false,
      algorithm: { name: "HMAC", hash: "SHA-256" },
      usages: ["sign"],
      // Custom property to store the secret
      __secret: secret,
    } as CryptoKey & { __secret: string };
  },
);

/**
 * Mock implementation of crypto.subtle.sign
 * Returns deterministic signature based on data and key
 */
export const mockSign = vi.fn(
  async (_algorithm: string, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer> => {
    const secret = (key as unknown as { __secret: string }).__secret || "default";
    const dataBytes = new Uint8Array(data as ArrayBuffer);
    const dataStr = new TextDecoder().decode(dataBytes);

    // Create a deterministic signature based on secret + data
    // XOR all characters of combined string into a 32-byte signature
    const combined = `${secret}:${dataStr}`;
    const signature = new Uint8Array(32);

    // Initialize signature with secret-based values
    for (let i = 0; i < 32; i++) {
      signature[i] = secret.charCodeAt(i % secret.length);
    }

    // XOR in data-based values
    for (let i = 0; i < combined.length; i++) {
      signature[i % 32] ^= combined.charCodeAt(i) ^ (i * 7);
    }

    return signature.buffer;
  },
);

/**
 * Mock implementation of crypto.randomUUID
 * Returns deterministic but unique UUIDs for testing
 */
let uuidCounter = 0;
export const mockRandomUUID = vi.fn((): string => {
  uuidCounter++;
  // Return unique UUID based on counter
  return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, "0")}`;
});

/**
 * Mock implementation of crypto.getRandomValues
 * Fills typed array with predictable values for testing
 */
export const mockGetRandomValues = vi.fn(<T extends ArrayBufferView>(typedArray: T): T => {
  // Fill with incrementing byte values for deterministic testing
  const view = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  for (let i = 0; i < view.length; i++) {
    view[i] = (i * 7) % 256; // Deterministic pattern
  }
  return typedArray;
});

/**
 * Setup function to install crypto mocks
 * Call this in test setup or beforeEach
 */
export function setupCryptoMocks(): void {
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
}

/**
 * Reset all crypto mock implementations
 * Call this in afterEach to reset mock state
 */
export function resetCryptoMocks(): void {
  mockDigest.mockClear();
  mockImportKey.mockClear();
  mockSign.mockClear();
  mockRandomUUID.mockClear();
  mockGetRandomValues.mockClear();
  uuidCounter = 0;
}
