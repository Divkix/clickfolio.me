import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { resumes } from "@/lib/db/schema";

export function getR2Binding(env: Partial<CloudflareEnv>): R2Bucket | null {
  return env.CLICKFOLIO_R2_BUCKET ?? null;
}

/**
 * R2 keys owned by `userId`. Call while the resume rows still exist — the account
 * deletion cascade removes them, after which the key list is unrecoverable from the DB.
 */
export async function collectR2KeysForUser(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ r2Key: resumes.r2Key })
    .from(resumes)
    .where(eq(resumes.userId, userId));
  return rows.map((row) => row.r2Key);
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
