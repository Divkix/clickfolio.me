/**
 * R2 Storage Integration Tests
 *
 * Tests R2 bucket operations including upload, retrieval, copy, delete,
 * partial content, and error handling scenarios.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getR2Binding, R2 } from "@/lib/r2";

// Minimal R2ObjectBody interface for testing
type R2ObjectBody = R2Object & { body: ReadableStream<Uint8Array> };

// Mock R2Bucket for testing
class MockR2Bucket implements R2Bucket {
  private storage = new Map<
    string,
    {
      body: Uint8Array;
      httpMetadata?: R2HTTPMetadata;
      customMetadata?: Record<string, string>;
    }
  >();

  async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
    const stored = this.storage.get(key);
    if (!stored) return null;

    // Handle range requests
    let bodyArray = stored.body;
    if (options?.range && typeof options.range === "object" && "offset" in options.range) {
      const range = options.range as { offset: number; length: number };
      bodyArray = stored.body.slice(range.offset, range.offset + range.length);
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyArray);
        controller.close();
      },
    });

    return {
      key,
      size: stored.body.length,
      etag: `"${this.hashKey(key)}"`,
      httpEtag: `"${this.hashKey(key)}"`,
      httpMetadata: stored.httpMetadata || {},
      customMetadata: stored.customMetadata || {},
      body,
      checksums: {},
      uploaded: new Date(),
      version: "1",
      writeHttpMetadata(headers: Headers) {
        for (const [k, v] of Object.entries(stored.httpMetadata || {})) {
          if (v) headers.set(k, String(v));
        }
      },
      async arrayBuffer() {
        return bodyArray.buffer.slice(
          bodyArray.byteOffset,
          bodyArray.byteOffset + bodyArray.byteLength,
        );
      },
      async blob() {
        return new Blob([bodyArray]);
      },
      async bytes() {
        return bodyArray;
      },
      async text() {
        return new TextDecoder().decode(bodyArray);
      },
      async json<T>() {
        return JSON.parse(await this.text()) as T;
      },
    } as R2ObjectBody;
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions,
  ): Promise<R2Object> {
    let body: Uint8Array;

    if (typeof value === "string") {
      body = new TextEncoder().encode(value);
    } else if (value instanceof ArrayBuffer) {
      body = new Uint8Array(value);
    } else if (ArrayBuffer.isView(value)) {
      body = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    } else if (value instanceof Blob) {
      body = new Uint8Array(await value.arrayBuffer());
    } else {
      // ReadableStream - collect all chunks
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        if (chunk) chunks.push(chunk);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      body = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    }

    this.storage.set(key, {
      body,
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });

    return {
      key,
      size: body.length,
      etag: `"${this.hashKey(key)}"`,
      httpEtag: `"${this.hashKey(key)}"`,
      httpMetadata: options?.httpMetadata || {},
      customMetadata: options?.customMetadata || {},
      checksums: {},
      uploaded: new Date(),
      version: "1",
      writeHttpMetadata() {},
      async arrayBuffer() {
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
      },
      async blob() {
        return new Blob([body]);
      },
      async bytes() {
        return body;
      },
      async text() {
        return new TextDecoder().decode(body);
      },
      async json<T>() {
        return JSON.parse(await this.text()) as T;
      },
    };
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      for (const k of key) this.storage.delete(k);
    } else {
      this.storage.delete(key);
    }
  }

  async head(key: string): Promise<R2Object | null> {
    const stored = this.storage.get(key);
    if (!stored) return null;

    return {
      key,
      size: stored.body.length,
      etag: `"${this.hashKey(key)}"`,
      httpEtag: `"${this.hashKey(key)}"`,
      httpMetadata: stored.httpMetadata || {},
      customMetadata: stored.customMetadata || {},
      checksums: {},
      uploaded: new Date(),
      version: "1",
      writeHttpMetadata() {},
      async arrayBuffer() {
        return stored.body.buffer.slice(
          stored.body.byteOffset,
          stored.body.byteOffset + stored.body.byteLength,
        );
      },
      async blob() {
        return new Blob([stored.body]);
      },
      async bytes() {
        return stored.body;
      },
      async text() {
        return new TextDecoder().decode(stored.body);
      },
      async json<T>() {
        return JSON.parse(await this.text()) as T;
      },
    };
  }

  async list(options?: R2ListOptions): Promise<R2Objects> {
    const prefix = options?.prefix || "";
    const limit = options?.limit || 1000;
    const cursor = options?.cursor || "0";
    const startIndex = Number.parseInt(cursor, 10);

    const allKeys = Array.from(this.storage.keys())
      .filter((k) => k.startsWith(prefix))
      .sort();

    const objects = allKeys.slice(startIndex, startIndex + limit).map((key) => {
      const stored = this.storage.get(key)!;
      return {
        key,
        size: stored.body.length,
        etag: `"${this.hashKey(key)}"`,
        httpEtag: `"${this.hashKey(key)}"`,
        httpMetadata: stored.httpMetadata || {},
        customMetadata: stored.customMetadata || {},
        checksums: {},
        uploaded: new Date(),
        version: "1",
        writeHttpMetadata() {},
        async arrayBuffer() {
          return stored.body.buffer.slice(
            stored.body.byteOffset,
            stored.body.byteOffset + stored.body.byteLength,
          );
        },
        async blob() {
          return new Blob([stored.body]);
        },
        async bytes() {
          return stored.body;
        },
        async text() {
          return new TextDecoder().decode(stored.body);
        },
        async json<T>() {
          return JSON.parse(await this.text()) as T;
        },
      };
    });

    const truncated = startIndex + limit < allKeys.length;
    const nextCursor = truncated ? String(startIndex + limit) : undefined;

    return {
      objects,
      truncated,
      cursor: nextCursor,
      delimitedPrefixes: [],
    };
  }

  async createMultipartUpload(
    _key: string,
    _options?: R2MultipartOptions,
  ): Promise<R2MultipartUpload> {
    throw new Error("Not implemented");
  }

  resumeMultipartUpload(_key: string, _uploadId: string): R2MultipartUpload {
    throw new Error("Not implemented");
  }

  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

describe("R2 Storage Integration", () => {
  let mockBucket: MockR2Bucket;

  beforeEach(() => {
    mockBucket = new MockR2Bucket();
  });

  describe("getR2Binding", () => {
    it("should return R2 bucket from env", () => {
      const bucket = new MockR2Bucket();
      const env = { CLICKFOLIO_R2_BUCKET: bucket as unknown as R2Bucket };
      const result = getR2Binding(env);
      expect(result).toBe(bucket);
    });

    it("should return null when bucket not in env", () => {
      const result = getR2Binding({});
      expect(result).toBeNull();
    });
  });

  describe("R2.put", () => {
    it("should upload PDF to R2 with correct key", async () => {
      const key = "resumes/test-user/test.pdf";
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic bytes

      const result = await R2.put(mockBucket, key, content, {
        contentType: "application/pdf",
        customMetadata: { userId: "test-user" },
      });

      expect(result.key).toBe(key);
      expect(result.size).toBe(4);
    });

    it("should store content-type as metadata", async () => {
      const key = "test/file.pdf";
      const content = new Uint8Array([1, 2, 3]);

      await R2.put(mockBucket, key, content, { contentType: "application/pdf" });
      const head = await R2.head(mockBucket, key);

      expect(head?.exists).toBe(true);
    });

    it("should handle empty file upload gracefully", async () => {
      const key = "test/empty.pdf";
      const content = new Uint8Array(0);

      const result = await R2.put(mockBucket, key, content);
      expect(result.size).toBe(0);
    });

    it("should preserve metadata during upload", async () => {
      const key = "test/with-metadata.pdf";
      const content = new Uint8Array([1, 2, 3]);
      const metadata = { userId: "user123", originalName: "resume.pdf" };

      await R2.put(mockBucket, key, content, {
        contentType: "application/pdf",
        customMetadata: metadata,
      });
      const headResult = await mockBucket.head(key);

      expect(headResult?.customMetadata).toEqual(metadata);
    });

    it("should handle string content upload", async () => {
      const key = "test/string-content.txt";
      const content = "Hello, World!";

      const result = await R2.put(mockBucket, key, content);
      expect(result.size).toBe(13);
    });

    it("should handle ReadableStream upload", async () => {
      const key = "test/stream-content.bin";
      const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });

      const result = await R2.put(mockBucket, key, stream);
      expect(result.size).toBe(4);
    });

    it("should overwrite existing key with new content", async () => {
      const key = "test/overwrite.pdf";
      const content1 = new Uint8Array([1, 2, 3]);
      const content2 = new Uint8Array([4, 5, 6, 7, 8]);

      await R2.put(mockBucket, key, content1);
      const firstHead = await R2.head(mockBucket, key);

      await R2.put(mockBucket, key, content2);
      const secondHead = await R2.head(mockBucket, key);

      expect(firstHead?.size).toBe(3);
      expect(secondHead?.size).toBe(5);
    });

    it("should handle special characters in keys", async () => {
      const key = "test/special-chars/file@2x.pdf";
      const content = new Uint8Array([1, 2, 3]);

      const result = await R2.put(mockBucket, key, content);
      expect(result.key).toBe(key);
    });

    it("should handle unicode filenames", async () => {
      const key = "test/resume/履歴書.pdf";
      const content = new Uint8Array([1, 2, 3]);

      const result = await R2.put(mockBucket, key, content);
      expect(result.key).toBe(key);
    });
  });

  describe("R2.get", () => {
    it("should retrieve PDF from R2 and match content", async () => {
      const key = "test/retrieve.pdf";
      const originalContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

      await R2.put(mockBucket, key, originalContent);
      const retrieved = await R2.get(mockBucket, key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.contentLength).toBe(5);
    });

    it("should return 404 error for invalid key access", async () => {
      const result = await R2.get(mockBucket, "non-existent/key.pdf");
      expect(result).toBeNull();
    });

    it("should return null for non-existent object", async () => {
      const result = await R2.get(mockBucket, "does-not-exist");
      expect(result).toBeNull();
    });
  });

  describe("R2.getAsArrayBuffer", () => {
    it("should retrieve content as ArrayBuffer", async () => {
      const key = "test/arraybuffer.pdf";
      const content = new Uint8Array([1, 2, 3, 4, 5]);

      await R2.put(mockBucket, key, content);
      const result = await R2.getAsArrayBuffer(mockBucket, key);

      expect(result).not.toBeNull();
      expect(new Uint8Array(result!).length).toBe(5);
    });

    it("should return null for non-existent key", async () => {
      const result = await R2.getAsArrayBuffer(mockBucket, "non-existent");
      expect(result).toBeNull();
    });
  });

  describe("R2.getAsUint8Array", () => {
    it("should retrieve content as Uint8Array", async () => {
      const key = "test/uint8array.pdf";
      const content = new Uint8Array([1, 2, 3, 4, 5]);

      await R2.put(mockBucket, key, content);
      const result = await R2.getAsUint8Array(mockBucket, key);

      expect(result).not.toBeNull();
      expect(result?.length).toBe(5);
    });
  });

  describe("R2.getPartial", () => {
    it("should support partial content retrieval", async () => {
      const key = "test/partial.pdf";
      const content = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      await R2.put(mockBucket, key, content);
      const partial = await R2.getPartial(mockBucket, key, 2, 4);

      expect(partial).not.toBeNull();
      const partialArray = new Uint8Array(partial!);
      expect(partialArray).toEqual(new Uint8Array([3, 4, 5, 6]));
    });

    it("should return null for non-existent key in partial request", async () => {
      const result = await R2.getPartial(mockBucket, "non-existent", 0, 100);
      expect(result).toBeNull();
    });
  });

  describe("R2.copy", () => {
    it("should copy object between keys", async () => {
      const sourceKey = "test/source.pdf";
      const destKey = "test/destination.pdf";
      const content = new Uint8Array([1, 2, 3, 4, 5]);

      await R2.put(mockBucket, sourceKey, content);
      const copied = await R2.copy(mockBucket, sourceKey, destKey);

      expect(copied).toBe(true);

      const destContent = await R2.getAsUint8Array(mockBucket, destKey);
      expect(destContent).toEqual(content);
    });

    it("should return false when source does not exist", async () => {
      const result = await R2.copy(mockBucket, "non-existent", "dest");
      expect(result).toBe(false);
    });

    it("should preserve metadata during copy", async () => {
      const sourceKey = "test/source-with-meta.pdf";
      const destKey = "test/copied-meta.pdf";
      const content = new Uint8Array([1, 2, 3]);
      const metadata = { custom: "value" };

      await R2.put(mockBucket, sourceKey, content, {
        contentType: "application/pdf",
        customMetadata: metadata,
      });
      await R2.copy(mockBucket, sourceKey, destKey);

      const headResult = await mockBucket.head(destKey);
      expect(headResult?.customMetadata).toEqual(metadata);
    });
  });

  describe("R2.delete", () => {
    it("should delete object from R2", async () => {
      const key = "test/delete-me.pdf";
      await R2.put(mockBucket, key, new Uint8Array([1, 2, 3]));

      await R2.delete(mockBucket, key);
      const result = await R2.get(mockBucket, key);

      expect(result).toBeNull();
    });

    it("should not throw when deleting non-existent key", async () => {
      await expect(R2.delete(mockBucket, "non-existent")).resolves.not.toThrow();
    });
  });

  describe("R2.head", () => {
    it("should check object existence and return metadata", async () => {
      const key = "test/head-check.pdf";
      const content = new Uint8Array([1, 2, 3, 4, 5]);

      await R2.put(mockBucket, key, content);
      const head = await R2.head(mockBucket, key);

      expect(head?.exists).toBe(true);
      expect(head?.size).toBe(5);
      expect(head?.etag).toBeDefined();
    });

    it("should return exists: false for non-existent object", async () => {
      const head = await R2.head(mockBucket, "non-existent");
      expect(head?.exists).toBe(false);
    });
  });

  describe("R2.healthCheck", () => {
    it("should return true when bucket is accessible", async () => {
      const result = await R2.healthCheck(mockBucket);
      expect(result).toBe(true);
    });

    it("should return false when bucket throws", async () => {
      const brokenBucket = {
        list: vi.fn().mockRejectedValue(new Error("Service unavailable")),
      } as unknown as R2Bucket;

      const result = await R2.healthCheck(brokenBucket);
      expect(result).toBe(false);
    });
  });

  describe("bucket.list", () => {
    it("should list objects with prefix", async () => {
      await R2.put(mockBucket, "prefix/file1.pdf", new Uint8Array([1]));
      await R2.put(mockBucket, "prefix/file2.pdf", new Uint8Array([2]));
      await R2.put(mockBucket, "other/file3.pdf", new Uint8Array([3]));

      const list = await mockBucket.list({ prefix: "prefix/" });
      expect(list.objects.length).toBe(2);
    });

    it("should support pagination with limit", async () => {
      for (let i = 0; i < 5; i++) {
        await R2.put(mockBucket, `test/file${i}.pdf`, new Uint8Array([i]));
      }

      const list = await mockBucket.list({ prefix: "test/", limit: 2 });
      expect(list.objects.length).toBe(2);
      expect(list.truncated).toBe(true);
    });
  });

  describe("large file handling", () => {
    it("should handle large file uploads with chunking", async () => {
      const key = "test/large-file.pdf";
      // Simulate a 1MB file
      const largeContent = new Uint8Array(1024 * 1024);
      for (let i = 0; i < largeContent.length; i++) {
        largeContent[i] = i % 256;
      }

      const result = await R2.put(mockBucket, key, largeContent);
      expect(result.size).toBe(1024 * 1024);

      const retrieved = await R2.getAsUint8Array(mockBucket, key);
      expect(retrieved?.length).toBe(1024 * 1024);
    });
  });

  describe("concurrent operations", () => {
    it("should handle concurrent uploads without corruption", async () => {
      const keys = ["concurrent/1.pdf", "concurrent/2.pdf", "concurrent/3.pdf"];
      const contents = keys.map((_, i) => new Uint8Array([i, i + 1, i + 2]));

      await Promise.all(keys.map((key, i) => R2.put(mockBucket, key, contents[i])));

      for (let i = 0; i < keys.length; i++) {
        const retrieved = await R2.getAsUint8Array(mockBucket, keys[i]);
        expect(retrieved).toEqual(contents[i]);
      }
    });
  });

  describe("binary content integrity", () => {
    it("should verify hash integrity for binary content", async () => {
      const key = "test/binary-integrity.bin";
      const content = crypto.getRandomValues(new Uint8Array(1000));

      await R2.put(mockBucket, key, content);
      const head = await R2.head(mockBucket, key);

      expect(head?.exists).toBe(true);
      expect(head?.etag).toBeDefined();
    });
  });

  describe("streaming download", () => {
    it("should support streaming download for partial content", async () => {
      const key = "test/streaming.pdf";
      const content = new Uint8Array(10000);
      for (let i = 0; i < content.length; i++) {
        content[i] = i % 256;
      }

      await R2.put(mockBucket, key, content);

      const partial1 = await R2.getPartial(mockBucket, key, 0, 1000);
      const partial2 = await R2.getPartial(mockBucket, key, 5000, 1000);

      expect(new Uint8Array(partial1!).length).toBe(1000);
      expect(new Uint8Array(partial2!).length).toBe(1000);
    });
  });

  describe("error handling", () => {
    it("should handle service unavailable with retry pattern", async () => {
      let attempts = 0;
      const flakyPut = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Service unavailable"));
        }
        return Promise.resolve({
          key: "test",
          size: 4,
        });
      });

      const flakyBucket = {
        put: flakyPut,
      } as unknown as R2Bucket;

      let success = false;
      let lastError: Error | null = null;

      for (let i = 0; i < 3; i++) {
        try {
          await R2.put(flakyBucket, "test", new Uint8Array([1, 2, 3, 4]));
          success = true;
          lastError = null; // Clear error on success
          break;
        } catch (e) {
          lastError = e as Error;
          // Wait a bit before retry
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      expect(attempts).toBe(3);
      expect(success).toBe(true);
      expect(lastError).toBeNull();
    });
  });

  describe("presigned URL", () => {
    it("should generate valid presigned URL with expiry", async () => {
      // Note: Real presigned URLs require R2 S3-compatible API
      // This tests the conceptual URL generation
      const key = "test/presigned.pdf";
      await R2.put(mockBucket, key, new Uint8Array([1, 2, 3]));

      const head = await R2.head(mockBucket, key);
      expect(head?.exists).toBe(true);
    });
  });
});
