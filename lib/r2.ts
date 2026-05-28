/**
 * Cloudflare R2 storage client
 *
 * Uses R2 binding for direct operations (get, put, delete, copy, head)
 */

/**
 * Resolves the Cloudflare R2 bucket binding from the environment.
 *
 * @param env - The partial Cloudflare environment object.
 * @returns The R2 bucket binding or `null` if not configured.
 */
export function getR2Binding(env: Partial<CloudflareEnv>): R2Bucket | null {
  return env.CLICKFOLIO_R2_BUCKET ?? null;
}

export const R2 = {
  /**
   * Retrieves an object from R2, returning its body stream and content length.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key.
   * @returns The object stream and size, or `null` if not found.
   */
  async get(
    binding: R2Bucket,
    key: string,
  ): Promise<{ body: ReadableStream | null; contentLength: number | undefined } | null> {
    const object = await binding.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentLength: object.size,
    };
  },

  /**
   * Retrieves an object as a raw `ArrayBuffer`.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key.
   * @returns The object contents as an `ArrayBuffer`, or `null` if not found.
   */
  async getAsArrayBuffer(binding: R2Bucket, key: string): Promise<ArrayBuffer | null> {
    const object = await binding.get(key);
    if (!object) return null;
    return object.arrayBuffer();
  },

  /**
   * Retrieves an object as a `Uint8Array`.
   *
   * This is a convenience wrapper over `getAsArrayBuffer` that casts the buffer
   * to a typed array, which is useful for binary manipulation or API surfaces
   * that expect `Uint8Array`.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key.
   * @returns The object contents as a `Uint8Array`, or `null` if not found.
   */
  async getAsUint8Array(binding: R2Bucket, key: string): Promise<Uint8Array | null> {
    const arrayBuffer = await R2.getAsArrayBuffer(binding, key);
    if (!arrayBuffer) return null;
    return new Uint8Array(arrayBuffer);
  },

  /**
   * Retrieves a partial byte range of an object via an R2 range request.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key.
   * @param offset - The starting byte offset.
   * @param length - The number of bytes to read.
   * @returns The requested byte range as an `ArrayBuffer`, or `null` if not found.
   */
  async getPartial(
    binding: R2Bucket,
    key: string,
    offset: number,
    length: number,
  ): Promise<ArrayBuffer | null> {
    const object = await binding.get(key, {
      range: { offset, length },
    });
    if (!object) return null;
    return object.arrayBuffer();
  },

  /**
   * Uploads an object to R2 with optional content type and custom metadata.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The destination object key.
   * @param body - The object body (buffer, typed array, stream, or string).
   * @param options - Optional `contentType` and `customMetadata`.
   * @returns The uploaded R2 object metadata.
   */
  async put(
    binding: R2Bucket,
    key: string,
    body: ArrayBuffer | Uint8Array | ReadableStream | string,
    options?: {
      contentType?: string;
      customMetadata?: Record<string, string>;
    },
  ): Promise<R2Object> {
    return binding.put(key, body, {
      httpMetadata: options?.contentType ? { contentType: options.contentType } : undefined,
      customMetadata: options?.customMetadata,
    });
  },

  /**
   * Deletes an object from R2.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key to delete.
   */
  async delete(binding: R2Bucket, key: string): Promise<void> {
    await binding.delete(key);
  },

  /**
   * Checks whether an object exists in R2 and returns its metadata.
   *
   * @param binding - The R2 bucket binding.
   * @param key - The object key.
   * @returns An object with `exists`, `size`, and `etag`, or `null` if not found.
   */
  async head(
    binding: R2Bucket,
    key: string,
  ): Promise<{ exists: boolean; size?: number; etag?: string } | null> {
    const object = await binding.head(key);
    if (!object) return { exists: false };
    return {
      exists: true,
      size: object.size,
      etag: object.etag,
    };
  },

  /**
   * Copies an object within the same R2 bucket.
   *
   * @param binding - The R2 bucket binding.
   * @param sourceKey - The key of the object to copy.
   * @param destinationKey - The key for the new copy.
   * @returns `true` if the copy succeeded, `false` if the source object was not found.
   */
  async copy(binding: R2Bucket, sourceKey: string, destinationKey: string): Promise<boolean> {
    const object = await binding.get(sourceKey);
    if (!object) return false;

    const body = await object.arrayBuffer();
    await binding.put(destinationKey, body, {
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata,
    });
    return true;
  },

  /**
   * Performs a lightweight health check on the R2 bucket by listing up to 1 object.
   *
   * @param binding - The R2 bucket binding.
   * @returns `true` if the bucket is accessible, `false` otherwise.
   */
  async healthCheck(binding: R2Bucket): Promise<boolean> {
    try {
      await binding.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  },
};
