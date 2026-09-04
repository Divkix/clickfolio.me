export function getR2Binding(env: Partial<CloudflareEnv>): R2Bucket | null {
  return env.CLICKFOLIO_R2_BUCKET ?? null;
}

export const R2 = {
  async getAsArrayBuffer(binding: R2Bucket, key: string): Promise<ArrayBuffer | null> {
    const object = await binding.get(key);
    if (!object) return null;
    return object.arrayBuffer();
  },

  async getAsUint8Array(binding: R2Bucket, key: string): Promise<Uint8Array | null> {
    const arrayBuffer = await R2.getAsArrayBuffer(binding, key);
    if (!arrayBuffer) return null;
    return new Uint8Array(arrayBuffer);
  },

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

  async delete(binding: R2Bucket, key: string): Promise<void> {
    await binding.delete(key);
  },

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
};
