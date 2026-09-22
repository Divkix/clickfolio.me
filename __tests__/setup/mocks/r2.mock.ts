import { vi, type Mock } from "vite-plus/test";

/** A stand-in for `R2Bucket` covering the methods the suite exercises; assignable to `R2Bucket` itself. */
export interface MockR2Bucket {
  get: Mock;
  put: Mock;
  delete: Mock;
  head: Mock;
  list: Mock;
  // Multipart is unused by the suite, but `R2Bucket` requires it for assignability.
  createMultipartUpload: Mock;
  resumeMultipartUpload: Mock;
}

export type MockR2Store = Map<string, { body: ArrayBuffer; metadata?: Record<string, string> }>;

/** Body shapes `put` accepts, mirroring what callers hand a real bucket. */
type MockR2PutValue = ArrayBuffer | Uint8Array | string | ReadableStream | null;

/** The `put` option subset the mock records for `head` to report back. */
interface MockR2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

/** Copy a view into a buffer the store owns, so a later reader cannot detach it. */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(view.byteLength);

  new Uint8Array(copy).set(view);

  return copy;
}

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
        arrayBuffer: async () => entry.body,
      };
    }),

    put: vi
      .fn()
      .mockImplementation(async (key: string, body: MockR2PutValue, options?: MockR2PutOptions) => {
        let arrayBuffer: ArrayBuffer;

        if (body instanceof ArrayBuffer) {
          arrayBuffer = body;
        } else if (body instanceof Uint8Array) {
          arrayBuffer = toArrayBuffer(body);
        } else if (body instanceof ReadableStream) {
          const reader = body.getReader();
          const chunks: Uint8Array[] = [];

          for (;;) {
            const { done, value } = await reader.read();

            if (done) break;
            chunks.push(value);
          }

          const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);

          arrayBuffer = new ArrayBuffer(totalLength);

          const merged = new Uint8Array(arrayBuffer);
          let offset = 0;

          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }
        } else {
          arrayBuffer = toArrayBuffer(new TextEncoder().encode(body ?? ""));
        }

        store.set(key, {
          body: arrayBuffer,
          metadata: options?.customMetadata,
        });

        return {
          size: arrayBuffer.byteLength,
          etag: "mock-etag",
        };
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

    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),

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
