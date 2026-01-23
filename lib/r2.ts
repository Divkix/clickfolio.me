/**
 * Cloudflare R2 storage client
 *
 * Uses R2 binding for direct operations (get, put, delete, copy, head)
 */

/**
 * Get R2 binding from Cloudflare env
 * Used for direct R2 operations (get, put, delete, copy, head)
 */
export function getR2Binding(env: Partial<CloudflareEnv>): R2Bucket | null {
  return env.R2_BUCKET ?? null;
}

/**
 * R2 helper functions that wrap the R2 binding
 * These provide a consistent interface similar to S3 commands
 */
export const R2 = {
  /**
   * Get an object from R2
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
   * Get object as ArrayBuffer
   */
  async getAsArrayBuffer(binding: R2Bucket, key: string): Promise<ArrayBuffer | null> {
    const object = await binding.get(key);
    if (!object) return null;
    return object.arrayBuffer();
  },

  /**
   * Get object as Uint8Array
   */
  async getAsUint8Array(binding: R2Bucket, key: string): Promise<Uint8Array | null> {
    const arrayBuffer = await R2.getAsArrayBuffer(binding, key);
    if (!arrayBuffer) return null;
    return new Uint8Array(arrayBuffer);
  },

  /**
   * Get partial object (range request)
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
   * Put an object to R2
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
   * Delete an object from R2
   */
  async delete(binding: R2Bucket, key: string): Promise<void> {
    await binding.delete(key);
  },

  /**
   * Check if an object exists and get its metadata
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
   * Copy an object within R2
   * Note: R2 binding doesn't have native copy, so we get + put
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
   * Check if bucket is accessible (health check)
   */
  async healthCheck(binding: R2Bucket): Promise<boolean> {
    try {
      // List with limit 1 to verify bucket access
      await binding.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  },
};
