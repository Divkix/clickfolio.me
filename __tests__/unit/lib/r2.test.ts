/**
 * R2 storage operations unit tests
 * Tests for lib/r2.ts - Cloudflare R2 storage client
 *
 * @jest-environment node
 */

import { describe, expect, it } from "vitest";
import { createMockR2Bucket } from "@/__tests__/setup/mocks/r2.mock";
import { getR2Binding, R2 } from "@/lib/r2";

describe("getR2Binding", () => {
  it("returns R2 bucket when CLICKFOLIO_R2_BUCKET is set", () => {
    const mockBucket = createMockR2Bucket().bucket as unknown as R2Bucket;
    const env: Partial<CloudflareEnv> = {
      CLICKFOLIO_R2_BUCKET: mockBucket,
    };

    const result = getR2Binding(env);

    expect(result).toBe(mockBucket);
  });

  it("returns null when CLICKFOLIO_R2_BUCKET is not set", () => {
    const env: Partial<CloudflareEnv> = {};

    const result = getR2Binding(env);

    expect(result).toBeNull();
  });

  it("returns null when CLICKFOLIO_R2_BUCKET is undefined", () => {
    const env: Partial<CloudflareEnv> = {
      CLICKFOLIO_R2_BUCKET: undefined,
    };

    const result = getR2Binding(env);

    expect(result).toBeNull();
  });
});

describe("R2.get", () => {
  it("returns object body and size when object exists", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "test content";
    const encoder = new TextEncoder();
    store.set("test-key", { body: encoder.encode(content).buffer });

    const result = await R2.get(bucket as unknown as R2Bucket, "test-key");

    expect(result).not.toBeNull();
    expect(result?.contentLength).toBe(content.length);
    expect(result?.body).toBeInstanceOf(ReadableStream);
  });

  it("returns null when object does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.get(bucket as unknown as R2Bucket, "non-existent-key");

    expect(result).toBeNull();
  });

  it("returns correct contentLength for different sized objects", async () => {
    const { bucket, store } = createMockR2Bucket();
    const encoder = new TextEncoder();

    // Small object
    store.set("small", { body: encoder.encode("a").buffer });
    const small = await R2.get(bucket as unknown as R2Bucket, "small");
    expect(small?.contentLength).toBe(1);

    // Large object
    const largeContent = "x".repeat(10000);
    store.set("large", { body: encoder.encode(largeContent).buffer });
    const large = await R2.get(bucket as unknown as R2Bucket, "large");
    expect(large?.contentLength).toBe(10000);
  });

  it("propagates errors from the binding", async () => {
    const { bucket } = createMockR2Bucket();
    bucket.get.mockRejectedValueOnce(new Error("R2 network error"));

    await expect(R2.get(bucket as unknown as R2Bucket, "key")).rejects.toThrow("R2 network error");
  });
});

describe("R2.getAsArrayBuffer", () => {
  it("returns ArrayBuffer when object exists", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "test data";
    const encoder = new TextEncoder();
    store.set("test-key", { body: encoder.encode(content).buffer });

    const result = await R2.getAsArrayBuffer(bucket as unknown as R2Bucket, "test-key");

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result?.byteLength).toBe(content.length);
  });

  it("returns null when object does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.getAsArrayBuffer(bucket as unknown as R2Bucket, "non-existent");

    expect(result).toBeNull();
  });

  it("handles empty objects", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("empty", { body: new ArrayBuffer(0) });

    const result = await R2.getAsArrayBuffer(bucket as unknown as R2Bucket, "empty");

    expect(result).not.toBeNull();
    expect(result?.byteLength).toBe(0);
  });

  it("handles large files correctly", async () => {
    const { bucket, store } = createMockR2Bucket();
    const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
    store.set("large-file", { body: largeBuffer });

    const result = await R2.getAsArrayBuffer(bucket as unknown as R2Bucket, "large-file");

    expect(result?.byteLength).toBe(1024 * 1024);
  });

  it("preserves binary data integrity", async () => {
    const { bucket, store } = createMockR2Bucket();
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe]);
    store.set("binary", { body: binaryData.buffer });

    const result = await R2.getAsArrayBuffer(bucket as unknown as R2Bucket, "binary");

    expect(result).not.toBeNull();
    const resultArray = new Uint8Array(result!);
    expect(resultArray).toEqual(binaryData);
  });
});

describe("R2.getAsUint8Array", () => {
  it("returns Uint8Array when object exists", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "test data";
    const encoder = new TextEncoder();
    store.set("test-key", { body: encoder.encode(content).buffer });

    const result = await R2.getAsUint8Array(bucket as unknown as R2Bucket, "test-key");

    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("returns null when object does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.getAsUint8Array(bucket as unknown as R2Bucket, "non-existent");

    expect(result).toBeNull();
  });

  it("returns correct data as Uint8Array", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "Hello, World!";
    const encoder = new TextEncoder();
    const originalBytes = encoder.encode(content);
    store.set("text-key", { body: originalBytes.buffer });

    const result = await R2.getAsUint8Array(bucket as unknown as R2Bucket, "text-key");

    expect(result).toEqual(originalBytes);
  });
});

describe("R2.getPartial", () => {
  it("returns partial content with range request", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "Hello, World!";
    const encoder = new TextEncoder();
    store.set("test-key", { body: encoder.encode(content).buffer });

    // Mock the bucket.get with range option
    bucket.get.mockImplementationOnce(
      async (_key: string, options?: { range?: { offset: number; length: number } }) => {
        const entry = store.get("test-key");
        if (!entry) return null;
        const bytes = new Uint8Array(entry.body);
        const range = options?.range;
        if (range) {
          const sliced = bytes.slice(range.offset, range.offset + range.length);
          return {
            arrayBuffer: async () => sliced.buffer,
            size: sliced.length,
            etag: "mock-etag",
          };
        }
        return {
          arrayBuffer: async () => entry.body,
          size: entry.body.byteLength,
          etag: "mock-etag",
        };
      },
    );

    const result = await R2.getPartial(bucket as unknown as R2Bucket, "test-key", 0, 5);

    expect(result).not.toBeNull();
    const text = new TextDecoder().decode(result!);
    expect(text).toBe("Hello");
  });

  it("returns null when object does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.getPartial(bucket as unknown as R2Bucket, "non-existent", 0, 10);

    expect(result).toBeNull();
  });

  it("handles range at different offsets", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "Hello, World!";
    const encoder = new TextEncoder();
    store.set("test-key", { body: encoder.encode(content).buffer });

    bucket.get.mockImplementation(
      async (_key: string, options?: { range?: { offset: number; length: number } }) => {
        const entry = store.get("test-key");
        if (!entry) return null;
        const bytes = new Uint8Array(entry.body);
        const range = options?.range;
        if (range) {
          const sliced = bytes.slice(range.offset, range.offset + range.length);
          return {
            arrayBuffer: async () => sliced.buffer,
            size: sliced.length,
            etag: "mock-etag",
          };
        }
        return null;
      },
    );

    // Test range starting at offset 7
    const result = await R2.getPartial(bucket as unknown as R2Bucket, "test-key", 7, 6);
    const text = new TextDecoder().decode(result!);
    expect(text).toBe("World!");
  });
});

describe("R2.put", () => {
  it("stores object with ArrayBuffer body", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = new TextEncoder().encode("test content");

    await R2.put(bucket as unknown as R2Bucket, "test-key", content.buffer);

    expect(store.has("test-key")).toBe(true);
    expect(store.get("test-key")?.body.byteLength).toBe(content.length);
  });

  it("stores object with Uint8Array body", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = new TextEncoder().encode("test content");

    await R2.put(bucket as unknown as R2Bucket, "test-key", content);

    expect(store.has("test-key")).toBe(true);
  });

  it("stores object with string body", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "string content";

    await R2.put(bucket as unknown as R2Bucket, "test-key", content);

    expect(store.has("test-key")).toBe(true);
    const stored = store.get("test-key")!;
    const decoded = new TextDecoder().decode(stored.body);
    expect(decoded).toBe(content);
  });

  it("stores object with ReadableStream body", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "stream content";
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(content));
        controller.close();
      },
    });

    await R2.put(bucket as unknown as R2Bucket, "test-key", stream);

    expect(store.has("test-key")).toBe(true);
  });

  it("applies contentType metadata", async () => {
    const { bucket } = createMockR2Bucket();

    await R2.put(bucket as unknown as R2Bucket, "test-key", new ArrayBuffer(10), {
      contentType: "application/pdf",
    });

    expect(bucket.put).toHaveBeenCalledWith(
      "test-key",
      expect.any(ArrayBuffer),
      expect.objectContaining({
        httpMetadata: { contentType: "application/pdf" },
      }),
    );
  });

  it("applies custom metadata", async () => {
    const { bucket } = createMockR2Bucket();
    const customMetadata = { userId: "user-123", source: "upload" };

    await R2.put(bucket as unknown as R2Bucket, "test-key", new ArrayBuffer(10), {
      customMetadata,
    });

    expect(bucket.put).toHaveBeenCalledWith(
      "test-key",
      expect.any(ArrayBuffer),
      expect.objectContaining({
        customMetadata,
      }),
    );
  });

  it("returns R2Object with size", async () => {
    const { bucket } = createMockR2Bucket();
    const content = new TextEncoder().encode("test");

    const result = await R2.put(bucket as unknown as R2Bucket, "test-key", content.buffer);

    expect(result).toHaveProperty("size");
    expect(result).toHaveProperty("etag");
  });

  it("handles empty content", async () => {
    const { bucket, store } = createMockR2Bucket();

    await R2.put(bucket as unknown as R2Bucket, "empty-key", new ArrayBuffer(0));

    expect(store.has("empty-key")).toBe(true);
    expect(store.get("empty-key")?.body.byteLength).toBe(0);
  });
});

describe("R2.delete", () => {
  it("removes object from storage", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("delete-me", { body: new ArrayBuffer(10) });

    await R2.delete(bucket as unknown as R2Bucket, "delete-me");

    expect(store.has("delete-me")).toBe(false);
  });

  it("succeeds when object does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    await expect(R2.delete(bucket as unknown as R2Bucket, "non-existent")).resolves.not.toThrow();
  });

  it("only deletes specified key", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("keep", { body: new ArrayBuffer(10) });
    store.set("delete", { body: new ArrayBuffer(10) });

    await R2.delete(bucket as unknown as R2Bucket, "delete");

    expect(store.has("keep")).toBe(true);
    expect(store.has("delete")).toBe(false);
  });
});

describe("R2.head", () => {
  it("returns exists=true for existing object", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("test-key", { body: new ArrayBuffer(100) });

    const result = await R2.head(bucket as unknown as R2Bucket, "test-key");

    expect(result).toEqual({
      exists: true,
      size: 100,
      etag: "mock-etag",
    });
  });

  it("returns exists=false for non-existent object", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.head(bucket as unknown as R2Bucket, "non-existent");

    expect(result).toEqual({ exists: false });
  });

  it("returns correct size for different objects", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("small", { body: new ArrayBuffer(10) });
    store.set("large", { body: new ArrayBuffer(10000) });

    const small = await R2.head(bucket as unknown as R2Bucket, "small");
    const large = await R2.head(bucket as unknown as R2Bucket, "large");

    expect(small?.size).toBe(10);
    expect(large?.size).toBe(10000);
  });

  it("returns etag when object exists", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("test-key", { body: new ArrayBuffer(100) });

    const result = await R2.head(bucket as unknown as R2Bucket, "test-key");

    expect(result?.etag).toBeDefined();
    expect(typeof result?.etag).toBe("string");
  });
});

describe("R2.copy", () => {
  it("copies object to new key", async () => {
    const { bucket, store } = createMockR2Bucket();
    const content = "original content";
    const encoder = new TextEncoder();
    store.set("source", { body: encoder.encode(content).buffer });

    const result = await R2.copy(bucket as unknown as R2Bucket, "source", "destination");

    expect(result).toBe(true);
    expect(store.has("destination")).toBe(true);
    const copied = new TextDecoder().decode(store.get("destination")?.body);
    expect(copied).toBe(content);
  });

  it("returns false when source does not exist", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.copy(bucket as unknown as R2Bucket, "non-existent", "destination");

    expect(result).toBe(false);
  });

  it("preserves content during copy", async () => {
    const { bucket, store } = createMockR2Bucket();
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
    store.set("source", { body: binaryData.buffer });

    await R2.copy(bucket as unknown as R2Bucket, "source", "copied");

    const copied = new Uint8Array(store.get("copied")?.body as ArrayBuffer);
    expect(copied).toEqual(binaryData);
  });

  it("overwrites destination if it exists", async () => {
    const { bucket, store } = createMockR2Bucket();
    store.set("source", { body: new TextEncoder().encode("new").buffer });
    store.set("dest", { body: new TextEncoder().encode("old").buffer });

    await R2.copy(bucket as unknown as R2Bucket, "source", "dest");

    const destContent = new TextDecoder().decode(store.get("dest")?.body);
    expect(destContent).toBe("new");
  });
});

describe("R2.healthCheck", () => {
  it("returns true when bucket is accessible", async () => {
    const { bucket } = createMockR2Bucket();

    const result = await R2.healthCheck(bucket as unknown as R2Bucket);

    expect(result).toBe(true);
  });

  it("returns false when bucket is not accessible", async () => {
    const { bucket } = createMockR2Bucket();
    bucket.list.mockRejectedValueOnce(new Error("Access denied"));

    const result = await R2.healthCheck(bucket as unknown as R2Bucket);

    expect(result).toBe(false);
  });

  it("calls list with limit 1", async () => {
    const { bucket } = createMockR2Bucket();

    await R2.healthCheck(bucket as unknown as R2Bucket);

    expect(bucket.list).toHaveBeenCalledWith({ limit: 1 });
  });
});
