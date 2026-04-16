import { vi } from "vitest";

export const mockDigest = vi.fn(
  async (algorithm: string, data: BufferSource): Promise<ArrayBuffer> => {
    const input = new Uint8Array(data as ArrayBuffer);

    if (algorithm === "SHA-1" || algorithm === "SHA-256") {
      const crypto = await import("node:crypto");
      const hash = crypto.createHash(algorithm.toLowerCase().replace("-", ""));
      hash.update(Buffer.from(input));
      const result = hash.digest();
      return new Uint8Array(result).buffer;
    }

    const hash = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hash[i] = input[i % input.length] ^ (i * 17);
    }
    return hash.buffer;
  },
);

export const mockImportKey = vi.fn(
  async (
    _format: string,
    keyData: BufferSource,
    _algorithm: string | object,
    _extractable: boolean,
    _keyUsages: string[],
  ): Promise<CryptoKey> => {
    const secretBytes = new Uint8Array(keyData as ArrayBuffer);
    const secret = new TextDecoder().decode(secretBytes);
    return {
      type: "secret",
      extractable: false,
      algorithm: { name: "HMAC", hash: "SHA-256" },
      usages: ["sign"],
      __secret: secret,
    } as CryptoKey & { __secret: string };
  },
);

export const mockSign = vi.fn(
  async (_algorithm: string, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer> => {
    const secret = (key as unknown as { __secret: string }).__secret || "default";
    const dataBytes = new Uint8Array(data as ArrayBuffer);
    const dataStr = new TextDecoder().decode(dataBytes);
    const combined = `${secret}:${dataStr}`;
    const signature = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
      signature[i] = secret.charCodeAt(i % secret.length);
    }

    for (let i = 0; i < combined.length; i++) {
      signature[i % 32] ^= combined.charCodeAt(i) ^ (i * 7);
    }

    return signature.buffer;
  },
);

let uuidCounter = 0;
export const mockRandomUUID = vi.fn((): string => {
  uuidCounter++;
  return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, "0")}`;
});

export const mockGetRandomValues = vi.fn(<T extends ArrayBufferView>(typedArray: T): T => {
  const view = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  for (let i = 0; i < view.length; i++) {
    view[i] = (i * 7) % 256;
  }
  return typedArray;
});
