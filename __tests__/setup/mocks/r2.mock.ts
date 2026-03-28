/**
 * Cloudflare R2 storage mock factories.
 *
 * Provides lightweight stubs for `R2Bucket` methods used throughout the
 * codebase (get, put, delete, head, list). Tests can assert on call
 * arguments and control return values per-test.
 */

import { vi } from "vitest";

// ---------------------------------------------------------------------------
// R2 object metadata (what R2Bucket.get() / head() returns)
// ---------------------------------------------------------------------------

export interface MockR2Object {
  body: ReadableStream<Uint8Array> | null;
  size: number;
  etag: string;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  writeHttpMetadata: (headers: Headers) => void;
}

/**
 * Create a mock R2 object (the shape returned by `binding.get()`).
 */
export function createMockR2Object(
  overrides: Partial<MockR2Object> & { content?: string } = {},
): MockR2Object {
  const content = overrides.content ?? "";
  const bytes = new TextEncoder().encode(content);

  return {
    body: content
      ? new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        })
      : null,
    size: overrides.size ?? bytes.byteLength,
    etag: overrides.etag ?? "mock-etag-abc123",
    httpMetadata: overrides.httpMetadata ?? { contentType: "application/pdf" },
    customMetadata: overrides.customMetadata ?? {},
    writeHttpMetadata: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Mock R2Bucket binding
// ---------------------------------------------------------------------------

export interface MockR2Bucket {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

/**
 * Store backing for the mock bucket. Tests can pre-populate this
 * to simulate existing objects, or inspect it after operations.
 */
export type MockR2Store = Map<string, { body: ArrayBuffer; metadata?: Record<string, string> }>;

/**
 * Creates a mock `R2Bucket` with in-memory store.
 *
 * ```ts
 * const { bucket, store } = createMockR2Bucket();
 * store.set("key.pdf", { body: new TextEncoder().encode("pdf-data").buffer });
 *
 * const obj = await bucket.get("key.pdf");
 * expect(obj).not.toBeNull();
 * ```
 */
export function createMockR2Bucket(initialStore?: MockR2Store) {
  const store: MockR2Store = initialStore ?? new Map();

  const bucket: MockR2Bucket = {
    get: vi.fn().mockImplementation(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;

      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(entry.body));
            controller.close();
          },
        }),
        size: entry.body.byteLength,
        etag: "mock-etag",
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: entry.metadata,
        writeHttpMetadata: vi.fn(),
      };
    }),

    put: vi.fn().mockImplementation(async (key: string, body: unknown, options?: unknown) => {
      let arrayBuffer: ArrayBuffer;
      if (body instanceof ArrayBuffer) {
        arrayBuffer = body;
      } else if (body instanceof Uint8Array) {
        // .buffer is ArrayBufferLike — copy to a fresh ArrayBuffer to satisfy type
        arrayBuffer = new ArrayBuffer(body.byteLength);
        new Uint8Array(arrayBuffer).set(body);
      } else if (typeof body === "string") {
        arrayBuffer = new TextEncoder().encode(body).buffer as ArrayBuffer;
      } else if (body instanceof ReadableStream) {
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        arrayBuffer = merged.buffer;
      } else {
        arrayBuffer = new ArrayBuffer(0);
      }

      const opts = options as
        | {
            httpMetadata?: { contentType?: string };
            customMetadata?: Record<string, string>;
          }
        | undefined;
      store.set(key, {
        body: arrayBuffer,
        metadata: opts?.customMetadata,
      });

      return {
        size: arrayBuffer.byteLength,
        etag: "mock-etag",
      } as R2Object;
    }),

    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),

    head: vi.fn().mockImplementation(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        size: entry.body.byteLength,
        etag: "mock-etag",
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: entry.metadata,
        writeHttpMetadata: vi.fn(),
      };
    }),

    list: vi.fn().mockImplementation(async () => {
      const keys = [...store.keys()].map((key) => ({
        key,
        size: store.get(key)?.body.byteLength ?? 0,
        etag: "mock-etag",
      }));
      return {
        objects: keys,
        truncated: false,
        cursor: "",
        delimitedPrefixes: [],
      };
    }),
  };

  return { bucket, store };
}

// ---------------------------------------------------------------------------
// Empty bucket helper
// ---------------------------------------------------------------------------

/**
 * Create an empty mock R2 bucket (no pre-populated objects).
 */
export function createEmptyR2Bucket() {
  return createMockR2Bucket();
}
